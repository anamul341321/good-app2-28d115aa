import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Rocket } from "lucide-react";
import { toast } from "sonner";
import { getAppStatus } from "@/lib/app-status.functions";
import { isNativeApp } from "@/lib/native-google";
import { Button } from "@/components/ui/button";

/**
 * নেটিভ অ্যাপে নতুন ভার্সন এলে উপরে আপডেট ব্যানার দেখায়।
 * Admin Panel-এ নতুন APK আপলোড করলে apk_version বদলায় — সেটি ফোনে ইনস্টল
 * করা ভার্সনের সাথে না মিললেই ব্যানার আসে। আপডেট করে ফেললে নিজে থেকেই চলে যায়।
 */

/** "1.3" / "v1.3 (9)" → [1,3] */
function parseVer(v: string | null | undefined): number[] | null {
  if (!v) return null;
  const m = String(v).match(/\d+(?:\.\d+)*/);
  if (!m) return null;
  return m[0].split(".").map((n) => parseInt(n, 10) || 0);
}

function isNewer(latest: string | null | undefined, installed: string | null): boolean {
  const a = parseVer(latest);
  const b = parseVer(installed);
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

export function AppUpdateBanner() {
  const native = typeof window !== "undefined" && isNativeApp();
  const [installed, setInstalled] = useState<string | null>(null);

  useEffect(() => {
    if (!native) return;
    import("@capacitor/app")
      .then((m) => m.App.getInfo())
      .then((info) => setInstalled(info?.version ?? null))
      .catch(() => setInstalled(null));
  }, [native]);

  const { data } = useQuery({
    queryKey: ["app-status-update"],
    queryFn: () => getAppStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: native,
  });

  const url = (data as any)?.apkUrl as string | null | undefined;
  const latest = (data as any)?.apkVersion as string | null | undefined;

  if (!native || !url || !installed || !isNewer(latest, installed)) return null;
  if (/play\.google\.com/i.test(url)) return null;

  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `https://www.goodapp2.live${url.startsWith("/") ? url : `/${url}`}`;

  const startUpdate = async () => {
    toast.info("ডাউনলোড শুরু হচ্ছে…");

    // Capacitor Browser is the reliable way to escape the app WebView. The
    // previous window.open fallback returned a truthy WebView object even when
    // Android opened nothing, so the remaining fallbacks never ran.
    try {
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: absolute, presentationStyle: "popover" });
      return;
    } catch {
      /* Older builds may not contain the native Browser plugin. */
    }

    const parsed = new URL(absolute);
    const intentUrl = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${parsed.protocol.replace(":", "")};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(absolute)};end`;
    try {
      window.location.href = intentUrl;
      window.setTimeout(() => {
        window.location.href = absolute;
      }, 800);
    } catch {
      window.location.href = absolute;
    }
  };

  return (
    <div className="sticky top-0 z-50 px-3 pt-3">
      <div
        className="relative overflow-hidden rounded-2xl border border-white/20 p-3 shadow-xl"
        style={{ background: "linear-gradient(120deg,#0b1224 0%,#16215a 55%,#3b0764 100%)" }}
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2.4s_linear_infinite]" />
        <div className="relative flex items-center gap-3 text-white">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: "linear-gradient(135deg,#22c55e,#06b6d4)" }}
          >
            <Rocket className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black leading-tight">🚀 নতুন ভার্সন এসেছে</p>
            <p className="text-[11px] text-white/75">
              v{installed} → <span className="font-bold text-cyan-300">v{latest}</span> • আপডেট করুন
            </p>
          </div>
          <Button
            type="button"
            onClick={startUpdate}
            className="h-auto shrink-0 rounded-xl px-4 py-2 text-xs font-black text-white btn-press"
            style={{ background: "linear-gradient(100deg,#f59e0b,#ef4444 55%,#a855f7)" }}
          >
            <span className="flex items-center gap-1">
              <Download className="h-4 w-4" /> আপডেট
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
