import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminListUsers, adminমুছুনUser, adminReferrerLeaderboard, adminListBlockedUsers, adminSetUserBlocked, adminSendUserNotice } from "@/lib/admin.functions";
import { Loader2, ChevronRight, Trash2, Trophy, Users as UsersIcon, Share2, Crown, Lock, Unlock, Ban, ShieldCheck, Send } from "lucide-react";
import { computeLiveBalance } from "@/lib/mining";
import { toast } from "sonner";
import { useState } from "react";


export const Route = createFileRoute("/admin/users")({ component: AdminUsers });

function AdminUsers() {
  const { data, isLoading, refetch } = useQuery({ queryKey: ["admin-users", "original-first-verifies-v2"], queryFn: () => adminListUsers(), staleTime: 15_000, gcTime: 600_000, refetchOnMount: "always", refetchOnWindowFocus: true });
  const { data: blocked, refetch: refetchBlocked } = useQuery({ queryKey: ["admin-blocked-users"], queryFn: () => adminListBlockedUsers(), staleTime: 15_000, gcTime: 600_000, refetchOnMount: "always", refetchOnWindowFocus: true });
  const { data: refLeaders } = useQuery({ queryKey: ["admin-ref-leaderboard", "original-first-verifies-v2"], queryFn: () => adminReferrerLeaderboard(), staleTime: 15_000, gcTime: 600_000, refetchOnMount: "always", refetchOnWindowFocus: true });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"verifiers" | "referrers" | "all" | "blocked">("verifiers");
  const [showAll, setShowAll] = useState(false);
  const CAP = 40;
  const del = useMutation({
    mutationFn: (userId: string) => adminমুছুনUser({ data: { userId } }),
    onSuccess: () => { toast.success("User deleted"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-cyan" /></div>;

  const rows = (data ?? []).filter((r: any) => {
    if (!q.trim()) return true;
    const raw = q.trim();
    const s = raw.toLowerCase();
    // Pure-numeric query → exact UID / serial match only (no phone/UUID substring noise)
    if (/^\d+$/.test(raw)) {
      return String(r.profile.uid_seq ?? "") === raw
        || String(r.serial ?? "") === raw
        || (r.profile.phone_number ?? "") === raw;
    }
    return (r.profile.display_name ?? "").toLowerCase().includes(s)
      || (r.profile.phone_number ?? "").toLowerCase().includes(s)
      || (r.profile.email ?? "").toLowerCase().includes(s)
      || (r.profile.referral_code ?? "").toLowerCase() === s;
  });

  const verifiedRows = rows
    .filter((r: any) => (r.faceTotal ?? 0) > 0)
    .sort((a: any, b: any) => (b.faceTotal ?? 0) - (a.faceTotal ?? 0));
  const notVerifiedRows = rows.filter((r: any) => (r.faceTotal ?? 0) === 0);
  const completedRows = verifiedRows.filter((r: any) => (r.faceTotal ?? 0) >= 10);

  const renderCard = (row: any, serial?: number) => {
    const m = row.mining;
    const bal = m ? computeLiveBalance({
      accrued: Number(m.accrued_amount), withdrawn: Number(m.withdrawn_amount),
      isActive: m.is_active, lastCreditedAt: m.last_credited_at,
    }) : 0;
    const firstVerifies = row.firstVerifies ?? 0;
    const reverifies = row.reverifies ?? row.done ?? 0;
    return (
      <div key={row.profile.id} className="glass rounded-xl p-3 space-y-2">
        <Link to="/admin/user/$userId" params={{ userId: row.profile.id }} className="flex items-start justify-between gap-2">
          {serial !== undefined && (
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
              serial === 1 ? "bg-amber text-background" :
              serial === 2 ? "bg-cyan/80 text-background" :
              serial === 3 ? "bg-emerald/80 text-background" :
              "bg-surface-2 text-muted-foreground"
            }`}>
              {serial <= 3 ? ["🥇","🥈","🥉"][serial-1] : `#${serial}`}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-violet/15 text-violet mono-num text-[10px] font-black shrink-0">UID {row.serial ?? "—"}</span>
              <p className="font-bold text-sm truncate">{row.profile.display_name ?? "—"}</p>
            </div>
            <p className="text-[10px] text-muted-foreground truncate mono-num">
              {row.profile.phone_number ?? row.profile.email}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="mono-num font-black text-cyan text-sm">{bal.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground">TK</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
        </Link>
        <div className="flex flex-wrap gap-1 text-[10px]">
          <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-black mono-num">✅ verify {firstVerifies}</span>
          <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black mono-num">🔁 re-verify {reverifies}</span>
          {row.referralUnlocked === false && (
            <span className="px-2 py-0.5 rounded-full bg-rose/15 text-rose font-black inline-flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> ref lock</span>
          )}
          {row.referralOverride && (
            <span className="px-2 py-0.5 rounded-full bg-violet/15 text-violet font-black inline-flex items-center gap-0.5"><Unlock className="w-2.5 h-2.5" /> admin unlock</span>
          )}
          {m?.is_active && <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black">MINING</span>}
          {row.wallet && <span className="px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground mono-num">{row.wallet.provider}:{row.wallet.number}</span>}

        </div>
        <button
          onClick={() => { if (confirm("মুছুন this user FOREVER? Wallets, tasks, faces, withdrawals — all gone.")) del.mutate(row.profile.id); }}
          className="text-[10px] text-rose flex items-center gap-1 hover:underline">
          <Trash2 className="w-3 h-3" /> মুছুন user
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 🏆 Top Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile tone="emerald" icon={<Trophy className="w-4 h-4" />} label="Face users" value={verifiedRows.length} />
        <SummaryTile tone="amber" icon={<Crown className="w-4 h-4" />} label="10+ face" value={completedRows.length} />
        <SummaryTile tone="violet" icon={<UsersIcon className="w-4 h-4" />} label="Total" value={rows.length} />
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-surface-2 border border-border">
        <TabBtn active={tab === "verifiers"} onClick={() => setTab("verifiers")} icon={<Trophy className="w-3.5 h-3.5" />} label="Top Verifiers" />
        <TabBtn active={tab === "referrers"} onClick={() => setTab("referrers")} icon={<Share2 className="w-3.5 h-3.5" />} label="Referrers" />
        <TabBtn active={tab === "all"} onClick={() => setTab("all")} icon={<UsersIcon className="w-3.5 h-3.5" />} label="All Users" />
        <TabBtn active={tab === "blocked"} onClick={() => setTab("blocked")} icon={<Ban className="w-3.5 h-3.5" />} label={`Blocked${blocked?.length ? ` (${blocked.length})` : ""}`} />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search: UID (1,2,3…) / name / phone / email / ref code"
        className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan"
      />

      {tab === "verifiers" && (
        <>
          {/* 👑 10+ face complete করা user list — separate box */}
          {completedRows.length > 0 && (
            <div className="rounded-2xl p-3 border-2 border-amber/60 bg-linear-to-br from-amber/15 via-transparent to-emerald/10 space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] uppercase tracking-widest font-black text-amber flex items-center gap-1.5">
                  👑 ১০+ Face Complete — Referral Unlocked
                </p>
                <span className="mono-num text-[11px] font-black text-amber bg-amber/20 px-2.5 py-0.5 rounded-full">
                  {completedRows.length}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                এই user গুলোর ১০+ ফেস verify আছে — referral link auto unlock। সবচেয়ে বেশি verify আগে।
              </p>
              <div className="space-y-2">
                {completedRows.map((r, i) => renderCard(r, i + 1))}
              </div>
            </div>
          )}

          {/* 🥇 Full leaderboard */}
          <div className="rounded-2xl p-3 border-2 border-cyan/30 bg-linear-to-br from-cyan/10 via-transparent to-emerald/5">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] uppercase tracking-widest font-black text-cyan flex items-center gap-1.5">
                🏆 Good-App Face Leaderboard
              </p>
              <span className="mono-num text-[10px] font-black text-cyan bg-cyan/15 px-2 py-0.5 rounded-full">
                {verifiedRows.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground px-1 mb-3">
                শুধুমাত্র সফল Good-App face verification অনুযায়ী serial — failed/backup key এই হিসাবে ধরা হয় না।
            </p>
            {verifiedRows.length === 0 && (
              <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">
                এখনো কেউ verify করেনি।
              </div>
            )}
            <div className="space-y-2">
              {(q.trim() || showAll ? verifiedRows : verifiedRows.slice(0, CAP)).map((r, i) => renderCard(r, i + 1))}
            </div>
            {!q.trim() && !showAll && verifiedRows.length > CAP && (
              <button onClick={() => setShowAll(true)} className="mt-3 w-full py-2 rounded-xl bg-cyan/15 text-cyan text-xs font-black border border-cyan/30">
                আরও {verifiedRows.length - CAP} জন দেখান
              </button>
            )}
          </div>
        </>
      )}

      {tab === "blocked" && (
        <BlockedUsers rows={blocked ?? []} q={q} onChanged={() => { refetchBlocked(); refetch(); }} />
      )}

      {tab === "referrers" && (
        <ReferrerLeaderboard rows={refLeaders ?? []} q={q} />
      )}

      {tab === "all" && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-widest text-emerald font-black">
                ✅ Good-App face আছে
              </p>
              <span className="mono-num text-[10px] font-black text-emerald bg-emerald/10 px-2 py-0.5 rounded-full">
                {verifiedRows.length}
              </span>
            </div>
            {(q.trim() || showAll ? verifiedRows : verifiedRows.slice(0, CAP)).map((r, i) => renderCard(r, i + 1))}
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
                ⚠️ Good-App face নেই
              </p>
              <span className="mono-num text-[10px] font-black text-muted-foreground bg-surface-2 px-2 py-0.5 rounded-full">
                {notVerifiedRows.length}
              </span>
            </div>
            {(q.trim() || showAll ? notVerifiedRows : notVerifiedRows.slice(0, CAP)).map((r) => renderCard(r))}
          </div>

          {!q.trim() && !showAll && (verifiedRows.length > CAP || notVerifiedRows.length > CAP) && (
            <button onClick={() => setShowAll(true)} className="w-full py-2 rounded-xl bg-violet/15 text-violet text-xs font-black border border-violet/30">
              সব দেখান ({verifiedRows.length + notVerifiedRows.length} জন)
            </button>
          )}
        </>
      )}

      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold px-1 text-center">
        মোট {rows.length} / {data?.length ?? 0}
      </p>
    </div>
  );
}

function BlockedUsers({ rows, q, onChanged }: { rows: any[]; q: string; onChanged: () => void }) {
  const [noticeFor, setNoticeFor] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const unblock = useMutation({
    mutationFn: (userId: string) => adminSetUserBlocked({ data: { userId, blocked: false } }),
    onSuccess: () => { toast.success("✅ Unblock করা হলো"); onChanged(); },
    onError: (e: any) => toast.error(e.message),
  });
  const notice = useMutation({
    mutationFn: (v: { userId: string; body: string }) =>
      adminSendUserNotice({ data: { userId: v.userId, title: "⚠️ গুরুত্বপূর্ণ সতর্কবার্তা", body: v.body } }),
    onSuccess: () => { toast.success("📩 Warning পাঠানো হয়েছে"); setNoticeFor(null); setMsg(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return String(r.uid ?? "") === q.trim()
      || (r.name ?? "").toLowerCase().includes(s)
      || (r.phone ?? "").toLowerCase().includes(s)
      || (r.email ?? "").toLowerCase().includes(s);
  });

  return (
    <div className="rounded-2xl p-3 border-2 border-rose/40 bg-linear-to-br from-rose/10 via-transparent to-amber/5 space-y-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] uppercase tracking-widest font-black text-rose flex items-center gap-1.5">
          🚫 Blocked Users
        </p>
        <span className="mono-num text-[10px] font-black text-rose bg-rose/15 px-2 py-0.5 rounded-full">{filtered.length}</span>
      </div>
      <p className="text-[10px] text-muted-foreground px-1">
        এখান থেকে যেকোনো blocked user-কে Warning পাঠাতে পারবেন (টাকা ফেরতের কথা লিখে) এবং প্রয়োজনে সাথে সাথে Unblock করতে পারবেন।
      </p>

      {filtered.length === 0 && (
        <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">কোনো blocked user নেই।</div>
      )}

      {filtered.map((r) => (
        <div key={r.userId} className="glass rounded-xl p-3 space-y-2 border border-rose/25">
          <Link to="/admin/user/$userId" params={{ userId: r.userId }} className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{r.name || "ইউজার"}</p>
              <p className="text-[10px] text-muted-foreground mono-num truncate">UID {r.uid ?? "—"} · {r.phone || "—"}</p>
              <p className="text-[10px] text-rose mt-1 leading-snug">{r.reason || "কারণ লেখা নেই"}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black text-[10px] mono-num">ব্যালেন্স {Math.round(r.balance)}৳</span>
                {r.debt > 0 && <span className="px-2 py-0.5 rounded-full bg-amber/15 text-amber font-black text-[10px] mono-num">বকেয়া {Math.round(r.debt)}৳</span>}
                <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-black text-[10px] mono-num">পেইড {Math.round(r.paid)}৳</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setNoticeFor(noticeFor === r.userId ? null : r.userId)}
              className="flex items-center justify-center gap-1 py-2 rounded-xl bg-amber/15 text-amber text-[11px] font-black border border-amber/30"
            >
              <Send className="w-3.5 h-3.5" /> Warning পাঠান
            </button>
            <button
              disabled={unblock.isPending}
              onClick={() => { if (confirm("এই user-কে unblock করবেন?")) unblock.mutate(r.userId); }}
              className="flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald/15 text-emerald text-[11px] font-black border border-emerald/30 disabled:opacity-50"
            >
              {unblock.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />} Unblock
            </button>
          </div>

          {noticeFor === r.userId && (
            <div className="space-y-2 pt-1">
              <textarea
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
                placeholder={`উদাহরণ: ভুলবশত আপনার account-এ ${Math.round(r.balance) || 0}৳ অতিরিক্ত গিয়েছিল — টাকা ফেরত দিলে account সাথে সাথে খুলে দেওয়া হবে।`}
                className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-border text-xs placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber"
              />
              <button
                disabled={notice.isPending || !msg.trim()}
                onClick={() => notice.mutate({ userId: r.userId, body: msg.trim() })}
                className="w-full py-2 rounded-xl bg-amber text-background text-[11px] font-black disabled:opacity-50"
              >
                {notice.isPending ? "পাঠানো হচ্ছে…" : "📩 Warning পাঠিয়ে দিন"}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryTile({ tone, icon, label, value }: { tone: "emerald" | "amber" | "violet"; icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className={`glass rounded-xl p-2.5 text-center border border-${tone}/20`}>
      <div className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-${tone}/15 text-${tone} mb-1`}>
        {icon}
      </div>
      <p className={`mono-num font-black text-lg text-${tone}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">{label}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-black transition ${
        active ? "bg-linear-to-r from-cyan to-violet text-white shadow" : "text-muted-foreground hover:text-navy"
      }`}
    >
      {icon} <span className="truncate">{label}</span>
    </button>
  );
}

function ReferrerLeaderboard({ rows, q }: { rows: any[]; q: string }) {
  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.name ?? "").toLowerCase().includes(s)
      || (r.phone ?? "").toLowerCase().includes(s)
      || (r.referralCode ?? "").toLowerCase().includes(s)
      || String(r.uid ?? "") === s
      || (r.userId ?? "").toLowerCase().includes(s);
  });
  return (
    <div className="rounded-2xl p-3 border-2 border-violet/40 bg-linear-to-br from-violet/10 via-transparent to-cyan/5">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] uppercase tracking-widest font-black text-violet flex items-center gap-1.5">
          🔗 Referrer Leaderboard
        </p>
        <span className="mono-num text-[10px] font-black text-violet bg-violet/15 px-2 py-0.5 rounded-full">
          {filtered.length}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground px-1 mb-3">
        কার referral থেকে কতজন রেজিস্টার করেছে এবং তারা মোট কতটি সফল Good-App face verification করেছে।
      </p>
      {filtered.length === 0 && (
        <div className="glass rounded-xl p-4 text-center text-[11px] text-muted-foreground">
          কোনো referrer এখনো নেই।
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((r, i) => (
          <Link
            key={r.userId}
            to="/admin/user/$userId"
            params={{ userId: r.userId }}
            className="glass rounded-xl p-3 flex items-center gap-3 hover:border-violet/40 transition"
          >
            <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-xs ${
              i === 0 ? "bg-amber text-background" :
              i === 1 ? "bg-cyan/80 text-background" :
              i === 2 ? "bg-emerald/80 text-background" :
              "bg-surface-2 text-muted-foreground"
            }`}>
              {i < 3 ? ["🥇","🥈","🥉"][i] : `#${i+1}`}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground truncate mono-num">
                UID {r.uid || "—"} · {r.phone} {r.referralCode && <span className="ml-1 text-violet">· {r.referralCode}</span>}
              </p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="px-2 py-0.5 rounded-full bg-cyan/15 text-cyan font-black text-[10px] mono-num">
                  👥 {r.refereeCount} রেফার
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald/15 text-emerald font-black text-[10px] mono-num">
                  ✅ রেফারিদের ১ম ফেস {r.totalFirstVerifies}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet/15 text-violet font-black text-[10px] mono-num">
                  🔁 রেফারিদের রি-ভেরিফাই {r.totalReverifies ?? 0}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-1 leading-tight">
                * এগুলো এই রেফারারের অধীনে থাকা সব ইউজারের মোট গণনা (aggregate) — ইউজার নিজে করেনি।
              </p>

            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
