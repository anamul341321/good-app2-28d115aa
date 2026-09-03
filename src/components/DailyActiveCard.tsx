import { Clock, CheckCircle2, Info } from "lucide-react";
import { DAILY_ACTIVE_REQUIRED, formatActiveTime, useActivityToday } from "@/hooks/useActivityTracker";

/**
 * ডেইলি অ্যাক্টিভ টাইম নোটিশ + লাইভ কাউন্টার।
 * নিয়ম: প্রতিদিন কমপক্ষে ১ ঘণ্টা অ্যাপে অ্যাক্টিভ থাকলেই মাইনিং ব্যালেন্স ক্লেইম করা যাবে।
 * সময়টা একবারে লাগবে না — সারাদিনে যতবার ইচ্ছা, ৫/৭ মিনিট করে মিলিয়ে ১ ঘণ্টা হলেই হবে।
 *
 * রঙ: কার্ডের ভেতরটা গাঢ় (dark) রাখা হয়েছে, তাই সাদা লেখা লাইট থিমেও স্পষ্ট পড়া যায়।
 */
export function DailyActiveCard() {
  const { data } = useActivityToday();
  const seconds = data?.seconds ?? 0;
  const required = data?.required ?? DAILY_ACTIVE_REQUIRED;
  const done = seconds >= required;
  const pct = Math.min(100, (seconds / required) * 100);
  const left = Math.max(0, required - seconds);

  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border p-3.5 shadow-lg ${
        done
          ? "border-emerald-400/50 bg-gradient-to-br from-emerald-900 via-teal-900 to-slate-900"
          : "border-amber-400/50 bg-gradient-to-br from-amber-900 via-orange-900 to-slate-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${
              done ? "bg-emerald-400/25 text-emerald-100" : "bg-amber-400/25 text-amber-100"
            }`}
          >
            {done ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-black leading-tight text-white">
              📢 আজকের অ্যাক্টিভ সময়
            </p>
            <p className="mono-num text-[16px] font-black leading-tight text-white">
              {formatActiveTime(seconds)}{" "}
              <span className="text-[11px] font-bold text-white/75">/ ১ ঘন্টা</span>
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
            done ? "bg-emerald-400/30 text-white" : "bg-amber-400/30 text-white"
          }`}
        >
          {done ? "✅ ক্লেইম চালু" : "লাইভ"}
        </span>
      </div>

      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-black/50">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            done
              ? "bg-gradient-to-r from-emerald-300 to-teal-400"
              : "bg-gradient-to-r from-amber-300 to-orange-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="mt-2.5 flex items-start gap-1.5 text-[12px] font-semibold leading-relaxed text-white">
        <Info className="mt-[3px] h-3.5 w-3.5 shrink-0 text-white/80" />
        {done ? (
          <span>
            দারুণ! আজকের <b>১ ঘণ্টা</b> অ্যাক্টিভ সময় পূরণ হয়েছে — এখন আপনার{" "}
            <b>মাইনিং ব্যালেন্স ক্লেইম</b> করতে পারবেন।
          </span>
        ) : (
          <span>
            মাইনিং ব্যালেন্স ক্লেইম করতে <b>প্রতিদিন কমপক্ষে ১ ঘণ্টা</b> অ্যাপে অ্যাক্টিভ থাকতে হবে।
            একবারে লাগবে না — সকালে ৫ মিনিট, দুপুরে ৭ মিনিট, যখনই সময় পান একটু একটু করে ব্যবহার করুন;
            সারাদিনে মিলিয়ে ১ ঘণ্টা হলেই ক্লেইম খুলে যাবে। আর <b>{formatActiveTime(left)}</b> বাকি।
          </span>
        )}
      </p>
    </div>
  );
}
