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
