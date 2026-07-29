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
  group_chat_id: z.string().max(64).nullable(),
  admin_chat_id: z.string().max(64).nullable(),
  admin_mention: z.string().max(64).nullable(),
  persona: z.string().max(4000),
  rules: z.string().max(8000),
  banned_words: z.array(z.string().max(60)).max(300),
  warn_threshold: z.number().int().min(1).max(20),
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
  return data ?? [];
});

export const tgUpsertFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    topic: z.string().trim().min(1).max(120),
    keywords: z.array(z.string().max(60)).max(50),
    answer: z.string().trim().min(1).max(4000),
    priority: z.number().int().min(0).max(100),
    is_active: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = data.id
      ? await db.from("tg_faq").update(row).eq("id", data.id)
      : await db.from("tg_faq").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const tgDeleteFaq = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const db = await guard();
    await db.from("tg_faq").delete().eq("id", data.id);
    return { ok: true as const };
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
