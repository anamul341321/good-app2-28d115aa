import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Download, Rocket, X } from "lucide-react";
import { toast } from "sonner";
import { getAppStatus } from "@/lib/app-status.functions";
import { isNativeApp } from "@/lib/native-google";
import { Button } from "@/components/ui/button";

/**
 * নেটিভ অ্যাপে নতুন ভার্সন এলে উপরে আপডেট ব্যেনার দেখায়।
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [installed, setInstalled] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "started" | "progress" | "complete" | "failed" | "fallback">("idle");
  const [percent, setPercent] = useState(0);
  const [hidden, setHidden] = useState(false);

  // একবার বন্ধ করলে সেই version-এর জন্য আর দেখায় না।
  // native-এও কাজ করে কারণ WebView localStorage share করে।
  useEffect(() => {
    try {
      const saved = localStorage.getItem("update_banner_dismissed");
      if (!saved) return;
      const parsed = JSON.parse(saved) as { version?: string; at?: number };
      if (parsed.version && parsed.version === latest) setHidden(true);
      // fallback: older time-based hide (12h) for web
      else if (!native && parsed.at && Date.now() - parsed.at < 12 * 60 * 60 * 1000) setHidden(true);
    } catch { /* ignore */ }
  }, [native, latest]);

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(
        "update_banner_dismissed",
        JSON.stringify({ version: latest ?? null, at: Date.now() })
      );
    } catch { /* ignore */ }
  };


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
    enabled: true,
  });

  const url = (data as any)?.apkUrl as string | null | undefined;
  const latest = (data as any)?.apkVersion as string | null | undefined;
  const required = ((data as any)?.minAppVersion ?? latest) as string | null | undefined;
  const forceBlocked =
    (data as any)?.forceUpdate === true &&
    (native ? isNewer(required, installed) : (data as any)?.forceUpdateWeb === true && !!required);
  
  const isAdmin = /^\/admin(-login)?(\/|$)/.test(pathname);
  const isSocialRoute = /^\/(social|chat|feed|friends|videos|reels|watch|studio|channel|user|profile)(\/|$)/.test(pathname);

  const isDownloadPage = pathname === "/download";
  const shouldShow = !!url && !!latest && !forceBlocked && !isAdmin && !isSocialRoute && !isDownloadPage && !hidden && (!native || (!!installed && isNewer(latest, installed))) && !/play\.google\.com/i.test(url);

  useEffect(() => {
    if (!shouldShow) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [shouldShow]);

  // নেটিভ অ্যাপ: ইনস্টল করা ভার্সন পুরোনো হলেই বড় করে আপডেট চাইবে।
  // ওয়েবসাইট: অ্যাপ ইনস্টল/আপডেট করার জন্য প্রতিবার ঢুকলেই বড় ব্যানার দেখাবে।
  if (!shouldShow) return null;

  const absolute = /^https?:\/\//i.test(url)
    ? url
    : `https://www.goodapp2.live${url.startsWith("/") ? url : `/${url}`}`;

  const startUpdate = async () => {
    setStarted(true);
    setDownloadStatus("started");
    // Permanent in-app endpoint. The native app will open it in Chrome; the
    // browser will follow the redirect and download the APK automatically.
    const permalink = `${absolute}${absolute.includes("?") ? "&" : "?"}download=${Date.now()}`;
    let resolvedUrl: string | null = null;
    try {
      const separator = absolute.includes("?") ? "&" : "?";
      const response = await fetch(`${absolute}${separator}resolve=1&t=${Date.now()}`, {
        cache: "no-store",
      });
      if (response.ok) {
        const resolved = (await response.json()) as { downloadUrl?: string };
        if (resolved.downloadUrl && /^https?:\/\//i.test(resolved.downloadUrl)) {
          resolvedUrl = resolved.downloadUrl;
        }
      }
    } catch {
      // ignore
    }

    // Native app: always use the permalink so the native bridge recognizes the
    // domain and opens Chrome. Chrome handles the redirect to the actual storage
    // URL and starts the download.
    const nativeOpener = (
      window as Window & { GoodAppDownloader?: { openExternal?: (url: string) => void } }
    ).GoodAppDownloader;
    try {
      if (nativeOpener?.openExternal) {
        nativeOpener.openExternal(permalink);
        toast.success("Chrome-এ ডাউনলোড শুরু হচ্ছে — শেষ হলে ফাইলে ট্যাপ করে Install দিন", {
          duration: 8000,
        });
        setDownloadStatus("fallback");
        return;
      }
    } catch {
      // fall through to browser fallback
    }

    // Web / older app fallback: use the resolved direct URL if available.
    const finalUrl = resolvedUrl ?? permalink;
    setDownloadStatus("fallback");
    try {
      const opened = window.open(finalUrl, "_blank");
      if (!opened) window.location.href = finalUrl;
    } catch {
      window.location.href = finalUrl;
    }
    toast.success("Chrome-এ ডাউনলোড শুরু হচ্ছে — শেষ হলে ফাইলে ট্যাপ করে Install দিন", {
      duration: 8000,
    });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 py-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-sm">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/20 p-6 shadow-2xl ring-2 ring-cyan-400/25 sm:p-7"
        style={{ background: "linear-gradient(160deg,#0b1224 0%,#16215a 55%,#3b0764 100%)" }}
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_2.4s_linear_infinite]" />

        <button
          type="button"
          onClick={hide}
          aria-label="বন্ধ করুন"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white btn-press hover:bg-white/20"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative text-center text-white">
          <div
            className="mx-auto grid h-20 w-20 place-items-center rounded-3xl shadow-lg"
            style={{ background: "linear-gradient(135deg,#22c55e,#06b6d4)" }}
          >
            <Rocket className="h-10 w-10" />
          </div>
          <p className="mt-5 text-2xl font-black leading-tight">
            {native ? "🚀 নতুন ভার্সন এসেছে" : "🚀 গুড অ্যাপ ইনস্টল / আপডেট করুন"}
          </p>
          <p className="mx-auto mt-3 max-w-[18rem] text-sm font-semibold leading-relaxed text-white/80">
            {native ? (
              <>
                v{installed} → <span className="font-bold text-cyan-300">v{latest}</span> • আপডেট না
                করলে নতুন সুবিধা কাজ করবে না
              </>
            ) : (
              <>
                সর্বশেষ ভার্সন <span className="font-bold text-cyan-300">v{latest}</span> — অ্যাপে
                সবকিছু দ্রুত ও ঝামেলাহীন চলে
              </>
            )}
          </p>

          <Button
            type="button"
            onClick={startUpdate}
            className="group relative mt-6 h-auto w-full overflow-hidden rounded-2xl py-4 text-base font-black text-white btn-press shadow-xl"
            style={{ background: "linear-gradient(100deg,#f59e0b,#ef4444 45%,#a855f7 100%)" }}
          >
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_linear_infinite]" />
            <span className="relative flex items-center justify-center gap-2 text-base">
              <Download className="h-6 w-6" />
              {started ? "আবার ডাউনলোড করুন" : "এখনই আপডেট করুন"}
            </span>
          </Button>

          <button
            type="button"
            onClick={hide}
            className="mt-3 w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-bold text-white/70 btn-press"
          >
            এখন না — পরে করব
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
                    ? "📥 Chrome-এ ডাউনলোড শুরু হয়েছে"
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
                <b>Chrome</b> খুলে ডাউনলোড নিজে থেকেই শুরু হয়েছে।
                <br />১) <b>Notification bar</b> নামিয়ে ডাউনলোড শেষ হওয়া পর্যন্ত অপেক্ষা করুন।
                <br />২) <b>Good-App-v{latest}.apk</b> ফাইলে ট্যাপ করে <b>Install / Update</b> চাপুন।
                <br />প্রথমবার হলে <b>“Allow from this source”</b> অন করে আবার Install চাপুন ✅
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
