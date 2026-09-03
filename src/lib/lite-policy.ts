import { isLiteBuild } from "./lite-build";

/**
 * Play Store Lite build text safety.
 *
 * The Play APK must not describe money, payouts, withdrawals, mobile recharge
 * or any financial service — those features live only on the website build.
 * These helpers strip such lines from the shared public policy pages so the
 * Lite build's privacy policy / terms / data-safety text stays consistent with
 * the features the Lite app actually ships.
 */
const FINANCIAL_RE =
  /(উইথড্র|withdraw|payout|সেন্ড\s*মানি|send\s*money|রিচার্জ|recharge|বিকাশ|নগদ|bkash|nagad|usdt|celo|টাকা|৳|taka|পেমেন্ট|payment|ব্যালান্স|ব্যালেন্স|balance|লেনদেন|transaction|মাইনিং|mining|কমিশন|commission|আয়|ইনকাম|income|earn|বিনিয়োগ|invest|সার্ভিস ফি|service fee|কার্ড কেন|ওয়ালেট|wallet|hisab|হিসাব)/i;

export const isFinancialText = (text: string): boolean => FINANCIAL_RE.test(text);

/** In the Lite build, drop any bullet point that talks about money. */
export const litePoints = (points: string[]): string[] =>
  isLiteBuild() ? points.filter((p) => !FINANCIAL_RE.test(p)) : points;

/** In the Lite build, drop money-related sections and money-related bullets. */
export function litePolicySections<T extends { title: string; points: string[] }>(
  sections: T[],
): T[] {
  if (!isLiteBuild()) return sections;
  return sections
    .map((s) => ({ ...s, points: s.points.filter((p) => !FINANCIAL_RE.test(p)) }))
    .filter((s) => !FINANCIAL_RE.test(s.title) && s.points.length > 0);
}

/** Pick Lite-safe copy when building the Play Store version. */
export const liteText = <T,>(full: T, lite: T): T => (isLiteBuild() ? lite : full);
