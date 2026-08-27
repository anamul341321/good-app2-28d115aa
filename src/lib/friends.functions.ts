import { createServerFn } from "@tanstack/react-start";
import type { PublicPerson } from "./friends-people.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type PersonRow = {
  id: string;
  display_name: string | null;
  uid_seq: number | null;
  avatar_url?: string | null;
  is_verified_badge?: boolean | null;
};

/** ইউজার খোঁজা — UID নম্বর অথবা নাম দিয়ে */
export const searchPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    const digits = data.query.replace(/\D/g, "");
    const isUid = digits.length > 0 && /^\D*\d+\D*$/.test(data.query);
    // UID হলে ১ ডিজিটেও খুঁজবে; নাম হলে অন্তত ২ অক্ষর
    if (!isUid && data.query.length < 2) return { people: [] as PersonRow[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const numeric = Number(digits);
    let builder = supabaseAdmin.from("profiles").select("id, display_name, uid_seq, avatar_url, is_verified_badge").limit(15);
    builder =
      isUid && Number.isFinite(numeric) && numeric > 0
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
        .select("id, display_name, uid_seq, avatar_url, is_verified_badge, last_active_at")
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
        avatar_url: person?.avatar_url ?? null,
        is_verified_badge: person?.is_verified_badge ?? null,
        last_active_at: (person as any)?.last_active_at ?? null,
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

    try {
      const [{ data: profile }, { supabaseAdmin }] = await Promise.all([
        (context.supabase as any).from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
        import("@/integrations/supabase/client.server"),
      ]);
      const senderName = (profile as any)?.display_name || "একজন ইউজার";
      await (supabaseAdmin as any).from("feed_notifications").insert({
        user_id: data.userId,
        from_user_id: context.userId,
        type: "friend_request",
        reference_id: null,
        content: `${senderName} আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছে`,
      });
      const { sendPushToUser } = await import("./push.server");
      await sendPushToUser(data.userId, {
        title: "নতুন ফ্রেন্ড রিকুয়েস্ট",
        body: `${senderName} আপনাকে বন্ধু হতে চায়`,
        url: "/feed",
        data: { type: "friend_request", from_user_id: context.userId },
        collapseKey: `friend-${context.userId}`,
      });
    } catch {
      // Notification delivery is best-effort; the friend request itself is saved.
    }
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
    const { data: link } = await (context.supabase as any)
      .from("friend_links")
      .select("id, requester_id, addressee_id, status")
      .eq("id", data.linkId)
      .maybeSingle();
    if (!link) throw new Error("রিকোয়েস্ট পাওয়া যায়নি");

    if (data.accept) {
      const { error } = await (context.supabase as any)
        .from("friend_links")
        .update({ status: "accepted", updated_at: new Date().toISOString() })
        .eq("id", data.linkId)
        .eq("addressee_id", context.userId);
      if (error) throw new Error("গ্রহণ করা যায়নি");
      try {
        const [{ data: profile }, { supabaseAdmin }] = await Promise.all([
          (context.supabase as any).from("profiles").select("display_name").eq("id", context.userId).maybeSingle(),
          import("@/integrations/supabase/client.server"),
        ]);
        const accepterName = (profile as any)?.display_name || "একজন ইউজার";
        await (supabaseAdmin as any).from("feed_notifications").insert({
          user_id: (link as any).requester_id,
          from_user_id: context.userId,
          type: "friend_accept",
          reference_id: null,
          content: `${accepterName} আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছে`,
        });
        const { sendPushToUser } = await import("./push.server");
        await sendPushToUser((link as any).requester_id, {
          title: "ফ্রেন্ড রিকুয়েস্ট গ্রহণ হয়েছে",
          body: `${accepterName} এখন আপনার বন্ধু`,
          url: "/feed",
          data: { type: "friend_accept", from_user_id: context.userId },
          collapseKey: `friend-accept-${context.userId}`,
        });
      } catch {
        // Notification delivery is best-effort.
      }
    } else {
      const { error } = await (context.supabase as any)
        .from("friend_links")
        .delete()
        .eq("id", data.linkId)
        .eq("addressee_id", context.userId);
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

/** Facebook-style people search — নাম, UID অথবা ফোন নম্বর দিয়ে */
export const searchPeopleFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => ({
    query: String(input?.query ?? "").trim().slice(0, 60),
  }))
  .handler(async ({ data, context }) => {
    const q = data.query;
    if (q.length < 1) return { people: [] as PublicPerson[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PUBLIC_COLS, attachLinkStatus } = await import("./friends-people.server");
    const digits = q.replace(/\D/g, "");
    const isNumeric = digits.length > 0 && /^\D*[\d\s+-]+\D*$/.test(q);

    const found = new Map<string, any>();
    const push = (rows: any[] | null) => {
      for (const r of rows ?? []) if (r.id !== context.userId) found.set(r.id, r);
    };

    if (q.length >= 1) {
      const { data: byName } = await supabaseAdmin
        .from("profiles")
        .select(PUBLIC_COLS)
        .ilike("display_name", `%${q}%`)
        .limit(20);
      push(byName as any[]);
    }
    if (isNumeric && digits.length > 0) {
      const numeric = Number(digits);
      if (Number.isFinite(numeric) && numeric > 0) {
        const { data: byUid } = await supabaseAdmin
          .from("profiles")
          .select(PUBLIC_COLS)
          .eq("uid_seq", numeric)
          .limit(5);
        push(byUid as any[]);
      }
      const tail = digits.slice(-9);
      if (tail.length >= 6) {
        const { data: byPhone } = await supabaseAdmin
          .from("profiles")
          .select(PUBLIC_COLS)
          .ilike("phone_number", `%${tail}%`)
          .limit(10);
        push(byPhone as any[]);
      }
    }

    const score = (p: any) => {
      const name = String(p.display_name ?? "").toLowerCase();
      const uid = String(p.uid_seq ?? "");
      const query = q.toLowerCase();
      if (isNumeric && uid === digits) return 0;
      if (name === query) return 1;
      if (name.startsWith(query)) return 2;
      if (uid.startsWith(digits) && digits.length >= 2) return 3;
      if (name.includes(query)) return 4;
      return 9;
    };
    const sorted = Array.from(found.values()).sort((a, b) => {
      const byScore = score(a) - score(b);
      if (byScore !== 0) return byScore;
      const aUid = Number(a.uid_seq ?? Number.MAX_SAFE_INTEGER);
      const bUid = Number(b.uid_seq ?? Number.MAX_SAFE_INTEGER);
      return aUid - bUid;
    });
    const people = await attachLinkStatus(context.supabase, context.userId, sorted);
    return { people: people.slice(0, 20) };
  });

/** Suggested friends — নিজের UID-এর আশেপাশের একাউন্ট আগে, তারপর mutual অনুযায়ী */
export const getSuggestedPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input?: { limit?: number; offset?: number }) => ({
    limit: Math.min(Math.max(Number(input?.limit ?? 10), 1), 50),
    offset: Math.max(Number(input?.offset ?? 0), 0),
  }))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PUBLIC_COLS, attachLinkStatus } = await import("./friends-people.server");

    const [{ data: myLinks }, { data: myProfile }] = await Promise.all([
      (context.supabase as any)
      .from("friend_links")
      .select("requester_id, addressee_id, status"),
      (supabaseAdmin as any).from("profiles").select("uid_seq").eq("id", me).maybeSingle(),
    ]);
    const linked = new Set<string>([me]);
    const myFriends = new Set<string>();
    for (const l of (myLinks ?? []) as any[]) {
      const other = l.requester_id === me ? l.addressee_id : l.requester_id;
      linked.add(other);
      if (l.status === "accepted") myFriends.add(other);
    }

    const myUid = Number((myProfile as any)?.uid_seq ?? 0);
    const candidateRows = new Map<string, any>();
    if (myUid > 0) {
      const [nearAbove, nearBelow] = await Promise.all([
        (supabaseAdmin as any)
          .from("profiles")
          .select(PUBLIC_COLS)
          .gte("uid_seq", myUid)
          .order("uid_seq", { ascending: true, nullsFirst: false })
          .limit(500),
        (supabaseAdmin as any)
          .from("profiles")
          .select(PUBLIC_COLS)
          .lt("uid_seq", myUid)
          .order("uid_seq", { ascending: false, nullsFirst: false })
          .limit(500),
      ]);
      for (const row of [...((nearAbove.data ?? []) as any[]), ...((nearBelow.data ?? []) as any[])]) {
        candidateRows.set(row.id, row);
      }
    }

    if (candidateRows.size < data.offset + data.limit) {
      const { data: recentRows } = await (supabaseAdmin as any)
        .from("profiles")
        .select(PUBLIC_COLS)
        .order("created_at", { ascending: false })
        .limit(500);
      for (const row of (recentRows ?? []) as any[]) candidateRows.set(row.id, row);
    }

    const candidates = Array.from(candidateRows.values())
      .filter((p) => !linked.has(p.id))
      .map((p) => ({
        ...p,
        _uidDistance: myUid > 0 && Number(p.uid_seq) > 0 ? Math.abs(Number(p.uid_seq) - myUid) : Number.MAX_SAFE_INTEGER,
      }));

    // mutual friend count (admin read of accepted links between candidates & my friends)
    let mutualMap = new Map<string, number>();
    if (candidates.length && myFriends.size) {
      const ids = candidates.map((c) => c.id);
      const { data: theirLinks } = await (supabaseAdmin as any)
        .from("friend_links")
        .select("requester_id, addressee_id, status")
        .eq("status", "accepted");
      for (const l of (theirLinks ?? []) as any[]) {
        for (const [a, b] of [
          [l.requester_id, l.addressee_id],
          [l.addressee_id, l.requester_id],
        ]) {
          if (ids.includes(a) && myFriends.has(b)) mutualMap.set(a, (mutualMap.get(a) ?? 0) + 1);
        }
      }
    }

    // deterministic per-viewer shuffle key so প্রতিটি ইউজার আলাদা ক্রম দেখে
    // (UID 1,2,3... এর মতো সিরিয়াল লিস্ট আর আসবে না)
    const mixKey = (id: string) => {
      let h = 2166136261;
      const s = `${me}:${id}`;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    };

    candidates.sort((a, b) => {
      // ১) mutual friend আগে — যাদের সাথে পরিচিত থাকার সম্ভাবনা বেশি
      const mutual = (mutualMap.get(b.id) ?? 0) - (mutualMap.get(a.id) ?? 0);
      if (mutual !== 0) return mutual;
      // ২) কাছাকাছি UID, কিন্তু bucket আকারে — যাতে হুবহু সিরিয়াল না হয়
      const bucket = (d?: number) =>
        d == null || d === Number.MAX_SAFE_INTEGER ? 9999 : Math.floor(d / 50);
      const bucketDiff = bucket(a._uidDistance) - bucket(b._uidDistance);
      if (bucketDiff !== 0) return bucketDiff;
      // ৩) একই bucket-এর ভেতরে viewer-ভিত্তিক র‍্যান্ডম মিক্স
      return mixKey(a.id) - mixKey(b.id);
    });
    const page = candidates.slice(data.offset, data.offset + data.limit);
    const people = (await attachLinkStatus(context.supabase, me, page)).map(
      (p) => ({ ...p, mutualCount: mutualMap.get(p.id) ?? 0 }),
    );
    return { people, hasMore: candidates.length > data.offset + data.limit };
  });
