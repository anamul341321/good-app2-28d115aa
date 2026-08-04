import { useRef, useState } from "react";
import { Printer, Download, FileText, X, Loader2 } from "lucide-react";

const tk = (n: number) => `${n.toFixed(2)}৳`;
const bn = (s: string) => new Date(s).toLocaleString("bn-BD");

export type StatementRow = { id: string; label: string; note?: string | null; amount: number; created_at: string };
export type StatementStep = { key: string; label: string; formula?: string | null; amount: number };
export type StatementData = {
  name: string;
  uid?: string | number | null;
  phone?: string | null;
  balance: number;
  totalIn: number;
  totalOut: number;
  debt?: number;
  sources: { key: string; label: string; amount: number }[];
  outs: { label: string; amount: number }[];
  rows: StatementRow[];
  bonusSteps?: StatementStep[];
  bonusTotal?: number;
  miningSteps?: StatementStep[];
  miningTotal?: number;
};

/**
 * Printable / downloadable "আয়ের বিবরণী" — a clean white paper sheet that
 * explains in plain Bengali where every taka came from and where it went.
 * Shared by the user's own earnings page and the admin user-detail panel.
 */
export function EarningsStatement({ data, onClose }: { data: StatementData; onClose?: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const downloadPng = async () => {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(sheetRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const link = document.createElement("a");
      link.download = `earnings-${data.uid ?? "user"}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } finally {
      setBusy(false);
    }
  };

  const totalIn = data.totalIn;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 print:hidden">
        <button onClick={() => window.print()} className="rounded-xl px-3 py-2 text-[12px] font-black flex items-center gap-1.5 border border-cyan/40 text-cyan bg-cyan/5 btn-press">
          <Printer className="w-3.5 h-3.5" /> প্রিন্ট
        </button>
        <button onClick={downloadPng} disabled={busy} className="rounded-xl px-3 py-2 text-[12px] font-black flex items-center gap-1.5 border border-emerald/40 text-emerald bg-emerald/5 btn-press disabled:opacity-60">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} ছবি ডাউনলোড
        </button>
        {onClose && (
          <button onClick={onClose} className="ml-auto rounded-xl px-3 py-2 text-[12px] font-black flex items-center gap-1.5 border border-border text-muted-foreground btn-press">
            <X className="w-3.5 h-3.5" /> বন্ধ
          </button>
        )}
      </div>

      <div
        ref={sheetRef}
        className="print-card-sheet bg-white text-black rounded-2xl p-5 shadow-xl print:shadow-none print:rounded-none"
        style={{ fontFamily: "'Noto Sans Bengali', system-ui, sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black/80 pb-3">
          <div>
            <p className="text-[18px] font-black leading-tight">good-app · আয়ের বিবরণী</p>
            <p className="text-[11px] text-black/60">টাকা কোথা থেকে এসেছে, কোথায় গেছে — সম্পূর্ণ হিসাব</p>
          </div>
          <FileText className="w-7 h-7 text-black/40" />
        </div>

        {/* Who */}
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
          <Field label="নাম" value={data.name || "—"} />
          <Field label="UID" value={String(data.uid ?? "—")} />
          <Field label="তারিখ" value={new Date().toLocaleString("bn-BD")} />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Sum label="মোট আয়" value={tk(data.totalIn)} tone="#047857" />
          <Sum label="মোট খরচ/তোলা" value={tk(data.totalOut)} tone="#b91c1c" />
          <Sum label="এখন ব্যালেন্স" value={tk(data.balance)} tone="#0369a1" />
        </div>
        <p className="text-[11px] mt-2 leading-relaxed">
          সহজ কথায়: মোট <b>{tk(data.totalIn)}</b> আয় হয়েছে, তার মধ্যে <b>{tk(data.totalOut)}</b> তোলা/খরচ হয়েছে
          {(data.debt ?? 0) > 0 ? <> এবং <b>{tk(data.debt ?? 0)}</b> warning/ঋণ বাকি আছে</> : null}, তাই এখন হাতে আছে <b>{tk(data.balance)}</b>।
        </p>

        {/* Income sources table */}
        <p className="text-[12px] font-black mt-4 mb-1">১) আয়ের উৎস</p>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-black/5">
              <th className="text-left p-1.5 border border-black/15">উৎস</th>
              <th className="text-right p-1.5 border border-black/15 w-24">টাকা</th>
              <th className="text-right p-1.5 border border-black/15 w-16">ভাগ</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.length === 0 && (
              <tr><td colSpan={3} className="p-2 text-center border border-black/15 text-black/50">এখনো কোনো আয় হয়নি</td></tr>
            )}
            {data.sources.map((s) => (
              <tr key={s.key}>
                <td className="p-1.5 border border-black/15">{s.label}</td>
                <td className="p-1.5 border border-black/15 text-right font-bold">{tk(s.amount)}</td>
                <td className="p-1.5 border border-black/15 text-right">{totalIn > 0 ? Math.round((s.amount / totalIn) * 100) : 0}%</td>
              </tr>
            ))}
            <tr className="bg-black/5 font-black">
              <td className="p-1.5 border border-black/15">মোট আয়</td>
              <td className="p-1.5 border border-black/15 text-right">{tk(data.totalIn)}</td>
              <td className="p-1.5 border border-black/15 text-right">100%</td>
            </tr>
          </tbody>
        </table>

        {/* Step-by-step reconciliation */}
        {(data.bonusSteps?.length || data.miningSteps?.length) ? (
          <>
            <p className="text-[12px] font-black mt-4 mb-1">১ক) ধাপে ধাপে হিসাব</p>
            {data.bonusSteps?.length ? (
              <StepTable title={`🎉 বোনাস — মোট ${tk(data.bonusTotal ?? 0)}`} steps={data.bonusSteps} total={data.bonusTotal ?? 0} />
            ) : null}
            {data.miningSteps?.length ? (
              <StepTable title={`⛏️ মাইনিং — মোট ${tk(data.miningTotal ?? 0)}`} steps={data.miningSteps} total={data.miningTotal ?? 0} />
            ) : null}
          </>
        ) : null}

        {/* Outgoing */}
        {data.outs.length > 0 && (
          <>
            <p className="text-[12px] font-black mt-4 mb-1">২) টাকা কোথায় গেছে</p>
            <table className="w-full text-[11px] border-collapse">
              <tbody>
                {data.outs.map((o) => (
                  <tr key={o.label}>
                    <td className="p-1.5 border border-black/15">{o.label}</td>
                    <td className="p-1.5 border border-black/15 text-right font-bold">-{tk(o.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-black/5 font-black">
                  <td className="p-1.5 border border-black/15">মোট</td>
                  <td className="p-1.5 border border-black/15 text-right">-{tk(data.totalOut)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        {/* Ledger */}
        <p className="text-[12px] font-black mt-4 mb-1">৩) তারিখ অনুযায়ী পূর্ণ হিসাব</p>
        <table className="w-full text-[10.5px] border-collapse">
          <thead>
            <tr className="bg-black/5">
              <th className="text-left p-1.5 border border-black/15">তারিখ</th>
              <th className="text-left p-1.5 border border-black/15">বিবরণ</th>
              <th className="text-right p-1.5 border border-black/15 w-24">টাকা</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr><td colSpan={3} className="p-2 text-center border border-black/15 text-black/50">কোনো লেনদেন নেই</td></tr>
            )}
            {data.rows.slice(0, 200).map((r) => (
              <tr key={r.id}>
                <td className="p-1.5 border border-black/15 whitespace-nowrap">{bn(r.created_at)}</td>
                <td className="p-1.5 border border-black/15">
                  {r.label}
                  {r.note ? <span className="block text-black/50">{r.note}</span> : null}
                </td>
                <td className={`p-1.5 border border-black/15 text-right font-bold ${r.amount < 0 ? "text-red-700" : ""}`}>
                  {r.amount > 0 ? "+" : ""}{tk(r.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[9.5px] text-black/55 mt-3 leading-relaxed border-t border-black/20 pt-2">
          ℹ️ মাইনিং প্রতি সেকেন্ডে জমা হয়, তাই ক্লেইম না করা মাইনিং আয় “আয়ের উৎস”-এ দেখানো হয় কিন্তু নিচের তারিখভিত্তিক হিসাবে শুধু ক্লেইম করা অংশ থাকে।
          রেফার ১০% কমিশন আলাদা ওয়ালেটে যায় না — মাইনিং ব্যালেন্সের সাথেই যোগ হয়।
        </p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/15 rounded-lg px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-black/50 font-bold">{label}</p>
      <p className="text-[11.5px] font-black truncate">{value}</p>
    </div>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="border-2 rounded-xl px-2 py-2 text-center" style={{ borderColor: tone }}>
      <p className="text-[9px] uppercase tracking-wider text-black/55 font-bold">{label}</p>
      <p className="text-[14px] font-black" style={{ color: tone }}>{value}</p>
    </div>
  );
}
