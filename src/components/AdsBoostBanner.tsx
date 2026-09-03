import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, X } from "lucide-react";
import adsBoostGirl from "@/assets/ads-boost-girl.jpg";

const DISMISS_KEY = "ads_boost_banner_dismissed";

/**
 * Ads সাপোর্ট ব্যানার — ইউজারকে উৎসাহ দেয় যাতে ad-এ Continue দেয়।
 * Continue দিলে Monetag-এর revenue বাড়ে, যা দিয়ে mining pool-এ বোনাস দেওয়া হয়।
 * দিনে একবার dismiss করলে সেদিন আর দেখায় না।
 */
export function AdsBoostBanner() {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DISMISS_KEY);
      if (saved) {
        const { day } = JSON.parse(saved) as { day?: string };
        if (day === new Date().toDateString()) return;
      }
    } catch { /* ignore */ }
    setHidden(false);
  }, []);

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify({ day: new Date().toDateString() }));
    } catch { /* ignore */ }
  };

  if (hidden) return null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-400/30 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.45)]">
      {/* Background image */}
      <img
        src={adsBoostGirl}
        alt="Good-App Ads Boost অফার"
        width={1280}
        height={640}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover object-[70%_center] opacity-90"
      />
      {/* Readability gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#03150f] via-[#03211a]/90 to-transparent" />

      <button
        onClick={hide}
        aria-label="বন্ধ করুন"
        className="absolute right-2.5 top-2.5 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/45 text-white/80 backdrop-blur transition hover:bg-black/70"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative z-[1] max-w-[62%] p-4 sm:p-5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-black tracking-wide text-amber-300 ring-1 ring-amber-300/40">
          <Sparkles className="h-3 w-3" /> পরীক্ষামূলক অফার
        </div>
        <h3 className="mt-2 text-[15px] font-black leading-snug text-white">
          Ads-এ <span className="text-amber-300">"Continue"</span> দিন,
          <br />
          মাইনিং বোনাস বাড়ান! 🚀
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-100/85">
          অ্যাপে মাঝে মাঝে যে Ads আসে — সেখানে Continue দিলে আমাদের আয় বাড়ে,
          আর সেই আয় থেকেই আপনাদের মাইনিং রিওয়ার্ড ও বোনাস দেওয়া হয়।
          Continue দিয়ে অ্যাপে ফিরে আসলেই হিসাব হয় — ২ সেকেন্ডের ব্যাপার!
        </p>
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1.5 text-[11px] font-black text-white shadow-lg">
          <TrendingUp className="h-3.5 w-3.5" /> বেশি Continue = বেশি বোনাস পুল
        </div>
      </div>
    </div>
  );
}
