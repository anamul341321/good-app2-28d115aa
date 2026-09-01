/**
 * সবসময় চালু নিরাপত্তা গার্ড (bot off থাকলেও কাজ করে):
 *  - শুধু দুইটি জিনিস মুছে ফেলা হয়: (১) বাইরের লিংক, (২) ১৮+ / আপত্তিকর ছবি।
 *  - কোনো ফ্রিজ (mute) বা অ্যাকাউন্ট ব্লক করা হয় না। ইউজার পেমেন্ট পেয়ে খুশি
 *    হয়ে স্ক্রিনশট/মন্তব্য দিলে সেটা কখনোই মোছা হবে না।
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiFetch } from "@/lib/ai-free.server";

export const FREEZE_SEC = 0;

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";


/** Good-App / অ্যাডমিনকে নিয়ে বাজে মন্তব্য */
const APP_TARGET =
  /(good\s*-?\s*app|গুড\s*অ্যাপ|গুড\s*এপ|গুডঅ্যাপ|goodapp|এই\s*অ্যাপ|এই\s*এপ|apps?\s*ta|অ্যাপটা|এপটা|অ্যাডমিন|admin)/i;
const APP_SLUR =
  /(চোর|চুর|ভুয়া|ভুয়ো|fake|ফেইক|ফেক|scam|স্ক্যাম|প্রতারক|ধোকা|ধোঁকা|ঠকা|ফাউল|faltu|ফালতু|বাটপার|batpar|চিটার|cheater|টাকা\s*মারে|টাকা\s*মেরে|dhandha|জোচ্চোর|harami|হারামি|kutta|কুত্তা|চুদ|চোদ|খানকি|বেশ্যা|শালা|মাদার|fuck|bitch|bastard)/i;

export function insultsApp(raw: string): boolean {
  const t = (raw || "").trim();
  if (!t) return false;
  if (looksHelpful(t) && !APP_SLUR.test(t)) return false;
  return APP_TARGET.test(t) && APP_SLUR.test(t);
}

/** বাইরের লিংক (আমাদের নিজের লিংক ও সাপোর্ট আইডি ছাড় পায়) */
export function badLinkIn(raw: string, supportUsername?: string | null): boolean {
  const urls = (raw || "").match(/(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/)[^\s]+/gi) ?? [];
  const ownHost = /(goodapp2\.live|good-app2\.lovable\.app|youtu\.be|youtube\.com)/i;
  const support = String(supportUsername || "@anamulmunni").replace(/^@/, "");
  const bad = urls.some(
    (u) => !ownHost.test(u) && !new RegExp(`t(?:elegram)?\\.me/${support}`, "i").test(u),
  );
  const invite = /(t\.me\/(?:joinchat|\+)|chat\.whatsapp\.com|wa\.me\/)/i.test(raw || "");
  return bad || invite;
}

export function hitsBannedWord(raw: string, words: string[]): boolean {
  const t = (raw || "").toLowerCase();
  return (words ?? []).some((w) => w && t.includes(String(w).toLowerCase()));
}

