import { TrendingUp, Wallet, ArrowDownRight, ArrowUpRight, PieChart } from "lucide-react";

const tk = (n: number) => `${n.toFixed(2)}৳`;

type Source = { key: string; label: string; amount: number; color: string };

/**
 * Admin-facing "ব্যালেন্স হিসাব" — plain-Bengali explanation of where a user's
 * money came from, where it went, and (per withdrawal) which source funded it.
 */
export function BalanceHistory({ mining, income, withdrawals, debts }: {
  mining: any; income: any; withdrawals: any[]; debts: any[];
}) {
  if (!income) return null;

  const accrued = Number(mining?.accrued_amount ?? 0);
  const bonusTotal = Number(mining?.bonus_amount ?? 0);
  const withdrawnTotal = Number(mining?.withdrawn_amount ?? 0);
  const t = income.totals ?? {};

  const voucher = Number(t.vouchersClaimed ?? 0);
  const adminPlus = Number(t.adminCreditsPositive ?? 0);
  const adminMinus = Math.abs(Number(t.adminCreditsNegative ?? 0));
  const transferIn = Number(t.transfersInTotal ?? 0);
  const transferOut = Number(t.transfersOutTotal ?? 0);
  const rechargeOut = Number(t.rechargesSuccess ?? 0);
  const withdrawPaid = Number(t.withdrawalsPaid ?? 0);
  const withdrawPending = (withdrawals ?? [])
    .filter((w) => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const debtActive = (debts ?? [])
    .filter((d) => d.status === "active").reduce((s, d) => s + Number(d.amount), 0);

  // Mining part of accrued = everything credited that wasn't a bonus/gift.
  const miningPart = Math.max(0, accrued - bonusTotal - transferIn);
  const bonusPart = Math.max(0, bonusTotal - voucher - adminPlus);

  const sources: Source[] = [
    { key: "mining", label: "⛏️ মাইনিং (স্লট থেকে)", amount: miningPart, color: "text-cyan" },
    { key: "bonus", label: "🎉 বোনাস (first/re-verify)", amount: bonusPart, color: "text-amber" },
    { key: "voucher", label: "🎁 ভাউচার (claim করা)", amount: voucher, color: "text-amber" },
    { key: "admin", label: "➕ অ্যাডমিন যোগ করেছে", amount: adminPlus, color: "text-emerald" },
    { key: "transfer", label: "📥 অন্য user পাঠিয়েছে", amount: transferIn, color: "text-violet" },
  ].filter((s) => s.amount > 0.004);

  const totalIn = sources.reduce((s, x) => s + x.amount, 0);
  const outs = [
    { label: "💸 Withdraw হয়েছে (paid)", amount: withdrawPaid },
    { label: "⏳ Withdraw pending", amount: withdrawPending },
    { label: "📱 মোবাইল রিচার্জ", amount: rechargeOut },
    { label: "📤 অন্যকে পাঠিয়েছে", amount: transferOut },
    { label: "➖ অ্যাডমিন কেটেছে", amount: adminMinus },
  ].filter((o) => o.amount > 0.004);
  const totalOut = outs.reduce((s, x) => s + x.amount, 0);
  const balance = accrued - withdrawnTotal - debtActive;

  /** Approximate funding mix of a withdrawal, using the user's overall income mix. */
  const mixText = (amount: number) => {
    if (totalIn <= 0) return "উৎস হিসাব করা যাচ্ছে না";
    return sources
      .map((s) => ({ ...s, part: (s.amount / totalIn) * amount, pct: Math.round((s.amount / totalIn) * 100) }))
      .filter((s) => s.pct >= 1)
      .map((s) => `${s.label.replace(/^[^\s]+\s/, "")} ${s.pct}% (${tk(s.part)})`)
      .join(" · ");
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-4 border border-cyan/30">
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-cyan" />
        <p className="text-[10px] uppercase tracking-widest text-cyan font-black">ব্যালেন্স হিসাব — টাকা কোথা থেকে এলো</p>
      </div>

      {/* Simple summary line */}
      <div className="grid grid-cols-3 gap-2">
        <Box label="মোট আয়" value={tk(totalIn)} color="text-emerald" icon={<ArrowDownRight className="w-3 h-3" />} />
        <Box label="মোট খরচ/তোলা" value={tk(totalOut)} color="text-rose" icon={<ArrowUpRight className="w-3 h-3" />} />
        <Box label="এখন ব্যালেন্স" value={tk(balance)} color={balance < 0 ? "text-rose" : "text-cyan"} icon={<Wallet className="w-3 h-3" />} />
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        সহজ কথায়: এই user মোট <b className="text-emerald">{tk(totalIn)}</b> আয় করেছে, তার মধ্যে <b className="text-rose">{tk(totalOut)}</b> তুলে/খরচ করে ফেলেছে
        {debtActive > 0 ? <> এবং <b className="text-rose">{tk(debtActive)}</b> warning/ঋণ বাকি আছে</> : null}, তাই এখন হাতে আছে <b className="text-cyan">{tk(balance)}</b>।
      </p>

      {/* Where money came from — with share bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <PieChart className="w-3 h-3 text-cyan" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">আয় কোথা থেকে এসেছে</p>
        </div>
        {sources.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">এখনো কোনো আয় হয়নি।</p>
        ) : sources.map((s) => {
          const pct = totalIn > 0 ? Math.round((s.amount / totalIn) * 100) : 0;
          return (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>{s.label}</span>
                <span className={`mono-num ${s.color}`}>{tk(s.amount)} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-cyan" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Where money went */}
      {outs.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">টাকা কোথায় গেছে</p>
          {outs.map((o) => (
            <div key={o.label} className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{o.label}</span>
              <span className="mono-num font-bold text-rose">-{tk(o.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Withdrawals with source explanation */}
      {(withdrawals ?? []).length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            প্রতিটি withdraw এর টাকা কোথা থেকে এসেছে
          </p>
          {withdrawals.map((w) => (
            <div key={w.id} className="bg-surface-2 rounded-lg px-2 py-1.5">
              <div className="flex items-center justify-between text-[11px] gap-2">
                <span className="mono-num font-black">{tk(Number(w.amount))}</span>
                <span className="text-[9px] text-muted-foreground">
                  {String(w.provider).toUpperCase()} · {new Date(w.created_at).toLocaleString()}
                </span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  w.status === "paid" ? "bg-emerald/15 text-emerald"
                  : w.status === "rejected" ? "bg-rose/15 text-rose" : "bg-amber/15 text-amber"}`}>
                  {String(w.status).toUpperCase()}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">
                উৎস (আনুমানিক): {mixText(Number(w.amount))}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Chronological ledger */}
      <div className="pt-2 border-t border-border space-y-1.5 max-h-96 overflow-y-auto">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">তারিখ অনুযায়ী পূর্ণ হিসাব</p>
        {(() => {
          const rows: any[] = [];
          for (const v of income.vouchers ?? []) rows.push({ id: `v${v.id}`, amt: v.status === "claimed" ? Number(v.amount) : 0, created_at: v.created_at, label: `🎁 ভাউচার · ${v.status === "claimed" ? "claim হয়েছে" : "pending"}`, note: v.reason });
          for (const c of income.adminCredits ?? []) rows.push({ id: `c${c.id}`, amt: Number(c.amount), created_at: c.created_at, label: Number(c.amount) >= 0 ? "➕ অ্যাডমিন balance দিয়েছে" : "➖ অ্যাডমিন balance কেটেছে", note: c.note });
          for (const r of income.recharges ?? []) rows.push({ id: `r${r.id}`, amt: r.status === "failed" ? 0 : -Number(r.amount), created_at: r.created_at, label: `📱 মোবাইল রিচার্জ · ${r.operator ?? ""} · ${r.status}`, note: r.mobile });
          for (const x of income.transfersIn ?? []) rows.push({ id: `i${x.id}`, amt: Number(x.amount), created_at: x.created_at, label: "📥 অন্য user পাঠিয়েছে", note: x.note });
          for (const x of income.transfersOut ?? []) rows.push({ id: `o${x.id}`, amt: -Number(x.amount), created_at: x.created_at, label: "📤 অন্যকে পাঠিয়েছে", note: x.note });
          for (const w of withdrawals ?? []) rows.push({ id: `w${w.id}`, amt: w.status === "paid" ? -Number(w.amount) : 0, created_at: w.created_at, label: `💸 Withdraw · ${w.status === "paid" ? "দেওয়া হয়েছে" : w.status === "rejected" ? "বাতিল" : "অপেক্ষায়"}`, note: `${String(w.provider).toUpperCase()} ${w.wallet_number ?? ""}` });
          for (const d of debts ?? []) rows.push({ id: `d${d.id}`, amt: d.status === "active" ? -Number(d.amount) : 0, created_at: d.created_at, label: `⚠️ Warning/ঋণ · ${d.status === "active" ? "বাকি" : "শোধ"}`, note: d.message });
          rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          if (rows.length === 0) return <p className="text-[11px] text-muted-foreground">শুধু মাইনিং থেকেই ব্যালেন্স এসেছে — আর কোনো লেনদেন নেই।</p>;
          return rows.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 bg-surface-2 rounded-lg px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold">{r.label}</p>
                {r.note && <p className="text-[9px] text-muted-foreground truncate">{r.note}</p>}
                <p className="text-[9px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <p className={`mono-num font-black text-[12px] shrink-0 ${r.amt > 0 ? "text-emerald" : r.amt < 0 ? "text-rose" : "text-muted-foreground"}`}>
                {r.amt > 0 ? "+" : ""}{r.amt === 0 ? "0.00৳" : tk(r.amt)}
              </p>
            </div>
          ));
        })()}
      </div>

      <p className="text-[9px] text-muted-foreground flex items-start gap-1">
        <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
        মাইনিং প্রতি সেকেন্ডে জমা হয়, তাই withdraw-এর উৎস শতকরা হিসাব আনুমানিক — মোট আয়ের অনুপাত থেকে বের করা।
      </p>
    </div>
  );
}

function Box({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-2">
      <p className="text-[9px] text-muted-foreground font-bold flex items-center gap-1">{icon}{label}</p>
      <p className={`mono-num font-black text-sm ${color}`}>{value}</p>
    </div>
  );
}
