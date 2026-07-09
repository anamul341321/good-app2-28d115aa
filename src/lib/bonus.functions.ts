import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BONUS_AMOUNT = 100;

/**
 * Compute welcome-bonus status:
 * - Bonus 1 (100৳): unlocks when the user has 10 slots at status IN ('verified','done')
 *   (i.e. at least the first face-verify completed on all 10).
 * - Bonus 2 (100৳): unlocks when the user has 10 slots at status = 'done'
 *   (all 10 re-verified). Mining also starts from re-verify onwards.
 * Both are one-time. Claimed amount is credited to mining_state.accrued_amount
 * so the existing withdraw pipeline handles it.
 */
async function loadStatus(supabase: any, userId: string) {
  const [{ data: profile }, { data: tasks }] = await Promise.all([
    supabase
      .from("profiles")
      .select("bonus_first_verify_claimed,bonus_reverify_claimed")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("tasks").select("status").eq("user_id", userId),
  ]);

  const firstVerifyCount = (tasks ?? []).filter(
    (t: any) => t.status === "verified" || t.status === "done",
  ).length;
  const reverifyCount = (tasks ?? []).filter((t: any) => t.status === "done").length;
  const firstClaimed = !!profile?.bonus_first_verify_claimed;
  const reverifyClaimed = !!profile?.bonus_reverify_claimed;

  return {
    firstVerifyCount,
    reverifyCount,
    firstClaimed,
    reverifyClaimed,
    firstClaimable: firstVerifyCount >= 10 && !firstClaimed,
    reverifyClaimable: reverifyCount >= 10 && !reverifyClaimed,
    bonusAmount: BONUS_AMOUNT,
    totalBonus: BONUS_AMOUNT * 2,
  };
}

export const getBonusStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return loadStatus(context.supabase, context.userId);
  });

export const claimFirstVerifyBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const status = await loadStatus(supabase, userId);
    if (status.firstClaimed) throw new Error("এই বোনাস আগেই নেওয়া হয়েছে");
    if (!status.firstClaimable) throw new Error("প্রথমে ১০টি স্লট ভেরিফাই সম্পন্ন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure mining_state row exists
    await supabaseAdmin
      .from("mining_state")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: ms } = await supabaseAdmin
      .from("mining_state")
      .select("accrued_amount")
      .eq("user_id", userId)
      .maybeSingle();

    const newAccrued = Number(ms?.accrued_amount ?? 0) + BONUS_AMOUNT;

    const [{ error: msErr }, { error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("mining_state")
        .update({ accrued_amount: newAccrued })
        .eq("user_id", userId),
      supabaseAdmin
        .from("profiles")
        .update({ bonus_first_verify_claimed: true })
        .eq("id", userId),
    ]);
    if (msErr) throw new Error(msErr.message);
    if (pErr) throw new Error(pErr.message);

    return { ok: true, amount: BONUS_AMOUNT };
  });

export const claimReverifyBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const status = await loadStatus(supabase, userId);
    if (status.reverifyClaimed) throw new Error("এই বোনাস আগেই নেওয়া হয়েছে");
    if (!status.reverifyClaimable) throw new Error("প্রথমে ১০টি স্লট রি-ভেরিফাই সম্পন্ন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("mining_state")
      .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: ms } = await supabaseAdmin
      .from("mining_state")
      .select("accrued_amount")
      .eq("user_id", userId)
      .maybeSingle();

    const newAccrued = Number(ms?.accrued_amount ?? 0) + BONUS_AMOUNT;

    const [{ error: msErr }, { error: pErr }] = await Promise.all([
      supabaseAdmin
        .from("mining_state")
        .update({ accrued_amount: newAccrued })
        .eq("user_id", userId),
      supabaseAdmin
        .from("profiles")
        .update({ bonus_reverify_claimed: true })
        .eq("id", userId),
    ]);
    if (msErr) throw new Error(msErr.message);
    if (pErr) throw new Error(pErr.message);

    return { ok: true, amount: BONUS_AMOUNT };
  });
