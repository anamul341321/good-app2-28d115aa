import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, X, Clock, Sparkles, Repeat, Film, Image as ImageIcon, MessageCircle, Video } from "lucide-react";
import { getCoinSummary, type CoinSummary } from "@/lib/coins.functions";
import { claimWatchSeconds, isWatching, formatCoins, COIN_RATES } from "@/lib/coins";
import { playUiSound } from "@/lib/ui-sounds";
import { toast } from "sonner";

export function useCoinSummary(enabled = true) {
  return useQuery({
    queryKey: ["coin-summary"],
    queryFn: () => getCoinSummary() as Promise<CoinSummary>,
    enabled,
    staleTime: 15_000,
  });
}

/** Small gold wallet pill for the feed header. */
export function CoinWalletButton({ onClick }: { onClick: () => void }) {
  const { data } = useCoinSummary();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="কয়েন ওয়ালেট"
      className="btn-press flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 px-2.5 text-[12px] font-black text-amber-950 shadow-[0_8px_18px_-8px_rgba(245,158,11,0.9)] ring-1 ring-amber-200/70"
    >
      <Coins className="h-4 w-4" />
      <span className="tabular-nums">{formatCoins(data?.balance)}</span>
    </button>
  );
}

/** Premium coin balance card + coming-soon exchange. */
export function CoinWalletSheet({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useCoinSummary();

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-in slide-in-from-bottom-4 duration-200 rounded-t-3xl bg-white p-4 dark:bg-card sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900 dark:text-foreground">কয়েন ওয়ালেট</h2>
          <button onClick={onClose} aria-label="বন্ধ করুন" className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 dark:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Premium balance card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 p-[1.5px] shadow-[0_24px_50px_-24px_rgba(245,158,11,0.9)]">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-yellow-900 to-amber-950 px-5 py-5">
            <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-yellow-300/25 blur-2xl" />
            <span className="pointer-events-none absolute -left-10 -bottom-10 h-28 w-28 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-200/80">Good Coin</p>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-yellow-200 to-amber-500 text-amber-950 shadow-lg">
                <Coins className="h-5 w-5" />
              </span>
            </div>
            <p className="relative mt-3 text-4xl font-black tabular-nums text-yellow-50 drop-shadow">
              {isLoading ? "—" : formatCoins(data?.balance)}
              <span className="ml-2 text-base font-bold text-amber-200/80">coin</span>
            </p>
            <div className="relative mt-3 flex gap-2 text-[11px] font-bold text-amber-100/90">
              <span className="rounded-full bg-black/25 px-2.5 py-1">আজ +{formatCoins(data?.today)}</span>
              <span className="rounded-full bg-black/25 px-2.5 py-1">মোট {formatCoins(data?.total_earned)}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-100 px-4 py-3 text-sm font-black text-gray-500 dark:bg-secondary dark:text-muted-foreground"
        >
          <Repeat className="h-4 w-4" /> কয়েন এক্সচেঞ্জ — শীঘ্রই আসছে
        </button>
        <p className="mt-2 text-center text-[11px] font-bold text-gray-500 dark:text-muted-foreground">
          এখন শুধু কয়েন জমান। ভবিষ্যতে এই কয়েন এক্সচেঞ্জ করার সুযোগ আসবে — রেট পরে ঘোষণা করা হবে।
        </p>

        <div className="mt-4 rounded-2xl bg-gray-50 p-3 dark:bg-secondary/40">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-gray-900 dark:text-foreground">
            <Sparkles className="h-4 w-4 text-amber-500" /> কীভাবে কয়েন পাবেন
          </p>
          <ul className="space-y-1.5 text-[12px] font-bold text-gray-600 dark:text-muted-foreground">
            <li className="flex items-center gap-2"><Film className="h-3.5 w-3.5 text-pink-500" /> রিলস আপলোড — {COIN_RATES.reel} কয়েন</li>
            <li className="flex items-center gap-2"><ImageIcon className="h-3.5 w-3.5 text-blue-500" /> পোস্ট করলে — {COIN_RATES.post} কয়েন</li>
            <li className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-violet-500" /> স্টোরি দিলে — {COIN_RATES.story} কয়েন</li>
            <li className="flex items-center gap-2"><MessageCircle className="h-3.5 w-3.5 text-emerald-500" /> বন্ধুকে মেসেজ / কমেন্ট — {COIN_RATES.message} কয়েন</li>
            <li className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-amber-500" /> ভিডিও দেখলে — প্রতি ২০ সেকেন্ডে ১ কয়েন</li>
          </ul>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 dark:text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> আজ ভিডিও দেখে: {formatCoins(data?.watch_today)} / {formatCoins(data?.watch_daily_cap ?? 600)} কয়েন
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating watch-to-earn pill. Counts seconds only while a video actually
 * reports playback progress; stops instantly when the video is paused/closed.
 * Every 20 watched seconds = 1 claimable coin.
 */
export function WatchCoinBar() {
  const queryClient = useQueryClient();
  const [seconds, setSeconds] = useState(0);
  const [claiming, setClaiming] = useState(false);
  const [flash, setFlash] = useState(false);
  const secondsRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isWatching()) return;
      secondsRef.current = Math.min(600, secondsRef.current + 1);
      setSeconds(secondsRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const coins = Math.floor(seconds / 20);
  const progress = ((seconds % 20) / 20) * 100;

  if (seconds < 3 && coins === 0) return null;

  const claim = async () => {
    if (coins < 1 || claiming) return;
    setClaiming(true);
    const spend = coins * 20;
    const awarded = await claimWatchSeconds(spend);
    setClaiming(false);
    if (awarded > 0) {
      playUiSound("coin");
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      secondsRef.current = Math.max(0, secondsRef.current - spend);
      setSeconds(secondsRef.current);
      queryClient.invalidateQueries({ queryKey: ["coin-summary"] });
      toast.success(`+${awarded} কয়েন যোগ হয়েছে! 🪙`);
    } else {
      toast.info("আজকের কয়েন লিমিট শেষ, কাল আবার চেষ্টা করুন");
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[90] flex justify-center px-3">
      <button
        type="button"
        onClick={claim}
        disabled={coins < 1 || claiming}
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[12px] font-black shadow-[0_16px_32px_-16px_rgba(0,0,0,0.7)] backdrop-blur transition-all ${
          coins >= 1
            ? "bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-amber-950 ring-1 ring-amber-200/80 active:scale-95"
            : "bg-black/70 text-amber-100 ring-1 ring-white/10"
        } ${flash ? "scale-110" : ""}`}
      >
        <span className="relative grid h-7 w-7 place-items-center">
          <svg viewBox="0 0 36 36" className="absolute h-7 w-7 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-black/20" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className="stroke-yellow-300"
              strokeDasharray={`${(progress / 100) * 94.2} 94.2`}
            />
          </svg>
          <Coins className="h-3.5 w-3.5" />
        </span>
        {coins >= 1 ? (
          <span>{claiming ? "নেওয়া হচ্ছে..." : `${coins} কয়েন ক্লেইম করুন`}</span>
        ) : (
          <span>ভিডিও দেখুন — {20 - (seconds % 20)}s পরে কয়েন</span>
        )}
      </button>
    </div>
  );
}
