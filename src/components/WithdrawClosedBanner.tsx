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
 * জুমা মোবারক ব্যানার — শুক্রবার দুপুর ১টা থেকে শনিবার সকাল ১০টা পর্যন্ত
 * withdraw বন্ধ থাকে (অথবা অ্যাডমিন ম্যানুয়ালি বন্ধ রাখলে)।
 */
export function WithdrawClosedBanner({ adminOff, adminMessage }: { adminOff?: boolean; adminMessage?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const win = withdrawWindowInfo(now);
  const closed = win.isClosed || !!adminOff;
  if (!closed) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber/50 shadow-2xl">
      <img
        src={banner}
        alt="জুমা মোবারক — উইথড্র বন্ধ"
        width={1088}
        height={608}
        loading="lazy"
        className="h-44 w-full object-cover"
      />
      <div className="absolute inset-0 bg-linear-to-r from-background via-background/80 to-transparent" />
      <div className="absolute inset-0 flex flex-col justify-center gap-1 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber animate-pulse">জুমা মোবারক 🌙</p>
        <h3 className="max-w-[62%] text-base font-black leading-tight text-foreground">
          উইথড্র রিকোয়েস্ট আপাতত বন্ধ
        </h3>
        <p className="max-w-[62%] text-[11px] leading-snug text-muted-foreground">
          {adminOff && adminMessage
            ? adminMessage
            : "প্রতি শুক্রবার দুপুর ১:০০টা → শনিবার সকাল ১০:০০টা পর্যন্ত উইথড্র বন্ধ থাকে। এরপর আবার চালু হবে ইনশাআল্লাহ।"}
        </p>
        {win.isClosed && (
          <div className="mt-1 w-fit rounded-xl border border-amber/40 bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">আবার চালু হবে</p>
            <p className="mono-num text-sm font-black text-amber">{fmt(win.msUntilReopen)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
