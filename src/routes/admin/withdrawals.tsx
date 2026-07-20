import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListWithdrawals, adminUpdateWithdrawal } from "@/lib/admin.functions";
import { Loader2, Check, X, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/withdrawals")({ component: AdminWithdrawals });

function AdminWithdrawals() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-withdrawals"], queryFn: () => adminListWithdrawals() });

  const mut = useMutation({
    mutationFn: (input: { id: string; action: "paid" | "rejected" }) => adminUpdateWithdrawal({ data: input }),
    onSuccess: () => { toast.success("Updated"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast.success(`${label} কপি হয়েছে`);
  };

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  return (
    <div className="space-y-2">
      {(data ?? []).length === 0 && <p className="text-center text-xs text-muted-foreground py-6">No withdrawals</p>}
      {(data ?? []).map((w: any) => {
        const isBkash = w.provider === "bkash";
        return (
        <div key={w.id} className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="mono-num font-black text-lg">{Number(w.amount).toFixed(2)} TK</p>
              <p className="text-[11px] font-bold truncate">{w.profiles?.display_name ?? w.profiles?.email}</p>
              {w.profiles?.phone_number && (
                <button
                  type="button"
                  onClick={() => copy(w.profiles.phone_number, "User number")}
                  className="text-[10px] text-muted-foreground mono-num inline-flex items-center gap-1 hover:text-cyan">
                  User: {w.profiles.phone_number} <Copy className="w-2.5 h-2.5" />
                </button>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(w.created_at).toLocaleString()}</p>
            </div>
            <span className={`text-[10px] font-black px-2 py-1 rounded-full shrink-0 ${
              w.status === "paid" ? "bg-emerald/15 text-emerald" :
              w.status === "rejected" ? "bg-rose/15 text-rose" :
              "bg-amber/15 text-amber"
            }`}>{w.status.toUpperCase()}</span>
          </div>

          {/* Big prominent payout number */}
          <button
            type="button"
            onClick={() => copy(w.wallet_number, isBkash ? "বিকাশ নম্বর" : "নগদ নম্বর")}
            className={`w-full rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 border-2 transition active:scale-[0.98] ${
              isBkash
                ? "bg-rose/10 border-rose/40 hover:border-rose"
                : "bg-amber/10 border-amber/40 hover:border-amber"
            }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                isBkash ? "bg-rose text-white" : "bg-amber text-background"
              }`}>
                {isBkash ? "বিকাশ" : "নগদ"}
              </span>
              <span className="mono-num font-black text-base tracking-wider truncate">{w.wallet_number}</span>
            </div>
            <Copy className={`w-4 h-4 shrink-0 ${isBkash ? "text-rose" : "text-amber"}`} />
          </button>

          {w.status === "pending" && (
            <div className="flex gap-2">
              <button onClick={() => mut.mutate({ id: w.id, action: "paid" })}
                className="flex-1 py-2 rounded-lg bg-emerald/20 text-emerald font-bold text-xs flex items-center justify-center gap-1">
                <Check className="w-3.5 h-3.5" /> Mark paid
              </button>
              <button onClick={() => mut.mutate({ id: w.id, action: "rejected" })}
                className="flex-1 py-2 rounded-lg bg-rose/20 text-rose font-bold text-xs flex items-center justify-center gap-1">
                <X className="w-3.5 h-3.5" /> Reject (refund)
              </button>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

