import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Coins, Copy } from "lucide-react";
import { toast } from "sonner";
import { adminGdTransfersForDay } from "@/lib/gd-transfers.functions";

export const Route = createFileRoute("/admin/gd-transfers")({
  component: GdTransfersPage,
  head: () => ({
    meta: [
      { title: "G$ Transfer হিসাব — Admin" },
      { name: "description", content: "Daily G$ transferred from app wallets, per network." },
      { property: "og:title", content: "G$ Transfer হিসাব — Admin" },
      { property: "og:description", content: "Daily G$ transfer totals by network and receiving address." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function dhakaToday() {
  return new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
}

function GdTransfersPage() {
  const [date, setDate] = useState(dhakaToday());
  const isToday = date === dhakaToday();
  const q = useQuery({
    queryKey: ["gd-transfers", date],
    queryFn: () => adminGdTransfersForDay({ data: { date } }),
    staleTime: 60_000,
    // আজকের দিন হলে প্রতি ৩০ সেকেন্ডে লাইভ আপডেট
    refetchInterval: isToday ? 30_000 : false,
  });
  const d: any = q.data;
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-3">
      <div className="glass rounded-xl p-3 space-y-3 border border-emerald/30">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-emerald" />
          <h1 className="text-[12px] font-black uppercase tracking-widest text-emerald">G$ transfer হিসাব</h1>
        </div>
        <p className="text-[10px] text-muted-foreground">
          অ্যাপের সব wallet থেকে ওই দিনে (ঢাকা সময়) Celo আর XDC — দুই নেটওয়ার্কে মোট কত G$ বের হয়েছে আর কোন address-এ গেছে। আজকের হিসাব প্রতি ৩০ সেকেন্ডে লাইভ আপডেট হয়।
        </p>
        <div className="flex gap-2">
          <input
            type="date"
            value={date}
            max={dhakaToday()}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 px-2 py-2 rounded-lg bg-surface-2 border border-border text-[11px] outline-none"
          />
          <button onClick={() => q.refetch()} className="px-3 rounded-lg bg-surface-2 border border-border text-[11px] font-black">
            রিফ্রেশ
          </button>
        </div>
      </div>

      {q.isFetching && !d && (
        <div className="glass rounded-xl p-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> ব্লকচেইন থেকে হিসাব আনা হচ্ছে… (৩০–৬০ সেকেন্ড লাগতে পারে)
        </div>
      )}
      {q.error && <p className="text-[11px] text-rose">{(q.error as Error).message}</p>}

      {d && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="সর্বমোট G$" value={fmt(d.grandTotal)} highlight />
            <Stat label="মোট transfer" value={String(d.grandCount)} />
            <Stat label="wallet চেক" value={String(d.walletsTracked)} />
          </div>

          {d.networks.map((n: any) => (
            <div key={n.key} className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest">{n.label} নেটওয়ার্ক</p>
                {q.isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
              {n.error ? (
                <p className="text-[10px] text-rose">এই নেটওয়ার্কের হিসাব আনা যায়নি: {n.error}</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="মোট G$" value={fmt(n.total)} />
                    <Stat label="wallet থেকে" value={String(n.wallets)} />
                    <Stat label="transfer" value={String(n.count)} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pt-1">
                    কোন address-এ গেছে ({n.receivers.length})
                  </p>
                  {n.receivers.length === 0 && <p className="text-[11px] text-muted-foreground">এই দিনে {n.label}-এ কোনো G$ transfer হয়নি।</p>}
                  {n.receivers.map((r: any) => (
                    <div key={r.address} className="rounded-lg bg-surface-2 p-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] mono-num truncate">{r.address}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.address); toast.success("কপি হয়েছে"); }}
                          className="shrink-0 text-muted-foreground"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[11px]">
                        <b className="text-emerald">{fmt(r.total)} G$</b>
                        <span className="text-muted-foreground"> · {r.wallets}টা wallet থেকে · {r.count}টা transfer</span>
                      </p>
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}

          {isToday && (
            <p className="text-[9px] text-muted-foreground text-center">আজকের হিসাব লাইভ — প্রতি ৩০ সেকেন্ডে নিজে আপডেট হয়।</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="glass rounded-xl p-2 text-center">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className={`text-[13px] font-black mono-num ${highlight ? "text-emerald" : ""}`}>{value}</p>
    </div>
  );
}
