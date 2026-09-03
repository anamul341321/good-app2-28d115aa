import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { submitRecharge, getMyRecharges } from "@/lib/recharge.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { computeLiveBalance } from "@/lib/mining";
import { Loader2, Smartphone, CheckCircle2, XCircle, ArrowLeft, Sparkles, Zap, Wifi, Copy, Ticket } from "lucide-react";
import { listCardStore, purchaseCard, myCards } from "@/lib/cards.functions";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";

export const Route = createFileRoute("/_authenticated/recharge")({ component: RechargePage });

const MIN_RECHARGE = 20;
const OPERATORS: Array<{ id: string; label: string; color: string }> = [
  { id: "grameenphone", label: "GP", color: "#00a99d" },
  { id: "robi", label: "Robi", color: "#e2136e" },
  { id: "banglalink", label: "Banglalink", color: "#f36f21" },
  { id: "airtel", label: "Airtel", color: "#e2101f" },
  { id: "teletalk", label: "Teletalk", color: "#008a4b" },
];

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const SIM_LOGO: Record<string, string> = {
  grameenphone: favicon("grameenphone.com"),
  robi: favicon("robi.com.bd"),
  banglalink: favicon("banglalink.net"),
  airtel: favicon("bd.airtel.com"),
  teletalk: favicon("teletalk.com.bd"),
};


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
      <Link to="/home" className="text-[11px] font-black text-cyan-600">🏠 {t("হোম", "Home")}</Link>
    </div>
  );
}

