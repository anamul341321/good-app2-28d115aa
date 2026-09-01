import { aiFetch } from "./ai-free.server";
import { cachedAnswer, rememberAnswer } from "./ai-cache.server";
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

/**
 * Telegram only understands a small HTML subset. Models often reply with
 * Markdown (**bold**), which showed up literally in the group, and any stray
 * "<" made Telegram reject the whole message (user saw a half-written reply).
 */
export function sanitizeTelegramHtml(input: string): string {
  const ALLOWED = /^(\/?)(b|strong|i|em|u|s|code|pre|a)(\s[^<>]*)?$/i;
  let out = input
    .replace(/\*\*(.+?)\*\*/gs, "<b>$1</b>")
    .replace(/(^|\s)\*(?!\s)([^*\n]+?)\*(?=\s|$|[।,.!?])/g, "$1<i>$2</i>")
    .replace(/^#{1,6}\s*/gm, "");
  // escape any tag that is not in the allowed subset
  out = out.replace(/<([^<>]*)>/g, (m, inner) => (ALLOWED.test(String(inner)) ? m : `&lt;${inner}&gt;`));
  return stripBrandName(out).trim();
}

/** Never let the upstream identity provider's name reach users — always say Good-App. */
export function stripBrandName(input: string): string {
  return input
    .replace(/good\s*-?\s*dollar/gi, "Good-App")
    .replace(/গুড\s*-?\s*ডলার/g, "Good-App")
    .replace(/\bG\$\b/g, "Good-App")
    .replace(/(Good-App\s+){2,}/g, "Good-App ");
}

/** Close any tag left open by chunk-splitting so Telegram never rejects a part. */
function balanceHtml(chunk: string): string {
  const stack: string[] = [];
  const re = /<(\/?)(b|strong|i|em|u|s|code|pre|a)(\s[^<>]*)?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) {
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const idx = stack.lastIndexOf(tag);
      if (idx >= 0) stack.splice(idx, 1);
    } else stack.push(tag);
  }
  return chunk + stack.reverse().map((t) => `</${t}>`).join("");
}

/** Split a long reply into Telegram-safe chunks and send them as text. */
async function sendTextOnly(chatId: string | number, full: string, _replyTo?: number) {
  const chunks: string[] = [];
  let rest = full;
  while (rest.length > 3800) {
    let cut = rest.lastIndexOf("\n\n", 3800);
    if (cut < 1500) cut = rest.lastIndexOf("\n", 3800);
    if (cut < 1500) cut = rest.lastIndexOf(" ", 3800);
    if (cut < 1500) cut = 3800;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  chunks.push(rest);

  let last: unknown = null;
  for (let i = 0; i < chunks.length; i++) {
    const piece = balanceHtml(chunks[i]);
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: piece,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (_replyTo && i === 0) {
      body.reply_to_message_id = _replyTo;
      body.allow_sending_without_reply = true;
    }
    let sent = await api("sendMessage", body);
    // HTML parse error → পুরো মেসেজটা হারিয়ে যেতো; এখন প্লেইন টেক্সটে আবার পাঠানো হয়।
    if (!sent) {
      const plain = piece.replace(/<[^<>]*>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
      sent = await api("sendMessage", {
        chat_id: chatId,
        text: plain,
        disable_web_page_preview: true,
        ...(i === 0 && _replyTo ? { reply_to_message_id: _replyTo, allow_sending_without_reply: true } : {}),
      });
    }
    last = sent;
  }
  return last;
}

/**
 * প্রতি মেসেজের জন্য রিপ্লাই-মোড।
 * ডিফল্ট: লেখা + ভয়েস দুটোই। ইউজার "ভয়েসে বলো / লেখা বুঝি না" বললে শুধু ভয়েস।
 */
let replyModeOverride: "voice" | "text" | null = null;

export function setReplyMode(mode: "voice" | "text" | null) {
  replyModeOverride = mode;
}

/** ইউজার ভয়েসে উত্তর চাইছে কি না। */
export function asksForVoiceReply(s: string): boolean {
  const t = String(s || "").toLowerCase();
  return (
    /(voice|ভয়েস|vice|vois|audio|অডিও|shune|শুনে|শুনাও|shunao|shonao|শোনাও|mukhe|মুখে)[^\n]{0,25}(bol|বল|dao|দাও|de|দে|kotha|কথা|reply|রিপ্লাই|pathao|পাঠাও|answer|utt?or|উত্তর|de[nb]|দেন|dibe|দিবে|chai|চাই)/i.test(t) ||
    /(bol|বল|kotha bol|কথা বল)[^\n]{0,15}(voice|ভয়েস|audio|অডিও)/i.test(t) ||
    /(lekha|লেখা|লিখা|likha|text|টেক্সট)[^\n]{0,25}(bujh?i na|বুঝি না|buji na|বুঝিনা|pori na|পড়ি না|portె|porte pari na|পড়তে পারি না)/i.test(t)
  );
}

/** Send a Telegram message, replying to the user's exact message when provided. */
export async function sendMessage(chatId: string | number, text: string, _replyTo?: number) {
  const full = sanitizeTelegramHtml(text);
  const prefs = await voicePrefs();
  // অ্যাডমিন ভয়েস বন্ধ রাখলে ভয়েস যাবে না। খোলা থাকলে ডিফল্টে লেখা + ভয়েস
  // দুটোই যায়; ইউজার নিজে "ভয়েসে বলো" বললে শুধু ভয়েস।
  const voiceOnly = prefs.voice && replyModeOverride === "voice";
  const voiceOn = prefs.voice;
  // ভয়েস বন্ধ থাকলে "শুধু ভয়েস" মানে হয় না — তখন সবসময় লেখা যাবে, নইলে বট
  // পুরোপুরি চুপ হয়ে যায় (KYC/DM কোনো উত্তরই পেত না)।
  const textOn = !voiceOnly && (prefs.text !== false || !voiceOn);

  const plainLen = full.replace(/<[^>]+>/g, "").trim().length;
  const wantVoice = voiceOn && plainLen >= 1;


  // ভয়েস বানানো শুরু হয় লেখা পাঠানোর *আগেই* (parallel) — তাই দেরি হয় না।
  let voicePromise: Promise<Uint8Array | null> | null = null;
  if (wantVoice) {
    void api("sendChatAction", { chat_id: chatId, action: "record_voice" });
    voicePromise = import("./tts-free.server")
      // ভয়েসে সংক্ষেপে বলা হয় — কোটা কম খরচ হয় ও শুনতেও সহজ লাগে।
      .then((m) => m.speakBengali(m.voiceBrief(full)))
      .catch((e) => {
        console.error("[tg] voice reply failed", e);
        return null;
      });
  }

  let last: unknown = null;
  if (textOn) last = await sendTextOnly(chatId, full, _replyTo);

  // ---- ভয়েস উত্তর: একই উত্তরটি মেয়ে-কণ্ঠে বাংলায় (সংক্ষেপে) ----
  if (voicePromise) {
    const wav = await voicePromise;
    if (wav) {
      await sendVoice(chatId, wav, "reply.wav", undefined, _replyTo);
    } else if (!textOn) {
      // Voice-only mode must never become a silent mode when the provider is
      // unavailable or out of quota. Send the answer as text as a fallback.
      last = await sendTextOnly(chatId, full, _replyTo);
    }
  }

  return last;
}


/**
 * Send a photo from a URL (used for the hisab card image). Returns false when
 * Telegram could not fetch/render it — the caller already sent the text hisab.
 */
export async function sendPhotoUrl(
  chatId: string | number,
  photoUrl: string,
  caption?: string,
  replyTo?: number,
): Promise<boolean> {
  const body: Record<string, unknown> = { chat_id: chatId, photo: photoUrl };
  if (caption) {
    body.caption = sanitizeTelegramHtml(caption).slice(0, 1000);
    body.parse_mode = "HTML";
  }
  if (replyTo) {
    body.reply_to_message_id = replyTo;
    body.allow_sending_without_reply = true;
  }
  const res = await api("sendPhoto", body);
  return !!res;
}


/**
 * ভয়েস সেটিং: অ্যাডমিন প্যানেলের স্যুইচ (৫ সেকেন্ড ক্যাশ)।
 * voice_reply_enabled → ভয়েস দেবে কি না। voice_text_enabled → ভয়েসের সাথে
 * লেখাও যাবে কি না (অফ করলে শুধু ভয়েস)। ENV BOT_VOICE_REPLY=off দিলে ভয়েস বন্ধ।
 */
let voicePrefCache: { at: number; voice: boolean; text: boolean } | null = null;

export async function voicePrefs(): Promise<{ voice: boolean; text: boolean }> {
  const env = String(process.env.BOT_VOICE_REPLY ?? "").trim().toLowerCase();
  const envOff = env === "off" || env === "0" || env === "false";
  if (voicePrefCache && Date.now() - voicePrefCache.at < 5_000) {
    return { voice: !envOff && voicePrefCache.voice, text: voicePrefCache.text };
  }
  let voice = true;
  let text = true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("tg_bot_settings")
      .select("voice_reply_enabled, voice_text_enabled")
      .eq("id", "default")
      .maybeSingle();
    if (data) {
      voice = (data as any).voice_reply_enabled !== false;
      text = (data as any).voice_text_enabled !== false;
    }
  } catch {
    /* DB unavailable → default: ভয়েস + লেখা দুটোই */
  }
  voicePrefCache = { at: Date.now(), voice, text };
  return { voice: !envOff && voice, text };
}



/**
 * OCR: read every visible line of text from a screenshot. Image-vs-image
 * matching alone missed obvious cases (e.g. the 18+ page) — reading the error
 * text lets us match the saved admin/built-in answers deterministically.
 */
export async function readScreenshotText(photoBase64: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return "";
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcribe ALL visible text in this screenshot, verbatim, one line per line. " +
                  "Include error messages, buttons and small print. No commentary.",
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return "";
    const data: any = await res.json();
    return String(data.choices?.[0]?.message?.content ?? "").trim();
  } catch {
    return "";
  }
}


