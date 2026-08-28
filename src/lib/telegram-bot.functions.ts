import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function guard() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const tgGetSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db.from("tg_bot_settings").select("*").eq("id", "default").maybeSingle();
  let webhook: any = null;
  let tokenConfigured = false;
  try {
    const { getWebhookInfo } = await import("@/lib/telegram-bot.server");
    webhook = await Promise.race([
      getWebhookInfo(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5_000)),
    ]);
    tokenConfigured = true;
  } catch {
    tokenConfigured = false;
  }
  return { settings: data, webhook, tokenConfigured };
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  auto_reply_enabled: z.boolean(),
  moderation_enabled: z.boolean(),
  photo_analysis_enabled: z.boolean(),
  delete_bad_messages: z.boolean(),
  uid_lookup_enabled: z.boolean(),
  ask_uid_message: z.string().max(600),
  slot_reset_enabled: z.boolean(),
  ask_slot_message: z.string().max(600),
  smart_mode: z.boolean(),
  auto_block_enabled: z.boolean(),
  block_threshold: z.number().int().min(1).max(50),
  support_username: z.string().max(64).optional(),
  photo_privacy_enabled: z.boolean().optional(),
  escalate_enabled: z.boolean().optional(),
  reply_variety: z.boolean().optional(),
  welcome_enabled: z.boolean().optional(),
  kyc_enabled: z.boolean().optional(),
  voice_reply_enabled: z.boolean().optional(),
  voice_text_enabled: z.boolean().optional(),
  welcome_message: z.string().max(2000).nullable().optional(),
  default_video_url: z.string().max(500).nullable().optional(),
  website_url: z.string().max(300).nullable().optional(),
  download_url: z.string().max(300).nullable().optional(),
  download_notice: z.string().max(500).nullable().optional(),


  group_chat_id: z.string().max(64).nullable(),
  admin_chat_id: z.string().max(64).nullable(),
  admin_mention: z.string().max(64).nullable(),
  persona: z.string().max(4000),
  rules: z.string().max(8000),
  banned_words: z.array(z.string().max(60)).max(300),
  warn_threshold: z.number().int().min(1).max(20),
});

// ---- Video tutorial links -------------------------------------------------

export const tgListVideos = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await (db as any).from("tg_videos").select("*")
    .order("priority", { ascending: false }).order("id");
  return (data ?? []) as any[];
});

export const tgUpsertVideo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    topic: z.string().trim().min(1).max(120),
    keywords: z.array(z.string().max(60)).max(50),
    url: z.string().trim().url().max(500),
    note: z.string().trim().max(500).nullable().optional(),
    priority: z.number().int().min(0).max(100),
    is_active: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await (db as any).from("tg_videos").update(row).eq("id", data.id)
      : await (db as any).from("tg_videos").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const tgDeleteVideo = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    await (db as any).from("tg_videos").delete().eq("id", data.id);
    return { ok: true as const };
  });




export const tgSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => settingsSchema.parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { error } = await db.from("tg_bot_settings")
      .update({ ...data, updated_at: new Date().toISOString() }).eq("id", "default");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const tgRegisterWebhook = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ url: z.string().url() }).parse(i))
  .handler(async ({ data }) => {
    await guard();
    const { setWebhook, getWebhookInfo } = await import("@/lib/telegram-bot.server");
    const res = await setWebhook(data.url);
    if (!res) return { ok: false as const, error: "setWebhook ব্যর্থ — token ঠিক আছে কিনা দেখুন" };
    return { ok: true as const, info: await getWebhookInfo() };
  });

// ---- FAQ / knowledge base -------------------------------------------------

export const tgListFaq = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db.from("tg_faq").select("*")
    .order("priority", { ascending: false }).order("id");
  const rows = (data ?? []) as any[];
  // Signed preview URLs for stored reference screenshots.
  await Promise.all(
    rows.map(async (r) => {
      if (!r.image_path) return;
      const { data: s } = await db.storage.from("tg-faq").createSignedUrl(r.image_path, 3600);
      r.image_url = s?.signedUrl ?? null;
    }),
  );
  return rows;
});

