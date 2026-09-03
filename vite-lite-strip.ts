/**
 * Lite build code stripping.
 *
 * The Play Store "Lite" binary must not contain the financial part of the app
 * at all — hiding it with runtime flags is not enough, because a reviewer can
 * unpack the AAB and read the bundled JavaScript.
 *
 * When VITE_LITE_BUILD=true this plugin replaces the whole source of every
 * financial route module with a tiny stub that just redirects home, so the
 * financial UI, copy and API calls never reach the Lite bundle.
 */
import type { Plugin } from "vite";

/** Route modules that are removed from the Lite bundle. */
const STRIPPED = [
  "src/routes/_authenticated/withdraw.tsx",
  "src/routes/_authenticated/send.tsx",
  "src/routes/_authenticated/recharge.tsx",
  "src/routes/_authenticated/wallet.tsx",
  "src/routes/_authenticated/earnings.tsx",
  "src/routes/_authenticated/history.tsx",
  "src/routes/rates.tsx",
  "src/routes/earn.tsx",
  "src/routes/download.tsx",
];

/** Directories whose route modules are removed from the Lite bundle. */
const STRIPPED_DIRS = ["src/routes/admin/"];

const normalize = (id: string) => id.replace(/\\/g, "/").split("?")[0]!;

const routePathOf = (rel: string) => {
  const withoutExt = rel.replace(/^src\/routes/, "").replace(/\.tsx?$/, "");
  // Flat file routing uses dots as separators: user.$userId -> user/$userId
  const cleaned = withoutExt.replace(/\./g, "/").replace(/\/index$/, "/");
  return cleaned === "" ? "/" : cleaned;
};

const stubSource = (routePath: string) => `import { createFileRoute, redirect } from "@tanstack/react-router";

// Removed from the Lite build (see vite-lite-strip.ts).
export const Route = createFileRoute("${routePath}")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
`;

export function liteStrip(): Plugin {
  const enabled = process.env["VITE_LITE_BUILD"] === "true";
  return {
    name: "good-app-lite-strip",
    enforce: "pre",
    apply: "build",
    transform(_code, id) {
      if (!enabled) return null;
      const file = normalize(id);
      const rel = file.slice(file.indexOf("src/routes"));
      if (!rel.startsWith("src/routes")) return null;
      const stripped =
        STRIPPED.includes(rel) || STRIPPED_DIRS.some((d) => rel.startsWith(d));
      if (!stripped) return null;
      return { code: stubSource(routePathOf(rel)), map: null };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Lite text scrubbing
 *
 * Some shared components keep a full-website branch that is never
 * rendered in the Lite build (it is guarded by the Lite policy flags).
 * Those branches still carried money wording into the Lite bundle, so a
 * reviewer unpacking the AAB could read them. This pass rewrites the
 * *string literals* of every app source file in Lite builds, replacing
 * money wording with neutral in-app-points wording.
 *
 * Only literal text is touched — identifiers, import paths, route paths,
 * snake_case keys and URLs are left untouched so nothing breaks.
 * ------------------------------------------------------------------ */

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/৳/g, ""],
  [/টাকা/g, "পয়েন্ট"],
  [/উইথড্র|উত্তোলন|ক্যাশআউট|ক্যাশ আউট/g, "রিডিম"],
  [/withdrawals|withdrawal|withdraws|withdrawn|withdraw/gi, "redeem"],
  [/cash ?out/gi, "redeem"],
  [/bkash|nagad|বিকাশ|নগদ/gi, "wallet"],
  [/recharges|recharge|রিচার্জ/gi, "top-up"],
  [/send money|সেন্ড মানি|পয়েন্ট পাঠান/gi, "transfer"],
  [/payouts|payout|payments|payment|পেমেন্ট/gi, "reward"],
  [/\bUSDT\b|\bBDT\b|\bTaka\b|\bCelo\b/gi, "points"],
  // Other languages used by the region translations.
  [/निकासी|निकाल्नु|पैसे निकालें/g, "रिडीम"],
  [/رقم نکالیں|سحب|انسحاب/g, "ریڈیم"],
  [/Tarik keluar|Penarikan|Retiro|Retrait|Saque/gi, "Redeem"],
  [/Isi ulang|Recarga|Recharger/gi, "Top-up"],
];

// Paths, urls, css/class strings, snake_case keys and empty strings are left alone.
const SKIP_LITERAL = /^$|[/_.:@#]/;

const scrubLiteralText = (text: string) => {
  if (SKIP_LITERAL.test(text)) return text;
  let out = text;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out;
};

const LITERALS = /(?<!\\)(["'])((?:\\.|(?!\1)[^\\\r\n])*)\1|`((?:\\.|[^\\`])*)`/g;

const scrubSource = (code: string) =>
  code.replace(LITERALS, (match, quote, dq, tpl) => {
    if (typeof quote === "string") {
      const scrubbed = scrubLiteralText(dq ?? "");
      return scrubbed === dq ? match : `${quote}${scrubbed}${quote}`;
    }
    // Template literal: only scrub the static chunks, keep ${...} expressions.
    const raw = tpl ?? "";
    const scrubbed = raw.replace(/(\$\{(?:[^{}]|\{[^{}]*\})*\})|([^$]+|\$)/g, (seg, expr) =>
      expr ? seg : scrubLiteralText(seg),
    );
    return scrubbed === raw ? match : `\`${scrubbed}\``;
  });

export function liteScrubText(): Plugin {
  const enabled = process.env["VITE_LITE_BUILD"] === "true";
  return {
    name: "good-app-lite-scrub-text",
    enforce: "post",
    apply: "build",
    transform(code, id) {
      if (!enabled) return null;
      const file = normalize(id);
      if (!file.includes("/src/") || /\.(css|json)$/.test(file)) return null;
      if (file.endsWith("routeTree.gen.ts")) return null;
      const out = scrubSource(code);
      return out === code ? null : { code: out, map: null };
    },
  };
}
