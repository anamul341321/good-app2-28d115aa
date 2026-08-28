import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** নিজের সব চ্যাট — বন্ধুর চ্যাট, মেসেজ রিকোয়েস্ট ও গ্রুপ */
export const listChats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = context.userId;
    const sb = context.supabase as any;
    const { MSG_COLS, peopleMap, previewOf } = await import("./chat.server");

    const [{ data: msgRows }, { data: linkRows }, { data: memberRows }] = await Promise.all([
      sb.from("friend_messages").select(MSG_COLS).order("created_at", { ascending: false }).limit(600),
      sb.from("friend_links").select("id, requester_id, addressee_id, status"),
      sb.from("chat_group_members").select("group_id, last_read_at").eq("user_id", me),
    ]);

    const msgs = (msgRows ?? []) as any[];
    const links = (linkRows ?? []) as any[];
    const myGroups = (memberRows ?? []) as any[];
    const groupRead = new Map<string, string>(myGroups.map((g) => [g.group_id, g.last_read_at]));

    const friendIds = new Set<string>();
    for (const l of links) {
      if (l.status !== "accepted") continue;
      friendIds.add(l.requester_id === me ? l.addressee_id : l.requester_id);
    }

    type Conv = {
      peerId: string;
      lastBody: string;
      lastAt: string;
      mine: boolean;
      unread: number;
    };
    const byPeer = new Map<string, Conv>();
    const byGroup = new Map<string, { groupId: string; lastBody: string; lastAt: string; unread: number }>();

    for (const m of msgs) {
      if (m.group_id) {
        if (!groupRead.has(m.group_id)) continue;
        const cur = byGroup.get(m.group_id);
        const lastRead = groupRead.get(m.group_id) ?? "";
        const isUnread = m.sender_id !== me && m.created_at > lastRead ? 1 : 0;
        if (!cur) {
          byGroup.set(m.group_id, {
            groupId: m.group_id,
            lastBody: previewOf(m),
            lastAt: m.created_at,
            unread: isUnread,
          });
        } else cur.unread += isUnread;
        continue;
      }
      const peerId = m.sender_id === me ? m.receiver_id : m.sender_id;
      if (!peerId) continue;
      const cur = byPeer.get(peerId);
      const unreadHit = m.receiver_id === me && !m.read_at ? 1 : 0;
      if (!cur) {
        byPeer.set(peerId, {
          peerId,
          lastBody: previewOf(m),
          lastAt: m.created_at,
          mine: m.sender_id === me,
          unread: unreadHit,
        });
      } else cur.unread += unreadHit;
    }

    const names = await peopleMap(Array.from(byPeer.keys()));
    const all = Array.from(byPeer.values())
      .map((c) => ({
        ...c,
        name: names.get(c.peerId)?.display_name ?? "ইউজার",
        uid: names.get(c.peerId)?.uid_seq ?? null,
        avatar_url: names.get(c.peerId)?.avatar_url ?? null,
        gender: names.get(c.peerId)?.gender ?? null,
        lastActiveAt: names.get(c.peerId)?.last_active_at ?? null,
        isFriend: friendIds.has(c.peerId),
      }))
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

    let groups: Array<{ groupId: string; name: string; lastBody: string; lastAt: string; unread: number }> = [];
    if (byGroup.size) {
      const { data: gRows } = await sb
        .from("chat_groups")
        .select("id, name")
        .in("id", Array.from(byGroup.keys()));
      const gNames = new Map<string, string>(((gRows ?? []) as any[]).map((g) => [g.id, g.name]));
      groups = Array.from(byGroup.values())
        .map((g) => ({ ...g, name: gNames.get(g.groupId) ?? "গ্রুপ" }))
        .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
    }
    // মেসেজ নেই এমন গ্রুপগুলোও দেখাই
    const shown = new Set(groups.map((g) => g.groupId));
    const missing = myGroups.filter((g) => !shown.has(g.group_id)).map((g) => g.group_id);
    if (missing.length) {
      const { data: gRows } = await sb.from("chat_groups").select("id, name, created_at").in("id", missing);
      for (const g of (gRows ?? []) as any[]) {
        groups.push({ groupId: g.id, name: g.name, lastBody: "নতুন গ্রুপ", lastAt: g.created_at, unread: 0 });
      }
    }

    const chats = all.filter((c) => c.isFriend);
    const requests = all.filter((c) => !c.isFriend);
    const unreadTotal =
      all.reduce((s, c) => s + c.unread, 0) + groups.reduce((s, g) => s + g.unread, 0);
    return { chats, requests, groups, unreadTotal };
  });

/** শুধু না-পড়া সংখ্যা — ব্যাজের জন্য হালকা কুয়েরি */
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

