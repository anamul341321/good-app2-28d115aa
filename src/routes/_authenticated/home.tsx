import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { addMoreSlots, batchSubmitPending } from "@/lib/tasks.functions";
import { claimVoucher } from "@/lib/vouchers.functions";
import { MiningCounter } from "@/components/MiningCounter";
import bonusGirl from "@/assets/bonus-girl.png";
import { QrCode } from "@/components/QrCode";
import { CheckCircle2, Camera, Lock, Sparkles, Loader2, X, Plus, Crown, Users, Heart, ShieldCheck, BadgeCheck, ChevronDown, MessageCircle, Gift, Share2, Copy } from "lucide-react";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { TourReplayButton } from "@/components/GuidedTour";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { PromoBanner } from "@/components/PromoBanner";

import { toast } from "sonner";



export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

// Home no longer relies on a running countdown — every task-cell time badge
// derives from anchor timestamps, so a live 1-second tick just re-rendered
// every cell and janked scrolling. The context stays for compatibility but
// is now a static value.
const NowContext = createContext<number>(Date.now());
function NowProvider({ children }: { children: React.ReactNode }) {
  return <NowContext.Provider value={Date.now()}>{children}</NowContext.Provider>;
}

// Per-slot vibrant themes — each of the 10 witness slots gets a distinct
// gradient / glow so the grid feels premium instead of monochrome.
const SLOT_THEMES = [
  { from: "#8b5cf6", to: "#ec4899", glow: "139,92,246" },  // slot 1 — violet→pink
  { from: "#06b6d4", to: "#3b82f6", glow: "6,182,212" },   // 2 — cyan→blue
  { from: "#f59e0b", to: "#ef4444", glow: "245,158,11" },  // 3 — amber→red
  { from: "#10b981", to: "#06b6d4", glow: "16,185,129" },  // 4 — emerald→cyan
  { from: "#ec4899", to: "#f43f5e", glow: "236,72,153" },  // 5 — pink→rose
  { from: "#6366f1", to: "#8b5cf6", glow: "99,102,241" },  // 6 — indigo→violet
  { from: "#f97316", to: "#facc15", glow: "249,115,22" },  // 7 — orange→yellow
  { from: "#14b8a6", to: "#22c55e", glow: "20,184,166" },  // 8 — teal→green
  { from: "#a855f7", to: "#6366f1", glow: "168,85,247" },  // 9 — purple→indigo
  { from: "#0ea5e9", to: "#14b8a6", glow: "14,165,233" },  // 10 — sky→teal
  { from: "#f43f5e", to: "#f59e0b", glow: "244,63,94" },   // extra
];
function slotTheme(slot: number) {
  return SLOT_THEMES[(slot - 1) % SLOT_THEMES.length];
}


