import { Flame, TrendingUp } from "lucide-react";

const ROWS = [
  { slots: "১০ স্লট", amount: 500 },
  { slots: "২০ স্লট", amount: 1000 },
  { slots: "৩০ স্লট", amount: 1500 },
  { slots: "৪০ স্লট", amount: 2000 },
];

/**
 * মাসিক মাইনিং রেট ব্যানার — সবসময় দেখাবে (২X অফার শেষ হয়ে গেলেও)।
 */
export function RatesBanner() {
  return (
    <div className="promo-banner relative overflow-hidden rounded-3xl p-4 text-white shadow-2xl">
      <div className="promo-shimmer" />
      <div className="promo-fire">
        <span style={{ left: "8%" }}>🔥</span>
        <span style={{ left: "28%", animationDelay: "0.5s" }}>🔥</span>
        <span style={{ left: "50%", animationDelay: "0.9s" }}>🔥</span>
        <span style={{ left: "72%", animationDelay: "0.3s" }}>🔥</span>
        <span style={{ left: "90%", animationDelay: "1.2s" }}>🔥</span>
      </div>

      <div className="relative flex items-start gap-2">
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center border border-white/40 shadow-lg">
          <TrendingUp className="w-6 h-6 text-yellow-100 drop-shadow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] font-black flex items-center gap-1 text-yellow-100">
            <Flame className="w-3 h-3" /> Monthly Mining Rate
          </p>
          <p className="text-[15px] font-black leading-tight mt-0.5 drop-shadow">
            স্লট যত বেশি, প্রতি মাসের ইনকাম তত বেশি 🚀
          </p>
          <p className="text-[10px] text-white/90 mt-0.5">
            ১০টি স্লট রি-ভেরিফাই করে সম্পন্ন করলেই মাসিক মাইনিং চালু হয়ে যাবে।
          </p>
        </div>
      </div>

      <div className="relative mt-3 space-y-1.5">
        {ROWS.map((r) => (
          <div
            key={r.slots}
            className="rounded-xl bg-white/15 backdrop-blur border border-white/25 px-3 py-2 flex items-center gap-2"
          >
            <span className="text-lg shrink-0">⛏️</span>
            <span className="flex-1 text-[11px] font-bold text-white/95 truncate">{r.slots} সম্পন্ন</span>
            <span className="text-[11px] font-black">→</span>
            <span className="text-[15px] font-black mono-num text-yellow-100 drop-shadow">{r.amount}৳</span>
            <span className="text-[9px] font-bold text-white/80">/মাস</span>
          </div>
        ))}
      </div>

      <p className="relative mt-2.5 text-center text-[10px] font-bold text-yellow-100">
        📈 হিসাব সহজ — ১ স্লট = মাসে ৫০৳, সারাজীবনের ইনকাম!
      </p>
    </div>
  );
}
