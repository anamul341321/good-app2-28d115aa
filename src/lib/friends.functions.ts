import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PersonRow = {
  id: string;
  display_name: string | null;
  uid_seq: number | null;
};

/** ইউজার খোঁজা — UID নম্বর অথবা নাম দিয়ে */
export const searchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    if (data.query.length < 2) return { people: [] as PersonRow[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const numeric = Number(data.query.replace(/\D/g, ""));
    let builder = supabaseAdmin.from("profiles").select("id, display_name, uid_seq").limit(15);
    builder =
      Number.isFinite(numeric) && numeric > 0 && /^\D*\d+\D*$/.test(data.query)
        ? builder.eq("uid_seq", numeric)
        : builder.ilike("display_name", `%${data.query}%`);
    const { data: rows } = await builder;
    const people = ((rows ?? []) as PersonRow[]).filter((p) => p.id !== context.userId);
    return { people };
  });

/** নিজের বন্ধু তালিকা + পেন্ডিং রিকোয়েস্ট */
export const listFriends = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = context.userId;
    const { data: links } = await (context.supabase as any)
      .from("friend_links")
      .select("id, requester_id, addressee_id, status, created_at")
      .order("created_at", { ascending: false });

    const rows = (links ?? []) as Array<{
      id: string;
      requester_id: string;
      addressee_id: string;
      status: string;
      created_at: string;
    }>;

    const ids = Array.from(
      new Set(rows.flatMap((r) => [r.requester_id, r.addressee_id]).filter((id) => id !== me)),
    );

    let names = new Map<string, PersonRow>();
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, uid_seq")
        .in("id", ids);
      names = new Map(((profiles ?? []) as PersonRow[]).map((p) => [p.id, p]));
    }

    const shape = (r: (typeof rows)[number]) => {
      const otherId = r.requester_id === me ? r.addressee_id : r.requester_id;
      const person = names.get(otherId);
      return {
        linkId: r.id,
        userId: otherId,
        name: person?.display_name ?? "ইউজার",
        uid: person?.uid_seq ?? null,
        status: r.status,
        incoming: r.addressee_id === me,
      };
    };

    const all = rows.map(shape);
    return {
      friends: all.filter((r) => r.status === "accepted"),
      incoming: all.filter((r) => r.status === "pending" && r.incoming),
      outgoing: all.filter((r) => r.status === "pending" && !r.incoming),
    };
  });

/** ফ্রেন্ড রিকোয়েস্ট পাঠানো */
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input?.userId ?? "") }))
  .handler(async ({ data, context }) => {
    if (!data.userId || data.userId === context.userId) throw new Error("ভুল ইউজার");
    const { data: existing } = await (context.supabase as any)
      .from("friend_links")
      .select("id, status")
      .or(
        `and(requester_id.eq.${context.userId},addressee_id.eq.${data.userId}),and(requester_id.eq.${data.userId},addressee_id.eq.${context.userId})`,
      )
      .maybeSingle();
    if (existing) return { ok: true, already: true as const };

    const { error } = await (context.supabase as any).from("friend_links").insert({
      requester_id: context.userId,
      addressee_id: data.userId,
      status: "pending",
    });
    if (error) throw new Error("রিকোয়েস্ট পাঠানো যায়নি");
    return { ok: true, already: false as const };
  });

/** রিকোয়েস্ট গ্রহণ বা বাতিল */
export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string; accept: boolean }) => ({
    linkId: String(input?.linkId ?? ""),
    accept: !!input?.accept,
  }))
  .handler(async ({ data, context }) => {
    if (data.accept) {
      const { error } = await (context.supabase as any)
        .from("friend_links")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", data.linkId);
      if (error) throw new Error("গ্রহণ করা যায়নি");
    } else {
      const { error } = await (context.supabase as any)
        .from("friend_links")
        .delete()
        .eq("id", data.linkId);
      if (error) throw new Error("বাতিল করা যায়নি");
    }
    return { ok: true };
  });

/** বন্ধু তালিকা থেকে সরানো */
export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { linkId: string }) => ({ linkId: String(input?.linkId ?? "") }))
  .handler(async ({ data, context }) => {
    await (context.supabase as any).from("friend_links").delete().eq("id", data.linkId);
    return { ok: true };
  });

/** নিজের নাম — কল করার সময় অন্যপাশে দেখাবে */
export const getMyCallIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("profiles")
      .select("display_name, uid_seq")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      userId: context.userId,
      name: (data as any)?.display_name ?? "ইউজার",
      uid: (data as any)?.uid_seq ?? null,
    };
  });

/**
 * কল দিলে অন্যপাশের ফোনে push নোটিফিকেশন — অ্যাপ বন্ধ/ব্যাকগ্রাউন্ডে থাকলেও
 * "কল আসছে" দেখাবে, ট্যাপ করলে অ্যাপ খুলে কল স্ক্রিনে যাবে।
 */
export const notifyIncomingCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string; video?: boolean }) => ({
    peerId: String(input?.peerId ?? ""),
    video: !!input?.video,
  }))
  .handler(async ({ data, context }) => {
    if (!data.peerId) return { ok: false };
    // শুধু বন্ধু হলেই push যাবে
    const { data: link } = await (context.supabase as any)
      .from("friend_links")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${context.userId},addressee_id.eq.${data.peerId}),and(requester_id.eq.${data.peerId},addressee_id.eq.${context.userId})`,
      )
      .maybeSingle();
    if (!link) return { ok: false };

    const { data: prof } = await (context.supabase as any)
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const name = ((prof as any)?.display_name as string | null) ?? "একজন বন্ধু";

    const { sendPushToUser } = await import("./push.server");
    await sendPushToUser(data.peerId, {
      title: data.video ? "📹 ভিডিও কল আসছে" : "📞 কল আসছে",
      body: `${name} আপনাকে কল করছে — ট্যাপ করে রিসিভ করুন`,
      url: "/friends",
    });
    return { ok: true };
  });
