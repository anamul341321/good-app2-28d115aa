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

// Minimum request amount. 63৳ so a user who earns exactly one 63৳ bonus can
// withdraw: 63৳ − 20% (12.6৳) = 50.4৳ → 50৳ in hand, 0.4৳ stays in balance.
export const MIN_WITHDRAW_BDT = 63;

// Percentage withdraw fee: 20% below 100৳, 10% for 100৳ and above.
export const WITHDRAW_FEE_RATE_SMALL = 0.2;
export const WITHDRAW_FEE_RATE_LARGE = 0.1;
export const WITHDRAW_FEE_THRESHOLD_BDT = 100;

// Fee keeps its paisa (not rounded up) so the leftover paisa can stay in the
// user's main balance instead of being eaten by rounding.
export function withdrawFee(gross: number): number {
  const g = Math.floor(gross);
  if (g <= 0) return 0;
  const rate = g < WITHDRAW_FEE_THRESHOLD_BDT ? WITHDRAW_FEE_RATE_SMALL : WITHDRAW_FEE_RATE_LARGE;
  const raw = Math.round(g * rate * 100) / 100;
  // Never let the in-hand amount drop below the agent minimum.
  return Math.min(raw, Math.max(0, g - MIN_PAYOUT_BDT));
}
// Effective percentage — only used for display.
export function withdrawFeeRate(gross: number): number {
  const g = Math.floor(gross);
  return g > 0 ? withdrawFee(g) / g : 0;
}

// Whole taka the user actually receives (paisa is never sent out).
export function withdrawPayout(gross: number): number {
  return Math.floor(Math.floor(gross) - withdrawFee(gross));
}

// Amount actually debited from the balance = payout + fee. Any leftover paisa
// stays in the user's main balance.
export function withdrawDebit(gross: number): number {
  return Math.round((withdrawPayout(gross) + withdrawFee(gross)) * 100) / 100;
}




export type WalletProvider = "bkash" | "nagad";
export type TaskStatus = "empty" | "verified" | "done";
export type WithdrawalStatus = "pending" | "paid" | "rejected";
