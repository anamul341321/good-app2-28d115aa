import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminListRecharges } from "@/lib/recharge.functions";
import { Loader2, Smartphone, CheckCircle2, XCircle, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/admin/recharges")({ component: AdminRecharges });

function AdminRecharges() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-recharges"], queryFn: () => adminListRecharges(), refetchInterval: 20_000 });
  const [filter, setFilter] = useState<"all" | "success" | "failed" | "pending">("all");

  const list = data ?? [];
  const totals = useMemo(() => {
    const t = { count: list.length, total: 0, success: 0, failed: 0, pending: 0, successAmt: 0 };
    for (const r of list) {
      t.total += Number(r.amount);
      if (r.status === "success") { t.success++; t.successAmt += Number(r.amount); }
      else if (r.status === "failed") t.failed++;
      else t.pending++;
    }
    return t;
  }, [list]);

  const filtered = filter === "all" ? list : list.filter((r: any) => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smartphone className="w-6 h-6 text-cyan" />
        <h1 className="text-2xl font-black">Recharge History</h1>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Total" v={totals.count} sub={`${totals.total.toFixed(0)}৳`} tone="cyan" />
        <Stat label="✅ Success" v={totals.success} sub={`${totals.successAmt.toFixed(0)}৳`} tone="emerald" />
        <Stat label="❌ Failed" v={totals.failed} tone="rose" />
        <Stat label="⏳ Pending" v={totals.pending} tone="amber" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["all", "success", "failed", "pending"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-black border ${filter === f ? "bg-cyan text-white border-cyan" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => (
            <div key={r.id} className="glass rounded-xl p-3">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${r.status === "success" ? "bg-emerald/15 text-emerald" : r.status === "failed" ? "bg-rose/15 text-rose" : "bg-amber/15 text-amber"}`}>
                  {r.status === "success" ? <CheckCircle2 className="w-4 h-4" /> : r.status === "failed" ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(r.mobile); toast.success("নম্বর কপি হয়েছে"); }}
                      className="font-black mono-num flex items-center gap-1">
                      {r.mobile} <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                    <span className="text-[10px] uppercase text-muted-foreground">{r.operator} · {r.connection_type}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {r.profiles?.display_name ?? "—"} · UID {r.profiles?.uid_seq ?? "—"} · {new Date(r.created_at).toLocaleString()}
                  </p>
                  {r.provider_ref && <p className="text-[10px] text-emerald mono-num">Trx: {r.provider_ref}</p>}
                  {r.error_message && <p className="text-[10px] text-rose truncate">{r.error_message}</p>}
                </div>
                <p className="mono-num font-black">{Math.floor(Number(r.amount))}৳</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">কিছু নেই</p>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, v, sub, tone }: { label: string; v: number; sub?: string; tone: string }) {
  return (
    <div className="glass rounded-xl p-2 text-center">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
      <p className={`mono-num font-black text-lg text-${tone}`}>{v}</p>
      {sub && <p className="text-[9px] text-muted-foreground mono-num">{sub}</p>}
    </div>
  );
}
