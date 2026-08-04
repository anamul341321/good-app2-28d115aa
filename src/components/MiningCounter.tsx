import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { computeLiveBalance, monthlyRate, MONTHLY_PER_SLOT } from "@/lib/mining";
import { miningWindowInfo, nextOpenLabelBn } from "@/lib/mining-window";
import { Wallet, Sparkles } from "lucide-react";

type Props = {
  accrued: number;
  withdrawn: number;
  isActive: boolean;
  lastCreditedAt: string | null;
  effectiveTaskCount?: number;
  qualifyingReferees?: number;
  selfSlots?: number;
  referralUnits?: number;
  selfQualified?: boolean;

  displayTaskCount?: number;
  leagueCount?: number;
  bonusTotal?: number;
  referralAccrued?: number;
};



// League tiers based on total submitted slots.
function leagueFor(n: number): { name: string; emoji: string; from: string; to: string } | null {
  if (n >= 100) return { name: "লিজেন্ড", emoji: "👑", from: "#facc15", to: "#f59e0b" };
  if (n >= 50)  return { name: "ডায়মন্ড", emoji: "💎", from: "#22d3ee", to: "#8b5cf6" };
  if (n >= 30)  return { name: "গোল্ড",   emoji: "🥇", from: "#fbbf24", to: "#f97316" };
  if (n >= 20)  return { name: "সিলভার", emoji: "🥈", from: "#e5e7eb", to: "#94a3b8" };
  if (n >= 10)  return { name: "ব্রোঞ্জ", emoji: "🥉", from: "#f97316", to: "#b45309" };
  return null;
}

