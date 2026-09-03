import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListWithdrawals, adminUpdateWithdrawal, adminBulkMarkPaid, adminListCredits, adminListPaidByAdmins, adminGetRejectProofUrl } from "@/lib/admin.functions";
import { adminGetPayoutSettings, adminSetPayoutSettings, adminSendPayout, adminRefreshPayout } from "@/lib/payout.functions";
import { Loader2, Check, X, Copy, AlertTriangle, ShieldCheck, Gift, ExternalLink, Plus, Minus, UserCheck, ChevronDown, Download, FileSpreadsheet, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";


export const Route = createFileRoute("/admin/withdrawals")({ component: AdminWithdrawals });

type Filter = "pending" | "paid" | "rejected" | "admin" | "paid-by" | "all";

function AdminWithdrawals() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals() });
  const creditsQ = useQuery({ queryKey: ["admin-credits"], queryFn: () => adminListCredits() });
  const paidByQ = useQuery({ queryKey: ["admin-paid-by"], queryFn: () => adminListPaidByAdmins() });
  const [filter, setFilter] = useState<Filter>("pending");
  const [adminName, setAdminName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("admin-paid-by-name") ?? "";
  });
  useEffect(() => { if (adminName) localStorage.setItem("admin-paid-by-name", adminName); }, [adminName]);

  const mut = useMutation({
    mutationFn: (input: { id: string; action: "paid" | "rejected"; paidBy?: string; refundFee?: boolean; rejectReason?: string; proofDataUrl?: string | null }) => adminUpdateWithdrawal({ data: input }),
    onSuccess: (r: any) => {
      if (r?.feeRefunded) toast.success(`Reject — ফি ${r.fee}৳ সহ মোট ${r.refund}৳ ফেরত`);
      else if (r?.refund != null) toast.success(`Reject — ${r.refund}৳ ফেরত (ফি ${r.fee}৳ কাটা)`);
      else toast.success("Updated");
      refetch(); paidByQ.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- অটো পেমেন্ট (iPayBD) ----
  const payoutQ = useQuery({ queryKey: ["admin-payout-settings"], queryFn: () => adminGetPayoutSettings() });
  const payoutSetMut = useMutation({
    mutationFn: (input: { enabled?: boolean; max?: number; kycOnly?: boolean }) => adminSetPayoutSettings({ data: input }),
    onSuccess: () => { toast.success("সেভ হয়েছে"); payoutQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const sendPayoutMut = useMutation({
    mutationFn: (id: string) => adminSendPayout({ data: { id } }),
    onSuccess: (r: any) => { r?.ok ? toast.success(r.message) : toast.error(r?.message ?? "ব্যর্থ"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const refreshPayoutMut = useMutation({
    mutationFn: (id: string) => adminRefreshPayout({ data: { id } }),
    onSuccess: (r: any) => { toast.message(r?.message ?? "—"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });


  // Reject: reason + optional screenshot so the user understands why.
  const [rejectTarget, setRejectTarget] = useState<any | null>(null);
  const rejectWithdrawal = (w: any) => setRejectTarget(w);

  const markPaid = (id: string) => {
    let name = adminName.trim();
    if (!name) {
      let input: string | null = null;
      try { input = window.prompt("আপনার নাম লিখুন (কে paid করছে):", ""); } catch { input = null; }
      if (!input || !input.trim()) {
        toast.error("উপরে আপনার নাম লিখুন — তারপর Mark paid চাপুন");
        const el = document.getElementById("admin-paid-by-input") as HTMLInputElement | null;
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        el?.focus();
        return;
      }
      name = input.trim();
      setAdminName(name);
    }
    mut.mutate({ id, action: "paid", paidBy: name });
  };


  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`${label} কপি হয়েছে`);
  };

  const rows = data ?? [];
  const credits = creditsQ.data ?? [];

  // Bulk selection for batch payout / batch mark-paid.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pendingRows = useMemo(() => rows.filter((w: any) => w.status === "pending"), [rows]);
  const selectedRows = useMemo(() => pendingRows.filter((w: any) => selected.has(w.id)), [pendingRows, selected]);
  const selectedTotal = useMemo(() => selectedRows.reduce((s: number, w: any) => s + Number(w.amount), 0), [selectedRows]);

  const bulkMut = useMutation({
    mutationFn: (input: { ids: string[]; paidBy: string }) => adminBulkMarkPaid({ data: input }),
    onSuccess: (r: any) => {
      toast.success(`${r.marked}/${r.total} টি withdraw paid mark করা হয়েছে`);
      setSelected(new Set());
      refetch(); paidByQ.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelected(new Set(pendingRows.map((w: any) => w.id)));
  const clearSelection = () => setSelected(new Set());

  // ⚡ Fast Pay queue — একটার পর একটা, শুধু PIN দিলেই হবে (personal/agent নম্বর দিয়েই চলবে)
  const [fastMode, setFastMode] = useState(false);
  const fastQueue = useMemo(
    () => pendingRows.filter((w: any) => w.provider !== "usdt"),
    [pendingRows],
  );
  const [fastIdx, setFastIdx] = useState(0);
  const fastRow: any = fastQueue[Math.min(fastIdx, Math.max(fastQueue.length - 1, 0))];
  // Personal/Agent নম্বরে full USSD chain কাজ করে না (session timeout) —
  // তাই শুধু মেনু খুলবে, আর নম্বর/টাকা clipboard-এ থাকবে (paste করলেই হবে)।
  const ussdFor = (w: any) =>
    w.provider === "bkash" ? `tel:${encodeURIComponent("*247#")}` : `tel:${encodeURIComponent("*167#")}`;
  const appIntentFor = (w: any) =>
    w.provider === "bkash"
      ? "intent://#Intent;package=com.bKash.customerapp;end"
      : "intent://#Intent;package=com.konasl.nagad;end";
  const openWalletApp = (w: any) => {
    copy(w.wallet_number, "নম্বর");
    window.location.href = appIntentFor(w);
  };

  const fastPaidNext = () => {
    let name = adminName.trim();
    if (!name) {
      const input = window.prompt("আপনার নাম লিখুন (কে paid করছে):", "");
      if (!input || !input.trim()) { toast.error("আগে আপনার নাম লিখুন"); return; }
      name = input.trim();
      setAdminName(name);
    }
    if (!fastRow) return;
    mut.mutate({ id: fastRow.id, action: "paid", paidBy: name });
    setFastIdx((i) => i + 1);
  };


  const downloadBulkCsv = () => {
    const header = "wallet_number,amount,provider,remarks";
    const lines = selectedRows.map((w: any) => {
      const amount = Math.round(Number(w.amount));
      const remark = `UID${w.profiles?.uid_seq ?? ""} ${w.profiles?.display_name ?? ""}`.trim();
      return `${w.wallet_number},${amount},${w.provider},"${remark}"`;
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulk-payout-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedRows.length} টি এন্ট্রির CSV ডাউনলোড হয়েছে`);
  };

  const copyBulkList = () => {
    const text = selectedRows
      .map((w: any) => `${w.wallet_number}  ${Math.round(Number(w.amount))}৳  ${w.provider.toUpperCase()}  UID${w.profiles?.uid_seq ?? ""}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success(`${selectedRows.length} টির লিস্ট কপি হয়েছে`);
  };

  const bulkMarkPaid = () => {
    let name = adminName.trim();
    if (!name) {
      const input = window.prompt("আপনার নাম লিখুন (কে paid করছে):", "");
      if (!input || !input.trim()) {
        toast.error("উপরে আপনার নাম লিখুন — তারপর Bulk paid চাপুন");
        return;
      }
      name = input.trim();
      setAdminName(name);
    }
    if (selectedRows.length === 0) return;
    if (!window.confirm(`${selectedRows.length} টি withdraw (মোট ${Math.round(selectedTotal)}৳) paid mark করবেন?`)) return;
    bulkMut.mutate({ ids: Array.from(selected), paidBy: name });
  };

  const counts = useMemo(() => ({
    pending: rows.filter((w: any) => w.status === "pending").length,
    paid: rows.filter((w: any) => w.status === "paid").length,
    rejected: rows.filter((w: any) => w.status === "rejected").length,
    admin: credits.length,
    all: rows.length,
  }), [rows, credits]);

  const adminCreditSum = useMemo(() =>
    credits.reduce((a: number, c: any) => a + Number(c.amount), 0),
  [credits]);

  const filtered = rows.filter((w: any) => {
    if (filter === "all") return true;
    if (filter === "admin") return false; // credits rendered separately
    return w.status === filter;
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  const Tab = ({ id, label, count, tone }: { id: Filter; label: string; count: number; tone: string }) => (
    <button
      onClick={() => setFilter(id)}
      className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap border transition ${
        filter === id ? `${tone} border-transparent` : "bg-white/5 border-white/10 text-muted-foreground"
      }`}
    >
      {label} <span className="ml-1 opacity-80">({count})</span>
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-2.5 border border-cyan/25 bg-cyan/5 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-cyan shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-cyan">আপনার নাম (Mark paid এর সময় ব্যবহার হবে)</p>
          <input
            id="admin-paid-by-input"
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="যেমন: Rafi / Anamul"
            className={`w-full mt-0.5 px-2 py-1 rounded bg-background/60 border text-xs outline-none focus:border-cyan ${adminName.trim() ? "border-white/10" : "border-rose animate-pulse"}`}
          />
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <Tab id="pending" label="⏳ Pending" count={counts.pending} tone="bg-amber/20 text-amber" />
        <Tab id="paid" label="✅ Paid" count={counts.paid} tone="bg-emerald/20 text-emerald" />
        <Tab id="paid-by" label="👤 Paid-by admin" count={(paidByQ.data ?? []).length} tone="bg-cyan/20 text-cyan" />
        <Tab id="admin" label="🎁 Admin Payout" count={counts.admin} tone="bg-fuchsia-500/20 text-fuchsia-300" />
        <Tab id="rejected" label="❌ Rejected" count={counts.rejected} tone="bg-rose/20 text-rose" />
        <Tab id="all" label="All" count={counts.all} tone="bg-cyan/20 text-cyan" />
      </div>

      {/* 🤖 অটো পেমেন্ট (iPayBD) সেটিংস */}
      <div className="glass rounded-xl p-3 border border-cyan/25 bg-cyan/5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-black text-cyan flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> অটো পেমেন্ট (iPayBD)</p>
            <p className="text-[10px] text-muted-foreground">
              {payoutQ.data?.configured ? "API key সেট আছে ✅" : "API key সেট নেই ❌"} · রিকোয়েস্ট এলে নিজেই bKash/Nagad-এ টাকা পাঠাবে
            </p>
          </div>
          <button
            onClick={() => payoutSetMut.mutate({ enabled: !(payoutQ.data?.enabled ?? false) })}
            disabled={payoutSetMut.isPending}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black shrink-0 ${payoutQ.data?.enabled ? "bg-emerald/25 text-emerald" : "bg-white/10 text-muted-foreground"}`}>
            {payoutQ.data?.enabled ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex gap-2 items-end">
          <label className="flex-1">
            <span className="text-[10px] font-bold text-muted-foreground">অটো পে সর্বোচ্চ (৳)</span>
            <input
              type="number"
              defaultValue={payoutQ.data?.max ?? 300}
              key={payoutQ.data?.max}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v !== payoutQ.data?.max) payoutSetMut.mutate({ max: v });
              }}
              className="w-full mt-0.5 px-2 py-1 rounded bg-background/60 border border-white/10 text-xs outline-none focus:border-cyan mono-num"
            />
          </label>
          <button
            onClick={() => payoutSetMut.mutate({ kycOnly: !(payoutQ.data?.kycOnly ?? true) })}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black ${payoutQ.data?.kycOnly ? "bg-cyan/20 text-cyan" : "bg-white/10 text-muted-foreground"}`}>
            শুধু KYC verified: {payoutQ.data?.kycOnly ? "হ্যাঁ" : "না"}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          এর বেশি অ্যামাউন্ট বা USDT হলে আপনি ম্যানুয়ালি দিবেন। Webhook URL: <span className="mono-num break-all">{payoutQ.data?.webhookUrl}</span>
        </p>
      </div>



      {/* ⚡ Fast Pay — personal/agent নম্বর দিয়েই এক এক করে PIN দিয়ে পেমেন্ট */}
      {filter === "pending" && fastQueue.length > 0 && (
        <div className="glass rounded-xl p-3 border-2 border-emerald/40 bg-emerald/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-black text-emerald">⚡ ফাস্ট পে (শুধু PIN দিলেই হবে)</p>
              <p className="text-[10px] text-muted-foreground">
                Personal বা Agent নম্বর দিয়েই চলবে · বাকি {Math.max(fastQueue.length - fastIdx, 0)}টি
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setFastMode((v) => !v); setFastIdx(0); }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black shrink-0 ${fastMode ? "bg-white/10" : "bg-emerald text-background"}`}
            >
              {fastMode ? "বন্ধ করুন" : "শুরু করুন"}
            </button>
          </div>

          {fastMode && (
            fastIdx >= fastQueue.length || !fastRow ? (
              <p className="text-center text-[11px] font-black text-emerald py-3">🎉 সব পেমেন্ট শেষ!</p>
            ) : (
              <div className="rounded-xl bg-background/60 border border-emerald/30 p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  {fastIdx + 1} / {fastQueue.length} ·{" "}
                  {fastRow.profiles?.display_name ?? fastRow.profiles?.email}
                  {fastRow.profiles?.uid_seq != null && ` · #${fastRow.profiles.uid_seq}`}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${fastRow.provider === "bkash" ? "bg-rose text-white" : "bg-amber text-background"}`}>
                    {fastRow.provider === "bkash" ? "বিকাশ" : "নগদ"}
                  </span>
                  <span className="mono-num font-black text-lg">{fastRow.wallet_number}</span>
                  <span className="mono-num font-black text-lg text-emerald">{Math.round(Number(fastRow.amount))}৳</span>
                </div>
                <button
                  type="button"
                  onClick={() => openWalletApp(fastRow)}
                  className="w-full block py-3 rounded-xl bg-emerald text-background text-center font-black text-sm"
                >
                  📲 {fastRow.provider === "bkash" ? "বিকাশ" : "নগদ"} অ্যাপ খুলুন (নম্বর কপি হয়ে যাবে)
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(fastRow.wallet_number, "নম্বর")}
                    className="py-2 rounded-lg bg-white/10 text-[10px] font-bold"
                  >
                    নম্বর কপি
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(String(Math.round(Number(fastRow.amount))), "অ্যামাউন্ট")}
                    className="py-2 rounded-lg bg-white/10 text-[10px] font-bold"
                  >
                    অ্যামাউন্ট কপি
                  </button>
                </div>
                <a
                  href={ussdFor(fastRow)}
                  className="block py-2 rounded-lg bg-white/10 text-center text-[10px] font-bold"
                >
                  📞 {fastRow.provider === "bkash" ? "*247#" : "*167#"} মেনু খুলুন (অ্যাপ না থাকলে)
                </a>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={fastPaidNext}
                    disabled={mut.isPending}
                    className="col-span-2 py-2.5 rounded-xl bg-cyan/20 text-cyan font-black text-[12px] flex items-center justify-center gap-1"
                  >
                    {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    ✅ Paid — পরেরটা
                  </button>
                  <button
                    type="button"
                    onClick={() => setFastIdx((i) => i + 1)}
                    className="py-2.5 rounded-xl bg-white/10 font-black text-[11px]"
                  >
                    স্কিপ ▶
                  </button>
                </div>
              </div>
            )
          )}

          <p className="text-[9px] text-muted-foreground leading-relaxed">
            💡 Personal/Agent নম্বরে USSD-তে নম্বর+টাকা একসাথে দিলে "Session timeout" আসে — তাই এখন অ্যাপ খুলবে আর নম্বর clipboard-এ কপি হয়ে যাবে, Send Money-তে paste করে টাকা লিখে PIN দিন। ফিরে এসে "Paid — পরেরটা" চাপুন।
          </p>

        </div>
      )}

      {/* Bulk payout panel (ঐচ্ছিক) — only on pending tab */}
      {filter === "pending" && pendingRows.length > 0 && (

        <div className="glass rounded-xl p-3 border-2 border-cyan/30 bg-cyan/5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-cyan">⚡ বাল্ক পেমেন্ট / Bulk payout</p>
              <p className="text-[10px] text-muted-foreground">
                {selectedRows.length} টি সিলেক্ট · মোট{" "}
                <span className="mono-num font-bold text-cyan">{Math.round(selectedTotal)}৳</span>
                {" "}(Pending মোট {pendingRows.length}টি · {Math.round(pendingRows.reduce((s: number, w: any) => s + Number(w.amount), 0))}৳)
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={selectAll}
                className="px-2 py-1 rounded-lg bg-white/10 text-[10px] font-bold"
              >
                সব সিলেক্ট
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="px-2 py-1 rounded-lg bg-white/10 text-[10px] font-bold"
              >
                ক্লিয়ার
              </button>
            </div>
          </div>

          {selectedRows.length > 0 && (
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={downloadBulkCsv}
                className="py-2 rounded-lg bg-emerald/15 text-emerald font-black text-[11px] flex items-center justify-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> CSV ডাউনলোড
              </button>
              <button
                type="button"
                onClick={copyBulkList}
                className="py-2 rounded-lg bg-white/10 font-black text-[11px] flex items-center justify-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" /> লিস্ট কপি
              </button>
              <button
                type="button"
                onClick={bulkMarkPaid}
                disabled={bulkMut.isPending}
                className="col-span-2 py-2 rounded-lg bg-cyan/20 text-cyan font-black text-[11px] flex items-center justify-center gap-1"
              >
                {bulkMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                সিলেক্ট করা {selectedRows.length}টি Paid Mark করুন
              </button>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground leading-relaxed">
            💡 CSV শুধু merchant portal থাকলে দরকার — না থাকলে উপরের ⚡ ফাস্ট পে ব্যবহার করুন।
          </p>

        </div>
      )}

      {filter === "paid-by" && <PaidByPanel data={paidByQ.data ?? []} loading={paidByQ.isLoading} />}


      {filter === "admin" && (
        <>
          <div className="glass rounded-xl p-3 border border-fuchsia-500/30 bg-fuchsia-500/5">
            <div className="flex items-center gap-2 text-fuchsia-300">
              <Gift className="w-4 h-4" />
              <p className="text-xs font-bold">Admin থেকে user-কে দেওয়া balance</p>
            </div>
            <p className="mono-num font-black text-2xl mt-1">{adminCreditSum.toFixed(2)} ৳</p>
            <p className="text-[10px] text-muted-foreground">{counts.admin} ক্রেডিট এন্ট্রি (Adjust Balance থেকে)</p>
          </div>

          <div className="space-y-2">
            {credits.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">
                এখনো কোনো admin credit নেই। User details → Adjust Balance দিয়ে balance দিলে এখানে দেখাবে।
              </p>
            )}
            {credits.map((c: any) => {
              const isCredit = Number(c.amount) >= 0;
              return (
                <div key={c.id} className={`glass rounded-xl p-3 space-y-1.5 border-2 ${isCredit ? "border-emerald/40 bg-emerald/5" : "border-rose/40 bg-rose/5"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className={`mono-num font-black text-lg ${isCredit ? "text-emerald" : "text-rose"}`}>
                        {isCredit ? "+" : ""}{Number(c.amount).toFixed(2)} TK
                      </p>
                      <Link
                        to="/admin/user/$userId"
                        params={{ userId: c.user_id }}
                        className="text-[11px] font-bold truncate inline-flex items-center gap-1 hover:text-cyan"
                      >
                        {c.profiles?.display_name ?? "User"}
                        {c.profiles?.uid_seq != null && (
                          <span className="mono-num text-muted-foreground">· #{c.profiles.uid_seq}</span>
                        )}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </Link>
                      {c.profiles?.phone_number && (
                        <p className="text-[10px] text-muted-foreground mono-num">{c.profiles.phone_number}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isCredit ? "bg-emerald text-background" : "bg-rose text-white"}`}>
                      {isCredit ? <><Plus className="w-2.5 h-2.5 inline" /> CREDIT</> : <><Minus className="w-2.5 h-2.5 inline" /> DEBIT</>}
                    </span>
                  </div>
                  {c.note && (
                    <p className="text-[10px] text-muted-foreground italic bg-white/5 rounded px-2 py-1">📝 {c.note}</p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {filter !== "admin" && filter !== "paid-by" && (
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">No records</p>}
        {filtered.map((w: any) => {
          const isBkash = w.provider === "bkash";
          const isUsdt = w.provider === "usdt";
          const isAdminPayout = w.isAdminPayout;
          const s = w.signals;
          const cleanNote = isAdminPayout && w.admin_note ? w.admin_note.replace(/^\[Admin Payout\]\s*/, "") : w.admin_note;

          // Real fraud signals only — normal states (balance=0 after withdraw, mining paused, first withdraw) are NOT suspicious
          const dangerFlags: { icon: string; text: string; reason: string }[] = [];
          const infoFlags: { icon: string; text: string }[] = [];
          if (s) {
            // Total lifetime withdraw request (paid + this pending)
            const totalRequested = s.prevPaidSum + Number(w.amount);
            const legitIncome = Number(s.incomeBreakdown?.legitIncomeTotal ?? s.accrued);
            const earningGap = totalRequested - legitIncome;

            if (s.activeDebt > 0) dangerFlags.push({ icon: "⚠️", text: `Debt ${s.activeDebt.toFixed(0)}৳`, reason: "আগের ওয়ার্নিং পরিশোধ করেনি" });
            // ১০টা first verify শেষ করা user-এর wallet whitelist হারানো একেবারে
            // স্বাভাবিক — তখনই তো re-verify চাওয়া হয়। তাই সেটা আর সন্দেহ নয়,
            // শুধু তথ্য। ১০টা complete না করে whitelist নাই থাকলে সন্দেহ।
            if (s.notWhitelistedTasks > 0) {
              if (s.verifiedTasks >= 10) infoFlags.push({ icon: "🟡", text: `${s.notWhitelistedTasks} slot re-verify দরকার` });
              else dangerFlags.push({ icon: "🔴", text: `${s.notWhitelistedTasks} not-whitelist wallet`, reason: "১০টা verify complete হয়নি অথচ wallet whitelist নাই — fake identity সন্দেহ" });
            }
            // Only flag "verify only" if requested amount is NOT covered by real income sources
            // (mining accrued + referral bonuses + admin credits + transfers in + vouchers).
            if (s.verifiedTasks < 10 && legitIncome < totalRequested * 0.9) {
              dangerFlags.push({ icon: "⚠️", text: `${s.verifiedTasks}/10 verify only`, reason: `১০টা slot এখনো complete করেনি এবং আয়ের উৎসও যথেষ্ট না (income ${legitIncome.toFixed(0)}৳ vs চাওয়া ${totalRequested.toFixed(0)}৳)` });
            }
            if (earningGap > 50) dangerFlags.push({ icon: "🚨", text: `Overdraw ${earningGap.toFixed(0)}৳`, reason: `মোট legit আয় ${legitIncome.toFixed(0)}৳ কিন্তু withdraw চাইছে ${totalRequested.toFixed(0)}৳` });
            if (s.failedAttempts > 50) dangerFlags.push({ icon: "🕵️", text: `${s.failedAttempts} failed attempts`, reason: "অনেক failed face attempt — bot-like আচরণ" });

            // Info only (not fraud, just context)
            if (!s.miningActive) infoFlags.push({ icon: "⏸️", text: "Mining off" });
            if (s.prevPaidCount === 0) infoFlags.push({ icon: "🆕", text: "First withdraw" });
            if (s.reverifyCount > 0) infoFlags.push({ icon: "🔁", text: `${s.reverifyCount} re-verify` });
            if (s.referralPaidCount > 0) infoFlags.push({ icon: "🎁", text: `${s.referralPaidCount} referral bonus (${Number(s.referralBonusTotal ?? 0).toFixed(0)}৳)` });
          }
          const isLegit = dangerFlags.length === 0;
          const hasDanger = !isLegit;

          return (
            <div key={w.id} className={`glass rounded-xl p-3 space-y-2 ${
              isAdminPayout ? "border-2 border-fuchsia-500/40 bg-fuchsia-500/5" :
              hasDanger ? "border-2 border-rose/40" : ""
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {isUsdt ? (
                    <div>
                      <p className="mono-num font-black text-lg text-emerald" translate="no">
                        {Number(w.usdtAmount ?? Number(w.amount) / (Number(w.usdtRateBdt) || 130)).toFixed(2)} USDT
                      </p>
                      <p className="mono-num text-[10px] text-muted-foreground">
                        = {Number(w.amount).toFixed(2)} TK · রেট {Number(w.usdtRateBdt ?? 130)}৳
                      </p>
                    </div>
                  ) : (
                    <p className="mono-num font-black text-lg">{Number(w.amount).toFixed(2)} TK</p>
                  )}
                  <Link
                    to="/admin/user/$userId"
                    params={{ userId: w.user_id }}
                    className="text-[11px] font-bold truncate inline-flex items-center gap-1 hover:text-cyan"
                  >
                    {w.profiles?.display_name ?? w.profiles?.email}
                    {w.profiles?.uid_seq != null && (
                      <span className="mono-num text-muted-foreground">· #{w.profiles.uid_seq}</span>
                    )}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Link>
                  {w.profiles?.phone_number && (
                    <button
                      type="button"
                      onClick={() => copy(w.profiles.phone_number, "User number")}
                      className="block text-[10px] text-muted-foreground mono-num inline-flex items-center gap-1 hover:text-cyan">
                      User: {w.profiles.phone_number} <Copy className="w-2.5 h-2.5" />
                    </button>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(w.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {w.status === "pending" && (
                    <label className="flex items-center gap-1 text-[10px] font-bold text-cyan cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(w.id)}
                        onChange={() => toggleSelect(w.id)}
                        className="w-4 h-4 accent-cyan rounded"
                      />
                      সিলেক্ট
                    </label>
                  )}
                  {isAdminPayout && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-fuchsia-500 text-white">🎁 ADMIN</span>
                  )}
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
                    w.status === "paid" ? "bg-emerald/15 text-emerald" :
                    w.status === "rejected" ? "bg-rose/15 text-rose" :
                    "bg-amber/15 text-amber"
                  }`}>{w.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Verdict for pending */}
              {w.status === "pending" && s && (
                <div className={`rounded-lg p-2 space-y-1.5 ${hasDanger ? "bg-rose/10 border border-rose/30" : "bg-emerald/10 border border-emerald/30"}`}>
                  <div className="flex items-center gap-1.5 text-[11px] font-black">
                    {hasDanger ? (
                      <><AlertTriangle className="w-3.5 h-3.5 text-rose" /><span className="text-rose">⚠️ সন্দেহজনক — চেক করুন</span></>
                    ) : (
                      <><ShieldCheck className="w-3.5 h-3.5 text-emerald" /><span className="text-emerald">✅ LEGIT — নিরাপদে paid করতে পারেন</span></>
                    )}
                  </div>

                  {hasDanger && (
                    <ul className="space-y-1 text-[10px] pt-1 border-t border-rose/20">
                      {dangerFlags.map((f, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span>{f.icon}</span>
                          <div>
                            <span className="font-black text-rose">{f.text}</span>
                            <span className="text-muted-foreground"> — {f.reason}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] pt-1 border-t border-white/5">
                    <div>✅ Verify: <span className="mono-num font-bold">{s.verifiedTasks}/10</span></div>
                    <div>💰 Earned: <span className="mono-num font-bold">{s.accrued.toFixed(0)}৳</span></div>
                    <div>📤 Prev paid: <span className="mono-num font-bold">{s.prevPaidCount} ({s.prevPaidSum.toFixed(0)}৳)</span></div>
                    <div>🏦 Balance: <span className="mono-num font-bold">{s.balance.toFixed(0)}৳</span></div>
                  </div>

                  {/* 💵 Balance source breakdown — কোন কোন উৎস থেকে টাকা এসেছে */}
                  {s.incomeBreakdown && (
                    <div className="pt-1.5 border-t border-white/5 space-y-0.5">
                      <p className="text-[10px] font-black text-amber">💵 ব্যালেন্স যেভাবে এসেছে</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                        {Number(s.incomeBreakdown.miningAccrued) > 0 && (
                          <div>⛏️ Mining: <span className="mono-num font-bold">{Number(s.incomeBreakdown.miningAccrued).toFixed(0)}৳</span></div>
                        )}
                        {Number(s.incomeBreakdown.bonusTotal) > 0 && (
                          <div>🎁 Bonus (verify+refer): <span className="mono-num font-bold">{Number(s.incomeBreakdown.bonusTotal).toFixed(0)}৳</span></div>
                        )}
                        {Number(s.incomeBreakdown.vouchersTotal) > 0 && (
                          <div>🎫 Voucher: <span className="mono-num font-bold">{Number(s.incomeBreakdown.vouchersTotal).toFixed(0)}৳</span></div>
                        )}
                        {Number(s.incomeBreakdown.adminCreditsTotal) !== 0 && (
                          <div>🛠 Admin credit: <span className="mono-num font-bold">{Number(s.incomeBreakdown.adminCreditsTotal).toFixed(0)}৳</span></div>
                        )}
                        {Number(s.incomeBreakdown.transfersInTotal) > 0 && (
                          <div>📥 Transfer in: <span className="mono-num font-bold">{Number(s.incomeBreakdown.transfersInTotal).toFixed(0)}৳</span></div>
                        )}
                      </div>
                      <p className="text-[10px] text-emerald font-black pt-0.5">
                        মোট legit আয়: <span className="mono-num">{Number(s.incomeBreakdown.legitIncomeTotal).toFixed(0)}৳</span>
                      </p>
                    </div>
                  )}


                  {Array.isArray(s.referralBonuses) && s.referralBonuses.length > 0 && (
                    <div className="pt-1.5 border-t border-white/5 space-y-1">
                      <p className="text-[10px] font-black text-cyan">
                        🎁 রেফার থেকে আয়: {s.referralPaidCount}/{s.referralBonuses.length} qualified · {Number(s.referralBonusTotal ?? 0).toFixed(0)}৳
                      </p>
                      <ul className="space-y-0.5 text-[10px] max-h-40 overflow-y-auto">
                        {s.referralBonuses.map((r: any) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 rounded px-1.5 py-0.5 bg-white/5">
                            <div className="min-w-0 flex-1 truncate">
                              <span className={r.bonusPaid ? "font-bold text-emerald" : "text-muted-foreground"}>
                                {r.bonusPaid ? "✅" : "⏳"} {r.name}
                              </span>
                              {r.uid != null && <span className="mono-num text-muted-foreground"> · #{r.uid}</span>}
                              <span className="mono-num text-muted-foreground"> · {r.phone}</span>
                            </div>
                            <div className="shrink-0 flex items-center gap-1.5">
                              <span className={`mono-num text-[9px] ${r.qualified ? "text-emerald" : "text-amber"}`}>{r.firstVerifies}/10</span>
                              {r.bonusPaid && <span className="mono-num font-black text-cyan">+{r.bonusAmount}৳</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {infoFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                      {infoFlags.map((f, i) => (
                        <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">
                          {f.icon} {f.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Big prominent payout number */}
              <button
                type="button"
                onClick={() => copy(w.wallet_number, isUsdt ? "USDT address" : isBkash ? "বিকাশ নম্বর" : "নগদ নম্বর")}
                className={`w-full rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 border-2 transition active:scale-[0.98] ${
                  isUsdt
                    ? "bg-emerald/10 border-emerald/40 hover:border-emerald"
                    : isBkash
                    ? "bg-rose/10 border-rose/40 hover:border-rose"
                    : "bg-amber/10 border-amber/40 hover:border-amber"
                }`}>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${
                    isUsdt ? "bg-emerald text-white" : isBkash ? "bg-rose text-white" : "bg-amber text-background"
                  }`}>
                    {isUsdt ? "USDT · Celo" : isBkash ? "বিকাশ" : "নগদ"}
                  </span>
                  <span className={`mono-num font-black tracking-wider truncate ${isUsdt ? "text-[11px] break-all" : "text-base"}`}>{w.wallet_number}</span>
                </div>
                <Copy className={`w-4 h-4 shrink-0 ${isUsdt ? "text-emerald" : isBkash ? "text-rose" : "text-amber"}`} />
              </button>

              {/* ⚡ সেমি-অটো পে — অ্যাপ খুলবে, নম্বর clipboard-এ কপি হবে */}
              {w.status === "pending" && !isUsdt && (
                <div className="rounded-xl border-2 border-cyan/30 bg-cyan/5 p-2 space-y-1.5">
                  <p className="text-[10px] font-black text-cyan">⚡ দ্রুত পে করুন (নম্বর কপি + অ্যাপ)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => openWalletApp(w)}
                      className={`py-2 rounded-lg text-center font-black text-[11px] ${isBkash ? "bg-rose/20 text-rose" : "bg-amber/20 text-amber"}`}
                    >
                      📲 {isBkash ? "বিকাশ" : "নগদ"} অ্যাপ + নম্বর কপি
                    </button>
                    <a
                      href={isBkash ? `tel:${encodeURIComponent("*247#")}` : `tel:${encodeURIComponent("*167#")}`}
                      className="py-2 rounded-lg text-center font-black text-[11px] bg-white/10"
                    >
                      📞 {isBkash ? "*247#" : "*167#"} মেনু
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => copy(w.wallet_number, "নম্বর")}
                      className="py-1.5 rounded-lg bg-white/5 text-[10px] font-bold"
                    >
                      নম্বর কপি
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(String(Math.round(Number(w.amount))), "অ্যামাউন্ট")}
                      className="py-1.5 rounded-lg bg-white/5 text-[10px] font-bold"
                    >
                      অ্যামাউন্ট কপি ({Math.round(Number(w.amount))}৳)
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground">টাকা পাঠানো হলে নিচে "Mark paid" চাপুন ✅</p>
                </div>
              )}

              {cleanNote && (

                <p className="text-[10px] text-muted-foreground italic bg-white/5 rounded px-2 py-1">
                  📝 {cleanNote}
                </p>
              )}

              {w.status === "rejected" && (w.reject_reason || w.reject_proof_path) && (
                <AdminRejectInfo w={w} />
              )}

              {(w.payout_status || w.payout_trxid) && (
                <div className="rounded-lg border border-cyan/25 bg-cyan/5 p-2 text-[10px] space-y-0.5">
                  <p className="font-black text-cyan">
                    🤖 অটো পেমেন্ট: {w.payout_status === "success" ? "✅ সফল" : w.payout_status === "sent" ? "⏳ পাঠানো হয়েছে" : w.payout_status === "sending" ? "⏳ পাঠানো হচ্ছে" : w.payout_status === "rejected" ? "❌ ফেল" : w.payout_status}
                  </p>
                  {w.payout_trxid && <p className="mono-num">TrxID: {w.payout_trxid}</p>}
                  {w.payout_message && <p className="text-muted-foreground">{w.payout_message}</p>}
                </div>
              )}

              {w.status === "pending" && (
                <div className="space-y-2">
                  {w.provider !== "usdt" && payoutQ.data?.configured && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => sendPayoutMut.mutate(w.id)}
                        disabled={sendPayoutMut.isPending}
                        className="flex-1 py-2 rounded-lg bg-cyan/20 text-cyan font-bold text-xs flex items-center justify-center gap-1 disabled:opacity-50">
                        <Zap className="w-3.5 h-3.5" /> অটো পে (iPayBD)
                      </button>
                      {w.payout_trxid && (
                        <button
                          onClick={() => refreshPayoutMut.mutate(w.id)}
                          disabled={refreshPayoutMut.isPending}
                          className="px-3 py-2 rounded-lg bg-white/10 text-xs font-bold flex items-center gap-1 disabled:opacity-50">
                          <RefreshCw className="w-3.5 h-3.5" /> স্ট্যাটাস
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => markPaid(w.id)}
                      className="flex-1 py-2 rounded-lg bg-emerald/20 text-emerald font-bold text-xs flex items-center justify-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Mark paid
                    </button>
                    <button onClick={() => rejectWithdrawal(w)}
                      className="flex-1 py-2 rounded-lg bg-rose/20 text-rose font-bold text-xs flex items-center justify-center gap-1">
                      <X className="w-3.5 h-3.5" /> Reject (refund)
                    </button>
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>
      )}

      {rejectTarget && (
        <RejectDialog
          w={rejectTarget}
          busy={mut.isPending}
          onClose={() => setRejectTarget(null)}
          onSubmit={(payload) => {
            mut.mutate(
              { id: rejectTarget.id, action: "rejected", ...payload },
              { onSuccess: () => setRejectTarget(null) },
            );
          }}
        />
      )}
    </div>
  );
}

// ---------- Reject dialog: reason + screenshot ----------
function RejectDialog({ w, busy, onClose, onSubmit }: {
  w: any;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: { rejectReason: string; refundFee: boolean; proofDataUrl?: string | null }) => void;
}) {
  const [reason, setReason] = useState("");
  const [refundFee, setRefundFee] = useState(true);
  const [proof, setProof] = useState<string | null>(null);

  const pickFile = (f: File | null) => {
    if (!f) { setProof(null); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error("ছবি ৫MB এর কম হতে হবে"); return; }
    const reader = new FileReader();
    reader.onload = () => setProof(String(reader.result));
    reader.readAsDataURL(f);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-md glass rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <p className="font-black text-sm text-rose">❌ Withdraw reject — {Math.floor(Number(w.amount))}৳</p>
        <p className="text-[11px] text-muted-foreground">
          কারণটা user তার withdraw history-তে দেখতে পাবে। চাইলে screenshot দিন।
        </p>

        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="যেমন: আপনার নগদ নম্বরটি ভুল / নম্বর বন্ধ — সঠিক নম্বর দিয়ে আবার request দিন"
          className="w-full px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs outline-none focus:border-rose"
        />

        <label className="block text-[11px] font-bold">
          📷 Screenshot (optional)
          <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-[11px]" />
        </label>
        {proof && <img src={proof} alt="proof" className="max-h-40 rounded-lg border border-border object-contain" />}

        <label className="flex items-center gap-2 text-[11px] font-bold">
          <input type="checkbox" checked={refundFee} onChange={(e) => setRefundFee(e.target.checked)} />
          ফি টাও ফেরত দিন (ফেরত টাকা legal earn হিসেবেই থাকবে, admin-add নয়)
        </label>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface-2 font-bold text-xs">বাতিল</button>
          <button
            disabled={busy || reason.trim().length < 3}
            onClick={() => onSubmit({ rejectReason: reason.trim(), refundFee, proofDataUrl: proof })}
            className="flex-1 py-2.5 rounded-xl bg-rose text-white font-black text-xs disabled:opacity-50 flex items-center justify-center gap-1">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Reject + refund
          </button>
        </div>
      </div>
    </div>
  );
}

// Rejection reason + screenshot shown back to the admin.
function AdminRejectInfo({ w }: { w: any }) {
  const proofQ = useQuery({
    queryKey: ["admin-reject-proof", w.id],
    queryFn: () => adminGetRejectProofUrl({ data: { path: w.reject_proof_path } }),
    enabled: !!w.reject_proof_path,
    staleTime: 10 * 60 * 1000,
  });
  const url = (proofQ.data as any)?.url ?? null;
  return (
    <div className="rounded-lg bg-rose/10 border border-rose/30 p-2 text-[11px] text-rose space-y-1">
      {w.reject_reason && <p className="whitespace-pre-wrap">🗒 {w.reject_reason}</p>}
      {w.fee_refunded && <p className="text-[10px] text-emerald font-bold">✅ ফি সহ ফেরত</p>}
      {url && <img src={url} alt="reject proof" className="max-h-32 rounded-lg object-contain border border-rose/40" />}
    </div>
  );
}

// ---------- Payout report: কোন তারিখে কোন admin কাকে কত টাকা paid করেছে ----------
type PayEntry = {
  id: string;
  admin: string;
  amount: number;
  processed_at: string;
  provider: string;
  wallet_number: string;
  user_name: string;
  uid: number | null;
  user_id: string;
};

const dayKeyOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const bnDate = (key: string) =>
  new Date(key + "T00:00:00").toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
const todayKey = () => dayKeyOf(new Date().toISOString());

function PaidByPanel({ data, loading }: { data: any[]; loading: boolean }) {
  const [view, setView] = useState<"date" | "admin">("date");
  const [range, setRange] = useState<"today" | "7" | "30" | "all">("7");
  const [q, setQ] = useState("");
  const [openDay, setOpenDay] = useState<string | null>(todayKey());
  const [openAdmin, setOpenAdmin] = useState<string | null>(null);
  const [openDayAdmin, setOpenDayAdmin] = useState<string | null>(null);

  // ফ্ল্যাট লিস্ট — প্রতিটি paid withdrawal একটি এন্ট্রি
  const all: PayEntry[] = useMemo(() => {
    const out: PayEntry[] = [];
    for (const a of data ?? []) {
      for (const e of a.entries ?? []) {
        if (!e.processed_at) continue;
        out.push({
          id: e.id,
          admin: a.name,
          amount: Number(e.amount) || 0,
          processed_at: e.processed_at,
          provider: String(e.provider ?? ""),
          wallet_number: e.wallet_number ?? "",
          user_name: e.user_name ?? "User",
          uid: e.uid ?? null,
          user_id: e.user_id,
        });
      }
    }
    return out.sort((x, y) => (x.processed_at < y.processed_at ? 1 : -1));
  }, [data]);

  const entries = useMemo(() => {
    const now = Date.now();
    const days = range === "today" ? 0 : range === "7" ? 7 : range === "30" ? 30 : null;
    const s = q.trim().toLowerCase();
    return all.filter((e) => {
      if (days !== null) {
        if (days === 0) { if (dayKeyOf(e.processed_at) !== todayKey()) return false; }
        else if (now - new Date(e.processed_at).getTime() > days * 864e5) return false;
      }
      if (!s) return true;
      return (
        e.admin.toLowerCase().includes(s) ||
        e.user_name.toLowerCase().includes(s) ||
        String(e.uid ?? "").includes(s) ||
        e.wallet_number.includes(s)
      );
    });
  }, [all, range, q]);

  const grand = useMemo(() => entries.reduce((s, e) => s + e.amount, 0), [entries]);
  const adminCount = useMemo(() => new Set(entries.map((e) => e.admin)).size, [entries]);
  const todayTotal = useMemo(
    () => all.filter((e) => dayKeyOf(e.processed_at) === todayKey()).reduce((s, e) => s + e.amount, 0),
    [all],
  );

  // তারিখ → admin → পেমেন্ট
  const days = useMemo(() => {
    const map = new Map<string, PayEntry[]>();
    for (const e of entries) {
      const k = dayKeyOf(e.processed_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return [...map.entries()]
      .map(([date, list]) => {
        const byAdmin = new Map<string, PayEntry[]>();
        for (const e of list) {
          if (!byAdmin.has(e.admin)) byAdmin.set(e.admin, []);
          byAdmin.get(e.admin)!.push(e);
        }
        return {
          date,
          total: list.reduce((s, e) => s + e.amount, 0),
          count: list.length,
          admins: [...byAdmin.entries()]
            .map(([name, list2]) => ({ name, list: list2, total: list2.reduce((s, e) => s + e.amount, 0), count: list2.length }))
            .sort((x, y) => y.total - x.total),
        };
      })
      .sort((x, y) => (x.date < y.date ? 1 : -1));
  }, [entries]);

  // admin → তারিখ → পেমেন্ট
  const admins = useMemo(() => {
    const map = new Map<string, PayEntry[]>();
    for (const e of entries) {
      if (!map.has(e.admin)) map.set(e.admin, []);
      map.get(e.admin)!.push(e);
    }
    return [...map.entries()]
      .map(([name, list]) => {
        const byDay = new Map<string, PayEntry[]>();
        for (const e of list) {
          const k = dayKeyOf(e.processed_at);
          if (!byDay.has(k)) byDay.set(k, []);
          byDay.get(k)!.push(e);
        }
        return {
          name,
          total: list.reduce((s, e) => s + e.amount, 0),
          count: list.length,
          days: [...byDay.entries()]
            .map(([date, list2]) => ({ date, list: list2, total: list2.reduce((s, e) => s + e.amount, 0), count: list2.length }))
            .sort((x, y) => (x.date < y.date ? 1 : -1)),
        };
      })
      .sort((x, y) => y.total - x.total);
  }, [entries]);

  const rangeLabel =
    range === "today" ? "আজকের হিসাব" : range === "7" ? "গত ৭ দিন" : range === "30" ? "গত ৩০ দিন" : "সব সময়ের হিসাব";

  const downloadCsv = () => {
    const lines = ["Date,Time,Admin,User,UID,Provider,Number,Amount(BDT)"];
    for (const e of entries)
      lines.push(
        `${dayKeyOf(e.processed_at)},${timeOf(e.processed_at)},"${e.admin}","${e.user_name}",${e.uid ?? ""},${e.provider},${e.wallet_number},${e.amount.toFixed(2)}`,
      );
    lines.push(`,,,,,,TOTAL,${grand.toFixed(2)}`);
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payout-report-${todayKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV ডাউনলোড হয়েছে");
  };

  const printReport = () => {
    const rows = days
      .map(
        (d) =>
          `<tr class="day"><td>${bnDate(d.date)}</td><td>${d.count} পেমেন্ট</td><td>${d.total.toFixed(2)} BDT</td></tr>` +
          d.admins
            .map(
              (a) =>
                `<tr class="adm"><td style="padding-left:22px">↳ ${a.name}</td><td>${a.count} পেমেন্ট</td><td>${a.total.toFixed(2)} BDT</td></tr>` +
                a.list
                  .map(
                    (e) =>
                      `<tr><td style="padding-left:44px">${e.user_name} (UID ${e.uid ?? "-"}) · ${e.provider.toUpperCase()} ${e.wallet_number}</td><td>${timeOf(e.processed_at)}</td><td>${e.amount.toFixed(2)} BDT</td></tr>`,
                  )
                  .join(""),
            )
            .join(""),
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payout Report</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0}
p.sub{color:#666;font-size:12px;margin:4px 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border-bottom:1px solid #ddd;padding:5px 8px;text-align:left}
tr.day td{background:#eef4ff;font-weight:800;font-size:13px}tr.adm td{background:#f7f7f7;font-weight:700}
.total{margin-top:16px;font-size:18px;font-weight:800}</style></head><body>
<h1>Good-App · Payout Report (${rangeLabel})</h1>
<p class="sub">Generated: ${new Date().toLocaleString()}</p>
<table><thead><tr><th>তারিখ / Admin / কাকে</th><th>সময় / পেমেন্ট</th><th>টাকা</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total">সর্বমোট: ${grand.toFixed(2)} BDT</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Popup ব্লক হয়েছে"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  if (loading) return <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>;

  return (
    <div className="space-y-2.5">
      {/* সারসংক্ষেপ */}
      <div className="glass rounded-2xl p-3.5 border border-cyan/30 bg-gradient-to-br from-cyan/10 to-emerald/5">
        <p className="text-[10px] font-black text-cyan uppercase tracking-widest">💸 Payout হিসাব · {rangeLabel}</p>
        <p className="mono-num font-black text-3xl mt-0.5 text-emerald">{grand.toFixed(2)} ৳</p>
        <p className="text-[11px] text-muted-foreground">
          {entries.length} পেমেন্ট · {adminCount} জন admin · {days.length} দিন
        </p>
        <div className="grid grid-cols-2 gap-2 mt-2.5">
          <div className="rounded-xl bg-background/50 border border-white/10 p-2">
            <p className="text-[9px] text-muted-foreground font-black uppercase">আজ দেওয়া হয়েছে</p>
            <p className="mono-num font-black text-lg text-emerald">{todayTotal.toFixed(0)}৳</p>
          </div>
          <div className="rounded-xl bg-background/50 border border-white/10 p-2">
            <p className="text-[9px] text-muted-foreground font-black uppercase">সব সময় মিলিয়ে</p>
            <p className="mono-num font-black text-lg">{all.reduce((s, e) => s + e.amount, 0).toFixed(0)}৳</p>
          </div>
        </div>
        <div className="flex gap-1.5 mt-2.5">
          <button onClick={printReport} className="flex-1 px-3 py-2 rounded-xl bg-cyan/20 border border-cyan/40 text-cyan text-[11px] font-black">🖨️ Print / PDF</button>
          <button onClick={downloadCsv} className="flex-1 px-3 py-2 rounded-xl bg-emerald/20 border border-emerald/40 text-emerald text-[11px] font-black">⬇️ CSV</button>
        </div>
      </div>

      {/* ভিউ + সময় ফিল্টার */}
      <div className="flex gap-1.5">
        {([["date", "📅 তারিখ অনুযায়ী"], ["admin", "👤 Admin অনুযায়ী"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-black border ${view === id ? "bg-cyan/20 border-cyan/50 text-cyan" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {([["today", "আজ"], ["7", "৭ দিন"], ["30", "৩০ দিন"], ["all", "সব"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setRange(id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap border ${range === id ? "bg-emerald/20 border-emerald/50 text-emerald" : "bg-white/5 border-white/10 text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Admin নাম / user নাম / UID / নম্বর দিয়ে খুঁজুন…"
        className="w-full px-3 py-2 rounded-xl bg-background/60 border border-white/10 text-xs outline-none focus:border-cyan"
      />

      {entries.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">এই সময়ে কোনো payout নেই</p>}

      {/* তারিখ অনুযায়ী */}
      {view === "date" && days.map((d) => (
        <div key={d.date} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <button onClick={() => setOpenDay(openDay === d.date ? null : d.date)} className="w-full flex items-center gap-3 p-3 text-left">
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm truncate">
                {bnDate(d.date)}
                {d.date === todayKey() && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald/20 text-emerald align-middle">আজ</span>}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {d.count} জনকে দেওয়া হয়েছে · {d.admins.length} জন admin
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="mono-num font-black text-emerald text-base">{d.total.toFixed(0)}৳</p>
              <ChevronDown className={`w-4 h-4 inline transition-transform ${openDay === d.date ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openDay === d.date && (
            <div className="px-2.5 pb-2.5 space-y-1.5">
              {d.admins.map((a) => {
                const key = `${d.date}|${a.name}`;
                const open = openDayAdmin === key;
                return (
                  <div key={key} className="rounded-xl bg-background/50 border border-cyan/20">
                    <button onClick={() => setOpenDayAdmin(open ? null : key)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
                      <UserCheck className="w-4 h-4 text-cyan shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.count} পেমেন্ট · কাকে কত দেখতে চাপ দিন</p>
                      </div>
                      <p className="mono-num font-black text-emerald text-sm shrink-0">{a.total.toFixed(0)}৳</p>
                      <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && <div className="px-2 pb-2 space-y-1">{a.list.map((e) => <PayRow key={e.id} e={e} />)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {/* Admin অনুযায়ী */}
      {view === "admin" && admins.map((a) => (
        <div key={a.name} className="rounded-2xl border border-cyan/30 bg-gradient-to-br from-cyan/10 to-blue-500/5 overflow-hidden">
          <button onClick={() => setOpenAdmin(openAdmin === a.name ? null : a.name)} className="w-full flex items-center gap-3 p-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-cyan/20 border border-cyan/40 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5 text-cyan" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black truncate">{a.name}</p>
              <p className="text-[10px] text-muted-foreground">{a.count} পেমেন্ট · {a.days.length} দিন</p>
            </div>
            <div className="text-right shrink-0">
              <p className="mono-num font-black text-emerald">{a.total.toFixed(0)}৳</p>
              <ChevronDown className={`w-4 h-4 inline transition-transform ${openAdmin === a.name ? "rotate-180" : ""}`} />
            </div>
          </button>
          {openAdmin === a.name && (
            <div className="px-2.5 pb-2.5 space-y-1.5">
              {a.days.map((d) => (
                <div key={d.date} className="rounded-xl bg-background/50 border border-white/10 p-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] font-black">
                      {bnDate(d.date)} <span className="text-muted-foreground font-bold">· {d.count} পেমেন্ট</span>
                    </p>
                    <p className="mono-num font-black text-emerald text-sm">{d.total.toFixed(0)}৳</p>
                  </div>
                  <div className="space-y-1">{d.list.map((e) => <PayRow key={e.id} e={e} />)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PayRow({ e }: { e: PayEntry }) {
  return (
    <Link
      to="/admin/user/$userId"
      params={{ userId: e.user_id }}
      className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 flex items-center justify-between gap-2 hover:border-cyan/40"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold truncate">
          {e.user_name} <span className="text-[10px] text-muted-foreground mono-num">#{e.uid ?? "-"}</span>
        </p>
        <p className="text-[10px] text-muted-foreground mono-num truncate">
          {e.provider.toUpperCase()} · {e.wallet_number}
        </p>
        <p className="text-[9px] text-muted-foreground">🕒 {timeOf(e.processed_at)}</p>
      </div>
      <p className="mono-num font-black text-emerald text-sm shrink-0">{e.amount.toFixed(0)}৳</p>
    </Link>
  );
}

