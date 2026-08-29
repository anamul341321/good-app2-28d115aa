import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MonitorPlay } from "lucide-react";
import type { DiagStep } from "@/lib/ads-diagnostics";

/**
 * ইউজার সেটিংসে অ্যাড ডায়াগনস্টিক — অ্যাডমিন প্যানেল শুধু ব্রাউজারে চলে,
 * তাই APK-তে টেস্ট করার জন্য এখানে রাখা হয়েছে।
 */
export function AdTestCard() {
  const [diag, setDiag] = useState<DiagStep[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setDiag([]);
    try {
      const { runAdsDiagnostics } = await import("@/lib/ads-diagnostics");
      setDiag(await runAdsDiagnostics());
    } catch (e: any) {
      setDiag([{ name: "Diagnostic crash", ok: false, detail: e?.message ?? String(e) }]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <p className="text-[11px] font-black text-navy">📺 অ্যাড টেস্ট (Diagnostic)</p>
      <p className="text-[9px] text-muted-foreground">
        APK-তে অ্যাড আসছে না কেন তা জানতে এই বাটনে চাপ দিন — প্রতিটি ধাপের আসল ফল/এরর দেখাবে।
      </p>
      <button
        disabled={running}
        onClick={run}
        className="w-full rounded-xl bg-navy/90 py-2.5 text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorPlay className="w-4 h-4" />}
        অ্যাড টেস্ট চালান
      </button>
      {diag.length > 0 && (
        <div className="space-y-1">
          {diag.map((s) => (
            <div key={s.name} className="rounded-lg bg-white/5 p-2">
              <p className={`text-[10px] font-black ${s.ok ? "text-emerald" : "text-rose"}`}>
                {s.ok ? "✅" : "❌"} {s.name}
              </p>
              <p className="text-[9px] break-all text-muted-foreground">{s.detail}</p>
            </div>
          ))}
          <button
            onClick={() => {
              void navigator.clipboard?.writeText(
                diag.map((s) => `${s.ok ? "OK" : "FAIL"} ${s.name}: ${s.detail}`).join("\n"),
              );
              toast.success("রিপোর্ট কপি হয়েছে");
            }}
            className="w-full rounded-xl bg-white/10 py-2 text-[10px] font-bold"
          >
            রিপোর্ট কপি করুন
          </button>
        </div>
      )}
    </div>
  );
}
