import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sendBalance, getMyTransfers, lookupTransferTarget } from "@/lib/transfer.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { computeLiveBalance, splitBalance } from "@/lib/mining";
import { Loader2, Send, Search, ArrowUpRight, ArrowDownLeft, User, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";

export const Route = createFileRoute("/_authenticated/send")({ component: SendPage });

function BackBar() {
  const router = useRouter();
  const { t } = useLang();
  return (
    <div className="flex items-center justify-between -mt-1 mb-1">
      <button
        onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/home" }))}
        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-black text-navy"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> {t("পিছনে", "Back")}
      </button>
      <Link to="/home" className="text-[11px] font-black text-violet-600">🏠 {t("হোম", "Home")}</Link>
    </div>
  );
}

const MIN_SEND = 15;

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const s = phone.replace(/\D/g, "");
  if (s.length < 7) return phone;
  return `${s.slice(0, 3)}${"*".repeat(s.length - 7)}${s.slice(-4)}`;
}

function SendPage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="সেন্ড ব্যালেন্স" />;
  const { t } = useLang();
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHist } = useQuery({ queryKey: ["my-transfers"], queryFn: () => getMyTransfers() });

  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<any | null>(null);

  const mining = dash?.mining;
  const debtTotal = Number((dash as any)?.debtTotal ?? 0);
  const balance = (dash as any)?.balanceBreakdown
    ? Math.floor((dash as any).balanceBreakdown.current_balance)
    : mining ? Math.floor(computeLiveBalance({
        accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
        isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
        effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
        qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
        selfSlots: Number((mining as any).self_slots ?? 0),
        referralUnits: Number((mining as any).referral_units ?? 0),
        selfQualified: (mining as any).self_qualified !== false,
        debt: debtTotal,
      })) : 0;

  // মাইনিং ব্যালেন্সের যে অংশ আনলক হয়েছে (স্লট রি-ভেরিফাই করলে আনলক হয়) + মেইন ব্যালেন্স
  // যেকোনো সময় পাঠানো যাবে — তারিখের কোনো নিয়ম নেই।
  const bd = (dash as any)?.balanceBreakdown;
  const bonusTotal = Number((mining as any)?.bonus_amount ?? 0);
  const bonusAvailable = Math.floor(bd?.bonus_part ?? splitBalance({
    balance,
    bonusTotal,
    withdrawn: Number((mining as any)?.withdrawn_amount ?? 0),
    miningWithdrawn: Number((mining as any)?.mining_withdrawn ?? 0),
  }).main);
  // শুধু মেইন ব্যালেন্স দিয়ে পাঠানো যাবে — মাইনিং ব্যালেন্স আগে মেইনে ক্লেইম করতে হবে।
  const miningLockedAmount = Math.floor(bd?.mining_part ?? 0);
  const sendable = Math.min(balance, bonusAvailable);

  const miningLocked = miningLockedAmount > 0;

  const lookup = useMutation({
    mutationFn: (tg: string) => lookupTransferTarget({ data: { target: tg } }),
    onSuccess: (r: any) => {
      if (r.self) { toast.error(t("নিজেকে পাঠানো যাবে না", "You can't send to yourself")); setFound(null); return; }
      if (!r.found) { toast.error(t("এই UID/ফোন-এ কোনো ইউজার নেই", "No user found for that UID/phone")); setFound(null); return; }
      setFound(r.user);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendBalance({ data: { target: target.trim(), amount: Math.floor(Number(amount) || 0), note: note.trim() || null } }),
    onSuccess: (r: any) => {
      toast.success(t(`✅ ${r.amount}৳ পাঠানো হয়েছে ${r.receiver_name}-এর কাছে`, `✅ Sent ${r.amount}৳ to ${r.receiver_name}`));
      setAmount(""); setNote(""); setTarget(""); setFound(null);
      refetchHist();
    },
    onError: (e: any) => toast.error(e.message ?? t("পাঠানো যায়নি", "Send failed")),
  });

  const amt = Math.floor(Number(amount) || 0);
  const sendFee = Math.floor(amt * 0.2);
  const totalCost = amt + sendFee;
  const canSubmit = found && amt >= MIN_SEND && totalCost <= sendable && !send.isPending;

  return (
    <div className="space-y-4 pt-2 pb-4">
      <BackBar />

      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl"
           style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 50%,#f59e0b 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-90 font-black leading-none">{t("সেন্ড ব্যালেন্স", "Send Balance")}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{t("অন্য ইউজারকে টাকা পাঠান", "Send money to another user")}</p>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-90 font-black">{t("পাঠানোর উপলব্ধ ব্যালেন্স", "Sendable Balance")}</p>
          <p className="mono-num text-5xl font-black leading-none mt-1 drop-shadow-lg" translate="no">
            {sendable}<span className="text-2xl ml-0.5">৳</span>
          </p>
          {miningLocked && (
            <p className="text-[11px] font-bold mt-1 opacity-90" translate="no">
              {t("মোট ব্যালেন্স", "Total balance")} {balance}৳ · {t("মাইনিং অংশ লক", "mining part locked")} 🔒
            </p>
          )}
          <p className="text-sm font-black mt-3 flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-xl px-3 py-2 border border-white/20">
            <Sparkles className="w-4 h-4" />
            {t("সর্বনিম্ন", "Minimum")} <span className="mono-num text-base" translate="no">{t("১৫৳", "15৳")}</span> {t("থেকে পাঠানো যাবে", "to send")}
          </p>
        </div>
      </div>

      {miningLocked && (
        <div className="rounded-2xl p-3.5 border-2 border-amber-500/40 bg-amber-500/10">
          <p className="text-xs font-black text-amber-600">⛏️ {t("মাইনিং ব্যালেন্স দিয়ে পাঠানো যাবে না", "Mining balance can't be sent")}</p>
          <p className="text-[11px] text-muted-foreground font-bold mt-1 leading-relaxed">
            {t(
              `আপনার ${miningLockedAmount}৳ মাইনিং ব্যালেন্স আছে। সেন্ড/উইথড্র/রিচার্জ শুধু মেইন ব্যালেন্স দিয়ে হবে — আগে মাইনিং টাকা "মেইন ব্যালেন্সে ক্লেইম" করুন। এখন পাঠাতে পারবেন ${sendable}৳।`,
              `You have ${miningLockedAmount}৳ mining balance. Send/withdraw/recharge use Main balance only — claim mining into Main balance first. You can send ${sendable}৳ now.`,
            )}
          </p>
        </div>
      )}

      <div className="glass rounded-3xl p-4 space-y-4 border border-violet-500/20 shadow-lg">
        <div>
          <label className="text-xs font-black text-navy">🔍 {t("রিসিভারের UID অথবা ফোন নম্বর", "Receiver UID or phone number")}</label>
          <div className="flex gap-2 mt-1.5">
            <input value={target} onChange={(e) => { setTarget(e.target.value); setFound(null); }}
              placeholder={t("যেমন: 1234 বা 01712345678", "e.g. 1234 or 01712345678")}
              className="flex-1 px-4 py-3.5 bg-surface-2 border-2 border-border rounded-2xl font-bold outline-none focus:border-violet-500 transition" />
            <button type="button" onClick={() => lookup.mutate(target.trim())}
              disabled={!target.trim() || lookup.isPending}
              className="rounded-2xl px-4 bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black btn-press disabled:opacity-50 flex items-center gap-1 shadow-lg">
              {lookup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t("খুঁজুন", "Find")}
            </button>
          </div>
        </div>

        {found && (
          <div className="rounded-2xl p-3 border-2 border-emerald/40 bg-emerald/10 flex items-center gap-3">
            {found.avatar_url ? (
              <img src={found.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-emerald" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald/20 flex items-center justify-center"><User className="w-6 h-6 text-emerald" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-black text-navy truncate">✓ {found.display_name || t("ইউজার", "User")}</p>
              <p className="text-[11px] text-muted-foreground mono-num" translate="no">UID: {found.uid_seq} · {maskPhone(found.phone_number)}</p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-black text-navy">💰 {t("কত টাকা পাঠাবেন?", "How much do you want to send?")}</label>
          <input type="number" min={15} value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder={t("সর্বনিম্ন ১৫৳", "Minimum 15৳")}
            className="w-full mt-1.5 px-4 py-3.5 mono-num bg-surface-2 border-2 border-border rounded-2xl text-xl font-black outline-none focus:border-violet-500 transition" />
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {[15, 25, 50, 100, 200].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className={`rounded-xl py-2 text-[11px] font-black border-2 btn-press transition ${amount === String(v) ? "bg-violet-500 text-white border-violet-500 shadow-md" : "bg-violet-500/5 text-violet-600 border-violet-500/25"}`}
                translate="no">
                {v}৳
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 font-bold">
            {t("সর্বনিম্ন", "Min")} <b className="text-violet-600" translate="no">15৳</b> · {t("সর্বোচ্চ", "Max")} <b className="text-violet-600" translate="no">{sendable}৳</b>
          </p>
          {amt >= MIN_SEND && (
            <div className="mt-2 rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-2.5 space-y-1" translate="no">
              <p className="text-[10px] uppercase tracking-widest font-black text-violet-600">{t("ফি হিসাব (২০%)", "Fee breakdown (20%)")}</p>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">{t("রিসিভার পাবে", "Receiver gets")}</span>
                <span className="mono-num font-bold text-emerald">{amt}৳</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-muted-foreground">{t("সেন্ড ফি (২০%)", "Send fee (20%)")}</span>
                <span className="mono-num font-bold text-rose">+ {sendFee}৳</span>
              </div>
              <div className="flex justify-between text-sm border-t border-violet-500/20 pt-1.5">
                <span className="font-black">{t("আপনার ব্যালেন্স থেকে কাটবে", "Deducted from your balance")}</span>
                <span className="mono-num font-black text-violet-600">{totalCost}৳</span>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("মেসেজ (ঐচ্ছিক)", "Message (optional)")}</label>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder={t("ছোট নোট...", "Short note...")}
            className="w-full mt-1 px-3 py-2 bg-surface-2 border border-border rounded-xl outline-none focus:border-violet-500" />
        </div>

        <button disabled={!canSubmit} onClick={() => send.mutate()}
          className="w-full py-3.5 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 btn-press">
          {send.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Send className="w-4 h-4" /> {amt >= MIN_SEND ? t(`${amt}৳ পাঠান`, `Send ${amt}৳`) : t("পাঠান", "Send")}
        </button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2">{t("ইতিহাস", "History")}</p>
        {(history ?? []).length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">{t("কোনো লেনদেন নেই", "No transactions yet")}</p>
        )}
        <div className="space-y-2">
          {(history ?? []).map((tx: any) => {
            const out = tx.direction === "out";
            const other = out ? tx.receiver : tx.sender;
            return (
              <div key={tx.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${out ? "bg-rose/15 text-rose" : "bg-emerald/15 text-emerald"}`}>
                  {out ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm truncate">{out ? t("পাঠানো →", "Sent →") : t("পেয়েছেন ←", "Received ←")} {other?.display_name ?? `UID ${other?.uid_seq ?? "?"}`}</p>
                  <p className="text-[10px] text-muted-foreground" translate="no">{new Date(tx.created_at).toLocaleString()}</p>
                  {tx.note && <p className="text-[11px] text-navy/80 mt-0.5 italic">"{tx.note}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`mono-num font-black ${out ? "text-rose" : "text-emerald"}`} translate="no">{out ? "-" : "+"}{Math.floor(Number(tx.amount))}৳</p>
                  {out && tx.fee_amount > 0 && (
                    <p className="text-[9px] text-muted-foreground font-bold" translate="no">
                      Fee: {Math.floor(Number(tx.fee_amount))}৳ · Total: {Math.floor(Number(tx.amount) + Number(tx.fee_amount))}৳
                    </p>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
