/**
 * মুদ্রা দেখানোর নিয়ম:
 *  - বাংলাদেশ  → সব কিছু টাকায় (৳)
 *  - অন্য দেশ  → USDT + তার নিজের দেশের মুদ্রায় approx (auto calculation)
 *
 * ভিতরে সব হিসাব সবসময় BDT-তেই থাকে (ডাটাবেজ BDT), শুধু দেখানোর সময় রূপান্তর হয়।
 */

import { getRegion } from "./regions";

/** ১ USDT ≈ কত টাকা (payout rate) */
export const USDT_BDT_RATE = 130;

export function bdtToUsdt(bdt: number, rate = USDT_BDT_RATE): number {
  if (!rate) return 0;
  return bdt / rate;
}

function fmt(n: number): string {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 0 : abs >= 10 ? 1 : 2;
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export type MoneyView = {
  /** প্রধান লেখা — BD হলে "৳500", নাহলে "3.85 USDT" */
  main: string;
  /** পাশে ছোট করে দেখানোর জন্য approx লোকাল মুদ্রা (BD হলে null) */
  local: string | null;
  currency: string;
};

export function money(bdt: number, countryCode: string, rate = USDT_BDT_RATE): MoneyView {
  const region = getRegion(countryCode);
  const amount = Number.isFinite(bdt) ? bdt : 0;
  if (region.code === "BD") {
    return { main: `৳${fmt(amount)}`, local: null, currency: "BDT" };
  }
  const usdt = bdtToUsdt(amount, rate);
  const localAmount = usdt * region.perUsd;
  const local =
    region.currency === "USD" ? null : `≈ ${region.symbol}${fmt(localAmount)} ${region.currency}`;
  return { main: `${fmt(usdt)} USDT`, local, currency: "USDT" };
}

/** এক লাইনে পুরো লেখা */
export function moneyText(bdt: number, countryCode: string, rate = USDT_BDT_RATE): string {
  const v = money(bdt, countryCode, rate);
  return v.local ? `${v.main} (${v.local})` : v.main;
}
