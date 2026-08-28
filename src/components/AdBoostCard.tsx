import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PlayCircle, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getAdBoostStatus, recordAdView } from "@/lib/ads.functions";
import { AD_BOOST, adBoostWithdrawInfo } from "@/lib/ad-boost";
import { withdrawCountdownInfo } from "@/lib/withdraw-window";
import { showRewardedAd } from "@/lib/ads";
import { loadAdsConfig } from "@/lib/ads-config";

/**
 * উইথড্র পেজের "অ্যাড দেখে সময় কমান" কার্ড।
 * ৫টি অ্যাড = ৫ দিন কম, দিনে সর্বোচ্চ ৫টি অ্যাড।
 */
export function AdBoostCard() {
  const qc = useQueryClient();
  const { data: adsCfg } = useQuery({
    queryKey: ["ads-config"],
    queryFn: () => loadAdsConfig(),
    staleTime: 5 * 60_000,
  });
  const [now] = useState(() => Date.now());
  const { data } = useQuery({
    queryKey: ["ad-boost"],
    queryFn: () => getAdBoostStatus(),
  });

  const window = withdrawCountdownInfo(now);
  const info = adBoostWithdrawInfo({
    now,
    nextFirstAt: window.nextFirstAt,
    isOpen: window.isOpen,
    boosts: data?.boosts ?? 0,
  });

  const todayCount = data?.todayCount ?? 0;
  const cycleCount = data?.cycleCount ?? 0;
  const progressInBoost = cycleCount % AD_BOOST.adsPerBoost;

  const watch = useMutation({
    mutationFn: async () => {
      const ok = await showRewardedAd();
      if (!ok) throw new Error("অ্যাড সম্পূর্ণ দেখা হয়নি — আবার চেষ্টা করুন");
      return recordAdView();
    },
    onSuccess: (res) => {
      if (!res.ok) {
        toast.info(
          res.reason === "daily_limit"
            ? `আজকের ${AD_BOOST.dailyAdLimit}টি অ্যাড শেষ — কাল আবার দেখুন`
            : "এই মাসের সর্বোচ্চ বুস্ট নেওয়া হয়ে গেছে",
        );
      } else if (res.cycleCount % AD_BOOST.adsPerBoost === 0) {
        toast.success(`🎉 ১ বুস্ট পেলেন — উইথড্রের সময় ${AD_BOOST.daysPerBoost} দিন কমলো!`);
      } else {
        toast.success(
          `অ্যাড গোনা হয়েছে — আরও ${AD_BOOST.adsPerBoost - (res.cycleCount % AD_BOOST.adsPerBoost)}টি দেখলে ${AD_BOOST.daysPerBoost} দিন কমবে`,
        );
      }
      qc.invalidateQueries({ queryKey: ["ad-boost"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (info.unlocked) {
    return (
      <div className="rounded-3xl border-2 border-emerald/40 bg-linear-to-br from-emerald/20 via-cyan/10 to-violet/10 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-emerald shrink-0" />
        <p className="text-[12px] font-black leading-snug">
          উইথড্র এখন খোলা {info.daysCut > 0 ? `— অ্যাড দেখে ${info.daysCut} দিন কমিয়েছেন 🎉` : ""}
        </p>
      </div>
    );
  }

  const dailyDone = todayCount >= AD_BOOST.dailyAdLimit;

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber/40 bg-linear-to-br from-amber/20 via-rose/10 to-violet/10 p-5 shadow-xl">
      <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-amber/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber text-white shadow-lg">
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber">অ্যাড বুস্ট</p>
          <h3 className="text-base font-black leading-tight">অ্যাড দেখে উইথড্রের সময় কমান</h3>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            {AD_BOOST.adsPerBoost}টি অ্যাড দেখলেই <span className="font-black text-amber">{AD_BOOST.daysPerBoost} দিন</span> কমবে।
            দিনে সর্বোচ্চ {AD_BOOST.dailyAdLimit}টি অ্যাড — টানা {AD_BOOST.maxBoostsPerCycle} দিন দেখলে সময় শেষ হয়ে উইথড্র খুলে যাবে।
          </p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="বাকি দিন" value={`${info.effectiveDaysLeft}`} />
        <Stat label="কমেছে" value={`${info.daysCut} দিন`} />
        <Stat label="আজ দেখা" value={`${todayCount}/${AD_BOOST.dailyAdLimit}`} />
      </div>

      <div className="relative mt-3">
        <div className="h-2 w-full rounded-full bg-background/70 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber to-rose transition-all"
            style={{ width: `${(progressInBoost / AD_BOOST.adsPerBoost) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-[10px] font-bold text-muted-foreground">
          পরের বুস্টের জন্য আরও {AD_BOOST.adsPerBoost - progressInBoost}টি অ্যাড
        </p>
      </div>

      <button
        type="button"
        disabled={watch.isPending || dailyDone}
        onClick={() => watch.mutate()}
        className="relative mt-4 w-full rounded-2xl bg-amber py-3 text-sm font-black text-white shadow-lg btn-press disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {watch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
        {dailyDone ? "আজকের অ্যাড শেষ — কাল আবার" : "অ্যাড দেখুন"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-2 backdrop-blur-sm">
      <p className="mono-num text-lg font-black text-amber" translate="no">{value}</p>
      <p className="text-[9px] font-bold text-muted-foreground">{label}</p>
    </div>
  );
}
