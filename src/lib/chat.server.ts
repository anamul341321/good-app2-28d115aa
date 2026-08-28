/**
 * চ্যাটের সার্ভার-সাইড হেল্পার — নাম বের করা, মিডিয়ার সাইনড লিংক বানানো
 * ইত্যাদি। (server-only: শুধু server function-এর handler থেকে ইমপোর্ট হয়)
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Person = { id: string; display_name: string | null; uid_seq: number | null; avatar_url: string | null; gender: "male" | "female" | null; last_active_at?: string | null };

export type DbMsg = {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  group_id: string | null;
  body: string;
  kind: string;
  media_url: string | null;
  media_meta: any;
  deleted_at: string | null;
  read_at: string | null;
  created_at: string;
};

export const MSG_COLS =
  "id, sender_id, receiver_id, group_id, body, kind, media_url, media_meta, deleted_at, read_at, created_at";

export async function peopleMap(ids: string[]) {
  const map = new Map<string, Person>();
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (!clean.length) return map;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, uid_seq, avatar_url, gender, last_active_at")
    .in("id", clean);
  for (const p of (data ?? []) as Person[]) map.set(p.id, p);
  return map;
}

/** স্টোরেজ পাথ → সাময়িক (২ ঘণ্টা) সাইনড লিংক */
export async function signMedia(paths: string[]) {
  const out = new Map<string, string>();
  const clean = Array.from(new Set(paths.filter(Boolean)));
  await Promise.all(
    clean.map(async (p) => {
      try {
        const { data } = await supabaseAdmin.storage
          .from("chat-media")
          .createSignedUrl(p, 60 * 120);
        if (data?.signedUrl) out.set(p, data.signedUrl);
      } catch {
        /* ignore */
      }
    }),
  );
  return out;
}

/** মেসেজ সারিকে ক্লায়েন্টের জন্য প্রস্তুত করা (ডিলিট + সাইনড লিংক) */
export async function shapeMessages(rows: DbMsg[]) {
  const signed = await signMedia(rows.map((r) => r.media_url ?? "").filter(Boolean));
  return rows.map((m) => ({
    id: m.id,
    senderId: m.sender_id,
    body: m.deleted_at ? "" : m.body,
    kind: m.deleted_at ? "deleted" : m.kind,
    mediaUrl: m.deleted_at ? null : m.media_url ? (signed.get(m.media_url) ?? null) : null,
    mediaMeta: m.deleted_at ? null : (m.media_meta ?? null),
    readAt: m.read_at,
    createdAt: m.created_at,
    deleted: !!m.deleted_at,
  }));
}

export function shapeCallMessages(
  rows: Array<{
    id: string;
    caller_id: string;
    callee_id: string;
    call_type: string;
    status: string;
    accepted_at: string | null;
    ended_at: string | null;
    created_at: string;
  }>,
) {
  return rows.map((call) => {
    const completed = call.status === "ended" && !!call.accepted_at;
    const label = completed
      ? call.call_type === "video" ? "ভিডিও কল শেষ হয়েছে" : "অডিও কল শেষ হয়েছে"
      : call.status === "declined"
        ? "কলটি কেটে দেওয়া হয়েছে"
        : call.status === "cancelled"
          ? "কলটি বাতিল করা হয়েছে"
          : "মিসড কল";
    return {
      id: `call:${call.id}`,
      senderId: call.caller_id,
      body: label,
      kind: "call",
      mediaUrl: null,
      mediaMeta: { callId: call.id, video: call.call_type === "video", status: call.status },
      readAt: call.ended_at,
      createdAt: call.created_at,
      deleted: false,
    };
  });
}

/** মেসেজগুলোর রিঅ্যাকশন বসিয়ে দেয় (in-place) */
export async function attachReactions(sb: any, messages: Array<{ id: string; reactions?: any[] }>) {
  const ids = messages.map((m) => m.id).filter((id) => !String(id).startsWith("call:"));
  if (!ids.length) return messages;
  const { data } = await sb
    .from("message_reactions")
    .select("message_id, user_id, emoji")
    .in("message_id", ids);
  const byMsg = new Map<string, Array<{ emoji: string; userId: string }>>();
  for (const r of (data ?? []) as any[]) {
    const list = byMsg.get(r.message_id) ?? [];
    list.push({ emoji: r.emoji, userId: r.user_id });
    byMsg.set(r.message_id, list);
  }
  for (const m of messages) m.reactions = byMsg.get(m.id) ?? [];
  return messages;
}

/** শেষ মেসেজের সংক্ষিপ্ত টেক্সট */
export function previewOf(m: { kind: string; body: string; deleted_at?: string | null }) {
  if (m.deleted_at) return "মেসেজ মুছে ফেলা হয়েছে";
  if (m.kind === "image") return "📷 ছবি";
  if (m.kind === "video") return "🎥 ভিডিও";
  if (m.kind === "voice") return "🎤 ভয়েস মেসেজ";
  if (m.kind === "call") return m.body;
  return m.body;
}
