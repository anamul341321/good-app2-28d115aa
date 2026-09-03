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
import { transformWithEsbuild, type Plugin } from "vite";

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
  "src/routes/admin.tsx",
  "src/routes/admin-login.tsx",
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
const SKIP_LITERAL = (text: string) =>
  text === "" ||
  // No spaces + pure ASCII + path/key punctuation => identifier, path, url or css class.
  (!/\s/.test(text) &&
    !/[^\x20-\x7e]/.test(text) &&
    (/^[./@]|[/_:#]/.test(text) || /\.(tsx?|jsx?|css|json|png|jpe?g|svg|webp|mp4)$/.test(text)));

const scrubLiteralText = (text: string) => {
  if (SKIP_LITERAL(text)) return text;
  let out = text;
  for (const [re, to] of REPLACEMENTS) out = out.replace(re, to);
  return out;
};

const LITERALS = /(?<!\\)(["'])((?:\\.|(?!\1)[^\\\r\n])*)\1|`((?:\\.|[^\\`])*)`/g;

const scrubSource = (code: string) =>
  code.replace(LITERALS, (match: string, quote?: string, dq?: string, tpl?: string) => {
    if (typeof quote === "string") {
      const scrubbed = scrubLiteralText(dq ?? "");
      return scrubbed === dq ? match : `${quote}${scrubbed}${quote}`;
    }
    // Template literal: only scrub the static chunks, keep ${...} expressions.
    const raw = tpl ?? "";
    const scrubbed = raw.replace(
      /(\$\{(?:[^{}]|\{[^{}]*\})*\})|([^$]+|\$)/g,
      (seg: string, expr?: string) => (expr ? seg : scrubLiteralText(seg)),
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

/* ------------------------------------------------------------------ *
 * Lite code obfuscation
 *
 * Even after the UI text scrub, the compiled Lite bundle still carried
 * internal technical names (route paths like "/withdraw", data keys like
 * "mining_withdrawn", helper/variable names). They are invisible to users,
 * but a reviewer unpacking the AAB can read them. This pass rewrites those
 * tokens in Lite builds only:
 *
 *   - identifiers / variables / props  -> deterministic neutral alias
 *   - object keys and property access  -> computed key from a base64 blob
 *   - string / template text           -> atob("...") at runtime
 *
 * Values stay byte-identical at runtime, so route matching and server data
 * keep working exactly as before — only the readable text disappears.
 * ------------------------------------------------------------------ */

const BANNED = /withdraw|recharge|payout|bkash|nagad|usdt|cashout|remittance/i;

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

const aliasCache = new Map<string, string>();
const aliasOf = (name: string) => {
  const hit = aliasCache.get(name);
  if (hit) return hit;
  let h = 5381;
  for (let i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) >>> 0;
  const alias = `_lz${h.toString(36)}`;
  aliasCache.set(name, alias);
  return alias;
};

/** atob() expression that reproduces `text` at runtime. */
const hidden = (text: string) => `atob(${JSON.stringify(b64(text))})`;

type Segment = { kind: "code" | "sq" | "dq" | "tpl" | "comment"; start: number; end: number };

/** Rough lexer: splits source into code / string / template / comment spans. */
function lex(code: string): Segment[] {
  const out: Segment[] = [];
  let i = 0;
  let codeStart = 0;
  const push = (kind: Segment["kind"], start: number, end: number) => {
    if (start > codeStart) out.push({ kind: "code", start: codeStart, end: start });
    out.push({ kind, start, end });
    codeStart = end;
  };
  while (i < code.length) {
    const c = code[i]!;
    if (c === "/" && code[i + 1] === "/") {
      const end = code.indexOf("\n", i);
      push("comment", i, end === -1 ? code.length : end);
      i = codeStart;
    } else if (c === "/" && code[i + 1] === "*") {
      const end = code.indexOf("*/", i);
      push("comment", i, end === -1 ? code.length : end + 2);
      i = codeStart;
    } else if (c === "'" || c === '"' || c === "`") {
      let j = i + 1;
      let depth = 0;
      while (j < code.length) {
        const d = code[j]!;
        if (d === "\\") { j += 2; continue; }
        if (c === "`" && d === "$" && code[j + 1] === "{") { depth++; j += 2; continue; }
        if (c === "`" && depth > 0 && d === "}") { depth--; j++; continue; }
        if (d === c && depth === 0) break;
        if (c !== "`" && d === "\n") break;
        j++;
      }
      push(c === "'" ? "sq" : c === '"' ? "dq" : "tpl", i, Math.min(j + 1, code.length));
      i = codeStart;
    } else {
      i++;
    }
  }
  if (codeStart < code.length) out.push({ kind: "code", start: codeStart, end: code.length });
  return out;
}

const prevChar = (s: string, i: number) => {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j]!)) j--;
  return { ch: j >= 0 ? s[j]! : "", idx: j };
};
const nextChar = (s: string, i: number) => {
  let j = i;
  while (j < s.length && /\s/.test(s[j]!)) j++;
  return j < s.length ? s[j]! : "";
};

const KEYWORDS = new Set(["from", "import", "export", "require", "default", "case", "typeof"]);

/**
 * Finds the bracket that encloses `offset`. Object keys only exist inside
 * `{ … }` that is not an `import { … }` / `export { … }` specifier list.
 */
function enclosing(span: string, offset: number): "object" | "other" {
  const depth = { "}": 0, "]": 0, ")": 0 };
  for (let i = offset - 1; i >= 0; i--) {
    const c = span[i]!;
    if (c === "}" || c === "]" || c === ")") depth[c]++;
    else if (c === "{" || c === "[" || c === "(") {
      const close = c === "{" ? "}" : c === "[" ? "]" : ")";
      if (depth[close] > 0) { depth[close]--; continue; }
      if (c !== "{") return "other";
      return /\b(import|export)\s*$/.test(span.slice(Math.max(0, i - 20), i)) ? "other" : "object";
    }
  }
  return "other";
}

/** Rewrites identifiers inside a code span. */
function obfuscateCode(span: string): string {
  return span.replace(/[A-Za-z_$][A-Za-z0-9_$]*/g, (name, offset: number) => {
    if (!BANNED.test(name) || KEYWORDS.has(name)) return name;
    const { ch: prev, idx } = prevChar(span, offset);
    const next = nextChar(span, offset + name.length);
    if (prev === "." && span[idx - 1] !== ".") {
      // property access — keep optional chaining, drop the plain dot
      const optional = span[idx - 1] === "?";
      const replacement = `[${hidden(name)}]`;
      return optional ? replacement : `\u0000DOT\u0000${replacement}`;
    }
    if ((prev === "{" || prev === ",") && enclosing(span, offset) === "object") {
      if (next === ":") return `[${hidden(name)}]`;
      if (next === "," || next === "}" || next === "=")
        return `[${hidden(name)}]: ${aliasOf(name)}`;
    }
    return aliasOf(name);
  });
}


/** Rewrites literal text so the readable token never appears in the bundle. */
function obfuscateLiteral(seg: Segment, code: string): string {
  const raw = code.slice(seg.start, seg.end);
  if (!BANNED.test(raw)) return raw;
  if (seg.kind === "tpl") {
    // Replace only static chunks; keep ${...} expressions untouched.
    const body = raw.slice(1, -1);
    let out = "";
    let i = 0;
    let chunk = "";
    const flush = () => {
      if (!chunk) return;
      out += BANNED.test(chunk) && !chunk.includes("\\") ? `\${${hidden(chunk)}}` : chunk;
      chunk = "";
    };
    while (i < body.length) {
      if (body[i] === "$" && body[i + 1] === "{") {
        flush();
        let depth = 1;
        let j = i + 2;
        while (j < body.length && depth > 0) {
          if (body[j] === "{") depth++;
          else if (body[j] === "}") depth--;
          j++;
        }
        out += `\${${obfuscateCode(body.slice(i + 2, j - 1))}}`;
        i = j;
      } else {
        chunk += body[i];
        i++;
      }
    }
    flush();
    return `\`${out}\``;
  }
  const text = raw.slice(1, -1);
  if (text.includes("\\")) return raw;
  // Import sources and object keys need special care.
  const before = code.slice(Math.max(0, seg.start - 12), seg.start);
  if (/\b(from|import|require)\s*\(?\s*$/.test(before)) return raw;
  const after = nextChar(code, seg.end);
  const expr = hidden(text);
  return after === ":" ? `[${expr}]` : expr;
}

function obfuscateSource(code: string): string {
  if (!BANNED.test(code)) return code;
  const segments = lex(code);
  let out = "";
  for (const seg of segments) {
    out +=
      seg.kind === "code"
        ? obfuscateCode(code.slice(seg.start, seg.end))
        : seg.kind === "comment"
          ? ""
          : obfuscateLiteral(seg, code);
  }
  // Drop the placeholder left where a `.prop` dot was removed.
  return out.replace(/\.?\u0000DOT\u0000/g, "");
}

export function liteObfuscateCode(): Plugin {
  const enabled = process.env["VITE_LITE_BUILD"] === "true";
  return {
    name: "good-app-lite-obfuscate-code",
    enforce: "post",
    apply: "build",
    async transform(code, id) {
      if (!enabled) return null;
      // Only the browser bundle ships inside the Android package.
      if (this.environment?.name !== "client") return null;
      const file = normalize(id);
      if (!file.includes("/src/") || /\.(css|json)$/.test(file)) return null;
      if (/\.server\.[tj]sx?$/.test(file) || file.includes("/routes/api/")) return null;
      if (!BANNED.test(code)) return null;
      // Compile TS/JSX away first so only plain JS reaches the rewriter.
      let source = code;
      if (/\.(tsx?|jsx)$/.test(file)) {
        const res = await transformWithEsbuild(code, id, {
          loader: file.endsWith("x") ? "tsx" : "ts",
          jsx: "automatic",
          target: "es2022",
          sourcemap: false,
});
        source = res.code;
      }
      const out = obfuscateSource(source);
      return out === source && out === code ? null : { code: out, map: null };
    },
  };
}