export const tgUpsertFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    topic: z.string().trim().min(1).max(120),
    keywords: z.array(z.string().max(60)).max(50),
    // উত্তর ঐচ্ছিক — খালি রাখলে বট নিজেই অ্যাপের নিয়ম দেখে উত্তর বানাবে।
    answer: z.string().trim().max(4000).nullable().optional(),
    priority: z.number().int().min(0).max(100),
    is_active: z.boolean(),
    // base64 (no data: prefix) of a newly uploaded reference screenshot
    image_base64: z.string().max(9_000_000).nullable().optional(),
    remove_image: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { image_base64, remove_image, ...rest } = data;
    const row: Record<string, unknown> = {
      ...rest,
      answer: (rest.answer ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (image_base64) {
      const path = `faq/${crypto.randomUUID()}.jpg`;
      const bytes = Buffer.from(image_base64, "base64");
      const { error: upErr } = await db.storage.from("tg-faq")
        .upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      row.image_path = path;
    } else if (remove_image) {
      row.image_path = null;
    }

    const { error } = data.id
      ? await db.from("tg_faq").update(row as any).eq("id", data.id)
      : await db.from("tg_faq").insert(row as any);

    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const tgDeleteFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { data: row } = await db.from("tg_faq").select("image_path").eq("id", data.id).maybeSingle();
    if ((row as any)?.image_path) {
      await db.storage.from("tg-faq").remove([(row as any).image_path]);
    }
    await db.from("tg_faq").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Voice reply library --------------------------------------------------

export const tgListVoices = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await (db as any).from("tg_voices").select("*")
    .order("priority", { ascending: false }).order("id");
  const rows = (data ?? []) as any[];
  await Promise.all(rows.map(async (r) => {
    const { data: s } = await db.storage.from("tg-voice").createSignedUrl(r.audio_path, 3600);
    r.audio_url = s?.signedUrl ?? null;
  }));
  return rows;
});

export const tgUpsertVoice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    topic: z.string().trim().min(1).max(120),
    keywords: z.array(z.string().max(60)).max(50),
    note: z.string().trim().max(300).nullable().optional(),
    priority: z.number().int().min(0).max(100),
    is_active: z.boolean(),
    audio_base64: z.string().max(20_000_000).nullable().optional(),
    audio_ext: z.string().max(8).nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { audio_base64, audio_ext, ...rest } = data;
    const row: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

    if (audio_base64) {
      const ext = (audio_ext || "ogg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "ogg";
      const path = `voice/${crypto.randomUUID()}.${ext}`;
      const bytes = Buffer.from(audio_base64, "base64");
      const { error: upErr } = await db.storage.from("tg-voice").upload(path, bytes, {
        contentType: ext === "ogg" || ext === "opus" ? "audio/ogg" : "audio/mpeg",
        upsert: false,
      });
      if (upErr) throw new Error(upErr.message);
      row.audio_path = path;
    } else if (!data.id) {
      throw new Error("ভয়েস ফাইল দিন");
    }

    const { error } = data.id
      ? await (db as any).from("tg_voices").update(row).eq("id", data.id)
      : await (db as any).from("tg_voices").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const tgDeleteVoice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { data: row } = await (db as any).from("tg_voices")
      .select("audio_path").eq("id", data.id).maybeSingle();
    if (row?.audio_path) await db.storage.from("tg-voice").remove([row.audio_path]);
    await (db as any).from("tg_voices").delete().eq("id", data.id);
    return { ok: true as const };
  });

// ---- Manual UID lookup from the admin panel -------------------------------

export const tgLookupUid = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ uid: z.string().trim().min(1).max(30) }).parse(i))
  .handler(async ({ data }) => {
    await guard();
    const { buildUserCard } = await import("@/lib/telegram-lookup.server");
    const res = await buildUserCard(data.uid);
    return res.found ? { ok: true as const, card: res.card } : { ok: false as const };
  });

