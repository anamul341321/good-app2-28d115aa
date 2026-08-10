// Server-only: builds a step-by-step ("ধাপে ধাপে") explanation of how a user's
// bonus total and mining total were formed, so any number on screen can be
// reconciled by hand.

export type BreakdownStep = {
  key: string;
  label: string;
  formula?: string | null;
  amount: number;
};

export type TransferInInfo = {
  id: string;
  senderId: string;
  uid: number | null;
  name: string;
  phone: string | null;
  amount: number;
  note: string | null;
  createdAt: string;
  sender: {
    bonusTotal: number;
    miningTotal: number;
    adminCredited: number;
    selfSlots: number;
    legal: boolean;
    banned: boolean;
    frozen: boolean;
  };
};

export type EarningsBreakdown = {
  transfersIn: TransferInInfo[];
  transfersInTotal: number;
  bonus: {
    total: number;
    rates: { firstVerify: number; reverify: number; referrer: number };
    currentRates: { firstVerify: number; reverify: number; referrer: number };
    ratesAssumed: boolean;
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
      .select("id, uid_seq, display_name, bonus_first_verify_claimed, referrer_bonus_paid_at")
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

  // ---- Money received from other users (transfers in) --------------------
  // These credits land in `bonus_amount` via credit_bonus_balance(), so without
  // this join they look like "admin added" — we resolve the real sender here.
  const { data: transferRows } = await admin
    .from("transfers")
    .select("id, sender_id, amount, note, created_at")
    .eq("receiver_id", userId)
    .order("created_at", { ascending: true })
    .limit(300);

  const senderIds = Array.from(new Set((transferRows ?? []).map((t: any) => t.sender_id)));
  const senderProfiles = new Map<string, any>();
  const senderMining = new Map<string, any>();
  const senderAdminCredit = new Map<string, number>();
  if (senderIds.length) {
    const [pRes, mRes, acRes] = await Promise.all([
      admin
        .from("profiles")
        .select("id, uid_seq, display_name, phone_number, banned, balance_frozen")
        .in("id", senderIds),
      admin
        .from("mining_state")
        .select("user_id, bonus_amount, self_mining_accrued, referral_accrued, self_slots")
        .in("user_id", senderIds),
      admin.from("admin_credits").select("user_id, amount").in("user_id", senderIds),
    ]);
    for (const p of pRes?.data ?? []) senderProfiles.set(p.id, p);
    for (const m of mRes?.data ?? []) senderMining.set(m.user_id, m);
    for (const c of acRes?.data ?? [])
      senderAdminCredit.set(c.user_id, (senderAdminCredit.get(c.user_id) ?? 0) + Number(c.amount ?? 0));
  }

  const transfersIn: TransferInInfo[] = (transferRows ?? []).map((t: any) => {
    const p = senderProfiles.get(t.sender_id) ?? {};
    const m = senderMining.get(t.sender_id) ?? {};
    const adminCredited = senderAdminCredit.get(t.sender_id) ?? 0;
    const miningTot = Number(m.self_mining_accrued ?? 0) + Number(m.referral_accrued ?? 0);
    return {
      id: t.id as string,
      senderId: t.sender_id as string,
      uid: p.uid_seq ?? null,
      name: p.display_name ?? "ইউজার",
      phone: p.phone_number ?? null,
      amount: Number(t.amount ?? 0),
      note: t.note ?? null,
      createdAt: t.created_at as string,
      sender: {
        bonusTotal: Number(m.bonus_amount ?? 0),
        miningTotal: miningTot,
        adminCredited,
        selfSlots: Number(m.self_slots ?? 0),
        legal: adminCredited <= 0.01 && !p.banned,
        banned: !!p.banned,
        frozen: !!p.balance_frozen,
      },
    };
  });
  const transfersInTotal = transfersIn.reduce((s, t) => s + t.amount, 0);

  // Match audit bonus events to transfers (same amount, within 2 minutes).
  const usedTransfers = new Set<string>();
  const matchTransfer = (e: { created_at: string; delta: number }) => {
    const t = transfersIn.find(
      (x) =>
        !usedTransfers.has(x.id) &&
        Math.abs(x.amount - e.delta) < 0.01 &&
        Math.abs(new Date(x.createdAt).getTime() - new Date(e.created_at).getTime()) < 120000,
    );
    if (t) usedTransfers.add(t.id);
    return t;
  };

  // Transfers land inside `bonus_amount`, so they must be removed from the bonus
  // figure — otherwise the same taka is counted twice (once as "বোনাস", once as
  // "অন্য user পাঠিয়েছে").
  const transferEventIds = new Set<string>();
  let transferMatchedTotal = 0;
  for (const e of bonusEvents) {
    if (e.delta <= 0) continue;
    const t = matchTransfer(e);
    if (t) {
      transferEventIds.add(e.id);
      transferMatchedTotal += e.delta;
    }
  }

  const bonusRaw = Number(ms.bonus_amount ?? 0);
  const bonusTotal = Number(Math.max(0, bonusRaw - transferMatchedTotal).toFixed(2));
  const accrued = Number(ms.accrued_amount ?? 0);
  const referralAccrued = Number(ms.referral_accrued ?? 0);
  const selfTotal = Number(ms.self_mining_accrued ?? 0);
  const miningTotal = selfTotal + referralAccrued;
  const legacyUnclassified = Math.max(0, accrued - bonusRaw - miningTotal);

  // ---- Bonus steps -------------------------------------------------------
  // Built from the real audit trail (কবে কত যোগ হলো) so every taka has a date
  // and a reason. Flag-based guessing is only a fallback for old accounts that
  // were credited before the audit log existed.
  // রেফার বোনাস আসলে পেইড হয়েছে কিনা — referrer_bonus_paid_at-ই একমাত্র নির্ভরযোগ্য প্রমাণ।
  const referrerPaidCount = referees.filter((r: any) => !!r.referrer_bonus_paid_at).length;
  const dateBn = (s: string) => new Date(s).toLocaleString("bn-BD");

  // Rates changed over time (আগে ৫০৳/২০০৳/১০০৳/১৫০৳ ছিল, এখন অফার রেট আলাদা), so we
  // never assume the *current* rate applies to an old credit.
  const FIRST_RATES = [rates.first_verify_bonus, 100, 63, 60, 50];
  const REVERIFY_RATES = [rates.reverify_bonus, 400, 300, 200];
  const REFERRER_RATES = [rates.referrer_bonus, 150, 100, 63, 60, 50];
  const gotFirst = !!prof.bonus_first_verify_self_claimed;
  const gotRe = !!prof.bonus_reverify_claimed;

  // ---- Which bonus credits are already proven by the audit log? -----------
  const auditBonusSum = Number(bonusEvents.reduce((s: number, e: any) => s + e.delta, 0).toFixed(2));
  const positiveEvents = bonusEvents.filter((e: any) => e.delta > 0 && !transferEventIds.has(e.id));

  // referrer_bonus_paid_at is an exact timestamp, so a referral payout can be
  // tied to the audit event that credited it — no guessing needed.
  const paidRefs = referees
    .filter((r: any) => !!r.referrer_bonus_paid_at)
    .map((r: any) => ({
      uid: r.uid_seq ?? null,
      name: r.display_name ?? "ইউজার",
      at: new Date(r.referrer_bonus_paid_at).getTime(),
    }));
  const refsByEvent = new Map<string, typeof paidRefs>();
  let refsExplainedByAudit = 0;
  for (const r of paidRefs) {
    const ev = positiveEvents.find((e: any) => Math.abs(new Date(e.created_at).getTime() - r.at) < 180000);
    if (!ev) continue;
    const list = refsByEvent.get(ev.id) ?? [];
    list.push(r);
    refsByEvent.set(ev.id, list);
    refsExplainedByAudit += 1;
  }

  // Everything credited before the audit log existed (or by an event we cannot
  // attribute) is the "legacy" part — that part is reconstructed by fitting the
  // historical rates to the amount that was ACTUALLY credited.
  const legacyBonus = Number(Math.max(0, bonusRaw - auditBonusSum).toFixed(2));
  const legacyRefCount = Math.max(0, referrerPaidCount - refsExplainedByAudit);
  // first/re-verify bonuses only belong to the legacy part when there is money
  // there to cover them; otherwise they were credited inside the audit window.
  const legacyHasFirst = gotFirst && legacyBonus > 0.5;
  const legacyHasRe = gotRe && legacyBonus > 0.5;

  let best = {
    first: rates.first_verify_bonus,
    re: rates.reverify_bonus,
    ref: rates.referrer_bonus,
    diff: Number.POSITIVE_INFINITY,
  };
  for (const f of FIRST_RATES) {
    for (const rv of REVERIFY_RATES) {
      for (const rf of REFERRER_RATES) {
        const sum = (legacyHasFirst ? f : 0) + (legacyHasRe ? rv : 0) + legacyRefCount * rf;
        // Prefer combinations that don't exceed what was actually credited.
        const diff = sum > legacyBonus + 0.5 ? (sum - legacyBonus) * 100 : legacyBonus - sum;
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
    legacyBonus > 0.5 &&
    (best.first !== rates.first_verify_bonus ||
      best.re !== rates.reverify_bonus ||
      best.ref !== rates.referrer_bonus);

  const describeBonus = (delta: number, opts: { allowFirst: boolean; allowRe: boolean }): string => {
    const parts: string[] = [];
    let left = Math.round(delta);
    // Referral first: a plain refer-bonus credit must never be mislabelled as a
    // first-verify bonus just because the two rates happen to be equal.
    for (const rf of [usedRates.referrer, rates.referrer_bonus, 150, 100, 63, 60, 50]) {
      if (rf > 0 && left % rf === 0 && left / rf >= 1 && left / rf <= 20) {
        const n = left / rf;
        left = 0;
        parts.push(`রেফার বোনাস ${n} জন × ${rf}৳`);
        break;
      }
    }
    if (opts.allowFirst && usedRates.firstVerify > 0 && left >= usedRates.firstVerify) {
      left -= usedRates.firstVerify;
      parts.push(`১০ স্লট first verify ${usedRates.firstVerify}৳`);
    }
    if (opts.allowRe && usedRates.reverify > 0 && left >= usedRates.reverify) {
      left -= usedRates.reverify;
      parts.push(`১০ স্লট re-verify ${usedRates.reverify}৳ (মাইনিং চালু)`);
    }
    if (left > 0) parts.push(`অন্যান্য ${left}৳`);
    return parts.length ? parts.join(" + ") : "বোনাস";
  };

  const bonusSteps: BreakdownStep[] = [];

  // 1) Legacy (pre-audit) part — reconstructed with the rates of that time.
  if (legacyBonus > 0.5) {
    let left = legacyBonus;
    if (legacyHasFirst) {
      bonusSteps.push({
        key: "self-first",
        label: "১০টি স্লট first verify সম্পন্ন — নিজের বোনাস",
        formula: `১ বার × ${usedRates.firstVerify}৳ (তখনকার হার)`,
        amount: usedRates.firstVerify,
      });
      left -= usedRates.firstVerify;
    }
    if (legacyHasRe) {
      bonusSteps.push({
        key: "self-reverify",
        label: "১০টি স্লট re-verify সম্পন্ন — মাইনিং চালু বোনাস",
        formula: `১ বার × ${usedRates.reverify}৳ (তখনকার হার)`,
        amount: usedRates.reverify,
      });
      left -= usedRates.reverify;
    }
    if (legacyRefCount > 0) {
      bonusSteps.push({
        key: "referrer-legacy",
        label: `রেফার বোনাস — ${legacyRefCount} জন রেফার ১০টি first verify শেষ করেছে`,
        formula: `${legacyRefCount} জন × ${usedRates.referrer}৳ (তখনকার হার)`,
        amount: legacyRefCount * usedRates.referrer,
      });
      left -= legacyRefCount * usedRates.referrer;
    }
    const leftRounded = Number(left.toFixed(2));
    if (Math.abs(leftRounded) > 0.01) {
      bonusSteps.push({
        key: "other-legacy",
        label:
          leftRounded > 0
            ? "অন্যান্য পুরোনো বোনাস / ভাউচার / অ্যাডমিন যোগ"
            : "সমন্বয় — পুরোনো হিসাব ঠিক করা হয়েছে",
        formula: "ব্যালেন্সে আসল যোগ হওয়া অংশের সাথে মিলিয়ে দেওয়া",
        amount: leftRounded,
      });
    }
  }

  // 2) Everything the audit log can prove — date + reason for each taka.
  const firstShownInLegacy = legacyHasFirst;
  const reShownInLegacy = legacyHasRe;
  for (const e of bonusEvents) {
    // Transfers from other users are shown in their own card only — skipping
    // them here stops the same taka from appearing twice.
    if (transferEventIds.has(e.id)) continue;
    const matchedRefs = refsByEvent.get(e.id) ?? [];
    const isAdmin = String(e.source ?? "").startsWith("admin");
    let label: string;
    if (e.delta < 0) {
      label = `➖ বোনাস কেটে নেওয়া হয়েছে${e.note ? ` — ${e.note}` : ""}`;
    } else if (matchedRefs.length) {
      const per = Math.round((e.delta / matchedRefs.length) * 100) / 100;
      label =
        `🎉 রেফার বোনাস — ${matchedRefs.length} জন × ${per}৳ ` +
        `(${matchedRefs.map((r: { uid: number | null; name: string }) => `UID ${r.uid ?? "?"} ${r.name}`).join(", ")})`;
    } else if (e.note) {
      label = `🎉 ${e.note}`;
    } else if (isAdmin) {
      label = "🎁 অ্যাডমিন বোনাস যোগ করেছে";
    } else {
      label = `🎉 ${describeBonus(e.delta, { allowFirst: !firstShownInLegacy, allowRe: !reShownInLegacy })}`;
    }
    bonusSteps.push({
      key: `ev-${e.id}`,
      label,
      formula: dateBn(e.created_at),
      amount: Number(e.delta.toFixed(2)),
    });
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
  // (rate reconciliation happens earlier, before the bonus steps are built)
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
    transfersIn,
    transfersInTotal,

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
