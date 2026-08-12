import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Sparkles } from "lucide-react";
import { getLeaderboards } from "@/lib/leaderboard.functions";

function fmtWait(sec: number) {
  if (!sec || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}দিন ${h % 24}ঘ`;
  if (h > 0) return `${h}ঘ ${m % 60}মি`;
  if (m > 0) return `${m}মি ${sec % 60}সে`;
  return `${sec}সে`;
}

function useTicker(intervalMs = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

/** Live payment history — lives in the Menu tab so the home screen stays clean. */
export function PaymentHistoryCard() {
  const { data } = useQuery({
    queryKey: ["leaderboards", "v2"],
    queryFn: () => getLeaderboards(),
    staleTime: 120_000,
    retry: 1,
  });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"pending" | "paid" | "top">("top");
  useTicker(1000);

  if (!data) return null;
  const { withdraws = [], avgWaitSeconds = 0, topPayees = [] } = data as any;
  if (withdraws.length === 0 && topPayees.length === 0) return null;

  const filtered = (withdraws as any[]).filter((w) => {
    if (tab === "pending" && w.status !== "pending") return false;
    if (tab === "paid" && w.status !== "paid") return false;
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return String(w.uid).includes(s) || (w.name || "").toLowerCase().includes(s);
  });
  const filteredPayees = (topPayees as any[]).filter((p) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return String(p.uid).includes(s) || (p.name || "").toLowerCase().includes(s);
  });

  const pendingCount = (withdraws as any[]).filter((w) => w.status === "pending").length;
  const grandTotal = (topPayees as any[]).reduce((s, p) => s + Number(p.total), 0);
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const todayTotal = (withdraws as any[]).reduce((s, w) => {
    const ts = new Date(w.processed_at ?? w.created_at).getTime();
    return ts >= startOfToday.getTime() ? s + Number(w.amount) : s;
  }, 0);
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`);

  return (
    <div className="rounded-3xl overflow-hidden shadow-[0_25px_55px_-20px_rgba(236,72,153,0.65)] border-2 border-white/25 relative"
         style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 40%,#f59e0b 75%,#10b981 100%)" }}>
      <div className="pointer-events-none absolute -top-16 -right-16 w-52 h-52 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 w-52 h-52 rounded-full bg-yellow-200/20 blur-3xl" />
      <button onClick={() => setOpen((v) => !v)}
        className="relative w-full flex items-center gap-3 p-4 text-white btn-press">
        <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur border-2 border-white/40 flex items-center justify-center text-3xl shadow-2xl shrink-0 animate-pulse">💸</div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[10px] uppercase tracking-[0.28em] font-black opacity-95 flex items-center gap-1 drop-shadow">
            <Sparkles className="w-3 h-3" /> Live Payment
          </p>
          <p className="text-lg font-black leading-tight drop-shadow-lg">পেমেন্ট হিস্টরি দেখতে ক্লিক করুন</p>
          <p className="text-[11px] opacity-95 font-bold mt-0.5">
            গড় সময়: <span className="mono-num text-yellow-200">{fmtWait(avgWaitSeconds)}</span>
            {pendingCount > 0 && <span className="ml-2 bg-white/25 backdrop-blur rounded-full px-1.5">⏳ {pendingCount}</span>}
            <span className="ml-2 bg-white/25 backdrop-blur rounded-full px-1.5">💰 আজ {Math.floor(todayTotal)}৳</span>
          </p>
        </div>
        <ChevronDown className={`w-6 h-6 text-white transition-transform drop-shadow ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="relative px-4 pb-4 animate-in fade-in slide-in-from-top-1">
          <div className="flex gap-1.5 mb-2">
            <button onClick={() => setTab("top")}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition ${
                tab === "top" ? "bg-yellow-300 text-navy border-yellow-300 shadow-lg" : "bg-white/15 text-white border-white/30"
              }`}>
              🏆 টপ Payee
            </button>
            <button onClick={() => setTab("pending")}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition ${
                tab === "pending" ? "bg-amber text-navy border-amber shadow-lg" : "bg-white/15 text-white border-white/30"
              }`}>
              ⏳ Pending
            </button>
            <button onClick={() => setTab("paid")}
              className={`flex-1 py-1.5 rounded-xl text-[11px] font-black border transition ${
                tab === "paid" ? "bg-emerald text-white border-emerald shadow-lg" : "bg-white/15 text-white border-white/30"
              }`}>
              ✅ Paid
            </button>
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="UID বা নাম দিয়ে খুঁজুন…"
            className="w-full mb-2 px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/30 text-white placeholder:text-white/60 text-xs outline-none focus:border-white"
          />

          {tab === "top" ? (
            <>
              <div className="rounded-xl bg-white/15 backdrop-blur border border-white/30 p-2.5 mb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black text-white">📅 আজকের লেনদেন হয়েছে</p>
                  <p className="mono-num font-black text-yellow-200 text-lg">{Math.floor(todayTotal)}৳</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-white/85">💰 সর্বমোট withdraw payment</p>
                  <p className="mono-num font-black text-white text-sm">{Math.floor(grandTotal)}৳</p>
                </div>
              </div>
              <ol className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredPayees.slice(0, 20).map((p: any, i: number) => (
                  <li key={p.id} className="flex items-center justify-between rounded-xl bg-white/15 backdrop-blur border border-white/25 px-2.5 py-2 text-white">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm font-black w-8 shrink-0 drop-shadow">{medal(i)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{p.name}</p>
                        <p className="text-[10px] opacity-80 mono-num">UID {p.uid}</p>
                      </div>
                    </div>
                    <p className="mono-num text-sm font-black text-yellow-200 shrink-0 drop-shadow">{Math.floor(p.total)}৳</p>
                  </li>
                ))}
                {filteredPayees.length === 0 && (
                  <li className="text-center py-6 text-white/80 text-xs">কোনো রেকর্ড নেই</li>
                )}
              </ol>
              <p className="text-[10px] mt-2 opacity-90 text-white">
                🏆 সবচেয়ে বেশি payment যারা পেয়েছেন — total থেকে সাজানো
              </p>
            </>
          ) : (
            <>
              <ol className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {filtered.slice(0, 100).map((w: any) => {
                  const created = new Date(w.created_at).getTime();
                  const paidAt = w.processed_at ? new Date(w.processed_at).getTime() : null;
                  const endMs = paidAt ?? Date.now();
                  const elapsed = Math.max(0, Math.floor((endMs - created) / 1000));
                  const isPaid = w.status === "paid";
                  const isRej = w.status === "rejected";
                  return (
                    <li key={w.id} className="rounded-xl bg-white/15 backdrop-blur border border-white/25 px-2.5 py-1.5 text-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-black truncate">
                            {w.name} <span className="text-[10px] opacity-70 mono-num">UID {w.uid}</span>
                          </p>
                          <p className="text-[10px] opacity-80 mono-num truncate">
                            {String(w.provider).toUpperCase()} · {w.wallet_masked}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="mono-num font-black text-sm text-yellow-200 drop-shadow">{Math.floor(Number(w.amount))}৳</p>
                          <p className={`text-[10px] font-black ${isPaid ? "text-emerald-100" : isRej ? "text-rose-200" : "text-amber-100"}`}>
                            {isPaid ? "✅ Paid" : isRej ? "✕ Rejected" : "⏳ Pending"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] opacity-90">
                        <span className="mono-num">
                          {isPaid ? "সময় লেগেছে" : isRej ? "সময়" : "কাউন্টডাউন"}: <span className={isPaid ? "text-emerald-100" : "text-yellow-200"}>{fmtWait(elapsed)}</span>
                        </span>
                        <span className="mono-num opacity-70">{new Date(w.created_at).toLocaleDateString("bn-BD")}</span>
                      </div>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="text-center py-6 text-white/80 text-xs">কোনো রেকর্ড নেই</li>
                )}
              </ol>
              <p className="text-[10px] mt-2 opacity-90 text-white">
                গোপনীয়তার জন্য নম্বর হাইড করা — শুধু নাম ও UID দেখানো হচ্ছে
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
