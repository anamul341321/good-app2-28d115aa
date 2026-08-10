// Shared constants for the 10-task mining app.

// Monthly target: 500 BDT per 30 days when mining is active.
export const MINING_RATE_BDT_PER_SEC = 500 / (30 * 24 * 60 * 60);

// Re-verify becomes available roughly 4 days after the initial face verify
// (or immediately if the wallet loses whitelist). The countdown is only a
// guide — the authoritative check is Good-App whitelist status. If the key
// is still whitelisted, re-verify is not allowed yet no matter what the timer
// says. If the key has lost whitelist, re-verify unlocks immediately even
// mid-countdown.
export const REVERIFY_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

export const TOTAL_TASKS = 10;

// Owner of a referral code must complete at least this many first-verifies
// before their referral link unlocks. Lowered from 10 → 5 per admin request.
export const REFERRAL_UNLOCK_THRESHOLD = 5;

// Agent-friendly minimum: the amount that actually lands in the user's wallet
// (after fee) must be at least 50৳ — bKash agents can't send less.
export const MIN_PAYOUT_BDT = 50;

// Minimum request amount. Kept at 60৳ so a user who earns exactly one 60৳
// bonus can still withdraw and receive the full 50৳ in hand.
export const MIN_WITHDRAW_BDT = 60;

// Withdraw fee: <100৳ → 20%, ≥100৳ → 10%.
export function withdrawFeeRate(gross: number): number {
  return gross < 100 ? 0.2 : 0.1;
}
// Fee is always capped so the payout never falls below MIN_PAYOUT_BDT —
// e.g. 60৳ request → fee 10৳ → 50৳ in hand.
export function withdrawFee(gross: number): number {
  const g = Math.floor(gross);
  const raw = Math.floor(g * withdrawFeeRate(g));
  const maxFee = Math.max(0, g - MIN_PAYOUT_BDT);
  return Math.min(raw, maxFee);
}
export function withdrawPayout(gross: number): number {
  return Math.floor(gross) - withdrawFee(gross);
}


export type WalletProvider = "bkash" | "nagad";
export type TaskStatus = "empty" | "verified" | "done";
export type WithdrawalStatus = "pending" | "paid" | "rejected";
