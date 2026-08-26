import { useState, useEffect } from "react";
import { Clock, Lock } from "lucide-react";
import { withdrawCountdownInfo } from "@/lib/withdraw-window";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function formatBn(ms: number) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds };
}

export function WithdrawCountdown() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const info = withdrawCountdownInfo(now);
  if (info.isOpen) return null;

  const { days, hours, minutes, seconds } = formatBn(info.msUntilOpen);

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-cyan/40 bg-linear-to-br from-violet/20 via-cyan/10 to-emerald/10 p-5 shadow-xl">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-cyan/20 blur-3xl" />
      <div className="relative flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan text-white shadow-lg">
          <Lock className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan">
            <Clock className="inline h-3 w-3 mr-1" />
            উইথড্র শীঘ্রই চালু হবে
          </p>
          <h3 className="mt-0.5 text-base font-black leading-tight text-foreground">
            প্রতি মাসের ১ তারিখে উইথড্র চালু হবে
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
            আগামী ১ তারিখ পর্যন্ত অপেক্ষা করুন। ঠিক ১ তারিখ থেকে আবার উইথড্র রিকোয়েস্ট পাঠাতে পারবেন।
          </p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-4 gap-2">
        <div className="rounded-2xl bg-background/80 p-2 text-center backdrop-blur-sm border border-border">
          <p className="mono-num text-xl font-black text-cyan" translate="no">{pad(days)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">দিন</p>
        </div>
        <div className="rounded-2xl bg-background/80 p-2 text-center backdrop-blur-sm border border-border">
          <p className="mono-num text-xl font-black text-cyan" translate="no">{pad(hours)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">ঘণ্টা</p>
        </div>
        <div className="rounded-2xl bg-background/80 p-2 text-center backdrop-blur-sm border border-border">
          <p className="mono-num text-xl font-black text-cyan" translate="no">{pad(minutes)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">মিনিট</p>
        </div>
        <div className="rounded-2xl bg-background/80 p-2 text-center backdrop-blur-sm border border-border">
          <p className="mono-num text-xl font-black text-cyan" translate="no">{pad(seconds)}</p>
          <p className="text-[9px] font-bold text-muted-foreground">সেকেন্ড</p>
        </div>
      </div>
    </div>
  );
}