/** একজনের সাথে কথাবার্তা (বন্ধু না হলেও — মেসেজ রিকোয়েস্ট) */
export const getThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId: string }) => ({ peerId: String(input?.peerId ?? "") }))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const sb = context.supabase as any;
    if (!data.peerId) return { messages: [], peer: null, me, friendStatus: "none", linkId: null };
    const { MSG_COLS, shapeMessages, shapeCallMessages, peopleMap } = await import("./chat.server");

    const [{ data: rows }, { data: link }, { data: calls }] = await Promise.all([
      sb
        .from("friend_messages")
        .select(MSG_COLS)
        .is("group_id", null)
        .or(
          `and(sender_id.eq.${me},receiver_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},receiver_id.eq.${me})`,
        )
        .order("created_at", { ascending: true })
        .limit(300),
      sb
        .from("friend_links")
        .select("id, status, requester_id")
        .or(
          `and(requester_id.eq.${me},addressee_id.eq.${data.peerId}),and(requester_id.eq.${data.peerId},addressee_id.eq.${me})`,
        )
        .maybeSingle(),
      sb
        .from("call_sessions")
        .select("id, caller_id, callee_id, call_type, status, accepted_at, ended_at, created_at")
        .or(
          `and(caller_id.eq.${me},callee_id.eq.${data.peerId}),and(caller_id.eq.${data.peerId},callee_id.eq.${me})`,
        )
        .not("status", "in", "(calling,ringing,accepted)")
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    const names = await peopleMap([data.peerId]);
    const p = names.get(data.peerId);
    const merged = [
      ...(await shapeMessages((rows ?? []) as any[])),
      ...shapeCallMessages((calls ?? []) as any[]),
    ].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const { attachReactions } = await import("./chat.server");
    await attachReactions(sb, merged as any[]);
    return {
      messages: merged,
      peer: {
        userId: data.peerId,
        name: p?.display_name ?? "ইউজার",
        uid: p?.uid_seq ?? null,
        avatarUrl: p?.avatar_url ?? null,
        gender: p?.gender ?? null,
        lastActiveAt: (p as any)?.last_active_at ?? null,
      },
      me,
      friendStatus: (link?.status as string | undefined) ?? "none",
      incomingRequest: !!link && link.status === "pending" && link.requester_id !== me,
      linkId: (link?.id as string | undefined) ?? null,
    };
  });

/** মেসেজ পাঠানো — টেক্সট, ছবি, ভিডিও বা ভয়েস (DM অথবা গ্রুপ) */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      peerId?: string;
      groupId?: string;
      body?: string;
      kind?: string;
      mediaPath?: string;
      mediaMeta?: Record<string, any>;
    }) => ({
      peerId: input?.peerId ? String(input.peerId) : null,
      groupId: input?.groupId ? String(input.groupId) : null,
      body: String(input?.body ?? "").trim().slice(0, 4000),
      kind: ["text", "image", "video", "voice"].includes(String(input?.kind ?? "text"))
        ? String(input?.kind ?? "text")
        : "text",
      mediaPath: input?.mediaPath ? String(input.mediaPath).slice(0, 400) : null,
      mediaMeta: (input?.mediaMeta ?? null) as Record<string, any> | null,
    }),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!data.peerId && !data.groupId) throw new Error("কাকে পাঠাবেন?");
    if (data.kind === "text" && !data.body) throw new Error("মেসেজ খালি");
    if (data.kind !== "text" && !data.mediaPath) throw new Error("ফাইল পাওয়া যায়নি");
    const { MSG_COLS, shapeMessages, previewOf } = await import("./chat.server");

    const { data: inserted, error } = await sb
      .from("friend_messages")
      .insert({
        sender_id: context.userId,
        receiver_id: data.peerId,
        group_id: data.groupId,
        body: data.body,
        kind: data.kind,
        media_url: data.mediaPath,
        media_meta: data.mediaMeta,
      })
      .select(MSG_COLS)
      .maybeSingle();
    if (error) throw new Error("মেসেজ পাঠানো যায়নি");

    try {
      const { data: prof } = await sb
        .from("profiles")
        .select("display_name, avatar_url, gender")
        .eq("id", context.userId)
        .maybeSingle();
      const name = (prof?.display_name as string | null) ?? "একজন বন্ধু";
      let senderAvatar = "";
      const avatarPath = prof?.avatar_url as string | null | undefined;
      if (avatarPath) {
        if (/^https:\/\//i.test(avatarPath)) {
          senderAvatar = avatarPath;
        } else {
          const { data: signed } = await sb.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
          senderAvatar = signed?.signedUrl ?? "";
        }
      }
      if (!senderAvatar) {
        const { defaultAvatarUrl } = await import("./default-avatar");
        const origin = process.env["PUBLIC_APP_ORIGIN"] || "https://good-app2.lovable.app";
        senderAvatar = defaultAvatarUrl((prof as any)?.gender ?? null, origin) ?? "";
      }
      const preview = previewOf({ kind: data.kind, body: data.body });
      const { sendPushToUser } = await import("./push.server");
      if (data.peerId) {
        const { createReplyToken } = await import("./chat-reply-token.server");
        await sendPushToUser(data.peerId, {
          title: `💬 ${name}`,
          body: preview.slice(0, 120),
          url: `/chat/${context.userId}`,
          collapseKey: `chat-${context.userId}`,
          data: {
            type: "chat_message",
            sender_id: context.userId,
            sender_name: name,
            sender_avatar_url: senderAvatar,
            message_id: String(inserted?.id ?? ""),
            body: preview.slice(0, 120),
            reply_token: createReplyToken(data.peerId),
          },
        });
      } else if (data.groupId) {
        const { data: members } = await sb
          .from("chat_group_members")
          .select("user_id")
          .eq("group_id", data.groupId);
        const { data: g } = await sb
          .from("chat_groups")
          .select("name")
          .eq("id", data.groupId)
          .maybeSingle();
        await Promise.all(
          ((members ?? []) as any[])
            .filter((m) => m.user_id !== context.userId)
            .map((m) =>
              sendPushToUser(m.user_id, {
                title: `👥 ${g?.name ?? "গ্রুপ"}`,
                body: `${name}: ${preview.slice(0, 100)}`,
                url: `/chat/group/${data.groupId}`,
              }),
            ),
        );
      }
    } catch {
      /* push ব্যর্থ হলেও মেসেজ যাবে */
    }

    const [shaped] = await shapeMessages([inserted as any]);
    return { ok: true, message: shaped };
  });

