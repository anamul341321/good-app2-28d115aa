import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Trash2, X, Zap, BellRing, ShieldCheck } from "lucide-react";
import { getAppStatus } from "@/lib/app-status.functions";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    // @ts-ignore
    window.navigator.standalone === true
  );
}

function isNativeApp() {
  if (typeof window === "undefined") return false;
  const cap = (window as any).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * ওয়েবসাইটে ঢুকলেই (নেটিভ অ্যাপ না হলে) প্রতিবার অ্যাপ ডাউনলোডের সুন্দর পপআপ।
 * - ক্রস চেপে বন্ধ করা যায়, কিন্তু পরের বার আবার আসবে (কোনো "আর দেখাবে না" সেভ নেই)
 * - ডাউনলোডে ট্যাপ করলেই সোজা ডাউনলোড শুরু — কোনো লম্বা নোটিশ নেই
 */
export function InstallPrompt() {
  const [installed, setInstalled] = useState(false);
  const [open, setOpen] = useState(true);
  const native = typeof window !== "undefined" && isNativeApp();

  const { data } = useQuery({
    queryKey: ["app-status-apk"],
    queryFn: () => getAppStatus(),
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    enabled: !native,
  });
  const apkUrl = (data as any)?.apkUrl as string | null | undefined;
  const apkVersion = (data as any)?.apkVersion as string | null | undefined;
  const isStore = !!apkUrl && /play\.google\.com/i.test(apkUrl);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setInstalled(isStandalone());
    const mq = window.matchMedia?.("(display-mode: standalone)");
    const onMq = () => setInstalled(isStandalone());
    mq?.addEventListener?.("change", onMq);
    return () => mq?.removeEventListener?.("change", onMq);
  }, []);

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (native || !apkUrl || !open || path.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm px-3 pb-4 animate-in fade-in duration-300">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 shadow-2xl animate-in slide-in-from-bottom-6 duration-400"
        style={{ background: "linear-gradient(160deg,#0b1224 0%,#131a3a 55%,#1b1040 100%)" }}
      >
        {/* গ্লো */}
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(circle,#06b6d4,transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-52 w-52 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(circle,#a855f7,transparent 70%)" }} />

        <button
          onClick={() => setOpen(false)}
          aria-label="বন্ধ করুন"
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white btn-press"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative p-5 pt-7 text-white">
          <div className="flex items-center gap-3">
            <div
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl shadow-lg"
              style={{ background: "linear-gradient(135deg,#22c55e,#06b6d4)" }}
            >
              <Download className="h-7 w-7 animate-bounce text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                {isStore ? "Google Play" : "Official Android App"}
              </p>
              <h3 className="text-lg font-black leading-tight">
                Good-App {isStore ? "ইনস্টল করুন" : "অ্যাপটি ডাউনলোড করুন"}
              </h3>
              <p className="text-[11px] text-white/70">
                ওয়েবসাইটের চেয়ে অনেক দ্রুত{apkVersion && !isStore ? ` • v${apkVersion}` : ""}
              </p>
            </div>
          </div>

          {installed && (
            <div className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-600/90 p-3">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-[11px] font-bold leading-snug">
                আগে <b>"Add to Home Screen"</b> দিয়ে যেটা রেখেছিলেন সেটি <b>ডিলিট</b> করে
                নিচের বাটন থেকে <b>নতুন অফিসিয়াল অ্যাপ</b> নিন ✅
              </p>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { icon: <Zap className="h-4 w-4 text-amber-300" />, t: "সুপার ফাস্ট" },
              { icon: <BellRing className="h-4 w-4 text-cyan-300" />, t: "নোটিফিকেশন" },
              { icon: <ShieldCheck className="h-4 w-4 text-emerald-300" />, t: "১০০% নিরাপদ" },
            ].map((f) => (
              <div key={f.t} className="rounded-xl bg-white/10 p-2 text-center">
                <div className="flex justify-center">{f.icon}</div>
                <p className="mt-1 text-[10px] font-black text-white/85">{f.t}</p>
              </div>
            ))}
          </div>

          {/* বড় ইউনিক ডাউনলোড বাটন — নিচে */}
          <a
            href={apkUrl}
            {...(isStore
              ? { target: "_blank", rel: "noopener noreferrer" }
              : { download: "Good-App.apk" })}
            onClick={() => setOpen(false)}
            className="group relative mt-5 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-base font-black text-white btn-press"
            style={{ background: "linear-gradient(100deg,#f59e0b 0%,#ef4444 40%,#a855f7 75%,#06b6d4 100%)" }}
          >
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2.2s_linear_infinite]" />
            <Download className="relative h-5 w-5" />
            <span className="relative">
              {isStore ? "Play Store থেকে ইনস্টল করুন" : "এখনই অ্যাপ ডাউনলোড করুন"}
            </span>
          </a>

          <button
            onClick={() => setOpen(false)}
            className="mt-2 w-full py-2 text-[11px] font-bold text-white/60"
          >
            পরে করব — ওয়েবসাইটেই চালিয়ে যাই
          </button>
        </div>
      </div>
    </div>
  );
}
