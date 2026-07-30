import { useQuery } from "@tanstack/react-query";
import { adminWhitelistRuns } from "@/lib/admin.functions";
import { Radio, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

function ago(iso?: string | null) {
  if (!iso) return "—";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} সেকেন্ড আগে`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} মিনিট আগে`;
  return `${Math.floor(m / 60)} ঘণ্টা আগে`;
}

/** Live view of the resumable auto whitelist check (100 keys per batch). */
export function WhitelistMonitor() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-whitelist-runs"],
    queryFn: () => adminWhitelistRuns(),
    refetchInterval: 5_000,
    staleTime: 0,
  });

  const current: any = data?.current ?? null;
  const last: any = data?.last ?? null;
  const heartbeat = current?.heartbeat_at ?? current?.started_at;
  const stuck = !!current && Date.now() - new Date(heartbeat).getTime() > 2 * 60 * 1000;
  const live = !!current && !stuck;
  const shown: any = current ?? last;


  const total = (shown?.wallets_total ?? 0) + (shown?.pending_total ?? 0);
  const done = (shown?.wallets_checked ?? 0) + (shown?.pending_checked ?? 0);
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className={`glass rounded-2xl p-4 border-2 space-y-3 ${live ? "border-emerald/50 bg-emerald/5" : "border-cyan/30"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${live ? "text-emerald animate-pulse" : "text-cyan"}`} />
          <p className="text-[11px] uppercase tracking-widest font-black text-cyan">Auto whitelist check</p>
        </div>
        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${live ? "bg-emerald text-white" : "bg-surface-2 text-muted-foreground border border-border"}`}>
          {live ? "🟢 চলছে এখন" : stuck ? "⚠️ আটকে গেছে — আবার শুরু হবে" : "⏳ অপেক্ষায়"}
        </span>

      </div>

      {isLoading ? (
        <div className="py-3 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>
      ) : !shown ? (
        <p className="text-[11px] text-muted-foreground">এখনো কোনো চেক চালু হয়নি — অটো worker শিগগিরই শুরু হবে।</p>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between text-[10px] font-black mb-1">
              <span className="text-muted-foreground">
                {live ? "এই ব্যাচে চেক হয়েছে" : "শেষ চেকে হয়েছে"}
              </span>
              <span className="mono-num text-cyan">{done} / {total}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${live ? "bg-emerald" : "bg-cyan"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Cell label="Batch (১০০/ব্যাচ)" value={String(shown.batches_done ?? 0)} />
            <Cell label="নতুন যোগ হয়েছে" value={String(shown.pending_promoted ?? 0)} accent="emerald" />
            <Cell label="Whitelist হারিয়েছে" value={String(shown.flipped ?? 0)} accent="rose" />
          </div>

          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {shown.status === "error" ? (
              <><AlertTriangle className="w-3 h-3 text-rose" /> সমস্যা: {shown.error_message ?? "unknown"}</>
            ) : live ? (
              <><Loader2 className="w-3 h-3 animate-spin text-emerald" /> সর্বশেষ batch {ago(shown.heartbeat_at ?? shown.started_at)}</>
            ) : (
              <><CheckCircle2 className="w-3 h-3 text-emerald" /> সব key শেষ হয়েছে {ago(shown.finished_at ?? shown.started_at)} · ৩ মিনিট পর নতুন cycle</>
            )}
          </div>

          {(data?.runs?.length ?? 0) > 1 && (
            <div className="border-t border-border pt-2 space-y-1">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-black">শেষ কয়েকটি চেক</p>
              {(data!.runs as any[]).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{ago(r.started_at)}</span>
                  <span className="mono-num">
                    {(r.wallets_checked ?? 0) + (r.pending_checked ?? 0)} চেক · +{r.pending_promoted ?? 0} · -{r.flipped ?? 0}
                  </span>
                  <span className={r.status === "done" ? "text-emerald" : r.status === "running" ? "text-amber" : "text-rose"}>
                    {r.status === "done" ? "✅" : r.status === "running" ? "⏳" : "⚠️"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Cell({ label, value, accent = "cyan" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-background/60 border border-border p-2">
      <p className="text-[9px] text-muted-foreground font-bold leading-tight">{label}</p>
      <p className={`mono-num font-black text-lg text-${accent}`}>{value}</p>
    </div>
  );
}