/** নিজের পাঠানো মেসেজ মুছে ফেলা (সবার জন্য) */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: String(input?.id ?? "") }))
  .handler(async ({ data, context }) => {
    if (!data.id) return { ok: false, error: "invalid id" };
    const sb = context.supabase as any;

    // মেসেজটি আছে কি না ও আমি পাঠিয়েছি কি না দেখে নিই
    const { data: row, error: findErr } = await sb
      .from("friend_messages")
      .select("id, sender_id")
      .eq("id", data.id)
      .maybeSingle();
    if (findErr) return { ok: false, error: findErr.message };
    if (!row) return { ok: false, error: "মেসেজটি পাওয়া যায়নি" };
    if (row.sender_id !== context.userId)
      return { ok: false, error: "শুধু নিজের পাঠানো মেসেজ মোছা যাবে" };

    const { data: updated, error } = await sb
      .from("friend_messages")
      .update({ deleted_at: new Date().toISOString(), body: "" })
      .eq("id", data.id)
      .eq("sender_id", context.userId)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!updated || updated.length === 0)
      return { ok: false, error: "মেসেজ মোছা যায়নি" };
    return { ok: true };
  });


/** একজন পিয়ারের সাথে পুরো চ্যাট/মেসেজ ডিলিট (শুধু নিজের দৃষ্টিকোণ থেকে) */
export const deleteAllMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { peerId?: string; groupId?: string }) => ({
    peerId: input?.peerId ? String(input.peerId) : null,
    groupId: input?.groupId ? String(input.groupId) : null,
  }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.peerId) {
      await sb
        .from("friend_messages")
        .delete()
        .or(
          `and(sender_id.eq.${context.userId},receiver_id.eq.${data.peerId}),and(sender_id.eq.${data.peerId},receiver_id.eq.${context.userId})`,
        )
        .is("group_id", null);
    } else if (data.groupId) {
      const { data: membership } = await sb
        .from("chat_group_members")
        .select("role")
        .eq("group_id", data.groupId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!membership) throw new Error("আপনি এই গ্রুপের সদস্য নন");
      await sb
        .from("friend_messages")
        .delete()
        .eq("group_id", data.groupId);
    } else {
      return { ok: false };
    }
    return { ok: true };
  });

/** চ্যাট খুললে সব মেসেজ "সিন" */
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

