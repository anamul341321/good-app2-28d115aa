import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft, Coins, Sparkles, Repeat, Film, Image as ImageIcon,
  MessageCircle, Video, TrendingUp, CalendarClock, Gift, Lock,
  Send, History, ChevronRight, ShieldCheck, Loader2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCoinSummary } from "@/components/social/CoinWallet";
import { formatCoins, COIN_RATES, TELEGRAM_GROUP_URL } from "@/lib/coins";
import { getCoinHistory, claimTelegramByUsername } from "@/lib/coins.functions";
import { toast } from "sonner";
import { playUiSound } from "@/lib/ui-sounds";

export const Route = createFileRoute("/_authenticated/coins")({
  head: () => ({
    meta: [
      { title: "কয়েন ওয়ালেট — Good-App" },
      { name: "description", content: "আপনার Good Coin ব্যালেন্স, আয়ের হিসাব ও এক্সচেঞ্জ।" },
      { property: "og:title", content: "কয়েন ওয়ালেট — Good-App" },
      { property: "og:description", content: "Good Coin জমান — ভিডিও দেখে, পোস্ট, রিলস ও মেসেজ করে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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

type EarnItem = {
  icon: any;
  label: string;
  hint: string;
  coins: number;
  color: string;
  bg: string;
  to?: string;
  telegram?: boolean;
};

const EARN_ITEMS: EarnItem[] = [
  { icon: Send, label: "টেলিগ্রাম গ্রুপে জয়েন", hint: "একবারই — জয়েন করে ক্লেইম করুন", coins: COIN_RATES.telegram, color: "text-sky-300", bg: "bg-sky-500/15", telegram: true },
  { icon: Film, label: "রিলস আপলোড", hint: "রিলস পেজে গিয়ে ভিডিও দিন", coins: COIN_RATES.reel, color: "text-pink-400", bg: "bg-pink-500/15", to: "/reels" },
  { icon: ImageIcon, label: "পোস্ট করলে", hint: "ফিডে পোস্ট লিখুন বা ছবি দিন", coins: COIN_RATES.post, color: "text-sky-400", bg: "bg-sky-500/15", to: "/feed" },
  { icon: Sparkles, label: "স্টোরি দিলে", hint: "স্টুডিও থেকে স্টোরি বানান", coins: COIN_RATES.story, color: "text-violet-400", bg: "bg-violet-500/15", to: "/studio" },
  { icon: MessageCircle, label: "মেসেজ / কমেন্ট", hint: "মেসেঞ্জারে বন্ধুকে মেসেজ দিন", coins: COIN_RATES.message, color: "text-emerald-400", bg: "bg-emerald-500/15", to: "/chat" },
  { icon: Video, label: "ভিডিও দেখলে", hint: "প্রতি ২০ সেকেন্ডে কয়েন", coins: COIN_RATES.watch, color: "text-amber-400", bg: "bg-amber-500/15", to: "/videos" },
];

const REASON_META: Record<string, { bn: string; icon: any; color: string }> = {
  telegram_join: { bn: "টেলিগ্রাম জয়েন বোনাস", icon: Send, color: "text-sky-300" },
  watch: { bn: "ভিডিও দেখে আয়", icon: Video, color: "text-amber-300" },
  reel: { bn: "রিলস আপলোড", icon: Film, color: "text-pink-300" },
  post: { bn: "পোস্ট করেছেন", icon: ImageIcon, color: "text-sky-300" },
  story: { bn: "স্টোরি দিয়েছেন", icon: Sparkles, color: "text-violet-300" },
  comment: { bn: "কমেন্ট করেছেন", icon: MessageCircle, color: "text-emerald-300" },
  message: { bn: "মেসেজ পাঠিয়েছেন", icon: MessageCircle, color: "text-emerald-300" },
};

function CoinWalletPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useCoinSummary();
  const queryClient = useQueryClient();
  const joined = !!data?.telegram_joined;
  const [verifying, setVerifying] = useState(false);
  const [burst, setBurst] = useState(false);
  const [askUsername, setAskUsername] = useState(false);
  const [tgUsername, setTgUsername] = useState("");

  const history = useQuery({ queryKey: ["coin-history"], queryFn: () => getCoinHistory() });

  const celebrate = () => {
    playUiSound("coin");
    setBurst(true);
    setTimeout(() => setBurst(false), 1000);
  };

  const claimTelegram = async () => {
    if (verifying) return;
    const uname = tgUsername.trim().replace(/^@/, "");
    if (!uname || uname.length < 3) {
      setAskUsername(true);
      toast.info("আপনার টেলিগ্রাম username দিন (যেমন @yourname)");
      return;
    }
    setVerifying(true);
    try {
      const res = await claimTelegramByUsername({ data: { username: uname } });
      if (res.awarded > 0) {
        celebrate();
        setAskUsername(false);
        toast.success(`টেলিগ্রাম জয়েন বোনাস +${res.awarded} কয়েন! 🪙`);
      } else if (res.already) {
        toast.info("আপনি আগেই এই বোনাস নিয়েছেন");
      } else if (res.error === "duplicate") {
        toast.error("এই username দিয়ে আগেই ক্লেইম করা হয়েছে — নিজের username দিন");
      } else if (res.error === "not_found") {
        toast.error("username টি গ্রুপে খুঁজে পাওয়া যায়নি — গ্রুপে একটি মেসেজ দিন বা বটে /start দিন, তারপর আবার ক্লেইম করুন", {
          action: { label: "গ্রুপে যান", onClick: () => window.open(TELEGRAM_GROUP_URL, "_blank") },
        });
      } else {
        toast.error("এই username গ্রুপে জয়েন করা নেই — জয়েন করে আবার ক্লেইম করুন", {
          action: { label: "জয়েন", onClick: () => window.open(TELEGRAM_GROUP_URL, "_blank") },
        });
      }
      queryClient.invalidateQueries({ queryKey: ["coin-summary"] });
      queryClient.invalidateQueries({ queryKey: ["coin-history"] });
    } catch {
      toast.error("যাচাই করা যায়নি — পরে আবার চেষ্টা করুন");
    } finally {
      setVerifying(false);
    }
  };

  const goEarn = (item: EarnItem) => {
    if (item.telegram) {
      if (!askUsername && !tgUsername.trim()) {
        setAskUsername(true);
        return;
      }
      return claimTelegram();
    }
    playUiSound("coin");
    if (item.to) navigate({ to: item.to });
  };

  const balance = useCountUp(data?.balance ?? 0);
  const watchCap = data?.watch_daily_cap ?? 9000;
  const watchPct = Math.min(100, ((data?.watch_today ?? 0) / watchCap) * 100);

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-[#0c0a05] pb-16 text-amber-50">
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
        <h1 className="text-base font-black text-amber-100">কয়েন ওয়ালেট</h1>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-black text-amber-300">
          <Coins className="h-3.5 w-3.5" /> Good Coin
        </span>
      </div>

      {/* Hero balance card */}
      <div className="px-4 pt-5">
        <div className="coin-hero relative overflow-hidden rounded-[28px] border border-amber-400/25 bg-gradient-to-br from-amber-950 via-[#2a1f04] to-amber-950 p-6 shadow-[0_30px_80px_-30px_rgba(245,158,11,0.5)]">
          <span className="coin-float pointer-events-none absolute left-6 top-6 text-2xl" style={{ animationDelay: "0s" }}>🪙</span>
          <span className="coin-float pointer-events-none absolute right-10 top-14 text-xl" style={{ animationDelay: "0.9s" }}>🪙</span>
          <span className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-yellow-400/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-14 -left-10 h-40 w-40 rounded-full bg-amber-500/15 blur-3xl" />

          {burst && (
            <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center" aria-hidden>
              {["-48px", "-24px", "0px", "24px", "48px"].map((x, i) => (
                <span key={i} className="coin-burst absolute text-2xl" style={{ ["--burst-x" as string]: x, animationDelay: `${i * 70}ms` }}>🪙</span>
              ))}
            </div>
          )}

          <div className="relative flex flex-col items-center text-center">
            <div className="coin-spin-slow relative mb-3 grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 shadow-[0_18px_40px_-12px_rgba(245,158,11,0.9),inset_0_3px_8px_rgba(255,255,255,0.6)] ring-4 ring-amber-300/40">
              <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950">
                <Coins className="h-10 w-10" />
              </span>
              <span className="coin-sparkle pointer-events-none absolute -right-1 -top-1 text-amber-200">✦</span>
            </div>

            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-300/80">আপনার মোট কয়েন</p>
            <p className="mt-1 text-[64px] font-black leading-none tabular-nums text-yellow-200 drop-shadow-[0_6px_20px_rgba(245,158,11,0.55)]">
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

      {/* Telegram verify + claim */}
      <div className="mt-4 px-4">
        <div className="overflow-hidden rounded-3xl border border-sky-400/25 bg-gradient-to-br from-sky-900/60 to-[#04121a] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-300 to-sky-600 text-sky-950 shadow-lg">
              <Send className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-black text-sky-50">টেলিগ্রাম গ্রুপে জয়েন করুন</p>
              <p className="text-[12px] font-bold text-sky-200/70">
                {joined ? "✅ যাচাই সম্পন্ন — বোনাস নেওয়া হয়েছে" : `জয়েন করে ক্লেইম করলেই +${COIN_RATES.telegram} কয়েন`}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => window.open(TELEGRAM_GROUP_URL, "_blank")}
              className="flex-1 rounded-2xl bg-sky-500/20 px-3 py-2.5 text-[13px] font-black text-sky-100 ring-1 ring-sky-300/30 active:scale-95"
            >
              গ্রুপে জয়েন
            </button>
            <button
              type="button"
              onClick={() => (askUsername ? claimTelegram() : setAskUsername(true))}
              disabled={joined || verifying}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[13px] font-black active:scale-95 ${
                joined
                  ? "bg-black/30 text-sky-200/50 ring-1 ring-sky-300/10"
                  : "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 shadow-[0_12px_26px_-12px_rgba(245,158,11,0.9)]"
              }`}
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {joined ? "ক্লেইম হয়েছে" : verifying ? "যাচাই হচ্ছে..." : askUsername ? "যাচাই করে ক্লেইম" : "ক্লেইম করুন"}
            </button>
          </div>

          {askUsername && !joined && (
            <div className="mt-3 rounded-2xl border border-sky-300/20 bg-black/30 p-3">
              <label className="text-[11px] font-black uppercase tracking-wider text-sky-200/70">
                আপনার টেলিগ্রাম username
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="grid h-10 w-9 place-items-center rounded-xl bg-sky-500/15 text-[15px] font-black text-sky-200">@</span>
                <input
                  value={tgUsername}
                  onChange={(e) => setTgUsername(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") claimTelegram(); }}
                  placeholder="yourname"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-sky-300/20 bg-black/40 px-3 text-[14px] font-bold text-sky-50 outline-none placeholder:text-sky-200/30 focus:border-sky-300/50"
                />
                <button
                  type="button"
                  onClick={claimTelegram}
                  disabled={verifying}
                  className="h-10 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 px-4 text-[13px] font-black text-amber-950 active:scale-95 disabled:opacity-60"
                >
                  {verifying ? "..." : "যাচাই"}
                </button>
              </div>
              <p className="mt-2 text-[11px] font-bold leading-relaxed text-sky-200/60">
                বট এই username দিয়ে চেক করবে আপনি গ্রুপে আছেন কি না, এবং একই username দিয়ে আগে কেউ ক্লেইম করেছে কি না।
              </p>
            </div>
          )}

          <p className="mt-2.5 text-[11px] font-bold leading-relaxed text-amber-200/70">
            🔐 প্রতিটি username দিয়ে একবারই বোনাস নেওয়া যাবে। username টি গ্রুপে খুঁজে না পেলে গ্রুপে একটি মেসেজ দিন বা বটে
            <span className="text-sky-200"> /start</span> দিন, তারপর আবার ক্লেইম করুন।
          </p>
        </div>
      </div>

      {/* Exchange — BIG coming soon */}
      <div className="mt-4 px-4">
        <div className="relative overflow-hidden rounded-[28px] border-2 border-dashed border-amber-400/40 bg-gradient-to-br from-amber-900/70 via-[#241802] to-[#140e02] p-6 text-center">
          <span className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-yellow-400/20 blur-3xl" />
          <span className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-amber-500/15 blur-3xl" />
          <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-yellow-300 to-amber-600 text-amber-950 shadow-[0_18px_36px_-16px_rgba(245,158,11,0.9)]">
            <Repeat className="h-8 w-8" />
          </span>
          <p className="relative mt-3 text-2xl font-black text-amber-50">কয়েন এক্সচেঞ্জ</p>
          <p className="relative mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-1.5 text-[13px] font-black uppercase tracking-[0.2em] text-amber-300 ring-1 ring-amber-400/30">
            <Lock className="h-3.5 w-3.5" /> Coming Soon
          </p>
          <p className="relative mt-3 text-[13px] font-bold leading-relaxed text-amber-200/80">
            শীঘ্রই আসছে! এখন যত বেশি পারেন কয়েন জমান — এক্সচেঞ্জ চালু হলে এই কয়েন দিয়েই সুবিধা পাবেন।
            রেট পরে ঘোষণা করা হবে। 🚀
          </p>
        </div>
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

      {/* How to earn — each row is tappable + has an action button */}
      <div className="mt-5 px-4">
        <p className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-black uppercase tracking-wider text-amber-300/80">
          <Gift className="h-4 w-4" /> কীভাবে কয়েন পাবেন
        </p>
        <div className="space-y-2">
          {EARN_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => goEarn(item)}
              className="flex w-full items-center gap-3 rounded-2xl border border-amber-400/10 bg-amber-950/30 px-3.5 py-3 text-left active:scale-[0.99]"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.bg} ${item.color}`}>
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-black text-amber-100/90">{item.label}</span>
                <span className="block text-[11px] font-bold text-amber-200/50">{item.hint}</span>
              </span>
              <span className="shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 px-2.5 py-1 text-[12px] font-black tabular-nums text-amber-950 shadow">
                +{item.coins}
              </span>
              <span className="ml-1 flex shrink-0 items-center gap-0.5 rounded-full bg-black/40 px-2 py-1 text-[11px] font-black text-amber-200 ring-1 ring-amber-400/20">
                {item.telegram ? (joined ? "ক্লেইম হয়েছে" : "ক্লেইম") : "শুরু করুন"}
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Coin history */}
      <div className="mt-5 px-4">
        <p className="mb-2.5 flex items-center gap-2 px-1 text-[13px] font-black uppercase tracking-wider text-amber-300/80">
          <History className="h-4 w-4" /> কয়েন হিস্টোরি
        </p>
        {history.isLoading ? (
          <div className="grid place-items-center rounded-2xl border border-amber-400/10 bg-amber-950/30 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
          </div>
        ) : (history.data ?? []).length === 0 ? (
          <div className="rounded-2xl border border-amber-400/10 bg-amber-950/30 p-6 text-center text-[12px] font-bold text-amber-200/60">
            এখনো কোনো কয়েন লেনদেন নেই — ভিডিও দেখে বা পোস্ট করে শুরু করুন 🪙
          </div>
        ) : (
          <div className="space-y-2">
            {(history.data ?? []).map((row) => {
              const meta = REASON_META[row.reason] ?? { bn: row.reason, icon: Coins, color: "text-amber-300" };
              const Icon = meta.icon;
              const positive = Number(row.amount) >= 0;
              return (
                <div key={row.id} className="flex items-center gap-3 rounded-2xl border border-amber-400/10 bg-black/30 px-3.5 py-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 ${meta.color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-black text-amber-100/90">{meta.bn}</p>
                    <p className="text-[11px] font-bold tabular-nums text-amber-200/50">
                      {new Date(row.created_at).toLocaleString("bn-BD")}
                    </p>
                  </div>
                  <p className={`shrink-0 text-[14px] font-black tabular-nums ${positive ? "text-emerald-300" : "text-rose-300"}`}>
                    {positive ? "+" : ""}{formatCoins(row.amount)} 🪙
                  </p>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-3 px-1 text-center text-[11px] font-bold text-amber-200/50">
          কয়েন জমাতে থাকুন — যত বেশি কয়েন, এক্সচেঞ্জ চালু হলে তত বেশি সুবিধা! ✨
        </p>
      </div>
    </div>
  );
}
