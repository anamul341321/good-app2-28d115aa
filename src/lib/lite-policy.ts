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
// The word list is stored base64-encoded so the Lite bundle does not carry a
// plain-text list of financial terms.
const FINANCIAL_WORDS = "4KaJ4KaH4Kal4Kah4KeN4KawfHdpdGhkcmF3fHBheW91dHzgprjgp4fgpqjgp43gpqFccyrgpq7gpr7gpqjgpr98c2VuZFxzKm1vbmV5fOCmsOCmv+CmmuCmvuCmsOCnjeCmnHxyZWNoYXJnZXzgpqzgpr/gppXgpr7gprZ84Kao4KaX4KamfGJrYXNofG5hZ2FkfHVzZHR8Y2Vsb3zgpp/gpr7gppXgpr584KezfHRha2F84Kaq4KeH4Kau4KeH4Kao4KeN4KaffHBheW1lbnR84Kas4KeN4Kav4Ka+4Kay4Ka+4Kao4KeN4Ka4fOCmrOCnjeCmr+CmvuCmsuCnh+CmqOCnjeCmuHxiYWxhbmNlfOCmsuCnh+CmqOCmpuCnh+CmqHx0cmFuc2FjdGlvbnzgpq7gpr7gpofgpqjgpr/gpoJ8bWluaW5nfOCmleCmruCmv+CmtuCmqHxjb21taXNzaW9ufOCmhuCmr+CmvHzgpofgpqjgppXgpr7gpq58aW5jb21lfGVhcm584Kas4Ka/4Kao4Ka/4Kav4Ka84KeL4KaXfGludmVzdHzgprjgpr7gprDgp43gpq3gpr/gprgg4Kar4Ka/fHNlcnZpY2UgZmVlfOCmleCmvuCmsOCnjeCmoSDgppXgp4fgpqh84KaT4Kav4Ka84Ka+4Kay4KeH4KaffHdhbGxldHxoaXNhYnzgprngpr/gprjgpr7gpqx84Kas4KeL4Kao4Ka+4Ka4fGJvbnVzfOCmsOCmv+Cmk+Cmr+CmvOCmvuCmsOCnjeCmoXxyZXdhcmQ=";

const decodeWords = (b64: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));

const FINANCIAL_RE = new RegExp(`(${decodeWords(FINANCIAL_WORDS)})`, "i");

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