// ---- Send a message to the group from the admin panel ---------------------

export const tgSendToGroup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ text: z.string().trim().min(1).max(4000) }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { data: s } = await db.from("tg_bot_settings").select("group_chat_id").eq("id", "default").maybeSingle();
    const chat = (s as any)?.group_chat_id;
    if (!chat) return { ok: false as const, error: "Group chat ID সেট করা নেই" };
    const { sendMessage } = await import("@/lib/telegram-bot.server");
    const res = await sendMessage(chat, data.text);
    return res ? { ok: true as const } : { ok: false as const, error: "পাঠানো যায়নি" };
  });

// ---- Reply to one specific user (bot mentions them) -----------------------
// অ্যাডমিন প্যানেল থেকে: ইউজারের টেলিগ্রাম username + কোন মেসেজের রিপ্লাই
// চাই সেটার কিছু অংশ + আসল উত্তর — বট ইউজারকে মেনশন করে ওই মেসেজে রিপ্লাই দেবে।

export const tgReplyToUser = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        username: z.string().trim().min(1).max(64),
        messageText: z.string().trim().max(500).optional(),
        reply: z.string().trim().min(1).max(3500),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await guard();
    const uname = data.username.replace(/^@/, "").trim();

    let q = db
      .from("tg_messages")
      .select("chat_id, message_id, username, full_name, tg_user_id, text, created_at")
      .ilike("username", uname)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: rows } = await q;
    let target = (rows ?? [])[0] as any;

    if (data.messageText) {
      const needle = data.messageText.toLowerCase().slice(0, 80);
      const match = (rows ?? []).find((r: any) =>
        String(r.text ?? "").toLowerCase().includes(needle),
      );
      if (match) target = match;
    }

    if (!target) {
      const { data: s } = await db
        .from("tg_bot_settings").select("group_chat_id").eq("id", "default").maybeSingle();
      const chat = (s as any)?.group_chat_id;
      if (!chat) return { ok: false as const, error: "এই username এর কোনো মেসেজ পাওয়া যায়নি এবং group chat ID সেট করা নেই" };
      const { sendMessage } = await import("@/lib/telegram-bot.server");
      const res = await sendMessage(chat, `@${uname}\n${data.reply}`);
      return res
        ? { ok: true as const, repliedTo: false, note: "পুরনো মেসেজ পাওয়া যায়নি — গ্রুপে মেনশন করে পাঠানো হয়েছে" }
        : { ok: false as const, error: "পাঠানো যায়নি" };
    }

    const { sendMessage } = await import("@/lib/telegram-bot.server");
    const res = await sendMessage(
      target.chat_id,
      `@${uname}\n${data.reply}`,
      target.message_id ?? undefined,
    );
    return res
      ? { ok: true as const, repliedTo: true, name: target.full_name ?? uname }
      : { ok: false as const, error: "পাঠানো যায়নি" };
  });


// ---- Ban requests ---------------------------------------------------------

export const tgListBanRequests = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db.from("tg_ban_requests").select("*")
    .order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r: any) => r.app_user_id).filter(Boolean))] as string[];
  const map: Record<string, { display_name: string | null; uid_seq: number | null; banned: boolean }> = {};
  if (ids.length) {
    const { data: profs } = await db.from("profiles")
      .select("id, display_name, uid_seq, banned").in("id", ids);
    for (const p of profs ?? []) {
      map[p.id] = { display_name: p.display_name, uid_seq: p.uid_seq, banned: !!p.banned };
    }
  }
  return rows.map((r: any) => ({ ...r, profile: r.app_user_id ? map[r.app_user_id] ?? null : null }));
});

