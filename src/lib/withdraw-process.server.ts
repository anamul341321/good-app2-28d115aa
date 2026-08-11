/**
 * Shared paid/reject settlement for a pending withdrawal, usable from outside
 * the admin panel (Telegram fast-pay). Mirrors adminUpdateWithdrawal: money was
 * already debited at request time, so "paid" only flips the row, and "rejected"
 * refunds payout + fee.
 */
export async function processWithdrawalFast(input: {
  id: string;
  action: "paid" | "rejected";
  by: string;
  reason?: string;
}): Promise<{ ok: boolean; message: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: w } = await supabaseAdmin.from("withdrawals").select("*").eq("id", input.id).maybeSingle();
  if (!w) return { ok: false, message: "Withdrawal পাওয়া যায়নি" };
  if (w.status !== "pending") return { ok: false, message: `এটি আগেই ${w.status} হয়ে গেছে` };

  const payout = Number(w.amount);
  const m = /Gross\s+([\d.]+)/.exec(String((w as any).admin_note ?? ""));
  const gross = m ? Number(m[1]) : Math.round(payout / (payout < 90 ? 0.8 : 0.9));
  const fee = Math.max(0, gross - payout);

  if (input.action === "paid") {
    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status: "paid",
        paid_by: input.by,
        processed_at: new Date().toISOString(),
      } as any)
      .eq("id", w.id)
      .eq("status", "pending");
    if (error) return { ok: false, message: error.message };

    await supabaseAdmin
      .from("user_notices")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", w.user_id)
      .is("read_at", null)
      .ilike("title", "%উইথড্র রিকোয়েস্ট বাতিল%");

    await supabaseAdmin.from("user_notices").insert({
      user_id: w.user_id,
      title: "✅ উইথড্র পেমেন্ট সম্পন্ন",
      body:
        `${Math.floor(payout)}৳ আপনার ${String((w as any).provider).toUpperCase()} ${(w as any).wallet_number ?? ""} নম্বরে পাঠানো হয়েছে।` +
        `\nটাকা রিকোয়েস্টের সময়েই ব্যালেন্স থেকে কাটা হয়েছিল, তাই paid হওয়ার পর ব্যালেন্স আর কমবে না।`,
    });

    return { ok: true, message: `✅ Paid হয়েছে — ${Math.floor(payout)}৳` };
  }

  const refund = payout + fee;
  const reason = (input.reason ?? "").trim();

  const { error } = await supabaseAdmin
    .from("withdrawals")
    .update({
      status: "rejected",
      admin_note: `${(w as any).admin_note ? (w as any).admin_note + " · " : ""}[Reject] ফি ${fee}৳ ফেরত দেওয়া হয়েছে · ফেরত ${refund}৳ (Telegram: ${input.by})`,
      reject_reason: reason || null,
      fee_refunded: true,
      processed_at: new Date().toISOString(),
    } as any)
    .eq("id", w.id)
    .eq("status", "pending");
  if (error) return { ok: false, message: error.message };

  const { data: mining } = await supabaseAdmin
    .from("mining_state")
    .select("withdrawn_amount")
    .eq("user_id", w.user_id)
    .maybeSingle();
  if (mining) {
    await supabaseAdmin
      .from("mining_state")
      .update({ withdrawn_amount: Math.max(0, Number(mining.withdrawn_amount) - refund) })
      .eq("user_id", w.user_id);
  }

  await supabaseAdmin.from("user_notices").insert({
    user_id: w.user_id,
    title: "❌ উইথড্র রিকোয়েস্ট বাতিল",
    body:
      `${Math.floor(payout)}৳ উইথড্র বাতিল করা হয়েছে · ${refund}৳ ব্যালেন্সে ফেরত দেওয়া হয়েছে` +
      (reason ? `\nকারণ: ${reason}` : ""),
  });

  return { ok: true, message: `❌ বাতিল — ${refund}৳ ফেরত দেওয়া হয়েছে` };
}