/** গ্রুপ খুললে "সিন" */
export const markGroupRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input?.groupId ?? "") }))
  .handler(async ({ data, context }) => {
    if (!data.groupId) return { ok: false };
    await (context.supabase as any)
      .from("chat_group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/** নতুন গ্রুপ বানানো */
export const createGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; memberIds?: string[] }) => ({
    name: String(input?.name ?? "").trim().slice(0, 60),
    memberIds: Array.isArray(input?.memberIds) ? input!.memberIds.map(String).slice(0, 100) : [],
  }))
  .handler(async ({ data, context }) => {
    if (!data.name) throw new Error("গ্রুপের নাম দিন");
    const sb = context.supabase as any;
    const { data: g, error } = await sb
      .from("chat_groups")
      .insert({ name: data.name, created_by: context.userId })
      .select("id, name")
      .maybeSingle();
    if (error || !g) throw new Error("গ্রুপ তৈরি হয়নি");

    const rows = [
      { group_id: g.id, user_id: context.userId, role: "admin" },
      ...Array.from(new Set(data.memberIds.filter((m) => m !== context.userId))).map((m) => ({
        group_id: g.id,
        user_id: m,
        role: "member",
      })),
    ];
    await sb.from("chat_group_members").insert(rows);
    return { ok: true, groupId: g.id as string };
  });

/** গ্রুপের কথাবার্তা + সদস্য তালিকা */
export const getGroupThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input?.groupId ?? "") }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const me = context.userId;
    if (!data.groupId) return { group: null, messages: [], members: [], me, isAdmin: false };
    const { MSG_COLS, shapeMessages, peopleMap } = await import("./chat.server");

    const [{ data: g }, { data: rows }, { data: mem }] = await Promise.all([
      sb.from("chat_groups").select("id, name, created_by, created_at").eq("id", data.groupId).maybeSingle(),
      sb
        .from("friend_messages")
        .select(MSG_COLS)
        .eq("group_id", data.groupId)
        .order("created_at", { ascending: true })
        .limit(300),
      sb.from("chat_group_members").select("user_id, role").eq("group_id", data.groupId),
    ]);
    if (!g) return { group: null, messages: [], members: [], me, isAdmin: false };

    const members = (mem ?? []) as any[];
    const names = await peopleMap([...members.map((m) => m.user_id), ...((rows ?? []) as any[]).map((r) => r.sender_id)]);
    const shaped = await shapeMessages((rows ?? []) as any[]);
    const { attachReactions } = await import("./chat.server");
    await attachReactions(sb, shaped as any[]);
    return {
      group: { id: g.id as string, name: g.name as string },
      messages: shaped.map((m) => ({
        ...m,
        senderName: names.get(m.senderId)?.display_name ?? "ইউজার",
      })),
      members: members.map((m) => ({
        userId: m.user_id as string,
        role: m.role as string,
        name: names.get(m.user_id)?.display_name ?? "ইউজার",
        uid: names.get(m.user_id)?.uid_seq ?? null,
      })),
      me,
      isAdmin: members.some((m) => m.user_id === me && m.role === "admin") || g.created_by === me,
    };
  });

/** গ্রুপে সদস্য যোগ */
export const addGroupMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string; memberIds: string[] }) => ({
    groupId: String(input?.groupId ?? ""),
    memberIds: Array.isArray(input?.memberIds) ? input!.memberIds.map(String).slice(0, 50) : [],
  }))
  .handler(async ({ data, context }) => {
    if (!data.groupId || !data.memberIds.length) return { ok: false };
    await (context.supabase as any)
      .from("chat_group_members")
      .upsert(
        data.memberIds.map((m) => ({ group_id: data.groupId, user_id: m, role: "member" })),
        { onConflict: "group_id,user_id" },
      );
    return { ok: true };
  });

/** মেসেঞ্জার-স্টাইল রিঅ্যাকশন — একই ইমোজি আবার দিলে সরে যায় */
export const reactToMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { messageId: string; emoji?: string | null }) => ({
    messageId: String(input?.messageId ?? ""),
    emoji: input?.emoji ? String(input.emoji).slice(0, 16) : null,
  }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (!data.messageId || data.messageId.startsWith("call:")) return { ok: false };
    if (!data.emoji) {
      await sb
        .from("message_reactions")
        .delete()
        .eq("message_id", data.messageId)
        .eq("user_id", context.userId);
      return { ok: true };
    }
    const { error } = await sb.from("message_reactions").upsert(
      { message_id: data.messageId, user_id: context.userId, emoji: data.emoji },
      { onConflict: "message_id,user_id" },
    );
    if (error) throw new Error("রিঅ্যাকশন যায়নি");
    return { ok: true };
  });

/** গ্রুপ ছেড়ে দেওয়া */
export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { groupId: string }) => ({ groupId: String(input?.groupId ?? "") }))
  .handler(async ({ data, context }) => {
    await (context.supabase as any)
      .from("chat_group_members")
      .delete()
      .eq("group_id", data.groupId)
      .eq("user_id", context.userId);
    return { ok: true };
  });
