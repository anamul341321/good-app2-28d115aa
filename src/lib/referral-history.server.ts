/**
 * Server-only: "কোন রেফার থেকে কত টাকা, কখন, কোন রেটে পেয়েছি" — রেফার বোনাস
 * ও রেফার ১০% কমিশনের নাম-ধরে হিসাব।
 *
 * টাকার উৎস তিন জায়গা থেকে মেলানো হয় (সবচেয়ে নির্ভরযোগ্য আগে):
 *   1. balance_ledger (type = referral_bonus) → metadata.referee_id + exact amount
 *   2. balance_audit → referrer_bonus_paid_at এর ±৩ মিনিটের ভেতরের bonus credit
 *   3. fallback → তখনকার রেট জানা নেই, তাই বর্তমান রেট (approx হিসেবে চিহ্নিত)
 */

export type ReferralBonusRow = {
  refereeId: string;
  uid: number | null;
  name: string;
  phone: string | null;
  joinedAt: string;
  firstVerifies: number;
  reverifies: number;
  activeSlots: number;
  /** রেফার বোনাস পেইড হয়েছে কি না */
  paid: boolean;
  paidAt: string | null;
  amount: number;
  /** যে রেটে টাকা পেয়েছে (তখনকার রেট) */
  rate: number;
  /** amount কোথা থেকে এলো: ledger | audit | approx | pending */
  source: "ledger" | "audit" | "approx" | "pending";
  /** কেন এখনো বোনাস পায়নি — pending হলে */
  pendingReason: string | null;
  /** এই রেফার থেকে মাসিক ১০% কমিশন */
  monthlyCommission: number;
};

export type ReferralHistory = {
  currentRate: number;
  rows: ReferralBonusRow[];
  totals: {
    referees: number;
    paidCount: number;
    paidAmount: number;
    pendingCount: number;
    monthlyCommission: number;
    commissionAccrued: number;
    commissionClaimed: number;
  };
};

const MONTHLY_PER_SLOT = 50;
const COMMISSION_RATE = 0.1;

