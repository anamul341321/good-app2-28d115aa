// Server-only: builds a step-by-step ("ধাপে ধাপে") explanation of how a user's
// bonus total and mining total were formed, so any number on screen can be
// reconciled by hand.

export type BreakdownStep = {
  key: string;
  label: string;
  formula?: string | null;
  amount: number;
};

export type EarningsBreakdown = {
  bonus: {
    total: number;
    rates: { firstVerify: number; reverify: number; referrer: number };
    referrerPaidCount: number;
    selfFirst: number;
    selfReverify: number;
    referrerTotal: number;
    otherTotal: number;
    steps: BreakdownStep[];
  };

  mining: {
    total: number;
    selfTotal: number;
    referralTotal: number;
    selfSlots: number;
    referralUnits: number;
    monthlySelf: number;
    monthlyReferral: number;
    monthlyTotal: number;
    perDay: number;
    perSecond: number;
    isActive: boolean;
    activatedAt: string | null;
    daysRunning: number;
    legacyUnclassified: number;
    referees: { uid: number | null; name: string; slots: number; monthly: number }[];
    steps: BreakdownStep[];
  };
};

const MONTHLY_PER_SLOT = 50;

export async function buildEarningsBreakdown(admin: any, userId: string): Promise<EarningsBreakdown> {
  const { readActiveRates } = await import("@/lib/bonus.functions");

  const [rates, msRes, profRes, refsRes, auditRes] = await Promise.all([
    readActiveRates(admin),
    admin.from("mining_state").select("*").eq("user_id", userId).maybeSingle(),
    admin
      .from("profiles")
      .select("bonus_first_verify_self_claimed, bonus_reverify_claimed")
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, uid_seq, display_name, bonus_first_verify_claimed")
      .eq("referred_by", userId)
      .limit(2000),
    // Real bonus-credit events (audit trail) — the only fully trustworthy
    // record of "কখন কত বোনাস যোগ হলো".
    admin
      .from("balance_audit")
      .select("id, source, note, bonus_before, bonus_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  const ms = msRes?.data ?? {};
  const prof = profRes?.data ?? {};
  const referees = refsRes?.data ?? [];
  const bonusEvents = (auditRes?.data ?? [])
    .map((r: any) => ({
      id: r.id as string,
      source: (r.source ?? "db") as string,
      note: (r.note ?? null) as string | null,
      created_at: r.created_at as string,
      delta: Number(r.bonus_after ?? 0) - Number(r.bonus_before ?? 0),
    }))
    .filter((r: any) => Math.abs(r.delta) > 0.009);


  const bonusTotal = Number(ms.bonus_amount ?? 0);
  const accrued = Number(ms.accrued_amount ?? 0);
  const referralAccrued = Number(ms.referral_accrued ?? 0);
  const selfTotal = Number(ms.self_mining_accrued ?? 0);
  const miningTotal = selfTotal + referralAccrued;
  const legacyUnclassified = Math.max(0, accrued - bonusTotal - miningTotal);

  // ---- Bonus steps -------------------------------------------------------
  // Built from the real audit trail (কবে কত যোগ হলো) so every taka has a date
  // and a reason. Flag-based guessing is only a fallback for old accounts that
  // were credited before the audit log existed.
  const referrerPaidCount = referees.filter((r: any) => r.bonus_first_verify_claimed).length;
  const dateBn = (s: string) => new Date(s).toLocaleString("bn-BD");

  const describeBonus = (delta: number): string => {
    const parts: string[] = [];
    let left = Math.round(delta);
    const tryTake = (amount: number, label: string) => {
      if (amount > 0 && left >= amount) {
        left -= amount;
        parts.push(label);
      }
    };
    tryTake(rates.first_verify_bonus, `১০ স্লট first verify ${rates.first_verify_bonus}৳`);
    while (rates.referrer_bonus > 0 && left >= rates.referrer_bonus) {
      left -= rates.referrer_bonus;
      parts.push(`রেফার বোনাস ${rates.referrer_bonus}৳`);
    }
    tryTake(rates.reverify_bonus, `১০ স্লট re-verify ${rates.reverify_bonus}৳ (মাইনিং চালু)`);
    if (left > 0) parts.push(`অন্যান্য ${left}৳`);
    return parts.length ? parts.join(" + ") : "বোনাস";
  };

  const bonusSteps: BreakdownStep[] = [];
  const auditBonusSum = bonusEvents.reduce((s: number, e: any) => s + e.delta, 0);

  if (bonusEvents.length > 0 && Math.abs(auditBonusSum - bonusTotal) < 0.5) {
    for (const e of bonusEvents) {
      const isAdmin = e.source !== "db";
      bonusSteps.push({
        key: `ev-${e.id}`,
        label:
          e.delta < 0
            ? "➖ বোনাস কেটে নেওয়া হয়েছে"
            : isAdmin
              ? "🎁 অ্যাডমিন বোনাস যোগ করেছে"
              : `🎉 ${describeBonus(e.delta)}`,
        formula: `${dateBn(e.created_at)}${e.note ? ` · ${e.note}` : ""}`,
        amount: Number(e.delta.toFixed(2)),
      });
    }
  } else {
    if (prof.bonus_first_verify_self_claimed) {
      bonusSteps.push({
        key: "self-first",
        label: "১০টি স্লট first verify সম্পন্ন — নিজের বোনাস",
        formula: `১ বার × ${rates.first_verify_bonus}৳`,
        amount: rates.first_verify_bonus,
      });
    }
    if (prof.bonus_reverify_claimed) {
      bonusSteps.push({
        key: "self-reverify",
        label: "১০টি স্লট re-verify সম্পন্ন — মাইনিং চালু বোনাস",
        formula: `১ বার × ${rates.reverify_bonus}৳`,
        amount: rates.reverify_bonus,
      });
    }
    if (referrerPaidCount > 0) {
      bonusSteps.push({
        key: "referrer",
        label: `রেফার বোনাস — ${referrerPaidCount} জন রেফার ১০টি first verify শেষ করেছে`,
        formula: `${referrerPaidCount} জন × ${rates.referrer_bonus}৳`,
        amount: referrerPaidCount * rates.referrer_bonus,
      });
    }
    const bonusSum = bonusSteps.reduce((s, x) => s + x.amount, 0);
    const bonusDiff = Number((bonusTotal - bonusSum).toFixed(2));
    if (Math.abs(bonusDiff) > 0.01) {
      bonusSteps.push({
        key: "other",
        label:
          bonusDiff > 0
            ? "অন্যান্য বোনাস / ভাউচার / অ্যাডমিন যোগ (বা পুরোনো অফারের হার)"
            : "সমন্বয় — পুরোনো হিসাব ঠিক করা হয়েছে (তখনকার হার আলাদা ছিল)",
        formula: "ব্যালেন্সে আসল যোগ হওয়া অংশের সাথে মিলিয়ে দেওয়া",
        amount: bonusDiff,
      });
    }
  }


  // ---- Mining steps ------------------------------------------------------
  const selfSlots = Number(ms.self_slots ?? 0);
  const referralUnits = Number(ms.referral_units ?? 0);
  const monthlySelf = selfSlots * MONTHLY_PER_SLOT;
  const monthlyReferral = referralUnits * MONTHLY_PER_SLOT;
  const monthlyTotal = monthlySelf + monthlyReferral;
  const perDay = monthlyTotal / 30;
  const perSecond = monthlyTotal / (30 * 24 * 3600);
  const activatedAt = ms.activated_at ?? null;
  const daysRunning = activatedAt
    ? Math.max(0, (Date.now() - new Date(activatedAt).getTime()) / 86400000)
    : 0;

  const refereeRows = referees
    .map((r: any) => ({ id: r.id, uid: r.uid_seq ?? null, name: r.display_name ?? "ইউজার" }))
    .slice(0, 2000);
  let refereeSlots: Record<string, number> = {};
  if (refereeRows.length) {
    const { data } = await admin
      .from("mining_state")
      .select("user_id, self_slots")
      .in(
        "user_id",
        refereeRows.map((r: any) => r.id),
      );
    for (const row of data ?? []) refereeSlots[row.user_id] = Number(row.self_slots ?? 0);
  }
  const refereeList = refereeRows
    .map((r: any) => {
      const slots = refereeSlots[r.id] ?? 0;
      return { uid: r.uid, name: r.name, slots, monthly: slots * MONTHLY_PER_SLOT * 0.1 };
    })
    .filter((r: any) => r.slots > 0)
    .sort((a: any, b: any) => b.slots - a.slots);

  const miningSteps: BreakdownStep[] = [
    {
      key: "self-rate",
      label: `নিজের ${selfSlots}টি re-verified স্লট × ৫০৳/মাস`,
      formula: `${selfSlots} × ৫০৳ = ${monthlySelf}৳ প্রতি মাস`,
      amount: monthlySelf,
    },
    {
      key: "ref-rate",
      label: `রেফার ১০% কমিশন — ${refereeList.length} জন সক্রিয় রেফার`,
      formula: refereeList.length
        ? refereeList
            .slice(0, 12)
            .map((r: any) => `${r.name}(${r.uid ?? "—"}): ${r.slots}স্লট → ${r.monthly.toFixed(0)}৳`)
            .join(" · ")
        : "এখনো কোনো রেফারের মাইনিং চালু হয়নি",
      amount: monthlyReferral,
    },
    {
      key: "monthly",
      label: "মোট মাসিক রেট",
      formula: `${monthlySelf}৳ + ${monthlyReferral.toFixed(2)}৳`,
      amount: monthlyTotal,
    },
    {
      key: "perday",
      label: "প্রতিদিন জমা হয়",
      formula: `${monthlyTotal.toFixed(2)}৳ ÷ ৩০ দিন`,
      amount: perDay,
    },
    {
      key: "elapsed",
      label: activatedAt
        ? `মাইনিং চালু আছে ${daysRunning.toFixed(2)} দিন (${new Date(activatedAt).toLocaleDateString("bn-BD")} থেকে)`
        : "মাইনিং এখনো চালু হয়নি",
      formula: activatedAt ? `${perDay.toFixed(2)}৳/দিন × ${daysRunning.toFixed(2)} দিন (রেট বদলালে হিসাব ধাপে ধাপে হয়)` : null,
      amount: miningTotal,
    },
    {
      key: "self-earned",
      label: "এর মধ্যে নিজের স্লট থেকে",
      formula: "মোট মাইনিং − রেফার কমিশন",
      amount: selfTotal,
    },
    {
      key: "ref-earned",
      label: "এর মধ্যে রেফার ১০% কমিশন থেকে",
      formula: "রেফারদের মাইনিং-এর ১০%",
      amount: referralAccrued,
    },
  ];

  // ---- Reconciled bonus split -------------------------------------------
  // Rates changed over time (আগে ৫০৳/২০০৳/১০০৳ ছিল, এখন অফার রেট আলাদা), so we
  // never assume the *current* rate applies to an old credit. Instead we test
  // every historical rate combination and pick the one that actually adds up to
  // the bonus that was really credited to this account.
  const FIRST_RATES = [rates.first_verify_bonus, 100, 50];
  const REVERIFY_RATES = [rates.reverify_bonus, 400, 200];
  const REFERRER_RATES = [rates.referrer_bonus, 150, 100];
  const gotFirst = !!prof.bonus_first_verify_self_claimed;
  const gotRe = !!prof.bonus_reverify_claimed;

  let best = {
    first: rates.first_verify_bonus,
    re: rates.reverify_bonus,
    ref: rates.referrer_bonus,
    diff: Number.POSITIVE_INFINITY,
  };
  for (const f of FIRST_RATES) {
    for (const rv of REVERIFY_RATES) {
      for (const rf of REFERRER_RATES) {
        const sum = (gotFirst ? f : 0) + (gotRe ? rv : 0) + referrerPaidCount * rf;
        // Prefer combinations that don't exceed what was actually credited.
        const diff = sum > bonusTotal + 0.5 ? (sum - bonusTotal) * 100 : bonusTotal - sum;
        if (diff < best.diff) best = { first: f, re: rv, ref: rf, diff };
      }
    }
  }
  const usedRates = {
    firstVerify: best.first,
    reverify: best.re,
    referrer: best.ref,
  };
  const ratesAssumed =
    best.first !== rates.first_verify_bonus ||
    best.re !== rates.reverify_bonus ||
    best.ref !== rates.referrer_bonus;

  let left = bonusTotal;
  const take = (want: number) => {
    const got = Math.max(0, Math.min(want, left));
    left = Number((left - got).toFixed(2));
    return got;
  };
  const selfFirst = take(gotFirst ? usedRates.firstVerify : 0);
  const referrerTotal = take(referrerPaidCount * usedRates.referrer);
  const selfReverify = take(gotRe ? usedRates.reverify : 0);
  const otherTotal = Number(left.toFixed(2));

  return {
    bonus: {
      total: bonusTotal,
      rates: usedRates,
      currentRates: {
        firstVerify: rates.first_verify_bonus,
        reverify: rates.reverify_bonus,
        referrer: rates.referrer_bonus,
      },
      ratesAssumed,
      referrerPaidCount,
      selfFirst,
      selfReverify,
      referrerTotal,
      otherTotal,
      steps: bonusSteps,
    },


    mining: {
      total: miningTotal,
      selfTotal,
      referralTotal: referralAccrued,
      selfSlots,
      referralUnits,
      monthlySelf,
      monthlyReferral,
      monthlyTotal,
      perDay,
      perSecond,
      isActive: !!ms.is_active,
      activatedAt,
      daysRunning,
      legacyUnclassified,
      referees: refereeList,
      steps: miningSteps,
    },
  };
}
