import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { submitRecharge, getMyRecharges } from "@/lib/recharge.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { computeLiveBalance } from "@/lib/mining";
import { Loader2, Smartphone, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recharge")({ component: RechargePage });

const MIN_RECHARGE = 20;
const OPERATORS: Array<{ id: string; label: string; color: string }> = [
  { id: "grameenphone", label: "GP", color: "#00a99d" },
  { id: "robi", label: "Robi", color: "#e2136e" },
  { id: "banglalink", label: "Banglalink", color: "#f36f21" },
  { id: "airtel", label: "Airtel", color: "#e2101f" },
  { id: "teletalk", label: "Teletalk", color: "#008a4b" },
];

function RechargePage() {
  const { data: dash, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHist } = useQuery({ queryKey: ["my-recharges"], queryFn: () => getMyRecharges() });

  const [mobile, setMobile] = useState("");
  const [operator, setOperator] = useState<string>("");
  const [connType, setConnType] = useState<"prepaid" | "postpaid">("prepaid");
  const [amount, setAmount] = useState("");

  const kycOk = !!(dash?.profile as any)?.kyc_verified;
  const mining = dash?.mining;
  const debtTotal = Number((dash as any)?.debtTotal ?? 0);
  const balance = mining ? Math.floor(computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    debt: debtTotal,
  })) : 0;

  const mut = useMutation({
    mutationFn: () => submitRecharge({ data: {
      mobile: mobile.replace(/\D/g, ""),
      operator: operator as any,
      connection_type: connType,
      amount: Math.floor(Number(amount) || 0),
    } }),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`✅ রিচার্জ সফল! Trx: ${r.transaction_id ?? "—"}`);
      else toast.error(`❌ রিচার্জ ব্যর্থ: ${r.message}`);
      setMobile(""); setAmount(""); setOperator("");
      refetch(); refetchHist();
    },
    onError: (e: any) => toast.error(e.message ?? "রিচার্জ ব্যর্থ"),
  });

  if (!kycOk) {
    return (
      <div className="pt-6 text-center space-y-3">
        <ShieldCheck className="w-10 h-10 text-amber mx-auto" />
        <h1 className="text-xl font-black">KYC লাগবে</h1>
        <p className="text-sm text-muted-foreground">রিচার্জের জন্য KYC ভেরিফাই করুন।</p>
        <a href="/kyc" className="inline-block rounded-2xl px-5 py-3 gradient-cta font-black btn-press">KYC করুন</a>
      </div>
    );
  }

  const amt = Math.floor(Number(amount) || 0);
  const mob = mobile.replace(/\D/g, "");
  const canSubmit = /^0?1\d{9,10}$/.test(mob) && !!operator && amt >= MIN_RECHARGE && amt <= balance && !mut.isPending;

  return (
    <div className="space-y-4 pt-2">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-white shadow-lg">
          <Smartphone className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black mt-2">মোবাইল রিচার্জ</h1>
        <p className="text-[11px] text-muted-foreground">মিনিমাম {MIN_RECHARGE}৳ · মেইন ব্যালেন্স থেকে কাটবে</p>
      </div>

      <div className="rounded-2xl p-4 text-center text-white shadow-lg"
           style={{ background: "linear-gradient(135deg,#06b6d4,#10b981,#22c55e)" }}>
        <p className="text-[10px] uppercase tracking-widest opacity-90 font-black">উপলব্ধ ব্যালেন্স</p>
        <p className="mono-num text-4xl font-black mt-1 drop-shadow">{balance}<span className="text-xl">৳</span></p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">মোবাইল নম্বর</label>
          <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="01XXXXXXXXX"
            className="w-full mt-1 px-3 py-3 mono-num bg-surface-2 border border-border rounded-xl text-lg font-black outline-none focus:border-cyan-500" />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">অপারেটর</label>
          <div className="grid grid-cols-5 gap-1.5 mt-1">
            {OPERATORS.map((op) => (
              <button key={op.id} type="button" onClick={() => setOperator(op.id)}
                className={`rounded-xl py-2 text-[11px] font-black border-2 transition ${operator === op.id ? "text-white scale-105 shadow-lg" : "text-navy bg-surface-2 border-border"}`}
                style={operator === op.id ? { background: op.color, borderColor: op.color } : {}}>
                {op.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">কানেকশন</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button type="button" onClick={() => setConnType("prepaid")}
              className={`rounded-xl py-2 font-black text-sm border-2 ${connType === "prepaid" ? "bg-cyan-500 text-white border-cyan-500" : "bg-surface-2 border-border"}`}>Prepaid</button>
            <button type="button" onClick={() => setConnType("postpaid")}
              className={`rounded-xl py-2 font-black text-sm border-2 ${connType === "postpaid" ? "bg-cyan-500 text-white border-cyan-500" : "bg-surface-2 border-border"}`}>Postpaid</button>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">পরিমাণ (৳)</label>
          <input type="number" min={MIN_RECHARGE} value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder={`সর্বনিম্ন ${MIN_RECHARGE}৳`}
            className="w-full mt-1 px-3 py-3 mono-num bg-surface-2 border border-border rounded-xl text-lg font-black outline-none focus:border-cyan-500" />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[20, 50, 100, 200, 500].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className="rounded-lg px-3 py-1 text-[11px] font-black bg-cyan-500/10 text-cyan-600 border border-cyan-500/30 btn-press">{v}৳</button>
            ))}
          </div>
        </div>

        <button disabled={!canSubmit} onClick={() => mut.mutate()}
          className="w-full py-3.5 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 btn-press">
          {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Smartphone className="w-4 h-4" /> {amt >= MIN_RECHARGE ? `${amt}৳ রিচার্জ করুন` : "রিচার্জ করুন"}
        </button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2">ইতিহাস</p>
        {(history ?? []).length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">কোনো রিচার্জ ইতিহাস নেই</p>
        )}
        <div className="space-y-2">
          {(history ?? []).map((r: any) => (
            <div key={r.id} className="glass rounded-xl p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${r.status === "success" ? "bg-emerald/15 text-emerald" : r.status === "failed" ? "bg-rose/15 text-rose" : "bg-amber/15 text-amber"}`}>
                {r.status === "success" ? <CheckCircle2 className="w-4 h-4" /> : r.status === "failed" ? <XCircle className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm mono-num">{r.mobile} <span className="text-[10px] text-muted-foreground uppercase">{r.operator}</span></p>
                <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.connection_type}</p>
                {r.status === "failed" && r.error_message && <p className="text-[10px] text-rose mt-0.5 truncate">{r.error_message}</p>}
                {r.provider_ref && <p className="text-[10px] text-emerald mono-num">Trx: {r.provider_ref}</p>}
              </div>
              <p className="mono-num font-black text-navy">{Math.floor(Number(r.amount))}৳</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
