// Shared constants for the 10-task mining app.

// Monthly target: 500 BDT per 30 days when mining is active.
export const MINING_RATE_BDT_PER_SEC = 500 / (30 * 24 * 60 * 60);

// Re-verify becomes available roughly 5 days after the initial face verify
// (or immediately if the wallet loses whitelist). The countdown is a guide —
// whitelist-off jumps the slot straight to "ready" regardless of the timer.
export const REVERIFY_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;

export const TOTAL_TASKS = 10;

export const MIN_WITHDRAW_BDT = 50;

export type WalletProvider = "bkash" | "nagad";
export type TaskStatus = "empty" | "verified" | "done";
export type WithdrawalStatus = "pending" | "paid" | "rejected";