export function MiningCounter({
  accrued, withdrawn, isActive, lastCreditedAt,
  effectiveTaskCount = 0, qualifyingReferees = 0,
  selfSlots: selfSlotsProp, referralUnits: referralUnitsProp,
  selfQualified = true, displayTaskCount, leagueCount,
  bonusTotal = 0, referralAccrued = 0,
}: Props) {

  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [isActive]);

  const rateArgs = {
    selfSlots: selfSlotsProp,
    referralUnits: referralUnitsProp,
    effectiveTaskCount,
    qualifyingReferees,
    selfQualified,
  };
  const balance = computeLiveBalance({
    accrued, withdrawn, isActive, lastCreditedAt, ...rateArgs, now,
  });
  // Self mining only counts after the user's own 10 re-verifies are done.
  const rawSelfSlots = selfSlotsProp ?? effectiveTaskCount;
  const selfSlots = selfQualified ? rawSelfSlots : 0;
  const refUnits = referralUnitsProp ?? qualifyingReferees;
  const live = isActive && (selfSlots > 0 || refUnits > 0);
  const shownSlots = selfSlots;
  const ratePerMonth = monthlyRate(rateArgs);
  const selfMonth = MONTHLY_PER_SLOT * selfSlots;
  const bonusMonth = MONTHLY_PER_SLOT * refUnits;
  const claimable = Math.floor(balance);
  const league = leagueFor(leagueCount ?? Math.max(effectiveTaskCount, displayTaskCount ?? 0));



  // Balance split (same rule the withdraw server uses): withdrawals are taken
  // from bonus first, so the remaining bonus part is what's still un-withdrawn.
  const bonusPart = Math.max(0, Math.min(bonusTotal, Math.max(0, bonusTotal - withdrawn)));
  const miningPart = Math.max(0, balance - bonusPart);
  const refPart = Math.min(miningPart, Math.max(0, referralAccrued));
  const selfPart = Math.max(0, miningPart - refPart);


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
          {league ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full backdrop-blur-md border border-white/25 shadow"
                 style={{ background: `linear-gradient(135deg, ${league.from}, ${league.to})` }}>
              <span className="text-[11px]">{league.emoji}</span>
              <span className="text-[9px] font-black tracking-widest text-white drop-shadow">{league.name} লিগ</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[9px] font-black tracking-widest text-white/70">লিগ · লক</span>
            </div>
          )}
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

        {/* Balance split — mining vs bonus, in plain Bengali */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl p-2.5 border border-white/20 bg-white/10 backdrop-blur-md">
            <p className="text-[9px] font-black tracking-widest text-white/70">⛏️ মাইনিং ব্যালেন্স</p>
            <p className="mono-num text-base font-black text-cyan-100 mt-0.5">{miningPart.toFixed(2)}<span className="text-[10px] text-white/60">৳</span></p>
            <p className="text-[8px] text-white/60 leading-tight mt-0.5">
              নিজের {selfPart.toFixed(2)}৳ + রেফার ১০% {refPart.toFixed(2)}৳ · ১–৩ তারিখে তোলা যাবে
            </p>
          </div>
          <div className="rounded-2xl p-2.5 border border-white/20 bg-white/10 backdrop-blur-md">
            <p className="text-[9px] font-black tracking-widest text-white/70">🎁 বোনাস ব্যালেন্স</p>
            <p className="mono-num text-base font-black text-yellow-100 mt-0.5">{bonusPart.toFixed(2)}<span className="text-[10px] text-white/60">৳</span></p>
            <p className="text-[8px] text-white/60 leading-tight mt-0.5">
              ফার্স্ট/রি-ভেরিফাই ও রেফার বোনাস · যেকোনো সময় তোলা যাবে
            </p>
          </div>
        </div>


        {/* Rate stat pills */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="mc-stat rounded-xl p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">মাইনিং ঘর</p>
            <p className="mono-num text-lg font-black text-white mt-0.5">
              {shownSlots}<span className="text-xs text-white/50">টি</span>
            </p>
            <p className="text-[8px] text-white/55 leading-tight">প্রতি ঘর {MONTHLY_PER_SLOT}৳/মাস</p>
          </div>
          <div className="mc-stat rounded-xl p-2.5">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">মাসিক রেট</p>
            {live ? (
              <>
                <p className="mono-num text-lg font-black text-yellow-100 mt-0.5">{ratePerMonth.toFixed(0)}<span className="text-xs text-white/60">৳</span></p>
                <p className="text-[8px] text-white/55 leading-tight mono-num">
                  নিজের {selfMonth.toFixed(0)}৳ + রেফার {bonusMonth.toFixed(0)}৳
                </p>
              </>
            ) : (
              <p className="text-[10px] font-black text-white/70 mt-1 leading-tight">🔒 ১০টি রি-ভেরিফাই <br/>সম্পন্ন হলে দেখাবে</p>
            )}
          </div>
        </div>

        {!live && (
          <p className="text-[11px] text-white/70 text-center mt-3 font-bold">
            ১০টি ঘর রি-ভেরিফাই সম্পন্ন করলে মাইনিং চালু · এরপর প্রতিটি বাড়তি রি-ভেরিফাই ঘরে +{MONTHLY_PER_SLOT}৳/মাস
          </p>
        )}

        {live && shownSlots > 10 && (
          <p className="text-[10px] text-white/70 text-center mt-2 font-bold">
            ✨ ১০ ঘরের পর আরও {shownSlots - 10}টি ঘর রি-ভেরিফাই — বাড়তি +{(MONTHLY_PER_SLOT * (shownSlots - 10)).toFixed(0)}৳/মাস
          </p>
        )}

        {refUnits > 0 && (
          <p className="mt-3 mx-auto w-fit rounded-full px-3 py-1.5 text-[11px] font-black flex items-center gap-1.5"
             style={{
               background: "linear-gradient(90deg, rgba(52,211,153,0.35), rgba(34,211,238,0.35))",
               border: "1px solid rgba(255,255,255,0.25)",
               color: "white",
             }}>
            🎁 {qualifyingReferees} জন রেফার · তাদের আয়ের ১০% = +{bonusMonth.toFixed(0)}৳/মাস
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
