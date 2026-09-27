import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gift, CheckCircle2, Loader2, AlertTriangle, Timer } from "lucide-react";
import { claimDailyMining, getDailyMiningStatus } from "@/lib/earnings.functions";

/** পরের ক্লেইম সময় = ঢাকার সন্ধ্যা ৬টা (UTC ১২টা)। */
function nextResetMs(now: number): number {
  const d = new Date(now);
  const reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0);
  return now < reset ? reset : reset + 24 * 3600 * 1000;
}

function useCountdownToReset() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, nextResetMs(now) - now);
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  return `${h} ঘণ্টা ${m} মিনিট ${sec} সেকেন্ড`;
}

export function DailyClaimCard() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getDailyMiningStatus);
  const doClaim = useServerFn(claimDailyMining);
  const { data: s } = useQuery({ queryKey: ["daily-mining-status"], queryFn: () => fetchStatus(), staleTime: 30_000 });
  const claim = useMutation({
    mutationFn: () => doClaim(),
    onSuccess: (r) => {
      toast.success(`🎉 ${r.total.toFixed(2)}৳ পেন্ডিং ব্যালেন্সে যোগ হয়েছে! ১ তারিখে মেইন ব্যালেন্সে যাবে।`);
      void qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "ক্লেইম হয়নি"),
  });
  if (!s) return null;
  const canClaim = !s.claimedToday && s.amount > 0;

  return (
    <div className="rounded-3xl p-4 border border-primary/30 bg-gradient-to-br from-primary/25 via-card to-accent/20 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-5 h-5 text-primary" />
        <p className="font-black text-foreground">আজকের মাইনিং ক্লেইম</p>
      </div>
      <p className="text-3xl font-black text-foreground">{s.amount.toFixed(2)}৳</p>
      <p className="text-xs text-muted-foreground mt-1">
        {s.slots}টি ঘর × {s.perSlot.toFixed(2)}৳{s.referralAmount > 0 ? ` + রেফার ${s.referralAmount.toFixed(2)}৳` : ""} · দিনে একবার
      </p>
      {s.claimedToday ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-muted py-3 text-sm font-bold text-muted-foreground">
          <CheckCircle2 className="w-4 h-4" /> আজকের ক্লেইম শেষ — পরের ক্লেইম সন্ধ্যা ৬টায়
        </div>
      ) : (
        <button
          type="button"
          disabled={!canClaim || claim.isPending}
          onClick={() => claim.mutate()}
          className="mt-3 w-full rounded-2xl py-3.5 font-black text-base text-primary-foreground bg-gradient-to-r from-primary to-accent shadow-xl active:scale-95 transition disabled:opacity-50"
        >
          {claim.isPending ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `✨ ${s.amount.toFixed(2)}৳ ক্লেইম করুন`}
        </button>
      )}
      <p className="text-[11px] text-muted-foreground mt-2">
        প্রতিদিন সন্ধ্যা ৬টা থেকে পরের দিন সন্ধ্যা ৬টার মধ্যে একবার ক্লেইম করুন। না করলে ওই দিনের টাকা বাতিল হবে। ক্লেইম করা টাকা পেন্ডিং-এ থাকবে, প্রতি মাসের ১ তারিখে মেইন ব্যালেন্সে যাবে।
      </p>
      {s.blockedPending > 0 && (
        <div className="mt-2 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-foreground">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span>{s.blockedSlots}টি ঘর whitelist-এ নেই — {s.blockedPending.toFixed(2)}৳ পেন্ডিং-এ আটকে আছে। Re-verify সম্পন্ন করলে এই টাকা মেইন ব্যালেন্সে যাবে।</span>
        </div>
      )}
    </div>
  );
}
