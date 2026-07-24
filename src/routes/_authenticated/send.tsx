import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { sendBalance, getMyTransfers, lookupTransferTarget } from "@/lib/transfer.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { computeLiveBalance } from "@/lib/mining";
import { Loader2, Send, Search, ArrowUpRight, ArrowDownLeft, User, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/send")({ component: SendPage });

function BackBar() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between -mt-1 mb-1">
      <button
        onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/home" }))}
        className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-black text-navy"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> পিছনে
      </button>
      <Link to="/home" className="text-[11px] font-black text-violet-600">🏠 হোম</Link>
    </div>
  );
}

const MIN_SEND = 15;

function SendPage() {
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data: history, refetch: refetchHist } = useQuery({ queryKey: ["my-transfers"], queryFn: () => getMyTransfers() });

  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [found, setFound] = useState<any | null>(null);

  // KYC no longer required — anyone can send/receive balance
  const mining = dash?.mining;
  const debtTotal = Number((dash as any)?.debtTotal ?? 0);
  const balance = mining ? Math.floor(computeLiveBalance({
    accrued: Number(mining.accrued_amount), withdrawn: Number(mining.withdrawn_amount),
    isActive: mining.is_active, lastCreditedAt: mining.last_credited_at,
    effectiveTaskCount: Number((mining as any).effective_task_count ?? 0),
    qualifyingReferees: Number((mining as any).qualifying_referees ?? 0),
    debt: debtTotal,
  })) : 0;

  const lookup = useMutation({
    mutationFn: (t: string) => lookupTransferTarget({ data: { target: t } }),
    onSuccess: (r: any) => {
      if (r.self) { toast.error("নিজেকে পাঠানো যাবে না"); setFound(null); return; }
      if (!r.found) { toast.error("এই UID/ফোন-এ কোনো ইউজার নেই"); setFound(null); return; }
      // Receiver KYC no longer required
      setFound(r.user);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const send = useMutation({
    mutationFn: () => sendBalance({ data: { target: target.trim(), amount: Math.floor(Number(amount) || 0), note: note.trim() || null } }),
    onSuccess: (r: any) => {
      toast.success(`✅ ${r.amount}৳ পাঠানো হয়েছে ${r.receiver_name}-এর কাছে`);
      setAmount(""); setNote(""); setTarget(""); setFound(null);
      refetchHist();
    },
    onError: (e: any) => toast.error(e.message ?? "পাঠানো যায়নি"),
  });

  // (KYC gate removed — all users can send balance)

  const amt = Math.floor(Number(amount) || 0);
  const canSubmit = found && amt >= MIN_SEND && amt <= balance && !send.isPending;

  return (
    <div className="space-y-4 pt-2 pb-4">
      <BackBar />

      {/* Premium hero balance */}
      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl"
           style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 50%,#f59e0b 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest opacity-90 font-black leading-none">সেন্ড ব্যালেন্স</p>
              <p className="text-[10px] opacity-80 mt-0.5">অন্য ইউজারকে টাকা পাঠান</p>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-90 font-black">উপলব্ধ ব্যালেন্স</p>
          <p className="mono-num text-5xl font-black leading-none mt-1 drop-shadow-lg">
            {balance}<span className="text-2xl ml-0.5">৳</span>
          </p>
          <p className="text-sm font-black mt-3 flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-xl px-3 py-2 border border-white/20">
            <Sparkles className="w-4 h-4" />
            সর্বনিম্ন <span className="mono-num text-base">১৫৳</span> থেকে পাঠানো যাবে
          </p>
        </div>
      </div>

      <div className="glass rounded-3xl p-4 space-y-4 border border-violet-500/20 shadow-lg">
        <div>
          <label className="text-xs font-black text-navy">🔍 রিসিভারের UID অথবা ফোন নম্বর</label>
          <div className="flex gap-2 mt-1.5">
            <input value={target} onChange={(e) => { setTarget(e.target.value); setFound(null); }}
              placeholder="যেমন: 1234 বা 01712345678"
              className="flex-1 px-4 py-3.5 bg-surface-2 border-2 border-border rounded-2xl font-bold outline-none focus:border-violet-500 transition" />
            <button type="button" onClick={() => lookup.mutate(target.trim())}
              disabled={!target.trim() || lookup.isPending}
              className="rounded-2xl px-4 bg-gradient-to-br from-violet-500 to-pink-500 text-white font-black btn-press disabled:opacity-50 flex items-center gap-1 shadow-lg">
              {lookup.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              খুঁজুন
            </button>
          </div>
        </div>

        {found && (
          <div className="rounded-2xl p-3 border-2 border-emerald/40 bg-emerald/10 flex items-center gap-3">
            {found.avatar_url ? (
              <img src={found.avatar_url} className="w-12 h-12 rounded-full object-cover border-2 border-emerald" alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-emerald/20 flex items-center justify-center"><User className="w-6 h-6 text-emerald" /></div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-black text-navy truncate">✓ {found.display_name || "ইউজার"}</p>
              <p className="text-[11px] text-muted-foreground mono-num">UID: {found.uid_seq} · {found.phone_number}</p>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-black text-navy">💰 কত টাকা পাঠাবেন?</label>
          <input type="number" min={15} value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            placeholder="সর্বনিম্ন ১৫৳"
            className="w-full mt-1.5 px-4 py-3.5 mono-num bg-surface-2 border-2 border-border rounded-2xl text-xl font-black outline-none focus:border-violet-500 transition" />
          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {[15, 25, 50, 100, 200].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))}
                className={`rounded-xl py-2 text-[11px] font-black border-2 btn-press transition ${amount === String(v) ? "bg-violet-500 text-white border-violet-500 shadow-md" : "bg-violet-500/5 text-violet-600 border-violet-500/25"}`}>
                {v}৳
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5 font-bold">
            সর্বনিম্ন <b className="text-violet-600">১৫৳</b> · সর্বোচ্চ <b className="text-violet-600">{balance}৳</b>
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">মেসেজ (ঐচ্ছিক)</label>
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="ছোট নোট..."
            className="w-full mt-1 px-3 py-2 bg-surface-2 border border-border rounded-xl outline-none focus:border-violet-500" />
        </div>

        <button disabled={!canSubmit} onClick={() => send.mutate()}
          className="w-full py-3.5 rounded-xl gradient-cta font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 btn-press">
          {send.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          <Send className="w-4 h-4" /> {amt >= MIN_SEND ? `${amt}৳ পাঠান` : "পাঠান"}
        </button>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 mb-2">ইতিহাস</p>
        {(history ?? []).length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-6">কোনো লেনদেন নেই</p>
        )}
        <div className="space-y-2">
          {(history ?? []).map((t: any) => {
            const out = t.direction === "out";
            const other = out ? t.receiver : t.sender;
            return (
              <div key={t.id} className="glass rounded-xl p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${out ? "bg-rose/15 text-rose" : "bg-emerald/15 text-emerald"}`}>
                  {out ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm truncate">{out ? "পাঠানো →" : "পেয়েছেন ←"} {other?.display_name ?? `UID ${other?.uid_seq ?? "?"}`}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                  {t.note && <p className="text-[11px] text-navy/80 mt-0.5 italic">"{t.note}"</p>}
                </div>
                <p className={`mono-num font-black ${out ? "text-rose" : "text-emerald"}`}>{out ? "-" : "+"}{Math.floor(Number(t.amount))}৳</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
