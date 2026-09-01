// Server-only: একটি স্লট (task) খালি করার আসল কাজ। অ্যাডমিন প্যানেল ও ইউজারের
// নিজের "রিসেট করুন" — দুই জায়গা থেকেই ঠিক একই লজিক চলে, যাতে রিসেটের পর
// পুরোনো ফেস/কী কোনোভাবেই ফিরে আসতে না পারে (ব্যাকআপ থেকে অ্যাডমিন ফেরাতে পারবে)।

export async function resetTaskById(taskId: string, actor: "admin" | "user") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: t, error: taskError } = await supabaseAdmin
    .from("tasks")
    .select("user_id, slot, face_photo_url, wallet_address")
    .eq("id", taskId)
    .maybeSingle();
  if (taskError) throw new Error(taskError.message);
  if (!t) throw new Error("Slot পাওয়া যায়নি");

  // আগে স্লটের স্ন্যাপশট রাখি — ভুল করে রিসেট হলে অ্যাডমিন ফিরিয়ে আনতে পারবে।
  const { backupTask } = await import("@/lib/slot-backup.server");
  await backupTask(taskId, actor);

  const { error: pendingError } = await supabaseAdmin
    .from("unverified_attempts")
    .delete()
    .eq("user_id", t.user_id)
    .eq("slot", t.slot);
  if (pendingError) throw new Error(pendingError.message);

  if (t.wallet_address) {
    const { error: walletPendingError } = await supabaseAdmin
      .from("unverified_attempts")
      .delete()
      .eq("user_id", t.user_id)
      .eq("wallet_address", t.wallet_address);
    if (walletPendingError) throw new Error(walletPendingError.message);
  }

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      status: "empty",
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
      created_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) throw new Error(error.message);

  return { ok: true as const, slot: Number(t.slot) };
}
