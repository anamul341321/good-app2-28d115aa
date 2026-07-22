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
  const balance = mining ? computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    now,
  }) : 0;
  const claimable = Math.floor(balance);

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

      <div className="mining-card mining-card-morph rounded-2xl p-6 text-center relative overflow-hidden">
        <p className="text-xs uppercase tracking-widest text-white/80 font-black">ক্লেইমযোগ্য ব্যালেন্স</p>
        <p className="mono-num text-5xl font-black text-white mt-2 drop-shadow">{claimable} <span className="text-2xl">৳</span></p>
        <p className="text-[11px] text-white/70 mt-2">লাইভ: {balance.toFixed(4)}৳ · শুধুমাত্র পূর্ণ টাকা উইথড্র করা যাবে</p>
        {claimable >= 50 && (
          <button type="button" onClick={() => setAmount(String(claimable))}
            className="mt-4 rounded-xl px-5 py-2.5 font-black text-sm bg-white text-rose btn-press shine">
            💰 সম্পূর্ণ {claimable}৳ ক্লেইম করুন
          </button>
        )}
      </div>

      {/* Provider chooser */}
      {(!walletBkash && !walletNagad) ? (
        <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-4 text-center">
          <p className="text-sm font-bold text-amber">প্রথমে ওয়ালেট নম্বর সেট করুন</p>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <ProviderPill
            selected={provider === "bkash"}
            available={!!walletBkash}
            enabled={payout.bkashEnabled}
            label="📱 বিকাশ"
            tone="rose"
            wallet={walletBkash}
            onClick={() => setProvider("bkash")}
          />
          <ProviderPill
            selected={provider === "nagad"}
            available={!!walletNagad}
            enabled={payout.nagadEnabled}
            label="💳 নগদ"
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
                <p className="mono-num font-black">{Math.floor(Number(w.amount))} ৳</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(w.created_at).toLocaleString()} • {w.provider === "bkash" ? "বিকাশ" : "নগদ"}
                </p>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(w.wallet_number); toast.success("নম্বর কপি হয়েছে"); }}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] mono-num text-cyan hover:underline">
                  {w.wallet_number} <Copy className="w-2.5 h-2.5" />
                </button>
                {w.status === "rejected" && w.admin_note && (
                  <div className="mt-2 rounded-lg bg-rose/10 border border-rose/30 p-2 text-[11px] text-rose leading-snug">
                    <p className="font-black text-[9px] uppercase tracking-widest">Admin এর কারণ</p>
                    <p className="mt-0.5">{w.admin_note}</p>
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
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

function ProviderPill({ selected, available, enabled, label, tone, wallet, onClick }: {
  selected: boolean; available: boolean; enabled: boolean;
  label: string; tone: "rose" | "amber"; wallet: any; onClick: () => void;
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
      <p className={`text-sm font-black text-${tone} flex items-center justify-between`}>
        <span>{label}</span>
        {!enabled && <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose/20 text-rose">বন্ধ</span>}
      </p>
      {wallet ? (
        <p className="mono-num text-[11px] text-navy/80 mt-0.5 truncate">{wallet.number}</p>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-0.5">সেট করা নেই</p>
      )}
    </button>
  );
}
