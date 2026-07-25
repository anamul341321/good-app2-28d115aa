import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDashboard, getMyWithdrawals } from "@/lib/dashboard.functions";
import { requestWithdraw } from "@/lib/withdraw.functions";
import { MIN_WITHDRAW_BDT } from "@/lib/constants";
import { computeLiveBalance } from "@/lib/mining";
import { useState, useEffect } from "react";
import { ArrowDownToLine, Loader2, Lock, Copy } from "lucide-react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import bkashLogo from "@/assets/bkash-logo.png";
import nagadLogo from "@/assets/nagad-logo.png";



export const Route = createFileRoute("/_authenticated/withdraw")({ component: WithdrawPage });

function WithdrawPage() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ["withdrawals"], queryFn: () => getMyWithdrawals(),
  });

  const walletBkash = (data as any)?.walletBkash ?? null;
  const walletNagad = (data as any)?.walletNagad ?? null;
  const payout = (data as any)?.payoutSettings ?? { bkashEnabled: true, nagadEnabled: true };

  // Pick the first usable provider by default
  const initial: "bkash" | "nagad" | null =
    (payout.bkashEnabled && walletBkash) ? "bkash" :
    (payout.nagadEnabled && walletNagad) ? "nagad" :
    walletBkash ? "bkash" :
    walletNagad ? "nagad" : null;

  const [provider, setProvider] = useState<"bkash" | "nagad" | null>(initial);
  useEffect(() => { if (!provider && initial) setProvider(initial); }, [initial, provider]);

  const [amount, setAmount] = useState<string>("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const mut = useMutation({
    mutationFn: () => requestWithdraw({ data: { amount: Math.floor(Number(amount) || 0), provider: provider ?? undefined } }),
    onSuccess: () => {
      toast.success("উইথড্র রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন শীঘ্রই প্রসেস করবেন।");
      setAmount("");
      refetch(); refetchHistory();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;

  const mining = data?.mining;
  const debts = (data as any)?.debts ?? [];
  const debtTotal = Number((data as any)?.debtTotal ?? 0);
  const balance = mining ? computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    debt: debtTotal,
    now,
  }) : 0;
  const claimable = debtTotal > 0 ? Math.floor(balance) : Math.floor(balance);

  const chosenWallet = provider === "bkash" ? walletBkash : provider === "nagad" ? walletNagad : null;
  const chosenEnabled = provider === "bkash" ? payout.bkashEnabled : provider === "nagad" ? payout.nagadEnabled : false;
  const chosenOffMsg  = provider === "bkash" ? payout.bkashOffMessage : payout.nagadOffMessage;

  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="withdraw" steps={["withdraw.intro","withdraw.amount","withdraw.submit"]} />
      <div className="text-center">
        <ArrowDownToLine className="w-8 h-8 text-rose mx-auto" />
        <h1 className="text-2xl font-black mt-1">উইথড্র</h1>
      </div>

      {debts.length > 0 && (
        <div className="rounded-2xl p-5 border-2 border-rose bg-linear-to-br from-rose/25 via-rose/10 to-amber/10 space-y-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">⚠️</span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-rose font-black">গুরুত্বপূর্ণ সতর্কতা</p>
              <h2 className="text-lg font-black text-rose leading-tight">আপনার অ্যাকাউন্টে ভুল পেমেন্ট গেছে</h2>
            </div>
          </div>
          <p className="text-[12px] text-navy/90 leading-relaxed font-bold">
            ভুলবশত আপনাকে <span className="mono-num text-rose font-black">{Math.ceil(debtTotal)}৳</span> বেশি পাঠানো হয়েছে।
            নিচের নাম্বারে <span className="font-black text-amber">Cash-Out</span> করে টাকাটা ফেরত পাঠান।
            টাকা ফেরত না দিলে আপনার অ্যাকাউন্ট <span className="text-rose font-black">স্থায়ীভাবে বন্ধ</span> করে দেওয়া হবে এবং কোনো withdraw করতে পারবেন না।
          </p>
          {debts.map((d: any) => (
            <div key={d.id} className="rounded-xl bg-background/70 border border-rose/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${d.provider === "bkash" ? "bg-rose/20 text-rose" : "bg-amber/20 text-amber"}`}>
                  {d.provider === "bkash" ? "📱 বিকাশ" : "💳 নগদ"} · Agent
                </span>
                <span className="mono-num font-black text-rose">{Math.ceil(Number(d.amount))}৳</span>
              </div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(d.payment_number); toast.success("Agent নম্বর কপি হয়েছে"); }}
                className="w-full flex items-center justify-between gap-2 bg-amber/10 border border-amber/40 rounded-lg px-3 py-2.5">
                <div className="text-left">
                  <p className="text-[9px] uppercase tracking-widest text-amber font-black">Cash-Out এই নাম্বারে</p>
                  <p className="mono-num font-black text-lg text-navy">{d.payment_number}</p>
                </div>
                <Copy className="w-4 h-4 text-amber" />
              </button>
              {d.message && (
                <div className="rounded-lg bg-rose/10 border border-rose/30 p-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-rose font-black">অ্যাডমিনের বার্তা</p>
                  <p className="text-[12px] text-navy mt-0.5 leading-snug whitespace-pre-wrap">{d.message}</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground leading-snug">
                📞 উপরের নাম্বারে <span className="font-black text-amber">{Math.ceil(Number(d.amount))}৳ Cash-Out</span> করুন ({d.provider === "bkash" ? "বিকাশ" : "নগদ"} Agent নাম্বার)। পাঠানোর পর অ্যাডমিন যাচাই করে ওয়ার্নিং সরিয়ে দিবে।
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mining-card mining-card-morph rounded-2xl p-6 text-center relative overflow-hidden">
        <p className="text-xs uppercase tracking-widest text-white/80 font-black">
          {debtTotal > 0 ? "বর্তমান ব্যালেন্স" : "ক্লেইমযোগ্য ব্যালেন্স"}
        </p>
        <p className={`mono-num text-5xl font-black mt-2 drop-shadow ${claimable < 0 ? "text-amber" : "text-white"}`}>
          {claimable} <span className="text-2xl">৳</span>
        </p>
        <p className="text-[11px] text-white/70 mt-2">লাইভ: {balance.toFixed(4)}৳ · শুধুমাত্র পূর্ণ টাকা উইথড্র করা যাবে</p>
        {debtTotal === 0 && claimable >= 50 && (
          <button type="button" onClick={() => setAmount(String(claimable))}
            className="mt-4 rounded-xl px-5 py-2.5 font-black text-sm bg-white text-rose btn-press shine">
            💰 সম্পূর্ণ {claimable}৳ ক্লেইম করুন
          </button>
        )}
      </div>


      {!payout.bkashEnabled && !payout.nagadEnabled && (
        <div className="relative overflow-hidden rounded-2xl p-5 text-center border-2 border-amber/50"
             style={{ background: "linear-gradient(135deg, color-mix(in oklch, var(--color-amber) 18%, transparent), color-mix(in oklch, var(--color-rose) 15%, transparent))" }}>
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-30 pointer-events-none"
               style={{ background: "radial-gradient(circle, var(--color-amber) 0%, transparent 70%)" }} />
          <div className="relative">
            <div className="text-4xl mb-1 animate-pulse">🕐</div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber font-black">উইথড্র সাময়িক বন্ধ</p>
            <h2 className="text-lg font-black text-amber mt-1">প্রিয় ইউজার, একটু অপেক্ষা করুন</h2>
            <p className="text-xs text-navy/90 mt-2 leading-relaxed">
              বর্তমানে <span className="font-black">বিকাশ ও নগদ</span> দুটোই সাময়িকভাবে বন্ধ রয়েছে।
              <br />অনুগ্রহ করে নিচের সময়ের মধ্যে উইথড্র রিকোয়েস্ট করুন —
            </p>
            <div className="mt-3 inline-block rounded-xl bg-background/70 border border-amber/40 px-4 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">উইথড্র সময়</p>
              <p className="mono-num font-black text-xl text-amber mt-0.5">সকাল ১০:০০ – রাত ১০:০০</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">এই সময়ের বাইরে পেমেন্ট সিস্টেম স্বয়ংক্রিয়ভাবে চালু হয়ে যাবে ইনশাআল্লাহ ✨</p>
          </div>
        </div>
      )}


      {/* Provider chooser */}
      {(!walletBkash && !walletNagad) ? (
        <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-4 text-center">
          <p className="text-sm font-bold text-amber">প্রথমে ওয়ালেট নম্বর সেট করুন</p>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2" translate="no">
          <ProviderPill
            selected={provider === "bkash"}
            available={!!walletBkash}
            enabled={payout.bkashEnabled}
            logo={bkashLogo}
            label="bKash"
            tone="rose"
            wallet={walletBkash}
            onClick={() => setProvider("bkash")}
          />
          <ProviderPill
            selected={provider === "nagad"}
            available={!!walletNagad}
            enabled={payout.nagadEnabled}
            logo={nagadLogo}
            label="Nagad"
            tone="amber"
            wallet={walletNagad}
            onClick={() => setProvider("nagad")}
          />
        </div>
      )}

      {provider && !chosenWallet && (
        <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-3 text-center text-sm font-bold text-amber">
          {provider === "bkash" ? "বিকাশ" : "নগদ"} নম্বর সেট করুন
        </Link>
      )}

      {provider && chosenWallet && !chosenEnabled && (
        <div className="rounded-2xl border-2 border-rose/40 bg-rose/10 p-3 text-center">
          <p className="text-sm font-bold text-rose">⚠️ {provider === "bkash" ? "বিকাশ" : "নগদ"} withdraw বর্তমানে বন্ধ</p>
          <p className="text-[11px] text-navy/80 mt-1">{chosenOffMsg || `অনুগ্রহ করে ${provider === "bkash" ? "নগদ" : "বিকাশ"}-এ withdraw দিন`}</p>
        </div>
      )}

      {provider && chosenWallet && chosenEnabled && claimable < MIN_WITHDRAW_BDT ? (
        <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-center">
          <Lock className="w-6 h-6 text-rose mx-auto mb-1" />
          <p className="text-sm font-bold text-rose">পর্যাপ্ত ব্যালেন্স নেই</p>
          <p className="text-[11px] text-muted-foreground mt-1">সর্বনিম্ন {MIN_WITHDRAW_BDT}৳ ক্লেইমযোগ্য হলে উইথড্র করা যাবে</p>
        </div>
      ) : provider && chosenWallet && chosenEnabled ? (
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="glass rounded-2xl p-5 space-y-4" data-voice="withdraw.intro">
          <div data-voice="withdraw.amount">
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">পরিমাণ (৳ পূর্ণ টাকা)</label>
            <input type="number" min={MIN_WITHDRAW_BDT} step="1" value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={`সর্বনিম্ন ${MIN_WITHDRAW_BDT}`}
              className="w-full mt-2 px-4 py-3 mono-num bg-surface-2 border border-border rounded-xl text-lg font-black outline-none focus:border-rose" />
            <p className="text-[10px] text-muted-foreground mt-1">সর্বনিম্ন: {MIN_WITHDRAW_BDT}৳ · সর্বোচ্চ: {claimable}৳ (শুধু পূর্ণ টাকা)</p>
          </div>
          <div className="bg-surface-2 rounded-xl p-3 text-[11px] space-y-1">
            <p><span className="text-muted-foreground">পাঠানো হবে:</span> <span className="font-bold">{provider === "bkash" ? "বিকাশ" : "নগদ"}</span></p>
            <button type="button"
              onClick={() => { navigator.clipboard.writeText(chosenWallet.number); toast.success("নম্বর কপি হয়েছে"); }}
              className="w-full flex items-center justify-between gap-2 mono-num bg-background/60 rounded-lg px-2 py-1.5 hover:bg-background border border-transparent hover:border-cyan/40 transition">
              <span><span className="text-muted-foreground">নম্বর:</span> <span className="font-bold">{chosenWallet.number}</span></span>
              <Copy className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
          <button disabled={mut.isPending || Math.floor(Number(amount) || 0) < MIN_WITHDRAW_BDT || Math.floor(Number(amount) || 0) > claimable}
            data-voice="withdraw.submit"
            className="w-full py-4 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            উইথড্র রিকোয়েস্ট করুন
          </button>
        </form>
      ) : null}

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2">ইতিহাস</p>
        <div className="space-y-2">
          {(history ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">কোনো উইথড্র রিকোয়েস্ট নেই</p>
          )}
          {(history ?? []).map((w: any) => (
            <div key={w.id} className="glass rounded-xl p-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1 pr-2">
                <p className="mono-num font-black" translate="no">{Math.floor(Number(w.amount))} ৳</p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1" translate="no">
                  <span>{new Date(w.created_at).toLocaleString()}</span>
                  <span>•</span>
                  <img
                    src={w.provider === "bkash" ? bkashLogo : nagadLogo}
                    alt={w.provider === "bkash" ? "bKash" : "Nagad"}
                    className="h-3 w-auto object-contain inline-block"
                    loading="lazy"
                  />
                </p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(w.wallet_number); toast.success("নম্বর কপি হয়েছে"); }}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] mono-num text-cyan hover:underline"
                  translate="no">
                  {w.wallet_number} <Copy className="w-2.5 h-2.5" />
                </button>
                {w.status === "rejected" && w.admin_note && (
                  <div className="mt-2 rounded-lg bg-rose/10 border border-rose/30 p-2 text-[11px] text-rose leading-snug">
                    <p className="font-black text-[9px] uppercase tracking-widest" translate="no">Admin এর কারণ</p>
                    <p className="mt-0.5" translate="no">{w.admin_note}</p>
                  </div>
                )}
              </div>
              <span translate="no" className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
                w.status === "paid" ? "bg-emerald/15 text-emerald" :
                w.status === "rejected" ? "bg-rose/15 text-rose" :
                "bg-amber/15 text-amber"
              }`}>{
                w.status === "paid" ? "পরিশোধিত" :
                w.status === "rejected" ? "প্রত্যাখ্যাত" : "অপেক্ষমাণ"
              }</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProviderPill({ selected, available, enabled, logo, label, tone, wallet, onClick }: {
  selected: boolean; available: boolean; enabled: boolean;
  logo: string; label: string; tone: "rose" | "amber"; wallet: any; onClick: () => void;
}) {
  const disabled = !available;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl p-3 border-2 text-left transition ${
        selected
          ? `border-${tone} bg-${tone}/10`
          : "border-border bg-surface-2"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt={label} className="h-6 w-auto object-contain shrink-0" loading="lazy" />
          <span className={`text-sm font-black text-${tone} truncate`} translate="no">{label}</span>
        </div>
        {!enabled && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose/20 text-rose shrink-0" translate="no">বন্ধ</span>}
      </div>
      {wallet ? (
        <p className="mono-num text-[11px] text-navy/80 mt-1 truncate" translate="no">{wallet.number}</p>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-1" translate="no">সেট করা নেই</p>
      )}
    </button>
  );
}
