import { useEffect, useState } from "react";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";

const DISMISS_KEY = "install_prompt_dismissed_at";
const REAPPEAR_MS = 30 * 60 * 1000; // 30 min

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;

    const shouldShow = () => {
      const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return Date.now() - last > REAPPEAR_MS;
    };

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      if (shouldShow()) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    // iOS or browsers without BIP — show manual banner
    if (isIOS() && shouldShow()) setVisible(true);

    // Re-check every minute to re-surface after cooldown
    const t = setInterval(() => {
      if (isStandalone()) { setVisible(false); return; }
      if (shouldShow()) setVisible(true);
    }, 60_000);

    const onInstalled = () => { setVisible(false); setDeferred(null); };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearInterval(t);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
    setShowIosSheet(false);
  };

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const res = await deferred.userChoice;
        if (res.outcome === "accepted") setVisible(false);
        else localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setDeferred(null);
      } catch {
        dismiss();
      }
    } else if (isIOS()) {
      setShowIosSheet(true);
    } else {
      // Fallback: give instructions
      setShowIosSheet(true);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="fixed top-14 inset-x-0 z-40 px-3 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div
            className="rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-white/20 animate-in slide-in-from-top-4 fade-in duration-300"
            style={{ background: "linear-gradient(135deg,#7c3aed 0%,#06b6d4 50%,#10b981 100%)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="font-black text-sm leading-tight">অ্যাপ ইনস্টল করুন 📲</p>
              <p className="text-[10px] opacity-90 leading-tight mt-0.5">
                ফাস্ট, অফলাইন সাপোর্ট, হোম স্ক্রিনে সহজে খুলুন
              </p>
            </div>
            <button
              onClick={install}
              className="shrink-0 px-3 py-2 rounded-xl bg-white text-violet-700 font-black text-xs flex items-center gap-1 btn-press shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              ইনস্টল
            </button>
            <button
              onClick={dismiss}
              aria-label="close"
              className="shrink-0 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {showIosSheet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
             onClick={() => setShowIosSheet(false)}>
          <div className="w-full max-w-md rounded-3xl bg-surface border border-border p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-2"
                   style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-black">অ্যাপ ইনস্টল করার নিয়ম</h3>
              <p className="text-xs text-muted-foreground mt-1">নিচের ধাপগুলো ফলো করুন</p>
            </div>

            {isIOS() ? (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white font-black text-xs flex items-center justify-center shrink-0">১</span>
                  <span className="flex-1">সাফারি ব্রাউজারের নিচের <b>Share</b> <Share className="w-3.5 h-3.5 inline mx-0.5" /> বাটনে চাপুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white font-black text-xs flex items-center justify-center shrink-0">২</span>
                  <span className="flex-1">স্ক্রল করে <b>"Add to Home Screen"</b> <Plus className="w-3.5 h-3.5 inline mx-0.5" /> সিলেক্ট করুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-cyan-500 text-white font-black text-xs flex items-center justify-center shrink-0">৩</span>
                  <span className="flex-1">উপরের ডান কোণায় <b>"Add"</b> চাপলেই হোম স্ক্রিনে চলে আসবে</span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">১</span>
                  <span className="flex-1">Chrome ব্রাউজারের উপরে ডান দিকে <b>⋮</b> মেনুতে চাপুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">২</span>
                  <span className="flex-1"><b>"Install app"</b> অথবা <b>"Add to Home screen"</b> সিলেক্ট করুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">৩</span>
                  <span className="flex-1"><b>Install</b> চাপলে হোম স্ক্রিনে অ্যাপ চলে আসবে</span>
                </li>
              </ol>
            )}

            <button onClick={dismiss}
                    className="w-full py-3 rounded-xl gradient-cta font-black text-sm btn-press">
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
}
