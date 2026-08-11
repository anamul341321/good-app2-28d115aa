import { useEffect, useState } from "react";
import { Sparkles, Flame, Clock } from "lucide-react";

type PromoRates = {
  promo_active: boolean;
  promo_title: string | null;
  promo_start_at: string | null;
  promo_end_at: string | null;
  first_verify_bonus: number;
  reverify_bonus: number;
  referrer_bonus: number;
  base_first_verify_bonus: number;
  base_reverify_bonus: number;
  base_referrer_bonus: number;
};

function formatCountdown(msLeft: number): { d: number; h: number; m: number; s: number } {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

export function PromoBanner({ rates }: { rates?: PromoRates | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!rates || !rates.promo_active || !rates.promo_end_at) return null;
  const endMs = new Date(rates.promo_end_at).getTime();
  const left = endMs - now;
  if (left <= 0) return null;
  const { d, h, m, s } = formatCountdown(left);

  const rows: Array<{ label: string; icon: string; old: number; nu: number }> = [
    { label: "প্রথম ১০ স্লট verify", icon: "✅", old: rates.base_first_verify_bonus, nu: rates.first_verify_bonus },
    { label: "১০ স্লট Re-verify",   icon: "🔄", old: rates.base_reverify_bonus,     nu: rates.reverify_bonus },
    { label: "প্রতি সফল Refer",     icon: "👥", old: rates.base_referrer_bonus,    nu: rates.referrer_bonus },
  ].filter((r) => r.nu > 0);

  return (
    <div className="promo-banner relative overflow-hidden rounded-3xl p-4 text-white shadow-2xl">
      <div className="promo-shimmer" />
      <div className="promo-fire">
        <span style={{ left: "6%" }}>🔥</span>
        <span style={{ left: "26%", animationDelay: "0.4s" }}>🔥</span>
        <span style={{ left: "48%", animationDelay: "0.8s" }}>🔥</span>
        <span style={{ left: "70%", animationDelay: "0.2s" }}>🔥</span>
        <span style={{ left: "88%", animationDelay: "1.1s" }}>🔥</span>
      </div>

      <div className="promo-sparkles">
        <span style={{ top: "12%", left: "10%" }} />
        <span style={{ top: "30%", right: "12%", animationDelay: "0.6s" }} />
        <span style={{ bottom: "18%", left: "40%", animationDelay: "1.1s" }} />
        <span style={{ bottom: "10%", right: "24%", animationDelay: "0.3s" }} />
      </div>

      <div className="relative flex items-start gap-2">
        <div className="shrink-0 w-11 h-11 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center border border-white/40 shadow-lg">
          <Flame className="w-6 h-6 text-yellow-100 drop-shadow" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] uppercase tracking-[0.25em] font-black flex items-center gap-1 text-yellow-100">
            <Sparkles className="w-3 h-3" /> Limited Time · SPECIAL BONUS
          </p>
          <p className="text-[15px] font-black leading-tight mt-0.5 drop-shadow">
            {rates.promo_title || "🎊 স্পেশাল বোনাস অফার!"}
          </p>
          <p className="text-[10px] text-white/90 mt-0.5">
            এই সময়ের মধ্যে নিচের স্পেশাল রেটে বোনাস পাবেন।
          </p>
        </div>
      </div>

      {/* Countdown */}
      <div className="relative mt-3 grid grid-cols-4 gap-1.5">
        {[
          { v: d, l: "দিন" }, { v: h, l: "ঘণ্টা" },
          { v: m, l: "মিনিট" }, { v: s, l: "সেকেন্ড" },
        ].map((c, i) => (
          <div key={i} className="rounded-xl bg-black/25 backdrop-blur border border-white/25 py-2 text-center">
            <p className="mono-num font-black text-lg text-yellow-100 leading-none">
              {String(c.v).padStart(2, "0")}
            </p>
            <p className="text-[8px] uppercase tracking-wider opacity-90 mt-0.5">{c.l}</p>
          </div>
        ))}
      </div>

      {/* Rate rows */}
      <div className="relative mt-3 space-y-1.5">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl bg-white/15 backdrop-blur border border-white/25 px-3 py-2 flex items-center gap-2">
            <span className="text-lg shrink-0">{r.icon}</span>
            <span className="flex-1 text-[11px] font-bold text-white/95 truncate">{r.label}</span>
            <span className="text-[11px] font-black mono-num text-white/70 line-through">
              {r.old}৳
            </span>
            <span className="text-[11px] font-black">→</span>
            <span className="text-[14px] font-black mono-num text-yellow-100 drop-shadow">
              {r.nu}৳
            </span>
          </div>
        ))}
      </div>

      <p className="relative mt-2.5 text-[10px] flex items-center gap-1 text-yellow-100 font-bold">
        <Clock className="w-3 h-3" /> অফার শেষ হবে {new Date(endMs).toLocaleDateString("bn-BD")} — দেরি না করে শুরু করুন!
      </p>

      <div className="promo-urgent relative mt-2 rounded-2xl border border-yellow-200/60 bg-black/30 px-3 py-2 text-center">
        <p className="text-[11px] font-black text-yellow-100 leading-snug">
          🔥 সময় শেষ হওয়ার আগেই স্পেশাল বোনাসটা নিয়ে নিন 🔥
        </p>
        <p className="text-[9px] text-white/85 mt-0.5">
          {d > 0 ? `আর মাত্র ${d} দিন বাকি` : `আর মাত্র ${h} ঘণ্টা বাকি`} — ১০টি স্লট verify করে স্পেশাল বোনাস পেতে পারেন।
        </p>
      </div>
    </div>
  );
}
