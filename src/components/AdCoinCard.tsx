import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PlayCircle, Timer, Coins } from "lucide-react";
import { toast } from "sonner";
import { getAdCoinStatus, claimAdCoins } from "@/lib/coins.functions";
import { showRewardedAd } from "@/lib/ads";
import { loadAdsConfig } from "@/lib/ads-config";
import { formatCoins } from "@/lib/coins";
import { playUiSound } from "@/lib/ui-sounds";

/**
 * "অ্যাড দেখে কয়েন" কার্ড — প্রতিটি অ্যাডে ১০০০ কয়েন।
 * ২টি অ্যাড দেখার পর ৬ মিনিটের বিরতি (সার্ভারেই যাচাই হয়)।
 */
export function AdCoinCard({ onEarned }: { onEarned?: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(0);

  const { data: adsCfg } = useQuery({
    queryKey: ["ads-config"],
    queryFn: () => loadAdsConfig(),
    staleTime: 60_000,
  });
  const status = useQuery({
    queryKey: ["ad-coin-status"],
    queryFn: () => getAdCoinStatus(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setLeft(status.data?.wait_seconds ?? 0);
  }, [status.data?.wait_seconds]);

  useEffect(() => {
    if (left <= 0) return;
    const t = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          void status.refetch();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left > 0]);

  const perAd = status.data?.coins_per_ad ?? 1000;
  const perBreak = status.data?.ads_per_break ?? 2;
  const dailyLimit = status.data?.daily_limit ?? 30;
  const today = status.data?.today_count ?? 0;
  const dailyDone = today >= dailyLimit;
  const cooling = left > 0;

  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  const watch = async () => {
    if (busy || cooling || dailyDone) return;
    setBusy(true);
    try {
      const completed = await showRewardedAd();
      if (!completed) {
        toast.info("অ্যাড পুরোটা দেখতে হবে — তাহলেই কয়েন পাবেন");
        return;
      }
      const res = await claimAdCoins();
      if (res.awarded > 0) {
        playUiSound("coin");
        toast.success(`+${formatCoins(res.awarded)} কয়েন পেয়েছেন! 🪙`);
        onEarned?.();
      } else if (res.error === "cooldown") {
        toast.info("এখন বিরতি চলছে — সময় শেষ হলে আবার দেখুন");
      } else {
        toast.info("আজকের অ্যাড লিমিট শেষ — কাল আবার দেখুন");
      }
      setLeft(res.status?.wait_seconds ?? 0);
      qc.invalidateQueries({ queryKey: ["ad-coin-status"] });
      qc.invalidateQueries({ queryKey: ["coin-summary"] });
      qc.invalidateQueries({ queryKey: ["coin-history"] });
    } catch (e: any) {
      toast.error(e?.message ?? "অ্যাড দেখানো যায়নি — আবার চেষ্টা করুন");
    } finally {
      setBusy(false);
    }
  };

  // অ্যাডমিন প্যানেলে rewarded ad বন্ধ থাকলে কার্ডটাই দেখাবে না
  if (adsCfg && (!adsCfg.enabled || !adsCfg.rewarded)) return null;

  return (
    <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#2a1f04] via-amber-950/60 to-[#0c0a05] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-lg">
          <PlayCircle className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black text-amber-50">অ্যাড দেখে কয়েন</p>
          <p className="text-[12px] font-bold text-amber-200/70">
            প্রতিটি অ্যাডে <span className="text-yellow-300">+{formatCoins(perAd)}</span> কয়েন — যত বেশি দেখবেন তত বেশি কয়েন
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="প্রতি অ্যাডে" value={`${formatCoins(perAd)}`} />
        <Stat label="আজ দেখা" value={`${today}/${dailyLimit}`} />
        <Stat label="বিরতি" value={cooling ? mmss : "নেই"} />
      </div>

      <button
        type="button"
        onClick={() => void watch()}
        disabled={busy || cooling || dailyDone}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 py-3 text-[14px] font-black text-amber-950 shadow-[0_12px_26px_-12px_rgba(245,158,11,0.9)] active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : cooling ? (
          <Timer className="h-4 w-4" />
        ) : (
          <Coins className="h-4 w-4" />
        )}
        {dailyDone
          ? "আজকের অ্যাড শেষ — কাল আবার"
          : cooling
            ? `বিরতি — ${mmss} পরে আবার দেখুন`
            : busy
              ? "অ্যাড চলছে..."
              : `অ্যাড দেখুন +${formatCoins(perAd)}`}
      </button>

      <p className="mt-2 text-[11px] font-bold text-amber-200/60">
        {perBreak}টি অ্যাড দেখার পর {Math.round((status.data?.cooldown_seconds ?? 360) / 60)} মিনিটের বিরতি হবে, এরপর আবার অ্যাড দেখে কয়েন নিতে পারবেন।
        অ্যাড শুধু Android অ্যাপে দেখা যাবে।
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/35 px-2 py-2 ring-1 ring-amber-400/15">
      <p className="text-[15px] font-black tabular-nums text-yellow-200">{value}</p>
      <p className="text-[10px] font-bold text-amber-200/60">{label}</p>
    </div>
  );
}
