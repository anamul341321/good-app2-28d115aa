import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListUsers, adminমুছুনUser, adminReferrerLeaderboard } from "@/lib/admin.functions";
import { Loader2, ChevronRight, Trash2, Trophy, Users as UsersIcon, Share2, Crown } from "lucide-react";
import { computeLiveBalance } from "@/lib/mining";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
  const { data: refLeaders } = useQuery({ queryKey: ["admin-ref-leaderboard"], queryFn: () => adminReferrerLeaderboard() });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"verifiers" | "referrers" | "all">("verifiers");
  const del = useMutation({
    mutationFn: (userId: string) => adminমুছুনUser({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  const rows = (data ?? []).filter((r: any) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.profile.display_name ?? "").toLowerCase().includes(s)
      || (r.profile.phone_number ?? "").toLowerCase().includes(s)
      || (r.profile.email ?? "").toLowerCase().includes(s);
  });

  const verifiedRows = rows
    .filter((r: any) => (r.faceTotal ?? 0) > 0)
    .sort((a: any, b: any) => (b.faceTotal ?? 0) - (a.faceTotal ?? 0));
  const notVerifiedRows = rows.filter((r: any) => (r.faceTotal ?? 0) === 0);
  const completedRows = verifiedRows.filter((r: any) => (r.faceTotal ?? 0) >= 10);

  const renderCard = (row: any, serial?: number) => {
    const m = row.mining;
    const bal = m ? computeLiveBalance({
      accrued: Number(m.accrued_amount), withdrawn: Number(m.withdrawn_amount),
      isActive: m.is_active, lastCreditedAt: m.last_credited_at,
    }) : 0;
    const total = row.faceTotal ?? (row.done + row.verified);
    const slotFaces = row.slotFaces ?? (row.done + row.verified);
    const backupFaces = row.attemptFaces ?? 0;
    return (
      <div key={row.profile.id} className="glass rounded-xl p-3 space-y-2">
        <Link to="/admin/user/$userId" params={{ userId: row.profile.id }} className="flex items-start justify-between gap-2">
          {serial !== undefined && (
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
              serial === 1 ? "bg-amber text-background" :
              serial === 2 ? "bg-cyan/80 text-background" :
              serial === 3 ? "bg-emerald/80 text-background" :
              "bg-surface-2 text-muted-foreground"
            }`}>
              {serial <= 3 ? ["🥇","🥈","🥉"][serial-1] : `#${serial}`}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{row.profile.display_name ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground truncate mono-num">
              {row.profile.phone_number ?? row.profile.email}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="mono-num font-black text-cyan text-sm">{bal.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground">TK</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
        </Link>
        <div className="flex flex-wrap gap-1 text-[10px]">
          {total > 0 && <span className="px-2 py-0.5 rounded-full bg-violet/15 text-violet font-black mono-num">মোট {total} face</span>}
          <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-bold mono-num">slot {slotFaces}</span>
          {backupFaces > 0 && <span className="px-2 py-0.5 rounded-full bg-rose/15 text-rose font-bold mono-num">backup {backupFaces}</span>}
          {row.done > 0 && <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-bold">{row.done} done</span>}
          {row.verified > 0 && <span className="px-2 py-0.5 rounded-full bg-amber/15 text-amber font-bold">{row.verified} pending re-verify</span>}
          {m?.is_active && <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-bold">MINING</span>}
          {row.wallet && <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground mono-num">{row.wallet.provider}:{row.wallet.number}</span>}
        </div>
        <button
          onClick={() => { if (confirm("মুছুন this user FOREVER? Wallets, tasks, faces, withdrawals — all gone.")) del.mutate(row.profile.id); }}
          className="text-[10px] text-rose flex items-center gap-1 hover:underline">
          <Trash2 className="w-3 h-3" /> মুছুন user
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 🏆 Top Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile tone="emerald" icon={<Trophy className="w-4 h-4" />} label="Face users" value={verifiedRows.length} />
        <SummaryTile tone="amber" icon={<Crown className="w-4 h-4" />} label="10+ face" value={completedRows.length} />
        <SummaryTile tone="violet" icon={<UsersIcon className="w-4 h-4" />} label="Total" value={rows.length} />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-surface-2 border border-border">
        <TabBtn active={tab === "verifiers"} onClick={() => setTab("verifiers")} icon={<Trophy className="w-3.5 h-3.5" />} label="Top Verifiers" />
        <TabBtn active={tab === "referrers"} onClick={() => setTab("referrers")} icon={<Share2 className="w-3.5 h-3.5" />} label="Referrers" />
        <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon={<UsersIcon className="w-3.5 h-3.5" />} label="All Users" />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name / phone / email"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan"
      />

      {tab === "verifiers" && (
        <>
          {/* 🥇 Prominent leaderboard */}
          <div className="rounded-2xl p-3 border-2 border-amber/40 bg-linear-to-br from-amber/10 via-transparent to-emerald/5">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] uppercase tracking-widest font-black text-amber flex items-center gap-1.5">
                🏆 GoodDollar Face Leaderboard
              </p>
              <span className="mono-num text-[10px] font-black text-amber bg-amber/15 px-2 py-0.5 rounded-full">
                {verifiedRows.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground px-1 mb-3">
              GoodDollar face verification/backup count অনুযায়ী serial — user এ click করলে slot, face, referral, voucher সব control করা যাবে।
            </p>
            {verifiedRows.length === 0 && (
              <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">
                এখনো কেউ verify করেনি।
              </div>
            )}
            <div className="space-y-2">
              {verifiedRows.map((r, i) => renderCard(r, i + 1))}
            </div>
          </div>
        </>
      )}

      {tab === "referrers" && (
        <ReferrerLeaderboard rows={refLeaders ?? []} q={q} />
      )}

      {tab === "all" && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-widest text-emerald font-black">
                ✅ GoodDollar face আছে
              </p>
              <span className="mono-num text-[10px] font-black text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
                {verifiedRows.length}
              </span>
            </div>
            {verifiedRows.map((r, i) => renderCard(r, i + 1))}
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                ⚠️ GoodDollar face নেই
              </p>
              <span className="mono-num text-[10px] font-black text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full">
                {notVerifiedRows.length}
              </span>
            </div>
            {notVerifiedRows.map((r) => renderCard(r))}
          </div>
        </>
      )}

      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 text-center">
        মোট {rows.length} / {data?.length ?? 0}
      </p>
    </div>
  );
}

function SummaryTile({ tone, icon, label, value }: { tone: "emerald" | "amber" | "violet"; icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={`glass rounded-xl p-2.5 text-center border border-${tone}/20`}>
      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-${tone}/15 text-${tone} mb-1`}>
        {icon}
      </div>
      <p className={`mono-num font-black text-lg text-${tone}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition ${
        active ? "bg-linear-to-r from-cyan to-violet text-white shadow" : "text-muted-foreground hover:text-navy"
      }`}
    >
      {icon} <span className="truncate">{label}</span>
    </button>
  );
}

function ReferrerLeaderboard({ rows, q }: { rows: any[]; q: string }) {
  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.name ?? "").toLowerCase().includes(s)
      || (r.phone ?? "").toLowerCase().includes(s)
      || (r.referralCode ?? "").toLowerCase().includes(s);
  });
  return (
    <div className="rounded-2xl p-3 border-2 border-violet/40 bg-linear-to-br from-violet/10 via-transparent to-cyan/5">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] uppercase tracking-widest font-black text-violet flex items-center gap-1.5">
          🔗 Referrer Leaderboard
        </p>
        <span className="mono-num text-[10px] font-black text-violet bg-violet/15 px-2 py-0.5 rounded-full">
          {filtered.length}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground px-1 mb-3">
        কার reffer থেকে মোট কত account এসেছে এবং ওই referred account গুলো মোট কত GoodDollar face verification/backup করেছে।
      </p>
      {filtered.length === 0 && (
        <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">
          কোনো referrer এখনো নেই।
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((r, i) => (
          <Link
            key={r.userId}
            to="/admin/user/$userId"
            params={{ userId: r.userId }}
            className="glass rounded-xl p-3 flex items-center gap-3 hover:border-violet/40 transition"
          >
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-xs ${
              i === 0 ? "bg-amber text-background" :
              i === 1 ? "bg-cyan/80 text-background" :
              i === 2 ? "bg-emerald/80 text-background" :
              "bg-surface-2 text-muted-foreground"
            }`}>
              {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i+1}`}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground truncate mono-num">
                {r.phone} {r.referralCode && <span className="ml-1 text-violet">· {r.referralCode}</span>}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black text-[10px] mono-num">
                  {r.refereeCount} account
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-black text-[10px] mono-num">
                  {r.verifiedReferees} verified
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet/15 text-violet font-black text-[10px] mono-num">
                  {r.totalVerifies} face
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