export async function isChatAdmin(chatId: string | number, userId?: number | null): Promise<boolean> {
  if (!userId) return false;
  const member = await api<{ status?: string }>("getChatMember", { chat_id: chatId, user_id: userId });
  return member?.status === "creator" || member?.status === "administrator";
}


/**
 * Send a stored clip as a real Telegram **voice note** (round waveform bubble),
 * never as an audio/music file. Telegram accepts .ogg/.opus, .mp3 and .m4a for
 * sendVoice, so we always use sendVoice and never attach a caption/title —
 * that's what used to print the file name + "mp3" over the player.
 */
export async function sendVoice(
  chatId: string | number,
  bytes: Uint8Array,
  filename: string,
  _caption?: string,
  replyTo?: number,
) {
  const token = getBotToken();
  const isOgg = /\.(ogg|oga|opus)$/i.test(filename);
  const isWav = /\.wav$/i.test(filename);
  const mime = isOgg ? "audio/ogg" : isWav ? "audio/wav" : "audio/mpeg";
  const name = isOgg ? filename : isWav ? "voice.wav" : "voice.ogg";
  const build = () => {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (replyTo) {
      form.append("reply_to_message_id", String(replyTo));
      form.append("allow_sending_without_reply", "true");
    }
    return form;
  };
  const post = async (method: string, field: string) => {
    const form = build();
    form.append(field, new Blob([bytes as unknown as BlobPart], { type: mime }), name);
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(12_000),
    });
    const json: any = await res.json();
    if (!json?.ok) {
      console.error(`[tg] ${method} failed`, json?.description);
      return null;
    }
    return json.result;
  };
  try {
    const voice = await post("sendVoice", "voice");
    if (voice) return voice;
    // WAV-এর ক্ষেত্রে Telegram মাঝে মাঝে voice নেয় না — তখন audio হিসেবে যাবে।
    return await post("sendAudio", "audio");
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

/** ফ্রিজ খুলে দেওয়া — ইউজার সাথে সাথেই আবার লিখতে পারবে। */
export function unrestrictUser(chatId: string | number, userId: number) {
  return api("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: 0,
    permissions: {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: true,
      can_pin_messages: false,
    },
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
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, {
      signal: AbortSignal.timeout(8_000),
    });
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
    allowed_updates: ["message", "edited_message", "callback_query", "chat_member"],
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
const MODEL = "google/gemini-2.5-flash";

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


  const res = await aiFetch(AI_URL, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
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
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  // উত্তর লেখা না থাকলেও ছবি থাকলে ম্যাচ করবে — উত্তর বট নিজেই বানিয়ে নেবে।
  const refs = opts.faq.filter((f) => f.imageBase64).slice(0, 10);
  if (!refs.length) return null;

  const scores = await Promise.all(
    refs.map((r) => matchOneFaqImage(opts.photoBase64, r, key).catch(() => 0)),
  );

  const ranked = refs
    .map((r, i) => ({ ref: r, score: scores[i], idx: i }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (!top || top.score < 0.55) return null;

  // When several saved screenshots score close together (same app, different
  // error text) force the model to pick exactly one — otherwise every similar
  // screenshot would get the first topic's answer.
  const close = ranked.filter((r) => r.score >= 0.5 && top.score - r.score <= 0.2).slice(0, 4);
  if (close.length > 1) {
    const picked = await pickBestFaqImage(opts.photoBase64, close.map((c) => c.ref), key).catch(() => -1);
    if (picked >= 0 && picked < close.length) {
      return { topic: close[picked].ref.topic, confidence: Math.max(close[picked].score, 0.6) };
    }
  }

  return { topic: top.ref.topic, confidence: top.score };
}

/** Forced-choice pass: show the user's screenshot next to the close candidates. */
async function pickBestFaqImage(photoBase64: string, refs: FaqItem[], key: string): Promise<number> {
  const content: any[] = [
    {
      type: "text",
      text: `A user sent IMAGE A. Below are ${refs.length} admin reference screenshots (REF 1..${refs.length}), each for a DIFFERENT problem.

Pick the ONE reference that shows the exact same error/screen as IMAGE A. Compare the visible error/headline text word by word — that is the deciding factor, not colours or layout.

Reference topics:
${refs.map((r, i) => `REF ${i + 1}: ${r.topic}`).join("\n")}

Answer ONLY JSON: {"best": <1-${refs.length} or 0 if none really matches>}`,
    },
    { type: "text", text: "IMAGE A (user):" },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
  ];
  refs.forEach((r, i) => {
    content.push({ type: "text", text: `REF ${i + 1} (${r.topic}):` });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${r.imageBase64}` } });
  });

  const res = await aiFetch(AI_URL, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, temperature: 0, max_tokens: 40, messages: [{ role: "user", content }] }),
  });
  if (!res.ok) return -1;
  const data: any = await res.json();
  const m = String(data.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
  if (!m) return -1;
  try {
    const best = Number(JSON.parse(m[0]).best);
    return Number.isFinite(best) && best >= 1 ? best - 1 : -1;
  } catch {
    return -1;
  }
}

/**
 * Rewrite a canned admin answer so it reads like a real person typed it —
 * same facts, different wording/opening each time.
 */
/**
 * Detect when the rewrite model returned its own instructions / meta-analysis
 * (English bullet lists like "*Emoji count*: 2-3 emojis", "purely text with
 * HTML", "Tone:") instead of an actual Bengali support reply.
 */
function isMetaOutput(out: string, original: string): boolean {
  const bn = (out.match(/[\u0980-\u09FF]/g) ?? []).length;
  const letters = (out.match(/[A-Za-z\u0980-\u09FF]/g) ?? []).length || 1;
  const origBn = (original.match(/[\u0980-\u09FF]/g) ?? []).length;
  // মূল উত্তর বাংলা অথচ রিরাইট প্রায় পুরোটাই ইংরেজি → মেটা টেক্সট
  if (origBn > 20 && bn / letters < 0.3) return true;
  return /(emoji count|tone\s*:|purely text|markdown|html tag|line count|word count|instruction|rewrite|as an ai|system prompt|\*\s*\*[A-Za-z][^*]{2,}\*\s*:)/i.test(out);
}

export async function humanizeReply(answer: string, userText?: string, avoid?: string[]): Promise<string> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return answer;
  const tones = [
    "বন্ধুর মতো সহজ ও আন্তরিক",
    "শান্ত, ভরসা দেওয়া সাপোর্ট এজেন্টের মতো",
    "ছোট ছোট লাইনে, একটু প্রাণবন্ত",
    "ভদ্র ও গুছানো, একটু আনুষ্ঠানিক",
  ];
  const tone = tones[Math.floor(Math.random() * tones.length)];
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 1,
        max_tokens: 2500,
        messages: [
          {
            role: "user",
            content: `তুমি Good-App এর সাপোর্ট এজেন্ট (মানুষ, বট নয়)। নিচের উত্তরটা একই তথ্য রেখে নিজের ভাষায় নতুন করে লিখো।

নিয়ম:
- কোনো তথ্য, নিয়ম, সংখ্যা, লিংক বাদ দেবে না বা বানাবে না।
- টোন: ${tone}।
- <b>সংক্ষেপে</b> লিখবে — মূল উত্তরের চেয়ে লম্বা কখনোই নয়, বরং ছোট করবে। সাধারণ কথা ১–৩ লাইনে, হিসাব/ধাপ হলে সর্বোচ্চ ৫-৬ লাইন। গ্রুপে স্প্যাম মনে হয় এমন লম্বা মেসেজ নয়।
- ছোট ছোট লাইন, দরকারে ১-২টা ইমোজি। HTML ট্যাগ (<b>) থাকলে রাখতে পারো, Markdown ব্যবহার করবে না।
- শুরুটা প্রতিবার আলাদা হবে, রোবটের মতো একই বাক্য নয়।

${avoid?.length ? `- আগের এই রিপ্লাইগুলোর মতো শোনাবে না:\n${avoid.slice(0, 3).map((a) => `"${a.slice(0, 160)}"`).join("\n")}` : ""}
${userText ? `\nইউজার বলেছে: "${userText.slice(0, 300)}"` : ""}

মূল উত্তর:
"""${answer}"""

শুধু বাংলায় লেখা চূড়ান্ত রিপ্লাইটাই দাও — কোনো ইংরেজি ব্যাখ্যা, নিয়ম, টোন/ইমোজি সংক্রান্ত মন্তব্য বা লিস্ট লিখবে না।`,
          },
        ],
      }),
    });
    if (!res.ok) return answer;
    const data: any = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    // মডেল মাঝে মাঝে রিরাইট না করে নিজের ইনস্ট্রাকশন/অ্যানালাইসিস (ইংরেজিতে,
    // "Emoji count", "Tone:", "purely text with HTML" ইত্যাদি) ফেরত দেয় —
    // সেটা গ্রুপে পাঠালে ইউজার কিছুই বোঝে না। এমন হলে মূল উত্তরটাই যাবে।
    // মডেল টোকেন লিমিটে আটকে গেলে লেখা মাঝপথে কেটে যায় — তখন অর্ধেক বাংলা
    // মেসেজ না পাঠিয়ে মূল পূর্ণ উত্তরটাই যাবে।
    const truncated =
      data.choices?.[0]?.finish_reason === "length" ||
      (out.length > 80 && !/[।!?…"”)\]]\s*$/.test(out) && !/[\u{1F300}-\u{1FAFF}]\s*$/u.test(out));
    if (!out || out.length <= 20 || truncated || isMetaOutput(out, answer)) return answer;
    return out;
  } catch {
    return answer;
  }
}


function audioMime(format: string): string {
  const f = format.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (f === "mp3") return "audio/mpeg";
  if (f === "wav") return "audio/wav";
  if (f === "m4a" || f === "mp4") return "audio/mp4";
  if (f === "webm") return "audio/webm";
  if (f === "aac") return "audio/aac";
  if (f === "flac") return "audio/flac";
  return "audio/ogg";
}

function cleanTranscriptText(input: string): string | null {
  const out = stripBrandName(input)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .replace(/^\s*(transcript|শোনা কথা|ভয়েস|voice)\s*[:：-]\s*/i, "")
    .trim();
  if (!out || out.replace(/[^\p{L}\p{N}]/gu, "").length < 3) return null;
  return out;
}

function transcriptFromSse(raw: string): string | null {
  let done = "";
  let deltas = "";
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const json = JSON.parse(payload);
      if (json?.type === "transcript.text.done" && typeof json.text === "string") done = json.text;
      if (json?.type === "transcript.text.delta" && typeof json.delta === "string") deltas += json.delta;
    } catch {
      // Ignore non-JSON keepalive chunks.
    }
  }
  return cleanTranscriptText(done || deltas);
}

async function transcribeAudioStt(base64: string, format: string, key: string): Promise<string | null> {
  try {
    const ext = format.toLowerCase().replace(/[^a-z0-9]/g, "") || "ogg";
    const bytes = Buffer.from(base64, "base64");
    if (bytes.byteLength < 512) return null;
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("stream", "true");
    form.append("language", "bn");
    // Domain vocabulary hint — Bengali support callers mix Bangla + Roman Bangla
    // and app jargon; without this the model mangles UID/slot/withdraw words.
    form.append(
      "prompt",
      "বাংলা ভয়েস। Good-App সাপোর্ট। সম্ভাব্য শব্দ: UID, স্লট, ফেস ভেরিফাই, রি-ভেরিফাই, হোয়াইটলিস্ট, " +
        "উইথড্র, বিকাশ, নগদ, রিচার্জ, মাইনিং, রেফার, বোনাস, ফি, চার্জ, কেটে নিয়েছে, টাকা, রিসেট, পাসওয়ার্ড।",
    );
    form.append("file", new Blob([bytes as unknown as BlobPart], { type: audioMime(ext) }), `telegram-voice.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Lovable-API-Key": key },
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      console.error("[tg] stt transcribe failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const raw = await res.text();
    return transcriptFromSse(raw);
  } catch (e) {
    console.error("[tg] stt transcribe error", e);
    return null;
  }
}

/** Transcribe a Telegram voice note / audio clip to text (Bengali friendly). */
export async function transcribeAudio(
  base64: string,
  format: string,
  hint?: string,
): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;

  // ফ্রি Gemini native-audio আগে — এটা OGG সোজা বোঝে, ক্রেডিটও খরচ হয় না।
  // আগে পেইড গেটওয়ে STT আগে চলত, সেটাই webhook-এর পুরো সময় খেয়ে ফেলত, তাই
  // প্রতিটা ভয়েসেই "বুঝতে পারিনি" যেত।
  try {
    const { hearBengali } = await import("./stt-free.server");
    const heard = await hearBengali(base64, format, hint);
    if (heard) return cleanTranscriptText(heard) ?? heard;
  } catch (e) {
    console.error("[tg] gemini stt error", e);
  }

  const allowPaid = ["on", "1", "true"].includes(
    String(process.env.BOT_ALLOW_PAID ?? "").trim().toLowerCase(),
  );
  if (allowPaid && process.env.LOVABLE_API_KEY) {
    const stt = await transcribeAudioStt(base64, format, process.env.LOVABLE_API_KEY);
    if (stt) return stt;
  }
  if (!key) return null;


  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "এই Telegram voice/audio খুব মনোযোগ দিয়ে শুনে ইউজার এখন ঠিক কী বলছে/জানতে চাইছে তা বাংলায় লিখে দাও। " +
                  "শুধু অডিওর কথাই ধরবে — আগের চ্যাট, reply করা পুরোনো মেসেজ, password/UID/যেকোনো পুরোনো context থেকে কিছু অনুমান করবে না। " +
                  "Bangla, Roman Bangla, আঞ্চলিক উচ্চারণ, ভাঙা বাক্য—সব মিলিয়ে বর্তমান অডিওর অর্থ ধরবে। " +
                  "Good-App, UID, রেফার, ফেস ভেরিফাই, রি-ভেরিফাই, উইথড্র, স্লট, কতদিন/কবে—এই শব্দগুলো বিশেষভাবে ধরবে। " +
                  "যদি ইউজার বলে ‘৩ দিন হলো first verify করেছি কিন্তু re-verify চায় না’ তাহলে সেটাই লিখবে, generic কথা বানাবে না। " +
                  "অডিওতে password শব্দ না থাকলে password নিয়ে কিছু লিখবে না। " +
                  "শুধু শোনা কথাগুলো/প্রশ্নটা লিখবে, কোনো ব্যাখ্যা নয়। একদমই না বোঝা গেলে খালি রাখবে।",
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
    return cleanTranscriptText(out);
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
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
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
- আগের কথোপকথন শুধু বর্তমান মেসেজটি ছোট follow-up হলে ব্যবহার করবে। বর্তমান মেসেজে পরিষ্কার নতুন বিষয় থাকলে history, পুরোনো reply ও পুরোনো UID পুরোপুরি উপেক্ষা করবে।
- কেউ কাউকে @mention করা সম্পূর্ণ স্বাভাবিক — এর জন্য কখনোই warning/delete দেবে না (should_warn = false, should_delete = false)।
- 🚫 <b>খুব গুরুত্বপূর্ণ</b>: কেউ যদি অন্য মেম্বারদের সাহায্য করার প্রস্তাব দেয় — যেমন "যারা কাজ বুঝতেছেন না / যাদের আইডিতে সমস্যা, আমাকে ইনবক্স করেন", "আমি শিখিয়ে দিব", "নক দিন", "হেল্প লাগলে বলবেন" — এটা সম্পূর্ণ ভালো কাজ, স্প্যাম নয়। তখন verdict = "helpful", should_warn = false, should_delete = false। এমন মেসেজে কখনোই ফ্রিজ/warning হবে না।
- should_warn = true শুধু তখনই, যখন স্পষ্ট গালিগালাজ, হুমকি, অশ্লীলতা, বা টাকা/OTP/একাউন্ট হাতানোর স্ক্যাম আছে। সন্দেহ হলে should_warn = false রাখবে।
- কেউ "অ্যাডমিন কোথায় / অ্যাডমিন কে / অ্যাডমিন আসেন না" জাতীয় কথা বললে মজার-বন্ধুত্বপূর্ণ ভঙ্গিতে ${support} কে মেনশন করে বলবে অ্যাডমিন আছেন।
- যদি মেসেজটি কোনো গ্রুপ অ্যাডমিন/মডারেটরের নিজের উত্তর বা অ্যাডমিনের মেসেজের reply হয়, তুমি হস্তক্ষেপ করবে না — শুধু সাধারণ ইউজারের সমস্যায় উত্তর দেবে।

- ❌ কখনোই লিখবে না "এই বিষয়ে অ্যাডমিন উত্তর দেবেন", "অ্যাডমিন শীঘ্রই জানাবেন", "অপেক্ষা করুন অ্যাডমিন আসবেন" — এসব বাক্য সম্পূর্ণ নিষিদ্ধ। তুমি নিজেই মূল উত্তরটা দেবে, শুধু আসল কথাটাই বলবে।
- ভূমিকা/অপ্রয়োজনীয় লাইন বাদ দিয়ে সরাসরি কাজের উত্তর দেবে।
- ⏱️ <b>উত্তর অবশ্যই ছোট রাখবে — সর্বোচ্চ ৩-৫ লাইন (৭০ শব্দের ভেতরে)</b>। গ্রুপে লম্বা মেসেজ স্প্যাম মনে হয়। এক প্রশ্নে এক উত্তর; বাড়তি লিস্ট, বারবার একই হিসাব বা অতিরিক্ত টিপস দেবে না। ইউজার আরও জানতে চাইলে তখন বিস্তারিত বলবে।
- "কিভাবে টাকা পাবো / ইনকাম কিভাবে / বোনাস কত" জাতীয় প্রশ্নে উপরের আয়ের ধাপ ও রেটগুলো সুন্দর করে সাজিয়ে বুঝিয়ে দেবে (১০ স্লট ১ম ভেরিফাই → ৩/৪ দিন পর রি-ভেরিফাই → বোনাস ও মাইনিং)।
- ইউজার যা-ই জানতে চাক (রেফার সংখ্যা, ব্যালেন্স, ভেরিফাই, উইথড্র, ফি, মাইনিং, নিয়ম) — জানার চেষ্টা করবে, এড়িয়ে যাবে না। একাউন্টভিত্তিক হলে UID চাইবে।
- স্লট নিয়ে কথা বললে কখনো "১ থেকে ১০" বলবে না — ইউজারের ২৩/২৫ নম্বর স্লটও থাকতে পারে।
- ❌ ইউজারের মেসেজটা হুবহু আবার লিখবে না বা কোট করবে না — সরাসরি সুন্দর করে গুছিয়ে উত্তর দেবে।
- ❌ মেসেজে কোনো সংখ্যা থাকলেই সেটাকে UID ভাববে না। "১০টি স্লট", "৩-৪ দিন", "২০০৳" — এগুলো UID নয়। uid শুধু তখনই দেবে যখন ইউজার স্পষ্টভাবে নিজের UID/আইডি নম্বর জানাচ্ছে বা নিজের একাউন্টের হিসাব চাইছে।
- আগে এই একই টেলিগ্রাম ইউজারের UID জানা থাকলে এবং সে ধারাবাহিকভাবে নিজের রেফার/ব্যালেন্স/ভেরিফাই/উইথড্র/তারিখ জিজ্ঞেস করে, knownUid ব্যবহার করতে পারবে। তবে অন্য কারও UID কখনো আন্দাজ করবে না; নতুন UID দিলে নতুন UID-কেই অগ্রাধিকার দেবে।
- উত্তর সবসময় বাংলায় দেবে। English phrase দরকার হলেও পাশে বাংলা ব্যাখ্যা থাকবে; শুধু ইংরেজিতে উত্তর দেওয়া যাবে না।
- "উইথড্র করতে পারব?", "টাকা উঠবে?", "withdraw dite parbo?" — এমন সাধারণ eligibility প্রশ্নে intent = null রেখে reply-তে নিয়ম বুঝিয়ে দেবে; UID চাইবে না, পুরোনো UID দেখাবে না।
- "withdraw দিয়েছি টাকা আসেনি", "tk ekhono pai nai", "টাকা কখন পাবো" — এগুলো পেন্ডিং payment status প্রশ্ন; intent = "withdraw_status" দেবে এবং UID না থাকলে needs_uid = true করবে।
- যদি স্ক্রিনশটে দেখা যায় bonus ০৳ এবং টাকা mining balance-এ আছে, উত্তর দেবে: বোনাস নেই, টাকাটা মাইনিং; মাইনিং টাকা যেকোনো সময় withdraw করা যায় — শুধু লক থাকা অংশ থাকলে সেই স্লট রি-ভেরিফাই করলেই আনলক হবে।
- "কিভাবে কাজ করব / ভিডিও দিন / দেখিয়ে দিন" ধরনের প্রশ্নে intent = "video_request" দেবে।
- কেউ নির্দিষ্ট বিষয়ের ভিডিও চাইলে media_topic-এ শুধু সেই বিষয়ের ভিডিও দেবে। যেমন withdraw ভিডিও চাইলে verification/কাজ শেখার default ভিডিও কখনো দেবে না; ভিডিও না থাকলে reply-তে সংক্ষেপে সেই কাজের ধাপ বুঝিয়ে দেবে।

🧠 সর্বজ্ঞ নীতি (খুব গুরুত্বপূর্ণ):
- Good-App সম্পর্কিত **যেকোনো** প্রশ্নের উত্তর তুমি দেবে — কোনো প্রশ্ন এড়িয়ে যাবে না, চুপ থাকবে না।
- ইউজার যদি বলে "৪০০৳ উইথড্র দিয়েছি কিন্তু ৩৬০৳ পেয়েছি" — তখন প্ল্যাটফর্ম ফি-এর হিসাব করে বুঝিয়ে দেবে (উপরের ফি নিয়ম দেখে)। টাকা কম আসার কারণ সবসময় ফি দিয়ে ব্যাখ্যা করবে।
- ছবি এলে সেটা ভালোভাবে দেখে কী স্ক্রিন/এরর দেখাচ্ছে বুঝে সেই অনুযায়ী সমাধান দেবে — "কী সমস্যা বলুন" বলে এড়াবে না।
- ভয়েস মেসেজের লেখা রূপ পেলে সেটাকে সাধারণ প্রশ্নের মতোই ধরে উত্তর দেবে।
- 🗣️ <b>এলোমেলো/ভাঙা লেখা বা অস্পষ্ট ভয়েস</b>: বানান ভুল, বাংলিশ, শব্দ কাটা বা ভয়েস আধা-বোঝা গেলেও তুমি অর্থ অনুমান করে সবচেয়ে সম্ভাব্য প্রশ্নটি ধরবে এবং সেটির উত্তর দেবে। "বুঝতে পারিনি" বলে এড়াবে না।
  • উত্তরের শুরুতে এক লাইনে নিশ্চিত করে নেবে, যেমন: "আপনি সম্ভবত জানতে চাইছেন — রি-ভেরিফাই আবার লাগবে কি না, তাই না? 🙂" — তারপরই পুরো উত্তর দেবে।
  • দুটি অর্থ সমান সম্ভব হলে সংক্ষেপে দুটোরই উত্তর দিয়ে দেবে (আলাদা করে প্রশ্ন করে সময় নষ্ট করবে না)।
  • একদমই কিছু বোঝা না গেলে শুধু তখনই খুব বিনয়ে একটি ছোট প্রশ্ন করবে: "ভাইয়া একটু গুছিয়ে লিখবেন / আবার ভয়েসটা দিবেন?"
  • ইউজারের আগের মেসেজের প্রসঙ্গ (স্লট, UID, উইথড্র ইত্যাদি) মনে রেখে অস্পষ্ট মেসেজের মানে বের করবে।

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
- ❗ মেসেজ/স্ক্রিনশটটি যদি Good-App এর বিষয় না হয় (অন্য অ্যাপ, অন্য সাইট, অন্য অফার/গেম/ওয়ালেটের স্ক্রিনশট বা প্রশ্ন), অথবা knowledge দিয়ে নিশ্চিত উত্তর বের করা না যায় — তখন কখনোই আন্দাজে reply লিখবে না; reply = null এবং escalate = true দেবে, অ্যাডমিনকেই উত্তর দিতে দেবে।
- should_delete: শুধুমাত্র সত্যিকারের spam/scam/abuse হলে true
- ❗ কেউ যদি Good-App এর কোনো স্ক্রিনশট/ছবি (এরর, ভেরিফাই স্ক্রিন, উইথড্র, ব্যালেন্স, স্লট ইত্যাদি) পাঠায় — সেটি সাপোর্ট প্রশ্ন, spam নয়। তখন verdict = "question", should_delete = false, should_warn = false। অ্যাপ-সংক্রান্ত স্ক্রিনশট কখনোই ডিলিট করবে না।
- should_warn: abuse/scam/spam হলে true
- uid: মেসেজ বা ছবিতে Good-App UID (শুধু সংখ্যা, যেমন 4100) বা ৭ অক্ষরের রেফার কোড থাকলে সেটি, নাহলে null
- needs_uid: ইউজার যদি নিজের একাউন্ট সম্পর্কিত সমভাইয়া কথা বলে (রেফার কাউন্ট, ব্যালেন্স, উইথড্র স্ট্যাটাস, ভেরিফাই, মাইনিং, হিসাব ইত্যাদি) কিন্তু কোনো UID দেয়নি — তাহলে true
- intent: স্লট রিসেট/খালি/ক্লিয়ার চাইলে "slot_reset"; ছবি/ফটো/স্ক্রিনশট/key দেখতে চাইলে "photo_request"; ভিডিও/টিউটোরিয়াল চাইলে "video_request"; ভয়েস/অডিও চাইলে "voice_request"; "উইথড্র দিয়েছি টাকা আসেনি / কখন পাবো / পেমেন্ট কই" জাতীয় হলে "withdraw_status"; "কিভাবে টাকা পাবো / ইনকাম / বোনাস রেট" হলে "earning_info"; "একাউন্ট হয় না / ভেরিফাই হয় না / রি-ভেরিফাই হয় না / এরর আসে" হলে "verify_help"; নাহলে null
- media_topic: উপরের ভয়েস/ভিডিও লাইব্রেরির কোনো টপিক এই সমভাইয়া সাথে মিললে হুবহু সেই টপিকের নাম, নাহলে null
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

  const res = await aiFetch(AI_URL, {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      max_tokens: 1200,
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
/**
 * Read a screenshot and match it against the built-in FAQ topics (no reference
 * images needed) — e.g. GoodDollar's "We found your twin" duplicate-face page.
 */
export async function matchBuiltinFaqPhoto(photoBase64: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const { BUILTIN_FAQS } = await import("./telegram-builtin-faq.server");
  const list = BUILTIN_FAQS.map(
    (f, i) => `${i}) ${f.topic} — স্ক্রিনশটে থাকতে পারে: ${f.screenshot.join(" / ")}`,
  ).join("\n");
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  `স্ক্রিনশটের লেখাগুলো পড়ো। নিচের টপিকগুলোর মধ্যে কোনটির লেখা স্ক্রিনশটে হুবহু আছে?\n${list}\n\n` +
                  `শুধু নম্বরটি লেখো। কোনোটির সাথেই স্পষ্টভাবে না মিললে -1 লেখো।`,
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const idx = parseInt(String(data.choices?.[0]?.message?.content ?? "").match(/-?\d+/)?.[0] ?? "-1", 10);
    if (idx < 0 || idx >= BUILTIN_FAQS.length) return null;
    return BUILTIN_FAQS[idx].answer;
  } catch {
    return null;
  }
}

export async function analyzeScreenshotReply(opts: {
  photoBase64: string;
  name: string;
  text: string;
  knowledge: string;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        max_tokens: 1600,
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
                  `যদি স্ক্রিনশটে withdraw/balance দেখা যায়: Bonus/বোনাস, Mining/মাইনিং, locked/unlock date আলাদা করে পড়বে। বোনাস ০৳ কিন্তু মাইনিং ব্যালেন্স থাকলে বলবে—এখন বোনাস নেই, টাকাটা মাইনিং; মাইনিং যেকোনো সময় withdraw করা যায়, লক থাকা অংশ থাকলে সেই স্লট রি-ভেরিফাই করলেই আনলক হবে। ` +
                  `ফেস ভেরিফিকেশন এরর হলে: ব্রাউজার বদলানো, ফোন রিস্টার্ট, Airplane mode on/off, মোবাইল ডেটা, ১৮+ ফেস, ভালো আলো — এসব পরামর্শ দেবে।\n` +
                  `📲 স্ক্রিনশটে যদি অ্যাপ ডাউনলোড/ইনস্টল সংক্রান্ত কিছু থাকে (Download App বাটন, Downloads ফোল্ডার, apk বা zip ফাইল, "Install", "App not installed", Play Protect/"harmful"/"unsafe app blocked", Install unknown apps পারমিশন) — তাহলে NO_ANSWER দেবে না, বরং ধাপে ধাপে খুব সহজ ভাষায় বুঝিয়ে দেবে ঠিক কোন বোতামে চাপতে হবে। Play Protect সতর্কবার্তা এলে বলবে এটা স্বাভাবিক, More details → Install anyway চাপলেই হবে, অ্যাপ নিরাপদ। "App not installed" হলে পুরোনো অ্যাপ uninstall + apk আবার ডাউনলোড করতে বলবে।\n` +
                  `🚫 খুব জরুরি: স্ক্রিনশটটি যদি Good-App এর না হয় (অন্য কোনো অ্যাপ/সাইট/গেম/ওয়ালেট), অথবা নিচের knowledge দিয়ে ` +
                  `নিশ্চিতভাবে বোঝা না যায় — তাহলে আন্দাজে কিছু লিখবে না, শুধু ঠিক এই শব্দটি লিখবে: NO_ANSWER\n\n` +

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
    if (!out || /NO[_\s-]?ANSWER/i.test(out)) return null;
    return stripAdminFiller(out);
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

export const DEFAULT_WEBSITE_URL = "https://goodapp2.live";
export const DEFAULT_DOWNLOAD_URL = "https://goodapp2.live/api/public/app/download";

/** Warm Bengali welcome for a member who just joined the group. */
export function welcomeReply(
  name: string,
  template: string | null,
  videoUrl: string | null,
  links?: { websiteUrl?: string | null; downloadUrl?: string | null },
): string {
  const video = videoUrl || DEFAULT_TUTORIAL_VIDEO;
  const site = links?.websiteUrl || DEFAULT_WEBSITE_URL;
  const apk = links?.downloadUrl || DEFAULT_DOWNLOAD_URL;
  if (template && template.trim()) {
    return template
      .replaceAll("{name}", `<b>${name}</b>`)
      .replaceAll("{video}", video)
      .replaceAll("{website}", site)
      .replaceAll("{download}", apk);
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
    `🌐 ওয়েবসাইট: ${site}\n` +
    `📲 <b>অ্যাপটি অবশ্যই ডাউনলোড করুন</b> (অ্যাপ ছাড়া কাজ করা যাবে না): ${apk}\n` +
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

/**
 * Free-form smart answer: the bot reads the app knowledge base + saved FAQs and
 * answers ANY question in its own words instead of dumping a fixed template.
 */
export async function smartAnswer(opts: {
  name: string;
  question: string;
  knowledge: string;
  faqs?: string;
  /** ইউজারের আগের মেসেজগুলো (পুরোনো → নতুন) — ফলো-আপ প্রশ্ন বুঝতে। */
  history?: string[];
  /** বটের আগের রিপ্লাই, যাতে ধারাবাহিকতা থাকে। */
  pastReplies?: string[];
  /** গ্রুপের পুরোনো একই ধরনের প্রশ্ন-উত্তর। */
  recall?: string;
}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const q = (opts.question || "").trim();
  if (!q) return null;
  // একই প্রশ্ন আগে ভালোভাবে উত্তর দেওয়া থাকলে সেটাই দেবে — AI কল লাগবে না
  // (ফলো-আপ প্রশ্নে কনটেক্সট লাগে, তাই history থাকলে ক্যাশ ব্যবহার করি না)।
  if (!opts.history?.length) {
    const hit = await cachedAnswer(q);
    if (hit) return hit;
  }
  // Keep the entire AI path bounded. Three 25-second passes made Telegram
  // replies arrive far too late during provider congestion.
  const passes: { temperature: number; force: boolean }[] = [
    { temperature: 0.35, force: false },
    { temperature: 0.1, force: true },
  ];
  for (const { temperature, force } of passes) {
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4_500),
      body: JSON.stringify({
        model: MODEL,
        temperature,
        max_tokens: 900,

        messages: [
          {
            role: "system",
            content:
              `তুমি Good-App এর দক্ষ বাংলা সাপোর্ট এজেন্ট। ইউজারের প্রশ্নটা মন দিয়ে পড়ে ` +
              `ঠিক সেই প্রশ্নেরই উত্তর দেবে — অপ্রাসঙ্গিক টিপস বা রেডিমেড লিস্ট কপি করবে না।\n` +
              `আগের কথোপকথন থাকলে সেটার ধারাবাহিকতা রাখবে — ইউজার ছোট করে ফলো-আপ করলে (যেমন "তাহলে প্রথমবার হলো কেমনে?") ` +
              `আগের বিষয়টার সাথে মিলিয়েই উত্তর দেবে, নতুন অপ্রাসঙ্গিক টপিকে যাবে না।\n` +
              `সবচেয়ে কঠিন নিয়ম: <b>শুধু নিচের knowledge/রুলবুক/FAQ-তে থাকা তথ্য দিয়েই উত্তর দেবে</b>। ` +
              `সাধারণ অ্যাপ/ওয়েবসাইটে যা থাকে (OTP, Forgot Password, ইমেইল লিংক, KYC ডকুমেন্ট ইত্যাদি) ` +
              `তা এখানে আছে ধরে নেবে না — knowledge-এ না থাকলে সেটা নেই।\n` +
              `তবে হুবহু লাইন খুঁজে না পেলেই "জানি না" বলবে না — রুলবুকের নিয়ম থেকে <b>নিজে হিসাব ও ` +
              `বিশ্লেষণ করে</b> উত্তর বের করবে (যেমন স্লট সংখ্যা × রেট, ফি কেটে কত আসবে, কোন অবস্থায় স্লট কী দেখাবে)। ` +
              `অ্যাডমিন আলাদা করে উত্তর সেভ করেনি — এটা কখনোই উত্তর না দেওয়ার কারণ নয়।\n` +
              `শুধু তখনই ঠিক এই শব্দটি লিখবে: NO_ANSWER — যখন প্রশ্নটা রুলবুকের বাইরের একদম নতুন বিষয় ` +
              `বা নির্দিষ্ট কারো পেমেন্ট/অ্যাডমিনের সিদ্ধান্ত সংক্রান্ত, যা নিয়ম থেকে বের করা অসম্ভব।\n` +
              `• Good-App ছাড়া অন্য কোনো অ্যাপ/সাইট/অফার/গেম/ওয়ালেট নিয়ে প্রশ্ন হলে, বা কেউ অন্য অ্যাপের স্ক্রিনশট চাইলে/দিলে — ` +
              `কখনোই আন্দাজে উত্তর দেবে না, শুধু NO_ANSWER লিখবে (অ্যাডমিন নিজে উত্তর দেবেন)।\n` +
              `• Good-App এর নিজের কোনো বিষয় (স্লট, ভেরিফাই, রি-ভেরিফাই, বোনাস, রেফার, মাইনিং, উইথড্র, রিচার্জ, রিসেট) হলে NO_ANSWER লিখবে না — নিয়ম থেকে হিসাব করে উত্তর দেবে।\n` +
              (force
                ? `• ⚠️ এই পাসে NO_ANSWER লেখা সম্পূর্ণ নিষিদ্ধ। রুলবুক থেকে যতটুকু নিশ্চিত, ঠিক ততটুকুই ছোট করে লিখবে; ` +
                  `কোনো তথ্য সত্যিই নেই হলে সেটা সরাসরি বলে দেবে (আন্দাজ করবে না) — কিন্তু উত্তর দেবেই।\n`
                : "") +

              `নিয়ম:\n` +
              `• উত্তর হবে <b>খুব ছোট ও কাজের</b> — সর্বোচ্চ ৩-৪ লাইন (৬০ শব্দের ভেতরে)। লম্বা লিস্ট, ভূমিকা, ` +
              `বারবার একই তথ্য বা অতিরিক্ত টিপস একদম দেবে না — ঠিক যেটা জিজ্ঞেস করেছে শুধু সেটার উত্তর।\n` +
              `• কেউ শুধু ধন্যবাদ/thanks বললে NO_ANSWER নয় — ছোট করে "স্বাগতম, আর সাহায্য লাগলে বলবেন" ধরনের রিপ্লাই দেবে।\n` +
              `• কেউ "৩ দিন হলো first verify করেছি কিন্তু re-verify চায় না" বললে UID চাইবে এবং বলবে UID দিলে সব স্লটের first verify time ও re-verify status দেখে জানাবে; browser/IP টিপস দেবে না।\n` +
              `• কেউ জিজ্ঞেস করলে "ফেস নিয়ে আপনারা কী করেন / free টাকা দিচ্ছেন কেন face লাগে" — কখনো UID বা হিসাব চাইবে না। ছোট করে বলবে: face শুধু real user, duplicate account, age/security verification এবং fair payment নিশ্চিত করার জন্য; face অন্য কাজে ব্যবহার/শেয়ার/বিক্রি করা হয় না।\n` +
              `• HTML <b> ট্যাগ ব্যবহার করতে পারো; সেপারেটর লাইন (━━━) ব্যবহার করবে না।\n` +
              `• উত্তর অবশ্যই সম্পূর্ণ হবে — মাঝপথে বাক্য থামাবে না।\n` +
              `• মানুষের মতো স্বাভাবিক, উষ্ণ ভাষা — প্রতিবার একটু ভিন্ন গঠনে লিখবে।\n` +
              `• "অ্যাডমিন উত্তর দেবেন / অপেক্ষা করুন" জাতীয় ফিলার লিখবে না।\n` +
              `• কারো UID/একাউন্টের হিসাব চাওয়া না হলে কারো ডেটা দেখাবে না।\n` +
              `• কারো ছবি/key দেখানো যাবে না; ছবি সংরক্ষণের কথা কখনো বলবে না।\n\n` +
              `${opts.knowledge}${opts.recall ?? ""}\n\n${opts.faqs ? `সেভ করা প্রশ্নোত্তর:\n${opts.faqs}` : ""}`,
          },
          ...(opts.history?.length
            ? [{
                role: "user" as const,
                content:
                  `আগের কথোপকথন (পুরোনো → নতুন):\n` +
                  opts.history.slice(-6).map((h) => `- ${String(h).slice(0, 300)}`).join("\n") +
                  (opts.pastReplies?.length
                    ? `\nবট আগে বলেছিল:\n${opts.pastReplies.slice(0, 2).map((r) => `- ${String(r).replace(/<[^>]+>/g, "").slice(0, 300)}`).join("\n")}`
                    : ""),
              }]
            : []),
          { role: "user", content: `${opts.name} এখন লিখেছে: ${q}` },
        ],
      }),
    });

    if (!res.ok) continue;
    const data: any = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    if (!out || /NO[_\s-]?ANSWER/i.test(out)) continue;
    const final = stripAdminFiller(out);
    if (!opts.history?.length) void rememberAnswer(q, final);
    return final;
  } catch {
    // network/timeout — try the calmer pass, then give up
  }
  }
  return null;
}


/** Bot's own username (cached per worker) — used to detect @mentions. */
let _meCache: { username: string; id: number } | null = null;
export async function getMe(): Promise<{ username: string; id: number } | null> {
  if (_meCache) return _meCache;
  const me = await api<{ username?: string; id?: number }>("getMe", {});
  if (!me?.username || !me?.id) return null;
  _meCache = { username: me.username, id: me.id };
  return _meCache;
}

/**
 * অ্যাডমিন বটকে মেনশন করে যা করতে বলেছেন, সেটাকে গ্রুপে পাঠানোর মতো
 * সুন্দর বাংলা মেসেজে সাজিয়ে দেয়।
 */
export async function adminCompose(instruction: string, targetName?: string | null): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const q = (instruction || "").trim();
  if (!q) return null;
  let rules = "";
  try {
    const { loadRates } = await import("./telegram-knowledge.server");
    const { appRulebook } = await import("./telegram-app-rules.server");
    rules = appRulebook(await loadRates());
  } catch {
    rules = "";
  }
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        max_tokens: 1000,
        messages: [
          {
            role: "system",
            content:
              `তুমি Good-App সাপোর্ট গ্রুপের বট। গ্রুপের অ্যাডমিন/মালিক তোমাকে নির্দেশ দিয়েছেন — ` +
              `সেই নির্দেশ অনুযায়ী গ্রুপে পাঠানোর জন্য ভদ্র, পরিষ্কার ও সুন্দরভাবে সাজানো বাংলা মেসেজ লিখে দাও।\n` +
              `নিয়ম:\n• শুধু মেসেজটাই লিখবে, কোনো ব্যাখ্যা বা "ঠিক আছে" নয়।\n` +
              `• অ্যাডমিনের কথাটা হুবহু কপি/রিপিট করবে না। নির্দেশটা বুঝে <b>আরও সুন্দর করে, ধাপে ধাপে</b> ইউজারের জন্য মেসেজ বানাবে।\n` +
              `• অ্যাডমিন যদি ডেটা দেখাতে বলে (যেমন UID-এর verify date/time/status), তুমি নিজে বানাবে না; webhook আগে real app data দিয়ে উত্তর দেওয়ার চেষ্টা করে। এখানে এলে শুধু সাধারণ ঘোষণামূলক মেসেজ সাজাবে।\n` +
              `• ছোট ছোট লাইন ও ইমোজি ব্যবহার করবে; HTML <b> ট্যাগ চলবে; সর্বোচ্চ ৪-৫ লাইনে শেষ করবে — অকারণে লম্বা করবে না।\n` +
              `• "GoodDollar/G$" নাম কখনো লিখবে না, শুধু Good-App বলবে।\n` +
              `• কারো UID, ছবি, key বা ব্যক্তিগত তথ্য নিজে থেকে যোগ করবে না।\n` +
              `• অ্যাডমিন যা বলেননি এমন নতুন নিয়ম/তথ্য বানিয়ে লিখবে না।\n` +
              `• অ্যাডমিন কোনো বিষয় "বুঝিয়ে দাও" বললে <b>শুধু নিচের রুলবুক থেকেই</b> তথ্য নেবে। রুলবুকে নেই এমন ফিচার (ডেইলি ক্লেইম, ডেইলি টাস্ক, প্রতিদিন ক্লেইম করা, স্ট্রিক, পয়েন্ট, অ্যাড দেখা) <b>কখনোই</b> লিখবে না — এগুলো অ্যাপে নেই।\n` +
              `• মাইনিং সম্পূর্ণ অটোমেটিক; হিসাব: ১০ স্লট = ৫০০৳/মাস → ১ স্লট = ৫০৳/মাস → X স্লট = X×৫০৳/মাস।\n\n` +
              `===== Good-App রুলবুক (একমাত্র সত্য) =====\n${rules}`,
          },
          {
            role: "user",
            content: `${targetName ? `যাকে বলা হচ্ছে: ${targetName}\n` : ""}অ্যাডমিনের নির্দেশ: ${q}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const out = String(data.choices?.[0]?.message?.content ?? "").trim();
    return out || null;
  } catch {
    return null;
  }
}

/**
 * গ্রুপ-মেমরি: আগে এই ধরনের প্রশ্ন কেউ করেছিল কি না এবং তখন কী উত্তর দেওয়া
 * হয়েছিল — সেটা খুঁজে এনে AI-কে অতিরিক্ত কনটেক্সট হিসেবে দেওয়া হয়।
 */
export async function recallSimilar(question: string): Promise<string> {
  const q = (question || "").trim();
  if (q.length < 4) return "";
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const words = Array.from(
      new Set(
        q
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3),
      ),
    ).slice(0, 4);
    if (!words.length) return "";

    const seen = new Set<string>();
    const pairs: { q: string; a: string }[] = [];
    for (const w of words) {
      const { data } = await supabaseAdmin
        .from("tg_messages")
        .select("text, bot_reply, created_at")
        .ilike("text", `%${w}%`)
        .not("bot_reply", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);
      for (const r of (data ?? []) as any[]) {
        const key = String(r.bot_reply).slice(0, 80);
        if (!r.text || !r.bot_reply || seen.has(key)) continue;
        seen.add(key);
        pairs.push({ q: String(r.text).slice(0, 200), a: String(r.bot_reply).replace(/<[^>]+>/g, "").slice(0, 500) });
      }
      if (pairs.length >= 6) break;
    }
    if (!pairs.length) return "";

    return (
      `\n\n🗂️ গ্রুপে আগে একই ধরনের প্রশ্নে যা উত্তর দেওয়া হয়েছিল (তথ্য মিললে এখান থেকেই ধারাবাহিক উত্তর দাও, হুবহু কপি করবে না):\n` +
      pairs.map((p) => `• প্রশ্ন: ${p.q}\n  উত্তর: ${p.a}`).join("\n")
    );
  } catch {
    return "";
  }
}
