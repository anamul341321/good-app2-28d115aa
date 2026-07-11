import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListUsers, adminমুছুনUser } from "@/lib/admin.functions";
import { Loader2, ChevronRight, Trash2 } from "lucide-react";
import { computeLiveBalance } from "@/lib/mining";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-users"], queryFn: () => adminListUsers() });
  const [q, setQ] = useState("");
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

  const rows = (data ?? []).filter((r: any) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.profile.display_name ?? "").toLowerCase().includes(s)
      || (r.profile.phone_number ?? "").toLowerCase().includes(s)
      || (r.profile.email ?? "").toLowerCase().includes(s);
  });

  // Verified = kono ekta task at least done/verified korese.
  const verifiedRows = rows
    .filter((r: any) => (r.done + r.verified) > 0)
    .sort((a: any, b: any) => (b.done + b.verified) - (a.done + a.verified));
  const notVerifiedRows = rows.filter((r: any) => (r.done + r.verified) === 0);

  const renderCard = (row: any, serial?: number) => {
    const m = row.mining;
    const bal = m ? computeLiveBalance({
      accrued: Number(m.accrued_amount), withdrawn: Number(m.withdrawn_amount),
      isActive: m.is_active, lastCreditedAt: m.last_credited_at,
    }) : 0;
    const total = row.done + row.verified;
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
          {total > 0 && <span className="px-2 py-0.5 rounded-full bg-violet/15 text-violet font-black mono-num">মোট {total} verify</span>}
          <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-bold">{row.done}/10 done</span>
          {row.verified > 0 && <span className="px-2 py-0.5 rounded-full bg-amber/15 text-amber font-bold">{row.verified} re-verify</span>}
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
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name / phone / email"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan"
      />

      {/* ✅ Verified users — sorted by verify-count desc, ranked */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] uppercase tracking-widest text-emerald font-black flex items-center gap-1.5">
            ✅ Verified users — সবচেয়ে বেশি উপরে
          </p>
          <span className="mono-num text-[10px] font-black text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
            {verifiedRows.length}
          </span>
        </div>
        {verifiedRows.length === 0 && (
          <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">
            এখনো কেউ verify করেনি।
          </div>
        )}
        {verifiedRows.map((r, i) => renderCard(r, i + 1))}
      </div>

      {/* ⚠️ Not verified yet */}
      <div className="space-y-2 pt-2 border-t border-border">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
            ⚠️ এখনো verify করেনি
          </p>
          <span className="mono-num text-[10px] font-black text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full">
            {notVerifiedRows.length}
          </span>
        </div>
        {notVerifiedRows.map((r) => renderCard(r))}
      </div>

      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 text-center">
        মোট {rows.length} / {data?.length ?? 0}
      </p>
    </div>
  );
}
