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


/** আগের নিয়ম বাতিল — কোনো মন্তব্যের জন্য আর ব্যবস্থা নেওয়া হয় না। */
export function insultsApp(_raw: string): boolean {
  return false;
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

/** ছবি ১৮+/আপত্তিকর কি না — খুব ছোট AI চেক (BAD/SAFE) */
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
                  "Is this image adult (18+) or graphically violent? " +
                  "BAD = nudity, sexual or pornographic content, sexualized posing, or gore. " +
                  "Everything else is SAFE — payment screenshots, app screenshots, selfies, memes, " +
                  "text screenshots, product photos, ads are all SAFE. " +
                  "Answer with exactly one word: BAD or SAFE.",
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
 * গ্রুপের একটি মেসেজে নিরাপত্তা গার্ড। শুধু দুইটি ক্ষেত্রে মেসেজ মুছে দেয়:
 * বাইরের লিংক, অথবা ১৮+/আপত্তিকর ছবি। ফ্রিজ বা ব্লক কখনোই করে না।
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

  const { sendMessage, deleteMessage, getPhotoBase64 } = await import(
    "@/lib/telegram-bot.server"
  );

  const senderName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
    msg.from?.username ||
    "User";
  const text = `${msg.text ?? ""} ${msg.caption ?? ""} ${opts.voiceText ?? ""}`.trim();

  let reason: string | null = null;
  if (badLinkIn(text, settings?.support_username)) reason = "link";

  // ছবি — শুধু ১৮+/আপত্তিকর হলে মুছবে, পেমেন্ট স্ক্রিনশট কখনো নয়
  if (!reason && msg.photo?.length) {
    const fileId = msg.photo[msg.photo.length - 1]?.file_id;
    const b64 = fileId ? await getPhotoBase64(fileId) : null;
    if (b64 && (await photoIsBad(b64))) reason = "bad-photo";
  }

  if (!reason) return { handled: false };

  try {
    await deleteMessage(chatId, msg.message_id);
  } catch {
    /* বট অ্যাডমিন না হলে ডিলিট করতে পারবে না */
  }

  const { uid } = await findAppUser(msg.from?.id);

  const label = reason === "link" ? "বাইরের লিংক" : "১৮+/আপত্তিকর ছবি";

  await sendMessage(
    chatId,
    `🧹 <b>${senderName}</b>, আপনার মেসেজটি মুছে দেওয়া হলো — ${label} গ্রুপে শেয়ার করা যাবে না 🙏\n` +
      `আমাদের অফিসিয়াল লিংক: <b>https://goodapp2.live</b>`,
  );

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
        action: "deleted",
        bot_reply: null,
        matched_uid: uid,
      },
      { onConflict: "update_id" },
    );
  }

  return { handled: true, action: "deleted", reason };
}

