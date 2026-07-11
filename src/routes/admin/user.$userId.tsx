import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminUserDetail, adminAdjustBalance, adminToggleMining, adminResetTask, adminমুছুনUser, adminResetUserPassword, adminClearMiningOverride, adminCreateVoucher, adminListVouchersForUser } from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Power, Plus, Minus, RefreshCw, Trash2, Copy, KeyRound, Gift } from "lucide-react";
import { computeLiveBalance } from "@/lib/mining";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/user/$userId")({ component: UserDetail });

function UserDetail() {

  const { userId } = Route.useParams();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => adminUserDetail({ data: { userId } }),
  });

  const [delta, setDelta] = useState("");
  const [newPass, setNewPass] = useState("");
  const [voucherAmt, setVoucherAmt] = useState("");
  const [voucherReason, setVoucherReason] = useState("");

  const vouchersQ = useQuery({
    queryKey: ["admin-user-vouchers", userId],
    queryFn: () => adminListVouchersForUser({ data: { userId } }),
  });

  const sendVoucher = useMutation({
    mutationFn: () => adminCreateVoucher({ data: {
      userId, amount: Number(voucherAmt), reason: voucherReason.trim(),
    }}),
    onSuccess: () => {
      toast.success(`🎁 ${voucherAmt}৳ ভাউচার পাঠানো হয়েছে`);
      setVoucherAmt(""); setVoucherReason("");
      vouchersQ.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });


  const resetPass = useMutation({
    mutationFn: (pwd: string) => adminResetUserPassword({ data: { userId, newPassword: pwd } }),
    onSuccess: () => { toast.success("পাসওয়ার্ড রিসেট হয়েছে"); setNewPass(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: (d: number) => adminAdjustBalance({ data: { userId, delta: d } }),
    onSuccess: (r) => { toast.success(`New balance: ${r.new_balance.toFixed(2)} TK`); setDelta(""); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) => adminToggleMining({ data: { userId, active } }),
    onSuccess: () => { toast.success("Mining override সেট হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const clearOverride = useMutation({
    mutationFn: () => adminClearMiningOverride({ data: { userId } }),
    onSuccess: () => { toast.success("Auto rule চালু হয়েছে (10/10 + whitelist)"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });


  const reset = useMutation({
    mutationFn: (taskId: string) => adminResetTask({ data: { taskId } }),
    onSuccess: () => { toast.success("Slot reset"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => adminমুছুনUser({ data: { userId } }),
    onSuccess: () => { toast.success("মুছুনd"); window.location.href = "/admin/users"; },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  if (!data.profile) return <div className="text-center py-10 text-muted-foreground text-sm">User not found</div>;

  const p = data.profile;
  const m = data.mining;
  const liveBal = m ? computeLiveBalance({
    accrued: Number(m.accrued_amount), withdrawn: Number(m.withdrawn_amount),
    isActive: m.is_active, lastCreditedAt: m.last_credited_at,
    effectiveTaskCount: Number(m.effective_task_count ?? 0), qualifyingReferees: Number(m.qualifying_referees ?? 0),
  }) : 0;
  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copy হয়েছে"); };

  return (
    <div className="space-y-3">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-cyan">
        <ArrowLeft className="w-3 h-3" /> All users
      </Link>

      {/* Profile */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">User</p>
        <h2 className="text-lg font-black mt-1">{p.display_name ?? "—"}</h2>
        <p className="text-[11px] text-muted-foreground mono-num">{p.phone_number ?? p.email}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Joined: {new Date(p.created_at).toLocaleString()}</p>
      </div>

      {/* Mining control */}
      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-cyan font-bold">Live balance</p>
            <p className="mono-num font-black text-2xl text-cyan mt-1">{liveBal.toFixed(4)} <span className="text-sm">TK</span></p>
            <p className="text-[10px] text-muted-foreground">Accrued: {Number(m?.accrued_amount ?? 0).toFixed(4)} · Withdrawn: {Number(m?.withdrawn_amount ?? 0).toFixed(2)}</p>
          </div>
          <button onClick={() => toggle.mutate(!m?.is_active)}
            className={`p-3 rounded-xl flex flex-col items-center gap-0.5 ${m?.is_active ? "bg-cyan/20 text-cyan" : "bg-surface-2 text-muted-foreground"}`}>
            <Power className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase">{m?.is_active ? "ON" : "OFF"}</span>
          </button>
        </div>
        {(m as any)?.admin_forced_active && (
          <div className="flex items-center justify-between rounded-lg bg-amber/10 border border-amber/30 px-3 py-2">
            <p className="text-[10px] text-amber font-bold">⚠ Admin force ON — auto rule bypass হচ্ছে</p>
            <button
              disabled={clearOverride.isPending}
              onClick={() => clearOverride.mutate()}
              className="text-[10px] px-2 py-1 rounded bg-amber/20 text-amber font-black disabled:opacity-50"
            >
              Clear override
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)}
            placeholder="Amount (TK)"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-cyan"
          />
          <button onClick={() => adjust.mutate(Number(delta))} disabled={!delta}
            className="px-3 py-2 rounded-xl bg-emerald/20 text-emerald font-bold text-xs flex items-center gap-1 disabled:opacity-50">
            <Plus className="w-3 h-3" /> Add
          </button>
          <button onClick={() => adjust.mutate(-Number(delta))} disabled={!delta}
            className="px-3 py-2 rounded-xl bg-rose/20 text-rose font-bold text-xs flex items-center gap-1 disabled:opacity-50">
            <Minus className="w-3 h-3" /> Sub
          </button>
        </div>
      </div>

      {/* Wallet */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Wallet</p>
        {data.wallet ? (
          <p className="mono-num font-bold mt-1">{data.wallet.provider.toUpperCase()} · {data.wallet.number}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground mt-1">Not set</p>
        )}
      </div>

      {/* Password reset */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-violet" />
          <p className="text-[10px] uppercase tracking-widest text-violet font-bold">পাসওয়ার্ড রিসেট</p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          ইউজার পাসওয়ার্ড ভুলে গেলে এখানে নতুন পাসওয়ার্ড সেট করে দিন। ইউজারকে জানিয়ে দিন।
        </p>
        <div className="flex gap-2">
          <input
            type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড (min 6)"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-violet"
          />
          <button
            onClick={() => {
              if (newPass.length < 6) return toast.error("কমপক্ষে ৬ অক্ষর দিন");
              if (!confirm(`পাসওয়ার্ড রিসেট করবেন?\nনতুন: ${newPass}`)) return;
              resetPass.mutate(newPass);
            }}
            disabled={resetPass.isPending}
            className="px-3 py-2 rounded-xl bg-violet/20 text-violet font-bold text-xs flex items-center gap-1 disabled:opacity-50"
          >
            {resetPass.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
            রিসেট
          </button>
        </div>
      </div>

      {/* Tasks */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Tasks (10 slots)</p>
        <div className="space-y-2">
          {data.tasks.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 bg-surface-2 rounded-xl p-2">
              {t.signed_url ? (
                <img src={t.signed_url} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-background shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">#{t.slot}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold">Slot #{t.slot} · <span className={
                  t.status === "done" ? "text-emerald" : t.status === "verified" ? "text-amber" : "text-muted-foreground"
                }>{t.status}</span></p>
                {t.face_label && <p className="text-[10px] text-amber truncate">{t.face_label}</p>}
                {t.wallet_address && (
                  <button onClick={() => copy(t.wallet_address)} className="flex items-center gap-1 text-[9px] text-cyan mono-num truncate w-full">
                    <span className="truncate">{t.wallet_address}</span><Copy className="w-2.5 h-2.5 shrink-0" />
                  </button>
                )}
              </div>
              {(t.status !== "empty") && (
                <button onClick={() => { if (confirm(`Reset slot #${t.slot}? Face + key deleted.`)) reset.mutate(t.id); }}
                  className="p-1.5 rounded-lg bg-rose/15 text-rose">
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Withdrawals */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Withdrawal history ({data.withdrawals.length})</p>
        {data.withdrawals.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">None</p>
        ) : (
          <div className="space-y-1.5">
            {data.withdrawals.map((w: any) => (
              <div key={w.id} className="flex items-center justify-between text-[11px] bg-surface-2 rounded-lg px-2 py-1.5">
                <div>
                  <p className="mono-num font-bold">{Number(w.amount).toFixed(2)} TK</p>
                  <p className="text-[9px] text-muted-foreground">{w.provider} · {new Date(w.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  w.status === "paid" ? "bg-emerald/15 text-emerald" :
                  w.status === "rejected" ? "bg-rose/15 text-rose" :
                  "bg-amber/15 text-amber"
                }`}>{w.status.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Danger */}
      <button
        onClick={() => { if (confirm("মুছুন this user FOREVER? Everything will be gone.")) del.mutate(); }}
        className="w-full py-2.5 rounded-xl bg-rose/20 text-rose font-black text-xs flex items-center justify-center gap-2 border border-rose/30">
        <Trash2 className="w-3.5 h-3.5" /> মুছুন user permanently
      </button>
    </div>
  );
}