function RechargePage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="মোবাইল রিচার্জ" />;
  const { t } = useLang();
  const { data: dash, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHist } = useQuery({ queryKey: ["my-recharges"], queryFn: () => getMyRecharges() });

  const [mode, setMode] = useState<"recharge" | "card">("recharge");
  const [mobile, setMobile] = useState("");

  const [operator, setOperator] = useState<string>("");
  const [connType, setConnType] = useState<"prepaid" | "postpaid">("prepaid");
  const [amount, setAmount] = useState("");

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

  const amtInput = Math.floor(Number(amount) || 0);
  const rechargeFee = Math.floor(amtInput * 0.2);
  const totalCost = amtInput + rechargeFee;
  // রিচার্জ/কার্ড শুধু মেইন ব্যালেন্স দিয়ে — মাইনিং ব্যালেন্স আগে মেইনে ক্লেইম করতে হবে।
  const mainPart = Math.floor(Number((dash as any)?.balanceBreakdown?.bonus_part ?? 0));
  const miningPart = Math.floor(Number((dash as any)?.balanceBreakdown?.mining_part ?? 0));
  const miningNeeded = Math.max(totalCost - mainPart, 0);

  const mut = useMutation({
    mutationFn: () => submitRecharge({ data: {
      mobile: mobile.replace(/\D/g, ""),
      operator: operator as any,
      connection_type: connType,
      amount: amtInput,
    } }),

    onSuccess: (r: any) => {
      if (r.ok) toast.success(t(`✅ রিচার্জ সফল! Trx: ${r.transaction_id ?? "—"}`, `✅ Recharge successful! Trx: ${r.transaction_id ?? "—"}`));
      else toast.error(t(`❌ রিচার্জ ব্যর্থ: ${r.message}`, `❌ Recharge failed: ${r.message}`));
      setMobile(""); setAmount(""); setOperator("");
      refetch(); refetchHist();
    },
    onError: (e: any) => toast.error(e.message ?? t("রিচার্জ ব্যর্থ", "Recharge failed")),
  });

  const rechargeOn = (dash as any)?.payoutSettings?.rechargeEnabled !== false;
  const rechargeOffMsg = (dash as any)?.payoutSettings?.rechargeOffMessage ?? null;

  if (!rechargeOn) {
    return (
      <div className="pt-2 space-y-3">
        <BackBar />
        <div className="text-center pt-4 space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose/15 text-rose">
            <XCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black">{t("মোবাইল রিচার্জ সাময়িক বন্ধ", "Mobile recharge is temporarily off")}</h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-snug">
            {rechargeOffMsg ?? t("এই মুহূর্তে recharge সেবা বন্ধ রাখা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।", "Recharge is disabled right now. Please try again in a bit.")}
          </p>
        </div>
      </div>
    );
  }

  const amt = Math.floor(Number(amount) || 0);
  const mob = mobile.replace(/\D/g, "");
  const canSubmit = /^0?1\d{9,10}$/.test(mob) && !!operator && amt >= MIN_RECHARGE && totalCost <= mainPart && !mut.isPending;

  const selectedOp = OPERATORS.find((o) => o.id === operator);

  return (
    <div className="space-y-4 pt-2 pb-4">
      <BackBar />

      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl"
           style={{ background: "linear-gradient(135deg,#0ea5e9 0%,#06b6d4 35%,#10b981 70%,#22c55e 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-90 font-black leading-none">{t("মোবাইল রিচার্জ", "Mobile Recharge")}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{t("ইনস্ট্যান্ট · সব অপারেটর", "Instant · All operators")}</p>
            </div>
            <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur text-[9px] font-black">
              <Zap className="w-3 h-3" /> LIVE
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-90 font-black">{t("উপলব্ধ মেইন ব্যালেন্স", "Available Main Balance")}</p>
          <p className="mono-num text-5xl font-black leading-none mt-1 drop-shadow-lg" translate="no">
            {mainPart}<span className="text-2xl ml-0.5">৳</span>
          </p>
          {miningPart > 0 && (
            <p className="text-[11px] font-bold mt-1 opacity-90" translate="no">
              {t("মাইনিং ব্যালেন্স", "Mining balance")} {miningPart}৳ · {t("আগে মেইনে ক্লেইম করুন", "claim to Main first")} ⛏️
            </p>
          )}
          <p className="text-[10px] opacity-90 mt-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {t(`মিনিমাম ${MIN_RECHARGE}৳ থেকে রিচার্জ · সাথে সাথে টাকা যাবে`, `Recharge from ${MIN_RECHARGE}৳ · instant delivery`)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode("recharge")}
          className={`rounded-2xl py-3 text-[12px] font-black border-2 btn-press transition flex items-center justify-center gap-1.5 ${mode === "recharge" ? "text-white border-transparent shadow-lg" : "bg-surface-2 border-border text-navy"}`}
          style={mode === "recharge" ? { background: "linear-gradient(135deg,#06b6d4,#10b981)" } : {}}>
          <Smartphone className="w-4 h-4" /> {t("মোবাইল রিচার্জ", "Mobile Recharge")}
        </button>
        <button type="button" onClick={() => setMode("card")}
          className={`rounded-2xl py-3 text-[12px] font-black border-2 btn-press transition flex items-center justify-center gap-1.5 ${mode === "card" ? "text-white border-transparent shadow-lg" : "bg-surface-2 border-border text-navy"}`}
          style={mode === "card" ? { background: "linear-gradient(135deg,#7c3aed,#06b6d4)" } : {}}>
          <Ticket className="w-4 h-4" /> {t("মিনিট / এমবি কার্ড", "Minute / MB Card")}
        </button>
      </div>

      {mode === "recharge" ? (
      <>
      <div className="glass rounded-3xl p-4 space-y-4 border border-cyan-500/20 shadow-lg">

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{t("মোবাইল নম্বর", "Mobile number")}</label>
          <div className="relative mt-1.5">
            <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="01XXXXXXXXX"
              className="w-full px-4 py-3.5 mono-num bg-surface-2 border-2 border-border rounded-2xl text-lg font-black outline-none focus:border-cyan-500 transition" />
            {selectedOp && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg text-[10px] font-black text-white"
                   style={{ background: selectedOp.color }}>
                {selectedOp.label}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{t("অপারেটর", "Operator")}</label>
          <div className="grid grid-cols-5 gap-1.5 mt-1.5">
            {OPERATORS.map((op) => (
              <button key={op.id} type="button" onClick={() => setOperator(op.id)}
                className={`rounded-2xl py-2 text-[10px] font-black border-2 transition-all btn-press flex flex-col items-center gap-1 ${operator === op.id ? "text-white scale-105 shadow-lg border-transparent" : "text-navy bg-surface-2 border-border hover:border-cyan-500/40"}`}
                style={operator === op.id ? { background: op.color, boxShadow: `0 8px 20px -6px ${op.color}` } : {}}>
                <span className="w-7 h-7 rounded-lg bg-white flex items-center justify-center overflow-hidden">
                  <img src={SIM_LOGO[op.id] ?? ""} alt={`${op.label} logo`} className="w-5 h-5 object-contain" loading="lazy" />
                </span>
                {op.label}
              </button>
            ))}

          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{t("কানেকশন", "Connection")}</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            <button type="button" onClick={() => setConnType("prepaid")}
              className={`rounded-2xl py-2.5 font-black text-sm border-2 transition btn-press ${connType === "prepaid" ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-white border-transparent shadow-lg" : "bg-surface-2 border-border"}`}>Prepaid</button>
            <button type="button" onClick={() => setConnType("postpaid")}
              className={`rounded-2xl py-2.5 font-black text-sm border-2 transition btn-press ${connType === "postpaid" ? "bg-gradient-to-r from-violet-500 to-cyan-500 text-white border-transparent shadow-lg" : "bg-surface-2 border-border"}`}>Postpaid</button>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{t("পরিমাণ (৳)", "Amount (৳)")}</label>
          <input type="number" min={MIN_RECHARGE} value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder={t(`সর্বনিম্ন ${MIN_RECHARGE}৳`, `Minimum ${MIN_RECHARGE}৳`)}
            className="w-full mt-1.5 px-4 py-3.5 mono-num bg-surface-2 border-2 border-border rounded-2xl text-lg font-black outline-none focus:border-cyan-500 transition" />
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {[20, 50, 100, 200, 500].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className={`rounded-xl py-2 text-[11px] font-black border-2 btn-press transition ${amount === String(v) ? "bg-cyan-500 text-white border-cyan-500 shadow-md" : "bg-cyan-500/5 text-cyan-600 border-cyan-500/25 hover:bg-cyan-500/10"}`}
                translate="no">
                {v}৳
              </button>
            ))}
          </div>
        </div>

        {amt >= MIN_RECHARGE && (
          <div className="rounded-xl border-2 border-cyan-500/30 bg-cyan-500/5 p-3 space-y-1 animate-in zoom-in-95 duration-200" translate="no">
            <p className="text-[10px] uppercase tracking-widest font-black text-cyan-600">{t("ফি হিসাব (২০%)", "Fee breakdown (20%)")}</p>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">{t("রিচার্জ হবে", "Recharge amount")}</span>
              <span className="mono-num font-bold text-emerald">{amt}৳</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted-foreground">{t("সার্ভিস ফি (২০%)", "Service fee (20%)")}</span>
              <span className="mono-num font-bold text-rose">+ {rechargeFee}৳</span>
            </div>
            <div className="flex justify-between text-sm border-t border-cyan-500/20 pt-1.5">
              <span className="font-black">{t("মোট ব্যালেন্স কাটবে", "Total payable")}</span>
              <span className="mono-num font-black text-cyan-600">{totalCost}৳</span>
            </div>
            {miningNeeded > 0 && (
              <p className="text-[11px] font-bold leading-snug pt-1 text-rose">
                {t(`মেইন ব্যালেন্স ${miningNeeded}৳ কম। রিচার্জ শুধু মেইন ব্যালেন্স দিয়ে হয় — মাইনিং টাকা আগে মেইন ব্যালেন্সে ক্লেইম করুন।`, `Main balance is short by ${miningNeeded}৳. Recharge uses Main balance only — claim mining into Main balance first.`)}
              </p>
            )}
          </div>
        )}


        <button disabled={!canSubmit} onClick={() => mut.mutate()}
          className="w-full py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 btn-press text-white shadow-xl transition"
          style={{ background: canSubmit ? "linear-gradient(135deg,#7c3aed,#06b6d4,#10b981)" : "linear-gradient(135deg,#94a3b8,#64748b)" }}>
          {mut.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
          {amt >= MIN_RECHARGE ? t(`${amt}৳ রিচার্জ করুন`, `Recharge ${amt}৳`) : t("রিচার্জ করুন", "Recharge")}
        </button>

      </div>



      <div>
        <div className="flex items-center justify-between px-1 mb-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">{t("রিচার্জ ইতিহাস", "Recharge history")}</p>
          <Link to="/history" className="text-[10px] font-black text-violet-500">{t("সব ইতিহাস →", "All history →")}</Link>
        </div>
        {(history ?? []).length === 0 && (
          <div className="glass rounded-2xl p-6 text-center">
            <Smartphone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{t("এখনো কোনো রিচার্জ করা হয়নি", "No recharges yet")}</p>
          </div>
        )}
        <div className="space-y-2">
          {(history ?? []).map((r: any) => (
            <div key={r.id} className="glass rounded-2xl p-3 flex items-center gap-3 border border-border/50">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${r.status === "success" ? "bg-emerald/15 text-emerald" : r.status === "failed" ? "bg-rose/15 text-rose" : "bg-amber/15 text-amber"}`}>
                {r.status === "success" ? <CheckCircle2 className="w-5 h-5" /> : r.status === "failed" ? <XCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-sm mono-num" translate="no">{r.mobile} <span className="text-[10px] text-muted-foreground uppercase ml-1">{r.operator}</span></p>
                <p className="text-[10px] text-muted-foreground" translate="no">{new Date(r.created_at).toLocaleString()} · {r.connection_type}</p>
                {r.status === "failed" && r.error_message && <p className="text-[10px] text-rose mt-0.5 truncate">{r.error_message}</p>}
                {r.provider_ref && <p className="text-[10px] text-emerald mono-num truncate" translate="no">Trx: {r.provider_ref}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="mono-num font-black text-navy" translate="no">{Math.floor(Number(r.amount))}৳</p>
                {(r.fee_amount > 0 || r.total_deducted > 0) && (
                  <p className="text-[9px] text-muted-foreground font-bold" translate="no">
                    Fee: {Math.floor(Number(r.fee_amount))}৳ · Total: {Math.floor(Number(r.total_deducted || (Number(r.amount) + Number(r.fee_amount))))}৳
                  </p>
                )}
              </div>

            </div>
          ))}
        </div>
      </div>
      </>
      ) : (
        <CardStore balance={mainPart} onDone={() => { refetch(); }} />
      )}
    </div>
  );
}


const OP_COLOR: Record<string, string> = {
  GP: "#00a99d", Robi: "#e2136e", Airtel: "#e2101f", Banglalink: "#f36f21", Other: "#64748b",
};

const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const OP_LOGO: Record<string, string> = {
  GP: fav("grameenphone.com"),
  Robi: fav("robi.com.bd"),
  Airtel: fav("bd.airtel.com"),
  Banglalink: fav("banglalink.net"),
};

function CardStore({ balance, onDone }: { balance: number; onDone: () => void }) {
  const { t } = useLang();
  const [op, setOp] = useState<string>("");

  const { data: cards, refetch } = useQuery({ queryKey: ["card-store"], queryFn: () => listCardStore() });
  const { data: mine, refetch: refetchMine } = useQuery({ queryKey: ["my-cards"], queryFn: () => myCards() });
  const [bought, setBought] = useState<any>(null);

  const buy = useMutation({
    mutationFn: (productId: string) => purchaseCard({ data: { productId } }),
    onSuccess: (r: any) => {
      setBought(r);
      toast.success(t("কার্ড কেনা সফল!", "Card purchased!"));
      refetch(); refetchMine(); onDone();
    },
    onError: (e: any) => toast.error(e?.message ?? t("কার্ড কেনা যায়নি", "Purchase failed")),
  });

  const list = (cards ?? []).filter((c: any) => c.operator === op);
  const ops = ["GP", "Robi", "Airtel", "Banglalink", "Other"];
  const countFor = (o: string) => (cards ?? []).filter((c: any) => c.operator === o && Number(c.stock) > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Ticket className="w-4 h-4 text-violet-500" />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
          {t("মিনিট / এমবি কার্ড", "Minute / MB Cards")}
        </p>
      </div>

      {!op ? (
        <div className="glass rounded-3xl p-4 border border-violet-500/20 space-y-3">
          <p className="text-xs font-black text-navy text-center">
            {t("অপারেটর নির্বাচন করুন", "Select an operator")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ops.map((o) => {
              const n = countFor(o);
              return (
                <button key={o} onClick={() => setOp(o)}
                  className="btn-press rounded-2xl p-3 bg-surface-2 border-2 border-border hover:border-violet-500/50 transition flex flex-col items-center gap-1.5">
                  <span className="w-11 h-11 rounded-xl bg-white flex items-center justify-center overflow-hidden shadow-sm"
                        style={{ border: `2px solid ${OP_COLOR[o] ?? "#64748b"}` }}>
                    {OP_LOGO[o] ? (
                      <img src={OP_LOGO[o]} alt={`${o} logo`} className="w-8 h-8 object-contain" loading="lazy" />
                    ) : (
                      <Ticket className="w-5 h-5" style={{ color: OP_COLOR[o] }} />
                    )}
                  </span>
                  <span className="text-[11px] font-black" style={{ color: OP_COLOR[o] ?? "#64748b" }}>{o}</span>
                  <span className={`text-[9px] font-black ${n > 0 ? "text-emerald" : "text-muted-foreground"}`} translate="no">
                    {n > 0 ? `${n} ${t("কার্ড", "cards")}` : t("নেই", "none")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-3 flex items-center gap-3 border border-border/60">
            <span className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0"
                  style={{ border: `2px solid ${OP_COLOR[op] ?? "#64748b"}` }}>
              {OP_LOGO[op] ? <img src={OP_LOGO[op]} alt={`${op} logo`} className="w-7 h-7 object-contain" /> : <Ticket className="w-4 h-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-black text-sm" style={{ color: OP_COLOR[op] ?? "#64748b" }}>{op}</p>
              <p className="text-[10px] text-muted-foreground" translate="no">{list.length} {t("টি কার্ড পাওয়া যাচ্ছে", "cards available")}</p>
            </div>
            <button onClick={() => setOp("")}
              className="btn-press px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-[10px] font-black text-navy">
              {t("অপারেটর বদলান", "Change")}
            </button>
          </div>

          {list.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <Ticket className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("এই অপারেটরের কোনো কার্ড নেই", "No cards for this operator")}</p>
              <button onClick={() => setOp("")} className="mt-3 text-[11px] font-black text-violet-500">
                {t("অন্য অপারেটর দেখুন →", "Try another operator →")}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {list.map((c: any) => {
                const out = Number(c.stock) <= 0;
                const poor = balance < Number(c.selling_price);
                return (
                  <div key={c.id} className="glass rounded-2xl p-3 border border-border/60 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0"
                            style={{ border: `1.5px solid ${OP_COLOR[c.operator] ?? "#64748b"}` }}>
                        {OP_LOGO[c.operator] ? <img src={OP_LOGO[c.operator]} alt={`${c.operator} logo`} className="w-4 h-4 object-contain" /> : null}
                      </span>
                      <span className="text-[9px] font-black text-muted-foreground uppercase flex items-center gap-1">
                        {c.card_type === "Minute" ? <Smartphone className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                        {c.card_type}
                      </span>
                    </div>
                    <p className="font-black text-sm leading-tight">{c.amount_label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{c.name}{c.validity ? ` · ${c.validity}` : ""}</p>
                    <div className="flex items-center justify-between mt-auto pt-1">
                      <p className="mono-num font-black text-cyan-600" translate="no">{Math.floor(Number(c.selling_price))}৳</p>
                      <p className={`text-[9px] font-black ${out ? "text-rose" : "text-emerald"}`} translate="no">
                        {out ? t("স্টক শেষ", "Out of stock") : `${c.stock} ${t("টি আছে", "left")}`}
                      </p>
                    </div>
                    <button disabled={out || poor || buy.isPending} onClick={() => buy.mutate(c.id)}
                      className="w-full py-2 rounded-xl text-[11px] font-black text-white disabled:opacity-50 btn-press"
                      style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
                      {buy.isPending ? "…" : poor ? t("ব্যালেন্স নেই", "Low balance") : t("কিনুন", "Buy")}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Link to="/history" className="block glass rounded-2xl p-3 text-center text-[11px] font-black text-violet-500 border border-border/60">
        {t("সব লেনদেনের ইতিহাস দেখুন →", "View all transaction history →")}
      </Link>


      {(mine ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black px-1">
            {t("আমার কার্ড", "My cards")}
          </p>
          {(mine ?? []).map((m: any) => (
            <div key={m.id} className="glass rounded-2xl p-3 flex items-center gap-3 border border-border/50">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black text-xs">{m.card_products?.name ?? "Card"}</p>
                <p className="mono-num text-sm font-black text-navy tracking-wider truncate" translate="no">{m.code}</p>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(m.code); toast.success(t("কোড কপি হয়েছে", "Code copied")); }}
                className="p-2 rounded-lg bg-surface-2 border border-border">
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {bought && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-xs rounded-3xl p-5 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald mx-auto" />
            <p className="font-black text-sm">{bought.name}</p>
            <p className="mono-num text-lg font-black tracking-widest break-all" translate="no">{bought.code}</p>
            <button onClick={() => { navigator.clipboard.writeText(bought.code); toast.success(t("কপি হয়েছে", "Copied")); }}
              className="w-full py-2.5 rounded-xl bg-surface-2 border border-border font-black text-xs">
              {t("কোড কপি করুন", "Copy code")}
            </button>
            <button onClick={() => setBought(null)}
              className="w-full py-2.5 rounded-xl text-white font-black text-xs"
              style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
              {t("ঠিক আছে", "Done")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
