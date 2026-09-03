import { Clock, CheckCircle2, Flame, ShieldCheck } from "lucide-react";
import { DAILY_ACTIVE_REQUIRED, formatActiveTime, useActivityToday } from "@/hooks/useActivityTracker";

/**
 * ডেইলি অ্যাক্টিভ টাইম কার্ড — মাইনিং কার্ডের নিচে বসে।
 * নিয়ম: প্রতিদিন কমপক্ষে ১ ঘণ্টা অ্যাপে অ্যাক্টিভ থাকলেই মাইনিং ক্লেইম বাটন খুলবে।
 * ডিজাইন: গাঢ় গ্লাস কার্ড + রিং প্রগ্রেস, তাই লাইট/ডার্ক দুই থিমেই লেখা স্পষ্ট।
 */
export function DailyActiveCard() {
  const { data } = useActivityToday();
  const seconds = data?.seconds ?? 0;
  const required = data?.required ?? DAILY_ACTIVE_REQUIRED;
  const done = seconds >= required;
  const pct = Math.min(100, Math.round((seconds / required) * 100));
  const left = Math.max(0, required - seconds);

  const ring = done
    ? `conic-gradient(#34d399 ${pct}%, rgba(255,255,255,0.12) 0)`
    : `conic-gradient(#fbbf24 ${pct}%, rgba(255,255,255,0.12) 0)`;

  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border p-4 shadow-2xl ${
        done ? "border-emerald-400/45" : "border-amber-400/40"
      }`}
      style={{
        background: done
          ? "linear-gradient(150deg,#04241d 0%,#052e2b 45%,#071b2a 100%)"
          : "linear-gradient(150deg,#2a1704 0%,#331b06 45%,#0d1526 100%)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl opacity-40"
        style={{ background: done ? "#10b981" : "#f59e0b" }}
      />

      <div className="relative flex items-center gap-3.5">
        {/* রিং প্রগ্রেস */}
        <div className="relative grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full" style={{ background: ring }}>
          <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-black/70 text-center">
            <div>
              <p className="mono-num text-[15px] font-black leading-none text-white">{pct}%</p>
              <p className="text-[8px] font-black tracking-widest text-white/60">আজ</p>
            </div>
          </div>
          <span
            className={`absolute -bottom-1 grid h-5 w-5 place-items-center rounded-full border border-white/30 ${
              done ? "bg-emerald-400 text-emerald-950" : "bg-amber-400 text-amber-950"
            }`}
          >
            {done ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Flame className={`h-3.5 w-3.5 ${done ? "text-emerald-300" : "text-amber-300"}`} />
            <p className="text-[12px] font-black tracking-wide text-white/90">আজকের অ্যাক্টিভ সময়</p>
          </div>
          <p className="mono-num mt-0.5 text-[22px] font-black leading-none text-white">
            {formatActiveTime(seconds)}
            <span className="ml-1 text-[11px] font-bold text-white/60">/ ১ ঘণ্টা</span>
          </p>
          <p className={`mt-1 text-[11px] font-bold ${done ? "text-emerald-200" : "text-amber-200"}`}>
            {done ? "✅ ক্লেইম বাটন খুলে গেছে" : `⏳ আর ${formatActiveTime(left)} বাকি`}
          </p>
        </div>
      </div>

      <div className="relative mt-3 h-2.5 overflow-hidden rounded-full bg-white/12">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done ? "bg-gradient-to-r from-emerald-300 to-teal-400" : "bg-gradient-to-r from-amber-300 to-orange-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="relative mt-3 flex items-start gap-2 rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5">
        <ShieldCheck className="mt-[2px] h-4 w-4 shrink-0 text-white/75" />
        <p className="text-[11.5px] font-semibold leading-relaxed text-white">
          {done ? (
            <>
              দারুণ! আজকের <b>১ ঘণ্টা</b> পূরণ হয়েছে — উপরের <b>ক্লেইম</b> বাটন থেকে আজকের মাইনিং
              মেইন ব্যালেন্সে নিয়ে নিন।
            </>
          ) : (
            <>
              মাইনিং ক্লেইম করতে <b>প্রতিদিন ১ ঘণ্টা</b> অ্যাপে অ্যাক্টিভ থাকতে হবে — একবারে নয়,
              সকালে ৫ মিনিট, দুপুরে ৭ মিনিট… সারাদিনে মিলিয়ে ১ ঘণ্টা হলেই ক্লেইম খুলে যাবে।
            </>
          )}
        </p>
      </div>
    </div>
  );
}
