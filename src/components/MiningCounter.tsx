import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { computeLiveBalance } from "@/lib/mining";
import { miningWindowInfo, nextOpenLabelBn } from "@/lib/mining-window";
import { Wallet, Sparkles, Gem } from "lucide-react";

type Props = {
  accrued: number;
  withdrawn: number;
  isActive: boolean;
  lastCreditedAt: string | null;
  effectiveTaskCount?: number;
  qualifyingReferees?: number;
  displayTaskCount?: number;
};

export function MiningCounter({
  accrued, withdrawn, isActive, lastCreditedAt,
  effectiveTaskCount = 0, qualifyingReferees = 0, displayTaskCount,
}: Props) {
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isActive]);

  const balance = computeLiveBalance({
    accrued, withdrawn, isActive, lastCreditedAt,
    effectiveTaskCount, qualifyingReferees, now,
  });
  const live = isActive && (effectiveTaskCount > 0 || qualifyingReferees > 0);
  const shownSlots = Math.max(effectiveTaskCount, displayTaskCount ?? 0);
  const ratePerMonth = 500 * (shownSlots / 10 + 0.10 * qualifyingReferees);
  const bonusMonth = 500 * 0.10 * qualifyingReferees;
  const claimable = Math.floor(balance);

  const win = miningWindowInfo(now);
  const withdrawOpen = win.isOpen;
  const hoursUntilClose = Math.ceil(win.msUntilClose / (60 * 60 * 1000));
  const nextOpen = nextOpenLabelBn(now);

  // Split integer/decimal for premium digit display
  const [intPart, decPart] = balance.toFixed(6).split(".");

  return (
    <div className="mc-premium relative rounded-[28px] p-6 overflow-hidden">
      {/* Deep gradient base */}
      <div className="absolute inset-0 mc-base pointer-events-none" aria-hidden />
      {/* Mesh glow orbs */}
      <div className="absolute -top-16 -left-10 w-56 h-56 rounded-full blur-3xl opacity-70 pointer-events-none mc-orb-a" aria-hidden />
      <div className="absolute -bottom-20 -right-16 w-64 h-64 rounded-full blur-3xl opacity-60 pointer-events-none mc-orb-b" aria-hidden />
      {/* Fine grain / holo lines */}
      <div className="absolute inset-0 mc-holo opacity-50 pointer-events-none mix-blend-overlay" aria-hidden />
      {/* Rotating ring */}
      <div className="absolute -inset-1 mc-ring pointer-events-none" aria-hidden />

      {live && (
        <>
          {/* Sparkles */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            {[
              { l: "12%", t: "22%", d: "0s", e: "✦" },
              { l: "82%", t: "18%", d: "0.7s", e: "✧" },
              { l: "68%", t: "72%", d: "1.4s", e: "💎" },
              { l: "22%", t: "68%", d: "2.1s", e: "⭐" },
              { l: "50%", t: "10%", d: "1.0s", e: "✨" },
            ].map((s, i) => (
              <span key={i} className="mc-sparkle"
                style={{ left: s.l, top: s.t, animationDelay: s.d }}>
                {s.e}
              </span>
            ))}
          </div>
          {/* Falling coin trail */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="mc-coin"
                style={{ left: `${15 + i * 22}%`, animationDelay: `${i * 0.8}s`, animationDuration: `${5 + (i % 2)}s` }}>
                ⛏
              </span>
            ))}
          </div>
        </>
      )}

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mc-chip">
            {live ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 animate-ping opacity-80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                <span className="text-[10px] font-black tracking-[0.15em] text-white/95">লাইভ মাইনিং</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-white/80" />
                <span className="text-[10px] font-black tracking-[0.15em] text-white/85">মাইনিং লক</span>
              </>
            )}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/12 border border-white/20 backdrop-blur-md">
            <Gem className="w-3 h-3 text-yellow-200" />
            <span className="text-[9px] font-black tracking-widest text-yellow-100">PREMIUM</span>
          </div>
        </div>

        {/* Balance */}
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-black mb-1">Balance</p>
          <div className="flex items-baseline justify-center gap-1 flex-wrap">
            <span className={`mono-num text-[3.6rem] leading-none font-black mc-num ${live ? "mc-num-live" : ""}`}>
              {intPart}
            </span>
            <span className="mono-num text-lg leading-none font-black text-white/60">
              .{decPart}
            </span>
          </div>
          <p className="text-sm font-black text-yellow-100 mt-2 drop-shadow tracking-wide">৳ টাকা</p>
        </div>

        {/* Rate stat pills */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="mc-stat rounded-xl p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">সক্রিয় ঘর</p>
            <p className="mono-num text-lg font-black text-white mt-0.5">{shownSlots}<span className="text-xs text-white/50">/10</span></p>
          </div>
          <div className="mc-stat rounded-xl p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">মাসিক রেট</p>
            <p className="mono-num text-lg font-black text-yellow-100 mt-0.5">{ratePerMonth.toFixed(0)}<span className="text-xs text-white/60">৳</span></p>
          </div>
        </div>

        {!live && (
          <p className="text-[11px] text-white/70 text-center mt-3 font-bold">
            ১০টি ঘর সম্পন্ন করলে মাইনিং শুরু হবে
          </p>
        )}

        {qualifyingReferees > 0 && (
          <p className="mt-3 mx-auto w-fit rounded-full px-3 py-1.5 text-[11px] font-black flex items-center gap-1.5"
             style={{
               background: "linear-gradient(90deg, rgba(52,211,153,0.35), rgba(34,211,238,0.35))",
               border: "1px solid rgba(255,255,255,0.25)",
               color: "white",
             }}>
            🎁 {qualifyingReferees} জন রেফার · +{bonusMonth.toFixed(0)}৳/মাস
          </p>
        )}

        {/* Withdraw window ribbon */}
        {live && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-[11px] font-black flex items-center justify-between gap-2 border ${withdrawOpen ? "mc-ribbon-open" : "mc-ribbon-closed"}`}>
            <span className="flex items-center gap-1.5">
              {withdrawOpen ? "🔓" : "🔒"}
              <span className="text-white/95">
                {withdrawOpen ? `উইথড্র উইন্ডো খোলা · আর ${hoursUntilClose}ঘ` : `${nextOpen} উইথড্র`}
              </span>
            </span>
            <span className="text-[9px] text-white/75 uppercase tracking-widest">১–৩ তারিখ</span>
          </div>
        )}

        {live && claimable > 0 && (
          <button
            onClick={() => navigate({ to: "/withdraw" })}
            className="mt-3 w-full rounded-2xl py-3.5 font-black text-sm flex items-center justify-center gap-2 btn-press mc-cta"
          >
            <Wallet className="w-4 h-4" />
            💰 {claimable}৳ ক্লেইম ও উইথড্র
          </button>
        )}
      </div>
    </div>
  );
}
