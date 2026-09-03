/**
 * দেশ/রিজিয়ন কনফিগ — একাউন্ট খোলার সময় ইউজার দেশ সিলেক্ট করে,
 * তারপর সেই দেশের ভাষা + মুদ্রা + ফোন নিয়ম অ্যাপজুড়ে ব্যবহার হয়।
 */

export type Lang = "bn" | "en" | "hi" | "ur" | "ne" | "ar" | "ms";

export type Region = {
  code: string;          // ISO country code (BD, IN, ...)
  flag: string;          // emoji flag
  nameLocal: string;     // দেশের নাম নিজের ভাষায়
  nameEn: string;        // English name
  dial: string;          // dial code without +
  lang: Lang;            // ডিফল্ট ভাষা (বাংলাদেশ ছাড়া সব দেশে English)
  currency: string;      // ISO currency
  symbol: string;        // মুদ্রার চিহ্ন
  /** ১ USD = কত স্থানীয় মুদ্রা (approx, শুধু দেখানোর জন্য) */
  perUsd: number;
  /** স্থানীয় ফরম্যাটে মোবাইল নম্বরের ডিজিট সংখ্যা (leading 0 সহ) */
  phoneDigits: number[];
  /** স্থানীয় নম্বর অবশ্যই এই প্রিফিক্স দিয়ে শুরু হবে (ফাঁকা = যেকোনো) */
  phonePrefix?: string;
  rtl?: boolean;
};

export const REGIONS: Region[] = [
  { code: "BD", flag: "🇧🇩", nameLocal: "বাংলাদেশ", nameEn: "Bangladesh", dial: "880", lang: "bn", currency: "BDT", symbol: "৳", perUsd: 120, phoneDigits: [11], phonePrefix: "01" },
  { code: "IN", flag: "🇮🇳", nameLocal: "भारत", nameEn: "India", dial: "91", lang: "en", currency: "INR", symbol: "₹", perUsd: 88, phoneDigits: [10] },
  { code: "PK", flag: "🇵🇰", nameLocal: "پاکستان", nameEn: "Pakistan", dial: "92", lang: "en", currency: "PKR", symbol: "₨", perUsd: 280, phoneDigits: [10, 11] },
  { code: "NP", flag: "🇳🇵", nameLocal: "नेपाल", nameEn: "Nepal", dial: "977", lang: "en", currency: "NPR", symbol: "रू", perUsd: 140, phoneDigits: [10] },
  { code: "MY", flag: "🇲🇾", nameLocal: "Malaysia", nameEn: "Malaysia", dial: "60", lang: "en", currency: "MYR", symbol: "RM", perUsd: 4.3, phoneDigits: [9, 10, 11] },
  { code: "SA", flag: "🇸🇦", nameLocal: "السعودية", nameEn: "Saudi Arabia", dial: "966", lang: "en", currency: "SAR", symbol: "﷼", perUsd: 3.75, phoneDigits: [9, 10] },
  { code: "AE", flag: "🇦🇪", nameLocal: "الإمارات", nameEn: "UAE", dial: "971", lang: "en", currency: "AED", symbol: "د.إ", perUsd: 3.67, phoneDigits: [9, 10] },
  { code: "QA", flag: "🇶🇦", nameLocal: "قطر", nameEn: "Qatar", dial: "974", lang: "en", currency: "QAR", symbol: "﷼", perUsd: 3.64, phoneDigits: [8, 9] },
  { code: "KW", flag: "🇰🇼", nameLocal: "الكويت", nameEn: "Kuwait", dial: "965", lang: "en", currency: "KWD", symbol: "د.ك", perUsd: 0.31, phoneDigits: [8, 9] },
  { code: "US", flag: "🇺🇸", nameLocal: "United States", nameEn: "United States", dial: "1", lang: "en", currency: "USD", symbol: "$", perUsd: 1, phoneDigits: [10] },
  { code: "CA", flag: "🇨🇦", nameLocal: "Canada", nameEn: "Canada", dial: "1", lang: "en", currency: "CAD", symbol: "$", perUsd: 1.36, phoneDigits: [10] },
  { code: "GB", flag: "🇬🇧", nameLocal: "United Kingdom", nameEn: "United Kingdom", dial: "44", lang: "en", currency: "GBP", symbol: "£", perUsd: 0.78, phoneDigits: [10, 11] },
  { code: "IE", flag: "🇮🇪", nameLocal: "Ireland", nameEn: "Ireland", dial: "353", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "AU", flag: "🇦🇺", nameLocal: "Australia", nameEn: "Australia", dial: "61", lang: "en", currency: "AUD", symbol: "$", perUsd: 1.5, phoneDigits: [9, 10] },
  { code: "NZ", flag: "🇳🇿", nameLocal: "New Zealand", nameEn: "New Zealand", dial: "64", lang: "en", currency: "NZD", symbol: "$", perUsd: 1.65, phoneDigits: [8, 9, 10] },
  { code: "DE", flag: "🇩🇪", nameLocal: "Deutschland", nameEn: "Germany", dial: "49", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [10, 11] },
  { code: "FR", flag: "🇫🇷", nameLocal: "France", nameEn: "France", dial: "33", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "IT", flag: "🇮🇹", nameLocal: "Italia", nameEn: "Italy", dial: "39", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "ES", flag: "🇪🇸", nameLocal: "España", nameEn: "Spain", dial: "34", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9] },
  { code: "NL", flag: "🇳🇱", nameLocal: "Nederland", nameEn: "Netherlands", dial: "31", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "BE", flag: "🇧🇪", nameLocal: "Belgique", nameEn: "Belgium", dial: "32", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "SE", flag: "🇸🇪", nameLocal: "Sverige", nameEn: "Sweden", dial: "46", lang: "en", currency: "SEK", symbol: "kr", perUsd: 10.5, phoneDigits: [9, 10] },
  { code: "NO", flag: "🇳🇴", nameLocal: "Norge", nameEn: "Norway", dial: "47", lang: "en", currency: "NOK", symbol: "kr", perUsd: 10.7, phoneDigits: [8] },
  { code: "DK", flag: "🇩🇰", nameLocal: "Danmark", nameEn: "Denmark", dial: "45", lang: "en", currency: "DKK", symbol: "kr", perUsd: 6.9, phoneDigits: [8] },
  { code: "FI", flag: "🇫🇮", nameLocal: "Suomi", nameEn: "Finland", dial: "358", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [9, 10] },
  { code: "CH", flag: "🇨🇭", nameLocal: "Schweiz", nameEn: "Switzerland", dial: "41", lang: "en", currency: "CHF", symbol: "Fr", perUsd: 0.88, phoneDigits: [9, 10] },
  { code: "AT", flag: "🇦🇹", nameLocal: "Österreich", nameEn: "Austria", dial: "43", lang: "en", currency: "EUR", symbol: "€", perUsd: 0.92, phoneDigits: [10, 11] },
  { code: "JP", flag: "🇯🇵", nameLocal: "日本", nameEn: "Japan", dial: "81", lang: "en", currency: "JPY", symbol: "¥", perUsd: 150, phoneDigits: [10, 11] },
  { code: "KR", flag: "🇰🇷", nameLocal: "대한민국", nameEn: "South Korea", dial: "82", lang: "en", currency: "KRW", symbol: "₩", perUsd: 1350, phoneDigits: [10, 11] },
  { code: "SG", flag: "🇸🇬", nameLocal: "Singapore", nameEn: "Singapore", dial: "65", lang: "en", currency: "SGD", symbol: "$", perUsd: 1.34, phoneDigits: [8] },
  { code: "HK", flag: "🇭🇰", nameLocal: "香港", nameEn: "Hong Kong", dial: "852", lang: "en", currency: "HKD", symbol: "$", perUsd: 7.8, phoneDigits: [8] },
  { code: "OTHER", flag: "🌐", nameLocal: "Other country", nameEn: "Other country", dial: "", lang: "en", currency: "USD", symbol: "$", perUsd: 1, phoneDigits: [7, 8, 9, 10, 11, 12, 13, 14, 15] },
];


