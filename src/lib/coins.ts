import { awardCoinEvent, claimWatchCoins, claimTelegramJoin } from "@/lib/coins.functions";

export const TELEGRAM_GROUP_URL = "https://t.me/goodappbuy";

export const COIN_RATES = {
  reel: 500,
  post: 400,
  story: 200,
  comment: 50,
  message: 50,
  watch: 30,
  telegram: 1000,
} as const;

export type CoinEvent = "reel" | "post" | "story" | "comment" | "message";

export async function claimTelegramBonus(): Promise<{ awarded: number; already: boolean }> {
  try {
    const res = await claimTelegramJoin();
    return { awarded: res?.awarded ?? 0, already: !!res?.already };
  } catch {
    return { awarded: 0, already: false };
  }
}


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
