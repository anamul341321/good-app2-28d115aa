// New instant bonus system (replaces old claim flow):
//
// - When a user completes 10 first-verifies → the person who referred them
//   is instantly credited 100৳ (one-time per referee).
// - When the same user completes 10 re-verifies → the user themselves is
//   instantly credited 200৳ (one-time) and mining starts (settle_mining
//   already gates on re-verify count).
//
// Both flags reuse the existing profiles columns:
//   bonus_first_verify_claimed  → "referrer already paid for THIS user"
//   bonus_reverify_claimed      → "user already paid 200 re-verify bonus"
//
// This function is idempotent and safe to call on every dashboard load.

const REFERRER_BONUS = 100;
const USER_REVERIFY_BONUS = 200;

async function creditAccrued(admin: any, userId: string, amount: number) {
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
  referrerPaid: boolean;
  userReverifyPaid: boolean;
  referrerAmount: number;
  userAmount: number;
}> {
  const { data: profile } = await admin
    .from("profiles")
    .select("bonus_first_verify_claimed, bonus_reverify_claimed, referred_by")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return { referrerPaid: false, userReverifyPaid: false, referrerAmount: REFERRER_BONUS, userAmount: USER_REVERIFY_BONUS };
  }

  let referrerPaid = !!profile.bonus_first_verify_claimed;
  let userReverifyPaid = !!profile.bonus_reverify_claimed;

  // 1) First-verify → referrer bonus
  if (!referrerPaid && firstVerifyCount >= 10) {
    if (profile.referred_by && profile.referred_by !== userId) {
      await creditAccrued(admin, profile.referred_by, REFERRER_BONUS);
    }
    // Flag even if there is no referrer, so we don't re-check repeatedly.
    await admin.from("profiles").update({ bonus_first_verify_claimed: true }).eq("id", userId);
    referrerPaid = true;
  }

  // 2) Re-verify → user gets 200৳
  if (!userReverifyPaid && reverifyCount >= 10) {
    await creditAccrued(admin, userId, USER_REVERIFY_BONUS);
    await admin.from("profiles").update({ bonus_reverify_claimed: true }).eq("id", userId);
    userReverifyPaid = true;
    // Kick mining now that re-verify quorum is reached
    await admin.rpc("settle_mining", { _user_id: userId });
  }

  return {
    referrerPaid,
    userReverifyPaid,
    referrerAmount: REFERRER_BONUS,
    userAmount: USER_REVERIFY_BONUS,
  };
}

export const BONUS_AMOUNTS = {
  referrer: REFERRER_BONUS,
  userReverify: USER_REVERIFY_BONUS,
};
