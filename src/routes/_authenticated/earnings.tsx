import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { claimMiningEarnings, getEarnings } from "@/lib/earnings.functions";
import { EarningsStatement } from "@/components/EarningsStatement";
import { EarningsBreakdown } from "@/components/EarningsBreakdown";
import { toast } from "sonner";
import { Loader2, Coins, Gift, Users, PieChart, HandCoins, History, FileText, ListOrdered } from "lucide-react";
import { isLiteBuild } from "@/lib/lite-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";

export const Route = createFileRoute("/_authenticated/earnings")({
  ssr: false,
  component: EarningsPage,
  head: () => ({
    meta: [
      { title: "আয়ের হিসাব — good-app মাইনিং ও রেফার কমিশন" },
      { name: "description", content: "কোথা থেকে কত টাকা এসেছে — মাইনিং, রেফার ১০% কমিশন, বোনাস ও উইথড্র সবকিছুর পূর্ণ হিসাব এক পেজে।" },
      { property: "og:title", content: "আয়ের হিসাব — good-app" },
      { property: "og:description", content: "মাইনিং ক্লেইম করুন এবং প্রতিটি টাকার উৎস দেখুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const tk = (n: number) => `${n.toFixed(2)}৳`;

function EarningsPage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="আয়ের হিসাব" />;
  const qc = useQueryClient();
  const [showSheet, setShowSheet] = useState(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["earnings"],
    queryFn: () => getEarnings(),
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  const claim = useMutation({
    mutationFn: () => claimMiningEarnings(),
    onSuccess: (res) => {
      toast.success(`✅ ${tk(res.amount)} ক্লেইম হয়েছে — নিজের ${tk(res.selfAmount)} + রেফার ${tk(res.referralAmount)}`);
      qc.invalidateQueries({ queryKey: ["earnings"] });
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম হয়নি"),
  });

  if (isLoading || !data) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }

  const t = data.totals;
  const c = data.claim;
  const sources = [
    { key: "self", label: "⛏️ নিজের স্লট মাইনিং", amount: t.selfMiningTotal, color: "text-cyan" },
    { key: "ref", label: "🎁 রেফার ১০% কমিশন", amount: t.referralTotal, color: "text-emerald" },
    { key: "bonus", label: "🎉 ভেরিফাই বোনাস", amount: t.bonusTotal, color: "text-amber" },
    { key: "voucher", label: "🎫 ভাউচার বোনাস", amount: t.voucherClaimed, color: "text-amber" },
    { key: "admin", label: "➕ অ্যাডমিন যোগ করেছে", amount: t.adminIn, color: "text-violet" },
    { key: "transfer", label: "📥 অন্য ইউজার পাঠিয়েছে", amount: t.transferInTotal, color: "text-violet" },
  ].filter((s) => s.amount > 0.004);
  const totalIn = sources.reduce((s, x) => s + x.amount, 0);
  const outs = [
    { label: "💸 উইথড্র হয়েছে", amount: data.rows.filter((r) => r.kind === "withdraw").reduce((s, r) => s + Math.abs(Math.min(0, r.amount)), 0) },
    { label: "⏳ উইথড্র অপেক্ষায় (হাতে যাবে)", amount: (t as any).pendingWithdrawals ?? 0 },
    { label: "📱 মোবাইল রিচার্জ", amount: data.rows.filter((r) => r.kind === "recharge").reduce((s, r) => s + Math.abs(Math.min(0, r.amount)), 0) },
    { label: "📤 অন্যকে পাঠিয়েছেন", amount: data.rows.filter((r) => r.kind === "transfer_out").reduce((s, r) => s + Math.abs(Math.min(0, r.amount)), 0) },
    { label: "➖ অ্যাডমিন কেটেছে", amount: data.rows.filter((r) => r.kind === "admin_out").reduce((s, r) => s + Math.abs(Math.min(0, r.amount)), 0) },
    { label: "⚠️ ভুল পেমেন্ট ফেরত বাকি", amount: t.debtActive },
    { label: "🧾 উইথড্র ফি (১০০৳-এর কম হলে ২০%, নাহলে ১০%)", amount: t.feeOrAdjustmentOut },
  ].filter((o) => o.amount > 0.004);
  const totalOut = outs.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-5 pt-2 pb-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl"
           style={{ background: "linear-gradient(130deg,#0f172a 0%,#0ea5e9 55%,#8b5cf6 100%)" }}>
        <div className="absolute -top-12 -right-10 w-40 h-40 rounded-full bg-white/15 blur-3xl" />
        <p className="text-[10px] uppercase tracking-[0.3em] font-black text-white/70">EARNINGS LEDGER</p>
        <h1 className="text-2xl font-black mt-1">আয়ের হিসাব 📜</h1>
        <p className="text-[12px] text-white/90 mt-1 leading-snug">
          কোথা থেকে কত টাকা এসেছে — সব পরিষ্কার হিসাব। মাইনিং প্রতি সেকেন্ডে জমা হয়, তাই <b>ক্লেইম</b> করলে সেটি তারিখসহ হিসাবের খাতায় লেখা হয়ে যায়।
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroBox label="এখন ব্যালেন্স" value={tk(t.balance)} />
          <HeroBox label="মোট মাইনিং" value={tk(t.miningTotal)} />
          <HeroBox label="ব্যালেন্স থেকে কাটা" value={tk(t.withdrawn)} />
        </div>
      </div>

      {/* Claim card */}
      <div className="premium-panel rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-emerald" />
          <p className="text-[10px] uppercase tracking-widest font-black text-emerald">মাইনিং ক্লেইম</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-cyan/10 border border-cyan/30 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">নিজের মাইনিং জমা</p>
            <p className="mono-num text-xl font-black text-cyan">{tk(c.pendingSelf)}</p>
          </div>
          <div className="rounded-2xl bg-emerald/10 border border-emerald/30 p-3">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">রেফার ১০% জমা</p>
            <p className="mono-num text-xl font-black text-emerald">{tk(c.pendingReferral)}</p>
          </div>
        </div>
        <button
          onClick={() => claim.mutate()}
          disabled={!c.canClaim || claim.isPending}
          className="w-full py-3.5 rounded-2xl gradient-emerald font-black text-sm text-white btn-press disabled:opacity-60"
        >
          {claim.isPending ? "ক্লেইম হচ্ছে…" : c.pending >= 0.5
            ? c.canClaim ? `💰 ${tk(c.pending)} ক্লেইম করুন` : "⏳ ৬ ঘণ্টা পর আবার ক্লেইম"
            : "এখনো ক্লেইমের মতো জমা হয়নি"}
        </button>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ℹ️ ক্লেইম করলে ব্যালেন্স কমে না — শুধু এতদিনের মাইনিং আয় তারিখসহ নিচের হিসাবে লেখা হয়। প্রতিদিন বা প্রতি মাসে যখন চান ক্লেইম করতে পারবেন (প্রতি ৬ ঘণ্টায় একবার)।
          {c.lastClaimAt && <> শেষ ক্লেইম: {new Date(c.lastClaimAt).toLocaleString("bn-BD")}।</>}
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface-2 p-3 text-center">
          <div><p className="text-[9px] text-muted-foreground">হাতে paid</p><p className="mono-num font-black text-emerald">{tk(t.paidWithdrawals)}</p></div>
          <div><p className="text-[9px] text-muted-foreground">ফি/সমন্বয়সহ কাটা</p><p className="mono-num font-black text-rose">{tk(t.withdrawn)}</p></div>
        </div>
      </div>

      {/* Source split */}
      <div className="premium-panel rounded-3xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-cyan" />
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">টাকা কোথা থেকে এসেছে</p>
        </div>
        {sources.length === 0 && <p className="text-[11px] text-muted-foreground">এখনো কোনো আয় হয়নি।</p>}
        {sources.map((s) => {
          const pct = totalIn > 0 ? Math.round((s.amount / totalIn) * 100) : 0;
          return (
            <div key={s.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="text-navy">{s.label}</span>
                <span className={`mono-num ${s.color}`}>{tk(s.amount)} · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full gradient-cta" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <MiniBox icon={<Coins className="w-3 h-3" />} label="মাইনিং" value={tk(t.selfMiningTotal)} />
          <MiniBox icon={<Users className="w-3 h-3" />} label="রেফার ১০%" value={tk(t.referralTotal)} />
          <MiniBox icon={<Gift className="w-3 h-3" />} label="বোনাস" value={tk(t.bonusTotal + t.voucherClaimed)} />
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          📌 রেফার কমিশন আলাদা কোনো ওয়ালেটে যায় না — এটি আপনার মাইনিং ব্যালেন্সের সাথেই যোগ হয়, তাই উপরে আলাদা করে দেখানো হচ্ছে কতটুকু রেফার থেকে এসেছে।
        </p>
      </div>

      {/* Step-by-step reconciliation */}
      {data.breakdown && (
        <div className="premium-panel rounded-3xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4 text-amber" />
            <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">ধাপে ধাপে হিসাব — কোন টাকা কিভাবে এলো</p>
          </div>
          <EarningsBreakdown
            data={data.breakdown as any}
            totals={{
              withdrawn: t.withdrawn,
              balance: t.balance,
              debtActive: t.debtActive,
              paidWithdrawals: t.paidWithdrawals,
              successfulRecharges: t.successfulRecharges,
              transfersOutTotal: t.transfersOutTotal,
              feeOrAdjustmentOut: t.feeOrAdjustmentOut,
            }}
          />

        </div>
      )}

      {/* Printable statement */}
      <div className="premium-panel rounded-3xl p-5 space-y-3 print:shadow-none">
        <div className="flex items-center gap-2 print:hidden">
          <FileText className="w-4 h-4 text-violet" />
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">আয়ের বিবরণী — প্রিন্ট / ডাউনলোড</p>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed print:hidden">
          🧾 নিচের বাটনে চাপ দিলে সাদা কাগজের মতো সুন্দর একটি বিবরণী তৈরি হবে — কোথা থেকে কত টাকা এসেছে, কোথায় গেছে, তারিখসহ সব। চাইলে ছবি হিসেবে ডাউনলোড করে যে কাউকে পাঠাতে পারবেন।
        </p>
        <button
          onClick={() => setShowSheet((v) => !v)}
          className="w-full py-3 rounded-2xl gradient-cta text-white font-black text-sm btn-press print:hidden"
        >
          {showSheet ? "বিবরণী বন্ধ করুন" : "📄 আমার আয়ের বিবরণী দেখুন"}
        </button>
        {showSheet && (
          <EarningsStatement
            data={{
              name: data.profile?.name ?? "ইউজার",
              uid: data.profile?.uid ?? null,
              phone: data.profile?.phone ?? null,
              balance: t.balance,
              totalIn,
              totalOut,
              debt: t.debtActive,
              sources: sources.map((s) => ({ key: s.key, label: s.label, amount: s.amount })),
              outs,
              rows: data.rows.map((r) => ({ id: r.id, label: r.label, note: r.note, amount: r.amount, created_at: r.created_at })),
              bonusSteps: (data.breakdown as any)?.bonus?.steps,
              bonusTotal: (data.breakdown as any)?.bonus?.total,
              miningSteps: (data.breakdown as any)?.mining?.steps,
              miningTotal: (data.breakdown as any)?.mining?.total,
            }}
            onClose={() => setShowSheet(false)}
          />
        )}
      </div>

      {/* Ledger */}
      <div className="premium-panel rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-violet" />
          <p className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">তারিখ অনুযায়ী পূর্ণ হিসাব</p>
        </div>
        {data.rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">এখনো কোনো লেনদেন নেই। মাইনিং ক্লেইম করলে এখানে দেখা যাবে।</p>
        ) : (
          <ul className="space-y-1.5 max-h-[520px] overflow-y-auto">
            {data.rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 rounded-xl bg-surface-2 px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] font-black text-navy">{r.label}</p>
                  {r.note && <p className="text-[9.5px] text-muted-foreground truncate">{r.note}</p>}
                  <p className="text-[9px] text-muted-foreground mono-num">{new Date(r.created_at).toLocaleString("bn-BD")}</p>
                </div>
                <p className={`mono-num font-black text-[12px] shrink-0 ${r.amount > 0 ? "text-emerald" : r.amount < 0 ? "text-rose" : "text-muted-foreground"}`}>
                  {r.amount > 0 ? "+" : ""}{tk(r.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-center">
        <Link to="/home" className="text-[11px] text-cyan font-bold underline">← হোমে ফিরুন</Link>
      </div>
    </div>
  );
}

function HeroBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 border border-white/25 backdrop-blur p-2.5 text-center">
      <p className="mono-num font-black text-base">{value}</p>
      <p className="text-[8.5px] font-bold uppercase tracking-wider opacity-90 mt-0.5">{label}</p>
    </div>
  );
}

function MiniBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-2 text-center">
      <p className="text-[8.5px] font-black uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">{icon}{label}</p>
      <p className="mono-num font-black text-[12px] text-navy mt-0.5">{value}</p>
    </div>
  );
}
