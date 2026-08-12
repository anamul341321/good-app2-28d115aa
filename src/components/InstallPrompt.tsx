import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Trash2, ShieldCheck, X } from "lucide-react";
import { getAppStatus } from "@/lib/app-status.functions";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    // @ts-ignore
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

function isNativeApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * ইউজারকে নেটিভ অ্যাপ (APK / Play Store) ডাউনলোড করতে বলে।
 * - APK লিংক থাকলে: এক ট্যাপে ডাউনলোড ব্যানার + নিরাপদে ইনস্টল করার গাইড (Play Protect সহ)
 * - আগে "Add to Home Screen" দিয়ে ইনস্টল করা থাকলে: পুরোনোটা ডিলিট করে নতুন ভার্সন নিতে বলে
 * - APK না থাকলে: আগের মতো PWA ইনস্টল প্রম্পট
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [hidden, setHidden] = useState(false);
  const native = typeof window !== "undefined" && isNativeApp();

  const { data } = useQuery({
    queryKey: ["app-status-apk"],
    queryFn: () => getAppStatus(),
    staleTime: 5 * 60 * 1000,
    enabled: !native,
  });
  const apkUrl = (data as any)?.apkUrl as string | null | undefined;
  const apkVersion = (data as any)?.apkVersion as string | null | undefined;
  const isStore = !!apkUrl && /play\.google\.com/i.test(apkUrl);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(isStandalone());

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onMq = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onMq);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq?.removeEventListener?.("change", onMq);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const res = await deferred.userChoice;
        if (res.outcome === "accepted") setInstalled(true);
        setDeferred(null);
      } catch {
        setShowHelp(true);
      }
      return;
    }
    setShowHelp(true);
  };

  // নেটিভ অ্যাপে থাকলে কিছুই দেখাবো না
  if (native) return null;

  // ── নতুন নেটিভ অ্যাপ আছে → সবাইকে সেটাই ডাউনলোড করতে বলি ──
  if (apkUrl) {
    return (
      <>
        {!hidden && (
          <div className="fixed top-14 inset-x-0 z-40 px-3 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto space-y-2">
              {/* পুরোনো Add-to-Home-Screen ইউজারদের জন্য সতর্কতা */}
              {installed && (
                <div className="rounded-2xl p-3 bg-rose-600 text-white shadow-2xl border border-white/20">
                  <div className="flex items-start gap-2">
                    <Trash2 className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-[11px] font-bold leading-snug flex-1">
                      আপনি আগে <b>"Add to Home Screen"</b> দিয়ে যেটা ইনস্টল করেছিলেন সেটি
                      <b> ডিলিট (Uninstall)</b> করে দিন — এখন নিচের বাটনে চাপ দিয়ে
                      <b> নতুন অফিসিয়াল অ্যাপ</b> ইনস্টল করুন ✅
                    </p>
                  </div>
                </div>
              )}

              <div
                className="rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-white/20"
                style={{ background: "linear-gradient(135deg,#059669 0%,#06b6d4 55%,#7c3aed 100%)" }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-white animate-bounce" />
                </div>
                <div className="min-w-0 flex-1 text-white">
                  <p className="font-black text-sm leading-tight">
                    {isStore ? "Play Store থেকে অ্যাপ নিন 📲" : "অফিসিয়াল অ্যাপ ডাউনলোড করুন 📲"}
                  </p>
                  <p className="text-[10px] opacity-90 leading-tight mt-0.5">
                    ওয়েবসাইটের বদলে অ্যাপে কাজ করুন — এক ট্যাপেই ডাউনলোড
                    {apkVersion && !isStore ? ` • v${apkVersion}` : ""}
                  </p>
                </div>
                <a
                  href={apkUrl}
                  {...(isStore
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : { download: "Good-App.apk" })}
                  onClick={() => {
                    if (!isStore) setShowSafety(true);
                  }}
                  className="shrink-0 px-3 py-2 rounded-xl bg-white text-emerald-700 font-black text-xs flex items-center gap-1 btn-press shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  ডাউনলোড
                </a>
                <button
                  onClick={() => setHidden(true)}
                  aria-label="বন্ধ"
                  className="shrink-0 w-6 h-6 rounded-full bg-white/20 text-white grid place-items-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* নিরাপদে ইনস্টল করার গাইড (Play Protect / security scan) */}
        {showSafety && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
            onClick={() => setShowSafety(false)}
          >
            <div
              className="w-full max-w-md rounded-3xl bg-surface border border-border p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div
                  className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-2"
                  style={{ background: "linear-gradient(135deg,#059669,#06b6d4)" }}
                >
                  <ShieldCheck className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-black">অ্যাপটি নিরাপদ ✅ — ইনস্টল করার নিয়ম</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  ডাউনলোড শুরু হয়েছে। নিচের ধাপগুলো ফলো করুন
                </p>
              </div>

              <ol className="space-y-3 text-sm">
                {[
                  <>ডাউনলোড শেষ হলে <b>Notification</b> বা <b>Files → Downloads</b> থেকে <b>Good-App.apk</b> ওপেন করুন</>,
                  <>"Install unknown apps" চাইলে <b>Settings → Allow</b> দিন (শুধু এই একবার)</>,
                  <>Play Protect যদি বলে <b>"Unsafe app blocked"</b> বা <b>"scan করতে দিন"</b> — <b>"More details" → "Install anyway"</b> চাপুন। অ্যাপটি আমাদের নিজের, তাই কোনো ক্ষতি নেই।</>,
                  <>Play Protect-এ <b>Send for scanning</b> দিলেও সমস্যা নেই — স্ক্যান শেষে ইনস্টল হয়ে যাবে</>,
                  <>ইনস্টল শেষে হোম স্ক্রিনের <b>Good-App</b> আইকন থেকে লগইন করুন</>,
                ].map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">
                      {["১", "২", "৩", "৪", "৫"][i]}
                    </span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ol>

              <p className="text-[10px] text-muted-foreground leading-snug">
                🔒 অ্যাপটি অফিসিয়াল signing key দিয়ে সাইন করা ও শুধু আমাদের নিজের সার্ভার থেকেই ডাউনলোড হয় — কোনো
                বিজ্ঞাপন, ট্র্যাকার বা ক্ষতিকর কোড নেই।
              </p>

              <button
                onClick={() => setShowSafety(false)}
                className="w-full py-3 rounded-xl gradient-cta font-black text-sm btn-press"
              >
                বুঝেছি
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── APK/Store লিংক না থাকলে কিছু দেখাবো না ──
  return null;
}
