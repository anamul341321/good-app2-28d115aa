import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListWithdrawals, adminUpdateWithdrawal, adminListCredits, adminListPaidByAdmins } from "@/lib/admin.functions";
import { Loader2, Check, X, Copy, AlertTriangle, ShieldCheck, Gift, ExternalLink, Plus, Minus, UserCheck, ChevronDown } from "lucide-react";
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
    mutationFn: (input: { id: string; action: "paid" | "rejected"; paidBy?: string }) => adminUpdateWithdrawal({ data: input }),
    onSuccess: () => { toast.success("Updated"); refetch(); paidByQ.refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = (id: string) => {
    let name = adminName.trim();
    if (!name) {
      const input = window.prompt("আপনার নাম লিখুন (কে paid করছে):", "");
      if (!input || !input.trim()) { toast.error("Admin name দিতে হবে"); return; }
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
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="যেমন: Anamul"
            className="w-full mt-0.5 px-2 py-1 rounded bg-background/60 border border-white/10 text-xs outline-none focus:border-cyan"
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

      {filter !== "admin" && (
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
            if (s.notWhitelistedTasks > 0) dangerFlags.push({ icon: "🔴", text: `${s.notWhitelistedTasks} not-whitelist wallet`, reason: "কিছু wallet whitelist নাই — fake identity সন্দেহ" });
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
                  <p className="mono-num font-black text-lg">{Number(w.amount).toFixed(2)} TK</p>
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

              {cleanNote && (
                <p className="text-[10px] text-muted-foreground italic bg-white/5 rounded px-2 py-1">
                  📝 {cleanNote}
                </p>
              )}

              {w.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => mut.mutate({ id: w.id, action: "paid" })}
                    className="flex-1 py-2 rounded-lg bg-emerald/20 text-emerald font-bold text-xs flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Mark paid
                  </button>
                  <button onClick={() => mut.mutate({ id: w.id, action: "rejected" })}
                    className="flex-1 py-2 rounded-lg bg-rose/20 text-rose font-bold text-xs flex items-center justify-center gap-1">
                    <X className="w-3.5 h-3.5" /> Reject (refund)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
