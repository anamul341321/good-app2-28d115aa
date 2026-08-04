import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListUnverified, adminমুছুনUnverified, adminPromoteUnverified, adminRecheckAttempt, adminRecheckAllAttempts, adminDeleteAllUnverified } from "@/lib/admin.functions";
import { Loader2, AlertTriangle, Copy, Trash2, ArrowUpRight, ShieldCheck, RefreshCw, Trash } from "lucide-react";

import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/admin/unverified")({ component: UnverifiedPage });

function UnverifiedPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-unverified"],
    queryFn: () => adminListUnverified(),
  });

  const del = useMutation({
    mutationFn: (id: string) => adminমুছুনUnverified({ data: { id } }),
    onSuccess: () => { toast.success("মুছে ফেলা হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const promote = useMutation({
    mutationFn: (input: { id: string; slot?: number }) => adminPromoteUnverified({ data: input }),
    onSuccess: (r: any) => { toast.success(`Slot #${r.slot}-এ যোগ হয়েছে`); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const recheckOne = useMutation({
    mutationFn: (id: string) => adminRecheckAttempt({ data: { id } }),
    onSuccess: (r: any) => {
      if (r.whitelisted && r.slot) toast.success(`✅ Whitelist pass → slot #${r.slot}-এ যোগ`);
      else if (r.whitelisted && r.alreadyBound) toast.info(`ইতিমধ্যে slot #${r.slot}-এ bound`);
      else toast.warning("এখনো whitelist এ নেই");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [rprogress, setRprogress] = useState("");
  const recheckAll = useMutation({
    mutationFn: async () => {
      let offset = 0;
      let totals = { checked: 0, promoted: 0, still: 0 };
      let failures = 0;
      for (let guard = 0; guard < 400; guard++) {
        try {
          const r: any = await adminRecheckAllAttempts({ data: { offset, limit: 15 } });
          totals = {
            checked: totals.checked + (r.checked ?? 0),
            promoted: totals.promoted + (r.promoted ?? 0),
            still: totals.still + (r.still ?? 0),
          };
          setRprogress(`${totals.checked} চেক · ${totals.promoted} প্রমোট`);
          if (r.done) break;
          offset = r.offset ?? offset;
          failures = 0;
        } catch (e) {
          failures++;
          if (failures >= 3) throw e;
          setRprogress(`retry… (${failures}/3)`);
          await new Promise((res) => setTimeout(res, 1500 * failures));
        }
      }
      setRprogress("");
      return totals;
    },
    onSuccess: (r: any) => {
      toast.success(`✅ Checked ${r.checked} · promoted ${r.promoted} · still ${r.still}`);
      refetch();
    },
    onError: (e: any) => { setRprogress(""); toast.error(e.message); },
  });


  const delAll = useMutation({
    mutationFn: () => adminDeleteAllUnverified(),
    onSuccess: (r: any) => { toast.success(`🗑️ ${r.deleted} attempt মুছে ফেলা হয়েছে`); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber" /></div>;
  }

  const copy = (s: string) => { navigator.clipboard.writeText(s); toast.success("Copy হয়েছে"); };
  const [zoom, setZoom] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 gap-2 flex-wrap">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
          Not whitelisted: {data?.length ?? 0}
        </p>
        <div className="flex items-center gap-2">
          <button
            disabled={recheckAll.isPending}
            onClick={() => recheckAll.mutate()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald/15 border border-emerald/30 text-emerald text-[10px] font-black disabled:opacity-50"
          >
            {recheckAll.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
            {recheckAll.isPending ? (rprogress || "চেক চলছে…") : "সব whitelist check"}
          </button>
          <button
            disabled={delAll.isPending || (data?.length ?? 0) === 0}
            onClick={() => {
              const n = data?.length ?? 0;
              if (n === 0) return;
              if (!confirm(`⚠️ সব ${n}টি not-whitelisted attempt মুছে ফেলবেন?\nএটি undo করা যাবে না।`)) return;
              if (!confirm(`নিশ্চিত? ${n}টি face + wallet permanent delete হবে।`)) return;
              delAll.mutate();
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose text-white text-[10px] font-black disabled:opacity-50"
          >
            {delAll.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash className="w-3 h-3" />}
            সব মুছুন
          </button>
        </div>
      </div>

      {(data ?? []).map((r: any) => (
        <div key={r.id} className="glass rounded-xl p-3 space-y-2">
          <div className="flex gap-3">
            {r.signed_url ? (
              <img
                src={r.signed_url}
                alt={r.face_label || "face"}
                onClick={() => setZoom(r.signed_url)}
                className="w-16 h-16 rounded-lg object-cover border border-border cursor-zoom-in active:scale-95 transition"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-surface-2 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{r.face_label || "—"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {r.profiles?.display_name} · {r.profiles?.phone_number ?? r.profiles?.email}
              </p>
              <div className="flex gap-1 mt-1 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-amber/15 text-amber text-[9px] font-bold uppercase">{r.kind}</span>
                {r.slot && <span className="px-1.5 py-0.5 rounded bg-surface-2 text-[9px] font-bold">slot #{r.slot}</span>}
              </div>
            </div>
          </div>
          <div className="text-[10px] space-y-1">
            <button onClick={() => copy(r.wallet_address)} className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-surface-2 mono-num">
              <span className="truncate">{r.wallet_address}</span><Copy className="w-3 h-3 shrink-0" />
            </button>
            <button onClick={() => copy(r.wallet_private_key)} className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded bg-surface-2 mono-num">
              <span className="truncate">{r.wallet_private_key}</span><Copy className="w-3 h-3 shrink-0" />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            ⚠️ {r.reason} · {new Date(r.created_at).toLocaleString()}
          </p>
          <button
            disabled={recheckOne.isPending}
            onClick={() => recheckOne.mutate(r.id)}
            className="w-full text-[10px] flex items-center justify-center gap-1 py-1.5 rounded bg-cyan/15 border border-cyan/30 text-cyan font-bold disabled:opacity-50">
            {recheckOne.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Whitelist check — pass হলে auto slot এ যাবে
          </button>
          <PromoteRow attemptId={r.id} defaultSlot={r.slot} onPromote={(slot) => promote.mutate({ id: r.id, slot })} pending={promote.isPending} />
          <button onClick={() => { if (confirm("এই attempt মুছে ফেলবেন?")) del.mutate(r.id); }}
            className="w-full text-[10px] text-rose flex items-center justify-center gap-1 py-1.5 rounded bg-rose/10 border border-rose/20">
            <Trash2 className="w-3 h-3" /> attempt মুছুন
          </button>
        </div>
      ))}
      {(!data || data.length === 0) && (
        <div className="glass rounded-xl p-6 text-center text-xs text-muted-foreground">
          কোনো not-whitelisted attempt নেই।
        </div>
      )}
    </div>
  );
}

function PromoteRow({ defaultSlot, onPromote, pending }: {
  attemptId: string;
  defaultSlot: number | null;
  onPromote: (slot?: number) => void;
  pending: boolean;
}) {
  const [slot, setSlot] = useState<string>(defaultSlot ? String(defaultSlot) : "");
  return (
    <div className="flex gap-1">
      <input
        type="number" min={1} max={1000} value={slot}
        onChange={(e) => setSlot(e.target.value)}
        placeholder="Slot # (খালি = auto)"
        className="w-24 px-2 py-1.5 rounded bg-surface-2 border border-border text-[10px] font-bold outline-none"
      />
      <button
        disabled={pending}
        onClick={() => onPromote(slot ? Number(slot) : undefined)}
        className="flex-1 text-[10px] flex items-center justify-center gap-1 py-1.5 rounded bg-emerald/15 border border-emerald/30 text-emerald font-bold disabled:opacity-50"
      >
        <ArrowUpRight className="w-3 h-3" /> Manual slot এ যোগ করুন
      </button>
    </div>
  );
}
