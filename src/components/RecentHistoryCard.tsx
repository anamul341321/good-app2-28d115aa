import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getMyHistory, type HistoryItem } from "@/lib/history.functions";
import { ArrowDownLeft, ArrowUpRight, Loader2, ReceiptText } from "lucide-react";

const kindLabel: Record<string, string> = {
  recharge: "রিচার্জ",
  card: "কার্ড কিনেছেন",
  withdraw: "উইথড্র",
  transfer_in: "টাকা পেয়েছেন",
  transfer_out: "টাকা পাঠিয়েছেন",
};

/** ড্যাশবোর্ডে সাম্প্রতিক হিসাব — কোন টাকা কোথায় গেল/এলো, এক নজরে। */
export function RecentHistoryCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-history-mini"],
    queryFn: () => getMyHistory(),
    staleTime: 30_000,
  });

  const items = ((data ?? []) as HistoryItem[]).slice(0, 5);

  return (
    <div className="premium-panel rounded-2xl p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ReceiptText className="w-4 h-4 text-cyan" />
          <p className="text-[11px] font-black">সাম্প্রতিক হিসাব</p>
        </div>
        <Link to="/history" className="text-[10px] font-black text-cyan px-2 py-1 rounded-lg bg-cyan/10">
          সব দেখুন →
        </Link>
      </div>

      {isLoading ? (
        <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>
      ) : items.length === 0 ? (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          এখনো কোনো লেনদেন নেই — উইথড্র, রিচার্জ, সেন্ড মানি সব এখানে দেখা যাবে।
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const out = it.kind === "withdraw" || it.kind === "transfer_out" || it.kind === "recharge" || it.kind === "card";
            return (
              <div key={it.id} className="flex items-center gap-2 bg-surface-2/70 rounded-xl px-2 py-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${out ? "bg-rose/15 text-rose" : "bg-emerald/15 text-emerald"}`}>
                  {out ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black truncate">{kindLabel[it.kind] ?? it.kind} · {it.title}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(it.created_at).toLocaleString("bn-BD")}
                    {it.fee > 0 ? ` · ফি ${it.fee}৳` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] mono-num font-black ${out ? "text-rose" : "text-emerald"}`}>
                    {out ? "−" : "+"}{it.total}৳
                  </p>
                  <p className={`text-[8px] font-black uppercase ${
                    it.status === "success" ? "text-emerald" : it.status === "failed" ? "text-rose" : "text-amber"
                  }`}>{it.status_label}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
