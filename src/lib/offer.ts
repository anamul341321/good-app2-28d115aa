/**
 * ১০ দিনের সীমিত অফার — যারা আগে রি-ভেরিফাই করেছিলেন, তারা এই সময়ের মধ্যে
 * আবার রি-ভেরিফাই করলে প্রতি ঘরে ১০৳ (মেইন ব্যালেন্স) + ওই ঘরের লক করা
 * মাইনিং টাকা আনলক পাবেন।
 */
export const OFFER_END_AT = "2026-08-28T17:59:00.000Z";
export const OFFER_PER_SLOT_BONUS = 10;

export function offerTimeLeft(now: number = Date.now()) {
  const total = Math.max(0, new Date(OFFER_END_AT).getTime() - now);
  const days = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  return { total, days, hours, minutes, seconds, active: total > 0 };
}

const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBn(n: number, pad = 2) {
  return String(n)
    .padStart(pad, "0")
    .split("")
    .map((c) => bn[Number(c)] ?? c)
    .join("");
}
