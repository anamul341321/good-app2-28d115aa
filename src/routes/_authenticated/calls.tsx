import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Phone, Download, Home, Headphones } from "lucide-react";
import logo from "@/assets/goodapp-logo.png";

export const CALL_MODE_KEY = "goodapp_call_only_mode";

export const Route = createFileRoute("/_authenticated/calls")({
  head: () => ({
    meta: [
      { title: "GoodApp কল ও মেসেজ" },
      { name: "description", content: "শুধু মেসেজ ও কলিং — GoodApp-এর হালকা কল অ্যাপ।" },
      { property: "og:title", content: "GoodApp কল ও মেসেজ" },
      { property: "og:description", content: "শুধু মেসেজ ও কলিং — GoodApp-এর হালকা কল অ্যাপ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallsApp,
});

type InstallEvent = Event & { prompt: () => Promise<void> };

function CallsApp() {
  const [callOnly, setCallOnly] = useState(false);
  const [callsApp, setCallsApp] = useState(false);
  const [installEvt, setInstallEvt] = useState<InstallEvent | null>(null);
  const [callsApkVersion, setCallsApkVersion] = useState<string | null>(null);
  const [apkBusy, setApkBusy] = useState(false);

  useEffect(() => {
    setCallOnly(localStorage.getItem(CALL_MODE_KEY) === "1");
    setCallsApp(localStorage.getItem("goodapp_calls_app") === "1");
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const prev = link?.href;
    if (link) link.href = "/calls.webmanifest";
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // মূল অ্যাপ থেকে কল অ্যাপের APK আছে কিনা জেনে নিই
    fetch("/api/public/app/download?calls=1&resolve=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.version && setCallsApkVersion(String(d.version)))
      .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (link && prev) link.href = prev;
    };
  }, []);

  const toggle = () => {
    const next = !callOnly;
    setCallOnly(next);
    localStorage.setItem(CALL_MODE_KEY, next ? "1" : "0");
  };

  return (
    <div className="app-shell min-h-[100dvh] px-4 pb-10 pt-6 safe-top">
      <div className="flex items-center gap-3">
        <img src={logo} alt="GoodApp" className="h-12 w-12 rounded-2xl shadow-lg" />
        <div>
          <h1 className="text-xl font-black">GoodApp কল</h1>
          <p className="text-xs text-muted-foreground">মেসেজ ও কল — এক জায়গায়</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link to="/chat" className="glass btn-press flex flex-col items-center gap-2 rounded-3xl p-6 active:scale-95">
          <MessageCircle className="h-10 w-10 text-primary" />
          <span className="text-base font-black">মেসেজ</span>
          <span className="text-[11px] text-muted-foreground">চ্যাট ও অডিও কল</span>
        </Link>
        <Link to="/callcenter" className="glass btn-press flex flex-col items-center gap-2 rounded-3xl p-6 active:scale-95">
          <Phone className="h-10 w-10 text-emerald-400" />
          <span className="text-base font-black">ডায়াল প্যাড</span>
          <span className="text-[11px] text-muted-foreground">UID দিয়ে কল</span>
        </Link>
        <Link to="/callcenter" className="glass btn-press col-span-2 flex items-center justify-center gap-2 rounded-3xl p-4 active:scale-95">
          <Headphones className="h-6 w-6 text-amber-400" />
          <span className="text-sm font-black">কল সাপোর্ট</span>
        </Link>
      </div>

      {!callsApp && (<>
      <div className="glass mt-6 rounded-3xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">শুধু কলিং অ্যাপ হিসেবে চালান</p>
            <p className="mt-1 text-[11px] text-muted-foreground">চালু করলে অ্যাপ খুললেই সরাসরি এই কল পাতা আসবে।</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={callOnly}
            onClick={toggle}
            className={`relative h-8 w-14 shrink-0 rounded-full transition ${callOnly ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-background transition-all ${callOnly ? "left-7" : "left-1"}`} />
          </button>
        </div>
      </div>

      {installEvt && (
        <button
          type="button"
          onClick={() => installEvt.prompt().finally(() => setInstallEvt(null))}
          className="gradient-cta mt-4 flex w-full items-center justify-center gap-2 rounded-2xl p-4 text-sm font-black"
        >
          <Download className="h-5 w-5" /> ফোনে আলাদা কল আইকন যোগ করুন
        </button>
      )}

      <Link to="/home" onClick={() => sessionStorage.setItem("goodapp_full_app", "1")} className="mt-6 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
        <Home className="h-4 w-4" /> পুরো GoodApp খুলুন
      </Link>
      </>)}
    </div>
  );
}