export const tgResolveBanRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    approve: z.boolean(),
    admin_name: z.string().trim().min(1).max(60),
    uid: z.string().trim().max(30).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { data: req } = await db.from("tg_ban_requests").select("*").eq("id", data.id).maybeSingle();
    if (!req) throw new Error("Request পাওয়া যায়নি");

    let appUserId: string | null = req.app_user_id;
    if (data.approve) {
      const uid = (data.uid ?? req.matched_uid ?? "").trim();
      if (!appUserId && uid && /^\d+$/.test(uid)) {
        const { data: p } = await db.from("profiles").select("id").eq("uid_seq", Number(uid)).maybeSingle();
        appUserId = p?.id ?? null;
      }
      if (!appUserId) return { ok: false as const, error: "App account খুঁজে পাওয়া যায়নি — UID দিন" };
      const { error } = await db.from("profiles").update({
        banned: true,
        banned_reason: req.reason,
        banned_at: new Date().toISOString(),
        telegram_user_id: req.tg_user_id,
      }).eq("id", appUserId);
      if (error) throw new Error(error.message);
    }

    await db.from("tg_ban_requests").update({
      status: data.approve ? "approved" : "rejected",
      resolved_at: new Date().toISOString(),
      resolved_by: data.admin_name,
      app_user_id: appUserId,
    }).eq("id", data.id);

    return { ok: true as const };
  });

export const tgUnban = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    await db.from("profiles")
      .update({ banned: false, banned_reason: null, banned_at: null }).eq("id", data.user_id);
    return { ok: true as const };
  });

// ---- Recent activity ------------------------------------------------------

export const tgRecentMessages = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db.from("tg_messages").select("*")
    .order("created_at", { ascending: false }).limit(60);
  return data ?? [];
});

// ---- Blocked Telegram users ----------------------------------------------

export const tgListBlocked = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db.from("tg_offenders").select("*")
    .order("last_offense_at", { ascending: false }).limit(200);
  return (data ?? []) as any[];
});

export const tgSetBlocked = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    tg_user_id: z.number(),
    blocked: z.boolean(),
    reset_warnings: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { data: row } = await db.from("tg_offenders").select("*")
      .eq("tg_user_id", data.tg_user_id).maybeSingle();
    if (!row) return { ok: false as const, error: "ইউজার পাওয়া যায়নি" };

    const { data: s } = await db.from("tg_bot_settings")
      .select("group_chat_id").eq("id", "default").maybeSingle();
    const chat = (row as any).chat_id ?? (s as any)?.group_chat_id ?? null;

    if (chat) {
      const { banChatMember, unbanChatMember } = await import("@/lib/telegram-bot.server");
      try {
        if (data.blocked) await banChatMember(chat, data.tg_user_id);
        else await unbanChatMember(chat, data.tg_user_id);
      } catch { /* telegram side is best-effort */ }
    }

    if (chat && !data.blocked) {
      const { unrestrictUser } = await import("@/lib/telegram-bot.server");
      try { await unrestrictUser(chat, data.tg_user_id); } catch { /* best-effort */ }
    }

    await db.from("tg_offenders").update({
      blocked: data.blocked,
      blocked_at: data.blocked ? new Date().toISOString() : (row as any).blocked_at,
      unblocked_at: data.blocked ? null : new Date().toISOString(),
      ...(data.reset_warnings ? { warn_count: 0 } : {}),
    } as any).eq("tg_user_id", data.tg_user_id);

    return { ok: true as const };
  });

// ---- Broadcast: গ্রুপে বা যাদের টেলিগ্রাম লিংক হয়েছে সবার DM-এ ------------

/** কতজনের টেলিগ্রাম লিংক হয়েছে (DM পাঠানো যাবে) — অ্যাডমিন প্যানেলে দেখানোর জন্য। */
export const tgBroadcastAudience = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { count } = await db
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .not("telegram_user_id", "is", null);
  return { linked: count ?? 0 };
});

