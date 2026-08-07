import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPendingSlotResets, respondSlotReset } from "@/lib/slot-reset.functions";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * টেলিগ্রাম সাপোর্ট থেকে কেউ স্লট রিসেট চাইলে ইউজার অ্যাপে ঢুকলেই এই কার্ডটি
 * দেখবে — নিজে "হ্যাঁ" না দিলে কোনো স্লট রিসেট হবে না।
 */
export function SlotResetApproval() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pending-slot-resets"],
    queryFn: () => getPendingSlotResets(),
    refetchInterval: 60_000,
  });

  const respond = useMutation({
    mutationFn: (v: { requestId: string; approve: boolean }) => respondSlotReset({ data: v }),
    onSuccess: async (res: any, variables) => {
      qc.setQueryData<any[]>(["pending-slot-resets"], (requests) =>
        requests?.filter((request) => request.id !== variables.requestId) ?? [],
      );
      await qc.invalidateQueries({ queryKey: ["pending-slot-resets"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      if (res?.approved) {
        toast.success(`স্লট রিসেট সম্পন্ন হয়েছে${res.done?.length ? `: ${res.done.join(", ")}` : ""}`);
      } else {
        toast.success("অনুরোধটি বাতিল করা হয়েছে — কোনো স্লট রিসেট হয়নি।");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "কাজটি করা যায়নি"),
  });

  const req = data?.[0];
  if (!req) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="glass w-full max-w-sm rounded-2xl border border-amber-400/30 p-5">
        <div className="mb-3 flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-extrabold">স্লট রিসেটের অনুমোদন দরকার</h2>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          আপনার একাউন্টের{" "}
          <b className="text-foreground">
            {req.slots.length ? req.slots.map((s) => `${s} নম্বর`).join(", ") : "সব"} স্লট
          </b>{" "}
          রিসেট করার জন্য সাপোর্টে অনুরোধ করা হয়েছে।
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          রিসেট করলে ওই স্লটের ফেস ও কী মুছে যাবে এবং স্লটটি একদম খালি হয়ে যাবে — এরপর নতুন করে ফেস
          ভেরিফিকেশন করতে হবে। আপনি নিজে অনুরোধ না করে থাকলে অবশ্যই <b>না</b> চাপুন।
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl border border-border px-3 py-2 text-sm font-bold"
            disabled={respond.isPending}
            onClick={() => respond.mutate({ requestId: req.id, approve: false })}
          >
            না, বাতিল করুন
          </Button>
          <Button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-amber px-3 py-2 text-sm font-extrabold text-primary-foreground"
            disabled={respond.isPending}
            onClick={() => respond.mutate({ requestId: req.id, approve: true })}
          >
            {respond.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            হ্যাঁ, রিসেট করুন
          </Button>
        </div>
      </div>
    </div>
  );
}
