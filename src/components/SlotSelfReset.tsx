import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RotateCcw, AlertTriangle } from "lucide-react";
import { selfResetSlot } from "@/lib/slot-reset.functions";

/**
 * প্রতিটি স্লটের নিচে "রিসেট করুন" — ইউজার নিজেই স্লট খালি করে নতুন করে ফেস
 * ভেরিফিকেশন করতে পারবে। ফিরিয়ে আনা শুধু অ্যাডমিন প্যানেল থেকেই সম্ভব।
 */
export function SlotSelfReset({ slot, disabled }: { slot: number; disabled?: boolean }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const reset = useMutation({
    mutationFn: () => selfResetSlot({ data: { slot } }),
    onSuccess: () => {
      setConfirming(false);
      toast.success(`স্লট #${slot} রিসেট হয়েছে — এখন নতুন করে ফেস ভেরিফিকেশন করুন`);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["slot-claims"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "রিসেট করা যায়নি"),
  });

  if (disabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-1 w-full rounded-lg border border-border/70 bg-surface-2/60 px-2 py-1 text-[10.5px] font-bold text-muted-foreground transition hover:text-foreground flex items-center justify-center gap-1"
      >
        <RotateCcw className="h-3 w-3" /> রিসেট করুন
      </button>

      {confirming && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
          <div className="glass w-full max-w-sm rounded-2xl border border-amber-400/30 p-5">
            <div className="mb-2 flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <h2 className="text-base font-extrabold">স্লট #{slot} রিসেট করবেন?</h2>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              রিসেট করলে এই স্লটের ফেস ও ওয়ালেট কী মুছে যাবে এবং স্লটটি একদম খালি হয়ে যাবে। এরপর
              নতুন করে ফেস ভেরিফিকেশন করতে পারবেন।
            </p>
            <p className="mt-2 text-[11px] font-bold leading-relaxed text-rose">
              সাবধান: নিজে রিসেট করলে আপনি আর ফেরাতে পারবেন না — ফিরিয়ে আনতে অ্যাডমিনকে বলতে হবে।
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={reset.isPending}
                className="rounded-xl border border-border px-3 py-2 text-sm font-bold"
              >
                না, থাক
              </button>
              <button
                type="button"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose/20 px-3 py-2 text-sm font-extrabold text-rose disabled:opacity-60"
              >
                {reset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                হ্যাঁ, রিসেট
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
