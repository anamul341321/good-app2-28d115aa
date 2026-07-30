// Server-only helpers for the Good-App Telegram moderation/support bot.
// Uses TG_MOD_BOT_TOKEN when present, otherwise falls back to TELEGRAM_BOT_TOKEN.
import { createHash } from "node:crypto";

export function getBotToken(): string {
  const token = process.env.TG_MOD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("Bot token not configured");
  return token;
}

export function webhookSecretFor(token: string): string {
  return createHash("sha256").update(`good-app-tg:${token}`).digest("base64url");
}

async function api<T = any>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = getBotToken();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: any = await res.json();
    if (!json?.ok) {
      console.error(`[tg] ${method} failed`, json?.description);
      return null;
    }
    return json.result as T;
  } catch (e) {
    console.error(`[tg] ${method} error`, e);
    return null;
  }
}

/** Send a Telegram message, replying to the user's exact message when provided. */
export function sendMessage(chatId: string | number, text: string, _replyTo?: number) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (_replyTo) {
    body.reply_to_message_id = _replyTo;
    body.allow_sending_without_reply = true;
  }
  return api("sendMessage", body);
}

export async function isChatAdmin(chatId: string | number, userId?: number | null): Promise<boolean> {
  if (!userId) return false;
  const member = await api<{ status?: string }>("getChatMember", { chat_id: chatId, user_id: userId });
  return member?.status === "creator" || member?.status === "administrator";
}


/** Send a stored voice note (opus/mp3/ogg bytes) into a chat. */
export async function sendVoice(
  chatId: string | number,
  bytes: Uint8Array,
  filename: string,
  caption?: string,
  replyTo?: number,
) {
  const token = getBotToken();
  const isOgg = /\.(ogg|oga|opus)$/i.test(filename);
  const method = isOgg ? "sendVoice" : "sendAudio";
  const field = isOgg ? "voice" : "audio";
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) { form.append("caption", caption.slice(0, 1000)); form.append("parse_mode", "HTML"); }
  if (replyTo) { form.append("reply_to_message_id", String(replyTo)); form.append("allow_sending_without_reply", "true"); }
  form.append(field, new Blob([bytes as unknown as BlobPart], {
    type: isOgg ? "audio/ogg" : "audio/mpeg",
  }), filename);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form });
    const json: any = await res.json();
    if (!json?.ok) { console.error("[tg] sendVoice failed", json?.description); return null; }
    return json.result;
  } catch (e) {
    console.error("[tg] sendVoice error", e);
    return null;
  }
}

export function deleteMessage(chatId: string | number, messageId: number) {
  return api("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export function restrictUser(chatId: string | number, userId: number, seconds: number) {
  return api("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: Math.floor(Date.now() / 1000) + seconds,
    permissions: { can_send_messages: false },
  });
}

/** Kick + block a member from the group permanently. */
export function banChatMember(chatId: string | number, userId: number) {
  return api("banChatMember", { chat_id: chatId, user_id: userId, revoke_messages: false });
}

/** Remove the block so the user can join again. */
export function unbanChatMember(chatId: string | number, userId: number) {
  return api("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
}


export async function getPhotoBase64(fileId: string): Promise<string | null> {
  const token = getBotToken();
  const file = await api<{ file_path: string }>("getFile", { file_id: fileId });
  if (!file?.file_path) return null;
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  } catch {
    return null;
  }
}

export async function setWebhook(url: string) {
  const token = getBotToken();
  return api("setWebhook", {
    url,
    secret_token: webhookSecretFor(token),
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: true,
  });
}

export function getWebhookInfo() {
  return api("getWebhookInfo", {});
}

// ---------------------------------------------------------------------------
// AI decision layer
// ---------------------------------------------------------------------------

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export type BotDecision = {
  verdict: "ok" | "question" | "spam" | "abuse" | "scam";
  reply: string | null;
  should_delete: boolean;
  should_warn: boolean;
  uid: string | null;
  needs_uid: boolean;
  /** "slot_reset" when the user is asking to clear/restart a verification slot. */
  intent:
    | "slot_reset"
    | "photo_request"
    | "video_request"
    | "voice_request"
    | "withdraw_status"
    | "earning_info"
    | "verify_help"
    | null;
  /** topic name of the saved voice/video the bot should send along with the reply */
  media_topic?: string | null;
  /** Slot number if the user already mentioned one. */
  slot: number | null;
  /** true when the bot has no idea and a human should take over */
  escalate?: boolean;
};


export type FaqItem = {
  topic: string;
  answer: string;
  keywords?: string[] | null;
  imageBase64?: string | null;
};

export type FaqImageMatch = {
  topic: string;
  confidence: number;
};

