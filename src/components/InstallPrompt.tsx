import { useEffect, useState } from "react";
import { Download, Share, Plus, Smartphone } from "lucide-react";

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

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const iosDevice = typeof window !== "undefined" && isIOS();

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

    // display-mode বদলালে (ইনস্টল করে অ্যাপ থেকে খুললে) ব্যানার নিজেই চলে যাবে
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
    // native prompt না থাকলে (iOS / অন্য ব্রাউজার) নিয়ম দেখাবে
    setShowHelp(true);
  };

  if (installed) return null;

  return (
    <>
      <div className="fixed top-14 inset-x-0 z-40 px-3 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div
            className="rounded-2xl p-3 flex items-center gap-3 shadow-2xl border border-white/20"
            style={{ background: "linear-gradient(135deg,#7c3aed 0%,#06b6d4 50%,#10b981 100%)" }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="font-black text-sm leading-tight">অ্যাপ ইনস্টল করুন 📲</p>
              <p className="text-[10px] opacity-90 leading-tight mt-0.5">
                ফুল-স্ক্রিন অ্যাপ — হোম স্ক্রিন থেকে এক চাপে খুলবে
              </p>
            </div>
            <button
              onClick={install}
              className="shrink-0 px-3 py-2 rounded-xl bg-white text-violet-700 font-black text-xs flex items-center gap-1 btn-press shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              ইনস্টল
            </button>
          </div>
        </div>
      </div>

      {showHelp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center px-4"
             onClick={() => setShowHelp(false)}>
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

            {iosDevice ? (
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
                  <span className="flex-1"><b>Chrome</b> ব্রাউজার দিয়ে <b>https://goodapp2.live</b> ওপেন করুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">২</span>
                  <span className="flex-1">উপরের ডান পাশের তিনটি ডট <b>(⋮)</b> মেনুতে চাপুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">৩</span>
                  <span className="flex-1"><b>"Install app"</b> বা <b>"Add to Home Screen"</b> চাপুন</span>
                </li>
                <li className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shrink-0">৪</span>
                  <span className="flex-1">তারপর <b>"Install"</b> চাপলেই অ্যাপ ফোনে ইনস্টল হয়ে যাবে ✅</span>
                </li>
              </ol>
            )}

            <button onClick={() => setShowHelp(false)}
                    className="w-full py-3 rounded-xl gradient-cta font-black text-sm btn-press">
              বুঝেছি
            </button>
          </div>
        </div>
      )}
    </>
  );
}
