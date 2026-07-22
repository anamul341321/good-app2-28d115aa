// Instant welcome bonuses — auto-settled on every dashboard load (idempotent).
//
// Base rates come from public.bonus_settings. If promo_active=true AND
// now() is between promo_start_at and promo_end_at, promo_* amounts are used
// instead — that's the "2X বোনাস অফার" pathway.
//
//  1. Self first-verify:  user completes 10 first-verifies → user gets first_verify_bonus.
//     flag: profiles.bonus_first_verify_self_claimed
//  2. Referrer bonus:     user completes 10 first-verifies → referrer gets referrer_bonus.
//     flag: profiles.bonus_first_verify_claimed  (kept for backwards compat)
//  3. Re-verify:          user completes 10 re-verifies → user gets reverify_bonus
//                                                        + mining kicks on.
//     flag: profiles.bonus_reverify_claimed

const DEFAULTS = { first_verify_bonus: 50, reverify_bonus: 200, referrer_bonus: 100 };

export type BonusRates = {
  first_verify_bonus: number;
  reverify_bonus: number;
  referrer_bonus: number;
  promo_active: boolean;
  promo_title: string | null;
  promo_start_at: string | null;
  promo_end_at: string | null;
  base_first_verify_bonus: number;
  base_reverify_bonus: number;
  base_referrer_bonus: number;
};

export async function readActiveRates(admin: any): Promise<BonusRates> {
  try {
    const { data } = await admin.from("bonus_settings").select("*").eq("id", "default").maybeSingle();
    const base = {
      first_verify_bonus: Number(data?.first_verify_bonus ?? DEFAULTS.first_verify_bonus),
      reverify_bonus:     Number(data?.reverify_bonus     ?? DEFAULTS.reverify_bonus),
      referrer_bonus:     Number(data?.referrer_bonus     ?? DEFAULTS.referrer_bonus),
    };
    const promo_active = !!data?.promo_active;
    const startMs = data?.promo_start_at ? new Date(data.promo_start_at).getTime() : 0;
    const endMs   = data?.promo_end_at   ? new Date(data.promo_end_at).getTime()   : 0;
    const nowMs   = Date.now();
    const inWindow = promo_active && startMs > 0 && endMs > 0 && nowMs >= startMs && nowMs <= endMs;
    const useFv = inWindow && data?.promo_first_verify_bonus != null ? Number(data.promo_first_verify_bonus) : base.first_verify_bonus;
    const useRv = inWindow && data?.promo_reverify_bonus     != null ? Number(data.promo_reverify_bonus)     : base.reverify_bonus;
    const useRf = inWindow && data?.promo_referrer_bonus     != null ? Number(data.promo_referrer_bonus)     : base.referrer_bonus;
    return {
      first_verify_bonus: useFv,
      reverify_bonus:     useRv,
      referrer_bonus:     useRf,
      promo_active: inWindow,
      promo_title:  data?.promo_title ?? null,
      promo_start_at: data?.promo_start_at ?? null,
      promo_end_at:   data?.promo_end_at   ?? null,
      base_first_verify_bonus: base.first_verify_bonus,
      base_reverify_bonus:     base.reverify_bonus,
      base_referrer_bonus:     base.referrer_bonus,
    };
  } catch {
    return {
      ...DEFAULTS,
      promo_active: false, promo_title: null, promo_start_at: null, promo_end_at: null,
      base_first_verify_bonus: DEFAULTS.first_verify_bonus,
      base_reverify_bonus:     DEFAULTS.reverify_bonus,
      base_referrer_bonus:     DEFAULTS.referrer_bonus,
    };
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
  rates: BonusRates;
}> {
  const rates = await readActiveRates(admin);

  const { data: profile } = await admin
    .from("profiles")
    .select("bonus_first_verify_claimed, bonus_first_verify_self_claimed, bonus_reverify_claimed, referred_by")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) {
    return {
      selfFirstPaid: false, referrerPaid: false, userReverifyPaid: false,
      selfFirstAmount: rates.first_verify_bonus,
      referrerAmount:  rates.referrer_bonus,
      userAmount:      rates.reverify_bonus,
      rates,
    };
  }

  let selfFirstPaid    = !!profile.bonus_first_verify_self_claimed;
  let referrerPaid     = !!profile.bonus_first_verify_claimed;
  let userReverifyPaid = !!profile.bonus_reverify_claimed;

  if (!selfFirstPaid && firstVerifyCount >= 10) {
    await creditAccrued(admin, userId, rates.first_verify_bonus);
    await admin.from("profiles").update({ bonus_first_verify_self_claimed: true }).eq("id", userId);
    selfFirstPaid = true;
  }

  if (!referrerPaid && firstVerifyCount >= 10) {
    if (profile.referred_by && profile.referred_by !== userId) {
      await creditAccrued(admin, profile.referred_by, rates.referrer_bonus);
    }
    await admin.from("profiles").update({ bonus_first_verify_claimed: true }).eq("id", userId);
    referrerPaid = true;
  }

  if (!userReverifyPaid && reverifyCount >= 10) {
    await creditAccrued(admin, userId, rates.reverify_bonus);
    await admin.from("profiles").update({ bonus_reverify_claimed: true }).eq("id", userId);
    userReverifyPaid = true;
    await admin.rpc("settle_mining", { _user_id: userId });
  }

  return {
    selfFirstPaid, referrerPaid, userReverifyPaid,
    selfFirstAmount: rates.first_verify_bonus,
    referrerAmount:  rates.referrer_bonus,
    userAmount:      rates.reverify_bonus,
    rates,
  };
}

// Compat: kept only so old imports don't break. UI should read `bonus.rates`
// from the dashboard response for the live values.
export const BONUS_AMOUNTS = {
  referrer: DEFAULTS.referrer_bonus,
  userReverify: DEFAULTS.reverify_bonus,
  selfFirst: DEFAULTS.first_verify_bonus,
};
