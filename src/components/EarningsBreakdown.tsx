import { Gift, Pickaxe, ListOrdered, ArrowLeftRight, ExternalLink } from "lucide-react";

const tk = (n: number) => `${n.toFixed(2)}৳`;

export type BreakdownStep = { key: string; label: string; formula?: string | null; amount: number };
export type TransferIn = {
  id: string;
  senderId: string;
  uid: number | null;
  name: string;
  phone?: string | null;
  amount: number;
  note?: string | null;
  createdAt: string;
  sender: {
    bonusTotal: number;
    miningTotal: number;
    adminCredited: number;
    selfSlots: number;
    legal: boolean;
    banned: boolean;
    frozen: boolean;
  };
};
export type BreakdownData = {
  transfersIn?: TransferIn[];
  transfersInTotal?: number;

  bonus: {
    total: number;
    rates: { firstVerify: number; reverify: number; referrer: number };
    currentRates?: { firstVerify: number; reverify: number; referrer: number };
    ratesAssumed?: boolean;
    referrerPaidCount: number;
    selfFirst?: number;
    selfReverify?: number;
    referrerTotal?: number;
    otherTotal?: number;
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
    legacyUnclassified?: number;
    referees: { uid: number | null; name: string; slots: number; monthly: number }[];
    steps: BreakdownStep[];
  };
};

export type BreakdownTotals = {
  withdrawn?: number;
  paidWithdrawals?: number;
  balance?: number;
  debtActive?: number;
  successfulRecharges?: number;
  transfersOutTotal?: number;
  feeOrAdjustmentOut?: number;
};


/**
 * "ধাপে ধাপে হিসাব" — explains exactly how the bonus total and the mining
 * total were formed, so the user (or admin) can reconcile every taka by hand.
 */
