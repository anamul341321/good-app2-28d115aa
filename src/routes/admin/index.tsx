import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminStats, adminMoneyStats, adminListWithdrawals, adminListDebtClaims, adminResolveDebt } from "@/lib/admin.functions";
import { adminChangePassword } from "@/lib/admin-auth.functions";
import { Loader2, Users, ArrowDownToLine, ScanFace, Clock, AlertTriangle, TrendingUp, Wallet, CheckCircle2, ShieldCheck, Smartphone, HandCoins, Copy, CheckCheck, FileText, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { WhitelistMonitor } from "@/components/WhitelistMonitor";


export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

function AdminDashboard() {
  const { data: stats, isError, refetch } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminStats(),
    staleTime: 120_000,
  });
  const { data: money } = useQuery({ queryKey: ["admin-money-stats"], queryFn: () => adminMoneyStats(), staleTime: 120_000 });
  const { data: withdrawals } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals(), staleTime: 120_000 });
  const claimsQ = useQuery({ queryKey: ["admin-debt-claims"], queryFn: () => adminListDebtClaims(), staleTime: 120_000 });

  const resolveClaim = useMutation({
    mutationFn: (debtId: string) => adminResolveDebt({ data: { debtId } }),
    onSuccess: () => { toast.success("Warning সরানো হয়েছে"); claimsQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isError) {
    return (
      <div className="py-10 text-center space-y-3">
        <p className="text-xs font-bold text-rose">ড্যাশবোর্ড লোড হয়নি</p>
        <button className="gradient-cta rounded-xl px-4 py-2 text-xs font-black" onClick={() => refetch()}>
          আবার চেষ্টা করুন
        </button>
      </div>
    );
  }

  const pending = (withdrawals ?? []).filter((w: any) => w.status === "pending").slice(0, 3);
  const claims = claimsQ.data ?? [];


  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 border border-rose/30 bg-rose/5">
        <p className="text-xs font-black text-rose mb-1">⚠️ জরুরী তথ্য</p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          কোনো APK আপলোড করার পর বা কোনো আপডেট আসলে অবশ্যই <b>Bonus Settings</b> এ গিয়ে APK চেক করুন। বর্তমান Android Version <b>{stats?.appVersion ?? "…"}</b> (min: {stats?.minAppVersion ?? "…"}, force: {stats?.forceUpdateEnabled ? "ON" : "off"})।
        </p>
      </div>

      {/* আজকের হিসাব — first verify vs re-verify */}
      <div className="rounded-2xl p-4 border border-white/15 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 55%,#0f766e 100%)" }}>
        <p className="text-[10px] uppercase tracking-[0.25em] font-black text-white/70">আজকের হিসাব</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3 bg-white/10 border border-white/15">
            <p className="text-[10px] font-black text-cyan-200">📸 আজ First Verify</p>
            <p className="mono-num text-3xl font-black text-white leading-none mt-1">{stats?.todayFirstVerify ?? "…"}</p>
          </div>
          <div className="rounded-xl p-3 bg-white/10 border border-white/15">
            <p className="text-[10px] font-black text-amber-200">🔄 আজ Re-verify</p>
            <p className="mono-num text-3xl font-black text-white leading-none mt-1">{stats?.todayReverify ?? "…"}</p>
          </div>
        </div>
        {(stats as any)?.daily?.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-[10px] font-black text-white/60">গত ৭ দিনের হিসাব (প্রতিদিন)</p>
            {(stats as any).daily.map((d: any, i: number) => (
              <div key={d.date} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-white/8 border border-white/10">
                <span className="text-[11px] font-black text-white/85 mono-num">
                  {i === 0 ? "আজ" : i === 1 ? "গতকাল" : d.date}
                </span>
                <span className="text-[11px] font-black mono-num text-cyan-200">📸 {d.firstVerify}</span>
                <span className="text-[11px] font-black mono-num text-amber-200">🔄 {d.reverify}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <WhitelistMonitor />


      {/* Money panel */}

      <div className="grid grid-cols-2 gap-3">
        <BigStat label="মোট মাইনিং জমা" value={money ? money.totalAccrued.toFixed(2) : "…"} unit="TK" accent="cyan" icon={<TrendingUp className="w-4 h-4" />} />
        <BigStat label="মোট Paid Out" value={money ? money.totalPaid.toFixed(2) : "…"} unit="TK" accent="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
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
              {stats?.withdrawals?.pending ?? "—"}
              <span className="text-xs text-muted-foreground ml-2">request{stats?.withdrawals?.pending === 1 ? "" : "s"}</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <span className="mono-num text-amber">{money ? money.pendingAmount.toFixed(2) : "…"} TK</span> waiting
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
        <QuickCard to="/admin/users" icon={<Users className="w-5 h-5" />} value={stats?.users ?? "—"} label="Users" accent="cyan" />
        <QuickCard to="/admin/faces" icon={<ScanFace className="w-5 h-5" />} value={stats ? (stats.tasks.done + stats.tasks.verified) : "—"} label="সংরক্ষিত ফেস" accent="violet" />
        <QuickCard to="/admin/reverify" icon={<Clock className="w-5 h-5" />} value={stats?.tasks.verified ?? "—"} label="Re-verify queue" accent="amber" />
        <QuickCard to="/admin/unverified" icon={<AlertTriangle className="w-5 h-5" />} value={stats?.unverifiedCount ?? "—"} label="Not whitelisted" accent="rose" />
        <QuickCard to="/admin/wallets" icon={<Wallet className="w-5 h-5" />} value={stats?.wallets ?? "—"} label="Wallets bound" accent="emerald" />
        <QuickCard to="/admin/kyc" icon={<ShieldCheck className="w-5 h-5" />} value={(stats as any)?.kycVerified ?? 0} label="KYC verified" accent="violet" />
        <QuickCard to="/admin/recharges" icon={<Smartphone className="w-5 h-5" />} value={(stats as any)?.recharges ?? 0} label="Recharge history" accent="cyan" />
        <Link to="/admin/mining" className="glass rounded-2xl p-3 hover:border-cyan transition">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Mining now</p>
          <p className="mono-num font-black text-2xl text-cyan mt-1">{stats?.mining.activeUsers ?? "—"}</p>
          <p className="text-[10px] text-muted-foreground">active users · নাম দেখুন →</p>
        </Link>
      </div>

      {/* Task breakdown */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-3">Task breakdown</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Slice color="emerald" label="Done" v={stats?.tasks.done ?? "—"} />
          <Slice color="amber" label="Verified" v={stats?.tasks.verified ?? "—"} />
          <Slice color="cyan" label="Empty" v={stats?.tasks.empty ?? "—"} />
        </div>
      </div>

      <PasswordChangeCard />
    </div>
  );
}

function PasswordChangeCard() {
  const [cur, setCur] = useState("");
  const [nx, setNx] = useState("");
  const [nx2, setNx2] = useState("");
  const [open, setOpen] = useState(false);
  const mut = useMutation({
    mutationFn: (input: { current: string; next: string }) => adminChangePassword({ data: input }),
    onSuccess: (r: any) => {
      if (r.ok) {
        toast.success("Admin password change হয়েছে");
        setCur(""); setNx(""); setNx2(""); setOpen(false);
      } else {
        toast.error(r.error || "Current password bhul");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });
  const submit = () => {
    if (!cur || !nx) return toast.error("Sob field puron korun");
    if (nx !== nx2) return toast.error("Notun password mile na");
    mut.mutate({ current: cur, next: nx });
  };
  return (
    <div className="glass rounded-2xl p-4">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 w-full text-left">
        <div className="w-8 h-8 rounded-lg bg-amber/15 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-amber" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-black">Admin password change</p>
          <p className="text-[10px] text-muted-foreground">Jekono password dewa jabe — kono restriction nei</p>
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs outline-none focus:border-amber" />
          <input type="password" value={nx} onChange={(e) => setNx(e.target.value)} placeholder="Notun password"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs outline-none focus:border-amber" />
          <input type="password" value={nx2} onChange={(e) => setNx2(e.target.value)} placeholder="Notun password abar din"
            className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-xs outline-none focus:border-amber" />
          <button onClick={submit} disabled={mut.isPending}
            className="w-full gradient-cta rounded-lg py-2 text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60">
            {mut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            Password change korun
          </button>
        </div>
      )}
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
