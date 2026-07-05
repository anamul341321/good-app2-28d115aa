import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { computeLiveBalance } from "@/lib/mining";
import { Wallet } from "lucide-react";

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
  // Display uses visible submitted-slot count so "N slots × 50৳" matches the UI.
  const shownSlots = Math.max(effectiveTaskCount, displayTaskCount ?? 0);
  const ratePerMonth = 500 * (shownSlots / 10 + 0.10 * qualifyingReferees);
  const bonusMonth = 500 * 0.10 * qualifyingReferees;
  const claimable = Math.floor(balance);

  return (
    <div className="mining-card mining-card-morph relative rounded-3xl p-7 text-center overflow-hidden">
      {live && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {[
            { l: "10%", t: "70%", sx: "22px", sy: "-70px", d: "0s",  e: "✨" },
            { l: "84%", t: "60%", sx: "-28px", sy: "-80px", d: "0.6s", e: "⭐" },
            { l: "48%", t: "82%", sx: "0px", sy: "-90px", d: "1.2s", e: "💎" },
            { l: "28%", t: "18%", sx: "22px", sy: "45px",  d: "1.8s", e: "✦" },
            { l: "70%", t: "16%", sx: "-18px", sy: "55px", d: "2.4s", e: "✧" },
            { l: "55%", t: "45%", sx: "10px", sy: "-30px", d: "3.0s", e: "🌟" },
          ].map((s, i) => (
            <span key={i} className="mining-sparkle"
              style={{ left: s.l, top: s.t, ["--sx" as any]: s.sx, ["--sy" as any]: s.sy, animationDelay: s.d }}>
              {s.e}
            </span>
          ))}
        </div>
      )}
      <div className="mining-ring absolute -inset-1 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 gradient-aurora opacity-30 pointer-events-none" />
      <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full blur-3xl opacity-60 pointer-events-none animate-pulse"
           style={{ background: "var(--color-rose)" }} />
      <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full blur-3xl opacity-50 pointer-events-none animate-pulse"
           style={{ background: "var(--color-amber)", animationDuration: "3.5s" }} />

      {live && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="mining-coin"
              style={{
                left: `${8 + i * 16}%`,
                animationDelay: `${i * 0.55}s`,
                animationDuration: `${4 + (i % 3)}s`,
              }}
            >⛏</span>
          ))}
        </div>
      )}

      <div className="relative">
        <p className="text-sm font-black mb-3"
           style={{ color: "color-mix(in oklch, white 90%, transparent)" }}>
          {live ? (
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald animate-ping opacity-80" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald" />
              </span>
              লাইভ মাইনিং ব্যালেন্স
            </span>
          ) : "🔒 মাইনিং লক"}
        </p>

        <p className={`mining-number mono-num text-[3.4rem] leading-none font-black bg-gradient-to-r from-amber-200 via-white to-rose-200 bg-clip-text text-transparent ${live ? "shine" : ""}`}>
          {balance.toFixed(6)}
        </p>
        <p className="text-sm font-black text-white mt-2 drop-shadow">৳ টাকা</p>

        <p className="text-xs mt-3 font-bold" style={{ color: "color-mix(in oklch, white 88%, transparent)" }}>
          {live
            ? `${shownSlots} ঘর সক্রিয় · ${ratePerMonth.toFixed(0)}৳ / মাস`
            : "১০টি ঘর সম্পন্ন করলে মাইনিং শুরু হবে"}
        </p>


        {qualifyingReferees > 0 && (
          <p className="mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-black bounce-soft"
             style={{
               background: "color-mix(in oklch, var(--color-emerald) 32%, transparent)",
               border: "1px solid color-mix(in oklch, var(--color-emerald) 55%, transparent)",
               color: "white",
             }}>
            🎁 {qualifyingReferees} জন রেফার · +{bonusMonth.toFixed(0)}৳ বোনাস/মাস
          </p>
        )}

        {live && claimable > 0 && (
          <button
            onClick={() => navigate({ to: "/withdraw" })}
            className="mt-3 w-full rounded-2xl py-3 font-black text-sm flex items-center justify-center gap-2 btn-press shine"
            style={{
              background: "linear-gradient(120deg, #ffd166, #ef476f 50%, #ffb86b)",
              color: "#3a0a1a",
              boxShadow: "0 18px 40px -12px rgba(239,71,111,0.6)",
            }}
          >
            <Wallet className="w-4 h-4" />
            💰 {claimable}৳ ক্লেইম ও উইথড্র
          </button>
        )}
      </div>
    </div>
  );
}
