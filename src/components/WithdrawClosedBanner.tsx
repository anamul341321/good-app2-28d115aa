import banner from "@/assets/withdraw-jumma-banner.jpg";
import { withdrawWindowInfo } from "@/lib/withdraw-window";

const LINES = [
  "আজ পবিত্র জুমার দিন — সবাইকে জুমা মোবারক 🌙",
  "জুমার দিনে বেশি বেশি দরুদ পড়ুন, দোয়া কবুলের দিন 🤲",
  "আপনার ইবাদত, রিজিক ও ইনকাম — সব বরকতময় হোক 💙",
];

/**
 * জুমা মোবারক ব্যানার — প্রতি শুক্রবার অটো দেখাবে, রাত ১২:০০টায় অটো চলে যাবে।
 * অ্যাডমিন ম্যানুয়ালি withdraw বন্ধ রাখলেও দেখাবে।
 */
export function WithdrawClosedBanner({ adminOff, adminMessage }: { adminOff?: boolean; adminMessage?: string | null }) {
  const win = withdrawWindowInfo(Date.now());
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
            : LINES[0]}
        </p>
        {!adminOff && (
          <div className="mt-1 max-w-[66%] rounded-xl border border-amber/40 bg-background/70 px-3 py-1.5 backdrop-blur-sm">
            <p className="text-[10px] font-bold leading-snug text-amber">{LINES[1]}</p>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{LINES[2]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
