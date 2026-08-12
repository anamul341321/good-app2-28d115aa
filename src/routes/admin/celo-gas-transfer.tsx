import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Fuel, Loader2 } from "lucide-react";
import { adminSweepCeloFromKeys, adminSweepCeloGas } from "@/lib/admin.functions";

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

const CHUNK = 50;

function CeloGasTransferPage() {
  const [to, setTo] = useState("");
  const [keysText, setKeysText] = useState("");
  const [progress, setProgress] = useState("");
  const [log, setLog] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("celo_sweep_to");
    if (saved) setTo(saved);
  }, []);

  const keys = keysText
    .split(/[\s,;\n]+/)
    .map((k) => k.trim())
    .filter((k) => /^(0x)?[0-9a-fA-F]{64}$/.test(k));

  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to.trim());

  const runKeys = useMutation({
    mutationFn: async () => {
      localStorage.setItem("celo_sweep_to", to.trim());
      const totals = { checked: 0, sent: 0, failed: 0, celo: 0 };
      const rows: any[] = [];
      for (let i = 0; i < keys.length; i += CHUNK) {
        const chunk = keys.slice(i, i + CHUNK);
        const r: any = await adminSweepCeloFromKeys({ data: { to: to.trim(), keys: chunk } });
        totals.checked += r.checked ?? 0;
        totals.sent += r.sent ?? 0;
        totals.failed += r.failed ?? 0;
        totals.celo += Number(r.totalCelo ?? 0);
        rows.push(...(r.results ?? []));
        setLog([...rows]);
        setProgress(`${totals.checked}/${keys.length} key · ${totals.sent} পাঠানো · ${totals.celo.toFixed(4)} CELO`);
      }
      setProgress("");
      return totals;
    },
    onSuccess: (t) => toast.success(`⛽ ${t.sent} wallet থেকে ${t.celo.toFixed(4)} CELO · ব্যর্থ ${t.failed}`),
    onError: (e: any) => { setProgress(""); toast.error(e.message); },
  });

  const runAllUnverified = useMutation({
    mutationFn: async () => {
      localStorage.setItem("celo_sweep_to", to.trim());
      let offset = 0;
      const totals = { checked: 0, sent: 0, failed: 0, celo: 0 };
      const rows: any[] = [];
      for (let guard = 0; guard < 500; guard++) {
        const r: any = await adminSweepCeloGas({ data: { to: to.trim(), offset, limit: 50 } });
        totals.checked += r.checked ?? 0;
        totals.sent += r.sent ?? 0;
        totals.failed += r.failed ?? 0;
        totals.celo += Number(r.totalCelo ?? 0);
        rows.push(...(r.results ?? []));
        setLog(rows.slice(-100));
        setProgress(`${totals.checked} key · ${totals.sent} পাঠানো · ${totals.celo.toFixed(4)} CELO`);
        if (r.done) break;
        offset = r.offset ?? offset + 50;
      }
      setProgress("");
      return totals;
    },
    onSuccess: (t) => toast.success(`⛽ ${t.sent} wallet থেকে ${t.celo.toFixed(4)} CELO · ব্যর্থ ${t.failed}`),
    onError: (e: any) => { setProgress(""); toast.error(e.message); },
  });

  const busy = runKeys.isPending || runAllUnverified.isPending;

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 space-y-3 border border-amber/30">
        <div className="flex items-center gap-2">
          <Fuel className="w-4 h-4 text-amber" />
          <h1 className="text-[12px] font-black uppercase tracking-widest text-amber">Celo gas transfer</h1>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Receive address বসান, নিচে private key গুলো paste করুন (এক লাইনে একটা)। একসাথে ৫০+ wallet সার্ভারেই sweep হবে —
          ফোনের ডাটা বন্ধ থাকলেও চলবে, ব্যর্থ হলে অটো রিট্রাই হবে।
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
          disabled={busy || !validTo || keys.length === 0}
          onClick={() => {
            if (!confirm(`${keys.length}টি wallet এর CELO ${to.trim()} এ পাঠাবেন?`)) return;
            runKeys.mutate();
          }}
          className="w-full flex items-center justify-center gap-1 py-2.5 rounded-lg bg-amber text-black text-[11px] font-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fuel className="w-3.5 h-3.5" />}
          {busy ? (progress || "transfer চলছে…") : "এই key গুলোর CELO transfer করুন"}
        </button>

        <button
          disabled={busy || !validTo}
          onClick={() => {
            if (!confirm(`সব not-whitelisted key এর CELO ${to.trim()} এ পাঠাবেন?`)) return;
            runAllUnverified.mutate();
          }}
          className="w-full py-2 rounded-lg bg-surface-2 border border-border text-[11px] font-black disabled:opacity-50"
        >
          অথবা: সব not-whitelisted key sweep করুন
        </button>
      </div>

      {log.length > 0 && (
        <div className="glass rounded-xl p-3 max-h-72 overflow-y-auto space-y-1">
          {log.map((r, i) => (
            <div key={`${r.address}-${i}`} className="flex items-center justify-between gap-2 text-[9px] mono-num">
              <span className="truncate text-muted-foreground">{r.address}</span>
              <span className={r.status === "sent" ? "text-emerald shrink-0" : r.status === "empty" ? "text-muted-foreground shrink-0" : "text-rose shrink-0 truncate max-w-[55%]"}>
                {r.status === "sent"
                  ? `+${Number(r.amount).toFixed(5)} CELO`
                  : r.status === "empty"
                    ? "0 CELO"
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
