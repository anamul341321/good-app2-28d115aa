import { MINING_RATE_BDT_PER_SEC, TOTAL_TASKS } from "./constants";

// Per-slot mining rate: every re-verified slot mines 500৳/10 = 50৳ per month.
// First 10 slots are mandatory to start mining; every extra re-verified slot
// adds its own 50৳/month on top (11 slots → 550৳, 12 → 600৳ …).
export const MONTHLY_PER_SLOT = 50;
export const RATE_PER_SLOT_SEC = MINING_RATE_BDT_PER_SEC / TOTAL_TASKS;

// Referrer earns 10% of whatever the referee earns → 5৳/month per referee slot,
// i.e. 0.1 slot-unit per referee slot.
export const REFERRAL_SHARE = 0.1;

export function miningUnits(input: {
  selfSlots?: number;
  referralUnits?: number;
  effectiveTaskCount?: number;
  qualifyingReferees?: number;
  selfQualified?: boolean;
}): { selfUnits: number; refUnits: number } {
  const selfOk = input.selfQualified !== false;
  const rawSelf = input.selfSlots ?? input.effectiveTaskCount ?? 0;
  const selfUnits = selfOk ? Math.max(0, rawSelf) : 0;
  const refUnits = Math.max(0, input.referralUnits ?? input.qualifyingReferees ?? 0);
  return { selfUnits, refUnits };
}

export function monthlyRate(input: Parameters<typeof miningUnits>[0]): number {
  const { selfUnits, refUnits } = miningUnits(input);
  return MONTHLY_PER_SLOT * (selfUnits + refUnits);
}

// Live computed mining balance.
export function computeLiveBalance(input: {
  accrued: number;
  withdrawn: number;
  isActive: boolean;
  lastCreditedAt: string | null;
  selfSlots?: number;
  referralUnits?: number;
  effectiveTaskCount?: number;
  qualifyingReferees?: number;
  selfQualified?: boolean;
  debt?: number;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  let total = input.accrued;
  const { selfUnits, refUnits } = miningUnits(input);
  const rate = RATE_PER_SLOT_SEC * (selfUnits + refUnits);

  if (input.isActive && input.lastCreditedAt && rate > 0) {
    const last = new Date(input.lastCreditedAt).getTime();
    const elapsedSec = Math.max(0, (now - last) / 1000);
    total += elapsedSec * rate;
  }
  const debt = Math.max(0, input.debt ?? 0);
  const net = total - input.withdrawn - debt;
  // Allow negative when a debt is applied so user sees they owe money.
  return debt > 0 ? net : Math.max(0, net);
}

export function formatBdt(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}

/**
 * "Main balance" = the part of the balance that can be withdrawn/sent at any
 * time (welcome bonus, re-verify bonus, referral bonus, gifts, transfers-in).
 * Mining balance is only withdrawable during the monthly window.
 *
 * Every withdrawal is split between the two pools at request time, and the
 * mining part is stored in `mining_state.mining_withdrawn`. So:
 *   main    = bonusTotal − (totalWithdrawn − miningWithdrawn)
 *   mining  = balance − main
 */
export function splitBalance(input: {
  balance: number;
  bonusTotal: number;
  withdrawn?: number;
  miningWithdrawn?: number;
  balanceBreakdown?: {
    bonus_part?: number;
    mining_part?: number;
  };
}): { main: number; mining: number } {
  // If we have an audited breakdown from the ledger, use it directly.
  if (input.balanceBreakdown) {
    return {
      main: Math.max(0, input.balanceBreakdown.bonus_part ?? 0),
      mining: Math.max(0, input.balanceBreakdown.mining_part ?? 0),
    };
  }

  const balance = Math.max(0, input.balance);
  const bonusTotal = Math.max(0, input.bonusTotal);
  const withdrawn = Math.max(0, input.withdrawn ?? 0);
  const miningWithdrawn = Math.max(0, Math.min(input.miningWithdrawn ?? 0, withdrawn));
  const mainWithdrawn = Math.max(0, withdrawn - miningWithdrawn);
  const main = Math.max(0, Math.min(balance, bonusTotal - mainWithdrawn));
  return { main, mining: Math.max(0, balance - main) };
}