export const tgBroadcast = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        text: z.string().trim().min(1).max(3500),
        target: z.enum(["group", "dm", "one"]),
        uid: z.string().trim().max(30).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await guard();
    const { sendMessage } = await import("@/lib/telegram-bot.server");

    if (data.target === "group") {
      const { data: s } = await db
        .from("tg_bot_settings").select("group_chat_id").eq("id", "default").maybeSingle();
      const chat = (s as any)?.group_chat_id;
      if (!chat) return { ok: false as const, error: "Group chat ID সেট করা নেই" };
      const res = await sendMessage(chat, data.text);
      return res ? { ok: true as const, sent: 1, failed: 0 } : { ok: false as const, error: "পাঠানো যায়নি" };
    }

    if (data.target === "one") {
      const uid = (data.uid ?? "").trim();
      if (!uid) return { ok: false as const, error: "UID দিন" };
      const { data: prof } = await db
        .from("profiles").select("telegram_user_id, display_name")
        .eq("uid_seq", Number(uid) || -1).maybeSingle();
      const tg = (prof as any)?.telegram_user_id;
      if (!tg) return { ok: false as const, error: "এই UID-এর টেলিগ্রাম লিংক হয়নি (অ্যাপে “শুরু করুন” চাপলে লিংক হবে)" };
      const res = await sendMessage(tg, data.text);
      return res
        ? { ok: true as const, sent: 1, failed: 0 }
        : { ok: false as const, error: "পাঠানো যায়নি (ইউজার বট ব্লক করে থাকতে পারে)" };
    }

    const { data: rows } = await db
      .from("profiles").select("telegram_user_id")
      .not("telegram_user_id", "is", null)
      .limit(5000);

    let sent = 0;
    let failed = 0;
    for (const r of (rows ?? []) as { telegram_user_id: number }[]) {
      try {
        const res = await sendMessage(r.telegram_user_id, data.text);
        if (res) sent++; else failed++;
      } catch {
        failed++;
      }
      // Telegram rate limit: ~30 msg/sec — একটু বিরতি দিয়ে পাঠাই।
      await new Promise((r2) => setTimeout(r2, 60));
    }
    return { ok: true as const, sent, failed };
  });

// ---- কারা বট Start করেছে (টেলিগ্রাম লিংক/KYC) — অ্যাডমিন প্যানেলের তালিকা ----
export const tgListLinkedProfiles = createServerFn({ method: "GET" }).handler(async () => {
  const db = await guard();
  const { data } = await db
    .from("profiles")
    .select("id, uid_seq, display_name, phone_number, telegram_user_id, kyc_verified, kyc_verified_at")
    .not("telegram_user_id", "is", null)
    .order("kyc_verified_at", { ascending: false })
    .limit(5000);

  const rows = (data ?? []) as any[];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.telegram_user_id);
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return {
    total: rows.length,
    duplicates: [...seen.values()].filter((n) => n > 1).length,
    rows: rows.map((r) => ({ ...r, duplicate: (seen.get(String(r.telegram_user_id)) ?? 0) > 1 })),
  };
});

/* ── AI কী ম্যানেজার (ফ্রি Gemini কী — যত ইচ্ছা যোগ করা যায়) ───────────── */

export const tgListAiKeys = createServerFn({ method: "GET" }).handler(async () => {
  await guard();
  const { listKeysForAdmin } = await import("@/lib/ai-keys.server");
  const { freeAiProvider } = await import("@/lib/ai-free.server");
  return { keys: await listKeysForAdmin(), provider: await freeAiProvider() };
});

export const tgAddAiKey = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; label?: string }) =>
    z.object({ key: z.string().min(20), label: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard();
    const { addKey } = await import("@/lib/ai-keys.server");
    return addKey(data.key, data.label);
  });

export const tgSetAiKeyActive = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard();
    const { setKeyActive } = await import("@/lib/ai-keys.server");
    return setKeyActive(data.id, data.active);
  });

export const tgDeleteAiKey = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await guard();
    const { deleteKey } = await import("@/lib/ai-keys.server");
    return deleteKey(data.id);
  });

