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
  now?: number;
}): number {
  const now = input.now ?? Date.now();
  let total = input.accrued;
  const eff = Math.max(0, input.effectiveTaskCount ?? 0);
  const refs = Math.max(0, input.qualifyingReferees ?? 0);
  const rate = MINING_RATE_BDT_PER_SEC * (eff / TOTAL_TASKS + 0.10 * refs);
  if (input.isActive && input.lastCreditedAt && rate > 0) {
    const last = new Date(input.lastCreditedAt).getTime();
    const elapsedSec = Math.max(0, (now - last) / 1000);
    total += elapsedSec * rate;
  }
  return Math.max(0, total - input.withdrawn);
}

export function formatBdt(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}
