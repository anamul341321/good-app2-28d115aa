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

  const [amount, setAmount] = useState<string>("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const mut = useMutation({
    mutationFn: () => requestWithdraw({ data: { amount: Math.floor(Number(amount) || 0) } }),
    onSuccess: () => {
      toast.success("উইথড্র রিকোয়েস্ট পাঠানো হয়েছে! অ্যাডমিন শীঘ্রই প্রসেস করবেন।");
      setAmount("");
      refetch(); refetchHistory();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;

  const wallet = data?.wallet;
  const mining = data?.mining;
  const balance = mining ? computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    now,
  }) : 0;
  const claimable = Math.floor(balance);
  // KYC is optional — no gating on withdraw.

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


      {!wallet ? (
        <Link to="/wallet" className="block rounded-2xl border border-amber/40 bg-amber/10 p-4 text-center">
          <p className="text-sm font-bold text-amber">প্রথমে ওয়ালেট সেট করুন</p>
        </Link>
      ) : claimable < MIN_WITHDRAW_BDT ? (
        <div className="rounded-2xl border border-rose/30 bg-rose/10 p-4 text-center">
          <Lock className="w-6 h-6 text-rose mx-auto mb-1" />
          <p className="text-sm font-bold text-rose">পর্যাপ্ত ব্যালেন্স নেই</p>
          <p className="text-[11px] text-muted-foreground mt-1">সর্বনিম্ন {MIN_WITHDRAW_BDT}৳ ক্লেইমযোগ্য হলে উইথড্র করা যাবে</p>
        </div>
      ) : (
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
            <p><span className="text-muted-foreground">পাঠানো হবে:</span> <span className="font-bold">{wallet.provider === "bkash" ? "বিকাশ" : "নগদ"}</span></p>
            <p className="mono-num"><span className="text-muted-foreground">নম্বর:</span> <span className="font-bold">{wallet.number}</span></p>
          </div>
          <button disabled={mut.isPending || Math.floor(Number(amount) || 0) < MIN_WITHDRAW_BDT || Math.floor(Number(amount) || 0) > claimable}
            data-voice="withdraw.submit"
            className="w-full py-4 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50">
            {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            উইথড্র রিকোয়েস্ট করুন
          </button>

        </form>
      )}

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2">ইতিহাস</p>
        <div className="space-y-2">
          {(history ?? []).length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">কোনো উইথড্র রিকোয়েস্ট নেই</p>
          )}
          {(history ?? []).map((w: any) => (
            <div key={w.id} className="glass rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="mono-num font-black">{Math.floor(Number(w.amount))} ৳</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(w.created_at).toLocaleString()} • {w.provider === "bkash" ? "বিকাশ" : "নগদ"} • {w.wallet_number}
                </p>
              </div>
              <span className={`text-[10px] font-black px-2 py-1 rounded-full ${
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