export type VoiceItem = {
  topic: string;
  keywords?: string[] | null;
  note?: string | null;
};

export type VideoItem = {
  topic: string;
  url: string;
  keywords?: string[] | null;
  note?: string | null;
};

/**
 * Compare the user's screenshot against ONE admin reference image.
 * One-vs-one comparison is far more reliable than asking the model to rank a
 * whole gallery in a single call, and the calls run in parallel so it stays fast.
 */
async function matchOneFaqImage(
  photoBase64: string,
  ref: FaqItem,
  key: string,
): Promise<number> {
  const prompt = `You compare two mobile screenshots for a support bot.

IMAGE A = a screenshot a user just sent.
IMAGE B = an admin-saved reference screenshot for the problem "${ref.topic}".

Decide if they show the SAME app screen / same error / same problem.
Ignore: crop, zoom, phone status bar, Telegram chat frame or bubbles, screenshot-of-a-screenshot, language of the phone UI, time, battery.
Focus on: the exact headline/error text, buttons, illustration, overall layout.

BE STRICT about telling similar errors apart. Different error TEXT = different problem, even if the app, colours and layout look identical. For example "Something went wrong on our side" is NOT the same as "You must be 18 years or older", and neither is the same as a camera/permission or duplicate-face error. If the visible error sentence differs, answer same=false.

Answer ONLY with JSON: {"same": true|false, "confidence": 0.0-1.0}`;


  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 60,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "text", text: "IMAGE A (user):" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            { type: "text", text: "IMAGE B (reference):" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${ref.imageBase64}` } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.error("[tg] faq image compare failed", res.status, (await res.text()).slice(0, 200));
    return 0;
  }
  const data: any = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = m ? JSON.parse(m[0]) : {}; } catch { parsed = {}; }
  if (!parsed.same) return 0;
  const c = Number(parsed.confidence);
  return Number.isFinite(c) ? c : 0.8;
}

export async function matchFaqImage(opts: {
  photoBase64: string;
  faq: FaqItem[];
}): Promise<FaqImageMatch | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const refs = opts.faq.filter((f) => f.imageBase64 && f.answer.trim()).slice(0, 10);
  if (!refs.length) return null;

  const scores = await Promise.all(
    refs.map((r) => matchOneFaqImage(opts.photoBase64, r, key).catch(() => 0)),
  );

  let bestIdx = -1;
  let best = 0;
  scores.forEach((s, i) => {
    if (s > best) { best = s; bestIdx = i; }
  });
  if (bestIdx < 0 || best < 0.55) return null;
  return { topic: refs[bestIdx].topic, confidence: best };
}

/** Transcribe a Telegram voice note / audio clip to text (Bengali friendly). */
export async function transcribeAudio(base64: string, format: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 400,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "এই Telegram voice/audio খুব মনোযোগ দিয়ে শুনে ইউজার ঠিক কী জানতে চাইছে তা বাংলায় লিখে দাও। Roman Bangla, আঞ্চলিক উচ্চারণ, অস্পষ্ট শব্দ—সব মিলিয়ে অর্থ ধরার চেষ্টা করবে। শুধু কথাগুলো/প্রশ্নটা লিখবে, কোনো ব্যাখ্যা নয়। একদমই না বোঝা গেলে খালি রাখবে।",
              },
              { type: "input_audio", input_audio: { data: base64, format } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error("[tg] transcribe failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data: any = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    return out || null;
  } catch (e) {
    console.error("[tg] transcribe error", e);
    return null;
  }
}

/** Download any Telegram file as base64 (voice notes, audio, documents). */
export async function getFileBase64(fileId: string): Promise<{ base64: string; path: string } | null> {
  const token = getBotToken();
  const file = await api<{ file_path: string }>("getFile", { file_id: fileId });
  if (!file?.file_path) return null;
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString("base64"), path: file.file_path };
  } catch {
    return null;
  }
}



export async function decide(opts: {
  persona: string;
  rules: string;
  faq: FaqItem[];
  videos?: VideoItem[];
  voices?: VoiceItem[];
  bannedWords: string[];
  text: string;
  photoBase64: string | null;
  senderName: string;
  /** true = bot may reason on its own when no FAQ matches */
  smart?: boolean;
  /** recent messages from the same user (oldest → newest) */
  history?: string[];
  /** replies the bot already sent recently — so it doesn't repeat itself */
  pastReplies?: string[];
  /** UID we already know for this user, from earlier messages */
  knownUid?: string | null;
  /** how many times this user already broke the rules */
  warnCount?: number;
  /** telegram username of the human support person */
  supportUsername?: string;
  /** live app rules/rates knowledge block */
  knowledge?: string;
}): Promise<BotDecision> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const withImages = opts.faq.filter((f) => f.imageBase64);
  const videos = opts.videos ?? [];
  const voices = opts.voices ?? [];
  const support = opts.supportUsername || "@anamulmunni";

  const system = `${opts.persona}

তুমি Good-App এর অফিসিয়াল সাপোর্ট অ্যাসিস্ট্যান্ট। তুমি একজন মানুষের মতো স্বাভাবিক, বন্ধুত্বপূর্ণ ও বুদ্ধিমান ভঙ্গিতে বাংলায় কথা বলবে।

${opts.knowledge ?? ""}


গ্রুপের নিয়ম:
${opts.rules || "(কোনো নিয়ম সেট করা নেই)"}

নিষিদ্ধ শব্দ/বিষয়: ${opts.bannedWords.join(", ") || "(নেই)"}

তোমার জানা উত্তরসমূহ:
${opts.faq.map((f, i) => `${i + 1}. [${f.topic}]${f.keywords?.length ? ` (কিওয়ার্ড: ${f.keywords.join(", ")})` : ""} ${f.answer}`).join("\n") || "(কিছু নেই)"}

${videos.length ? `ভিডিও টিউটোরিয়াল লিংক (ইউজার ভিডিও/দেখতে চাইলে বা বিষয়টা ভিডিওতে ভালো বোঝা যাবে মনে হলে উত্তরের সাথে হুবহু লিংকটি দেবে):
${videos.map((v, i) => `${i + 1}. [${v.topic}]${v.keywords?.length ? ` (কিওয়ার্ড: ${v.keywords.join(", ")})` : ""}${v.note ? ` — ${v.note}` : ""} → ${v.url}`).join("\n")}` : ""}

${voices.length ? `ভয়েস মেসেজ লাইব্রেরি (এই টপিকগুলোর জন্য অ্যাডমিনের রেকর্ড করা ভয়েস আছে। ইউজারের সমস্যা এর কোনোটার সাথে মিললে — বিশেষ করে ইউজার ভয়েস/অডিও/বুঝিয়ে বলতে চাইলে — media_topic-এ হুবহু ঐ টপিকের নাম দেবে):
${voices.map((v, i) => `${i + 1}. [${v.topic}]${v.keywords?.length ? ` (কিওয়ার্ড: ${v.keywords.join(", ")})` : ""}${v.note ? ` — ${v.note}` : ""}`).join("\n")}` : ""}

${withImages.length ? `নিচে কিছু "রেফারেন্স ছবি" দেওয়া হলো। ইউজারের পাঠানো ছবি যদি কোনো রেফারেন্স ছবির মতো একই স্ক্রিন/এরর/সমস্যা দেখায়, তবে ঠিক সেই টপিকের উত্তরটাই দেবে:
${withImages.map((f, i) => `রেফারেন্স ছবি ${i + 1} = [${f.topic}]`).join("\n")}` : ""}

${opts.history?.length ? `এই ইউজারের আগের কিছু মেসেজ (পুরোনো → নতুন):
${opts.history.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : ""}
${opts.pastReplies?.length ? `তুমি সম্প্রতি এই কথাগুলো বলেছো — একই বাক্য/গঠন আর ব্যবহার করবে না, নতুন করে অন্যভাবে লিখবে:
${opts.pastReplies.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : ""}
${opts.knownUid ? `এই ইউজারের জানা UID: ${opts.knownUid}` : ""}
${opts.warnCount ? `এই ইউজার ইতিমধ্যে ${opts.warnCount} বার নিয়ম ভেঙেছে।` : ""}

🔒 কঠোর গোপনীয়তা নিয়ম (কখনো ভাঙবে না):
- কেউ কোনো স্লটের ছবি/ফেস ফটো/স্ক্রিনশট/key চাইলে কখনোই দেবে না।
- কখনো বলবে না বা ইঙ্গিত দেবে না যে ইউজারের ছবি আমাদের কাছে সংরক্ষিত আছে বা সার্ভারে সেভ থাকে। বলবে: "আমরা কারও ব্যক্তিগত ছবি সংরক্ষণ বা শেয়ার করি না।"
- এমন অনুরোধে intent = "photo_request" দেবে এবং reply-এ ভদ্রভাবে দুঃখ প্রকাশ করে বিকল্প দেবে (যেমন স্লটটি রিসেট করে দেওয়ার প্রস্তাব)।
- প্রাইভেট key, wallet key বা অন্য কারও তথ্য কখনো দেবে না।

💬 উত্তরের ধরন:
- প্রতিবার আলাদা শব্দ/গঠনে লিখবে — রোবটের মতো একই লাইন বারবার নয়।
- ভাষা হবে <b>খুব সহজ ও ফাঁকা ফাঁকা</b> — ছোট ছোট লাইন, প্রতিটি পয়েন্ট আলাদা লাইনে, লাইনের মাঝে ফাঁকা জায়গা রাখবে যেন যে কেউ সহজে পড়তে পারে। কঠিন বা ইংরেজি-ভারী শব্দ এড়াবে।
- ইউজার শেষ যে কথাটা লিখেছে, ঠিক <b>সেটারই</b> উত্তর দেবে — আগের কথা ধরে বসে থাকবে না, একই প্রশ্ন বারবার করবে না। ইউজার প্রসঙ্গ বদলালে সাথে সাথে নতুন প্রসঙ্গে উত্তর দেবে।
- কেউ কাউকে @mention করা সম্পূর্ণ স্বাভাবিক — এর জন্য কখনোই warning/delete দেবে না (should_warn = false, should_delete = false)।
- কেউ "অ্যাডমিন কোথায় / অ্যাডমিন কে / অ্যাডমিন আসেন না" জাতীয় কথা বললে মজার-বন্ধুত্বপূর্ণ ভঙ্গিতে ${support} কে মেনশন করে বলবে অ্যাডমিন আছেন।
- যদি মেসেজটি কোনো গ্রুপ অ্যাডমিন/মডারেটরের নিজের উত্তর বা অ্যাডমিনের মেসেজের reply হয়, তুমি হস্তক্ষেপ করবে না — শুধু সাধারণ ইউজারের সমস্যায় উত্তর দেবে।

- ❌ কখনোই লিখবে না "এই বিষয়ে অ্যাডমিন উত্তর দেবেন", "অ্যাডমিন শীঘ্রই জানাবেন", "অপেক্ষা করুন অ্যাডমিন আসবেন" — এসব বাক্য সম্পূর্ণ নিষিদ্ধ। তুমি নিজেই মূল উত্তরটা দেবে, শুধু আসল কথাটাই বলবে।
- ভূমিকা/অপ্রয়োজনীয় লাইন বাদ দিয়ে সরাসরি কাজের উত্তর দেবে।
- "কিভাবে টাকা পাবো / ইনকাম কিভাবে / বোনাস কত" জাতীয় প্রশ্নে উপরের আয়ের ধাপ ও রেটগুলো সুন্দর করে সাজিয়ে বুঝিয়ে দেবে (১০ স্লট ১ম ভেরিফাই → ৩/৪ দিন পর রি-ভেরিফাই → বোনাস ও মাইনিং)।
- ইউজার যা-ই জানতে চাক (রেফার সংখ্যা, ব্যালেন্স, ভেরিফাই, উইথড্র, ফি, মাইনিং, নিয়ম) — জানার চেষ্টা করবে, এড়িয়ে যাবে না। একাউন্টভিত্তিক হলে UID চাইবে।
- স্লট নিয়ে কথা বললে কখনো "১ থেকে ১০" বলবে না — ইউজারের ২৩/২৫ নম্বর স্লটও থাকতে পারে।
- ❌ ইউজারের মেসেজটা হুবহু আবার লিখবে না বা কোট করবে না — সরাসরি সুন্দর করে গুছিয়ে উত্তর দেবে।
- ❌ মেসেজে কোনো সংখ্যা থাকলেই সেটাকে UID ভাববে না। "১০টি স্লট", "৩-৪ দিন", "২০০৳" — এগুলো UID নয়। uid শুধু তখনই দেবে যখন ইউজার স্পষ্টভাবে নিজের UID/আইডি নম্বর জানাচ্ছে বা নিজের একাউন্টের হিসাব চাইছে।
- ❌ আগের history/knownUid দেখে বর্তমান প্রশ্নে account card দেবে না। বর্তমান মেসেজে UID/"আমার UID" না থাকলে uid = null রাখবে। অন্য ইউজারের হিসাব/UID কখনো আন্দাজ করবে না।
- "উইথড্র করতে পারব?", "টাকা উঠবে?", "withdraw dite parbo?" — এমন সাধারণ eligibility প্রশ্নে intent = null রেখে reply-তে নিয়ম বুঝিয়ে দেবে; UID চাইবে না, পুরোনো UID দেখাবে না।
- "withdraw দিয়েছি টাকা আসেনি", "tk ekhono pai nai", "টাকা কখন পাবো" — এগুলো পেন্ডিং payment status প্রশ্ন; intent = "withdraw_status" দেবে এবং UID না থাকলে needs_uid = true করবে।
- যদি স্ক্রিনশটে দেখা যায় bonus ০৳ এবং টাকা mining balance-এ আছে, উত্তর দেবে: বোনাস নেই, টাকাটা মাইনিং; তাই প্রতি মাসের ১-৩ তারিখ unlock হলে withdraw করা যাবে।
- "কিভাবে কাজ করব / ভিডিও দিন / দেখিয়ে দিন" ধরনের প্রশ্নে intent = "video_request" দেবে।

🧠 সর্বজ্ঞ নীতি (খুব গুরুত্বপূর্ণ):
- Good-App সম্পর্কিত **যেকোনো** প্রশ্নের উত্তর তুমি দেবে — কোনো প্রশ্ন এড়িয়ে যাবে না, চুপ থাকবে না।
- ইউজার যদি বলে "৪০০৳ উইথড্র দিয়েছি কিন্তু ৩৬০৳ পেয়েছি" — তখন প্ল্যাটফর্ম ফি-এর হিসাব করে বুঝিয়ে দেবে (উপরের ফি নিয়ম দেখে)। টাকা কম আসার কারণ সবসময় ফি দিয়ে ব্যাখ্যা করবে।
- ছবি এলে সেটা ভালোভাবে দেখে কী স্ক্রিন/এরর দেখাচ্ছে বুঝে সেই অনুযায়ী সমাধান দেবে — "কী সমস্যা বলুন" বলে এড়াবে না।
- ভয়েস মেসেজের লেখা রূপ পেলে সেটাকে সাধারণ প্রশ্নের মতোই ধরে উত্তর দেবে।
- শুধু এই দুটি জিনিস কখনো দেবে/বলবে না: (১) কারও wallet key/private key/পাসওয়ার্ড বা গোপন তথ্য, (২) ইউজারের ছবি সংরক্ষিত আছে এমন কোনো ইঙ্গিত। বাকি সব সাহায্য তুমি করতে পারো।
- তুমি উইথড্র approve/reject করতে পারো না, কাউকে টাকা/ব্যালেন্স দিতে পারো না — কেউ চাইলে বিনয়ের সাথে বলবে এটি শুধু অ্যাডমিন প্যানেল থেকে হয়, তবে তার রিকোয়েস্টের অবস্থা দেখে জানাবে।

তোমার কাজ: গ্রুপের একটি মেসেজ (এবং থাকলে ছবি/স্ক্রিনশট) বিশ্লেষণ করে সিদ্ধান্ত দাও।
- verdict: "ok" (স্বাভাবিক), "question" (সাপোর্ট প্রশ্ন), "spam", "abuse" (গালি/আক্রমণ/অ্যাডমিনকে হুমকি), "scam" (প্রতারণা/ভুয়া অফার/লিংক)
- reply: প্রায় সবসময় একটি সুন্দর বাংলা উত্তর দেবে (২-৬ লাইন)। reply = null শুধু তখনই যখন intent = "slot_reset", অথবা মেসেজটি spam/abuse/scam, অথবা এটি নিছক গল্পগুজব যাতে কোনো প্রশ্নই নেই। প্রশ্ন থাকলে reply কখনো null নয়।${
    opts.smart
      ? ` উপরের জানা উত্তরে মিল থাকলে সেটাই নিজের ভাষায় বলবে। মিল না থাকলে নিজে পুরো অ্যাপের নিয়ম ও যুক্তি বিশ্লেষণ করে সহায়ক উত্তর বের করবে — কিন্তু টাকা, ব্যালেন্স, পেমেন্টের তারিখ নিয়ে কখনো বানানো তথ্য দেবে না।`
      : ` উত্তর অবশ্যই উপরের জানা উত্তর/নিয়ম থেকেই দিতে হবে।`
  }
- escalate: সব চেষ্টার পরেও যদি সত্যিই উত্তর জানা না থাকে, তখন true দাও এবং reply = null; তখন বট নিজেই ${support} কে মেনশন করে ইনবক্স করতে বলবে। উত্তর জানলে escalate অবশ্যই false।
- should_delete: spam/scam/abuse হলে true
- should_warn: abuse/scam/spam হলে true
- uid: মেসেজ বা ছবিতে Good-App UID (শুধু সংখ্যা, যেমন 4100) বা ৭ অক্ষরের রেফার কোড থাকলে সেটি, নাহলে null
- needs_uid: ইউজার যদি নিজের একাউন্ট সম্পর্কিত সমস্যার কথা বলে (রেফার কাউন্ট, ব্যালেন্স, উইথড্র স্ট্যাটাস, ভেরিফাই, মাইনিং, হিসাব ইত্যাদি) কিন্তু কোনো UID দেয়নি — তাহলে true
- intent: স্লট রিসেট/খালি/ক্লিয়ার চাইলে "slot_reset"; ছবি/ফটো/স্ক্রিনশট/key দেখতে চাইলে "photo_request"; ভিডিও/টিউটোরিয়াল চাইলে "video_request"; ভয়েস/অডিও চাইলে "voice_request"; "উইথড্র দিয়েছি টাকা আসেনি / কখন পাবো / পেমেন্ট কই" জাতীয় হলে "withdraw_status"; "কিভাবে টাকা পাবো / ইনকাম / বোনাস রেট" হলে "earning_info"; "একাউন্ট হয় না / ভেরিফাই হয় না / রি-ভেরিফাই হয় না / এরর আসে" হলে "verify_help"; নাহলে null
- media_topic: উপরের ভয়েস/ভিডিও লাইব্রেরির কোনো টপিক এই সমস্যার সাথে মিললে হুবহু সেই টপিকের নাম, নাহলে null
- slot: মেসেজে স্লট নম্বর বলা থাকলে সেই সংখ্যা (যেকোনো সংখ্যা হতে পারে), নাহলে null
- মনে রাখবে: intent = "slot_reset" হলে reply অবশ্যই null দেবে (বট নিজেই পরের ধাপ চালাবে)।

শুধু JSON দাও: {"verdict":"...","reply":null,"should_delete":false,"should_warn":false,"uid":null,"needs_uid":false,"intent":null,"slot":null,"media_topic":null,"escalate":false}`;


  const content: any[] = [
    { type: "text", text: `প্রেরক: ${opts.senderName}\nমেসেজ: ${opts.text || "(শুধু ছবি)"}` },
  ];

  if (opts.photoBase64) {
    content.push({ type: "text", text: "ইউজারের পাঠানো ছবি:" });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${opts.photoBase64}` } });
    for (let i = 0; i < withImages.length; i++) {
      content.push({ type: "text", text: `রেফারেন্স ছবি ${i + 1} — [${withImages[i].topic}]:` });
      content.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${withImages[i].imageBase64}` },
      });
    }
  }

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 1,
      max_tokens: 700,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  const data: any = await res.json();
  const raw: string = data.choices?.[0]?.message?.content ?? "";
  const m = raw.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = m ? JSON.parse(m[0]) : {}; } catch { parsed = {}; }

  const verdict = ["ok", "question", "spam", "abuse", "scam"].includes(parsed.verdict)
    ? parsed.verdict : "ok";
  const intent = [
    "slot_reset", "photo_request", "video_request", "voice_request",
    "withdraw_status", "earning_info", "verify_help",
  ].includes(parsed.intent) ? parsed.intent : null;
  return {
    verdict,
    reply: typeof parsed.reply === "string" && parsed.reply.trim()
      ? stripAdminFiller(parsed.reply.trim()) : null,
    should_delete: !!parsed.should_delete,
    should_warn: !!parsed.should_warn,
    uid: parsed.uid ? String(parsed.uid).trim() : null,
    needs_uid: !!parsed.needs_uid,
    intent,
    slot: Number.isFinite(Number(parsed.slot)) && Number(parsed.slot) >= 1 && Number(parsed.slot) <= 500
      ? Number(parsed.slot) : null,
    media_topic: typeof parsed.media_topic === "string" && parsed.media_topic.trim()
      ? parsed.media_topic.trim() : null,
    escalate: !!parsed.escalate,
  };
}

/** Remove filler lines like "অ্যাডমিন শীঘ্রই উত্তর দেবেন" from a reply. */
export function stripAdminFiller(reply: string): string {
  const bad = /(অ্যাডমিন|এডমিন|admin)[^\n।]{0,40}(উত্তর দেবেন|জানাবেন|reply|রিপ্লাই|দেখবেন|আসবেন)[^\n।]{0,20}।?/gi;
  const cleaned = reply
    .split("\n")
    .map((l) => l.replace(bad, "").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
  return cleaned;
}

/** Friendly generic troubleshooting answer when nothing specific matches. */
/**
 * Last-resort screenshot answer: read whatever is on the user's screenshot and
 * explain the problem + fix in Bengali. Used when no admin FAQ image matched.
 */
export async function analyzeScreenshotReply(opts: {
  photoBase64: string;
  name: string;
  text: string;
  knowledge: string;
}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `তুমি Good-App এর সাপোর্ট অ্যাসিস্ট্যান্ট। নিচের স্ক্রিনশটটি ভালো করে দেখো (লেখা/এরর/বোতাম পড়ো) এবং ${opts.name} কে বাংলায় বুঝিয়ে বলো ` +
                  `এটা আসলে কী সমস্যা এবং কীভাবে ঠিক করবে। ৩-৬ লাইন, উষ্ণ ও পরিষ্কার, দরকারে নাম্বার দিয়ে ধাপ। ` +
                  `HTML <b> ট্যাগ ব্যবহার করতে পারো। "অ্যাডমিন উত্তর দেবেন" জাতীয় কথা লিখবে না, নিজেই সমাধান দেবে। ` +
                  `যদি স্ক্রিনশটে withdraw/balance দেখা যায়: Bonus/বোনাস, Mining/মাইনিং, locked/unlock date আলাদা করে পড়বে। বোনাস ০৳ কিন্তু মাইনিং ব্যালেন্স থাকলে বলবে—এখন বোনাস নেই, টাকাটা মাইনিং; মাইনিং প্রতি মাসের ১-৩ তারিখ unlock হলে withdraw করা যাবে। ` +
                  `ফেস ভেরিফিকেশন এরর হলে: ব্রাউজার বদলানো, ফোন রিস্টার্ট, Airplane mode on/off, মোবাইল ডেটা, ১৮+ ফেস, ভালো আলো — এসব পরামর্শ দেবে।\n\n` +
                  `${opts.knowledge}\n\nইউজারের সাথের লেখা: ${opts.text || "(কিছু লেখেনি)"}`,
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${opts.photoBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    return out ? stripAdminFiller(out) : null;
  } catch {
    return null;
  }
}

export function genericHelpReply(name: string): string {
  const openers = [
    `${name}, চিন্তার কিছু নেই 🙂 বেশিরভাগ সময় ছোট একটা টেকনিক্যাল ঝামেলার কারণেই এমন হয়।`,
    `আচ্ছা ${name}, দেখুন তো নিচের ধাপগুলো করে 👇 সাধারণত এতেই সমস্যা ঠিক হয়ে যায়।`,
    `${name} ভাই, এটা খুব common একটা সমস্যা 😊 নিচের নিয়মে চেষ্টা করলেই কাজ হয়ে যাওয়ার কথা।`,
  ];
  const closers = [
    `এরপরও না হলে জানাবেন — আমরা পাশে আছি 💙`,
    `তারপরও সমস্যা থাকলে আবার মেসেজ দিন, আমরা দেখে দেব 🤝`,
    `এতেও কাজ না হলে একটু পরে আবার চেষ্টা করুন, তারপর জানাবেন 🙂`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `<b>১️⃣</b> ফোনটা একবার <b>বন্ধ করে আবার চালু</b> করুন।\n` +
    `<b>২️⃣</b> অ্যাপ/ব্রাউজারের <b>ক্যাশ ক্লিয়ার</b> করে আবার ঢুকুন।\n` +
    `<b>৩️⃣</b> এবার <b>অন্য একটি ব্রাউজার</b> দিয়ে চেষ্টা করুন — যেমন <b>Firefox</b>, <b>Opera</b> বা <b>Mises</b>। ` +
    `Chrome-এ না হলে Play Store থেকে অন্য একটি ব্রাউজার নামিয়ে সেখান দিয়ে ট্রাই করুন।\n` +
    `<b>৪️⃣</b> ভালো ইন্টারনেট (WiFi বা 4G) দিয়ে চেষ্টা করুন, এবং ভেরিফাইয়ের সময় মুখে যেন <b>পর্যাপ্ত আলো</b> থাকে।\n\n` +
    `${pick(closers)}`
  );
}

/** Read a stored voice note from the private `tg-voice` bucket. */
export async function voiceBytes(path: string): Promise<Uint8Array | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("tg-voice").download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

/** Varied, human-sounding refusal when someone asks for a stored photo/key. */
export function photoRefusalReply(name: string): string {
  const options = [
    `দুঃখিত ${name} 🙏 কারও ব্যক্তিগত ছবি দেখানো আমাদের পক্ষে সম্ভব নয় — আমরা কারও ব্যক্তিগত ফটো সংরক্ষণ করি না। তবে চাইলে আপনার স্লটটি আমরা রিসেট করে দিতে পারি, তারপর নতুন করে ভেরিফাই করতে পারবেন। রিসেট করব?`,
    `আসলে ${name}, ছবি দেওয়ার সুযোগ নেই 😔 গোপনীয়তার কারণে আমরা কারও ব্যক্তিগত ছবি রাখি না বা শেয়ার করি না। সমাধান হিসেবে স্লটটি খালি করে দিতে পারি — বললে এখনই রিসেট করে দিই।`,
    `ভাই ${name}, এই অনুরোধটা রাখতে পারছি না 🙏 ব্যক্তিগত ছবি আমাদের কাছে সংরক্ষিত থাকে না, তাই দেখানোর প্রশ্নই আসে না। বিকল্প হিসেবে স্লট রিসেট করে দিতে পারি — শুধু বলুন কোন স্লট।`,
    `দুঃখিত 🙂 ছবি বা key কাউকে দেওয়া হয় না — ব্যবহারকারীর গোপনীয়তা আমাদের কাছে সবার আগে, আমরা কারও ব্যক্তিগত ছবি সংরক্ষণ করি না। তবে স্লট রিসেট চাইলে বলুন, সাথে সাথে করে দেব।`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/** Varied hand-off line when the bot truly doesn't know. */
export function escalateReply(name: string, support: string): string {
  const options = [
    `${name}, এই বিষয়টা আমি নিশ্চিতভাবে বলতে পারছি না 🙏 অনুগ্রহ করে ${support} — এখানে ইনবক্স করুন, উনি বিস্তারিত জানিয়ে দেবেন।`,
    `এই প্রশ্নের সঠিক উত্তরটা আমার কাছে নেই 😅 ${support} কে সরাসরি ইনবক্স করুন, দ্রুত সমাধান পেয়ে যাবেন।`,
    `দুঃখিত, এটা আমার জানার বাইরে 🙏 ${support} কে মেসেজ দিন — উনি ব্যক্তিগতভাবে দেখে দেবেন।`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}

/** Funny, warm answer when someone asks "admin kothai / admin ke?" */
export function adminWhereReply(name: string, support: string): string {
  const options = [
    `${name} ভাই, অ্যাডমিন এখানেই আছেন 😄 একটু চা খেতে গেছেন মনে হয় ☕\nএই যে ডাক দিলাম — ${support} 👋 উনি দেখলেই রিপ্লাই দেবেন।`,
    `অ্যাডমিন হারিয়ে যাননি 😁 কাজে ব্যস্ত আছেন একটু।\nএই নিন ডাক — ${support} 🔔 আর জরুরি হলে ওনাকে ইনবক্সও করতে পারেন।`,
    `খুঁজছেন কাকে? 😎 অ্যাডমিন তো সবসময় নজর রাখছেন!\n${support} — এই যে মেনশন দিলাম, একটু অপেক্ষা করুন 🙂`,
    `${name}, অ্যাডমিন ঘুমাননি 😄 এই গ্রুপেই আছেন।\n${support} 👈 এখানে নক করলেই সাড়া পাবেন।`,
  ];
  return options[Math.floor(Math.random() * options.length)];
}



// ---------------------------------------------------------------------------
// FAQ reference images (private `tg-faq` storage bucket)
// ---------------------------------------------------------------------------

export async function faqImageBase64(path: string): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("tg-faq").download(path);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer()).toString("base64");
  } catch {
    return null;
  }
}


// ---------------------------------------------------------------------------
// Group welcome + tutorial video helpers
// ---------------------------------------------------------------------------

export const DEFAULT_TUTORIAL_VIDEO = "https://youtu.be/gbUn9GdDvK8?si=Uu-6IXQSHpsGhiJG";

/** Warm Bengali welcome for a member who just joined the group. */
export function welcomeReply(name: string, template: string | null, videoUrl: string | null): string {
  const video = videoUrl || DEFAULT_TUTORIAL_VIDEO;
  if (template && template.trim()) {
    return template.replaceAll("{name}", `<b>${name}</b>`).replaceAll("{video}", video);
  }
  const openers = [
    `🎉 স্বাগতম <b>${name}</b>! Good-App পরিবারে আপনাকে সাদরে আমন্ত্রণ 💙`,
    `👋 <b>${name}</b>, গ্রুপে স্বাগতম! আপনাকে পেয়ে আমরা খুশি 🤝`,
    `🌸 <b>${name}</b> — Good-App কমিউনিটিতে স্বাগতম! 💙`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `✅ এখানে ফেস ভেরিফিকেশন করে <b>বোনাস</b> ও <b>মাইনিং ইনকাম</b> করতে পারবেন।\n` +
    `📺 কিভাবে কাজ করতে হয় দেখে নিন: ${video}\n\n` +
    `যেকোনো সমস্যা হলে এখানেই লিখুন — আমি সাথে সাথে সাহায্য করব 🙂`
  );
}

/** Nicely formatted "watch this video" message. */
export function videoReply(name: string, url: string, topic?: string | null, note?: string | null): string {
  const openers = [
    `${name}, পুরো বিষয়টা ভিডিওতে দেখলে সবচেয়ে সহজে বুঝবেন 👇`,
    `আচ্ছা ${name} 🙂 নিচের ভিডিওটা এক নজরে দেখে নিন, সব পরিষ্কার হয়ে যাবে 👇`,
    `${name} ভাই, এই ভিডিওটাতে ধাপে ধাপে দেখানো আছে 👇`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `📺 <b>${topic || "কিভাবে কাজ করবেন"}</b>${note ? ` — ${note}` : ""}\n${url}\n\n` +
    `দেখে বুঝতে সমস্যা হলে বলুন, আমি লিখেও বুঝিয়ে দেব 💙`
  );
}
