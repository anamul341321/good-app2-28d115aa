import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MsgRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

/** নিজের সব চ্যাটের সারসংক্ষেপ — শেষ মেসেজ ও না-পড়া সংখ্যা */
export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = context.userId;
    const { data: rows } = await (context.supabase as any)
      .from("friend_messages")
      .select("id, sender_id, receiver_id, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(400);

    const msgs = (rows ?? []) as MsgRow[];
    const byPeer = new Map<
      string,
      { peerId: string; lastBody: string; lastAt: string; mine: boolean; unread: number }
    >();
    for (const m of msgs) {
      const peerId = m.sender_id === me ? m.receiver_id : m.sender_id;
      const cur = byPeer.get(peerId);
      const unreadHit = m.receiver_id === me && !m.read_at ? 1 : 0;
      if (!cur) {
        byPeer.set(peerId, {
          peerId,
          lastBody: m.body,
          lastAt: m.created_at,
          mine: m.sender_id === me,
          unread: unreadHit,
        });
      } else {
        cur.unread += unreadHit;
      }
    }

    const ids = Array.from(byPeer.keys());
    let names = new Map<string, { display_name: string | null; uid_seq: number | null }>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, uid_seq")
        .in("id", ids);
      names = new Map(
        ((profiles ?? []) as any[]).map((p) => [p.id, { display_name: p.display_name, uid_seq: p.uid_seq }]),
      );
    }

    const chats = Array.from(byPeer.values())
      .map((c) => ({
        ...c,
        name: names.get(c.peerId)?.display_name ?? "ইউজার",
        uid: names.get(c.peerId)?.uid_seq ?? null,
      }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

    const unreadTotal = chats.reduce((s, c) => s + c.unread, 0);
    return { chats, unreadTotal };
  });

/** শুধু না-পড়া মেসেজের সংখ্যা — ব্যাজের জন্য হালকা কুয়েরি */
export const getUnreadMessageCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await (context.supabase as any)
      .from("friend_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", context.userId)
      .is("read_at", null);
    return { unread: count ?? 0 };
  });

/** একজন বন্ধুর সাথে কথাবার্তা */
export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string }) => ({ peerId: String(input?.peerId ?? "") }))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    if (!data.peerId) return { messages: [] as MsgRow[], peer: null };

    const { data: rows } = await (context.supabase as any)
      .from("friend_messages")
      .select("id, sender_id, receiver_id, body, read_at, created_at")
      .or(
        `and(sender_id.eq.${me},receiver_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},receiver_id.eq.${me})`,
      )
      .order("created_at", { ascending: true })
      .limit(300);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq")
      .eq("id", data.peerId)
      .maybeSingle();

    return {
      messages: (rows ?? []) as MsgRow[],
      peer: {
        userId: data.peerId,
        name: ((prof as any)?.display_name as string | null) ?? "ইউজার",
        uid: ((prof as any)?.uid_seq as number | null) ?? null,
      },
      me,
    };
  });

/** মেসেজ পাঠানো + অন্যপাশে push নোটিফিকেশন */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string; body: string }) => ({
    peerId: String(input?.peerId ?? ""),
    body: String(input?.body ?? "").trim().slice(0, 2000),
  }))
  .handler(async ({ data, context }) => {
    if (!data.peerId || !data.body) throw new Error("মেসেজ খালি");
    const { data: inserted, error } = await (context.supabase as any)
      .from("friend_messages")
      .insert({ sender_id: context.userId, receiver_id: data.peerId, body: data.body })
      .select("id, sender_id, receiver_id, body, read_at, created_at")
      .maybeSingle();
    if (error) throw new Error("মেসেজ পাঠানো যায়নি — বন্ধু তালিকায় আছে কি?");

    try {
      const { data: prof } = await (context.supabase as any)
        .from("profiles")
        .select("display_name")
        .eq("id", context.userId)
        .maybeSingle();
      const name = ((prof as any)?.display_name as string | null) ?? "একজন বন্ধু";
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(data.peerId, {
        title: `💬 ${name}`,
        body: data.body.slice(0, 120),
        url: "/chat",
      });
    } catch {
      /* push ব্যর্থ হলেও মেসেজ যাবে */
    }

    return { ok: true, message: inserted as MsgRow };
  });

/** চ্যাট খুললে সব মেসেজ "seen" হয়ে যাবে */
export const markChatRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string }) => ({ peerId: String(input?.peerId ?? "") }))
  .handler(async ({ data, context }) => {
    if (!data.peerId) return { ok: false };
    await (context.supabase as any)
      .from("friend_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("receiver_id", context.userId)
      .eq("sender_id", data.peerId)
      .is("read_at", null);
    return { ok: true };
  });