// ---- গ্রুপ ফ্রিজ (mute) খুলে দেওয়া --------------------------------------
/**
 * টেলিগ্রাম গ্রুপে কেউ "you are currently restricted from posting" দেখলে —
 * TG ID / @username / অ্যাপের UID যেকোনো একটা দিয়ে ফ্রিজ খুলে দেওয়া যায়।
 */
export const tgUnfreeze = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        tg_user_id: z.number().optional(),
        username: z.string().trim().max(64).optional(),
        uid: z.string().trim().max(30).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await guard();

    let tgId: number | null = data.tg_user_id ?? null;

    if (!tgId && data.username) {
      const uname = data.username.replace(/^@/, "");
      const { data: row } = await db
        .from("tg_offenders")
        .select("tg_user_id")
        .ilike("username", uname)
        .maybeSingle();
      tgId = (row as any)?.tg_user_id ?? null;
    }

    if (!tgId && data.uid) {
      const { data: p } = await db
        .from("profiles")
        .select("telegram_user_id")
        .eq("uid_seq", Number(data.uid))
        .maybeSingle();
      tgId = Number((p as any)?.telegram_user_id) || null;
    }

    if (!tgId) return { ok: false as const, error: "টেলিগ্রাম ইউজার পাওয়া যায়নি (TG ID/@username/UID যাচাই করুন)" };

    const { data: off } = await db
      .from("tg_offenders")
      .select("chat_id")
      .eq("tg_user_id", tgId)
      .maybeSingle();
    const { data: s } = await db
      .from("tg_bot_settings")
      .select("group_chat_id")
      .eq("id", "default")
      .maybeSingle();
    const chat = (off as any)?.chat_id ?? (s as any)?.group_chat_id ?? null;
    if (!chat) return { ok: false as const, error: "গ্রুপ chat_id সেট করা নেই" };

    const { unrestrictUser, unbanChatMember } = await import("@/lib/telegram-bot.server");
    try {
      await unbanChatMember(chat, tgId);
    } catch { /* best-effort */ }
    try {
      await unrestrictUser(chat, tgId);
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "Telegram unrestrict ব্যর্থ" };
    }

    await db
      .from("tg_offenders")
      .update({ blocked: false, warn_count: 0, unblocked_at: new Date().toISOString() } as any)
      .eq("tg_user_id", tgId);

    return { ok: true as const, tg_user_id: tgId };
  });

/**
 * সবার ফ্রিজ একসাথে খুলে দেওয়া — যাদের ফ্রিজ/mute হয়েছে (tg_offenders) তাদের
 * সবাইকে গ্রুপে আবার লিখতে দেওয়া হয়।
 */
export const tgUnfreezeAll = createServerFn({ method: "POST" }).handler(async () => {
  const db = await guard();

  const { data: s } = await db
    .from("tg_bot_settings")
    .select("group_chat_id")
    .eq("id", "default")
    .maybeSingle();
  const defaultChats = String((s as any)?.group_chat_id ?? "")
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const { data: rows } = await db
    .from("tg_offenders")
    .select("tg_user_id, chat_id")
    .limit(2000);

  const { unrestrictUser, unbanChatMember } = await import("@/lib/telegram-bot.server");
  let done = 0;
  let failed = 0;

  for (const r of ((rows as any[]) ?? [])) {
    const tgId = Number(r.tg_user_id);
    if (!tgId) continue;
    const chats = r.chat_id ? [String(r.chat_id)] : defaultChats;
    let ok = false;
    for (const chat of chats) {
      try {
        await unbanChatMember(chat, tgId);
      } catch { /* best-effort */ }
      try {
        await unrestrictUser(chat, tgId);
        ok = true;
      } catch { /* ignore this chat */ }
    }
    if (ok) done++;
    else failed++;
  }

  await db
    .from("tg_offenders")
    .update({ blocked: false, warn_count: 0, unblocked_at: new Date().toISOString() } as any)
    .not("tg_user_id", "is", null);

  return { ok: true as const, unfrozen: done, failed };
});
