import { useEffect, useState } from "react";
import { Sparkles, X, PartyPopper } from "lucide-react";
import wowGirl from "@/assets/server-back-wow.jpg";

const KEY = "server_back_notice_v1_seen_at";

/**
 * সার্ভার আবার সচল — খুশির অ্যানিমেটেড ব্যানার/মোডাল।
 * প্রতি ১২ ঘণ্টায় একবার দেখাবে।
 */
export function ServerBackModal() {
  const [open, setOpen] = useState(false);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center px-3 py-6 bg-black/85 animate-in fade-in duration-300">
      {/* confetti */}
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

      <div className="relative w-full max-w-sm max-h-full overflow-y-auto rounded-3xl border-2 border-emerald bg-surface shadow-[0_0_70px_-10px_rgba(16,185,129,0.55)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
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
            alt="সার্ভার আবার চালু হওয়ার খুশির উদযাপন"
            width={1024}
            height={768}
            className="h-44 w-full object-cover object-top"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
          <span className="absolute bottom-2 left-3 inline-flex items-center gap-1.5 rounded-full bg-emerald/25 px-3 py-1 text-[11px] font-black text-emerald ring-1 ring-emerald/50 animate-pulse">
            <PartyPopper className="h-3.5 w-3.5" /> সার্ভার আবার সচল ✅
          </span>
        </div>

        <div className="space-y-3 p-5 text-center">
          <h2 className="text-xl font-black leading-tight text-emerald drop-shadow-sm">
            🌸 আসসালামু আলাইকুম 🌸
          </h2>
          <p className="text-[13.5px] font-bold leading-relaxed text-foreground">
            আশা করি সবাই ভালো আছেন। ❤️
          </p>

          <div className="rounded-2xl border border-emerald bg-emerald/10 p-4 text-left">
            <p className="text-[13.5px] font-bold leading-relaxed text-foreground">
              আলহামদুলিল্লাহ, দীর্ঘ প্রচেষ্টার পর আমরা আমাদের সার্ভার পুনরায় সচল করতে সক্ষম
              হয়েছি। 🥰✅
            </p>
          </div>

          <p className="text-[13px] font-bold leading-relaxed text-foreground">
            সার্ভার সমস্যার কারণে আপনাদের যে সাময়িক অসুবিধার সম্মুখীন হতে হয়েছে, তার জন্য আমরা
            আন্তরিকভাবে দুঃখিত ও ক্ষমাপ্রার্থী। 🙏😔
          </p>

          <div className="rounded-2xl border border-amber bg-amber/10 p-4 text-left">
            <p className="text-[13.5px] font-black leading-relaxed text-amber">
              ✨ আশা করছি, এখন থেকে আপনারা আগের মতোই স্বাভাবিকভাবে Face Verification সম্পন্ন
              করতে পারবেন। 🤳✅
            </p>
          </div>

          <p className="text-[13px] font-bold leading-relaxed text-foreground">
            আপনাদের ধৈর্য, সহযোগিতা ও আমাদের প্রতি আস্থার জন্য অসংখ্য ধন্যবাদ। ❤️
            <br />
            🤝 সবার সহযোগিতা আমাদের জন্য অত্যন্ত গুরুত্বপূর্ণ।
            <br />
            ধন্যবাদ সবাইকে। 🌹
          </p>

          <button
            onClick={() => setOpen(false)}
            className="gradient-cta w-full rounded-2xl px-4 py-3.5 text-[15px] font-black btn-press"
          >
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-5 w-5" /> আলহামদুলিল্লাহ, চালিয়ে যান
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
