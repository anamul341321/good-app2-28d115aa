/**
 * Signup location verification (anti-VPN).
 *
 * Rule: a non-Bangladesh account can only be created while the user is really
 * inside that country. Bangladesh IPs can never open a foreign-country account,
 * and VPN / proxy / datacenter IPs are rejected for foreign countries.
 */

import { getRequestHeader } from "@tanstack/react-start/server";

export type GeoVerdict = {
  ip: string | null;
  ipCountry: string | null;
  proxy: boolean;
  hosting: boolean;
  looked_up: boolean;
};

const TZ_COUNTRY: Record<string, string> = {
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Karachi": "PK",
  "Asia/Kathmandu": "NP",
  "Asia/Colombo": "LK",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Riyadh": "SA",
  "Asia/Dubai": "AE",
  "Asia/Qatar": "QA",
  "Asia/Kuwait": "KW",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Singapore": "SG",
  "Asia/Hong_Kong": "HK",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Istanbul": "TR",
};

export function clientIp(): string | null {
  const candidates = [
    getRequestHeader("cf-connecting-ip"),
    getRequestHeader("x-real-ip"),
    (getRequestHeader("x-forwarded-for") ?? "").split(",")[0]?.trim(),
  ];
  for (const c of candidates) {
    if (c && c.length > 3 && c !== "unknown") return c;
  }
  return null;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("127.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") ||
    ip === "::1" ||
    ip.startsWith("fc") ||
    ip.startsWith("fd")
  );
}

export async function lookupGeo(): Promise<GeoVerdict> {
  const ip = clientIp();
  const headerCountry = (getRequestHeader("cf-ipcountry") ?? "").toUpperCase();
  const verdict: GeoVerdict = {
    ip,
    ipCountry: headerCountry && headerCountry.length === 2 ? headerCountry : null,
    proxy: false,
    hosting: false,
    looked_up: false,
  };

  if (!ip || isPrivateIp(ip)) return verdict;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,countryCode,proxy,hosting,mobile`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string;
        countryCode?: string;
        proxy?: boolean;
        hosting?: boolean;
      };
      if (json.status === "success") {
        verdict.looked_up = true;
        if (json.countryCode) verdict.ipCountry = json.countryCode.toUpperCase();
        verdict.proxy = !!json.proxy;
        verdict.hosting = !!json.hosting;
      }
    }
  } catch {
    // Network hiccup — verdict stays "not looked up"; caller decides.
  }
  return verdict;
}

/**
 * Gate a signup. Throws a Bengali/English error when the selected country does
 * not match the real location. Returns the evidence to store on the profile.
 */
export async function verifySignupCountry(selected: string): Promise<{
  geo: GeoVerdict;
  geoVerified: boolean;
  vpnFlagged: boolean;
}> {
  const want = (selected || "BD").toUpperCase();
  const geo = await lookupGeo();
  const ipCountry = geo.ipCountry;

  // Bangladesh signups keep working exactly as before.
  if (want === "BD" || want === "OTHER") {
    return {
      geo,
      geoVerified: ipCountry === want,
      vpnFlagged: geo.proxy || geo.hosting,
    };
  }

  if (!ipCountry) {
    throw new Error(
      "আপনার লোকেশন যাচাই করা যাচ্ছে না — VPN/Proxy বন্ধ করে আসল ইন্টারনেট (mobile data / home Wi-Fi) দিয়ে চেষ্টা করুন। | Location could not be verified. Turn off VPN/Proxy and use your real network.",
    );
  }

  if (geo.proxy || geo.hosting) {
    throw new Error(
      "VPN / Proxy / Server IP দিয়ে বিদেশি একাউন্ট খোলা যাবে না। | Foreign accounts cannot be opened over VPN, proxy or datacenter IPs.",
    );
  }

  if (ipCountry === "BD") {
    throw new Error(
      "আপনি বাংলাদেশ থেকে আছেন — বাংলাদেশ থেকে অন্য দেশের একাউন্ট খোলা যাবে না। বাংলাদেশ সিলেক্ট করুন। | You are in Bangladesh; you cannot open another country's account from here.",
    );
  }

  if (ipCountry !== want) {
    throw new Error(
      `আপনার আসল লোকেশন ${ipCountry} — তাই ${want} এর একাউন্ট খোলা যাবে না, ${ipCountry} সিলেক্ট করুন। | Your real location is ${ipCountry}, so a ${want} account is not allowed.`,
    );
  }

  return { geo, geoVerified: true, vpnFlagged: false };
}

/** Device timezone must also match the selected country (extra VPN barrier). */
export function timezoneMatches(selected: string, timezone?: string | null): boolean {
  const want = (selected || "BD").toUpperCase();
  const tz = (timezone ?? "").trim();
  if (!tz) return false;
  const mapped = TZ_COUNTRY[tz];
  if (!mapped) return true; // unknown timezone → don't hard-block
  return mapped === want;
}
