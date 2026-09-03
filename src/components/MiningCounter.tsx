import { memo, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { computeLiveBalance, monthlyRate, MONTHLY_PER_SLOT } from "@/lib/mining";
import { claimMiningToMain, claimAllSlotMining } from "@/lib/earnings.functions";
import { Wallet, Sparkles, Gift, Loader2, Pickaxe, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Decorative layers never change — memoised so the 1s balance tick doesn't repaint them. */
const MiningDecor = memo(function MiningDecor({ live }: { live: boolean }) {
  return (
    <>
      <div className="absolute inset-0 mc-base pointer-events-none" aria-hidden />
      <div className="absolute -top-14 -left-10 w-48 h-48 rounded-full blur-3xl opacity-40 pointer-events-none mc-orb-a" aria-hidden />
      <div className="absolute -bottom-16 -right-14 w-56 h-56 rounded-full blur-3xl opacity-35 pointer-events-none mc-orb-b" aria-hidden />
      <div className="absolute inset-0 mc-holo opacity-20 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 mc-aurora opacity-30 pointer-events-none" aria-hidden />
      {live && <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden><span className="mc-sheen" /></div>}
      <div className="absolute -inset-1 mc-ring pointer-events-none" aria-hidden />

      {live && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {[
            { l: "12%", t: "20%", d: "0s", e: "✦" },
            { l: "84%", t: "16%", d: "1.1s", e: "✧" },
          ].map((s, i) => (
            <span key={i} className="mc-sparkle" style={{ left: s.l, top: s.t, animationDelay: s.d }}>
              {s.e}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

/** Money that visibly counts up — each digit change gets a soft roll + glow. */
function AnimatedMoney({ value, live }: { value: number; live: boolean }) {
  const [intPart, decPart] = value.toFixed(2).split(".");
  const prev = useRef(intPart);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (prev.current !== intPart) {
      prev.current = intPart;
      setBump((b) => b + 1);
    }
  }, [intPart]);
  return (
    <div className="flex items-baseline justify-center gap-1 flex-nowrap whitespace-nowrap">
      <span key={bump}
        className={`mono-num text-[2.7rem] leading-none font-black mc-num mc-roll ${live ? "mc-num-live" : ""}`}>
        {intPart}
      </span>
      <span className="mono-num text-base leading-none font-black text-white/60 mc-dec">.{decPart}</span>
      <span className="text-sm font-black text-yellow-100 ml-1 drop-shadow">৳</span>
    </div>
  );
}

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
  miningWithdrawn?: number;
  balanceBreakdown?: {
    total_accrued: number;
    bonus_part: number;
    mining_part: number;
    mining_available?: number;
    mining_locked?: number;
    self_mining_total?: number;
    self_mining_locked?: number;
    self_mining_claimable?: number;

    self_mining_pending?: number;
    self_mining_claimed?: number;
    referral_mining_total?: number;
    referral_mining_available?: number;
    referral_mining_claimed?: number;
    withdrawn_total: number;
    current_balance: number;
  };
};

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
  balanceBreakdown,
}: Props) {

  const [now, setNow] = useState(Date.now());
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: () => claimMiningToMain(),
    onSuccess: (res: any) => {
      toast.success(`🎉 রেফার ১০% কমিশন ${Number(res?.amount ?? 0).toFixed(2)}৳ মেইন ব্যালেন্সে যোগ হয়েছে`);
      void qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম করা যায়নি"),
  });
  const claimAll = useMutation({
    mutationFn: () => claimAllSlotMining(),
    onSuccess: (res: any) => {
      toast.success(
        `⛏️ সব ঘরের মাইনিং ${Number(res?.mining ?? 0).toFixed(2)}৳ মেইন ব্যালেন্সে যোগ হয়েছে` +
          ` · ${Number(res?.slots ?? 0)}টি ঘর`,
      );
      void qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম করা যায়নি"),
  });


  useEffect(() => {
    if (!isActive) return;
    let id: any;
    const start = () => {
      stop();
      id = setInterval(() => setNow(Date.now()), 1000);
    };
    const stop = () => { if (id) { clearInterval(id); id = undefined; } };
    const onVis = () => (document.hidden ? stop() : (setNow(Date.now()), start()));
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [isActive]);

  const rateArgs = {
    selfSlots: selfSlotsProp,
    referralUnits: referralUnitsProp,
    effectiveTaskCount,
    qualifyingReferees,
    selfQualified,
  };
  
  // Audited values from breakdown
  const auditedBalance = balanceBreakdown?.current_balance ?? 0;
  const bonusPart = balanceBreakdown?.bonus_part ?? 0;
  const miningPart = balanceBreakdown?.mining_part ?? 0;
  const miningAvailable = balanceBreakdown?.mining_available ?? miningPart;
  const selfMiningTotal = Math.max(0, balanceBreakdown?.self_mining_total ?? 0);
  const selfMiningLocked = Math.max(0, balanceBreakdown?.self_mining_locked ?? 0);
  const selfMiningClaimable = Math.max(0, balanceBreakdown?.self_mining_claimable ?? selfMiningLocked);
  const selfMiningReverifyLocked = Math.max(0, selfMiningLocked - selfMiningClaimable);

  const selfMiningPending = Math.max(0, balanceBreakdown?.self_mining_pending ?? 0);
  const selfMiningClaimed = Math.max(0, balanceBreakdown?.self_mining_claimed ?? 0);
  const referralMiningTotal = Math.max(0, balanceBreakdown?.referral_mining_total ?? 0);
  const referralMiningAvailable = Math.max(0, balanceBreakdown?.referral_mining_available ?? miningAvailable);
  const referralMiningClaimed = Math.max(0, balanceBreakdown?.referral_mining_claimed ?? 0);

  // We compute live balance for the "ticker" effect only for the MINING part accrued
  // since the last ledger entry, to ensure the total balance is anchored to audited data.
  const liveMiningBalance = computeLiveBalance({
    accrued, withdrawn, isActive, lastCreditedAt, ...rateArgs, now,
  });
  
  // The increment is the difference between the live computed value and the last recorded value in mining_state.
  const liveIncrement = Math.max(0, liveMiningBalance - (accrued - withdrawn));
  
  // displayBalance is anchored to the audited ledger total + the live mining increment.
  // We floor to avoid floating point jitter.
  const displayBalance = Math.floor(isActive ? (auditedBalance + liveIncrement) : auditedBalance);

  const rawSelfSlots = selfSlotsProp ?? effectiveTaskCount;
  const selfSlots = selfQualified ? rawSelfSlots : 0;
  // referralUnits is in "slot units": প্রতি রেফারির প্রতি স্লটে ০.১ ইউনিট (=৫৳/মাস)।
  // পুরনো fallback রেফারির সংখ্যাকেই ইউনিট ধরত, তাতে রেট ১০ গুণ বেশি দেখাত।
  const refUnits = referralUnitsProp ?? qualifyingReferees * 0.1;

  const live = isActive && (selfSlots > 0 || refUnits > 0);
  const shownSlots = selfSlots;
  const ratePerMonth = monthlyRate(rateArgs);
  const selfMonth = MONTHLY_PER_SLOT * selfSlots;
  const bonusMonth = MONTHLY_PER_SLOT * refUnits;
  const claimable = Math.floor(bonusPart + miningAvailable);
  const league = leagueFor(leagueCount ?? Math.max(effectiveTaskCount, displayTaskCount ?? 0));

  // দিনে কত আসে — মাসিক রেট ÷ ৩০
  const perDay = ratePerMonth / 30;

  return (
    <div className="mc-premium relative rounded-[24px] p-4 overflow-hidden" style={{ contain: "paint" }}>
      <MiningDecor live={live} />

      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full mc-chip">
            {live ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 animate-ping opacity-80" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                <span className="text-[9px] font-black tracking-[0.15em] text-white/95">লাইভ মাইনিং</span>
              </>
            ) : (
              <>
                <Sparkles className="w-2.5 h-2.5 text-white/80" />
                <span className="text-[9px] font-black tracking-[0.15em] text-white/85">মাইনিং লক</span>
              </>
            )}
          </div>
          {league ? (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full backdrop-blur-md border border-white/25 shadow"
                 style={{ background: `linear-gradient(135deg, ${league.from}, ${league.to})` }}>
              <span className="text-[10px]">{league.emoji}</span>
              <span className="text-[8px] font-black tracking-widest text-white drop-shadow">{league.name} লিগ</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
              <span className="text-[8px] font-black tracking-widest text-white/70">লিগ · লক</span>
            </div>
          )}
        </div>

        {/* bKash-এর মতো — ট্যাপ করলেই ব্যালেন্স দেখা যাবে */}
        {revealed ? (
          <button type="button" onClick={() => setRevealed(false)} className="w-full text-center btn-press">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/60 font-black">Total Balance</p>
            <AnimatedMoney value={displayBalance} live={live} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="mt-1 w-full rounded-2xl border border-white/25 bg-white/10 px-3 py-3 backdrop-blur-md btn-press flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4 text-white/85" />
            <span className="text-[13px] font-black text-white">ব্যালেন্স দেখুন</span>
          </button>
        )}

        {/* ডিটেইলস — চাইলে পুরো হিসাব খুলবে, নাহলে কার্ড ছোটই থাকবে */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-[11px] font-black text-white/90 btn-press flex items-center justify-center gap-1.5"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "ডিটেইলস বন্ধ করুন" : "ডিটেইলস দেখুন"}
        </button>

        {expanded && (<>
        <div className={`mt-2.5 rounded-xl px-2.5 py-1.5 text-[10px] font-black flex items-center justify-between gap-2 border ${live ? "mc-ribbon-open" : "mc-ribbon-closed"}`}>
          <span className="flex items-center gap-1.5 min-w-0">
            <span>{live ? "🟢" : "🔴"}</span>
            <span className="text-white/95 truncate">
              {live
                ? `মাইনিং চালু · ${shownSlots}টি ঘর · দিনে ${perDay.toFixed(2)}৳`
                : "মাইনিং বন্ধ — ১টি ঘর রি-ভেরিফাই করলেই চালু"}
            </span>
          </span>
          <span className="text-[8px] text-white/80 uppercase tracking-widest shrink-0">
            {live ? "LIVE" : "OFF"}
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="mc-mini rounded-2xl p-2">
            <p className="text-[8px] font-black tracking-widest text-white/70">⛏️ নিজের স্লট মাইনিং</p>
            <p className="mono-num text-[15px] font-black text-cyan-100 leading-none mt-0.5 mc-mini-num">
              {selfMiningTotal.toFixed(2)}<span className="text-[9px] text-white/60">৳</span>
            </p>
            <p className="text-[7.5px] text-white/60 leading-tight mt-0.5">
              এখনই ক্লেইমযোগ্য {selfMiningClaimable.toFixed(2)}৳ · 🔒 Re-verify বাকি {selfMiningReverifyLocked.toFixed(2)}৳ · আগে ক্লেইম {selfMiningClaimed.toFixed(2)}৳
            </p>

          </div>
          <div className="mc-mini rounded-2xl p-2">
            <p className="text-[8px] font-black tracking-widest text-white/70">🤝 রেফার ১০% কমিশন</p>
            <p className="mono-num text-[15px] font-black text-yellow-100 leading-none mt-0.5 mc-mini-num">
              {referralMiningTotal.toFixed(2)}<span className="text-[9px] text-white/60">৳</span>
            </p>
            <p className="text-[7.5px] text-white/60 leading-tight mt-0.5">
              ক্লেইমযোগ্য {referralMiningAvailable.toFixed(2)}৳ · আগে ক্লেইম {referralMiningClaimed.toFixed(2)}৳
            </p>
          </div>
        </div>

        <div className="mt-2 mc-mini rounded-2xl p-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-[8px] font-black tracking-widest text-white/70">💚 মেইন ব্যালেন্স</p>
            <p className="text-[7.5px] text-white/60 leading-tight mt-0.5">বোনাস + ক্লেইম করা মাইনিং/কমিশন · বোনাস যেকোনো সময়, মাইনিং ১–৩ তারিখে</p>
          </div>
          <p className="mono-num text-[15px] font-black text-yellow-100 shrink-0">{bonusPart.toFixed(2)}৳</p>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="mc-stat rounded-2xl p-2">
            <p className="text-[8px] uppercase tracking-widest text-white/60 font-black">মাইনিং ঘর</p>
            <p className="mono-num text-[15px] font-black text-white leading-none mt-0.5">
              {shownSlots}<span className="text-[10px] text-white/50">টি</span>
            </p>
            <p className="text-[7.5px] text-white/55 leading-tight">প্রতি ঘর {MONTHLY_PER_SLOT}৳/মাস · দিনে {(MONTHLY_PER_SLOT/30).toFixed(2)}৳</p>
          </div>
          <div className="mc-stat rounded-2xl p-2">
            <p className="text-[8px] uppercase tracking-widest text-white/60 font-black">মাসিক রেট</p>
            {live ? (
              <>
                <p className="mono-num text-[15px] font-black text-yellow-100 leading-none mt-0.5">{ratePerMonth.toFixed(0)}<span className="text-[10px] text-white/60">৳</span></p>
                <p className="text-[7.5px] text-white/55 leading-tight mono-num">
                  নিজের {selfMonth.toFixed(0)}৳ + রেফার {bonusMonth.toFixed(0)}৳
                </p>
              </>
            ) : (
              <p className="text-[9px] font-black text-white/70 mt-0.5 leading-tight">🔒 ১টি রি-ভেরিফাই করলেই চালু</p>
            )}
          </div>
        </div>

        {!live && (
          <p className="text-[10px] text-white/70 text-center mt-2 font-bold leading-snug">
যে ঘরটি রি-ভেরিফাই করবেন সেই ঘরেই মাইনিং চালু · প্রতি ঘর +{MONTHLY_PER_SLOT}৳/মাস (দিনে {(MONTHLY_PER_SLOT/30).toFixed(2)}৳)
          </p>
        )}

        {refUnits > 0 && (
          <p className="mt-2 mx-auto w-fit rounded-full px-2.5 py-1 text-[10px] font-black flex items-center gap-1.5"
             style={{
               background: "linear-gradient(90deg, rgba(52,211,153,0.35), rgba(34,211,238,0.35))",
               border: "1px solid rgba(255,255,255,0.25)",
               color: "white",
             }}>
            🎁 {qualifyingReferees} জন রেফার · ১০% = +{bonusMonth.toFixed(0)}৳/মাস
          </p>
        )}

        <p className="mt-1.5 text-[9.5px] text-white/70 font-bold leading-snug text-center">
          📜 নিজের মাইনিং প্রতিটি ঘরের নিচ থেকে <span className="text-cyan-100">স্লট অনুযায়ী</span> ক্লেইম হবে। রেফার করা ইউজারদের মাইনিংয়ের <span className="text-yellow-100">১০% কমিশন</span> উপরের আলাদা বাটন থেকে ক্লেইম হবে। দুটোই ক্লেইমের পর মেইন ব্যালেন্সে যাবে।
        </p>
        </>)}

        {/* ⛏️ মেইন ক্লেইম বাটন — সবসময় দেখা যাবে। ১ ঘণ্টা অ্যাক্টিভ হলেই উজ্জ্বল হয়ে ক্লেইম করতে বলবে */}
        <Button
          disabled={!canClaimNow || claimAll.isPending}
          onClick={() => claimAll.mutate()}
          className={`mt-3 h-auto w-full rounded-2xl py-3 text-[13px] font-black btn-press border whitespace-normal leading-snug ${
            canClaimNow
              ? "mc-claim-glow bg-gradient-to-r from-amber-300 via-yellow-300 to-orange-400 text-amber-950 border-white/50 shadow-xl"
              : "bg-white/10 text-white/70 border-white/20"
          }`}
        >
          {claimAll.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pickaxe className="w-4 h-4" />}
          {canClaimNow
            ? `⚡ এখনই ${selfMiningClaimable.toFixed(2)}৳ মাইনিং ক্লেইম করুন`
            : !activeDone
              ? `⏳ আজ আর ${formatActiveTime(activeLeft)} অ্যাক্টিভ থাকলেই ক্লেইম খুলবে`
              : selfMiningReverifyLocked >= 0.5
                ? `🔒 ${selfMiningReverifyLocked.toFixed(2)}৳ লক — ঘরগুলো Re-verify করলেই খুলবে`
                : "আজকের মাইনিং জমা হলেই এখান থেকে ক্লেইম করুন"}
        </Button>

        {/* 🤝 রেফার কমিশন ক্লেইম */}
        <Button
          disabled={referralMiningAvailable < 0.5 || !activeDone || claim.isPending}
          onClick={() => claim.mutate()}
          className={`mt-2 h-auto w-full rounded-2xl py-2.5 text-[12.5px] font-black btn-press border whitespace-normal leading-snug ${
            referralMiningAvailable >= 0.5 && activeDone
              ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-emerald-950 border-white/40 shadow-lg"
              : "bg-white/10 text-white/60 border-white/20"
          }`}
        >
          {claim.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
          {referralMiningAvailable >= 0.5
            ? activeDone
              ? `রেফার ১০% কমিশন ${referralMiningAvailable.toFixed(2)}৳ ক্লেইম করুন`
              : `⏳ ১ ঘণ্টা অ্যাক্টিভ হলেই ${referralMiningAvailable.toFixed(2)}৳ কমিশন ক্লেইম`
            : "রেফার ১০% কমিশন জমা হলে এখানে ক্লেইম করুন"}
        </Button>

        {/* ⚠️ প্রতিদিন ক্লেইম না করলে ব্যালেন্স হারানোর সতর্কতা */}
        <div className="mt-2.5 rounded-2xl border border-rose-300/45 bg-rose-950/45 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="mt-[2px] h-4 w-4 shrink-0 text-rose-200" />
          <p className="text-[11px] font-bold leading-relaxed text-white">
            <span className="font-black text-rose-100">জরুরি সতর্কতা:</span> প্রতিদিনের মাইনিং{" "}
            <b>প্রতিদিনই ক্লেইম</b> করে মেইন ব্যালেন্সে নিতে হবে। ক্লেইম না করে ফেলে রাখলে জমা মাইনিং{" "}
            <b>হারিয়ে যেতে পারে</b> — তাই ১ ঘণ্টা অ্যাক্টিভ পূরণ করে রোজ ক্লেইম করুন।
          </p>
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate({ to: "/withdraw" })}
            className="rounded-2xl py-2.5 font-black text-[12px] flex items-center justify-center gap-1.5 btn-press mc-cta"
          >
            <Wallet className="w-3.5 h-3.5" />
            {live && claimable > 0 ? `${claimable}৳ উইথড্র` : "উইথড্র"}
          </button>
          <button
            onClick={() => navigate({ to: "/earnings" })}
            className="rounded-2xl py-2.5 font-black text-[12px] text-white flex items-center justify-center gap-1.5 btn-press border border-white/25 bg-white/10 backdrop-blur-md"
          >
            📜 আয়ের হিসাব
          </button>
        </div>

      </div>
    </div>
  );
}
