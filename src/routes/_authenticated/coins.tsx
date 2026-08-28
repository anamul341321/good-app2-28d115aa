import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft, Coins, Sparkles, Repeat, Film, Image as ImageIcon,
  MessageCircle, Video, TrendingUp, CalendarClock, Gift, Lock,
} from "lucide-react";
import { useCoinSummary } from "@/components/social/CoinWallet";
import { formatCoins, COIN_RATES, TELEGRAM_GROUP_URL, claimTelegramBonus } from "@/lib/coins";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { playUiSound } from "@/lib/ui-sounds";

export const Route = createFileRoute("/_authenticated/coins")({
  head: () => ({
    meta: [
      { title: "কয়েন ওয়ালেট — Good-App" },
      { name: "description", content: "আপনার Good Coin ব্যালেন্স, আয়ের হিসাব ও এক্সচেঞ্জ।" },
    ],
  }),
  component: CoinWalletPage,
});

/** Smooth count-up animation for the big balance number. */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

const EARN_ITEMS = [
  { icon: Send, label: "টেলিগ্রাম গ্রুপে জয়েন করলে (একবার)", coins: COIN_RATES.telegram, color: "text-sky-300", bg: "bg-sky-500/15" },
  { icon: Film, label: "রিলস আপলোড করলে", coins: COIN_RATES.reel, color: "text-pink-400", bg: "bg-pink-500/15" },
  { icon: ImageIcon, label: "পোস্ট করলে", coins: COIN_RATES.post, color: "text-sky-400", bg: "bg-sky-500/15" },
  { icon: Sparkles, label: "স্টোরি দিলে", coins: COIN_RATES.story, color: "text-violet-400", bg: "bg-violet-500/15" },
  { icon: MessageCircle, label: "মেসেজ / কমেন্ট করলে", coins: COIN_RATES.message, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  { icon: Video, label: "ভিডিও দেখলে (প্রতি ২০ সেকেন্ড)", coins: COIN_RATES.watch, color: "text-amber-400", bg: "bg-amber-500/15" },
];

function CoinWalletPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCoinSummary();
  const queryClient = useQueryClient();
  const joined = !!data?.telegram_joined;

  const joinTelegram = async () => {
    window.open(TELEGRAM_GROUP_URL, "_blank");
    const res = await claimTelegramBonus();
    queryClient.invalidateQueries({ queryKey: ["coin-summary"] });
    if (res.awarded > 0) {
      playUiSound("coin");
      toast.success(`টেলিগ্রাম জয়েন বোনাস +${res.awarded} কয়েন! 🪙`);
    } else if (res.already) {
      toast.info("আপনি আগেই টেলিগ্রাম বোনাস নিয়েছেন");
    }
  };
  const balance = useCountUp(data?.balance ?? 0);
  const watchCap = data?.watch_daily_cap ?? 9000;
  const watchPct = Math.min(100, ((data?.watch_today ?? 0) / watchCap) * 100);

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#0c0a05] pb-14 text-amber-50">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-amber-500/10 bg-[#0c0a05]/90 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate({ to: "/feed" })}
          aria-label="ফিরে যান"
          className="grid h-9 w-9 place-items-center rounded-full bg-amber-500/10 text-amber-200 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-black">কয়েন ওয়ালেট</h1>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300">
          <Coins className="h-3.5 w-3.5" /> Good Coin
        </span>
      </div>

      {/* Hero balance card */}
      <div className="px-4 pt-5">
        <div className="coin-hero relative overflow-hidden rounded-[28px] border border-amber-400/25 bg-gradient-to-br from-amber-950 via-[#2a1f04] to-amber-950 p-6 shadow-[0_30px_80px_-30px_rgba(245,158,11,0.5)]">
          {/* floating coins */}
          <span className="coin-float pointer-events-none absolute left-6 top-6 text-2xl" style={{ animationDelay: "0s" }}>🪙</span>
          <span className="coin-float pointer-events-none absolute right-10 top-14 text-xl" style={{ animationDelay: "0.9s" }}>🪙</span>
          <span className="coin-float pointer-events-none absolute left-16 bottom-16 text-lg" style={{ animationDelay: "1.6s" }}>🪙</span>
          <span className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />

          <div className="relative flex flex-col items-center text-center">
            {/* big spinning coin */}
            <div className="coin-spin-slow relative mb-3 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-[0_18px_40px_-12px_rgba(245,158,11,0.9),inset_0_3px_8px_rgba(255,255,255,0.6)] ring-4 ring-amber-300/40">
              <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950">
                <Coins className="h-10 w-10" />
              </span>
              <span className="coin-sparkle pointer-events-none absolute -right-1 -top-1 text-amber-200">✦</span>
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300/80">আপনার ব্যালেন্স</p>
            <p className="mt-1 text-6xl font-black tabular-nums leading-none text-transparent drop-shadow-[0_4px_16px_rgba(245,158,11,0.4)] [background:linear-gradient(180deg,#fef3c7,#fbbf24_60%,#b45309)] [-webkit-background-clip:text] [background-clip:text]">
              {isLoading ? "—" : formatCoins(balance)}
            </p>
            <p className="mt-1 text-sm font-bold text-amber-200/80">কয়েন 🪙</p>

            <div className="mt-4 flex w-full max-w-xs gap-2">
              <div className="flex-1 rounded-2xl bg-black/30 px-3 py-2.5 ring-1 ring-amber-400/15">
                <p className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300/70">
                  <CalendarClock className="h-3 w-3" /> আজ
                </p>
                <p className="mt-0.5 text-center text-lg font-black tabular-nums text-amber-100">+{formatCoins(data?.today)}</p>
              </div>
              <div className="flex-1 rounded-2xl bg-black/30 px-3 py-2.5 ring-1 ring-amber-400/15">
                <p className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300/70">
                  <TrendingUp className="h-3 w-3" /> মোট আয়
                </p>
                <p className="mt-0.5 text-center text-lg font-black tabular-nums text-amber-100">{formatCoins(data?.total_earned)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram join */}
      <div className="mt-4 px-4">
        <button
          type="button"
          onClick={joinTelegram}
          className="w-full overflow-hidden rounded-3xl border border-sky-400/25 bg-gradient-to-br from-sky-900/60 to-[#04121a] p-4 text-left active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-300 to-sky-600 text-sky-950 shadow-lg">
              <Send className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-black text-sky-50">টেলিগ্রাম গ্রুপে জয়েন করুন</p>
              <p className="text-[12px] font-bold text-sky-200/70">
                {joined ? "✅ জয়েন সম্পন্ন — বোনাস নেওয়া হয়েছে" : `জয়েন করলেই +${COIN_RATES.telegram} কয়েন বোনাস`}
              </p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-sky-400/20 px-3 py-1.5 text-[12px] font-black text-sky-100 ring-1 ring-sky-300/30">
              {joined ? "Joined" : "Join"}
            </span>
          </div>
          {!joined && (
            <p className="mt-3 text-[12px] font-bold leading-relaxed text-amber-200/80">
              ⚠️ টেলিগ্রাম গ্রুপে জয়েন না করলে কয়েন ক্লেইম করা যাবে না।
            </p>
          )}
        </button>
      </div>

      {/* Watch progress */}
      <div className="mt-4 px-4">
        <div className="rounded-3xl border border-amber-400/15 bg-amber-950/40 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[13px] font-black text-amber-100">
              <Video className="h-4 w-4 text-amber-400" /> ভিডিও দেখে আজকের আয়
            </p>
            <p className="text-[12px] font-black tabular-nums text-amber-300">
              {formatCoins(data?.watch_today)} / {formatCoins(watchCap)} 🪙
            </p>
          </div>
          <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-black/40 ring-1 ring-amber-400/10">
            <div
              className="coin-progress-glow h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-700"
              style={{ width: `${Math.max(3, watchPct)}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] font-bold text-amber-200/60">
            ফিড ও রিলসে ভিডিও চালু রাখুন — প্রতি ২০ সেকেন্ডে {COIN_RATES.watch} কয়েন। ভিডিও বন্ধ করলে কয়েন হবে না।
          </p>
        </div>
      </div>

      {/* Exchange — coming soon */}
      <div className="mt-4 px-4">
        <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-900/60 to-[#1a1204] p-5">
          <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-yellow-400/15 blur-2xl" />
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-600 text-amber-950 shadow-lg">
              <Repeat className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-black text-amber-50">কয়েন এক্সচেঞ্জ</p>
              <p className="text-[12px] font-bold text-amber-200/70">শীঘ্রই আসছে — Coming Soon</p>
            </div>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/20">
              <Lock className="h-3 w-3" /> Soon
            </span>
          </div>
          <p className="mt-3 text-[12px] font-bold leading-relaxed text-amber-200/70">
            এখন যত বেশি পারেন কয়েন জমান! এক্সচেঞ্জ চালু হলে এই কয়েন দিয়েই সুবিধা পাবেন — রেট পরে ঘোষণা করা হবে। 🚀
          </p>
        </div>
      </div>

      {/* How to earn */}
      <div className="mt-5 px-4">
        <p className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-black uppercase tracking-wider text-amber-300/80">
          <Gift className="h-4 w-4" /> কীভাবে কয়েন পাবেন
        </p>
        <div className="space-y-2">
          {EARN_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-2xl border border-amber-400/10 bg-amber-950/30 px-3.5 py-3"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.bg} ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </span>
              <p className="min-w-0 flex-1 text-[13px] font-bold text-amber-100/90">{item.label}</p>
              <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-3 py-1 text-[13px] font-black tabular-nums text-amber-950 shadow">
                +{item.coins} 🪙
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 px-1 text-center text-[11px] font-bold text-amber-200/50">
          কয়েন জমাতে থাকুন — যত বেশি কয়েন, এক্সচেঞ্জ চালু হলে তত বেশি সুবিধা! ✨
        </p>
      </div>
    </div>
  );
}
