import { Gift, Pickaxe, ListOrdered } from "lucide-react";

const tk = (n: number) => `${n.toFixed(2)}৳`;

export type BreakdownStep = { key: string; label: string; formula?: string | null; amount: number };
export type BreakdownData = {
  bonus: {
    total: number;
    rates: { firstVerify: number; reverify: number; referrer: number };
    referrerPaidCount: number;
    steps: BreakdownStep[];
  };
  mining: {
    total: number;
    selfTotal: number;
    referralTotal: number;
    selfSlots: number;
    referralUnits: number;
    monthlySelf: number;
    monthlyReferral: number;
    monthlyTotal: number;
    perDay: number;
    isActive: boolean;
    activatedAt: string | null;
    daysRunning: number;
    referees: { uid: number | null; name: string; slots: number; monthly: number }[];
    steps: BreakdownStep[];
  };
};

/**
 * "ধাপে ধাপে হিসাব" — explains exactly how the bonus total and the mining
 * total were formed, so the user (or admin) can reconcile every taka by hand.
 */
export function EarningsBreakdown({ data }: { data: BreakdownData }) {
  const b = data.bonus;
  const m = data.mining;
  const refBonus = b.steps.find((s) => s.key === "referrer")?.amount ?? 0;
  const selfFirst = b.steps.find((s) => s.key === "self-first")?.amount ?? 0;
  const selfRe = b.steps.find((s) => s.key === "self-reverify")?.amount ?? 0;

  return (
    <div className="space-y-4">
      {/* সংক্ষেপে — একদম সহজ ভাষায় */}
      <div className="rounded-2xl border-2 border-emerald/30 bg-emerald/5 p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-emerald">সংক্ষেপে — একদম সহজ ভাষায়</p>
        <ul className="space-y-1.5 text-[11.5px] font-bold text-navy leading-relaxed">
          <li>
            🎉 <b>বোনাস {tk(b.total)}</b> = নিজের ১০ স্লট first verify <b>{selfFirst}৳</b> + ১০ স্লট re-verify{" "}
            <b>{selfRe}৳</b>
            {refBonus > 0 ? (
              <> + রেফার বোনাস <b>{b.referrerPaidCount} জন × {b.rates.referrer}৳ = {refBonus}৳</b></>
            ) : null}
            <span className="block text-[10px] font-bold text-muted-foreground">
              👉 এটা একবারই পাওয়া যায় (প্রথম ১০ স্লটে), প্রতি মাসে না।
            </span>
          </li>
          <li>
            ⛏️ <b>মাইনিং {tk(m.total)}</b> = নিজের <b>{m.selfSlots} স্লট × ৫০৳/মাস = {m.monthlySelf}৳</b>
            {m.monthlyReferral > 0 ? <> + রেফারদের মাইনিং-এর ১০% = <b>{m.monthlyReferral.toFixed(2)}৳/মাস</b></> : null}
            <span className="block text-[10px] font-bold text-muted-foreground">
              👉 মাসে মোট <b>{m.monthlyTotal.toFixed(2)}৳</b> → প্রতিদিন <b>{m.perDay.toFixed(2)}৳</b> → এটাই সেকেন্ডে সেকেন্ডে জমা হচ্ছে
              {m.activatedAt ? <> ({m.daysRunning.toFixed(1)} দিন ধরে চলছে)</> : <> (এখনো চালু হয়নি)</>}।
            </span>
          </li>
          <li className="pt-1 border-t border-emerald/20">
            🧮 তাই মোট এসেছে <b>{tk(b.total + m.total)}</b> — বোনাস {tk(b.total)} + মাইনিং {tk(m.total)}।
            <span className="block text-[10px] font-bold text-muted-foreground">নিচে ধাপে ধাপে প্রতিটি টাকার হিসাব দেওয়া আছে।</span>
          </li>
        </ul>
      </div>


      <div className="rounded-2xl border border-amber/30 bg-amber/5 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-amber flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" /> বোনাস কিভাবে {tk(data.bonus.total)} হলো
          </p>
        </div>
        <StepList steps={data.bonus.steps} total={data.bonus.total} totalLabel="মোট বোনাস" />
        <p className="text-[9.5px] text-muted-foreground leading-relaxed">
          🎯 নিয়ম: প্রথম ১০টি স্লট first verify = {data.bonus.rates.firstVerify}৳, ১০টি স্লট re-verify = {data.bonus.rates.reverify}৳ (তখনই মাইনিং চালু),
          আর আপনার রেফার করা প্রত্যেক ইউজার ১০টি first verify শেষ করলে আপনি পান {data.bonus.rates.referrer}৳।
        </p>
      </div>

      {/* Mining */}
      <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest font-black text-cyan flex items-center gap-1.5">
          <Pickaxe className="w-3.5 h-3.5" /> মাইনিং কিভাবে {tk(data.mining.total)} হলো
        </p>
        <StepList steps={data.mining.steps} total={data.mining.total} totalLabel="মোট মাইনিং আয়" />
        {data.mining.referees.length > 0 && (
          <div className="pt-1 space-y-1">
            <p className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">
              রেফার কমিশন কোথা থেকে (প্রতি জনের ১০%)
            </p>
            {data.mining.referees.slice(0, 20).map((r) => (
              <div key={`${r.uid}-${r.name}`} className="flex items-center justify-between text-[10.5px] bg-surface-2 rounded-lg px-2 py-1">
                <span className="truncate">
                  {r.name} <span className="text-muted-foreground">· UID {r.uid ?? "—"} · {r.slots} স্লট</span>
                </span>
                <span className="mono-num font-black text-emerald shrink-0">{r.monthly.toFixed(2)}৳/মাস</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[9.5px] text-muted-foreground leading-relaxed">
          ⛏️ প্রতিটি re-verified স্লট মাসে ৫০৳ মাইন করে (১০ স্লট = ৫০০৳/মাস, ১১ স্লট = ৫৫০৳/মাস)। রেফারের মাইনিং-এর ১০% আপনার ব্যালেন্সে যোগ হয় —
          আলাদা ওয়ালেটে যায় না। টাকা প্রতি সেকেন্ডে জমা হয়, তাই সময়ের সাথে অঙ্ক বাড়তেই থাকে।
        </p>
      </div>
    </div>
  );
}

function StepList({ steps, total, totalLabel }: { steps: BreakdownStep[]; total: number; totalLabel: string }) {
  return (
    <div className="space-y-1.5">
      {steps.length === 0 && <p className="text-[11px] text-muted-foreground">এখনো কিছু জমা হয়নি।</p>}
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-start gap-2 rounded-xl bg-background/60 border border-border px-2.5 py-2">
          <span className="mono-num text-[9px] font-black w-5 h-5 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-navy leading-snug">{s.label}</p>
            {s.formula && <p className="text-[9.5px] text-muted-foreground leading-snug">{s.formula}</p>}
          </div>
          <p className={`mono-num font-black text-[12px] shrink-0 ${s.amount < 0 ? "text-rose" : "text-emerald"}`}>
            {s.amount > 0 ? "+" : ""}{tk(s.amount)}
          </p>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-2.5 py-2">
        <p className="text-[10.5px] font-black flex items-center gap-1.5">
          <ListOrdered className="w-3 h-3" /> {totalLabel}
        </p>
        <p className="mono-num font-black text-[13px] text-cyan">{tk(total)}</p>
      </div>
    </div>
  );
}
