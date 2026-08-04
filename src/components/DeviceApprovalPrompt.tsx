import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Smartphone, Check, X } from "lucide-react";
import { getDeviceId } from "@/hooks/useDeviceGuard";
import { listPendingDeviceApprovals, decideDeviceApproval } from "@/lib/sessions.functions";

/** মেইন ফোনে দেখানো হয় — নতুন/পুরোনো ফোন ঢুকতে চাইলে অনুমতি চাওয়ার বার্তা */
export function DeviceApprovalPrompt() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingDeviceApprovals);
  const decideFn = useServerFn(decideDeviceApproval);
  const deviceId = typeof window !== "undefined" ? getDeviceId() : "";

  const { data } = useQuery({
    queryKey: ["pending-device-approvals"],
    queryFn: () => listFn({ data: { deviceId } }),
    refetchInterval: 3_000,
    staleTime: 0,
  });


  const pending = (data ?? [])[0];
  if (!pending) return null;

  async function decide(approve: boolean) {
    try {
      await decideFn({ data: { id: pending.id, approve } });
      toast.success(approve ? "অনুমতি দেওয়া হয়েছে ✅" : "অনুরোধটি বাতিল করা হয়েছে");
      await qc.invalidateQueries({ queryKey: ["pending-device-approvals"] });
    } catch (e: any) {
      toast.error(e?.message ?? "কাজটি করা যায়নি");
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-20 z-[80] px-3">
      <div
        className="mx-auto max-w-sm rounded-2xl p-4 text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-500"
        style={{ background: "linear-gradient(140deg,#0ea5e9,#6366f1)" }}
      >
        <p className="text-[13px] font-black flex items-center gap-2">
          <Smartphone className="w-4 h-4" /> নতুন ফোন থেকে লগইন করতে চাইছে
        </p>
        <p className="text-[11.5px] font-bold mt-1 leading-relaxed">
          ফোন: <b translate="no">{pending.label}</b> — এটি আপনি হলে অনুমতি দিন, না হলে বাতিল করুন।
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => decide(true)}
            className="flex-1 rounded-xl py-2.5 font-black text-[13px] bg-white text-indigo-700 btn-press flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" /> অনুমতি দিন
          </button>
          <button
            onClick={() => decide(false)}
            className="flex-1 rounded-xl py-2.5 font-black text-[13px] bg-black/30 btn-press flex items-center justify-center gap-1"
          >
            <X className="w-4 h-4" /> বাতিল
          </button>
        </div>
      </div>
    </div>
  );
}
