import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLeaderboards } from "@/lib/leaderboard.functions";
import { Crown, BadgeCheck, ChevronDown } from "lucide-react";

/** Top referrers / top verifiers board — lives in the Menu page. */
export function Leaderboards() {
  const { data } = useQuery({
    queryKey: ["leaderboards", "v2"],
    queryFn: () => getLeaderboards(),
    staleTime: 120_000,
    retry: 1,
  });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ref" | "ver">("ref");

  if (!data) return null;
  const { topReferrers = [], topVerified = [] } = data as any;
  if (topReferrers.length === 0 && topVerified.length === 0) return null;

  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);
  const rows = tab === "ref" ? topReferrers : topVerified;

  return (
    <div className="rounded-3xl overflow-hidden shadow-xl border border-white/10"
         style={{ background: tab === "ref"
           ? "linear-gradient(135deg,#f59e0b 0%,#ef4444 55%,#8b5cf6 100%)"
           : "linear-gradient(135deg,#0ea5e9 0%,#22d3ee 50%,#10b981 100%)" }}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-white btn-press">
        <div className="w-11 h-11 rounded-2xl bg-white/25 backdrop-blur border border-white/40 flex items-center justify-center text-2xl shadow-lg shrink-0">🏆</div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-95 flex items-center gap-1">
            <Crown className="w-3 h-3" /> লিডারবোর্ড
          </p>
          <p className="text-base font-black leading-tight drop-shadow">টপ ১০ রেফারার · টপ ১০ ভেরিফায়ার</p>
          <p className="text-[11px] opacity-95 font-bold mt-0.5">দেখতে ক্লিক করুন</p>
        </div>
        <ChevronDown className={`w-5 h-5 text-white transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1">
          <div className="flex gap-2 mb-3">
            <button onClick={() => setTab("ref")}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition ${
                tab === "ref" ? "bg-white text-navy border-white" : "bg-white/10 text-white border-white/30"
              }`}>
              <Crown className="w-3 h-3 inline mr-1" /> টপ রেফারার
            </button>
            <button onClick={() => setTab("ver")}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition ${
                tab === "ver" ? "bg-white text-navy border-white" : "bg-white/10 text-white border-white/30"
              }`}>
              <BadgeCheck className="w-3 h-3 inline mr-1" /> টপ ভেরিফায়ার
            </button>
          </div>
          <ol className="space-y-1.5">
            {rows.slice(0, 10).map((r: any, i: number) => (
              <li key={r.id} className="flex items-center justify-between rounded-xl bg-white/15 backdrop-blur border border-white/20 px-2.5 py-1.5 text-white">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-black w-7 shrink-0">{medal(i)}</span>
                  <span className="text-sm font-black truncate">{r.name}</span>
                  <span className="text-[10px] opacity-80 mono-num shrink-0">UID {r.uid}</span>
                </div>
                <span className="mono-num text-sm font-black shrink-0">{r.count}</span>
              </li>
            ))}
          </ol>
          <p className="text-[10px] mt-2 opacity-90 text-white">
            {tab === "ref"
              ? "রেফারদের কাছ থেকে সবচেয়ে বেশি ভেরিফিকেশন এসেছে যাদের"
              : "সবচেয়ে বেশি ফেস ভেরিফাই করা ইউজার"}
          </p>
        </div>
      )}
    </div>
  );
}
