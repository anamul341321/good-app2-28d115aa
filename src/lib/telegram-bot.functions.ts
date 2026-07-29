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
    webhook = await getWebhookInfo();
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
  welcome_message: z.string().max(2000).nullable().optional(),
  default_video_url: z.string().max(500).nullable().optional(),


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
    answer: z.string().trim().min(1).max(4000),
    priority: z.number().int().min(0).max(100),
    is_active: z.boolean(),
    // base64 (no data: prefix) of a newly uploaded reference screenshot
    image_base64: z.string().max(9_000_000).nullable().optional(),
    remove_image: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const { image_base64, remove_image, ...rest } = data;
    const row: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };

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

    await db.from("tg_offenders").update({
      blocked: data.blocked,
      blocked_at: data.blocked ? new Date().toISOString() : (row as any).blocked_at,
      unblocked_at: data.blocked ? null : new Date().toISOString(),
      ...(data.reset_warnings ? { warn_count: 0 } : {}),
    } as any).eq("tg_user_id", data.tg_user_id);

    return { ok: true as const };
  });