export async function buildReferralHistory(admin: any, userId: string): Promise<ReferralHistory> {
  const { readActiveRates } = await import("@/lib/bonus.functions");
  const rates = await readActiveRates(admin);

  const referees: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, uid_seq, display_name, phone_number, created_at, referrer_bonus_paid_at")
      .eq("referred_by", userId)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    referees.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const ids = referees.map((r) => r.id);

  const [ledgerRes, auditRes, tasksRes, msRes, myMsRes] = await Promise.all([
    admin
      .from("balance_ledger")
      .select("id, amount, metadata, created_at")
      .eq("user_id", userId)
      .eq("type", "referral_bonus")
      .order("created_at", { ascending: true })
      .limit(2000),
    admin
      .from("balance_audit")
      .select("id, source, note, bonus_before, bonus_after, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1000),
    ids.length
      ? admin
          .from("tasks")
          .select("user_id, slot, initial_verify_at, reverify_count, whitelist_ok, wallet_address")
          .in("user_id", ids)
          .limit(20000)
      : Promise.resolve({ data: [] }),
    ids.length
      ? admin.from("mining_state").select("user_id, self_slots").in("user_id", ids)
      : Promise.resolve({ data: [] }),
    admin
      .from("mining_state")
      .select("referral_accrued, referral_units")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const perReferee = new Map<string, { first: number; re: number }>();
  for (const t of tasksRes?.data ?? []) {
    const row = perReferee.get(t.user_id) ?? { first: 0, re: 0 };
    if (t.initial_verify_at && t.wallet_address) row.first += 1;
    if (Number(t.reverify_count ?? 0) > 0) row.re += 1;
    perReferee.set(t.user_id, row);
  }
  const slotsByReferee = new Map<string, number>();
  for (const m of msRes?.data ?? []) slotsByReferee.set(m.user_id, Number(m.self_slots ?? 0));

  // 1) exact ledger rows keyed by referee
  const ledgerByReferee = new Map<string, { amount: number; at: string }>();
  for (const l of ledgerRes?.data ?? []) {
    const refId = (l.metadata ?? {})?.referee_id as string | undefined;
    if (!refId) continue;
    ledgerByReferee.set(refId, { amount: Number(l.amount ?? 0), at: l.created_at });
  }

  // 2) audit bonus credits, matched by time to referrer_bonus_paid_at
  const auditEvents = (auditRes?.data ?? [])
    .map((r: any) => ({
      at: new Date(r.created_at).getTime(),
      delta: Number(r.bonus_after ?? 0) - Number(r.bonus_before ?? 0),
    }))
    .filter((r: any) => r.delta > 0.009);

  const knownRates = Array.from(
    new Set([rates.referrer_bonus, rates.base_referrer_bonus, 150, 100, 70, 63, 60, 50].filter((n) => n > 0)),
  );
  const fitRate = (delta: number): number | null => {
    for (const r of knownRates) {
      const n = Math.round(delta / r);
      if (n >= 1 && n <= 20 && Math.abs(delta - n * r) < 0.5) return r;
    }
    return null;
  };

  const rows: ReferralBonusRow[] = referees.map((r) => {
    const counts = perReferee.get(r.id) ?? { first: 0, re: 0 };
    const slots = slotsByReferee.get(r.id) ?? 0;
    const base: Omit<ReferralBonusRow, "paid" | "paidAt" | "amount" | "rate" | "source" | "pendingReason"> = {
      refereeId: r.id,
      uid: r.uid_seq ?? null,
      name: r.display_name ?? "ইউজার",
      phone: r.phone_number ?? null,
      joinedAt: r.created_at,
      firstVerifies: counts.first,
      reverifies: counts.re,
      activeSlots: slots,
      monthlyCommission: slots * MONTHLY_PER_SLOT * COMMISSION_RATE,
    };

    if (!r.referrer_bonus_paid_at) {
      return {
        ...base,
        paid: false,
        paidAt: null,
        amount: 0,
        rate: rates.referrer_bonus,
        source: "pending",
        pendingReason:
          counts.first >= 10
            ? "১০টি first verify হয়েছে — পরের বার অ্যাপ খুললেই বোনাস যোগ হবে"
            : `১০টি first verify দরকার, এখন ${counts.first}টি`,
      };
    }

    const paidAt = r.referrer_bonus_paid_at as string;
    const led = ledgerByReferee.get(r.id);
    if (led) {
      return { ...base, paid: true, paidAt: led.at ?? paidAt, amount: led.amount, rate: led.amount, source: "ledger", pendingReason: null };
    }
    const paidMs = new Date(paidAt).getTime();
    const ev = auditEvents.find((e) => Math.abs(e.at - paidMs) < 180000);
    if (ev) {
      const fitted = fitRate(ev.delta);
      const perHead = fitted ?? ev.delta;
      return { ...base, paid: true, paidAt, amount: perHead, rate: perHead, source: "audit", pendingReason: null };
    }
    return {
      ...base,
      paid: true,
      paidAt,
      amount: rates.referrer_bonus,
      rate: rates.referrer_bonus,
      source: "approx",
      pendingReason: null,
    };
  });

  rows.sort((a, b) => new Date(b.paidAt ?? b.joinedAt).getTime() - new Date(a.paidAt ?? a.joinedAt).getTime());

  const paidRows = rows.filter((r) => r.paid);
  return {
    currentRate: rates.referrer_bonus,
    rows,
    totals: {
      referees: rows.length,
      paidCount: paidRows.length,
      paidAmount: Number(paidRows.reduce((s, r) => s + r.amount, 0).toFixed(2)),
      pendingCount: rows.length - paidRows.length,
      monthlyCommission: Number(rows.reduce((s, r) => s + r.monthlyCommission, 0).toFixed(2)),
      commissionAccrued: Number(Number((myMsRes?.data as any)?.referral_accrued ?? 0).toFixed(2)),
      commissionClaimed: 0,
    },
  };
}

/** not-whitelist → re-verify চক্রের হিসাব (কতবার আবার re-verify হয়েছে)। */
export type ReverifyStats = {
  firstVerifies: number;
  slotsEverReverified: number;
  totalReverifies: number;
  cycleDone: number;
  cyclePending: number;
  perSlot: { slot: number; label: string | null; count: number; whitelistOk: boolean; lastAt: string | null }[];
};

export function buildReverifyStats(tasks: any[]): ReverifyStats {
  const rows = (tasks ?? []).filter((t) => t.status !== "empty");
  const perSlot = rows
    .map((t) => ({
      slot: Number(t.slot),
      label: t.face_label ?? null,
      count: Number(t.reverify_count ?? 0),
      whitelistOk: t.whitelist_ok !== false,
      lastAt: t.last_reverified_at ?? t.done_at ?? null,
    }))
    .sort((a, b) => a.slot - b.slot);

  return {
    firstVerifies: rows.filter((t) => !!t.initial_verify_at).length,
    slotsEverReverified: perSlot.filter((s) => s.count > 0).length,
    totalReverifies: perSlot.reduce((s, r) => s + r.count, 0),
    // whitelist হারানোর পর আবার re-verify হয়ে গেছে যেগুলো
    cycleDone: perSlot.filter((s) => s.count > 0 && s.whitelistOk).length,
    // এখন whitelist নেই — এই ঘরগুলো আবার re-verify চাচ্ছে
    cyclePending: perSlot.filter((s) => !s.whitelistOk).length,
  };
}
