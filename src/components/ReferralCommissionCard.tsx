import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, TrendingUp, Lock } from "lucide-react";
import { getReferralCommission } from "@/lib/referral-commission.functions";
import { RATE_PER_SLOT_SEC } from "@/lib/mining";

export function ReferralCommissionCard() {
  const fetchCommission = useServerFn(getReferralCommission);
  const { data } = useQuery({
    queryKey: ["referral-commission"],
    queryFn: () => fetchCommission(),
    refetchInterval: 60_000,
  });

  const [now, setNow] = useState(Date.now());
  const live = !!data?.isActive && Number(data?.referralUnits ?? data?.qualifyingReferees ?? 0) > 0;

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [live]);

  if (!data) return null;

  const refUnits = Number(data.referralUnits ?? Number(data.qualifyingReferees ?? 0) * 0.1);
  const ratePerSec = RATE_PER_SLOT_SEC * refUnits;
  let balance = Number(data.referralAccrued ?? 0);
  if (live && data.lastCreditedAt) {
    const elapsed = Math.max(0, (now - new Date(data.lastCreditedAt).getTime()) / 1000);
    balance += elapsed * ratePerSec;
  }
  const [intPart, decPart] = balance.toFixed(6).split(".");
  const allReferees = (data.referees ?? []) as any[];
  const miningReferees = allReferees.filter((r: any) => r.mining);
  const pendingReferees = allReferees.filter((r: any) => !r.mining);

  return (
    <div className="relative rounded-[28px] p-5 overflow-hidden border border-white/15 shadow-[0_28px_60px_-24px_rgba(16,185,129,0.65)]"
         style={{ background: "linear-gradient(140deg,#04122e 0%,#0b3b5e 35%,#065f46 70%,#0f766e 100%)" }}>
      <div className="absolute inset-0 mc-aurora opacity-70 pointer-events-none" aria-hidden />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden><span className="mc-sheen" /></div>
      <div className="absolute -top-14 -right-10 w-52 h-52 rounded-full blur-3xl opacity-60 pointer-events-none"
           style={{ background: "radial-gradient(circle,#34d399,transparent 70%)" }} aria-hidden />


      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/12 border border-white/20 backdrop-blur">
            {live ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-300 animate-ping opacity-80" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                <span className="text-[10px] font-black tracking-[0.15em] text-white/95">লাইভ কমিশন</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3 text-white/80" />
                <span className="text-[10px] font-black tracking-[0.15em] text-white/85">কমিশন অপেক্ষমাণ</span>
              </>
            )}
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/20">
            <Users className="w-3 h-3 text-emerald-200" />
            <span className="text-[9px] font-black tracking-widest text-white/85">রেফার কমিশন</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/60 font-black mb-1">Referral Commission</p>
          <div className="flex items-baseline justify-center gap-1 flex-wrap">
            <span className="mono-num text-[2.8rem] leading-none font-black text-white drop-shadow">{intPart}</span>
            <span className="mono-num text-base leading-none font-black text-white/60">.{decPart}</span>
          </div>
          <p className="text-xs font-black text-emerald-100 mt-1.5">৳ টাকা · মোট রেফার কমিশন আয় (লাইফটাইম)</p>
          <p className="text-[10px] font-bold text-white/70 mt-1 leading-snug">
            ক্লেইম করা কমিশন মেইন ব্যালেন্সে যোগ হয় — মাইনিং কার্ডে “রেফার ১০% কমিশন” অংশে ক্লেইমযোগ্য ও ক্লেইম করা পরিমাণ দেখা যায়।
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2.5 bg-white/10 border border-white/15">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">মাইনিং চালু রেফার</p>
            <p className="mono-num text-lg font-black text-white mt-0.5">
              {data.miningCount}<span className="text-xs text-white/50">/{data.totalReferred}</span>
            </p>
          </div>
          <div className="rounded-xl p-2.5 bg-white/10 border border-white/15">
            <p className="text-[9px] uppercase tracking-widest text-white/60 font-black">মাসিক কমিশন</p>
            <p className="mono-num text-lg font-black text-emerald-100 mt-0.5">
              {data.monthlyTotal.toFixed(0)}<span className="text-xs text-white/60">৳</span>
            </p>
          </div>
        </div>

        {miningReferees.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-black text-white/70 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> কার কাছ থেকে মাসে কত আসবে
            </p>
            {miningReferees.slice(0, 8).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-white/10 border border-white/10">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-white truncate">{r.name}</p>
                  <p className="text-[10px] text-white/60 font-bold">UID {r.uid} · {r.reverifies} রি-ভেরিফাই · আয়ের ১০% = {r.monthly.toFixed(0)}৳/মাস</p>
                </div>
                <span className="mono-num text-[12px] font-black text-emerald-200 shrink-0">+{r.monthly.toFixed(0)}৳/মাস</span>
              </div>
            ))}
            {miningReferees.length > 8 && (
              <p className="text-[10px] text-white/60 font-bold text-center">+ আরও {miningReferees.length - 8} জন</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-white/75 text-center font-bold leading-relaxed">
            আপনার রেফার করা কোনো ইউজার এখনো ১০টি রি-ভেরিফাই সম্পন্ন করে মাইনিং চালু করেননি।
            <br />মাইনিং চালু হলেই তার মাইনিংয়ের ১০% প্রতিদিন এই কার্ডে যোগ হবে।
          </p>
        )}

        <p className="mt-3 text-[10px] text-white/55 text-center font-bold">
          কোনো রেফারের ১০টির মধ্যে ১টি স্লটও রি-ভেরিফাই চাইলে তার মাইনিং বন্ধ — তখন ১০% কমিশনও বন্ধ, আবার রি-ভেরিফাই করলে চালু।
        </p>
      </div>
    </div>
  );
}
