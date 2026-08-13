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
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "started" | "progress" | "complete" | "failed" | "fallback">("idle");
  const [percent, setPercent] = useState(0);
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

  useEffect(() => {
    if (!native) return;
    const onDownloadStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status?: string; percent?: number }>).detail;
      const status = detail?.status;
      if (status === "progress") {
        setStarted(true);
        setDownloadStatus("progress");
        setPercent(Math.max(0, Math.min(100, detail?.percent ?? 0)));
        return;
      }
      if (status === "started" || status === "complete" || status === "failed" || status === "fallback") {
        setDownloadStatus(status);
        setStarted(true);
        if (status === "complete") setPercent(100);
      }
    };
    window.addEventListener("goodapp-download-status", onDownloadStatus);
    return () => window.removeEventListener("goodapp-download-status", onDownloadStatus);
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
    setDownloadStatus("started");
    let directUrl = `${absolute}${absolute.includes("?") ? "&" : "?"}download=${Date.now()}`;
    try {
      const separator = absolute.includes("?") ? "&" : "?";
      const response = await fetch(`${absolute}${separator}resolve=1&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const resolved = (await response.json()) as { downloadUrl?: string };
        if (resolved.downloadUrl && /^https?:\/\//i.test(resolved.downloadUrl)) {
          directUrl = resolved.downloadUrl;
        }
      }
    } catch {
      // The permanent endpoint remains a safe fallback if resolving fails.
    }

    // ইউজারের চাওয়া অনুযায়ী: আপডেটে ট্যাপ করলেই ফোনের ব্রাউজার (Chrome) খুলবে,
    // সেখানে ডাউনলোড নিজে থেকেই শুরু হবে — শেষ হলে ফাইলে ট্যাপ করে Install।
    setDownloadStatus("fallback");
    const nativeOpener = (
      window as Window & { GoodAppDownloader?: { openExternal?: (url: string) => void } }
    ).GoodAppDownloader;
    try {
      if (nativeOpener?.openExternal) {
        nativeOpener.openExternal(directUrl);
      } else {
        // Capacitor-এর WebView `_blank` পেলে লিংকটা সিস্টেম ব্রাউজারে পাঠায়।
        const opened = window.open(directUrl, "_blank");
        if (!opened) window.location.href = directUrl;
      }
      toast.success("Chrome-এ ডাউনলোড শুরু হচ্ছে — শেষ হলে ফাইলে ট্যাপ করে Install দিন", {
        duration: 8000,
      });
    } catch {
      window.location.href = directUrl;
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
            <p className="font-black text-cyan-300">
              {downloadStatus === "complete"
                ? "✅ ডাউনলোড সম্পন্ন — Install স্ক্রিন খুলছে"
                : downloadStatus === "failed"
                  ? "❌ ডাউনলোড ব্যর্থ — আবার Update চাপুন"
                  : downloadStatus === "fallback"
                    ? "📥 Chrome-এ ডাউনলোড হচ্ছে (পুরনো ভার্সন)"
                    : `📥 অ্যাপের ভেতরেই ডাউনলোড হচ্ছে… ${percent}%`}
            </p>
            {downloadStatus !== "fallback" && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${downloadStatus === "complete" ? 100 : Math.max(percent, 4)}%`,
                    background: "linear-gradient(90deg,#22c55e,#06b6d4,#a855f7)",
                  }}
                />
              </div>
            )}
            {downloadStatus === "fallback" ? (
              <p className="mt-2">
                আপনার ইনস্টল করা ভার্সনে ইন-অ্যাপ ডাউনলোডার নেই, তাই <b>Chrome</b>-এ ডাউনলোড হচ্ছে।
                <br />১) <b>Notification bar</b> নামিয়ে ডাউনলোড শেষ হওয়া পর্যন্ত দেখুন।
                <br />২) <b>Good-App-v{latest}.apk</b> ফাইলে ট্যাপ করে <b>Install / Update</b> চাপুন।
                <br />এই আপডেটের পর থেকে সব আপডেট অ্যাপের ভেতরেই অটো হবে ✅
              </p>
            ) : (
              <p className="mt-2">
                ডাউনলোড শেষ হলে <b>Install স্ক্রিন নিজেই খুলবে</b> — শুধু <b>Update / Install</b> চাপুন।
                <br />প্রথমবার হলে <b>“Allow from this source”</b> অন করে দিন, তারপর আবার Install চাপুন।
                <br />ইনস্টল হয়ে গেলে এই ব্যানার নিজে থেকেই চলে যাবে ✅
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  );

}
