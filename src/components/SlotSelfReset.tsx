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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-5 backdrop-blur-md">
          <div className="glass w-full max-w-md rounded-3xl border-2 border-amber-400/40 p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center gap-3 text-amber-400">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-400/30">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2 className="text-center text-xl font-extrabold leading-tight">
                স্লট #{slot} রিসেট করবেন?
              </h2>
            </div>
            <div className="space-y-3 text-center">
              <p className="text-sm leading-relaxed text-foreground/90">
                রিসেট করলে এই স্লটের ফেস ও ওয়ালেট কী মুছে যাবে এবং স্লটটি একদম খালি হয়ে যাবে। এরপর
                নতুন করে ফেস ভেরিফিকেশন করতে পারবেন।
              </p>
              <p className="rounded-2xl bg-rose/10 p-3 text-sm font-bold leading-relaxed text-rose ring-1 ring-rose/20">
                সাবধান: নিজে রিসেট করলে আপনি আর ফেরাতে পারবেন না — ফিরিয়ে আনতে অ্যাডমিনকে বলতে
                হবে।
              </p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={reset.isPending}
                className="rounded-xl border border-border px-4 py-3 text-sm font-bold"
              >
                না, থাক
              </button>
              <button
                type="button"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
                className="flex items-center justify-center gap-2 rounded-xl bg-rose/20 px-4 py-3 text-sm font-extrabold text-rose disabled:opacity-60"
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
