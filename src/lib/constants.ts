// Shared constants for the 10-task mining app.

// Monthly target: 500 BDT per 30 days when mining is active.
export const MINING_RATE_BDT_PER_SEC = 500 / (30 * 24 * 60 * 60);

// Re-verify becomes available roughly 4 days after the initial face verify
// (or immediately if the wallet loses whitelist). The countdown is only a
// guide — the authoritative check is GoodDollar whitelist status. If the key
// is still whitelisted, re-verify is not allowed yet no matter what the timer
// says. If the key has lost whitelist, re-verify unlocks immediately even
// mid-countdown.
export const REVERIFY_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

export const TOTAL_TASKS = 10;

export const MIN_WITHDRAW_BDT = 50;

export type WalletProvider = "bkash" | "nagad";
export type TaskStatus = "empty" | "verified" | "done";
export type WithdrawalStatus = "pending" | "paid" | "rejected";