export function EarningsBreakdown({
  data,
  totals,
  adminLinks,
}: {
  data: BreakdownData;
  totals?: BreakdownTotals;
  adminLinks?: boolean;
}) {
  const b = data.bonus;
  const m = data.mining;
  const refBonus = b.referrerTotal ?? b.steps.find((s) => s.key === "referrer")?.amount ?? 0;
  const selfFirst = b.selfFirst ?? b.steps.find((s) => s.key === "self-first")?.amount ?? 0;
  const selfRe = b.selfReverify ?? b.steps.find((s) => s.key === "self-reverify")?.amount ?? 0;
  const other = b.otherTotal ?? 0;
  const legacyUnclassified = m.legacyUnclassified ?? 0;
  const lifetimeIn = b.total + m.total + legacyUnclassified;
  const withdrawn = totals?.withdrawn ?? 0;
  const transfersIn = data.transfersIn ?? [];
  const transfersInTotal = data.transfersInTotal ?? transfersIn.reduce((s, t) => s + t.amount, 0);

  const balance = totals?.balance ?? lifetimeIn - withdrawn;

  return (
    <div className="space-y-4">
      {/* ====== অন্য ইউজার থেকে আসা টাকা ====== */}
      {transfersIn.length > 0 && (
        <div className="rounded-2xl border-2 border-violet-400/50 bg-violet-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-widest font-black text-violet-600 flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" /> অন্য ইউজার থেকে পাওয়া টাকা
            </p>
            <p className="mono-num text-[13px] font-black text-violet-600">{tk(transfersInTotal)}</p>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground">
            👉 এই টাকা অ্যাডমিন দেয়নি — নিচের ইউজাররা পাঠিয়েছে। প্রেরকের আয় legal কি না তাও দেখানো হলো।
          </p>
          {transfersIn.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-background/70 p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-black text-navy truncate">
                  {t.name} <span className="text-muted-foreground font-bold">· UID {t.uid ?? "—"}</span>
                </p>
                <p className="mono-num text-[13px] font-black text-emerald shrink-0">+{tk(t.amount)}</p>
              </div>
              <p className="text-[9.5px] font-bold text-muted-foreground">
                {new Date(t.createdAt).toLocaleString("bn-BD")}
                {t.phone ? ` · ${t.phone}` : ""}
                {t.note ? ` · ${t.note}` : ""}
              </p>
              <p className="text-[10.5px] font-bold leading-snug">
                {t.sender.legal ? (
                  <span className="text-emerald">
                    ✅ প্রেরকের আয় legal — মাইনিং {tk(t.sender.miningTotal)} + বোনাস {tk(t.sender.bonusTotal)} ({t.sender.selfSlots} স্লট)
                  </span>
                ) : (
                  <span className="text-rose">
                    ⚠️ সন্দেহজনক — {t.sender.adminCredited > 0 ? `অ্যাডমিন ক্রেডিট ${tk(t.sender.adminCredited)}` : ""}
                    {t.sender.banned ? " · account blocked" : ""}
                    {t.sender.frozen ? " · balance frozen" : ""}
                  </span>
                )}
              </p>
              {adminLinks && (
                <a
                  href={`/admin/user/${t.senderId}`}
                  className="inline-flex items-center gap-1 text-[10.5px] font-black text-cyan underline"
                >
                  <ExternalLink className="w-3 h-3" /> প্রেরকের প্রোফাইল ও তার আয়ের হিসাব দেখুন
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ====== ধাপে ধাপে একদম সহজ হিসাব ====== */}
      <div className="rounded-2xl border-2 border-cyan/40 bg-cyan/5 p-4 space-y-3">

        <p className="text-[11px] uppercase tracking-widest font-black text-cyan">ধাপে ধাপে আপনার হিসাব</p>

        <SimpleStep n={1} title="বোনাস পেয়েছেন" amount={tk(b.total)} tone="text-amber">
          <Line ok={selfFirst > 0} text={`১০টি স্লট first verify করার বোনাস — ${tk(selfFirst)}`} />
          <Line ok={selfRe > 0} text={`১০টি স্লট re-verify করার বোনাস (এখানেই মাইনিং চালু) — ${tk(selfRe)}`} />
          <Line
            ok={refBonus > 0}
            text={
              refBonus > 0
                ? `রেফার বোনাস — ${b.referrerPaidCount} জন রেফার ১০টি first verify শেষ করেছে, তাই ${b.referrerPaidCount} × ${b.rates.referrer}৳ = ${tk(refBonus)} পেয়েছেন ✅`
                : `রেফার বোনাস — এখনো কোনো রেফার ১০টি first verify শেষ করেনি, তাই ০৳`
            }
          />
          {other > 0 && <Line ok text={`অন্যান্য / অ্যাডমিন যোগ — ${tk(other)}`} />}
          <p className="text-[10px] font-bold text-muted-foreground">👉 বোনাস একবারই পাওয়া যায়, প্রতি মাসে না।</p>
          {b.ratesAssumed && b.currentRates && (
            <p className="rounded-lg border border-amber/40 bg-amber/10 p-2 text-[10px] font-bold text-amber leading-relaxed">
              ⏳ আপনি যখন verify করেছিলেন তখনকার হার অনুযায়ী হিসাব দেখানো হয়েছে (first verify {b.rates.firstVerify}৳, re-verify{" "}
              {b.rates.reverify}৳, রেফার {b.rates.referrer}৳)। এখনকার অফার রেট আলাদা — first verify {b.currentRates.firstVerify}৳,
              re-verify {b.currentRates.reverify}৳, রেফার {b.currentRates.referrer}৳। পুরোনো বোনাস পুরোনো হারেই থাকে।
            </p>
          )}
        </SimpleStep>

        <SimpleStep n={2} title="মাইনিং থেকে জমা হয়েছে" amount={tk(m.total)} tone="text-cyan">
          <Line ok={m.selfSlots > 0} text={`নিজের ${m.selfSlots}টি re-verified স্লট × ৫০৳/মাস = ${m.monthlySelf}৳ প্রতি মাস`} />
          <Line ok={m.monthlyReferral > 0} text={`রেফারদের মাইনিং-এর ১০% কমিশন = ${m.monthlyReferral.toFixed(2)}৳ প্রতি মাস`} />
          <Line ok text={`মাসে মোট ${m.monthlyTotal.toFixed(2)}৳ → প্রতিদিন ${m.perDay.toFixed(2)}৳`} />
          <Line
            ok={!!m.activatedAt}
            text={
              m.activatedAt
                ? `${new Date(m.activatedAt).toLocaleDateString("bn-BD")} থেকে ${m.daysRunning.toFixed(1)} দিন চলছে → ${m.perDay.toFixed(2)}৳ × ${m.daysRunning.toFixed(1)} দিন ≈ ${tk(m.perDay * m.daysRunning)}`
                : "মাইনিং এখনো চালু হয়নি — ১০টি স্লট re-verify করলেই চালু হবে"
            }
          />
        </SimpleStep>

        <SimpleStep n={3} title="তাহলে মোট আয়" amount={tk(lifetimeIn)} tone="text-emerald">
          <Line ok text={`বোনাস ${tk(b.total)} + মাইনিং ${tk(m.total)}${legacyUnclassified > 0 ? ` + পুরোনো ক্রেডিট ${tk(legacyUnclassified)}` : ""} = ${tk(lifetimeIn)}`} />
        </SimpleStep>

        <SimpleStep n={4} title="ব্যালেন্স থেকে কত গেছে" amount={`− ${tk(withdrawn)}`} tone="text-rose">
          {totals?.paidWithdrawals !== undefined && (
            <Line ok text={`💸 উইথড্র করে হাতে পেয়েছেন — ${tk(totals.paidWithdrawals)}`} />
          )}
          {(totals?.successfulRecharges ?? 0) > 0 && (
            <Line ok text={`📱 মোবাইল রিচার্জ নিয়েছেন — ${tk(totals!.successfulRecharges!)}`} />
          )}
          {(totals?.transfersOutTotal ?? 0) > 0 && (
            <Line ok text={`🔁 অন্য ইউজারকে পাঠিয়েছেন — ${tk(totals!.transfersOutTotal!)}`} />
          )}
          {(totals?.feeOrAdjustmentOut ?? 0) > 0 && (
            <Line ok text={`🧾 উইথড্র ফি (১০–২০%) কাটা হয়েছে — ${tk(totals!.feeOrAdjustmentOut!)}`} />
          )}
          <p className="text-[10px] font-bold text-muted-foreground">
            👉 সব মিলিয়ে ব্যালেন্স থেকে কমেছে {tk(withdrawn)} — এর মধ্যে আপনি হাতে/রিচার্জে পেয়েছেন{" "}
            {tk((totals?.paidWithdrawals ?? 0) + (totals?.successfulRecharges ?? 0) + (totals?.transfersOutTotal ?? 0))}, বাকিটা ফি।
          </p>
          {(totals?.debtActive ?? 0) > 0 && <Line ok text={`⚠️ warning/পাওনা বাকি ${tk(totals?.debtActive ?? 0)}`} />}
        </SimpleStep>


        <SimpleStep n={5} title="এখন হাতে আছে" amount={tk(balance)} tone="text-cyan">
          <Line ok text={`মোট আয় ${tk(lifetimeIn)} − তোলা/খরচ ${tk(withdrawn)}${(totals?.debtActive ?? 0) > 0 ? ` − পাওনা ${tk(totals?.debtActive ?? 0)}` : ""} = ${tk(balance)}`} />
        </SimpleStep>

        {legacyUnclassified > 0 && (
          <p className="rounded-lg border border-amber/40 bg-amber/10 p-2 text-[10px] font-bold text-amber">
            ⚠️ <b>{tk(legacyUnclassified)}</b> পুরোনো ক্রেডিটের উৎস নিশ্চিত পাওয়া যায়নি — এটি মাইনিং বা রেফার কমিশন হিসেবে গণ্য নয়।
          </p>
        )}
      </div>
      <details className="group space-y-4">
        <summary className="cursor-pointer list-none rounded-xl border border-border bg-surface-2 px-3 py-2 text-[11px] font-black text-navy">
          🔍 আরও বিস্তারিত হিসাব দেখুন (তারিখ ধরে প্রতিটি টাকা)
        </summary>
        <div className="space-y-4 pt-3">
      <div className="rounded-2xl border border-amber/30 bg-amber/5 p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-widest font-black text-amber flex items-center gap-1.5">
            <Gift className="w-3.5 h-3.5" /> বোনাস কিভাবে {tk(data.bonus.total)} হলো
          </p>
        </div>
        <StepList steps={data.bonus.steps} total={data.bonus.total} totalLabel="মোট বোনাস" />
        <p className="text-[9.5px] text-muted-foreground leading-relaxed">
          🎯 এখনকার নিয়ম: প্রথম ১০টি স্লট first verify = {(b.currentRates ?? b.rates).firstVerify}৳, ১০টি স্লট re-verify ={" "}
          {(b.currentRates ?? b.rates).reverify}৳ (তখনই মাইনিং চালু), আর আপনার রেফার করা প্রত্যেক ইউজার ১০টি first verify শেষ করলে আপনি পান{" "}
          {(b.currentRates ?? b.rates).referrer}৳। উপরের হিসাব আপনার সময়ের হারেই করা হয়েছে।

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
        {/* মাইনিং যাচাই — তারিখ ও দিন ধরে অঙ্ক মিলিয়ে দেখানো */}
        <div className="rounded-xl border border-cyan/30 bg-white/60 p-3 space-y-1">
          <p className="text-[10px] font-black text-cyan">🔎 মাইনিং যাচাই (তারিখ ধরে হিসাব)</p>
          <p className="text-[10.5px] font-bold text-navy leading-relaxed">
            {m.activatedAt ? (
              <>
                মাইনিং চালু হয়েছে <b>{new Date(m.activatedAt).toLocaleString("bn-BD")}</b> — আজ পর্যন্ত{" "}
                <b>{m.daysRunning.toFixed(2)} দিন</b>। প্রতিদিন <b>{m.perDay.toFixed(2)}৳</b> × {m.daysRunning.toFixed(2)} দিন ≈{" "}
                <b>{(m.perDay * m.daysRunning).toFixed(2)}৳</b>; আসল জমা হয়েছে <b>{tk(m.total)}</b>।
                <span className="block text-[9.5px] text-muted-foreground mt-0.5">
                  👉 এই দুই অঙ্ক মিলে গেলে মাইনিং ১০০% ঠিক আছে। মাইনিং শুরুর আগের টাকা মাইনিং নয় — সেটা বোনাস/অ্যাডমিন ক্রেডিট।
                </span>
              </>
            ) : (
              <>মাইনিং এখনো চালু হয়নি — ১০টি স্লট re-verify শেষ হলেই তারিখ থেকে গোনা শুরু হবে।</>
            )}
          </p>
        </div>
        <p className="text-[9.5px] text-muted-foreground leading-relaxed">
          ⛏️ প্রতিটি re-verified স্লট মাসে ৫০৳ মাইন করে (১০ স্লট = ৫০০৳/মাস, ১১ স্লট = ৫৫০৳/মাস)। রেফারের মাইনিং-এর ১০% আপনার ব্যালেন্সে যোগ হয় —
          আলাদা ওয়ালেটে যায় না। টাকা প্রতি সেকেন্ডে জমা হয়, তাই সময়ের সাথে অঙ্ক বাড়তেই থাকে।
        </p>
      </div>
        </div>
      </details>

    </div>
  );
}

function SimpleStep({
  n,
  title,
  amount,
  tone,
  children,
}: {
  n: number;
  title: string;
  amount: string;
  tone: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <div className="flex items-center gap-2">
        <span className="mono-num w-6 h-6 rounded-full bg-cyan/15 text-cyan text-[11px] font-black flex items-center justify-center shrink-0">
          {n}
        </span>
        <p className="text-[12px] font-black text-navy flex-1 leading-tight">{title}</p>
        <p className={`mono-num text-[14px] font-black shrink-0 ${tone}`}>{amount}</p>
      </div>
      {children && <div className="mt-2 space-y-1 pl-8">{children}</div>}
    </div>
  );
}

function Line({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <p className={`text-[11px] font-bold leading-snug ${ok ? "text-navy" : "text-muted-foreground"}`}>
      {ok ? "✅" : "•"} {text}
    </p>
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

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-background/70 border border-border px-2 py-2 text-center">
      <p className="text-[9px] uppercase tracking-wider font-black text-muted-foreground">{label}</p>
      <p className={`mono-num text-[12.5px] font-black ${tone}`}>{value}</p>
    </div>
  );
}
