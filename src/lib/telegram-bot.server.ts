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

export function sendMessage(chatId: string | number, text: string, replyTo?: number) {
  return api("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyTo ? { reply_to_message_id: replyTo, allow_sending_without_reply: true } : {}),
  });
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
  intent: "slot_reset" | "photo_request" | "video_request" | null;
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

export type VideoItem = {
  topic: string;
  url: string;
  keywords?: string[] | null;
  note?: string | null;
};


export async function decide(opts: {
  persona: string;
  rules: string;
  faq: FaqItem[];
  bannedWords: string[];
  text: string;
  photoBase64: string | null;
  senderName: string;
  /** true = bot may reason on its own when no FAQ matches */
  smart?: boolean;
  /** recent messages from the same user (oldest → newest) */
  history?: string[];
  /** UID we already know for this user, from earlier messages */
  knownUid?: string | null;
  /** how many times this user already broke the rules */
  warnCount?: number;
}): Promise<BotDecision> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const withImages = opts.faq.filter((f) => f.imageBase64);

  const system = `${opts.persona}

গ্রুপের নিয়ম:
${opts.rules || "(কোনো নিয়ম সেট করা নেই)"}

নিষিদ্ধ শব্দ/বিষয়: ${opts.bannedWords.join(", ") || "(নেই)"}

তোমার জানা উত্তরসমূহ:
${opts.faq.map((f, i) => `${i + 1}. [${f.topic}]${f.keywords?.length ? ` (কিওয়ার্ড: ${f.keywords.join(", ")})` : ""} ${f.answer}`).join("\n") || "(কিছু নেই)"}

${withImages.length ? `নিচে কিছু "রেফারেন্স ছবি" দেওয়া হলো। ইউজারের পাঠানো ছবি যদি কোনো রেফারেন্স ছবির মতো একই স্ক্রিন/এরর/সমস্যা দেখায়, তবে ঠিক সেই টপিকের উত্তরটাই দেবে:
${withImages.map((f, i) => `রেফারেন্স ছবি ${i + 1} = [${f.topic}]`).join("\n")}` : ""}

${opts.history?.length ? `এই ইউজারের আগের কিছু মেসেজ (পুরোনো → নতুন):
${opts.history.map((h, i) => `${i + 1}. ${h}`).join("\n")}` : ""}
${opts.knownUid ? `এই ইউজারের জানা UID: ${opts.knownUid}` : ""}
${opts.warnCount ? `এই ইউজার ইতিমধ্যে ${opts.warnCount} বার নিয়ম ভেঙেছে।` : ""}

তোমার কাজ: গ্রুপের একটি মেসেজ (এবং থাকলে ছবি/স্ক্রিনশট) বিশ্লেষণ করে সিদ্ধান্ত দাও।
- verdict: "ok" (স্বাভাবিক), "question" (সাপোর্ট প্রশ্ন), "spam", "abuse" (গালি/আক্রমণ/অ্যাডমিনকে হুমকি), "scam" (প্রতারণা/ভুয়া অফার/লিংক)
- reply: প্রশ্ন হলে বাংলায় সংক্ষিপ্ত, ভদ্র ও পরিষ্কার উত্তর (২-৫ লাইন), নাহলে null।${
    opts.smart
      ? ` উপরের জানা উত্তরে মিল থাকলে সেটাই অগ্রাধিকার দেবে। মিল না থাকলে নিজে বুদ্ধি খাটিয়ে অ্যাপের নিয়ম ও সাধারণ যুক্তি দিয়ে সহায়ক উত্তর দেবে — কিন্তু টাকা, ব্যালেন্স, পেমেন্টের তারিখ বা নিয়ম নিয়ে কখনো বানানো তথ্য দেবে না; নিশ্চিত না হলে বলবে "এই বিষয়ে অ্যাডমিন শীঘ্রই জানাবেন।"`
      : ` উত্তর অবশ্যই উপরের জানা উত্তর/নিয়ম থেকেই দিতে হবে; না জানলে reply দাও: "এই বিষয়ে অ্যাডমিন শীঘ্রই উত্তর দেবেন।"`
  }
- should_delete: spam/scam/abuse হলে true
- should_warn: abuse/scam/spam হলে true
- uid: মেসেজ বা ছবিতে Good-App UID (শুধু সংখ্যা, যেমন 4100) বা ৭ অক্ষরের রেফার কোড থাকলে সেটি, নাহলে null
- needs_uid: ইউজার যদি নিজের একাউন্ট সম্পর্কিত সমস্যার কথা বলে (রেফার কাউন্ট মিলছে না, ব্যালেন্স, উইথড্র, ভেরিফাই, মাইনিং ইত্যাদি) কিন্তু কোনো UID দেয়নি — তাহলে true, নাহলে false
- intent: ইউজার যদি কোনো স্লট রিসেট/খালি/ক্লিয়ার/মুছে দিতে বলে (যেমন "slot reset koro", "স্লট রিসেট", "key মুছে দিন", "স্লট খালি করে দিন") তাহলে "slot_reset", নাহলে null
- slot: মেসেজে স্লট নম্বর (১-১০) বলা থাকলে সেই সংখ্যা, নাহলে null
- মনে রাখবে: intent = "slot_reset" হলে reply অবশ্যই null দেবে (বট নিজেই পরের ধাপ চালাবে)।

শুধু JSON দাও: {"verdict":"...","reply":null,"should_delete":false,"should_warn":false,"uid":null,"needs_uid":false,"intent":null,"slot":null}`;


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
  return {
    verdict,
    reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : null,
    should_delete: !!parsed.should_delete,
    should_warn: !!parsed.should_warn,
    uid: parsed.uid ? String(parsed.uid).trim() : null,
    needs_uid: !!parsed.needs_uid,
    intent: parsed.intent === "slot_reset" ? "slot_reset" : null,
    slot: Number.isFinite(Number(parsed.slot)) && Number(parsed.slot) >= 1 && Number(parsed.slot) <= 10
      ? Number(parsed.slot) : null,

  };
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

