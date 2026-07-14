// Instant bonus system (auto-settled on every dashboard load, idempotent):
//
//  1. Self first-verify:  user completes 10 first-verifies → user gets 50৳ (default).
//     flag column: profiles.bonus_first_verify_self_claimed
//  2. Referrer bonus:     user completes 10 first-verifies → referrer gets 100৳ (default).
//     flag column: profiles.bonus_first_verify_claimed  (kept for backwards compat)
//  3. Re-verify:          user completes 10 re-verifies  → user gets 200৳ (default)
//                                                        + mining kicks on.
//     flag column: profiles.bonus_reverify_claimed
//
// Amounts are read live from public.bonus_settings so the admin panel
// can tweak them without a code change.

const DEFAULTS = { first_verify_bonus: 50, reverify_bonus: 200, referrer_bonus: 100 };

async function readSettings(admin: any) {
  try {
    const { data } = await admin.from("bonus_settings").select("*").eq("id", "default").maybeSingle();
    if (!data) return DEFAULTS;
    return {
      first_verify_bonus: Number(data.first_verify_bonus ?? DEFAULTS.first_verify_bonus),
      reverify_bonus: Number(data.reverify_bonus ?? DEFAULTS.reverify_bonus),
      referrer_bonus: Number(data.referrer_bonus ?? DEFAULTS.referrer_bonus),
    };
  } catch {
    return DEFAULTS;
  }
}

async function creditAccrued(admin: any, userId: string, amount: number) {
  if (amount <= 0) return;
  await admin
    .from("mining_state")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: ms } = await admin
    .from("mining_state").select("accrued_amount").eq("user_id", userId).maybeSingle();
  const next = Number(ms?.accrued_amount ?? 0) + amount;
  await admin.from("mining_state").update({ accrued_amount: next }).eq("user_id", userId);
}

export async function settleWelcomeBonuses(
  admin: any,
  userId: string,
  firstVerifyCount: number,
  reverifyCount: number,
): Promise<{
  selfFirstPaid: boolean;
  referrerPaid: boolean;
  userReverifyPaid: boolean;
  selfFirstAmount: number;
  referrerAmount: number;
  userAmount: number;
}> {
  const amounts = await readSettings(admin);

  const { data: profile } = await admin
    .from("profiles")
    .select("bonus_first_verify_claimed, bonus_first_verify_self_claimed, bonus_reverify_claimed, referred_by")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return {
      selfFirstPaid: false, referrerPaid: false, userReverifyPaid: false,
      selfFirstAmount: amounts.first_verify_bonus,
      referrerAmount: amounts.referrer_bonus,
      userAmount: amounts.reverify_bonus,
    };
  }

  let selfFirstPaid = !!profile.bonus_first_verify_self_claimed;
  let referrerPaid = !!profile.bonus_first_verify_claimed;
  let userReverifyPaid = !!profile.bonus_reverify_claimed;

  // 1) Self first-verify → 50৳ (default) to the user
  if (!selfFirstPaid && firstVerifyCount >= 10) {
    await creditAccrued(admin, userId, amounts.first_verify_bonus);
    await admin.from("profiles").update({ bonus_first_verify_self_claimed: true }).eq("id", userId);
    selfFirstPaid = true;
  }

  // 2) Referrer bonus → 100৳ to the person who referred this user
  if (!referrerPaid && firstVerifyCount >= 10) {
    if (profile.referred_by && profile.referred_by !== userId) {
      await creditAccrued(admin, profile.referred_by, amounts.referrer_bonus);
    }
    await admin.from("profiles").update({ bonus_first_verify_claimed: true }).eq("id", userId);
    referrerPaid = true;
  }

  // 3) Re-verify → 200৳ (default) to the user + mining kicks on
  if (!userReverifyPaid && reverifyCount >= 10) {
    await creditAccrued(admin, userId, amounts.reverify_bonus);
    await admin.from("profiles").update({ bonus_reverify_claimed: true }).eq("id", userId);
    userReverifyPaid = true;
    await admin.rpc("settle_mining", { _user_id: userId });
  }

  return {
    selfFirstPaid, referrerPaid, userReverifyPaid,
    selfFirstAmount: amounts.first_verify_bonus,
    referrerAmount: amounts.referrer_bonus,
    userAmount: amounts.reverify_bonus,
  };
}

// Compat: some callers still import BONUS_AMOUNTS. Return the live defaults;
// UI reads the fresh values from the settle result now.
export const BONUS_AMOUNTS = {
  referrer: DEFAULTS.referrer_bonus,
  userReverify: DEFAULTS.reverify_bonus,
  selfFirst: DEFAULTS.first_verify_bonus,
};