/** ছবি নিরাপদ কি না — খুব ছোট AI চেক (BAD/SAFE) */
export async function photoIsBad(photoBase64: string): Promise<boolean> {
  const key = process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY;
  if (!key) return false;
  try {
    const res = await aiFetch(AI_URL, {
      method: "POST",
      headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 8,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Is this image inappropriate for a family-friendly earning-app support group? " +
                  "BAD = nudity/sexual, gore/violence, abusive text or slurs, gambling, drugs, " +
                  "other apps/referral or investment promotion, QR codes or links to other services, " +
                  "someone's private key/seed phrase. Otherwise SAFE. Answer with exactly one word: BAD or SAFE.",
              },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${photoBase64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return false;
    const data: any = await res.json();
    return /BAD/i.test(String(data.choices?.[0]?.message?.content ?? ""));
  } catch {
    return false;
  }
}

/** UID / app user খুঁজে বের করা */
async function findAppUser(tgUserId?: number | null) {
  if (!tgUserId) return { uid: null as string | null, appUserId: null as string | null };
  const { data: linked } = await supabaseAdmin
    .from("profiles")
    .select("id, uid_seq")
    .eq("telegram_user_id", tgUserId)
    .maybeSingle();
  if (linked) return { uid: String((linked as any).uid_seq ?? "") || null, appUserId: linked.id };
  const { data: past } = await supabaseAdmin
    .from("tg_messages")
    .select("matched_uid")
    .eq("tg_user_id", tgUserId)
    .not("matched_uid", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const uid = (past ?? [])[0]?.matched_uid ?? null;
  if (uid && /^\d+$/.test(uid)) {
    const { data: byUid } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("uid_seq", Number(uid))
      .maybeSingle();
    return { uid, appUserId: byUid?.id ?? null };
  }
  return { uid, appUserId: null };
}

export type SafetyResult = { handled: boolean; action?: string; reason?: string };

/**
 * গ্রুপের একটি মেসেজে নিরাপত্তা গার্ড চালানো। bot চালু/বন্ধ যেকোনো অবস্থাতেই
 * এটি কাজ করবে — শুধু গ্রুপ চ্যাটে, অ্যাডমিন ছাড়া সবার জন্য।
 */
export async function groupSafetyGuard(opts: {
  chatId: string;
  msg: any;
  settings: any;
  senderIsAdmin: boolean;
  /** ভয়েস মেসেজের transcript, থাকলে */
  voiceText?: string | null;
  updateId?: number | null;
}): Promise<SafetyResult> {
  const { chatId, msg, settings, senderIsAdmin } = opts;
  const chatType = msg?.chat?.type;
  if (chatType !== "group" && chatType !== "supergroup") return { handled: false };
  if (senderIsAdmin || !msg?.message_id) return { handled: false };

  const { sendMessage, deleteMessage, restrictUser, getPhotoBase64 } = await import(
    "@/lib/telegram-bot.server"
  );

  const senderName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
    msg.from?.username ||
    "User";
  const text = `${msg.text ?? ""} ${msg.caption ?? ""} ${opts.voiceText ?? ""}`.trim();

  let reason: string | null = null;
  if (insultsApp(text)) reason = "app-insult";
  else if (isHardAbuse(text)) reason = "abuse";
  else if (badLinkIn(text, settings?.support_username)) reason = "link";
  else if (hitsBannedWord(text, settings?.banned_words ?? [])) reason = "banned-word";

  // ছবি/স্টিকার — ক্যাপশনে কিছু না থাকলেও ছবিটা যাচাই হবে
  if (!reason && msg.photo?.length) {
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    const b64 = fileId ? await getPhotoBase64(fileId) : null;
    if (b64 && (await photoIsBad(b64))) reason = "bad-photo";
  }

  if (!reason) return { handled: false };

  // ১) খারাপ মেসেজ সাথে সাথে ডিলিট
  try {
    await deleteMessage(chatId, msg.message_id);
  } catch {
    /* বট অ্যাডমিন না হলে ডিলিট করতে পারবে না */
  }

  const { uid, appUserId } = await findAppUser(msg.from?.id);

  // ২) অ্যাপ নিয়ে বাজে মন্তব্য + UID জানা → অ্যাপ অ্যাকাউন্ট ব্লক
  let blockedApp = false;
  if (reason === "app-insult" && appUserId) {
    await supabaseAdmin
      .from("profiles")
      .update({
        banned: true,
        banned_reason: "টেলিগ্রাম গ্রুপে Good-App নিয়ে আপত্তিকর মন্তব্য",
        banned_at: new Date().toISOString(),
      })
      .eq("id", appUserId);
    blockedApp = true;
  }

  // ৩) ৩০ মিনিটের ফ্রিজ (ব্লক হলেও গ্রুপে চুপ থাকবে)
  if (msg.from?.id) {
    try {
      await restrictUser(chatId, msg.from.id, FREEZE_SEC);
    } catch {
      /* ignore */
    }
    const { data: prev } = await supabaseAdmin
      .from("tg_offenders")
      .select("warn_count")
      .eq("tg_user_id", msg.from.id)
      .maybeSingle();
    await supabaseAdmin.from("tg_offenders").upsert({
      tg_user_id: msg.from.id,
      username: msg.from.username ?? null,
      full_name: senderName,
      warn_count: ((prev as any)?.warn_count ?? 0) + 1,
      last_reason: reason,
      last_offense_at: new Date().toISOString(),
      known_uid: uid,
      app_user_id: appUserId,
      chat_id: msg.chat.id,
      blocked: blockedApp || undefined,
      blocked_at: blockedApp ? new Date().toISOString() : undefined,
      blocked_reason: blockedApp ? "Good-App নিয়ে আপত্তিকর মন্তব্য" : undefined,
    });
  }

  const label =
    reason === "app-insult"
      ? "Good-App নিয়ে আপত্তিকর মন্তব্য"
      : reason === "link"
        ? "বাইরের লিংক"
        : reason === "bad-photo"
          ? "আপত্তিকর ছবি"
          : "আপত্তিকর ভাষা";

  await sendMessage(
    chatId,
    `❄️ <b>${senderName}</b> এর মেসেজটি মুছে দেওয়া হলো (${label}) এবং তাকে <b>৩০ মিনিটের জন্য ফ্রিজ</b> করা হলো।\n` +
      (blockedApp
        ? `🚫 অ্যাপ অ্যাকাউন্টও ব্লক করা হয়েছে${uid ? ` (UID <code>${uid}</code>)` : ""}।\n`
        : uid
          ? `🆔 UID: <code>${uid}</code>\n`
          : "") +
      `🙏 অনুগ্রহ করে গ্রুপে ভদ্রভাবে কথা বলুন।`,
  );

  if (settings?.admin_chat_id) {
    await sendMessage(
      settings.admin_chat_id,
      `🛡️ <b>নিরাপত্তা গার্ড</b>\nইউজার: <b>${senderName}</b>${
        msg.from?.username ? ` (@${msg.from.username})` : ""
      }\nকারণ: ${label}\nApp UID: <code>${uid ?? "পাওয়া যায়নি"}</code>\n` +
        (blockedApp ? `অ্যাকাউন্ট ব্লক ✅\n` : ``) +
        `৩০ মিনিটের ফ্রিজ দেওয়া হয়েছে — অটোমেটিক খুলে যাবে।`,
    );
  }

  if (typeof opts.updateId === "number") {
    await supabaseAdmin.from("tg_messages").upsert(
      {
        update_id: opts.updateId,
        chat_id: msg.chat.id,
        message_id: msg.message_id,
        tg_user_id: msg.from?.id ?? null,
        username: msg.from?.username ?? null,
        full_name: senderName,
        text: text.slice(0, 2000),
        has_photo: !!msg.photo?.length,
        verdict: reason,
        action: blockedApp ? "deleted+frozen+app-blocked" : "deleted+frozen-30m",
        bot_reply: null,
        matched_uid: uid,
      },
      { onConflict: "update_id" },
    );
  }

  return { handled: true, action: "deleted+frozen", reason };
}
