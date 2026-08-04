import { MINING_RATE_BDT_PER_SEC, TOTAL_TASKS } from "./constants";

// Live computed mining balance.
// Effective rate = base_rate * (effective_task_count / TOTAL_TASKS)
//                + base_rate * 0.10 * qualifying_referees
export function computeLiveBalance(input: {
  accrued: number;
  withdrawn: number;
  isActive: boolean;
  lastCreditedAt: string | null;
  effectiveTaskCount?: number;
  qualifyingReferees?: number;
  selfQualified?: boolean;
  debt?: number;
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  let total = input.accrued;
  // Self mining only counts when the user themself completed 10 re-verifies.
  const selfOk = input.selfQualified !== false;
  const eff = selfOk ? Math.max(0, input.effectiveTaskCount ?? 0) : 0;
  const refs = Math.max(0, input.qualifyingReferees ?? 0);
  const rate = MINING_RATE_BDT_PER_SEC * (eff / TOTAL_TASKS + 0.10 * refs);

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