export const DEFAULT_REGION = "BD";

export function getRegion(code?: string | null): Region {
  const found = REGIONS.find((r) => r.code === (code || "").toUpperCase());
  return found ?? REGIONS[0];
}

/** স্থানীয় নম্বর যাচাই — ভুল হলে বার্তা ফেরত দেয়, ঠিক হলে null */
export function validatePhoneForRegion(code: string, digits: string): string | null {
  const region = getRegion(code);
  const clean = digits.replace(/\D/g, "");
  if (region.phonePrefix && !clean.startsWith(region.phonePrefix)) {
    return `Number must start with ${region.phonePrefix}`;
  }
  if (!region.phoneDigits.includes(clean.length)) {
    return `Number must be ${region.phoneDigits.join("/")} digits`;
  }
  return null;
}

export function maxPhoneLength(code: string): number {
  return Math.max(...getRegion(code).phoneDigits);
}

/** ইউজারের ব্রাউজার/টাইমজোন থেকে দেশ অনুমান (শুধু ডিফল্ট সাজেশনের জন্য) */
export function guessRegionCode(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const tzMap: Record<string, string> = {
      "Asia/Dhaka": "BD",
      "Asia/Kolkata": "IN",
      "Asia/Calcutta": "IN",
      "Asia/Karachi": "PK",
      "Asia/Kathmandu": "NP",
      "Asia/Kuala_Lumpur": "MY",
      "Asia/Riyadh": "SA",
      "Asia/Dubai": "AE",
    };
    if (tzMap[tz]) return tzMap[tz];
    const loc = (navigator.language || "").toUpperCase();
    const suffix = loc.split("-")[1];
    if (suffix && REGIONS.some((r) => r.code === suffix)) return suffix;
    if (loc.startsWith("BN")) return "BD";
  } catch {}
  return DEFAULT_REGION;
}
