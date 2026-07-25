import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminStats, adminListWithdrawals } from "@/lib/admin.functions";
import { Loader2, Users, ArrowDownToLine, ScanFace, Clock, AlertTriangle, TrendingUp, Wallet, CheckCircle2, ShieldCheck, Smartphone } from "lucide-react";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats(), refetchInterval: 15_000 });
  const { data: withdrawals } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals() });

  if (isLoading || !stats) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  }

  const pending = (withdrawals ?? []).filter((w: any) => w.status === "pending").slice(0, 3);

  return (
    <div className="space-y-4">
      {/* Money panel */}
      <div className="grid grid-cols-2 gap-3">
        <BigStat label="Total Accrued" value={stats.mining.totalAccrued.toFixed(2)} unit="TK" accent="cyan" icon={<TrendingUp className="w-4 h-4" />} />
        <BigStat label="Total Paid Out" value={stats.mining.totalWithdrawn.toFixed(2)} unit="TK" accent="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
      </div>

      {/* Pending row */}
      <Link to="/admin/withdrawals" className="block glass rounded-2xl p-4 border border-amber/40 hover:border-amber transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-amber font-bold">Pending withdrawals</p>
            <p className="mono-num font-black text-2xl mt-0.5">
              {stats.withdrawals.pending}
              <span className="text-xs text-muted-foreground ml-2">request{stats.withdrawals.pending === 1 ? "" : "s"}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <span className="mono-num text-amber">{stats.withdrawals.pendingAmount.toFixed(2)} TK</span> waiting
            </p>
          </div>
          <ArrowDownToLine className="w-8 h-8 text-amber/50" />
        </div>
        {pending.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-amber/20 pt-3">
            {pending.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground truncate">{w.profiles?.display_name ?? w.profiles?.phone_number ?? "—"}</span>
                <span className="mono-num font-black text-amber">{Number(w.amount).toFixed(0)} TK</span>
              </div>
            ))}
          </div>
        )}
      </Link>

      {/* Mini quick links grid */}
      <div className="grid grid-cols-2 gap-3">
        <QuickCard to="/admin/users" icon={<Users className="w-5 h-5" />} value={stats.users} label="Users" accent="cyan" />
        <QuickCard to="/admin/faces" icon={<ScanFace className="w-5 h-5" />} value={stats.tasks.done + stats.tasks.verified} label="সংরক্ষিত ফেস" accent="violet" />
        <QuickCard to="/admin/reverify" icon={<Clock className="w-5 h-5" />} value={stats.tasks.verified} label="Re-verify queue" accent="amber" />
        <QuickCard to="/admin/unverified" icon={<AlertTriangle className="w-5 h-5" />} value={stats.unverifiedCount} label="Not whitelisted" accent="rose" />
        <QuickCard to="/admin/wallets" icon={<Wallet className="w-5 h-5" />} value={stats.wallets} label="Wallets bound" accent="emerald" />
        <QuickCard to="/admin/kyc" icon={<ShieldCheck className="w-5 h-5" />} value={(stats as any).kycVerified ?? 0} label="KYC verified" accent="violet" />
        <QuickCard to="/admin/recharges" icon={<Smartphone className="w-5 h-5" />} value={(stats as any).recharges ?? 0} label="Recharge history" accent="cyan" />
        <div className="glass rounded-2xl p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Mining now</p>
          <p className="mono-num font-black text-2xl text-cyan mt-1">{stats.mining.activeUsers}</p>
          <p className="text-[10px] text-muted-foreground">active users</p>
        </div>
      </div>

      {/* Task breakdown */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Task breakdown</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Slice color="emerald" label="Done" v={stats.tasks.done} />
          <Slice color="amber" label="Verified" v={stats.tasks.verified} />
          <Slice color="cyan" label="Empty" v={stats.tasks.empty} />
        </div>
      </div>
    </div>
  );
}

function cv(accent: string) {
  return { color: `var(--color-${accent})` } as React.CSSProperties;
}
function bv(accent: string, pct: number) {
  return { background: `color-mix(in oklch, var(--color-${accent}) ${pct}%, transparent)` } as React.CSSProperties;
}
function brv(accent: string, pct: number) {
  return { borderColor: `color-mix(in oklch, var(--color-${accent}) ${pct}%, transparent)` } as React.CSSProperties;
}

function BigStat({ label, value, unit, accent, icon }: any) {
  return (
    <div className="glass rounded-2xl p-3 border-l-2" style={brv(accent, 80)}>
      <div className="flex items-center gap-1" style={cv(accent)}>
        {icon}
        <p className="text-[9px] uppercase tracking-widest font-bold">{label}</p>
      </div>
      <p className="mono-num font-black text-xl mt-1" style={cv(accent)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{unit}</p>
    </div>
  );
}

function QuickCard({ to, icon, value, label, accent }: any) {
  return (
    <Link to={to} className="glass rounded-2xl p-3 transition hover:scale-[1.02]">
      <div className="mb-1" style={cv(accent)}>{icon}</div>
      <p className="mono-num font-black text-xl" style={cv(accent)}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </Link>
  );
}

function Slice({ color, label, v }: any) {
  return (
    <div className="rounded-xl py-2 border" style={{ ...bv(color, 10), ...brv(color, 25) }}>
      <p className="mono-num font-black text-lg" style={cv(color)}>{v}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider" style={cv(color)}>{label}</p>
    </div>
  );
}
