// Server-only: snapshot a slot before an admin/bot reset so it can be restored
// later (key + face photo + verification timestamps come back exactly as before).

const TASK_FIELDS = [
  "status",
  "face_photo_url",
  "face_label",
  "wallet_address",
  "wallet_private_key",
  "initial_verify_at",
  "reverify_due_at",
  "done_at",
  "whitelist_ok",
  "last_whitelist_check_at",
  "last_reverified_at",
  "reverify_count",
  "created_at",
] as const;

export const EMPTY_TASK_PATCH = {
  status: "empty" as const,
  face_photo_url: null,
  face_label: null,
  wallet_address: null,
  wallet_private_key: null,
  initial_verify_at: null,
  reverify_due_at: null,
  done_at: null,
  whitelist_ok: true,
  last_whitelist_check_at: null,
  last_reverified_at: null,
  reverify_count: 0,
};

/** Store the current state of a slot (and its pending attempts) before clearing it. */
export async function backupTask(taskId: string, resetBy?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return null;

  const snapshot: Record<string, unknown> = {};
  for (const f of TASK_FIELDS) snapshot[f] = (task as any)[f];

  const { data: attempts } = await supabaseAdmin
    .from("unverified_attempts")
    .select("*")
    .eq("user_id", task.user_id)
    .eq("slot", task.slot);

  const { data: backup } = await supabaseAdmin
    .from("task_reset_backups")
    .insert({
      task_id: task.id,
      user_id: task.user_id,
      slot: task.slot,
      snapshot: snapshot as any,
      attempts: (attempts ?? []) as any,
      reset_by: resetBy ?? null,
    })
    .select("id")
    .maybeSingle();

  return backup?.id ?? null;
}

export type RestoreResult = { ok: true; slot: number } | { ok: false; error: string };

/** Put a previously reset slot back exactly as it was. */
export async function restoreTaskBackup(backupId: string): Promise<RestoreResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: backup } = await supabaseAdmin
    .from("task_reset_backups")
    .select("*")
    .eq("id", backupId)
    .maybeSingle();
  if (!backup) return { ok: false, error: "ব্যাকআপ পাওয়া যায়নি।" };
  if (backup.restored_at) return { ok: false, error: "এই স্লটটি আগেই ফিরিয়ে আনা হয়েছে।" };

  const snap = (backup.snapshot ?? {}) as Record<string, any>;
  const patch: Record<string, any> = {};
  for (const f of TASK_FIELDS) if (f in snap) patch[f] = snap[f];

  const { error } = await supabaseAdmin.from("tasks").update(patch).eq("id", backup.task_id);
  if (error) return { ok: false, error: error.message };

  const attempts = Array.isArray(backup.attempts) ? (backup.attempts as any[]) : [];
  if (attempts.length) {
    await supabaseAdmin.from("unverified_attempts").upsert(attempts as any, { onConflict: "id" });
  }

  await supabaseAdmin
    .from("task_reset_backups")
    .update({ restored_at: new Date().toISOString() })
    .eq("id", backup.id);

  return { ok: true, slot: backup.slot as number };
}

/** Recent resets for one user that can still be undone. */
export async function listTaskBackups(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("task_reset_backups")
    .select("id, slot, created_at, restored_at, reset_by, snapshot")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map((b) => ({
    id: b.id as string,
    slot: b.slot as number,
    created_at: b.created_at as string,
    restored_at: b.restored_at as string | null,
    reset_by: (b.reset_by as string | null) ?? null,
    face_label: ((b.snapshot as any)?.face_label ?? null) as string | null,
    wallet_address: ((b.snapshot as any)?.wallet_address ?? null) as string | null,
    status: ((b.snapshot as any)?.status ?? null) as string | null,
  }));
}
