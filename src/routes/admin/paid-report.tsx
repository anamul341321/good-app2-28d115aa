import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminPaidReport } from "@/lib/admin.functions";
import { Loader2, Printer, Download, ArrowLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/paid-report")({ component: PaidReport });

function PaidReport() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-paid-report"], queryFn: () => adminPaidReport() });
  const [query, setQuery] = useState("");

  if (isLoading || !data) {
    return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;
  }

  const rows = data.rows.filter((r: any) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.phone?.toLowerCase().includes(q) ||
      String(r.uid ?? "").includes(q)
    );
  });

  const date = new Date(data.generatedAt);
  const dateStr = date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

  const downloadCSV = () => {
    const header = ["Rank", "UID", "Name", "Phone", "Withdraw (TK)", "Recharge (TK)", "Admin Credit (TK)", "Total (TK)"];
    const lines = [header.join(",")];
    rows.forEach((r: any, i: number) => {
      lines.push([
        i + 1,
        r.uid ?? "",
        `"${(r.name ?? "").replace(/"/g, '""')}"`,
        r.phone ?? "",
        r.withdraw.toFixed(2),
        r.recharge.toFixed(2),
        r.adminCredit.toFixed(2),
        r.total.toFixed(2),
      ].join(","));
    });
    lines.push("");
    lines.push(`Grand Total,,,,,,,${data.grandTotal.toFixed(2)}`);
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paid-report-${date.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar — hidden in print */}
      <div className="flex items-center gap-2 print:hidden">
        <Link to="/admin" className="glass rounded-xl p-2"><ArrowLeft className="w-4 h-4" /></Link>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name / phone / UID"
          className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none"
        />
        <button onClick={() => window.print()} className="glass rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1 border border-cyan/40 text-cyan">
          <Printer className="w-4 h-4" /> Print
        </button>
        <button onClick={downloadCSV} className="glass rounded-xl px-3 py-2 text-sm font-bold flex items-center gap-1 border border-emerald/40 text-emerald">
          <Download className="w-4 h-4" /> CSV
        </button>
      </div>

      {/* Printable sheet — white paper look */}
      <div id="paid-report-sheet" className="bg-white text-black rounded-2xl p-6 shadow-2xl print:shadow-none print:rounded-none print:p-4" style={{ fontFamily: "'Noto Sans Bengali', system-ui, sans-serif" }}>
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-2xl font-black tracking-tight">মোট পেমেন্ট রিপোর্ট</h1>
          <p className="text-xs text-gray-600 mt-1">Total Payment Report — Good App</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Generated: {dateStr}</p>
        </div>

        {/* Grand total banner */}
        <div className="border-2 border-black rounded-lg p-3 mb-4 flex items-center justify-between bg-gray-50">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-700">Grand Total Paid</p>
            <p className="text-[10px] text-gray-500">{rows.length} users • সকল withdraw + recharge + admin credit</p>
          </div>
          <p className="font-black text-3xl">৳ {data.grandTotal.toFixed(2)}</p>
        </div>

        {/* Table */}
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-1.5 pr-2 w-8">#</th>
              <th className="py-1.5 pr-2 w-14">UID</th>
              <th className="py-1.5 pr-2">Name</th>
              <th className="py-1.5 pr-2">Phone</th>
              <th className="py-1.5 pr-2 text-right">Withdraw</th>
              <th className="py-1.5 pr-2 text-right">Recharge</th>
              <th className="py-1.5 pr-2 text-right">Admin</th>
              <th className="py-1.5 pl-2 text-right border-l border-gray-300 font-black">Total ৳</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={r.userId} className="border-b border-gray-200 align-top">
                <td className="py-1 pr-2 text-gray-500">{i + 1}</td>
                <td className="py-1 pr-2 font-mono">{r.uid ?? "—"}</td>
                <td className="py-1 pr-2 font-semibold">{r.name}</td>
                <td className="py-1 pr-2 font-mono text-gray-700">{r.phone}</td>
                <td className="py-1 pr-2 text-right font-mono">{r.withdraw.toFixed(0)}</td>
                <td className="py-1 pr-2 text-right font-mono">{r.recharge.toFixed(0)}</td>
                <td className="py-1 pr-2 text-right font-mono">{r.adminCredit.toFixed(0)}</td>
                <td className="py-1 pl-2 text-right font-black border-l border-gray-300">{r.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-black">
              <td colSpan={4} className="py-2 pr-2 text-right uppercase text-xs">Grand Total</td>
              <td className="py-2 pr-2 text-right font-mono">
                {rows.reduce((a: number, r: any) => a + r.withdraw, 0).toFixed(0)}
              </td>
              <td className="py-2 pr-2 text-right font-mono">
                {rows.reduce((a: number, r: any) => a + r.recharge, 0).toFixed(0)}
              </td>
              <td className="py-2 pr-2 text-right font-mono">
                {rows.reduce((a: number, r: any) => a + r.adminCredit, 0).toFixed(0)}
              </td>
              <td className="py-2 pl-2 text-right border-l border-gray-300">৳ {rows.reduce((a: number, r: any) => a + r.total, 0).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-[10px] text-gray-500 text-center border-t border-gray-300 pt-2">
          © Good App — Official Payment Ledger • এই রিপোর্ট শুধু admin ব্যবহারের জন্য
        </p>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { background: white !important; }
          html, body { color: black !important; }
          nav, header, footer, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
