import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Flame, Timer, Zap } from "lucide-react";
import { OFFER_PER_SLOT_BONUS, offerTimeLeft, toBn } from "@/lib/offer";

/**
 * মার্কেটিং ব্যানার — ১০ দিনের সীমিত অফার, লাইভ কাউন্টডাউন সহ।
 * ইউজার যেন সময়ের চাপ বুঝে দ্রুত রি-ভেরিফাই করে সেভাবেই সাজানো।
 */
export function OfferBanner() {
  const navigate = useNavigate();
  const [left, setLeft] = useState(() => offerTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setLeft(offerTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!left.active) return null;
  const urgent = left.days < 3;

  return (
    <div
      className="relative overflow-hidden rounded-[24px] p-4 border border-white/25 shadow-xl"
      style={{
        background: urgent
          ? "linear-gradient(135deg,#b91c1c 0%,#ea580c 45%,#f59e0b 100%)"
          : "linear-gradient(135deg,#4c1d95 0%,#7c3aed 40%,#db2777 100%)",
      }}
    >
      <div className="absolute -top-10 -right-8 w-40 h-40 rounded-full bg-white/20 blur-3xl" aria-hidden />

      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 backdrop-blur-md">
            <Flame className="w-3 h-3 text-white animate-pulse" />
            <span className="text-[9px] font-black tracking-widest text-white uppercase">
              সীমিত সময়ের অফার
            </span>
          </span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/25 px-2 py-0.5">
            <Timer className="w-3 h-3 text-white" />
            <span className="text-[9px] font-black text-white">
              {left.days > 0 ? `${toBn(left.days, 1)} দিন বাকি` : "আজই শেষ!"}
            </span>
          </span>
        </div>

        <h3 className="mt-2 text-[15px] font-black text-white leading-snug drop-shadow">
          প্রতি ঘর Re-verify করলেই <span className="text-yellow-200">+{toBn(OFFER_PER_SLOT_BONUS, 2)}৳</span> 🎁
        </h3>
        <p className="text-[11px] font-bold text-white/90 leading-snug mt-0.5">
          আগে যারা রি-ভেরিফাই করেছিলেন — এখন আবার করলেই প্রতি ঘরে ১০৳ মেইন ব্যালেন্সে, আর ওই ঘরের
          জমা হওয়া মাইনিং টাকা সাথে সাথেই <span className="text-yellow-200">আনলক</span> — ক্লেইম করে
          মেইন ব্যালেন্সে নিয়ে নিন।
        </p>

        <div className="mt-2.5 grid grid-cols-4 gap-1.5">
          {[
            { v: left.days, l: "দিন" },
            { v: left.hours, l: "ঘণ্টা" },
            { v: left.minutes, l: "মিনিট" },
            { v: left.seconds, l: "সেকেন্ড" },
          ].map((c) => (
            <div
              key={c.l}
              className={`rounded-xl bg-black/30 border border-white/20 py-1.5 text-center ${
                urgent ? "animate-pulse" : ""
              }`}
            >
              <p className="mono-num text-[17px] font-black text-white leading-none" translate="no">
                {toBn(c.v)}
              </p>
              <p className="text-[8px] font-black text-white/70 mt-0.5">{c.l}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate({ to: "/reverify", search: { taskId: undefined } })}
          className="mt-2.5 w-full rounded-2xl bg-white py-2.5 text-[13px] font-black text-rose-700 btn-press flex items-center justify-center gap-1.5 shadow-lg"
        >
          <Zap className="w-4 h-4" /> এখনই Re-verify করে ১০৳ নিন
        </button>
        <p className="text-[9px] font-black text-white/80 text-center mt-1.5">
          ⏳ সময় শেষ হলে এই অফার আর থাকবে না
        </p>
      </div>
    </div>
  );
}
