import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminUserDetail, adminAdjustBalance, adminBalanceAudit, adminToggleMining, adminResetTask, adminমুছুনUser, adminResetUserPassword, adminClearMiningOverride, adminCreateVoucher, adminListVouchersForUser, adminSetReferralUnlock, adminResetWallet, adminMarkAsReverified, adminAddDebt, adminResolveDebt, adminDeleteDebt, adminDirectPayout, adminSetUserBlocked, adminSetBalanceFrozen, adminReturnTransferToSender, adminUserDailyReport, adminListTaskBackups, adminRestoreTask } from "@/lib/admin.functions";
import { ArrowLeft, Loader2, Power, Plus, Minus, RefreshCw, Trash2, Copy, KeyRound, Gift, ScanFace, Share2, Lock, Unlock, Wallet, CheckCircle2, AlertTriangle, CheckCheck, Send, TrendingUp, Ban, ShieldOff } from "lucide-react";
import { computeLiveBalance, splitBalance } from "@/lib/mining";
import { toast } from "sonner";
import { useState } from "react";
import { BalanceHistory } from "@/components/admin/BalanceHistory";
import { EarningsBreakdown } from "@/components/EarningsBreakdown";


export const Route = createFileRoute("/admin/user/$userId")({ component: UserDetail });

function UserDetail() {

  const { userId } = Route.useParams();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-user", "original-first-verifies-v2", userId],
    queryFn: () => adminUserDetail({ data: { userId } }),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
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

  const auditQ = useQuery({
    queryKey: ["admin-user-balance-audit", userId],
    queryFn: () => adminBalanceAudit({ data: { userId } }),
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
    onSuccess: (r) => { toast.success(`New balance: ${r.new_balance.toFixed(2)} TK`); setDelta(""); setDeltaNote(""); refetch(); auditQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (active: boolean) => adminToggleMining({ data: { userId, active } }),
    onSuccess: () => { toast.success("Mining override সেট হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const clearOverride = useMutation({
    mutationFn: () => adminClearMiningOverride({ data: { userId } }),
    onSuccess: () => { toast.success("Admin force বন্ধ—এখন স্বয়ংক্রিয় mining নিয়ম চলবে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });


  const backups = useQuery({
    queryKey: ["admin-task-backups", userId],
    queryFn: () => adminListTaskBackups({ data: { userId } }),
  });

  const restore = useMutation({
    mutationFn: (backupId: string) => adminRestoreTask({ data: { backupId } }),
    onSuccess: () => { toast.success("স্লট আগের অবস্থায় ফিরে এসেছে"); backups.refetch(); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: (taskId: string) => adminResetTask({ data: { taskId } }),
    onSuccess: () => { toast.success("Slot reset"); backups.refetch(); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });


  const del = useMutation({
    mutationFn: () => adminমুছুনUser({ data: { userId } }),
    onSuccess: () => { toast.success("মুছুনd"); window.location.href = "/admin/users"; },
    onError: (e: any) => toast.error(e.message),
  });

  const setBlocked = useMutation({
    mutationFn: (blocked: boolean) => adminSetUserBlocked({ data: { userId, blocked } }),
    onSuccess: (_r, blocked) => { toast.success(blocked ? "🚫 User block করা হলো" : "✅ User unblock করা হলো"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const setFrozen = useMutation({
    mutationFn: (v: { frozen: boolean; reason?: string }) =>
      adminSetBalanceFrozen({ data: { userId, frozen: v.frozen, reason: v.reason ?? null } }),
    onSuccess: (_r, v) => { toast.success(v.frozen ? "🧊 ব্যালেন্স freeze করা হলো" : "✅ ব্যালেন্স আবার চালু"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  // অন্য account (যে টাকা পেয়েছে) সরাসরি এখান থেকেই freeze/unfreeze করা যায়।
  const setFrozenOther = useMutation({
    mutationFn: (v: { userId: string; frozen: boolean; reason?: string }) =>
      adminSetBalanceFrozen({ data: { userId: v.userId, frozen: v.frozen, reason: v.reason ?? null } }),
    onSuccess: (_r, v) => { toast.success(v.frozen ? "🧊 ওই account-এর ব্যালেন্স freeze হলো" : "✅ ওই account আবার চালু"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const returnTransfer = useMutation({
    mutationFn: (v: { transferId: string; note?: string }) =>
      adminReturnTransferToSender({ data: { transferId: v.transferId, note: v.note ?? null } }),
    onSuccess: (r: any) => {
      toast.success(`↩️ ${Math.floor(Number(r.amount ?? 0))}৳ original sender-এর balance-এ back হয়েছে`);
      refetch();
      auditQ.refetch();
    },
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


  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  if (error) return (
    <div className="glass rounded-2xl p-5 text-center space-y-3">
      <AlertTriangle className="w-8 h-8 text-rose mx-auto" />
      <p className="text-sm font-black text-rose">User details load করতে সমস্যা হয়েছে</p>
      <p className="text-[11px] text-muted-foreground break-all">{(error as any)?.message ?? String(error)}</p>
      <button onClick={() => refetch()} className="gradient-cta px-4 py-2 rounded-xl text-xs font-black">আবার চেষ্টা করুন</button>
      <Link to="/admin/users" className="block text-[11px] text-cyan">← All users</Link>
    </div>
  );
  if (!data) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  if (!data.profile) return <div className="text-center py-10 text-muted-foreground text-sm">User not found</div>;


  const p = data.profile;
  const m = data.mining;
  const liveBal = m ? computeLiveBalance({
    accrued: Number(m.accrued_amount), withdrawn: Number(m.withdrawn_amount),
    isActive: m.is_active, lastCreditedAt: m.last_credited_at,
    effectiveTaskCount: Number(m.effective_task_count ?? 0), qualifyingReferees: Number(m.qualifying_referees ?? 0),
    selfSlots: Number((m as any).self_slots ?? 0), referralUnits: Number((m as any).referral_units ?? 0),
    selfQualified: (m as any).self_qualified !== false,

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

      {/* Who referred this user */}
      <div className="glass rounded-2xl p-4 border border-cyan/30">
        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-4 h-4 text-cyan" />
          <p className="text-[10px] uppercase tracking-widest text-cyan font-black">যার রেফার থেকে যোগ দিয়েছে</p>
        </div>
        {(data as any).referrer ? (
          <Link
            to="/admin/user/$userId"
            params={{ userId: (data as any).referrer.id }}
            className="flex items-center justify-between gap-3 rounded-xl bg-cyan/10 border border-cyan/20 p-3"
          >
            <div className="min-w-0">
              <p className="font-black text-sm truncate">{(data as any).referrer.display_name ?? "—"}</p>
              <p className="mono-num text-[10px] text-muted-foreground truncate">{(data as any).referrer.phone_number ?? (data as any).referrer.email}</p>
              {(data as any).referrer.referral_code && (
                <p className="mono-num text-[9px] text-cyan mt-0.5">Code: {(data as any).referrer.referral_code}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-[9px] text-muted-foreground uppercase font-bold">Referrer UID</p>
              <p className="mono-num text-lg font-black text-amber">#{(data as any).referrer.uid_seq ?? "—"}</p>
            </div>
          </Link>
        ) : (
          <p className="text-[11px] text-muted-foreground rounded-xl bg-surface-2 p-3">এই user কোনো referral ছাড়া সরাসরি যোগ দিয়েছে।</p>
        )}
      </div>

      {/* 📅 Daily Referral Activity Report — moved up for visibility */}
      <DailyReportPanel userId={userId} />



      {/* ⚠ Warning / Debt (overpayment recovery) */}
      <div className="rounded-2xl p-4 border-2 border-rose/50 bg-linear-to-br from-rose/15 via-amber/5 to-transparent space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose" />
          <p className="text-[10px] uppercase tracking-widest text-rose font-black">Warning / ভুল পেমেন্ট ফেরত</p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          ভুলে বেশি টাকা পাঠিয়ে দিলে এখান থেকে ইউজার-এর অ্যাকাউন্টে ঋণ (−) বসাতে পারবেন। ওই টাকা তার ব্যালেন্স থেকে বাদ যাবে এবং withdraw পেজে আপনার agent নাম্বার + মেসেজ সহ big warning দেখাবে। টাকা ফেরত পেলে "Resolve" চাপুন।
        </p>

        {((data as any).debts ?? []).filter((d: any) => d.status === "active" || d.status === "claimed").length > 0 && (
          <div className="space-y-2">
            {((data as any).debts ?? []).filter((d: any) => d.status === "active" || d.status === "claimed").map((d: any) => (
              <div key={d.id} className={`rounded-xl bg-background/60 border p-2.5 space-y-1.5 ${d.status === "claimed" ? "border-amber/60" : "border-rose/40"}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${d.provider === "bkash" ? "bg-rose/20 text-rose" : "bg-amber/20 text-amber"}`}>
                    {d.provider === "bkash" ? "বিকাশ" : "নগদ"}
                  </span>
                  <span className="mono-num font-black text-rose text-lg">−{Math.ceil(Number(d.amount))}৳</span>
                </div>
                <p className="mono-num text-[11px] text-navy"><span className="text-muted-foreground">Agent:</span> <span className="font-black">{d.payment_number}</span></p>
                {d.message && <p className="text-[10px] text-muted-foreground leading-snug whitespace-pre-wrap">{d.message}</p>}

                {d.status === "claimed" && (
                  <div className="rounded-lg bg-amber/15 border-2 border-amber/50 p-2 space-y-1">
                    <p className="text-[10px] font-black text-amber uppercase tracking-widest">⏳ User দাবি করেছে টাকা ফেরত দিয়েছে</p>
                    {d.claim_from_number && (
                      <p className="text-[11px] mono-num">
                        <span className="text-muted-foreground">ফেরত এসেছে এই নম্বর থেকে:</span>{" "}
                        <button onClick={() => copy(d.claim_from_number)} className="font-black text-navy hover:text-cyan inline-flex items-center gap-1">
                          {d.claim_from_number} <Copy className="w-2.5 h-2.5" />
                        </button>
                      </p>
                    )}
                    {d.claim_note && <p className="text-[10px] text-navy whitespace-pre-wrap">"{d.claim_note}"</p>}
                    {d.claimed_at && <p className="text-[9px] text-muted-foreground">দাবি: {new Date(d.claimed_at).toLocaleString()}</p>}
                    <p className="text-[9px] text-amber font-bold">👉 আপনার বিকাশ/নগদ চেক করুন — সত্যিই এসেছে কিনা যাচাই করে Approve দিন</p>
                  </div>
                )}

                <p className="text-[9px] text-muted-foreground">তৈরি: {new Date(d.created_at).toLocaleString()}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    disabled={resolveDebt.isPending}
                    onClick={() => { if (confirm(d.status === "claimed" ? "টাকা সত্যিই পেয়েছেন? Approve করলে Warning সরে যাবে।" : "টাকা ফেরত পেয়েছেন? Warning সরিয়ে দেবো?")) resolveDebt.mutate(d.id); }}
                    className={`py-1.5 rounded-lg font-black text-[10px] flex items-center justify-center gap-1 disabled:opacity-50 ${d.status === "claimed" ? "bg-emerald text-white" : "bg-emerald/20 text-emerald"}`}>
                    <CheckCheck className="w-3 h-3" /> {d.status === "claimed" ? "Approve" : "Resolve"}
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

      {/* Good-App face summary */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-violet/30">
        <div className="flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-violet" />
          <p className="text-[10px] uppercase tracking-widest text-violet font-black">Good-App Face Verification</p>
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

        {/* Main balance (anytime withdraw) vs mining balance (1st–3rd only) */}
        {(() => {
          const split = splitBalance({
            balance: liveBal,
            bonusTotal: Number((m as any)?.bonus_amount ?? 0),
            withdrawn: Number((m as any)?.withdrawn_amount ?? 0),
            miningWithdrawn: Number((m as any)?.mining_withdrawn ?? 0),
          });
          return (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-emerald/30 bg-emerald/10 px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-emerald">💚 Main balance</p>
                <p className="mono-num text-lg font-black text-emerald">{split.main.toFixed(2)}৳</p>
                <p className="text-[9px] text-muted-foreground leading-tight">বোনাস + রেফার বোনাস · যেকোনো সময় withdraw</p>
              </div>
              <div className="rounded-xl border border-cyan/30 bg-cyan/10 px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-cyan">⛏️ Mining balance</p>
                <p className="mono-num text-lg font-black text-cyan">{split.mining.toFixed(2)}৳</p>
                <p className="text-[9px] text-muted-foreground leading-tight">যেকোনো সময় withdraw (আনলক অংশ) · নিজের {Number((m as any)?.self_mining_accrued ?? 0).toFixed(2)}৳ + রেফার ১০% {Number((m as any)?.referral_accrued ?? 0).toFixed(2)}৳</p>
              </div>
            </div>
          );
        })()}


        {/* Why is mining ON — 2 parts */}
        {(() => {
          const selfRe = Number(data.faceSummary?.reverifies ?? 0);
          const refs = Number(m?.qualifying_referees ?? 0);
          const selfOn = selfRe >= 10;
          return (
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-xl border px-3 py-2 ${selfOn ? "bg-emerald/10 border-emerald/30" : "bg-surface-2 border-border"}`}>
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Self mining</p>
                <p className={`text-sm font-black ${selfOn ? "text-emerald" : "text-muted-foreground"}`}>{selfOn ? "ON" : "OFF"}</p>
                <p className="text-[9px] text-muted-foreground mono-num">{selfRe}/10 re-verify</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 ${refs > 0 ? "bg-violet/10 border-violet/30" : "bg-surface-2 border-border"}`}>
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Referral 10%</p>
                <p className={`text-sm font-black ${refs > 0 ? "text-violet" : "text-muted-foreground"}`}>{refs > 0 ? "ON" : "OFF"}</p>
                <p className="text-[9px] text-muted-foreground mono-num">{refs} mining referee</p>
              </div>
            </div>
          );
        })()}

        {(m as any)?.admin_forced_active && (
          <div className="flex items-center justify-between rounded-lg bg-amber/10 border border-amber/30 px-3 py-2">
            <p className="text-[10px] text-amber font-bold">⚠ Admin নিজে Mining ON করেছেন</p>
            <button
              disabled={clearOverride.isPending}
              onClick={() => clearOverride.mutate()}
              className="text-[10px] px-2 py-1 rounded bg-amber/20 text-amber font-black disabled:opacity-50"
            >
              অটো নিয়মে ফেরান
            </button>
          </div>
        )}

        <div className="space-y-2">
          <input
            type="text" value={deltaNote} onChange={(e) => setDeltaNote(e.target.value)}
            placeholder="কারণ / note লিখুন (যোগ করতে বাধ্যতামূলক)"
            className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs focus:outline-none focus:border-cyan"
          />
          <div className="flex gap-2">
            <input
              type="number" inputMode="decimal" value={delta} onChange={(e) => setDelta(e.target.value)}
              placeholder="Amount (TK)"
              className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-cyan"
            />
            <button
              onClick={() => {
                if (!delta || Number(delta) <= 0) { toast.error("আগে টাকার পরিমাণ লিখুন"); return; }
                if (deltaNote.trim().length < 3) { toast.error("যোগ করতে কারণ (note) লিখতে হবে — কমপক্ষে ৩ অক্ষর"); return; }
                adjust.mutate(Number(delta));
              }}
              disabled={adjust.isPending}
              className="px-3 py-2 rounded-xl bg-emerald/20 text-emerald font-bold text-xs flex items-center gap-1 disabled:opacity-50">
              <Plus className="w-3 h-3" /> Add
            </button>
            <button
              onClick={() => {
                if (!delta || Number(delta) <= 0) { toast.error("আগে টাকার পরিমাণ লিখুন"); return; }
                adjust.mutate(-Number(delta));
              }}
              disabled={adjust.isPending}
              className="px-3 py-2 rounded-xl bg-rose/20 text-rose font-bold text-xs flex items-center gap-1 disabled:opacity-50">
              <Minus className="w-3 h-3" /> Sub
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground font-bold">
            ➕ যোগ করতে কারণ লিখতেই হবে — প্রতিটি পরিবর্তন নিচের <b>ব্যালেন্স হিস্ট্রি</b>-তে আগের ও পরের ব্যালেন্স সহ জমা থাকে।
          </p>
        </div>


        {/* Balance change history — before/after, কে করেছে, কেন */}
        <div className="pt-3 border-t border-border space-y-1.5">
          <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">
            🧾 ব্যালেন্স হিস্ট্রি (আগে কত ছিল → এখন কত)
          </p>
          {(auditQ.data ?? []).length === 0 && (
            <p className="text-[10px] text-muted-foreground">এখনো কোনো রেকর্ড নেই।</p>
          )}
          {(auditQ.data ?? []).slice(0, 25).map((a: any) => {
            const d = Number(a.delta ?? 0);
            return (
              <div key={a.id} className="bg-surface-2 rounded-lg px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className={`mono-num text-[11px] font-black ${d < 0 ? "text-rose" : "text-emerald"}`}>
                    {d > 0 ? "+" : ""}{d.toFixed(2)}৳
                  </p>
                  <p className="mono-num text-[10px] text-muted-foreground">
                    {Number(a.balance_before ?? 0).toFixed(2)}৳ → {Number(a.balance_after ?? 0).toFixed(2)}৳
                  </p>
                </div>
                <p className="text-[9px] text-muted-foreground truncate">
                  {a.source} · {a.actor ?? "system"} · {new Date(a.created_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}
                </p>
                {a.note && <p className="text-[9px] text-amber truncate">📝 {a.note}</p>}
              </div>
            );
          })}
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


      {/* Block / Unblock */}
      {(() => {
        const blocked = (data as any)?.blocked === true;
        return (
          <div className={`glass rounded-2xl p-4 space-y-2 border ${blocked ? "border-rose/50 bg-rose/5" : "border-border"}`}>
            <div className="flex items-center gap-2">
              {blocked ? <Ban className="w-4 h-4 text-rose" /> : <ShieldOff className="w-4 h-4 text-amber" />}
              <p className={`text-[10px] uppercase tracking-widest font-bold ${blocked ? "text-rose" : "text-amber"}`}>
                {blocked ? "User Blocked" : "User Block/Unblock"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {blocked
                ? "এই user block করা — login করতে পারবে না। Unblock করলে আবার login করতে পারবে।"
                : "Block করলে user আর login করতে পারবে না। Withdrawal, mining সব বন্ধ হয়ে যাবে। যেকোনো সময় Unblock করা যাবে।"}
            </p>
            <button
              disabled={setBlocked.isPending}
              onClick={() => {
                const next = !blocked;
                if (!confirm(next ? "এই user block করবেন? Login বন্ধ হয়ে যাবে।" : "এই user unblock করবেন? Login আবার চালু হবে।")) return;
                setBlocked.mutate(next);
              }}
              className={`w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 ${
                blocked ? "bg-emerald/20 text-emerald" : "bg-rose/20 text-rose"
              }`}>
              {setBlocked.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : blocked ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
              {blocked ? "Unblock করুন" : "Block করুন"}
            </button>
          </div>
        );
      })()}

      {/* Balance freeze / unfreeze — block না করেই টাকা নড়াচড়া বন্ধ */}
      {(() => {
        const frozen = (data as any)?.profile?.balance_frozen === true;
        const reason = (data as any)?.profile?.balance_frozen_reason as string | null;
        return (
          <div className={`glass rounded-2xl p-4 space-y-2 border ${frozen ? "border-sky-500/50 bg-sky-500/5" : "border-border"}`}>
            <div className="flex items-center gap-2">
              <ShieldOff className={`w-4 h-4 ${frozen ? "text-sky-400" : "text-cyan-400"}`} />
              <p className={`text-[10px] uppercase tracking-widest font-bold ${frozen ? "text-sky-400" : "text-cyan-400"}`}>
                {frozen ? "🧊 Balance Frozen" : "Balance Freeze/Unfreeze"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {frozen
                ? `এই user-এর ব্যালেন্স freeze — withdraw, send, recharge কিছুই করতে পারবে না।${reason ? ` কারণ: ${reason}` : ""}`
                : "Freeze করলে user login করতে পারবে কিন্তু withdraw/send/recharge করতে পারবে না। Login বন্ধ হবে না।"}
            </p>
            <button
              disabled={setFrozen.isPending}
              onClick={() => {
                const next = !frozen;
                if (next) {
                  const r = prompt("Freeze করার কারণ লিখুন (user দেখতে পাবে):", "প্রথম ১০টি slot re-verify সম্পন্ন হয়নি — বোনাস হিসাব যাচাই চলছে");
                  if (r === null) return;
                  setFrozen.mutate({ frozen: true, reason: r });
                } else {
                  if (!confirm("ব্যালেন্স আবার চালু করবেন?")) return;
                  setFrozen.mutate({ frozen: false });
                }
              }}
              className={`w-full py-2 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 disabled:opacity-50 ${
                frozen ? "bg-emerald/20 text-emerald" : "bg-sky-500/20 text-sky-400"
              }`}>
              {setFrozen.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : frozen ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
              {frozen ? "Unfreeze করুন" : "Balance Freeze করুন"}
            </button>
          </div>
        );
      })()}



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

      {/* Gmail reset */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-cyan" />
          <p className="text-[10px] uppercase tracking-widest text-cyan font-bold">Gmail রিসেট</p>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          ইউজার তার Gmail হারিয়ে ফেললে এখান থেকে ইমেইলটি খুলে দিন। এরপর ইউজার সেটিংস থেকে নতুন Gmail
          দিলে সেই নতুন ঠিকানাতেই ৬ ডিজিটের কোড যাবে — কোড দিলেই নতুন Gmail একাউন্টে যুক্ত হবে।
        </p>
        <p className="text-[10px] mono-num text-muted-foreground">
          বর্তমান: {(data as any).profile?.email || "—"}
        </p>
        <button
          onClick={() => {
            if (!confirm("এই ইউজারের Gmail রিসেট করবেন? ইউজার নতুন Gmail যুক্ত করতে পারবে।")) return;
            resetEmail.mutate();
          }}
          disabled={resetEmail.isPending}
          className="px-3 py-2 rounded-xl bg-cyan/20 text-cyan font-bold text-xs flex items-center gap-1 disabled:opacity-50"
        >
          {resetEmail.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <KeyRound className="w-3 h-3" />}
          Gmail রিসেট করুন
        </button>
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
              এই key গুলোর Good-App whitelist বাতিল হয়েছে — user এখন re-verify করবে। tap করলে address বা private key copy হবে।
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
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Good-App face slots</p>
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
                  {Number(t.reverify_count ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan/20 text-cyan text-[9px] font-black mono-num">
                      🔁 {t.reverify_count} বার GoodDollar re-verify (1st verify বাদে)
                    </span>
                  )}
                  {Number(t.whitelist_renew_count ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-violet/20 text-violet text-[9px] font-black mono-num">
                      ♻ {t.whitelist_renew_count} বার auto-renew (user কিছু করেনি)
                    </span>
                  )}

                  {t.status === "empty" && <span className="text-[10px] text-muted-foreground">empty</span>}
                </div>
                {t.face_label && <p className="text-[10px] text-amber truncate">{t.face_label}</p>}
                {t.initial_verify_at && (
                  <p className="text-[9px] text-muted-foreground">1st verify: {new Date(t.initial_verify_at).toLocaleString()}</p>
                )}
                {t.last_reverified_at && (
                  <p className="text-[9px] text-cyan">শেষ re-verify: {new Date(t.last_reverified_at).toLocaleString()}</p>
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

      {/* Reset history — undo a mistaken slot reset */}
      {(backups.data?.length ?? 0) > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2 border border-amber-500/25">
          <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold">
            রিসেট হিস্ট্রি · চাইলে স্লট আগের অবস্থায় ফিরিয়ে আনুন
          </p>
          {backups.data!.map((b: any) => (
            <div key={b.id} className="flex items-center gap-2 bg-surface-2 rounded-xl p-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black">
                  Slot #{b.slot} · {b.face_label ?? "—"}
                </p>
                <p className="text-[9px] text-muted-foreground truncate">
                  {new Date(b.created_at).toLocaleString("bn-BD")} · {b.reset_by ?? "admin"}
                  {b.wallet_address ? ` · ${b.wallet_address.slice(0, 10)}…` : ""}
                </p>
              </div>
              {b.restored_at ? (
                <span className="text-[9px] font-black text-emerald shrink-0">✅ ফেরত আনা হয়েছে</span>
              ) : (
                <button
                  onClick={() => {
                    if (confirm(`Slot #${b.slot} আগের অবস্থায় ফিরিয়ে আনবেন? (key + face + ভেরিফিকেশন সব ফিরে আসবে)`))
                      restore.mutate(b.id);
                  }}
                  disabled={restore.isPending}
                  className="text-[9px] font-black px-2 py-1.5 rounded-lg bg-amber-500/15 text-amber-500 shrink-0 disabled:opacity-50"
                >
                  ↩️ ফিরিয়ে আনুন
                </button>
              )}
            </div>
          ))}
        </div>
      )}



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
                  <p className="mono-num text-sm font-black text-cyan">{r.firstVerifies}</p>
                  <p className="text-[8px] text-muted-foreground uppercase">original first verify</p>
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

      {/* 🔁 রি-ভেরিফাই হিসাব — not-whitelist হওয়ার পর কতবার re-verify করেছে */}
      {(data as any).reverifyStats && (() => {
        const rs = (data as any).reverifyStats;
        return (
          <div className="glass rounded-2xl p-4 space-y-2 border border-cyan/25">
            <p className="text-[10px] uppercase tracking-widest text-cyan font-black">🔁 রি-ভেরিফাই হিসাব</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-amber">{rs.firstVerifies}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">১ম ভেরিফাই</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-cyan">{rs.totalReverifies}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">মোট re-verify</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-emerald">{rs.cycleDone}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">এই চক্রে হয়েছে</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-rose">{rs.cyclePending}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">এখন বাকি</p>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              “মোট re-verify” = প্রতিটি ঘরে যতবার re-verify হয়েছে তার যোগফল · “এই চক্রে হয়েছে” = not-whitelist হওয়ার পর
              আবার re-verify করে whitelist ফিরে পেয়েছে · “এখন বাকি” = whitelist নেই, এখন আবার re-verify চাচ্ছে।
            </p>
            <div className="flex flex-wrap gap-1">
              {rs.perSlot.map((s: any) => (
                <span key={s.slot}
                  className={`text-[9px] mono-num font-black px-1.5 py-0.5 rounded ${
                    !s.whitelistOk ? "bg-rose/15 text-rose" : s.count > 0 ? "bg-emerald/15 text-emerald" : "bg-surface-2 text-muted-foreground"
                  }`}
                  title={`${s.label ?? ""} · শেষ re-verify: ${s.lastAt ? new Date(s.lastAt).toLocaleString("bn-BD") : "—"}`}>
                  #{s.slot} · 🔁{s.count}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 👥 রেফার বোনাস হিসাব — কার কাছ থেকে কত, কোন রেটে, কখন */}
      {(data as any).referralHistory && (() => {
        const rh = (data as any).referralHistory;
        return (
          <div className="glass rounded-2xl p-4 space-y-2 border border-violet/25">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-violet font-black">👥 রেফার বোনাস হিসাব</p>
              <span className="text-[9px] mono-num font-black bg-violet/15 text-violet px-2 py-0.5 rounded-full">
                এখনকার রেট {rh.currentRate}৳
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black">{rh.totals.referees}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">রেফার</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-emerald">{rh.totals.paidCount}</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">বোনাস পেয়েছে</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-amber">{rh.totals.paidAmount.toFixed(0)}৳</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">মোট বোনাস</p>
              </div>
              <div className="rounded-xl bg-surface-2 py-2">
                <p className="mono-num font-black text-cyan">{rh.totals.commissionAccrued.toFixed(2)}৳</p>
                <p className="text-[8px] text-muted-foreground font-bold uppercase">১০% কমিশন</p>
              </div>
            </div>
            {rh.rows.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">কোনো রেফার নেই</p>
            ) : (
              <div className="space-y-1.5">
                {rh.rows.map((r: any) => (
                  <div key={r.refereeId} className="bg-surface-2 rounded-xl px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-black truncate">
                        {r.name} <span className="mono-num text-muted-foreground">· UID {r.uid ?? "—"}</span>
                      </p>
                      {r.paid ? (
                        <span className="text-[9px] mono-num font-black text-emerald shrink-0">+{r.amount.toFixed(0)}৳</span>
                      ) : (
                        <span className="text-[9px] font-black text-rose shrink-0">বাকি</span>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground">
                      {r.paid ? (
                        <>
                          {new Date(r.paidAt).toLocaleString("bn-BD")} · তখনকার রেট {r.rate.toFixed(0)}৳
                          {r.source === "approx" ? " (আনুমানিক)" : r.source === "audit" ? " (অডিট লগ)" : " (লেজার)"}
                        </>
                      ) : (
                        <>{r.pendingReason}</>
                      )}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      ১ম ভেরিফাই {r.firstVerifies} · re-verify {r.reverifies} · সক্রিয় ঘর {r.activeSlots} ·
                      মাসিক ১০% কমিশন {r.monthlyCommission.toFixed(2)}৳
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}


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
                      {/* এই withdraw-এর টাকা কোন আয় থেকে এসেছে */}
                      {(Number(w.src_main ?? 0) + Number(w.src_mining ?? 0)) > 0 ? (
                        <p className="text-[9px] mt-0.5 flex flex-wrap gap-1">
                          <span className="px-1.5 py-0.5 rounded bg-emerald/15 text-emerald font-black mono-num">
                            মেইন/বোনাস {Number(w.src_main ?? 0).toFixed(2)}৳
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan/15 text-cyan font-black mono-num">
                            মাইনিং {Number(w.src_mining ?? 0).toFixed(2)}৳
                          </span>
                          {Number(w.src_referral ?? 0) > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-violet/15 text-violet font-black mono-num">
                              রেফার ১০% {Number(w.src_referral ?? 0).toFixed(2)}৳
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[9px] text-muted-foreground mt-0.5">উৎস রেকর্ড নেই (পুরোনো রিকোয়েস্ট)</p>
                      )}
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

      {/* সহজ হিসাব — এক নজরে (এই কার্ডটাই যথেষ্ট, নিচেরটা বিস্তারিত) */}
      {(data as any).breakdown && (() => {
        const d = data as any;
        const b = d.breakdown ?? {};
        const withdrawn = Number(d.mining?.withdrawn_amount ?? 0);
        const paid = (d.withdrawals ?? []).filter((w: any) => w.status === "paid")
          .reduce((s: number, w: any) => s + Number(w.amount), 0);
        const recharge = (d.recharges ?? []).filter((r: any) => r.status === "success")
          .reduce((s: number, r: any) => s + Number(r.amount), 0);
        const sent = (d.transfersOut ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0);
        const rows: Array<[string, number, string]> = [
          ["🎁 বোনাস (মেইন) ব্যালেন্স — যেকোনো সময় তোলা যাবে", Number(b.bonus_part ?? 0), "text-emerald"],
          ["⛏️ মাইনিং ব্যালেন্স — শুধু ১/২/৩ তারিখে তোলা যাবে", Number(b.mining_part ?? 0), "text-amber"],
          ["💰 এখনকার মোট ব্যালেন্স", Number(b.current_balance ?? 0), "text-primary"],
          ["✅ পেমেন্ট দেওয়া হয়েছে (withdraw)", paid, "text-foreground"],
          ["📱 মোবাইল রিচার্জ হয়েছে", recharge, "text-foreground"],
          ["🔄 অন্যকে পাঠানো হয়েছে", sent, "text-foreground"],
          ["📤 সব মিলিয়ে খরচ", withdrawn, "text-rose"],
        ];
        return (
          <div className="glass rounded-2xl p-4 space-y-2 border border-primary/30">
            <p className="text-[10px] uppercase tracking-widest text-primary font-black">সহজ হিসাব — এক নজরে</p>
            {rows.map(([label, val, cls]) => (
              <div key={label} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="text-muted-foreground font-bold">{label}</span>
                <span className={`mono-num font-black ${cls}`} translate="no">{Math.floor(val)}৳</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* কে টাকা পাঠিয়েছে ও কোন account-এ টাকা গেছে — নাম/UID সহ */}
      {(() => {
        const d = data as any;
        const out = (d.transfersOut ?? []) as any[];
        const inn = (d.transfersIn ?? []) as any[];
        if (!out.length && !inn.length) return null;
        const Row = ({ t, dir }: { t: any; dir: "in" | "out" }) => {
          const p = dir === "in" ? t.sender : t.receiver;
          return (
            <div className="rounded-xl bg-background/60 border border-border p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                {p?.id ? (
                  <Link to="/admin/user/$userId" params={{ userId: p.id }}
                    className="text-[11px] font-black truncate hover:text-cyan">
                    {p.display_name ?? "User"}
                    {p.uid_seq != null && <span className="mono-num text-muted-foreground ml-1">#{p.uid_seq}</span>}
                    {p.balance_frozen && <span className="ml-1">🧊</span>}
                  </Link>
                ) : (
                  <span className="text-[11px] font-black text-muted-foreground">অজানা account</span>
                )}
                <span className={`mono-num font-black text-sm ${dir === "in" ? "text-emerald" : "text-rose"}`} translate="no">
                  {dir === "in" ? "+" : "−"}{Math.floor(Number(t.amount))}৳
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span>
                {p?.phone_number && <span className="text-[9px] mono-num text-muted-foreground">{p.phone_number}</span>}
              </div>
              {t.note && <p className="text-[10px] italic text-muted-foreground">"{t.note}"</p>}
              {dir === "out" && p?.id && (
                <button
                  disabled={setFrozenOther.isPending}
                  onClick={() => {
                    const next = !p.balance_frozen;
                    if (next) {
                      const r = prompt("এই account freeze করার কারণ (user দেখতে পাবে):",
                        "সন্দেহজনক টাকা লেনদেন — যাচাই চলছে");
                      if (r === null) return;
                      setFrozenOther.mutate({ userId: p.id, frozen: true, reason: r });
                    } else {
                      if (!confirm("এই account-এর ব্যালেন্স আবার চালু করবেন?")) return;
                      setFrozenOther.mutate({ userId: p.id, frozen: false });
                    }
                  }}
                  className={`w-full py-1.5 rounded-lg font-black text-[10px] disabled:opacity-50 ${
                    p.balance_frozen ? "bg-emerald/20 text-emerald" : "bg-sky-500/20 text-sky-400"
                  }`}>
                  {p.balance_frozen ? "✅ এই account unfreeze করুন" : "🧊 এই account-এর ব্যালেন্স freeze করুন"}
                </button>
              )}
              {p?.id && (
                <button
                  disabled={returnTransfer.isPending}
                  onClick={() => {
                    const otherLabel = p.uid_seq != null ? `#${p.uid_seq}` : (p.display_name ?? "other account");
                    const msg = dir === "out"
                      ? `${Math.floor(Number(t.amount))}৳ ${otherLabel}-এর balance থেকে এই user-এর কাছে back করবেন?`
                      : `${Math.floor(Number(t.amount))}৳ এই user-এর balance থেকে ${otherLabel}-এর কাছে back করবেন?`;
                    if (!confirm(`${msg}\n\nশুধু receiver-এর main balance থাকলে ফেরত হবে।`)) return;
                    const note = prompt("Refund/back করার কারণ লিখুন:", "Payment না দেওয়ার অভিযোগ যাচাই করে টাকা ফেরত") ?? "";
                    returnTransfer.mutate({ transferId: t.id, note });
                  }}
                  className="w-full py-1.5 rounded-lg font-black text-[10px] disabled:opacity-50 bg-amber/20 text-amber"
                >
                  {returnTransfer.isPending ? "ফেরত হচ্ছে..." : "↩️ টাকা original sender-এ back দিন"}
                </button>
              )}
            </div>
          );
        };
        return (
          <div className="glass rounded-2xl p-4 space-y-3 border border-rose/30">
            <p className="text-[10px] uppercase tracking-widest text-rose font-black">
              টাকা কোথায় গেছে / কোথা থেকে এসেছে
            </p>
            {out.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-rose">📤 এই user যাদের কাছে পাঠিয়েছে ({out.length})</p>
                {out.map((t) => <Row key={t.id} t={t} dir="out" />)}
              </div>
            )}
            {inn.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-emerald">📥 এই user যাদের কাছ থেকে পেয়েছে ({inn.length})</p>
                {inn.map((t) => <Row key={t.id} t={t} dir="in" />)}
              </div>
            )}
          </div>
        );
      })()}



      {/* Step-by-step reconciliation of bonus + mining */}
      {(data as any).breakdown && (
        <div className="glass rounded-2xl p-4 space-y-3 border border-amber/30">
          <p className="text-[10px] uppercase tracking-widest text-amber font-black">বিস্তারিত হিসাব (চাইলে দেখুন) — বোনাস ও মাইনিং</p>
          {(() => {
            const d = data as any;
            const withdrawn = Number(d.mining?.withdrawn_amount ?? 0);
            const paidWithdrawals = (d.withdrawals ?? [])
              .filter((w: any) => w.status === "paid")
              .reduce((sum: number, w: any) => sum + Number(w.amount), 0);
            const successfulRecharges = (d.recharges ?? [])
              .filter((r: any) => r.status === "success")
              .reduce((sum: number, r: any) => sum + Number(r.amount), 0);
            const transfersOutTotal = (d.transfersOut ?? []).reduce(
              (sum: number, t: any) => sum + Number(t.amount),
              0,
            );
            return (
              <EarningsBreakdown
                adminLinks
                data={d.breakdown}

                totals={{
                  withdrawn,
                  paidWithdrawals,
                  successfulRecharges,
                  transfersOutTotal,
                  feeOrAdjustmentOut: Math.max(
                    0,
                    withdrawn - paidWithdrawals - successfulRecharges - transfersOutTotal,
                  ),
                  balance: Number(d.mining?.accrued_amount ?? 0) - withdrawn,
                }}
              />
            );
          })()}


        </div>
      )}

      {/* Balance history — where the money came from and where it went */}
      <BalanceHistory
        mining={data.mining}
        income={data.income}
        withdrawals={data.withdrawals ?? []}
        debts={data.debts ?? []}
        profile={data.profile}
        breakdown={(data as any).breakdown}
      />

      {/* Bonus Voucher */}
      <div className="glass rounded-2xl p-4 space-y-3 border border-amber/30">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber" />
          <p className="text-[10px] uppercase tracking-widest text-amber font-black">Bonus Voucher পাঠান</p>
        </div>
        <div className="flex gap-2">
          <input
            type="number" inputMode="decimal" value={voucherAmt} onChange={(e) => setVoucherAmt(e.target.value)}
            placeholder="Amount (৳)"
            className="w-28 px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm focus:outline-none focus:border-amber"
          />
          <input
            type="text" value={voucherReason} onChange={(e) => setVoucherReason(e.target.value)}
            placeholder="কারণ (বাধ্যতামূলক)"
            className="flex-1 px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs focus:outline-none focus:border-amber"
          />
        </div>
        <button
          onClick={() => sendVoucher.mutate()}
          disabled={sendVoucher.isPending || !Number(voucherAmt) || voucherReason.trim().length < 3}
          className="w-full py-2 rounded-xl bg-amber/20 text-amber font-black text-xs disabled:opacity-50"
        >
          🎁 ভাউচার পাঠান
        </button>
        <p className="text-[10px] text-muted-foreground">
          ইউজার claim করলে টাকা balance-এ যাবে, আর প্রতিটি ভাউচার হিস্ট্রিতে লেখা থাকবে।
        </p>



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


// ---------- Daily Referral Activity Report ----------
function DailyReportPanel({ userId }: { userId: string }) {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["admin-daily-report", userId],
    queryFn: () => adminUserDailyReport({ data: { userId, days: 60 } }),
    staleTime: 60_000,
  });

  const download = () => {
    if (!data) return;
    const html = buildReportHtml(data);
    const filename = `refer-report-${data.profile?.uid ?? "user"}-${new Date().toISOString().slice(0, 10)}.html`;
    try {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("রিপোর্ট ডাউনলোড হয়েছে — শেয়ার করুন");
    } catch {
      const w = window.open("", "_blank");
      if (!w) { toast.error("Popup blocked"); return; }
      w.document.write(html); w.document.close();
    }
  };

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 border border-violet/25 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-violet" />
        <span className="text-[11px] text-muted-foreground">দৈনিক রিপোর্ট লোড হচ্ছে…</span>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="glass rounded-2xl p-4 border border-rose/30 space-y-2">
        <p className="text-[11px] font-black text-rose">দৈনিক রিপোর্ট লোড হয়নি</p>
        <button onClick={() => refetch()} className="text-[10px] underline text-cyan">আবার চেষ্টা করুন</button>
      </div>
    );
  }

  const today = data.today;

  // Merge today's first-verifies + re-verifies into a per-referee summary
  const todayObj = data.days.find((x: any) => x.date === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }));
  const firstList: any[] = todayObj?.firstVerifies ?? [];
  const reList: any[] = todayObj?.reverifies ?? [];
  const completedIds = new Set<string>((today.completions ?? []).map((c: any) => c.userId));

  type Row = { userId: string; name: string; uid: number; first: number; re: number; completedToday: boolean };
  const map = new Map<string, Row>();
  for (const e of firstList) {
    const r = map.get(e.userId) ?? { userId: e.userId, name: e.name, uid: e.uid, first: 0, re: 0, completedToday: completedIds.has(e.userId) };
    r.first += 1; map.set(e.userId, r);
  }
  for (const e of reList) {
    const r = map.get(e.userId) ?? { userId: e.userId, name: e.name, uid: e.uid, first: 0, re: 0, completedToday: completedIds.has(e.userId) };
    r.re += 1; map.set(e.userId, r);
  }
  const rows = Array.from(map.values()).sort((a, b) => (Number(b.completedToday) - Number(a.completedToday)) || (b.first + b.re) - (a.first + a.re));

  const todayDateBn = new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });

  return (
    <div className="glass rounded-2xl p-4 space-y-3 border border-violet/25">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet" />
            <p className="text-[11px] uppercase tracking-widest text-violet font-black">দৈনিক রিপোর্ট</p>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{todayDateBn}</p>
        </div>
        <button onClick={download}
          className="text-[10px] font-black px-2.5 py-1 rounded-full bg-violet text-white shadow-sm">
          🧾 ডাউনলোড
        </button>
      </div>

      {/* Simple today summary */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-emerald/10 border border-emerald/25 py-2">
          <p className="mono-num font-black text-emerald text-xl leading-none">{today.firstVerifies}</p>
          <p className="text-[10px] text-emerald font-bold mt-1">১ম ভেরিফাই</p>
        </div>
        <div className="rounded-xl bg-cyan/10 border border-cyan/25 py-2">
          <p className="mono-num font-black text-cyan text-xl leading-none">{today.reverifies}</p>
          <p className="text-[10px] text-cyan font-bold mt-1">রি-ভেরিফাই</p>
        </div>
        <div className="rounded-xl bg-amber/10 border border-amber/30 py-2">
          <p className="mono-num font-black text-amber text-xl leading-none">{today.completions.length}</p>
          <p className="text-[10px] text-amber font-bold mt-1">১০/১০ পূর্ণ</p>
        </div>
      </div>

      {/* Per-referee list — one row per user, easy to read */}
      {rows.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 bg-surface-2 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
            <span>রেফারি</span>
            <span className="text-emerald">১ম</span>
            <span className="text-cyan">রি</span>
            <span>স্ট্যাটাস</span>
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.userId} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 items-center">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-navy truncate">{r.name}</p>
                  <p className="text-[10px] text-muted-foreground mono-num">UID {r.uid}</p>
                </div>
                <span className="mono-num font-black text-emerald text-sm text-right w-8">{r.first || "–"}</span>
                <span className="mono-num font-black text-cyan text-sm text-right w-8">{r.re || "–"}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap ${r.completedToday ? "bg-amber/20 text-amber" : "bg-surface-2 text-muted-foreground"}`}>
                  {r.completedToday ? "🎯 ১০/১০" : "চলছে"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center py-3">আজ এখনো কোনো রেফারি ভেরিফাই করেননি।</p>
      )}

      {/* Window totals — compact */}
      <div className="rounded-xl bg-surface-2 border border-border p-2.5">
        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1.5">শেষ {data.windowDays} দিনের মোট</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div><p className="mono-num font-black text-navy">{data.totals.referees}</p><p className="text-[9px] text-muted-foreground">রেফার</p></div>
          <div><p className="mono-num font-black text-emerald">{data.totals.firstVerifies}</p><p className="text-[9px] text-muted-foreground">১ম</p></div>
          <div><p className="mono-num font-black text-cyan">{data.totals.reverifies}</p><p className="text-[9px] text-muted-foreground">রি</p></div>
          <div><p className="mono-num font-black text-amber">{data.totals.completions}</p><p className="text-[9px] text-muted-foreground">১০/১০</p></div>
        </div>
      </div>

      <button onClick={() => refetch()} disabled={isFetching}
        className="w-full text-[10px] text-muted-foreground underline">
        {isFetching ? "রিফ্রেশ হচ্ছে…" : "রিফ্রেশ"}
      </button>
    </div>
  );
}

function buildReportHtml(d: any): string {
  const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
  const maskPhone = (raw: any) => {
    const s = String(raw ?? "").trim();
    if (!s) return "—";
    if (s.length <= 5) return "•".repeat(s.length);
    return s.slice(0, 3) + "•".repeat(Math.max(4, s.length - 5)) + s.slice(-2);
  };
  const genDate = new Date(d.generatedAt).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
  const todayBn = new Date().toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dhaka" });
  const todayObj = d.days.find((x: any) => x.date === todayStr) ?? { firstVerifies: [], reverifies: [], completions: [] };

  type Row = { userId: string; name: string; uid: number; phone: string; firstTotal: number; reTotal: number; firstToday: number; reToday: number; completedToday: boolean; completedAt: string | null };
  const rowMap = new Map<string, Row>();
  for (const r of d.perReferee ?? []) {
    rowMap.set(r.userId ?? `${r.uid}`, {
      userId: r.userId ?? `${r.uid}`, name: r.name, uid: r.uid, phone: r.phone,
      firstTotal: r.firstVerifies ?? 0, reTotal: r.reverifies ?? 0,
      firstToday: 0, reToday: 0, completedToday: false, completedAt: r.completedAt ?? null,
    });
  }
  for (const e of todayObj.firstVerifies ?? []) {
    const key = e.userId ?? `${e.uid}`;
    const row = rowMap.get(key); if (row) row.firstToday += 1;
  }
  for (const e of todayObj.reverifies ?? []) {
    const key = e.userId ?? `${e.uid}`;
    const row = rowMap.get(key); if (row) row.reToday += 1;
  }
  for (const c of todayObj.completions ?? []) {
    const key = c.userId ?? `${c.uid}`;
    const row = rowMap.get(key); if (row) row.completedToday = true;
  }

  const allRows = Array.from(rowMap.values());
  const todayRows = allRows
    .filter((r) => r.firstToday > 0 || r.reToday > 0 || r.completedToday)
    .sort((a, b) => (Number(b.completedToday) - Number(a.completedToday)) || ((b.firstToday + b.reToday) - (a.firstToday + a.reToday)));
  const totalRows = allRows.sort((a, b) => (b.firstTotal + b.reTotal) - (a.firstTotal + a.reTotal));

  const todayTable = todayRows.length
    ? `<table>
        <thead><tr><th>#</th><th>নাম</th><th>UID</th><th>ফোন</th><th>১ম ভেরিফাই</th><th>রি-ভেরিফাই</th><th>স্ট্যাটাস</th></tr></thead>
        <tbody>${todayRows.map((r, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td><b>${esc(r.name)}</b></td>
            <td class="num">${esc(r.uid)}</td>
            <td>${esc(maskPhone(r.phone))}</td>
            <td class="num">${r.firstToday || "—"}</td>
            <td class="num">${r.reToday || "—"}</td>
            <td>${r.completedToday ? `<span class="pill pill-a">🎯 ১০/১০ পূর্ণ</span>` : `<span class="pill pill-c">চলছে</span>`}</td>
          </tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">আজ এখনো কোনো রেফারি ভেরিফাই করেননি।</p>`;

  const totalTable = totalRows.length
    ? `<table>
        <thead><tr><th>#</th><th>নাম</th><th>UID</th><th>ফোন</th><th>মোট ১ম</th><th>মোট রি</th><th>১০/১০ Complete</th></tr></thead>
        <tbody>${totalRows.map((r, i) => `
          <tr>
            <td class="num">${i + 1}</td>
            <td><b>${esc(r.name)}</b></td>
            <td class="num">${esc(r.uid)}</td>
            <td>${esc(maskPhone(r.phone))}</td>
            <td class="num">${r.firstTotal}</td>
            <td class="num">${r.reTotal}</td>
            <td>${r.completedAt ? esc(new Date(r.completedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })) : "—"}</td>
          </tr>`).join("")}</tbody>
      </table>`
    : `<p class="empty">কোনো রেফার নেই।</p>`;

  return `<!doctype html><html><head><meta charset="utf-8" />
<title>Referral Report — ${esc(d.profile.name)} (UID ${esc(d.profile.uid)})</title>
<style>
  body { font-family: 'Noto Sans Bengali', system-ui, sans-serif; color: #111; background: #fff; margin: 0; padding: 28px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 22px 0 10px; padding: 8px 12px; background: #111; color: #fff; border-radius: 6px; }
  .sub { font-size: 11px; color: #666; margin: -4px 0 8px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 14px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0 14px; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px; text-align: center; }
  .card b { display: block; font-size: 20px; }
  .card span { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f4; font-weight: 700; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .num { text-align: right; font-family: 'Courier New', monospace; }
  .pill { font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 700; display: inline-block; }
  .pill-c { background: #cffafe; color: #155e75; }
  .pill-a { background: #fef3c7; color: #92400e; }
  .empty { color: #888; text-align: center; padding: 14px; border: 1px dashed #ddd; border-radius: 6px; font-size: 12px; }
  .actions { position: fixed; top: 12px; right: 12px; }
  .actions button { padding: 8px 14px; font-size: 12px; border: 1px solid #111; border-radius: 6px; background: #111; color: #fff; cursor: pointer; font-weight: 700; }
  @media print { .actions { display: none; } body { padding: 14px; } h2 { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="actions"><button onclick="window.print()">🖨️ প্রিন্ট / PDF সংরক্ষণ</button></div>

<h1>রেফার রিপোর্ট — ${esc(d.profile.name)}</h1>
<div class="meta">
  UID <b>${esc(d.profile.uid)}</b> · রেফার কোড <b>${esc(d.profile.referralCode)}</b> · ফোন ${esc(maskPhone(d.profile.phone))}<br />
  তৈরি: ${esc(genDate)} (Asia/Dhaka)
</div>

<h2>📅 আজকের হিসাব — ${esc(todayBn)}</h2>
<div class="sub">আজ যে রেফারিরা ভেরিফাই করেছেন শুধু তাদের তালিকা।</div>
<div class="summary">
  <div class="card"><b>${todayObj.firstVerifies.length}</b><span>১ম ভেরিফাই</span></div>
  <div class="card"><b>${todayObj.reverifies.length}</b><span>রি-ভেরিফাই</span></div>
  <div class="card"><b>${todayObj.completions.length}</b><span>১০/১০ পূর্ণ</span></div>
  <div class="card"><b>${todayRows.length}</b><span>সক্রিয় রেফারি</span></div>
</div>
${todayTable}

<h2>📊 মোট হিসাব — শেষ ${esc(d.windowDays)} দিন</h2>
<div class="sub">প্রতিটি রেফারির সর্বমোট performance।</div>
<div class="summary">
  <div class="card"><b>${d.totals.referees}</b><span>মোট রেফার</span></div>
  <div class="card"><b>${d.totals.firstVerifies}</b><span>মোট ১ম ভেরিফাই</span></div>
  <div class="card"><b>${d.totals.reverifies}</b><span>মোট রি-ভেরিফাই</span></div>
  <div class="card"><b>${d.totals.completions}</b><span>১০/১০ পূর্ণ</span></div>
</div>
${totalTable}

</body></html>`;
}
