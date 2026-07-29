import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminCheck, adminLogout } from "@/lib/admin-auth.functions";
import { adminStats } from "@/lib/admin.functions";
import {
  Users, ArrowDownToLine, ScanFace, LogOut, Loader2, AlertTriangle,
  LayoutDashboard, Clock, Wallet, ShieldCheck, Gift,
} from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/admin")({
  ssr: false,
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(adminCheck);
  const logout = useServerFn(adminLogout);
  const [status, setStatus] = useState<"checking" | "unlocked" | "locked">("checking");

  useEffect(() => {
    let active = true;
    check().then((res) => {
      if (!active) return;
      setStatus(res.unlocked ? "unlocked" : "locked");
    }).catch(() => active && setStatus("locked"));
    return () => { active = false; };
  }, [check]);

  async function onLogout() {
    await logout();
    window.location.href = "/admin-login";
  }

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-amber" />
          <p className="text-sm font-bold">Admin panel check hocche...</p>
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-sm rounded-2xl p-6 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-amber" />
          <h1 className="text-lg font-black text-amber">Admin Locked</h1>
          <p className="mt-2 text-xs text-muted-foreground">Admin password diye unlock korte hobe.</p>
          <Link to="/admin-login" className="gradient-cta mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black">
            Admin login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2 pb-10">
      <PremiumHeader onLogout={onLogout} />
      <nav className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-none">
        <AdminTab to="/admin" icon={<LayoutDashboard className="w-3.5 h-3.5" />} label="Dashboard" exact />
        <AdminTab to="/admin/users" icon={<Users className="w-3.5 h-3.5" />} label="Users" />
        <AdminTab to="/admin/withdrawals" icon={<ArrowDownToLine className="w-3.5 h-3.5" />} label="Withdrawals" />
        <AdminTab to="/admin/faces" icon={<ScanFace className="w-3.5 h-3.5" />} label="Faces" />
        <AdminTab to="/admin/reverify" icon={<Clock className="w-3.5 h-3.5" />} label="Re-verify" />
        <AdminTab to="/admin/wallets" icon={<Wallet className="w-3.5 h-3.5" />} label="Wallets" />
        <AdminTab to="/admin/unverified" icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Not whitelisted" />
        <AdminTab to="/admin/bonus-settings" icon={<Gift className="w-3.5 h-3.5" />} label="Bonus" />
        <AdminTab to="/admin/announcements" icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Announcements" />
        <AdminTab to="/admin/telegram" icon={<Bot className="w-3.5 h-3.5" />} label="Telegram Bot" />
      </nav>
      <Outlet />
    </div>
  );
}

function PremiumHeader({ onLogout }: { onLogout: () => void }) {
  const { data } = useQuery({
    // Share the exact dashboard cache entry so the expensive aggregate is
    // requested once instead of twice when /admin opens.
    queryKey: ["admin-stats"],
    queryFn: () => adminStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="premium-panel relative overflow-hidden rounded-2xl p-4">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 pointer-events-none"
           style={{ background: "radial-gradient(circle, var(--color-amber) 0%, transparent 70%)" }} />
      <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full opacity-20 pointer-events-none"
           style={{ background: "radial-gradient(circle, var(--color-cyan) 0%, transparent 70%)" }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber/80 font-bold">Master control</p>
          <h1 className="font-black text-xl text-amber mt-0.5">Admin Panel</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">good-app · full control</p>
        </div>
        <button onClick={onLogout}
          className="px-3 py-1.5 rounded-lg bg-surface-2 text-muted-foreground text-[10px] font-bold flex items-center gap-1 border border-border hover:text-amber transition">
          <LogOut className="w-3 h-3" /> Lock
        </button>
      </div>
      <div className="relative mt-4 grid grid-cols-4 gap-2">
        <MiniStat label="Users" value={data?.users ?? "—"} accent="cyan" />
        <MiniStat label="Pending" value={(data as any)?.reverifyQueue ?? "—"} accent="amber" pulse={!!(data as any)?.reverifyQueue} />
        <MiniStat label="Done today" value={(data as any)?.todayVerified ?? "—"} accent="emerald" />
        <MiniStat label="Withdraw" value={data?.withdrawals?.pending ?? "—"} accent="violet" pulse={!!data?.withdrawals?.pending} />
      </div>

    </div>
  );
}

function MiniStat({ label, value, accent, pulse }: { label: string; value: any; accent: string; pulse?: boolean }) {
  return (
    <div className={`rounded-xl bg-background/60 border border-border p-2 text-center ${pulse ? "animate-pulse" : ""}`}>
      <p className={`mono-num font-black text-base text-${accent}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
    </div>
  );
}

function AdminTab({ to, icon, label, exact }: { to: string; icon: React.ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to as any}
      activeOptions={{ exact: !!exact }}
      activeProps={{ className: "gradient-cta text-background shadow-[0_4px_16px_-4px_rgba(34,211,238,0.5)]" }}
      inactiveProps={{ className: "bg-surface-2 text-muted-foreground border border-border" }}
      className="px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap transition"
    >
      {icon}
      {label}
    </Link>
  );
}