function HomePage() {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ url: string; label: string; action?: { label: string; onClick: () => void; tone?: "rose" | "amber" } } | null>(null);
  const [openBox, setOpenBox] = useState<number>(0);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchInterval: 30_000,
  });

  const addSlots = useMutation({
    mutationFn: () => addMoreSlots(),
    onSuccess: (r: any) => { toast.success(`✨ আরও ${r.added} জন সাক্ষী যোগ হয়েছে`); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const batchMut = useMutation({
    mutationFn: () => batchSubmitPending(),
    onSuccess: (r: any) => {
      if (r.submitted > 0) {
        toast.success(`✅ ${r.submitted} জন সাক্ষী জমা হয়েছে${r.notWhitelisted ? ` · ${r.notWhitelisted} জন হোয়াইটলিস্টে নেই` : ""}`);
      } else if (r.notWhitelisted > 0) {
        toast.warning(`⚠️ ${r.notWhitelisted} জন এখনো হোয়াইটলিস্টে নেই — পরে আবার চেষ্টা করুন`);
      } else {
        toast.info("জমা দেওয়ার মতো কিছু নেই");
      }
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Show welcome bonus popup once per session while bonuses are pending
  useEffect(() => {
    if (!data) return;
    const b = (data as any).bonus;
    if (!b) return;
    if (b.selfFirstPaid && b.referrerPaid && b.userReverifyPaid) return;
    if (sessionStorage.getItem("welcome-bonus-seen")) return;
    setShowWelcome(true);
    sessionStorage.setItem("welcome-bonus-seen", "1");
  }, [data]);

  if (isLoading || !data) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }

  const tasks = data.tasks as any[];
  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const verifiedCount = tasks.filter((t) => t.status === "verified").length;
  const submittedCount = tasks.filter((t) => t.status !== "empty").length;
  const allSubmitted = total > 0 && submittedCount === total;
  const pct = total ? Math.round((submittedCount / total) * 100) : 0;
  const pendingSubmits: number = (data as any).pendingSubmits ?? 0;

  // Split: slot #1 = main identity, rest = witnesses
  const mainTask = tasks.find((t) => t.slot === 1);
  const witnessTasks = tasks.filter((t) => t.slot !== 1);

  // First empty slot — target for the persistent "জমা দিন" button.
  const firstEmpty = tasks.find((t) => t.status === "empty");

  return (
    <NowProvider>
    <div className="space-y-3 pt-2 pb-6">

      <PageVoice pageId="home" steps={["home.welcome","home.mining","home.claim","home.main","home.witness","home.tap.slot","home.open.photo","reverify.button"]} />
      <AnnouncementTicker />

      <VoucherPopup vouchers={(data as any).vouchers ?? []} onClaimed={() => refetch()} />




      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">স্বাগতম,</p>
        <h1 className="text-xl font-black mt-0.5">
          {data.profile?.display_name ?? "ইউজার"} 👋
        </h1>
        {(data.profile as any)?.uid_seq && (
          <button
            data-voice="home.uid"
            onClick={() => {
              navigator.clipboard.writeText(String((data.profile as any).uid_seq));
              toast.success("UID কপি হয়েছে");
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-md btn-press"
            style={{ background: "linear-gradient(120deg,#8b5cf6,#06b6d4,#10b981)" }}
          >
            <span className="opacity-80">UID</span>
            <span className="mono-num">{String((data.profile as any).uid_seq)}</span>
            <span>📋</span>
          </button>
        )}
      </div>

      {(data.profile as any)?.kyc_verified ? (
        <div className="mx-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald/15 border border-emerald/40 text-emerald text-[11px] font-black">
          <BadgeCheck className="w-3.5 h-3.5" /> KYC ভেরিফাইড
        </div>
      ) : (
        <Link to="/kyc" className="block rounded-2xl p-3 text-center shadow-md btn-press"
              style={{ background: "linear-gradient(120deg,#8b5cf6,#06b6d4)" }}>
          <p className="text-sm font-black text-white flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> KYC (ঐচ্ছিক) — নীল ✔ ব্যাজ চাইলে করুন
          </p>
          <p className="text-[11px] text-white/90 mt-0.5">KYC ছাড়াও সব কাজ চলবে · উইথড্রও করা যাবে</p>
        </Link>
      )}

      <div data-tour="mining" data-voice="home.mining">
      <MiningCounter
        accrued={Number(data.mining?.accrued_amount ?? 0)}
        withdrawn={Number(data.mining?.withdrawn_amount ?? 0)}
        isActive={!!data.mining?.is_active}
        lastCreditedAt={data.mining?.last_credited_at ?? null}
        effectiveTaskCount={Number(data.mining?.effective_task_count ?? 0)}
        qualifyingReferees={Number(data.mining?.qualifying_referees ?? 0)}
        displayTaskCount={submittedCount}
      />
      </div>

      {/* 2X Bonus promo banner — auto-hidden when promo window is closed */}
      <PromoBanner rates={(data as any)?.bonus?.rates ?? null} />

      {/* Premium referral-bonus banner (new users + referrers). Auto-instant payout. */}
      {(() => {
        const b = (data as any).bonus;
        if (!b) return null;
        if (b.selfFirstPaid && b.referrerPaid && b.userReverifyPaid) return null;
        const referralLock = (data as any).referralLock as { unlocked: boolean; firstVerifies: number; needed: number } | undefined;
        const referralUnlocked = referralLock?.unlocked === true;
        const refCode: string | undefined = (data.profile as any)?.referral_code;
        const shareUrl = refCode && referralUnlocked
          ? `${typeof window !== "undefined" ? window.location.origin : "https://good-app2.lovable.app"}/?ref=${refCode}`
          : "";
        const firstPct = Math.min(100, Math.round((b.firstVerifyCount / 10) * 100));
        const reverifyPct = Math.min(100, Math.round((b.reverifyCount / 10) * 100));
        const total = Number(b.totalAmount ?? (b.selfFirstAmount + b.referrerAmount + b.userAmount));
        return (
          <div className="referral-bonus-banner rounded-3xl p-4 relative overflow-hidden text-white shadow-[0_20px_50px_-15px_rgba(139,92,246,0.6)]">
            <div className="referral-bonus-shimmer" />
            <div className="referral-bonus-sparkle" />
            <div className="relative flex items-start gap-3">
              <img src={bonusGirl} alt="Bonus" width={92} height={92}
                className="w-[92px] h-[92px] drop-shadow-2xl -mt-1 animate-bounce shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-[0.25em] font-black text-white/95 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Premium Bonus
                </p>
                <p className="text-[26px] font-black leading-none mt-0.5 drop-shadow-lg">
                  {total}৳ <span className="text-xs font-bold">ইনস্ট্যান্ট!</span>
                </p>
                <p className="text-[11px] text-white/95 leading-snug mt-1 font-bold">
                  🎯 First verify <b>{b.selfFirstAmount}৳</b> · Re-verify <b>{b.userAmount}৳</b> · বন্ধু আনলে <b>{b.referrerAmount}৳</b>
                </p>
              </div>
            </div>

            <div className="relative mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
                <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">✅ First</p>
                <p className="text-[11px] font-black mt-0.5 leading-tight">
                  ১০ Verify → <span className="text-amber-200">{b.selfFirstAmount}৳</span>
                </p>
                <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full bg-amber-300" style={{ width: `${firstPct}%` }} />
                </div>
                <p className="text-[9px] mt-0.5 font-bold">
                  {b.selfFirstPaid ? "✅ পেয়ে গেছেন" : `${b.firstVerifyCount}/10`}
                </p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
                <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">🔄 Re-verify</p>
                <p className="text-[11px] font-black mt-0.5 leading-tight">
                  ১০ Re-verify → <span className="text-amber-200">{b.userAmount}৳</span>
                </p>
                <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full bg-amber-300" style={{ width: `${reverifyPct}%` }} />
                </div>
                <p className="text-[9px] mt-0.5 font-bold">
                  {b.userReverifyPaid ? "✅ পেয়ে গেছেন" : `${b.reverifyCount}/10`}
                </p>
              </div>
              <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
                <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">👥 Refer</p>
                <p className="text-[11px] font-black mt-0.5 leading-tight">
                  বন্ধু ১০ verify → <span className="text-amber-200">{b.referrerAmount}৳</span>
                </p>
                <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div className="h-full bg-amber-300" style={{ width: `${firstPct}%` }} />
                </div>
                <p className="text-[9px] mt-0.5 font-bold">
                  {b.referrerPaid ? "✅ Referrer পেয়েছেন" : "বন্ধু আনুন"}
                </p>
              </div>
            </div>

            {refCode && referralUnlocked ? (
              <div className="relative mt-3 rounded-2xl bg-white p-3 flex items-center gap-3 shadow-lg">
                <div className="shrink-0 rounded-lg overflow-hidden bg-white p-1 border border-navy/10">
                  <QrCode value={shareUrl} size={64} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] uppercase tracking-wider font-black text-muted-foreground">আপনার রেফার কোড</p>
                  <p className="text-lg font-black text-navy mono-num tracking-widest leading-none mt-0.5">{refCode}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("লিংক কপি হয়েছে"); }}
                      className="flex-1 text-[10px] font-black bg-navy text-white rounded-lg py-1.5 flex items-center justify-center gap-1 btn-press">
                      <Copy className="w-3 h-3" /> কপি
                    </button>
                    <button onClick={() => {
                        if (navigator.share) navigator.share({ title: "Good App", url: shareUrl }).catch(() => {});
                        else { navigator.clipboard.writeText(shareUrl); toast.success("লিংক কপি হয়েছে"); }
                      }}
                      className="flex-1 text-[10px] font-black bg-emerald text-white rounded-lg py-1.5 flex items-center justify-center gap-1 btn-press">
                      <Share2 className="w-3 h-3" /> শেয়ার
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative mt-3 rounded-2xl bg-white/95 p-3 flex items-center gap-3 shadow-lg text-navy">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-rose/15 text-rose flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black">রেফার কোড ও লিংক লক আছে</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {referralLock?.firstVerifies ?? 0}/{referralLock?.needed ?? 5} সফল First Verify · ৫টি পূর্ণ হলেই auto unlock হবে।
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* Premium hero submit button — batch-submits all pending keys, or opens next empty slot. */}
      {(pendingSubmits > 0 || firstEmpty || allSubmitted) && (
        <button
          onClick={() => {
            if (pendingSubmits > 0) { batchMut.mutate(); return; }
            if (firstEmpty) {
              router.navigate({ to: "/task/$slot", params: { slot: String(firstEmpty.slot) } });
              return;
            }
            addSlots.mutate();
          }}
          disabled={batchMut.isPending || (!firstEmpty && addSlots.isPending)}
          className="submit-hero w-full rounded-3xl px-5 py-5 text-white font-black btn-press flex items-center gap-3 disabled:opacity-70"
        >
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-3xl border border-white/40 shadow-inner">
            {(batchMut.isPending || (addSlots.isPending && !firstEmpty))
              ? <Loader2 className="w-7 h-7 animate-spin" />
              : <span className="rocket">{pendingSubmits > 0 ? "📦" : "🚀"}</span>}
          </span>
          <span className="flex-1 text-left leading-tight">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-white/85 font-bold">
              {pendingSubmits > 0 ? "ব্যাচ জমা · হোয়াইটলিস্ট চেক" : (firstEmpty ? "এক ট্যাপে সাক্ষী যোগ" : "নতুন ব্যাচ আনলক")}
            </span>
            <span className="block text-2xl font-black drop-shadow-sm mt-0.5">
              {pendingSubmits > 0 ? `সব জমা দিন (${pendingSubmits})` : (firstEmpty ? "জমা দিন" : "আরও ১০ Slot")}
            </span>
            <span className="block text-[11px] text-white/90 font-bold mt-0.5">
              {pendingSubmits > 0
                ? `${pendingSubmits} টি কী প্রস্তুত · হোয়াইটলিস্ট পেলে অটো জমা`
                : (firstEmpty ? `Slot #${firstEmpty.slot} · এখনই ছবি তুলুন` : "১০ জন সম্পন্ন — আরও যোগ করুন")}
            </span>
          </span>
          <span className="shrink-0 text-2xl">→</span>
        </button>
      )}


      {/* Main identity card */}
      {mainTask && (
        <div data-tour="main-identity" data-voice="home.main" className="premium-panel rounded-2xl p-3 relative overflow-hidden"
             style={{ background: "linear-gradient(135deg, rgba(255,209,102,0.15), rgba(239,71,111,0.12))" }}>
          <div className="flex items-center gap-3">
            <div className="shrink-0">
              <MainIdentityCell task={mainTask}
                onStart={() => router.navigate({ to: "/task/$slot", params: { slot: "1" } })}
                onReverify={() => router.navigate({ to: "/reverify", search: { taskId: mainTask.id } as any })}
                onOpenPhoto={(url) => setLightbox({ url, label: `প্রধান পরিচয় · ${mainTask.face_label || "আপনি"}` })} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.15em] font-bold flex items-center gap-1" style={{ color: "var(--color-amber)" }}>
                <Crown className="w-3 h-3" /> প্রধান পরিচয়
              </p>
              <p className="text-sm font-black text-navy mt-0.5 leading-tight">আপনার নিজের মুখ</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                এটি আপনার মূল পরিচয় — নিচের সাক্ষীরা আপনার হয়ে সাক্ষ্য দিচ্ছেন যে আপনি সত্যিই একজন সুবিধাবঞ্চিত।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Witness grid */}
      <div data-tour="witness-grid" data-voice="home.witness" className="premium-panel rounded-2xl p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="min-w-0">
            <p className="text-[10px] uppercase text-muted-foreground tracking-[0.15em] font-bold flex items-center gap-1">
              <Users className="w-3 h-3" /> সাক্ষী প্রগ্রেস
            </p>
            <p className="text-lg font-black mt-0.5 text-navy leading-none">
              {submittedCount}<span className="text-muted-foreground text-sm">/{total}</span>
              <span className="text-[11px] font-bold text-emerald ml-2">জমা</span>
            </p>
            {verifiedCount > 0 && (
              <p className="text-[10px] text-violet mt-0.5 font-bold leading-tight">
                {verifiedCount} জনের ক্ষেত্রে আনুমানিক ৪–৫ দিনের মধ্যে Re-verify লাগতে পারে
              </p>
            )}
          </div>
          <div className="relative w-12 h-12 shrink-0">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="3.5" fill="none" className="text-surface-2" />
              <circle cx="18" cy="18" r="15" stroke="currentColor" strokeWidth="3.5" fill="none"
                strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
                strokeLinecap="round" className="text-rose transition-all" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-rose">
              {pct}%
            </div>
          </div>
        </div>

        {(() => {
          const BOX_SIZE = 10;
          const boxCount = Math.max(1, Math.ceil(witnessTasks.length / BOX_SIZE));
          const boxes = Array.from({ length: boxCount }).map((_, i) => {
            const start = i * BOX_SIZE;
            const items = witnessTasks.slice(start, start + BOX_SIZE);
            const doneInBox = items.filter((t) => t.status !== "empty").length;
            const readyInBox = items.filter((t) => {
              const dueMs = t.reverify_due_at ? new Date(t.reverify_due_at).getTime() : 0;
              return t.status === "verified" && t.whitelist_ok === false;
            }).length;
            return { i, start, items, doneInBox, readyInBox };
          });
          return (
            <div className="space-y-2">
              {boxes.map(({ i, start, items, doneInBox, readyInBox }) => {
                const isOpen = openBox === i;
                const rangeEnd = Math.min(start + BOX_SIZE, witnessTasks.length);
                return (
                  <div key={i} className="rounded-2xl border border-border bg-surface-2/50 overflow-hidden">
                    <button
                      onClick={() => setOpenBox(isOpen ? -1 : i)}
                      className="w-full flex items-center gap-3 p-3 btn-press"
                    >
                      <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md ${
                        readyInBox > 0 ? "animate-pulse" : ""
                      }`} style={{
                        background: readyInBox > 0
                          ? "linear-gradient(135deg,#ef4444,#f59e0b)"
                          : "linear-gradient(135deg,#06b6d4,#8b5cf6)"
                      }}>
                        📦
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-black text-navy leading-tight">
                          Box #{i + 1} · Slot {start + 1}–{rangeEnd}
                        </p>
                        <p className="text-[10px] font-bold mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className="text-emerald">✅ {doneInBox}/{items.length}</span>
                          {readyInBox > 0 && (
                            <span className="text-rose">🔄 {readyInBox} রি-ভেরিফাই প্রস্তুত</span>
                          )}
                        </p>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 pt-0 grid gap-2 grid-cols-3 sm:grid-cols-4 animate-in fade-in slide-in-from-top-1">
                        {items.map((t) => (
                          <TaskCell key={t.slot} task={t}
                            onStart={() => router.navigate({ to: "/task/$slot", params: { slot: String(t.slot) } })}
                            onReverify={() => router.navigate({ to: "/reverify", search: { taskId: t.id } as any })}
                            onOpenPhoto={(url) => setLightbox({ url, label: `সাক্ষী #${t.slot} · ${t.face_label || "মুখ"}` })} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}


        {allSubmitted && (
          <button onClick={() => addSlots.mutate()} disabled={addSlots.isPending}
            className="mt-2.5 w-full gradient-cta rounded-xl py-2 font-black text-xs flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition">
            {addSlots.isPending
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> যোগ হচ্ছে…</>
              : <><Plus className="w-3.5 h-3.5" /> আরও ১০ জন সাক্ষী যোগ করুন</>}
          </button>
        )}
      </div>

      {!data.wallet && (
        <Link to="/wallet" className="block premium-panel rounded-2xl p-3 border-l-4" style={{ borderLeftColor: "var(--color-amber)" }}>
          <p className="text-sm font-black text-amber">⚠️ ওয়ালেট সেট করুন</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            টাকা তোলার আগে bKash / Nagad নম্বর সেট করতে হবে — একবার সেট করলে আর পরিবর্তন হবে না।
          </p>
        </Link>
      )}

      {/* Motivational filler */}
      <div className="grid grid-cols-2 gap-2">
        <div className="premium-panel rounded-2xl p-3 text-center"
             style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.10), rgba(139,92,246,0.08))" }}>
          <Heart className="w-5 h-5 mx-auto text-rose" />
          <p className="text-[11px] font-black text-navy mt-1 leading-tight">যত বেশি সাক্ষী,<br/>তত বেশি আয়</p>
        </div>
        <div className="premium-panel rounded-2xl p-3 text-center"
             style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(255,209,102,0.10))" }}>
          <ShieldCheck className="w-5 h-5 mx-auto text-emerald" />
          <p className="text-[11px] font-black text-navy mt-1 leading-tight">সাক্ষী = আপনার<br/>সততার প্রমাণ</p>
        </div>
      </div>

      <div className="premium-panel rounded-2xl p-4 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(6,182,212,0.08))" }}>
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-violet">💡 কেন সাক্ষী?</p>
        <p className="text-[12px] text-navy mt-2 leading-relaxed font-medium">
          স্কুলে উপবৃত্তি পেতে যেমন বাবা-মায়ের NID, প্রমাণপত্র লাগে —
          আমাদের এই আর্থিক সহায়ক প্ল্যাটফর্মেও তেমনই <span className="font-black text-violet">১০ জন সাক্ষীর মুখ</span> লাগে।
          প্রত্যেক সাক্ষী প্রমাণ করছেন যে আপনি সত্যিই সাহায্যের যোগ্য।
        </p>
        <p className="text-[12px] text-navy mt-2 leading-relaxed font-medium">
          <span className="font-black text-rose">যত বেশি সাক্ষী যোগ করবেন, তত বেশি মাসিক আয় হবে।</span>
          ১০ জন সম্পন্ন হলে আরও ১০ জন যোগ করার সুযোগ পাবেন।
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a href="https://t.me/goodappbuy" target="_blank" rel="noopener noreferrer"
           className="block rounded-2xl p-3 text-center shadow-md btn-press"
           style={{ background: "linear-gradient(120deg,#0088cc,#06b6d4)" }}>
          <p className="text-xs font-black text-white flex items-center justify-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> টেলিগ্রাম
          </p>
          <p className="text-[10px] text-white/90 mt-0.5">গ্রুপে মেসেজ দিন</p>
        </a>
        <a href="https://wa.me/8801892564963" target="_blank" rel="noopener noreferrer"
           className="block rounded-2xl p-3 text-center shadow-md btn-press"
           style={{ background: "linear-gradient(120deg,#25D366,#128C7E)" }}>
          <p className="text-xs font-black text-white flex items-center justify-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </p>
          <p className="text-[10px] text-white/90 mt-0.5 mono-num">01892564963</p>
        </a>
      </div>


      <div className="text-center py-2 space-y-3">
        <VideoTutorialButton />
        <p className="text-[11px] text-muted-foreground italic">
          🌸 "হাজার জনের সহযোগিতা, একজনের হাসি" 🌸
        </p>
        <TourReplayButton />
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center gap-3 max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.label}
              className="max-w-full max-h-[80vh] rounded-2xl border-2 border-white/20 shadow-2xl object-contain" />
            <p className="text-white font-bold text-sm">{lightbox.label}</p>
          </div>
        </div>
      )}

      {showWelcome && (() => {
        const b = (data as any).bonus;
        if (!b) return null;
        return (
          <div onClick={() => setShowWelcome(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
            <div onClick={(e) => e.stopPropagation()}
              className="welcome-popup relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
              <button onClick={() => setShowWelcome(false)}
                className="absolute top-3 right-3 z-10 rounded-full bg-black/40 hover:bg-black/60 p-2 text-white">
                <X className="w-4 h-4" />
              </button>
              <div className="welcome-popup-bg relative p-5 pb-6 text-center">
                <div className="welcome-popup-confetti" />
                <img src={bonusGirl} alt="Bonus" width={200} height={200}
                  className="relative w-40 h-40 mx-auto drop-shadow-2xl animate-bounce" />
                <p className="relative text-[10px] uppercase tracking-[0.3em] font-black text-white/95 mt-1">
                  🎉 নতুন ইউজার অফার 🎉
                </p>
                <p className="relative text-4xl font-black text-white leading-tight mt-1 drop-shadow-lg">
                  {Number(b.totalAmount ?? 350)}৳ বোনাস!
                </p>
                <p className="relative text-[11px] font-black text-white/90 mt-1">
                  {b.selfFirstAmount}৳ First + {b.userAmount}৳ Re-verify + {b.referrerAmount}৳ Refer = <span className="text-amber-200">মোট {b.totalAmount}৳</span>
                </p>
                <p className="relative text-[13px] font-black text-white/95 mt-1">
                  একদম <span className="underline decoration-white/70">ফ্রি</span> — আজই নিন!
                </p>
              </div>
              <div className="bg-white p-4 space-y-3">
                <div className="rounded-2xl p-3 border-2 border-cyan/30 bg-cyan/5">
                  <p className="text-sm font-black text-cyan flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> {b.selfFirstAmount}৳ — First-verify বোনাস (আপনার)
                  </p>
                  <p className="text-[11px] text-navy mt-1 font-medium leading-snug">
                    ১০ জন সাক্ষীর <b>First Verify</b> শেষ করলেই সাথে সাথে <b>{b.selfFirstAmount}৳</b> আপনার balance-এ জমা।
                  </p>
                </div>
                <div className="rounded-2xl p-3 border-2 border-amber/40 bg-amber/5">
                  <p className="text-sm font-black text-amber flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> {b.userAmount}৳ — রি-ভেরিফাই বোনাস (আপনার)
                  </p>
                  <p className="text-[11px] text-navy mt-1 font-medium leading-snug">
                    ১০ জনের <b>রি-ভেরিফাই</b> সম্পন্ন করলেই সাথে সাথে <b>{b.userAmount}৳ balance-এ</b> + <b>মাইনিং চালু</b>।
                  </p>
                </div>
                <div className="rounded-2xl p-3 border-2 border-violet/30 bg-violet/5">
                  <p className="text-sm font-black text-violet flex items-center gap-1.5">
                    <Gift className="w-4 h-4" /> {b.referrerAmount}৳ — Referrer বোনাস (বন্ধু আনলে)
                  </p>
                  <p className="text-[11px] text-navy mt-1 font-medium leading-snug">
                    আপনি যাকে refer করবেন সে ১০ verify complete করলে <b>আপনি {b.referrerAmount}৳</b> পাবেন।
                  </p>
                </div>
                <details className="rounded-xl bg-surface-2 p-2.5">
                  <summary className="text-[11px] font-black text-navy cursor-pointer">
                    ❓ রি-ভেরিফাই কেন লাগে?
                  </summary>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                     আপনার Face key অন্য কেউ ব্যবহার করছে কি না বা account-এর নিরাপত্তা নষ্ট হয়েছে কি না নিশ্চিত করতেই Re-verify চাওয়া হয়।
                     GoodDollar whitelist বাতিল না করা পর্যন্ত কিছু করতে হবে না; বাতিল হলেই app জানাবে, আর সফল Re-verify-এর পর key আবার whitelist হলে সেটি Re-verify হিসেবে গণনা হবে।
                  </p>
                </details>
                <button onClick={() => setShowWelcome(false)}
                  className="w-full py-3 rounded-2xl gradient-cta text-white font-black text-sm shadow-lg btn-press">
                  🚀 চলুন শুরু করি!
                </button>
                <p className="text-[10px] text-center text-muted-foreground">
                  {b.selfFirstPaid ? "✅" : "⏳"} {b.selfFirstAmount}৳ &nbsp;·&nbsp;
                  {b.userReverifyPaid ? "✅" : "⏳"} {b.userAmount}৳ &nbsp;·&nbsp;
                  {b.referrerPaid ? "✅" : "⏳"} {b.referrerAmount}৳
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>


    </NowProvider>
  );
}



function useTick() {
  return useContext(NowContext);
}


function MainIdentityCell({ task, onStart, onReverify, onOpenPhoto }: { task: any; onStart: () => void; onReverify: () => void; onOpenPhoto: (url: string) => void }) {
  const isVerified = task.status === "verified";
  const whitelistLost = task.whitelist_ok === false;
  const readyToReverify = isVerified && whitelistLost;
  const faceUrl: string | undefined = task.signed_face_url;

  if (isVerified && !readyToReverify) {
    const anchor = task.last_reverified_at || task.done_at || task.verified_at;
    const days = anchor ? (Date.now() - new Date(anchor).getTime()) / 86400000 : null;
    const remain = days != null ? Math.max(0, 4 - days) : null;
    const hint = remain == null ? null : remain > 0 ? `~${remain.toFixed(1)}d` : "যেকোনো সময়";
    return (
      <button onClick={() => faceUrl && onOpenPhoto(faceUrl)} data-voice="home.open.photo"
        className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 shadow-[0_10px_24px_-6px_rgba(255,209,102,0.7)] active:scale-95 transition"
        style={{ borderColor: "var(--color-amber)" }}>
        {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="main" />
                 : <div className="absolute inset-0 bg-surface-2" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <span className="absolute top-1 right-1 rounded-full p-1 shadow" style={{ background: "var(--color-amber)" }}>
          <Crown className="w-3 h-3 text-white" />
        </span>
        {hint && (
          <span className="absolute top-1 left-1 text-[9px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-[2px]">
            {hint}
          </span>
        )}
        <p className="absolute bottom-1 left-0 right-0 text-[10px] font-black text-white text-center mono-num drop-shadow">
          WHITELISTED
        </p>
      </button>
    );
  }

  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify} data-voice="reverify.button"
        className="flex flex-col overflow-hidden rounded-2xl border-2 border-rose shadow-[0_10px_28px_-6px_rgba(239,71,111,0.7)] active:scale-95 transition bg-surface-2">
        <div className="relative w-24 h-24">
          {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="main" />
                   : <div className="absolute inset-0 task-cell-reverify" />}
          <span className="absolute top-1 right-1 rounded-full p-1 shadow animate-pulse" style={{ background: "var(--color-rose)" }}>
            <Sparkles className="w-3 h-3 text-white" />
          </span>
        </div>
        <div className="w-24 bg-rose text-white text-[10px] font-black text-center py-1 leading-tight animate-pulse">
          রি-ভেরিফাই করুন
        </div>
      </button>
    );
  }


  let icon = <Camera className="w-8 h-8 text-white drop-shadow" />;
  let cellClass = "task-cell-empty";
  if (task.status === "done") { cellClass = "task-cell-done"; icon = <CheckCircle2 className="w-8 h-8 text-white drop-shadow" />; }
  else if (readyToReverify) { cellClass = "task-cell-reverify"; icon = <Sparkles className="w-8 h-8 text-white drop-shadow" />; }

  return (
    <button onClick={onStart} data-voice="home.main"
      className={`relative w-24 h-24 rounded-2xl ${cellClass} flex items-center justify-center btn-press overflow-hidden border-2`}
      style={{ borderColor: "var(--color-amber)" }}>
      <span className="absolute top-1 right-1 rounded-full p-1 shadow" style={{ background: "var(--color-amber)" }}>
        <Crown className="w-3 h-3 text-white" />
      </span>
      {icon}
    </button>
  );
}

function TaskCell({ task, onStart, onReverify, onOpenPhoto }: { task: any; onStart: () => void; onReverify: () => void; onOpenPhoto: (url: string) => void }) {
  const isDone = task.status === "done";
  const isVerified = task.status === "verified";
  const whitelistLost = task.whitelist_ok === false;
  const readyToReverify = isVerified && whitelistLost;
  const faceUrl: string | undefined = task.signed_face_url;

  const theme = slotTheme(task.slot);
  const themeStyle = {
    borderColor: theme.from,
    boxShadow: `0 8px 22px -6px rgba(${theme.glow},0.55), 0 0 0 1px rgba(${theme.glow},0.25) inset`,
  } as const;

  if (isVerified && !readyToReverify) {
    const anchor = task.last_reverified_at || task.done_at || task.verified_at;
    const days = anchor ? (Date.now() - new Date(anchor).getTime()) / 86400000 : null;
    const remain = days != null ? Math.max(0, 4 - days) : null;
    const hint = remain == null ? null : remain > 0 ? `~${remain.toFixed(1)}d` : "any";
    return (
      <button onClick={() => faceUrl && onOpenPhoto(faceUrl)}
        className="relative aspect-square rounded-2xl overflow-hidden border-2 active:scale-95 transition-transform"
        style={themeStyle}>
        {faceUrl ? <img src={faceUrl} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" alt="" />
                 : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md"
          style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}>#{task.slot}</span>
        <span className="absolute top-1 right-1 rounded-full p-0.5 shadow" style={{ background: theme.to }}>
          <Crown className="w-2.5 h-2.5 text-white" />
        </span>
        {hint && (
          <span className="absolute bottom-4 left-1 right-1 text-[8px] font-black text-white text-center mono-num leading-none py-0.5 rounded bg-black/55">
            {hint}
          </span>
        )}
        <p className="absolute bottom-1 left-0 right-0 text-[9px] font-black text-white text-center drop-shadow leading-none tracking-wide">
          WHITELISTED
        </p>
      </button>
    );
  }


  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify}
        className="relative flex flex-col overflow-hidden rounded-2xl border-2 border-rose shadow-[0_10px_22px_-6px_rgba(239,71,111,0.7)] active:scale-95 transition-transform bg-surface-2">
        <div className="relative aspect-square">
          {faceUrl ? <img src={faceUrl} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" alt="" />
                   : <div className="absolute inset-0 task-cell-reverify" />}
          <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/55">#{task.slot}</span>
          <span className="absolute top-1 right-1 rounded-full bg-rose p-1 shadow animate-pulse">
            <Sparkles className="w-3 h-3 text-white" />
          </span>
        </div>
        <div className="bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 text-white text-[10px] font-black text-center py-1 leading-tight animate-pulse">
          রি-ভেরিফাই করুন
        </div>
      </button>
    );
  }

  const isEmpty = !isDone;
  const icon = isDone
    ? <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />
    : <Camera className="w-5 h-5 text-white drop-shadow" />;
  const label = isDone ? "সম্পন্ন" : "শুরু";
  const bg = isDone
    ? `linear-gradient(135deg, ${theme.from}, ${theme.to})`
    : `linear-gradient(135deg, ${theme.from}22, ${theme.to}22)`;

  return (
    <button onClick={onStart}
      className="relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 btn-press overflow-hidden border-2 transition-transform active:scale-95"
      style={{
        background: bg,
        borderColor: isDone ? theme.to : `${theme.from}55`,
        boxShadow: isDone
          ? `0 10px 22px -8px rgba(${theme.glow},0.65)`
          : `0 4px 14px -6px rgba(${theme.glow},0.35)`,
      }}>
      <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md"
        style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}>#{task.slot}</span>
      <span className={`relative z-10 grid place-items-center w-9 h-9 rounded-full ${isEmpty ? "" : ""}`}
        style={{ background: isDone ? "rgba(0,0,0,0.25)" : `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}>
        {icon}
      </span>
      <span className="text-[9px] font-black drop-shadow leading-none mt-0.5"
        style={{ color: isDone ? "#fff" : theme.from }}>{label}</span>
    </button>
  );
}


function s(totalSec: number) { return totalSec % 60; }

function BonusClaimCard({
  title, subtitle, progress, amount, claimed, claimable, loading, onClaim, accent,
}: {
  title: string; subtitle: string; progress: number; amount: number;
  claimed: boolean; claimable: boolean; loading: boolean;
  onClaim: () => void; accent: "cyan" | "amber";
}) {
  const pct = Math.min(100, Math.round((progress / 10) * 100));
  const gradient = accent === "cyan"
    ? "linear-gradient(135deg,#06b6d4,#3b82f6)"
    : "linear-gradient(135deg,#f59e0b,#ef4444)";
  return (
    <div
      className={`rounded-2xl p-3 relative overflow-hidden border ${
        claimed ? "border-emerald/40 bg-emerald/10" :
        claimable ? "border-transparent claim-pulse text-white" :
        "border-border bg-surface-2"
      }`}
      style={claimable && !claimed ? { background: gradient } : undefined}
    >
      <p className={`text-[10px] uppercase tracking-[0.15em] font-black ${
        claimed ? "text-emerald" : claimable ? "text-white/90" : "text-muted-foreground"
      }`}>{title}</p>
      <p className={`text-lg font-black leading-none mt-0.5 ${
        claimed ? "text-emerald" : claimable ? "text-white drop-shadow" : "text-navy"
      }`}>
        {claimed ? "✅ পেয়েছেন" : `+${amount}৳`}
      </p>
      <p className={`text-[10px] mt-0.5 font-bold ${
        claimed ? "text-emerald/80" : claimable ? "text-white/90" : "text-muted-foreground"
      }`}>{subtitle}</p>

      {!claimed && (
        <>
          <div className="mt-2 h-1.5 rounded-full bg-black/15 overflow-hidden">
            <div className="h-full rounded-full transition-all"
                 style={{ width: `${pct}%`, background: claimable ? "white" : gradient }} />
          </div>
          <p className={`text-[10px] font-black mt-1 mono-num ${claimable ? "text-white" : "text-muted-foreground"}`}>
            {Math.min(progress, 10)}/১০
          </p>
        </>
      )}

      {claimable && !claimed && (
        <button onClick={onClaim} disabled={loading}
          className="mt-2 w-full py-2 rounded-xl bg-white text-navy text-xs font-black shadow-md btn-press flex items-center justify-center gap-1 disabled:opacity-70">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "🎁"} Claim করুন
        </button>
      )}
    </div>
  );
}

function VoucherPopup({ vouchers, onClaimed }: { vouchers: any[]; onClaimed: () => void }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = vouchers.filter((v) => !dismissed.includes(v.id));
  const [current, setCurrent] = useState<any | null>(null);

  useEffect(() => {
    if (visible.length > 0 && !current) setCurrent(visible[0]);
    if (visible.length === 0 && current) setCurrent(null);
  }, [visible, current]);

  const claim = useMutation({
    mutationFn: (id: string) => claimVoucher({ data: { voucherId: id } }),
    onSuccess: (r: any) => {
      toast.success(`🎉 ${r.amount}৳ যোগ হয়েছে balance-এ!`);
      if (current) setDismissed((d) => [...d, current.id]);
      setCurrent(null);
      onClaimed();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl p-6 text-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden"
           style={{ background: "linear-gradient(135deg,#f59e0b 0%,#ef4444 45%,#8b5cf6 100%)" }}>
        <button
          onClick={() => { setDismissed((d) => [...d, current.id]); setCurrent(null); }}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/25 backdrop-blur flex items-center justify-center">
          <X className="w-4 h-4" />
        </button>

        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-30 bg-white blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full opacity-20 bg-yellow-200 blur-3xl" />

        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/25 backdrop-blur mb-2 animate-bounce">
            <Gift className="w-9 h-9 text-white drop-shadow" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-90">Special Bonus Voucher</p>
          <p className="text-5xl font-black mono-num mt-1 drop-shadow-lg">
            {Number(current.amount).toFixed(0)}<span className="text-2xl">৳</span>
          </p>
          <div className="mt-3 rounded-2xl bg-white/20 backdrop-blur border border-white/30 p-3">
            <p className="text-[10px] uppercase tracking-widest font-black opacity-90">উদ্দেশ্য</p>
            <p className="text-sm font-bold mt-1 leading-snug">{current.reason}</p>
          </div>
          <button
            disabled={claim.isPending}
            onClick={() => claim.mutate(current.id)}
            className="mt-4 w-full py-3 rounded-2xl bg-white text-navy font-black text-sm flex items-center justify-center gap-2 shadow-xl btn-press disabled:opacity-70">
            {claim.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            এখনই Claim করুন
          </button>
          <p className="text-[10px] opacity-90 mt-2">Claim করলে সরাসরি balance-এ যোগ হবে · withdraw করা যাবে।</p>
          {visible.length > 1 && (
            <p className="text-[10px] font-black mt-2 opacity-95">🎁 আরও {visible.length - 1} টি voucher অপেক্ষমাণ</p>
          )}
        </div>
      </div>
    </div>
  );
}

