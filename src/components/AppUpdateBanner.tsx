import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Rocket, X } from "lucide-react";
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
  const [started, setStarted] = useState(false);
  const [hidden, setHidden] = useState(false);

  const readVersion = () =>
    import("@capacitor/app")
      .then((m) => m.App.getInfo())
      .then((info) => setInstalled(info?.version ?? null))
      .catch(() => setInstalled(null));

  useEffect(() => {
    if (!native) return;
    void readVersion();
    // অ্যাপ আবার সামনে এলে ভার্সন আবার পড়ে — আপডেট হয়ে গেলে ব্যানার নিজেই চলে যাবে
    let remove: (() => void) | undefined;
    import("@capacitor/app")
      .then(async (m) => {
        const handle = await m.App.addListener("appStateChange", ({ isActive }) => {
          if (isActive) void readVersion();
        });
        remove = () => handle.remove();
      })
      .catch(() => {});
    return () => remove?.();
  }, [native]);


  const { data } = useQuery({
    queryKey: ["app-status-apk"],
    queryFn: () => getAppStatus(),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    enabled: native,
  });

  const url = (data as any)?.apkUrl as string | null | undefined;
  const latest = (data as any)?.apkVersion as string | null | undefined;

  if (!native || !url || !installed || !isNewer(latest, installed)) return null;
  if (/play\.google\.com/i.test(url)) return null;
  if (hidden) return null;

  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `https://www.goodapp2.live${url.startsWith("/") ? url : `/${url}`}`;

  const startUpdate = async () => {
    setStarted(true);
    const freshUrl = `${absolute}${absolute.includes("?") ? "&" : "?"}download=${Date.now()}`;
    const nativeDownloader = (
      window as Window & {
        GoodAppDownloader?: { download: (downloadUrl: string, fileName: string) => void };
      }
    ).GoodAppDownloader;

    if (nativeDownloader?.download) {
      nativeDownloader.download(freshUrl, `Good-App-v${latest ?? "latest"}.apk`);
      toast.success("ডাউনলোড শুরু হয়েছে — Notification bar-এ প্রগ্রেস দেখুন", {
        duration: 6000,
      });
      return;
    }

    // Already-installed builds do not yet have the downloader bridge. A
    // same-frame HTTPS navigation is deliberately used here: MainActivity's
    // existing URL interceptor then hands it to Chrome/Android Downloads.
    toast.info("ডাউনলোড পেজ খোলা হচ্ছে…", { duration: 4000 });
    window.location.assign(freshUrl);
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
              <Download className="h-4 w-4" /> {started ? "আবার" : "আপডেট"}
            </span>
          </Button>
          <button
            type="button"
            onClick={() => setHidden(true)}
            aria-label="বন্ধ করুন"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white btn-press"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {started && (
          <div className="relative mt-3 rounded-xl bg-white/10 p-2.5 text-[11px] leading-snug text-white/85">
            <p className="font-black text-cyan-300">📥 ডাউনলোড চলছে — এরপর কী করবেন</p>
            <p className="mt-1">
              ১) ফোনের <b>Notification bar</b> নামিয়ে ডাউনলোড প্রগ্রেস দেখুন।
              <br />২) শেষ হলে ফাইলটিতে <b>ট্যাপ</b> করুন (অথবা <b>Files → Downloads</b> ফোল্ডার থেকে
              <b> Good-App-v{latest}.apk</b>)।
              <br />৩) <b>Install / Update</b> চাপুন — ইনস্টল হয়ে গেলে এই ব্যানার নিজেই চলে যাবে ✅
            </p>
          </div>
        )}
      </div>
    </div>
  );

}
