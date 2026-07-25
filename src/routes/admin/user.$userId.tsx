import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminUserDetail, adminAdjustBalance, adminToggleMining, adminResetTask, adminমুছুনUser, adminResetUserPassword, adminClearMiningOverride, adminCreateVoucher, adminListVouchersForUser, adminSetReferralUnlock, adminResetWallet, adminMarkAsReverified, adminAddDebt, adminResolveDebt, adminDeleteDebt, adminDirectPayout } from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Power, Plus, Minus, RefreshCw, Trash2, Copy, KeyRound, Gift, ScanFace, Share2, Lock, Unlock, Wallet, CheckCircle2, AlertTriangle, CheckCheck, Send } from "lucide-react";
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
  const [deltaNote, setDeltaNote] = useState("");
  const [newPass, setNewPass] = useState("");
  const [voucherAmt, setVoucherAmt] = useState("");
  const [voucherReason, setVoucherReason] = useState("");
  const [payAmt, setPayAmt] = useState("");
  const [payProvider, setPayProvider] = useState<"bkash" | "nagad">("bkash");
  const [payNumber, setPayNumber] = useState("");
  const [payNote, setPayNote] = useState("");
  const [payDeduct, setPayDeduct] = useState(true);

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

  const payout = useMutation({
    mutationFn: () => adminDirectPayout({ data: {
      userId,
      amount: Number(payAmt),
      provider: payProvider,
      walletNumber: payNumber.trim(),
      note: payNote.trim() || undefined,
      deductBalance: payDeduct,
    }}),
    onSuccess: () => {
      toast.success(`✅ ${payAmt}৳ ${payProvider === "bkash" ? "বিকাশ" : "নগদ"} · ${payNumber} — history-তে যোগ হয়েছে`);
      setPayAmt(""); setPayNumber(""); setPayNote("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });


  const resetPass = useMutation({
    mutationFn: (pwd: string) => adminResetUserPassword({ data: { userId, newPassword: pwd } }),
    onSuccess: () => { toast.success("পাসওয়ার্ড রিসেট হয়েছে"); setNewPass(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const adjust = useMutation({
    mutationFn: (d: number) => adminAdjustBalance({ data: { userId, delta: d, note: deltaNote.trim() || undefined } }),
    onSuccess: (r) => { toast.success(`New balance: ${r.new_balance.toFixed(2)} TK`); setDelta(""); setDeltaNote(""); refetch(); },
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

  const setUnlock = useMutation({
    mutationFn: (unlocked: boolean) => adminSetReferralUnlock({ data: { userId, unlocked } }),
    onSuccess: (_r, unlocked) => { toast.success(unlocked ? "🔓 Referral link unlock করা হলো" : "🔒 Referral link lock করা হলো"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetWallet = useMutation({
    mutationFn: () => adminResetWallet({ data: { userId } }),
    onSuccess: () => { toast.success("Wallet reset — user নতুন করে সেট করতে পারবে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const markReverified = useMutation({
    mutationFn: (taskId: string) => adminMarkAsReverified({ data: { taskId } }),
    onSuccess: () => { toast.success("✅ Re-verify হিসেবে mark হয়েছে — mining recompute হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Debt / Warning state ----
  const [debtAmt, setDebtAmt] = useState("");
  const [debtProvider, setDebtProvider] = useState<"bkash" | "nagad">("bkash");
  const [debtNumber, setDebtNumber] = useState("");
  const [debtMsg, setDebtMsg] = useState("");

  const addDebt = useMutation({
    mutationFn: () => adminAddDebt({ data: {
      userId, amount: Number(debtAmt), provider: debtProvider,
      paymentNumber: debtNumber.trim(),
      message: debtMsg.trim() || undefined,
    }}),
    onSuccess: () => {
      toast.success(`⚠ ${debtAmt}৳ warning পাঠানো হয়েছে`);
      setDebtAmt(""); setDebtNumber(""); setDebtMsg("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resolveDebt = useMutation({
    mutationFn: (debtId: string) => adminResolveDebt({ data: { debtId } }),
    onSuccess: () => { toast.success("Warning সমাধান হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeDebt = useMutation({
    mutationFn: (debtId: string) => adminDeleteDebt({ data: { debtId } }),
    onSuccess: () => { toast.success("Warning মুছে ফেলা হয়েছে"); refetch(); },
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
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">User</p>
            <h2 className="text-lg font-black mt-1">{p.display_name ?? "—"}</h2>
            <p className="text-[11px] text-muted-foreground mono-num">{p.phone_number ?? p.email}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-amber font-black">UID</p>
            <button
              onClick={() => copy(String((p as any).uid_seq ?? ""))}
              className="group flex items-center gap-1 text-xl font-black text-amber mono-num hover:text-cyan transition"
              title="UID copy করুন"
            >
              {(p as any).uid_seq ?? "—"}
              <Copy className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">Joined: {new Date(p.created_at).toLocaleString()}</p>
      </div>

      {/* ⚠ Warning / Debt (overpayment recovery) */}
      <div className="rounded-2xl p-4 border-2 border-rose/50 bg-linear-to-br from-rose/15 via-amber/5 to-transparent space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose" />
          <p className="text-[10px] uppercase tracking-widest text-rose font-black">Warning / ভুল পেমেন্ট ফেরত</p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          ভুলে বেশি টাকা পাঠিয়ে দিলে এখান থেকে ইউজার-এর অ্যাকাউন্টে ঋণ (−) বসাতে পারবেন। ওই টাকা তার ব্যালেন্স থেকে বাদ যাবে এবং withdraw পেজে আপনার agent নাম্বার + মেসেজ সহ big warning দেখাবে। টাকা ফেরত পেলে "Resolve" চাপুন।
        </p>

        {((data as any).debts ?? []).filter((d: any) => d.status === "active").length > 0 && (
          <div className="space-y-2">
            {((data as any).debts ?? []).filter((d: any) => d.status === "active").map((d: any) => (
              <div key={d.id} className="rounded-xl bg-background/60 border border-rose/40 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${d.provider === "bkash" ? "bg-rose/20 text-rose" : "bg-amber/20 text-amber"}`}>
                    {d.provider === "bkash" ? "বিকাশ" : "নগদ"}
                  </span>
                  <span className="mono-num font-black text-rose text-lg">−{Math.ceil(Number(d.amount))}৳</span>
                </div>
                <p className="mono-num text-[11px] text-navy"><span className="text-muted-foreground">Agent:</span> <span className="font-black">{d.payment_number}</span></p>
                {d.message && <p className="text-[10px] text-muted-foreground leading-snug whitespace-pre-wrap">{d.message}</p>}
                <p className="text-[9px] text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={resolveDebt.isPending}
                    onClick={() => { if (confirm("টাকা ফেরত পেয়েছেন? Warning সরিয়ে দেবো?")) resolveDebt.mutate(d.id); }}
                    className="py-1.5 rounded-lg bg-emerald/20 text-emerald font-black text-[10px] flex items-center justify-center gap-1 disabled:opacity-50">
                    <CheckCheck className="w-3 h-3" /> Resolve
                  </button>
                  <button
                    disabled={removeDebt.isPending}
                    onClick={() => { if (confirm("এই warning permanently মুছে ফেলবেন?")) removeDebt.mutate(d.id); }}
                    className="py-1.5 rounded-lg bg-rose/20 text-rose font-black text-[10px] flex items-center justify-center gap-1 disabled:opacity-50">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {((data as any).debts ?? []).filter((d: any) => d.status === "resolved").length > 0 && (
          <details className="text-[10px]">
            <summary className="text-muted-foreground cursor-pointer">Resolved history ({((data as any).debts ?? []).filter((d: any) => d.status === "resolved").length})</summary>
            <div className="mt-2 space-y-1">
              {((data as any).debts ?? []).filter((d: any) => d.status === "resolved").map((d: any) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-2 py-1">
                  <span className="mono-num text-emerald font-black">−{Math.ceil(Number(d.amount))}৳ ✓</span>
                  <span className="text-muted-foreground">{new Date(d.resolved_at ?? d.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="space-y-2 pt-2 border-t border-rose/20">
          <p className="text-[10px] uppercase tracking-widest text-rose font-black">নতুন Warning পাঠান</p>
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={debtAmt} onChange={(e) => setDebtAmt(e.target.value)}
              placeholder="ভুলে পাঠানো টাকা (৳)"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-rose" />
            <select value={debtProvider} onChange={(e) => setDebtProvider(e.target.value as any)}
              className="px-2 py-2 rounded-xl bg-surface-2 border border-border text-xs font-black">
              <option value="bkash">বিকাশ</option>
              <option value="nagad">নগদ</option>
            </select>
          </div>
          <input type="tel" inputMode="numeric" value={debtNumber} onChange={(e) => setDebtNumber(e.target.value)}
            placeholder="Agent নম্বর (Cash-Out যেখানে পাঠাবে)"
            className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-rose" />
          <textarea value={debtMsg} onChange={(e) => setDebtMsg(e.target.value)}
            rows={3}
            placeholder={"যেমন: ভাই, ভুল করে ২০০৳ বেশি চলে গেছে। উপরের Agent নম্বরে Cash-Out করে ফেরত দিন, না দিলে অ্যাকাউন্ট বন্ধ করে দেওয়া হবে।"}
            className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-[12px] focus:outline-none focus:border-rose" />
          <button
            disabled={addDebt.isPending || !debtAmt || Number(debtAmt) <= 0 || debtNumber.trim().length < 4}
            onClick={() => {
              if (!confirm(`${debtAmt}৳ warning পাঠাবেন? User-এর ব্যালেন্স থেকে ${debtAmt}৳ বাদ যাবে।`)) return;
              addDebt.mutate();
            }}
            className="w-full py-2.5 rounded-xl bg-rose text-white font-black text-[12px] flex items-center justify-center gap-1 disabled:opacity-50">
            {addDebt.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
            Warning পাঠান (−{debtAmt || "০"}৳)
          </button>
        </div>
      </div>

      {/* GoodDollar face summary */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-violet/30">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-violet" />
          <p className="text-[10px] uppercase tracking-widest text-violet font-black">GoodDollar Face Verification</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald/10 border border-emerald/20 py-3">
            <p className="mono-num text-2xl font-black text-emerald">{data.faceSummary?.firstVerifies ?? data.faceSummary?.slotFaces ?? 0}</p>
            <p className="text-[10px] font-bold text-emerald uppercase">✅ Success verify</p>
          </div>
          <div className="rounded-xl bg-cyan/10 border border-cyan/20 py-3">
            <p className="mono-num text-2xl font-black text-cyan">{data.faceSummary?.reverifies ?? data.faceSummary?.done ?? 0}</p>
            <p className="text-[10px] font-bold text-cyan uppercase">🔁 Re-verify</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-amber/15 text-amber font-black mono-num">pending re-verify {data.faceSummary?.verified ?? 0}</span>
          <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground font-black mono-num">empty slot {data.faceSummary?.emptySlots ?? 0}</span>
          {(data.faceSummary?.backupFaces ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose/15 text-rose font-black mono-num">backup {data.faceSummary?.backupFaces}</span>
          )}
        </div>
      </div>

      {/* Referral lock control */}
      <div className={`glass rounded-2xl p-4 space-y-2 border ${data.referralLock?.unlocked ? "border-emerald/30" : "border-rose/30"}`}>
        <div className="flex items-center gap-2">
          {data.referralLock?.unlocked ? <Unlock className="w-4 h-4 text-emerald" /> : <Lock className="w-4 h-4 text-rose" />}
          <p className={`text-[10px] uppercase tracking-widest font-black ${data.referralLock?.unlocked ? "text-emerald" : "text-rose"}`}>
            Referral link — {data.referralLock?.unlocked ? "UNLOCKED" : "LOCKED"}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {data.referralLock?.firstVerifies ?? 0}/5 first-verify complete
          {data.referralLock?.override && <span className="ml-1 text-violet font-black">· admin override ON</span>}
        </p>
        <p className="text-[10px] text-muted-foreground leading-snug">
          ৫টি ফেস ভেরিফাই complete হলে referral link auto unlock হয়। এর আগে admin manual unlock করলে user অন্য কাউকে refer করতে পারবে।
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={setUnlock.isPending || data.referralLock?.override === true}
            onClick={() => setUnlock.mutate(true)}
            className="py-2 rounded-xl bg-emerald/20 text-emerald font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-40">
            <Unlock className="w-3 h-3" /> Unlock (admin)
          </button>
          <button
            disabled={setUnlock.isPending || data.referralLock?.override === false}
            onClick={() => setUnlock.mutate(false)}
            className="py-2 rounded-xl bg-rose/20 text-rose font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-40">
            <Lock className="w-3 h-3" /> Re-lock
          </button>
        </div>
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
      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-cyan" />
          <p className="text-[10px] uppercase tracking-widest text-cyan font-black">Wallet</p>
        </div>
        {(data.wallets ?? []).length > 0 ? (
          <>
            <div className="space-y-1.5">
              {(data.wallets ?? []).map((wallet: any) => (
                <button
                  key={wallet.provider}
                  onClick={() => copy(wallet.number)}
                  className="w-full flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-left"
                >
                  <span className="text-[10px] font-black uppercase text-cyan">{wallet.provider}</span>
                  <span className="mono-num font-bold">{wallet.number}</span>
                  <Copy className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              Reset করলে user-এর সব bKash/Nagad নম্বর মুছে যাবে এবং নতুন করে সেট করতে পারবে।
            </p>
            <button
              disabled={resetWallet.isPending}
              onClick={() => {
                const summary = (data.wallets ?? []).map((wallet: any) => `${wallet.provider}: ${wallet.number}`).join("\n");
                if (confirm(`এই user-এর সব wallet reset করবেন?\n${summary}`)) resetWallet.mutate();
              }}
              className="w-full py-2 rounded-xl bg-rose/15 text-rose font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50">
              {resetWallet.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              সব Wallet reset করুন
            </button>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">Not set</p>
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

      {/* 🔴 Re-verify queue (not-whitelisted) — separate box with copyable private keys */}
      {(() => {
        const queue = (data.tasks ?? []).filter((t: any) => t.status === "verified" && t.whitelist_ok === false && t.wallet_address);
        if (queue.length === 0) return null;
        return (
          <div className="rounded-2xl p-4 border-2 border-rose/50 bg-linear-to-br from-rose/15 via-rose/5 to-transparent space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-widest text-rose font-black">🔁 Re-verify চাচ্ছে ({queue.length})</p>
              <button
                onClick={() => {
                  const all = queue.map((t: any) => `${t.face_label ?? "—"}\n${t.wallet_address}\n${t.wallet_private_key}`).join("\n\n");
                  navigator.clipboard.writeText(all);
                  toast.success(`${queue.length} key copy হয়েছে`);
                }}
                className="text-[10px] px-2 py-1 rounded-lg bg-rose/20 text-rose font-black flex items-center gap-1">
                <Copy className="w-3 h-3" /> সব copy
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              এই key গুলোর GoodDollar whitelist বাতিল হয়েছে — user এখন re-verify করবে। tap করলে address বা private key copy হবে।
            </p>
            {queue.map((t: any) => (
              <div key={t.id} className="bg-background/60 rounded-xl p-2.5 space-y-1.5 border border-rose/20">
                <div className="flex items-center gap-2">
                  {t.signed_url && <img src={t.signed_url} className="w-9 h-9 rounded-lg object-cover shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black text-rose truncate">{t.face_label ?? "—"} · slot #{t.slot}</p>
                    <p className="text-[9px] text-muted-foreground">Due: {t.reverify_due_at ? new Date(t.reverify_due_at).toLocaleString() : "—"}</p>
                  </div>
                </div>
                <button onClick={() => copy(t.wallet_address)} className="w-full flex items-center gap-1 text-[10px] mono-num text-cyan bg-cyan/5 rounded-lg px-2 py-1 hover:bg-cyan/10">
                  <span className="truncate flex-1 text-left">{t.wallet_address}</span><Copy className="w-2.5 h-2.5 shrink-0" />
                </button>
                <button onClick={() => copy(t.wallet_private_key)} className="w-full flex items-center gap-1 text-[10px] mono-num text-amber bg-amber/5 rounded-lg px-2 py-1 hover:bg-amber/10">
                  <KeyRound className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{t.wallet_private_key?.slice(0, 24)}…</span><Copy className="w-2.5 h-2.5 shrink-0" />
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Tasks */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">GoodDollar face slots</p>
          <button
            onClick={() => {
              const parts: string[] = [];
              for (const t of (data.tasks ?? [])) {
                if (!t.wallet_address || !t.wallet_private_key) continue;
                const tag = t.status === "done" ? "🔁 RE-VERIFIED"
                  : t.whitelist_ok === false ? "⚠ NOT WHITELIST"
                  : "✅ 1ST VERIFY";
                parts.push(`${t.face_label ?? "—"} (slot #${t.slot}) ${tag}\n${t.wallet_address}\n${t.wallet_private_key}`);
              }
              for (const a of (data.unverified ?? [])) {
                if (!a.wallet_address || !a.wallet_private_key) continue;
                parts.push(`${a.face_label ?? "—"} (backup) ⚠ NOT WHITELIST\n${a.wallet_address}\n${a.wallet_private_key}`);
              }
              if (parts.length === 0) return toast.error("কোনো key নেই");
              navigator.clipboard.writeText(parts.join("\n\n"));
              toast.success(`${parts.length} key copy হয়েছে (সব ধরনের)`);
            }}
            className="text-[10px] px-2 py-1 rounded-lg bg-cyan/15 text-cyan font-black flex items-center gap-1">
            <Copy className="w-3 h-3" /> সব key copy (verify + not-whitelist + backup)
          </button>
        </div>
        <div className="space-y-2">
          {data.tasks.map((t: any) => {
            const isReverified = t.status === "done";
            const isFirstOnly = t.status === "verified" && !!t.initial_verify_at;
            const canConvert = t.status === "verified" && !!t.wallet_address;
            return (
            <div key={t.id} className="flex items-start gap-2 bg-surface-2 rounded-xl p-2">
              {t.signed_url ? (
                <img src={t.signed_url} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-background shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">#{t.slot}</div>
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <p className="text-[11px] font-bold">Slot #{t.slot}</p>
                  {isReverified && <span className="px-1.5 py-0.5 rounded bg-emerald/20 text-emerald text-[9px] font-black">🔁 RE-VERIFIED</span>}
                  {isFirstOnly && t.whitelist_ok !== false && <span className="px-1.5 py-0.5 rounded bg-amber/20 text-amber text-[9px] font-black">✅ 1ST VERIFY</span>}
                  {t.whitelist_ok === false && <span className="px-1.5 py-0.5 rounded bg-rose/20 text-rose text-[9px] font-black">⚠ NOT WHITELIST</span>}
                  {t.status === "empty" && <span className="text-[10px] text-muted-foreground">empty</span>}
                </div>
                {t.face_label && <p className="text-[10px] text-amber truncate">{t.face_label}</p>}
                {t.initial_verify_at && (
                  <p className="text-[9px] text-muted-foreground">1st verify: {new Date(t.initial_verify_at).toLocaleString()}</p>
                )}
                {t.done_at && (
                  <p className="text-[9px] text-emerald">Re-verified: {new Date(t.done_at).toLocaleString()}</p>
                )}
                {t.wallet_address && (
                  <button onClick={() => copy(t.wallet_address)} className="w-full flex items-center gap-1 text-[9px] text-cyan mono-num truncate">
                    <span className="truncate flex-1 text-left">{t.wallet_address}</span><Copy className="w-2.5 h-2.5 shrink-0" />
                  </button>
                )}
                {t.wallet_private_key && (
                  <button onClick={() => copy(t.wallet_private_key)} className="w-full flex items-center gap-1 text-[9px] text-amber mono-num truncate bg-amber/5 rounded px-1 py-0.5">
                    <KeyRound className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate flex-1 text-left">key: {t.wallet_private_key.slice(0, 16)}…</span>
                    <Copy className="w-2.5 h-2.5 shrink-0" />
                  </button>
                )}
                {canConvert && (
                  <button
                    disabled={markReverified.isPending}
                    onClick={() => { if (confirm(`Slot #${t.slot} কে re-verify হিসেবে mark করবেন? (mining এ যোগ হবে)`)) markReverified.mutate(t.id); }}
                    className="w-full flex items-center justify-center gap-1 text-[9px] text-emerald bg-emerald/10 hover:bg-emerald/15 rounded-lg px-2 py-1 mt-1 font-black disabled:opacity-50">
                    <CheckCircle2 className="w-3 h-3" /> Re-verify হিসেবে mark করুন (mining শুরু)
                  </button>
                )}
              </div>
              {(t.status !== "empty") && (
                <button onClick={() => { if (confirm(`Reset slot #${t.slot}? Face + key deleted.`)) reset.mutate(t.id); }}
                  className="p-1.5 rounded-lg bg-rose/15 text-rose shrink-0">
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>
          );})}
        </div>
      </div>

      {/* Backup / not-whitelisted generated faces */}
      {data.unverified.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2 border border-rose/25">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-rose font-black">Backup / not-whitelisted face ({data.unverified.length})</p>
            <button
              onClick={() => {
                const txt = data.unverified.filter((a: any) => a.wallet_address && a.wallet_private_key)
                  .map((a: any) => `${a.face_label ?? "—"}\n${a.wallet_address}\n${a.wallet_private_key}`).join("\n\n");
                if (!txt) return toast.error("কোনো key নেই");
                navigator.clipboard.writeText(txt);
                toast.success("সব key copy হয়েছে");
              }}
              className="text-[10px] px-2 py-1 rounded-lg bg-rose/15 text-rose font-black flex items-center gap-1">
              <Copy className="w-3 h-3" /> সব copy
            </button>
          </div>
          {data.unverified.map((a: any) => (
            <div key={a.id} className="bg-surface-2 rounded-xl p-2 text-[11px] space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-black text-rose truncate">{a.face_label ?? "নাম নেই"}</p>
                  <p className="text-[9px] text-muted-foreground">Slot #{a.slot ?? "—"} · {a.kind} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <Link to="/admin/unverified" className="shrink-0 px-2 py-1 rounded-lg bg-rose/15 text-rose text-[9px] font-black">Control</Link>
              </div>
              {a.wallet_address && (
                <button onClick={() => copy(a.wallet_address)} className="w-full flex items-center gap-1 text-[9px] text-cyan mono-num truncate">
                  <span className="truncate flex-1 text-left">{a.wallet_address}</span><Copy className="w-2.5 h-2.5 shrink-0" />
                </button>
              )}
              {a.wallet_private_key && (
                <button onClick={() => copy(a.wallet_private_key)} className="w-full flex items-center gap-1 text-[9px] text-amber mono-num truncate bg-amber/5 rounded px-1 py-0.5">
                  <KeyRound className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate flex-1 text-left">key: {a.wallet_private_key.slice(0, 16)}…</span>
                  <Copy className="w-2.5 h-2.5 shrink-0" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Referral face source */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-cyan/25">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-cyan" />
            <p className="text-[10px] uppercase tracking-widest text-cyan font-black">Referral theke asha face</p>
          </div>
          <span className="mono-num text-[10px] font-black bg-cyan/15 text-cyan px-2 py-0.5 rounded-full">
            {data.referralSummary?.totalFaces ?? 0} face
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 py-2">
            <p className="mono-num font-black text-cyan">{data.referralSummary?.totalAccounts ?? 0}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase">account</p>
          </div>
          <div className="rounded-xl bg-surface-2 py-2">
            <p className="mono-num font-black text-emerald">{data.referralSummary?.activeAccounts ?? 0}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase">face koreche</p>
          </div>
          <div className="rounded-xl bg-surface-2 py-2">
            <p className="mono-num font-black text-violet">{data.referralSummary?.totalFaces ?? 0}</p>
            <p className="text-[9px] text-muted-foreground font-bold uppercase">total face</p>
          </div>
        </div>
        {(data.referrals ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">এই user এখনো কাউকে refer করেনি।</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {(data.referrals ?? []).map((r: any, i: number) => (
              <Link key={r.id} to="/admin/user/$userId" params={{ userId: r.id }} className="flex items-center gap-2 bg-surface-2 rounded-xl p-2 hover:border-cyan/40 border border-transparent transition">
                <div className="w-7 h-7 rounded-full bg-cyan/15 text-cyan mono-num flex items-center justify-center text-[10px] font-black shrink-0">#{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black truncate">{r.display_name ?? "—"}</p>
                  <p className="text-[9px] text-muted-foreground mono-num truncate">{r.phone_number ?? r.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="mono-num text-sm font-black text-cyan">{r.firstVerifies ?? r.faceTotal}</p>
                  <p className="text-[8px] text-muted-foreground uppercase">সফল verify</p>
                  <p className="mono-num text-[9px] font-black text-violet">🔁 {r.reverifies ?? 0}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Direct Payout */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-emerald/30">
        <div className="flex items-center gap-2">
          <Send className="w-4 h-4 text-emerald" />
          <p className="text-[10px] uppercase tracking-widest text-emerald font-black">Direct Payout (Admin → User)</p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          বিকাশ/নগদে সরাসরি TK পাঠানোর record রাখুন — user এর history-তে PAID হিসেবে দেখাবে, admin panel-এও থাকবে।
        </p>

        <div className="flex gap-2">
          <button type="button" onClick={() => setPayProvider("bkash")}
            className={`flex-1 py-2 rounded-xl text-xs font-black border-2 ${payProvider === "bkash" ? "bg-rose/20 border-rose text-rose" : "bg-surface-2 border-border text-muted-foreground"}`}>
            বিকাশ
          </button>
          <button type="button" onClick={() => setPayProvider("nagad")}
            className={`flex-1 py-2 rounded-xl text-xs font-black border-2 ${payProvider === "nagad" ? "bg-amber/20 border-amber text-amber" : "bg-surface-2 border-border text-muted-foreground"}`}>
            নগদ
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" value={payAmt}
            onChange={(e) => setPayAmt(e.target.value)}
            placeholder="Amount (৳)"
            className="w-28 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-emerald"
          />
          <input
            type="tel" inputMode="numeric" value={payNumber}
            onChange={(e) => setPayNumber(e.target.value)}
            placeholder="যে number-এ পাঠিয়েছেন"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-emerald"
          />
        </div>
        <input
          type="text" value={payNote}
          onChange={(e) => setPayNote(e.target.value)}
          placeholder="Note (optional) — কেন পাঠানো হলো"
          maxLength={500}
          className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-emerald"
        />
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={payDeduct} onChange={(e) => setPayDeduct(e.target.checked)} />
          User balance থেকে কেটে নিন (uncheck করলে শুধু record হবে)
        </label>

        <button
          disabled={payout.isPending || !payAmt || !payNumber.trim() || Number(payAmt) <= 0}
          onClick={() => {
            if (!confirm(`${payAmt}৳ পাঠানো record করবেন?\n${payProvider === "bkash" ? "বিকাশ" : "নগদ"}: ${payNumber}\n${payDeduct ? "Balance থেকে কাটা হবে" : "Balance কাটা হবে না"}`)) return;
            payout.mutate();
          }}
          className="w-full py-2.5 rounded-xl bg-emerald text-background font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
          {payout.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          Payout record করুন
        </button>
      </div>

      {/* Withdrawals */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Withdrawal history ({data.withdrawals.length})</p>
        {data.withdrawals.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">None</p>
        ) : (
          <div className="space-y-1.5">
            {data.withdrawals.map((w: any) => {
              const isAdminPayout = typeof w.admin_note === "string" && w.admin_note.startsWith("[Admin Payout]");
              const noteClean = isAdminPayout ? w.admin_note.replace(/^\[Admin Payout\]\s*/, "") : w.admin_note;
              return (
                <div key={w.id} className="bg-surface-2 rounded-lg px-2 py-1.5 space-y-1">
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <div className="min-w-0">
                      <p className="mono-num font-bold">
                        {Number(w.amount).toFixed(2)} TK
                        {isAdminPayout && <span className="ml-1 text-[8px] px-1.5 py-0.5 rounded bg-emerald/20 text-emerald font-black align-middle">ADMIN</span>}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        <span className="uppercase font-bold">{w.provider}</span>
                        {w.wallet_number ? <> · <span className="mono-num">{w.wallet_number}</span></> : null}
                        {" · "}{new Date(w.created_at).toLocaleDateString()}
                      </p>
                      {noteClean && <p className="text-[9px] text-muted-foreground italic truncate">{noteClean}</p>}
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                      w.status === "paid" ? "bg-emerald/15 text-emerald" :
                      w.status === "rejected" ? "bg-rose/15 text-rose" :
                      "bg-amber/15 text-amber"
                    }`}>{w.status.toUpperCase()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Bonus Voucher */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-amber/30">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber" />
          <p className="text-[10px] uppercase tracking-widest text-amber font-black">Bonus Voucher পাঠান</p>
        </div>
        <p className="text-[10px] text-muted-foreground">
          User এর হোমে popup আসবে · Claim করলে balance এ যোগ হবে · withdraw করা যাবে।
        </p>
        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" value={voucherAmt}
            onChange={(e) => setVoucherAmt(e.target.value)}
            placeholder="Amount (৳)"
            className="w-28 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm mono-num focus:outline-none focus:border-amber"
          />
          <input
            type="text" value={voucherReason}
            onChange={(e) => setVoucherReason(e.target.value)}
            placeholder="উদ্দেশ্য (কেন দিচ্ছেন) …"
            maxLength={500}
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-amber"
          />
        </div>
        <button
          disabled={sendVoucher.isPending || !voucherAmt || !voucherReason.trim() || Number(voucherAmt) <= 0}
          onClick={() => {
            if (!confirm(`${voucherAmt}৳ voucher পাঠাবেন?\nকারণ: ${voucherReason}`)) return;
            sendVoucher.mutate();
          }}
          className="w-full py-2 rounded-xl bg-amber text-background font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50">
          {sendVoucher.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5" />}
          Voucher পাঠান
        </button>

        {(vouchersQ.data ?? []).length > 0 && (
          <div className="pt-2 border-t border-border space-y-1.5">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">Voucher history</p>
            {(vouchersQ.data ?? []).slice(0, 8).map((v: any) => (
              <div key={v.id} className="flex items-center justify-between text-[11px] bg-surface-2 rounded-lg px-2 py-1.5">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="mono-num font-black text-amber">{Number(v.amount).toFixed(0)}৳</p>
                  <p className="text-[9px] text-muted-foreground truncate">{v.reason}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  v.status === "claimed" ? "bg-emerald/15 text-emerald" : "bg-amber/15 text-amber"
                }`}>{v.status === "claimed" ? "CLAIMED" : "PENDING"}</span>
              </div>
            ))}
          </div>
        )}
      </div>


      <button
        onClick={() => { if (confirm("মুছুন this user FOREVER? Everything will be gone.")) del.mutate(); }}
        className="w-full py-2.5 rounded-xl bg-rose/20 text-rose font-black text-xs flex items-center justify-center gap-2 border border-rose/30">
        <Trash2 className="w-3.5 h-3.5" /> মুছুন user permanently
      </button>
    </div>
  );
}
