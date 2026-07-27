import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// List current user's pending vouchers
export const listMyVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("bonus_vouchers")
      .select("id, amount, reason, status, created_at, claimed_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

// Claim one voucher — credits mining_state.accrued_amount, marks claimed
export const claimVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ voucherId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: v, error: vErr } = await supabaseAdmin
      .from("bonus_vouchers")
      .select("id, user_id, amount, status")
      .eq("id", data.voucherId)
      .maybeSingle();
    if (vErr || !v) throw new Error("ভাউচার পাওয়া যায়নি");
    if (v.user_id !== userId) throw new Error("এই ভাউচার আপনার না");
    if (v.status !== "pending") throw new Error("ইতোমধ্যে ক্লেইম হয়ে গেছে");

    // Ensure mining_state row exists
    await supabaseAdmin
      .from("mining_state")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: ms } = await supabaseAdmin
      .from("mining_state").select("accrued_amount,bonus_amount").eq("user_id", userId).maybeSingle();
    const next = Number(ms?.accrued_amount ?? 0) + Number(v.amount);
    const nextBonus = Number((ms as any)?.bonus_amount ?? 0) + Number(v.amount);

    const { error: uErr } = await supabaseAdmin
      .from("mining_state")
      .update({ accrued_amount: next, bonus_amount: nextBonus })
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);

    const { error: cErr } = await supabaseAdmin
      .from("bonus_vouchers")
      .update({ status: "claimed", claimed_at: new Date().toISOString() })
      .eq("id", v.id)
      .eq("status", "pending");
    if (cErr) throw new Error(cErr.message);

    return { ok: true, new_balance: next, amount: Number(v.amount) };
  });
