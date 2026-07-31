import { useEffect, useState } from "react";
import banner from "@/assets/withdraw-jumma-banner.jpg";
import { withdrawWindowInfo } from "@/lib/withdraw-window";

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)} : ${p(m)} : ${p(s)}`;
}

/**
 * জুমা মোবারক ব্যানার — প্রতি শুক্রবার অটো দেখাবে, রাত ১২:০০টায় অটো চলে যাবে।
 * অ্যাডমিন ম্যানুয়ালি withdraw বন্ধ রাখলেও দেখাবে।
 */
export function WithdrawClosedBanner({ adminOff, adminMessage }: { adminOff?: boolean; adminMessage?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const win = withdrawWindowInfo(now);
  const show = win.showJummaBanner || !!adminOff;
  if (!show) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber/50 shadow-2xl">
      <img
        src={banner}
        alt="জুমা মোবারক"
        width={1088}
        height={608}
        loading="lazy"
        className="h-44 w-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-1 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber animate-pulse">জুমা মোবারক 🌙</p>
        <h3 className="max-w-[62%] text-base font-black leading-tight text-foreground">
          {adminOff ? "উইথড্র রিকোয়েস্ট সাময়িক বন্ধ" : "সবাইকে জুমা মোবারক"}
        </h3>
        <p className="max-w-[62%] text-[11px] leading-snug text-muted-foreground">
          {adminOff
            ? (adminMessage || "উইথড্র রিকোয়েস্ট আপাতত বন্ধ আছে — একটু পরে আবার চেষ্টা করুন।")
            : "আজ শুক্রবার — সবাইকে জুমা মোবারক। উইথড্র স্বাভাবিকভাবেই চালু আছে ✅"}
        </p>
        {!adminOff && (
          <div className="mt-1 w-fit rounded-xl border border-amber/40 bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">ব্যানার থাকবে আর</p>
            <p className="mono-num text-sm font-black text-amber">{fmt(win.msUntilBannerEnd)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
