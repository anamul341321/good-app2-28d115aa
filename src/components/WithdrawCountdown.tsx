import { useState, useEffect } from "react";
import { CalendarClock, CheckCircle2, LockKeyhole } from "lucide-react";
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

  if (info.isOpen) {
    const c = formatBn(info.msUntilClose);
    return (
      <div className="premium-panel rounded-2xl border-emerald/35 p-4">
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald text-primary-foreground shadow-lg">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-black text-emerald">মাইনিং উইথড্র এখন চালু</p>
            <h3 className="text-sm font-black leading-tight text-foreground">৩ তারিখ রাত ১০টায় বন্ধ হবে</h3>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-4 gap-1.5">
          {[["দিন", c.days], ["ঘণ্টা", c.hours], ["মিনিট", c.minutes], ["সেকেন্ড", c.seconds]].map(([label, val]) => (
            <div key={label as string} className="rounded-xl bg-emerald/10 px-1 py-1.5 text-center border border-emerald/20">
              <p className="mono-num text-base font-black text-emerald" translate="no">{pad(val as number)}</p>
              <p className="text-[8px] font-bold text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        <p className="relative mt-2 text-center text-[10px] font-bold text-muted-foreground">মাইনিং টাকা তোলার সময় বাকি</p>
      </div>
    );
  }

  const { days, hours, minutes, seconds } = formatBn(info.msUntilOpen);

  return (
    <div className="premium-panel rounded-2xl border-cyan/35 p-4">
      <div className="relative flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan text-primary-foreground shadow-lg">
          <LockKeyhole className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-[11px] font-black text-cyan">মাইনিং উইথড্র এখন বন্ধ</p>
          <h3 className="text-sm font-black leading-tight text-foreground">পরের মাসের ১ তারিখ রাত ১২টায় খুলবে</h3>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-4 gap-1.5">
        {[["দিন", days], ["ঘণ্টা", hours], ["মিনিট", minutes], ["সেকেন্ড", seconds]].map(([label, val]) => (
          <div key={label as string} className="rounded-xl bg-cyan/10 px-1 py-1.5 text-center border border-cyan/20">
            <p className="mono-num text-base font-black text-cyan" translate="no">{pad(val as number)}</p>
            <p className="text-[8px] font-bold text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <p className="relative mt-2 flex items-center justify-center gap-1 text-center text-[10px] font-bold text-muted-foreground"><CalendarClock className="h-3 w-3" /> প্রতি মাসের ১–৩ তারিখ মাইনিং উইথড্র খোলা</p>
      <p className="relative mt-1 text-center text-[10px] font-black text-emerald">বোনাস টাকা থাকলে যেকোনো দিন তোলা যাবে</p>
    </div>
  );
}
