import { awardCoinEvent, claimWatchCoins } from "@/lib/coins.functions";

export const COIN_RATES = {
  reel: 12,
  post: 10,
  story: 4,
  comment: 1,
  message: 1,
} as const;

export type CoinEvent = keyof typeof COIN_RATES;

/** Fire-and-forget coin award — never blocks or breaks the calling flow. */
export async function awardCoins(event: CoinEvent, referenceId?: string): Promise<number> {
  try {
    const res = await awardCoinEvent({ data: { event, referenceId } });
    return res?.awarded ?? 0;
  } catch {
    return 0;
  }
}

export async function claimWatchSeconds(seconds: number): Promise<number> {
  try {
    const res = await claimWatchCoins({ data: { seconds: Math.min(600, Math.max(0, Math.floor(seconds))) } });
    return res?.awarded ?? 0;
  } catch {
    return 0;
  }
}

/* ---------------- watch-time tracker ---------------- */

let lastTick = 0;

/** Called by playing video elements (onTimeUpdate) to signal active watching. */
export function markWatching() {
  lastTick = Date.now();
}

/** True when a video reported progress within the last 1.6s (i.e. it is really playing). */
export function isWatching() {
  return Date.now() - lastTick < 1600;
}

export function formatCoins(value: number | undefined | null) {
  const n = Number(value ?? 0);
  if (n >= 1000) return n.toLocaleString("en-US");
  return String(Math.round(n));
}
