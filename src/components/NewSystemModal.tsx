import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, PartyPopper, Sparkles } from "lucide-react";
import wowGirl from "@/assets/new-system-wow.jpg";
import { getAppStatus } from "@/lib/app-status.functions";
import { isLiteBuild } from "@/lib/lite-build";

const KEY = "new_mining_system_notice_v1_seen_at";

/**
 * 🎉 নতুন মাইনিং সিস্টেম ঘোষণা — খুশির ব্যানার/মোডাল।
 * প্রতি ১২ ঘণ্টায় একবার দেখাবে।
 */
export function NewSystemModal() {
  const [open, setOpen] = useState(false);
  const { data: status } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 60_000,
  });
  const bonusEnabled = status?.bonusEnabled === true;
  const bonusTotal = Number(status?.firstVerifyBonus ?? 0) + Number(status?.reverifyBonus ?? 0);


  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(KEY) || "0");
      if (Date.now() - last > 12 * 60 * 60 * 1000) {
        setOpen(true);
        localStorage.setItem(KEY, String(Date.now()));
      }
    } catch {
      setOpen(true);
    }
  }, []);

  if (isLiteBuild() || !open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[95] flex items-end justify-center px-3 pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-300">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-sm animate-bounce"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 90}%`,
              backgroundColor: ["#f59e0b", "#10b981", "#06b6d4", "#f43f5e", "#a855f7"][i % 5],
              animationDelay: `${(i % 6) * 0.25}s`,
              animationDuration: `${1.6 + (i % 4) * 0.35}s`,
              opacity: 0.85,
            }}
          />
        ))}
      </div>

      <div className="pointer-events-auto relative w-full max-w-sm max-h-[min(78vh,680px)] overflow-y-auto rounded-3xl border-2 border-emerald bg-surface shadow-[0_0_70px_-10px_rgba(16,185,129,0.55)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <button
          aria-label="বন্ধ করুন"
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 z-10 rounded-lg bg-black/50 p-1.5 text-white btn-press"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative">
          <img
            src={wowGirl}
            alt="নতুন মাইনিং সিস্টেমের খুশির ঘোষণা"
            width={1024}
            height={768}
            loading="lazy"
            className="h-44 w-full object-cover object-top"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          <span className="absolute bottom-2 left-3 inline-flex items-center gap-1.5 rounded-full bg-emerald/25 px-3 py-1 text-[11px] font-black text-emerald ring-1 ring-emerald/50 animate-pulse">
            <PartyPopper className="h-3.5 w-3.5" /> নতুন সিস্টেম চালু 🎉
          </span>
        </div>

        <div className="space-y-3 p-5">
          <h2 className="text-center text-xl font-black leading-tight text-emerald drop-shadow-sm">
            🎊 দারুণ খুশির খবর! 🎊
          </h2>
          <p className="text-center text-[13px] font-bold leading-relaxed text-foreground">
            মাইনিং ও উইথড্র সিস্টেম এখন <b className="text-emerald">অনেক সহজ</b> করে দেওয়া হয়েছে ❤️
          </p>

          <ul className="space-y-2 rounded-2xl border border-emerald bg-emerald/10 p-4 text-[12.5px] font-bold leading-relaxed text-foreground">
            <li className="flex gap-2">
              <span className="shrink-0">⛏️</span>
              <span><b>স্লটের কোনো লিমিট নেই</b> — ১টি স্লট রি-ভেরিফাই করলেই <b>ওই ১টির মাইনিং চালু</b>। ২টি করলে ২টির, যতটি করবেন ততটির।</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">💰</span>
              <span>প্রতি স্লটে <b>৫০৳/মাস</b> (দিনে প্রায় <b>১.৬৭৳</b>) — যত বেশি স্লট, তত বেশি আয়।</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">🕒</span>
              <span><b>উইথড্রের নিয়ম:</b> বোনাস/মেইন ব্যালেন্স যেকোনো সময়, আর <b>মাইনিং ব্যালেন্স শুধু প্রতি মাসের ১–৩ তারিখে</b> তোলা যাবে।</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">🎁</span>
              <span>আগে যারা রি-ভেরিফাই করেছিলেন, তারা আবার করলে <b>প্রতি স্লটে ১০৳</b> সাথে সাথে মেইন ব্যালেন্সে যোগ হবে।</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">🔓</span>
              <span>যে স্লট রি-ভেরিফাই করবেন, <b>সেই স্লটের জমা মাইনিং টাকা আনলক</b> হয়ে যাবে।</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0">🏆</span>
              {bonusEnabled ? (
                <span>
                  নতুন ইউজার: ১০টি স্লট ভেরিফাই + রি-ভেরিফাই সম্পূর্ণ করলে{" "}
                  <b>{bonusTotal}৳ বোনাস</b> (অফার চলাকালীন)।
                </span>
              ) : (
                <span>
                  <b>এককালীন First verify / Re-verify বোনাস অফার আপাতত বন্ধ</b> — এখন আয় হবে
                  মাইনিং ও প্রতি স্লটে ১০৳ রি-ভেরিফাই গিফট থেকে। অফার আবার চালু হলে অ্যাপেই
                  জানিয়ে দেওয়া হবে।
                </span>
              )}
            </li>
          </ul>

          <button
            onClick={() => setOpen(false)}
            className="w-full rounded-2xl bg-emerald py-3 text-sm font-black text-white btn-press shine flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" /> বুঝেছি, শুরু করি
          </button>
        </div>
      </div>
    </div>
  );
}
