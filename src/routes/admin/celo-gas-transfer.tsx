import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Fuel, Loader2, Square } from "lucide-react";
import { adminStartCeloSweepJob, adminCeloSweepJobStatus, adminCancelCeloSweepJob } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/celo-gas-transfer")({
  component: CeloGasTransferPage,
  head: () => ({
    meta: [
      { title: "Celo Gas Transfer — Admin" },
      { name: "description", content: "Sweep native CELO from wallet private keys into one receive address." },
      { property: "og:title", content: "Celo Gas Transfer — Admin" },
      { property: "og:description", content: "Sweep native CELO from wallet keys into one address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CeloGasTransferPage() {
  const [to, setTo] = useState("");
  const [keysText, setKeysText] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("celo_sweep_to");
    if (saved) setTo(saved);
  }, []);

  const job = useQuery({
    queryKey: ["celo-sweep-job"],
    queryFn: () => adminCeloSweepJobStatus(),
    refetchInterval: 5000,
  });

  const keys = keysText
    .split(/[\s,;\n]+/)
    .map((k) => k.trim())
    .filter((k) => /^(0x)?[0-9a-fA-F]{64}$/.test(k));

  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to.trim());
  const j: any = job.data;
  const running = j?.status === "running";
  const pct = j?.total_keys ? Math.min(100, Math.round((Number(j.cursor) / Number(j.total_keys)) * 100)) : 0;

  const start = useMutation({
    mutationFn: (useAll: boolean) => {
      localStorage.setItem("celo_sweep_to", to.trim());
      return adminStartCeloSweepJob({ data: { to: to.trim(), keys: useAll ? [] : keys, useNotWhitelisted: useAll } });
    },
    onSuccess: (r: any) => {
      toast.success(`${r.total} টি key সার্ভারে queue হয়েছে — ফোন বন্ধ থাকলেও চলবে`);
      job.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: () => adminCancelCeloSweepJob(),
    onSuccess: () => { toast.success("বন্ধ করা হয়েছে"); job.refetch(); },
  });

  const busy = start.isPending;

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 space-y-3 border border-amber/30">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-amber" />
          <h1 className="text-[12px] font-black uppercase tracking-widest text-amber">Celo gas transfer</h1>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Receive address বসান, নিচে private key গুলো paste করে start দিন। কাজটা সার্ভারে ব্যাকগ্রাউন্ডে চলবে —
          পেজ বন্ধ করলে, ফোনের ডাটা অফ থাকলেও থামবে না, ব্যর্থ হলে অটো রিট্রাই হবে।
        </p>

        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="Receive address (0x...)"
          className="w-full px-2 py-2 rounded-lg bg-surface-2 border border-border text-[11px] mono-num outline-none"
        />
        <textarea
          value={keysText}
          onChange={(e) => setKeysText(e.target.value)}
          rows={8}
          placeholder={"Private keys (এক লাইনে একটা)\n0xabc...\n0xdef..."}
          className="w-full px-2 py-2 rounded-lg bg-surface-2 border border-border text-[10px] mono-num outline-none"
        />
        <p className="text-[10px] text-muted-foreground">সঠিক key পাওয়া গেছে: <b>{keys.length}</b></p>

        <button
          disabled={busy || running || !validTo || keys.length === 0}
          onClick={() => {
            if (!confirm(`${keys.length}টি wallet এর CELO ${to.trim()} এ পাঠাবেন?`)) return;
            start.mutate(false);
          }}
          className="w-full flex items-center justify-center gap-1 py-2.5 rounded-lg bg-amber text-black text-[11px] font-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fuel className="w-3.5 h-3.5" />}
          {running ? "sweep চলছে…" : "এই key গুলোর CELO transfer করুন"}
        </button>

        <button
          disabled={busy || running || !validTo}
          onClick={() => {
            if (!confirm(`সব not-whitelisted key এর CELO ${to.trim()} এ পাঠাবেন?`)) return;
            start.mutate(true);
          }}
          className="w-full py-2 rounded-lg bg-surface-2 border border-border text-[11px] font-black disabled:opacity-50"
        >
          অথবা: সব not-whitelisted key sweep করুন
        </button>
      </div>

      {j && (
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {j.status === "running" ? "চলছে (সার্ভারে)" : j.status === "done" ? "সম্পন্ন" : j.status}
            </p>
            {running && (
              <button onClick={() => cancel.mutate()} className="flex items-center gap-1 text-[10px] text-rose">
                <Square className="w-3 h-3" /> বন্ধ করুন
              </button>
            )}
          </div>
          <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
            <div className="h-full bg-amber transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-[10px] mono-num">
            {j.cursor}/{j.total_keys} key · পাঠানো {j.sent} · dust {j.dust} · খালি {j.empty_count} · ব্যর্থ {j.failed} ·{" "}
            <b className="text-emerald">{Number(j.total_celo ?? 0).toFixed(5)} CELO</b>
          </p>
          {j.error_message && <p className="text-[10px] text-rose">{j.error_message}</p>}
        </div>
      )}

      {Array.isArray(j?.log) && j.log.length > 0 && (
        <div className="glass rounded-xl p-3 max-h-72 overflow-y-auto space-y-1">
          {[...j.log].reverse().map((r: any, i: number) => (
            <div key={`${r.address}-${i}`} className="flex items-center justify-between gap-2 text-[9px] mono-num">
              <span className="truncate text-muted-foreground">{r.address}</span>
              <span className={r.status === "sent" ? "text-emerald shrink-0" : "text-rose shrink-0 truncate max-w-[55%]"}>
                {r.status === "sent"
                  ? `+${Number(r.amount).toFixed(5)} CELO`
                  : r.status === "dust"
                    ? `dust ${Number(r.balance ?? 0).toFixed(6)} — gas বেশি`
                    : r.error}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
