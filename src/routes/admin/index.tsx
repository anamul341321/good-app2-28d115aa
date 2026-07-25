import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminStats, adminListWithdrawals, adminListDebtClaims, adminResolveDebt } from "@/lib/admin.functions";
import { Loader2, Users, ArrowDownToLine, ScanFace, Clock, AlertTriangle, TrendingUp, Wallet, CheckCircle2, ShieldCheck, Smartphone, HandCoins, Copy, CheckCheck, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminStats(), refetchInterval: 15_000 });
  const { data: withdrawals } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals() });
  const claimsQ = useQuery({ queryKey: ["admin-debt-claims"], queryFn: () => adminListDebtClaims(), refetchInterval: 20_000 });

  const resolveClaim = useMutation({
    mutationFn: (debtId: string) => adminResolveDebt({ data: { debtId } }),
    onSuccess: () => { toast.success("Warning সরানো হয়েছে"); claimsQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !stats) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  }

  const pending = (withdrawals ?? []).filter((w: any) => w.status === "pending").slice(0, 3);
  const claims = claimsQ.data ?? [];


  return (
    <div className="space-y-4">
      {/* Money panel */}
      <div className="grid grid-cols-2 gap-3">
        <BigStat label="মোট মাইনিং জমা" value={stats.mining.totalAccrued.toFixed(2)} unit="TK" accent="cyan" icon={<TrendingUp className="w-4 h-4" />} />
        <BigStat label="মোট Paid Out" value={stats.mining.totalWithdrawn.toFixed(2)} unit="TK" accent="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
      </div>
      <p className="text-[10px] text-muted-foreground -mt-2 px-1">
        💡 <b>মোট মাইনিং জমা</b> = সব user-এর mining accrued_amount-এর যোগফল (bonus + mining earning মিলিয়ে যা তাদের ব্যালেন্সে জমা হয়েছে, withdraw করার আগে)।
      </p>

      {/* Paid report link */}
      <Link to="/admin/paid-report" className="block glass rounded-2xl p-4 border border-emerald/40 hover:border-emerald transition">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-emerald font-bold flex items-center gap-1"><FileText className="w-3 h-3"/> মোট পেমেন্ট রিপোর্ট</p>
            <p className="text-xs text-muted-foreground mt-1">কোন user কে কত টাকা দেওয়া হয়েছে — Print / Download</p>
          </div>
          <FileText className="w-8 h-8 text-emerald/50" />
        </div>
      </Link>

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

      {/* Debt repayment claims — user says "I paid back" */}
      {claims.length > 0 && (
        <div className="glass rounded-2xl p-3 border-2 border-amber/50 bg-amber/5 space-y-2">
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-amber" />
            <p className="text-[11px] uppercase tracking-widest text-amber font-black">টাকা ফেরতের দাবি ({claims.length})</p>
          </div>
          <p className="text-[10px] text-muted-foreground">User দাবি করেছে টাকা ফেরত দিয়েছে — যাচাই করে Approve করুন।</p>
          <div className="space-y-2">
            {claims.map((d: any) => (
              <div key={d.id} className="rounded-xl bg-background/60 border border-amber/40 p-2.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link to="/admin/user/$userId" params={{ userId: d.user_id }} className="text-[11px] font-black hover:text-cyan truncate block">
                      {d.profile?.display_name ?? "User"}
                      {d.profile?.uid_seq != null && <span className="mono-num text-muted-foreground ml-1">#{d.profile.uid_seq}</span>}
                    </Link>
                    {d.profile?.phone_number && <p className="text-[10px] text-muted-foreground mono-num">{d.profile.phone_number}</p>}
                  </div>
                  <p className="mono-num font-black text-rose text-sm">−{Number(d.amount).toFixed(0)}৳</p>
                </div>
                {d.claim_from_number && (
                  <div className="flex items-center gap-1.5 text-[10px] bg-amber/10 rounded px-2 py-1">
                    <span className="text-muted-foreground">ফেরত এসেছে:</span>
                    <button onClick={() => { navigator.clipboard.writeText(d.claim_from_number); toast.success("কপি হয়েছে"); }}
                      className="mono-num font-black text-navy inline-flex items-center gap-1">
                      {d.claim_from_number} <Copy className="w-2.5 h-2.5" />
                    </button>
                  </div>
                )}
                {d.claim_note && <p className="text-[10px] italic text-muted-foreground">"{d.claim_note}"</p>}
                {d.claimed_at && <p className="text-[9px] text-muted-foreground">দাবি: {new Date(d.claimed_at).toLocaleString()}</p>}
                <button
                  disabled={resolveClaim.isPending}
                  onClick={() => { if (confirm(`${Number(d.amount).toFixed(0)}৳ সত্যিই পেয়েছেন? Approve করলে warning সরে যাবে।`)) resolveClaim.mutate(d.id); }}
                  className="w-full py-1.5 rounded-lg bg-emerald text-white font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50">
                  <CheckCheck className="w-3.5 h-3.5" /> Approve — টাকা পেয়েছি
                </button>
              </div>
            ))}
          </div>
        </div>
      )}



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
