import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { addMoreSlots, batchSubmitPending } from "@/lib/tasks.functions";
import { claimVoucher } from "@/lib/vouchers.functions";
import { getLeaderboards } from "@/lib/leaderboard.functions";
import { MiningCounter } from "@/components/MiningCounter";
import { ReferralCommissionCard } from "@/components/ReferralCommissionCard";
import bonusGirl from "@/assets/bonus-girl.png";
import { CheckCircle2, Camera, Lock, Sparkles, Loader2, X, Plus, Crown, Users, Heart, ShieldCheck, BadgeCheck, ChevronDown, MessageCircle, Gift } from "lucide-react";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { HeroBanner } from "@/components/HeroBanner";
import { TourReplayButton } from "@/components/GuidedTour";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { BotStartButton } from "@/components/BotStartButton";
import { useLang } from "@/lib/i18n";

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
  const { t } = useLang();
  const [lightbox, setLightbox] = useState<{ url: string; label: string; action?: { label: string; onClick: () => void; tone?: "rose" | "amber" } } | null>(null);
  const [openBox, setOpenBox] = useState<number>(0);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    refetchInterval: 60_000,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const addSlots = useMutation({
    mutationFn: () => addMoreSlots(),
    onSuccess: (r: any) => { toast.success(t(`✨ আরও ${r.added} জন সাক্ষী যোগ হয়েছে`, `✨ Added ${r.added} more witnesses`)); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const batchMut = useMutation({
    mutationFn: () => batchSubmitPending(),
    onSuccess: (r: any) => {
      if (r.submitted > 0) {
        toast.success(t(`✅ ${r.submitted} জন সাক্ষী জমা হয়েছে${r.notWhitelisted ? ` · ${r.notWhitelisted} জন হোয়াইটলিস্টে নেই` : ""}`,
                        `✅ Submitted ${r.submitted} witnesses${r.notWhitelisted ? ` · ${r.notWhitelisted} not whitelisted` : ""}`));
      } else if (r.notWhitelisted > 0) {
        toast.warning(t(`⚠️ ${r.notWhitelisted} জন এখনো হোয়াইটলিস্টে নেই — পরে আবার চেষ্টা করুন`,
                        `⚠️ ${r.notWhitelisted} not yet whitelisted — try again later`));
      } else {
        toast.info(t("জমা দেওয়ার মতো কিছু নেই", "Nothing to submit"));
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
      <HeroBanner
        adminOff={(data as any)?.payoutSettings?.withdrawEnabled === false}
        adminMessage={(data as any)?.payoutSettings?.withdrawOffMessage}
        rates={(data as any)?.bonus?.rates ?? null}
      />
      <WithdrawFeed />

      <VoucherPopup vouchers={(data as any).vouchers ?? []} onClaimed={() => refetch()} />




      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">{t("স্বাগতম,", "Welcome,")}</p>
        <h1 className="text-xl font-black mt-0.5">
          {data.profile?.display_name ?? t("ইউজার", "User")} 👋
        </h1>
        {(data.profile as any)?.uid_seq && (
          <button
            data-voice="home.uid"
            onClick={() => {
              navigator.clipboard.writeText(String((data.profile as any).uid_seq));
              toast.success(t("UID কপি হয়েছে", "UID copied"));
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-md btn-press"
            style={{ background: "linear-gradient(120deg,#8b5cf6,#06b6d4,#10b981)" }}
          >
            <span className="opacity-80">UID</span>
            <span className="mono-num" translate="no">{String((data.profile as any).uid_seq)}</span>
            <span>📋</span>
          </button>
        )}
      </div>

      {(data.profile as any)?.kyc_verified ? (
        <div className="mx-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald/15 border border-emerald/40 text-emerald text-[11px] font-black">
          <BadgeCheck className="w-3.5 h-3.5" /> {t("KYC ভেরিফাইড", "KYC Verified")}
        </div>
      ) : (
        <Link to="/kyc" className="block rounded-2xl p-3 text-center shadow-lg btn-press animate-pulse ring-2 ring-rose-400/70"
              style={{ background: "linear-gradient(120deg,#e11d48,#f43f5e)" }}>
          <p className="text-sm font-black text-white flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-4 h-4 animate-bounce" /> {t("KYC করুন — নীল ✔ ব্যাজ ও উইথড্র চালু করুন", "Complete KYC — blue ✔ badge & withdraw")}
          </p>
          <p className="text-[11px] text-white/90 mt-0.5">{t("মাত্র ১ ধাপ (টেলিগ্রামে START) · KYC ছাড়া উইথড্র করা যাবে না", "Just 1 step (START in Telegram) · withdraw locked without KYC")}</p>
        </Link>
      )}
      <KycAlertBanner />



      <div data-tour="mining" data-voice="home.mining">
      <MiningCounter
        accrued={Number(data.mining?.accrued_amount ?? 0)}
        withdrawn={Number(data.mining?.withdrawn_amount ?? 0)}
        isActive={!!data.mining?.is_active}
        lastCreditedAt={data.mining?.last_credited_at ?? null}
        effectiveTaskCount={Number(data.mining?.effective_task_count ?? 0)}
        qualifyingReferees={Number(data.mining?.qualifying_referees ?? 0)}
        displayTaskCount={submittedCount}
        leagueCount={submittedCount}
      />
      </div>

      <ReferralCommissionCard />

      


      {/* Compact quick-actions row: Special Offers + Send + Recharge */}
      {(() => {
        const b = (data as any).bonus;
        const total = b ? Number(b.totalAmount ?? (b.selfFirstAmount + b.referrerAmount + b.userAmount)) : 0;
        const hasUnclaimed = b && !(b.selfFirstPaid && b.referrerPaid && b.userReverifyPaid);
        const rechargeOn = (data as any).payoutSettings?.rechargeEnabled !== false;
        return (
          <div className="space-y-3">
            <Link to="/offers"
              className="block rounded-3xl p-4 relative overflow-hidden shadow-[0_20px_45px_-20px_rgba(236,72,153,0.6)] btn-press border border-white/20"
              style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 55%,#f59e0b 100%)" }}>
              {hasUnclaimed && (
                <span className="absolute top-2.5 right-2.5 text-[10px] font-black bg-white text-rose px-2.5 py-1 rounded-full shadow-lg animate-pulse" translate="no">
                  🎯 {total}৳ {t("পেন্ডিং", "pending")}
                </span>
              )}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
              <div className="flex items-center gap-3 text-white relative">
                <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur border border-white/40 flex items-center justify-center text-3xl shadow-lg shrink-0">🎁</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-95 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Special Offers
                  </p>
                  <p className="text-lg font-black leading-tight drop-shadow mt-0.5">{t("সকল বোনাস অফার", "All Bonus Offers")}</p>
                  <p className="text-[11px] opacity-95 font-bold mt-0.5">{t("2X প্রোমো · রেফার · রি-ভেরিফাই", "2X Promo · Refer · Re-verify")}</p>
                </div>
                <span className="text-3xl opacity-90 font-black">›</span>
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-3">
              <Link to="/send"
                className="rounded-3xl p-4 btn-press flex flex-col items-start gap-2 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(124,58,237,0.55)] text-white border border-white/20"
                style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
                <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-2xl shrink-0 relative">💸</div>
                <div className="min-w-0 relative">
                  <p className="text-base font-black leading-tight">{t("সেন্ড ব্যালেন্স", "Send Balance")}</p>
                  <p className="text-[11px] opacity-95 font-bold mt-0.5" translate="no">{t("সর্বনিম্ন ১৫৳", "Min 15৳")}</p>
                </div>
              </Link>

              {rechargeOn ? (
                <Link to="/recharge"
                  className="rounded-3xl p-4 btn-press flex flex-col items-start gap-2 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(6,182,212,0.55)] text-white border border-white/20"
                  style={{ background: "linear-gradient(135deg,#06b6d4,#10b981)" }}>
                  <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
                  <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-2xl shrink-0 relative">📱</div>
                  <div className="min-w-0 relative">
                    <p className="text-base font-black leading-tight">{t("মোবাইল রিচার্জ", "Mobile Recharge")}</p>
                    <p className="text-[11px] opacity-95 font-bold mt-0.5" translate="no">{t("সর্বনিম্ন ২০৳", "Min 20৳")}</p>
                  </div>
                </Link>
              ) : (
                <div className="rounded-3xl p-4 bg-surface-2 border-2 border-dashed border-border opacity-70 flex flex-col items-start gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Lock className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <p className="text-base font-black leading-tight">{t("রিচার্জ বন্ধ", "Recharge off")}</p>
                    <p className="text-[11px] text-muted-foreground font-bold">{t("সাময়িক", "Temporary")}</p>
                  </div>
                </div>
              )}
            </div>
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
              {pendingSubmits > 0 ? t("ব্যাচ জমা · হোয়াইটলিস্ট চেক", "Batch submit · whitelist check") : (firstEmpty ? t("এক ট্যাপে সাক্ষী যোগ", "Add witness in one tap") : t("নতুন ব্যাচ আনলক", "Unlock a new batch"))}
            </span>
            <span className="block text-2xl font-black drop-shadow-sm mt-0.5">
              {pendingSubmits > 0 ? t(`সব জমা দিন (${pendingSubmits})`, `Submit all (${pendingSubmits})`) : (firstEmpty ? t("জমা দিন", "Submit") : t("আরও ১০ Slot", "10 More Slots"))}
            </span>
            <span className="block text-[11px] text-white/90 font-bold mt-0.5">
              {pendingSubmits > 0
                ? t(`${pendingSubmits} টি কী প্রস্তুত · হোয়াইটলিস্ট পেলে অটো জমা`, `${pendingSubmits} keys ready · auto-submits on whitelist`)
                : (firstEmpty ? t(`Slot #${firstEmpty.slot} · এখনই ছবি তুলুন`, `Slot #${firstEmpty.slot} · take a photo now`) : t("১০ জন সম্পন্ন — আরও যোগ করুন", "10 done — add more"))}
            </span>
          </span>
          <span className="shrink-0 text-2xl">→</span>
        </button>
      )}


      {/* Main identity card — premium hero */}
      {mainTask && (
        <div data-tour="main-identity" data-voice="home.main"
             className="relative overflow-hidden rounded-2xl p-4 border-2 shadow-[0_18px_40px_-12px_rgba(245,158,11,0.55)]"
             style={{
               borderColor: "rgba(255,255,255,0.25)",
               background: "linear-gradient(135deg, #7c3aed 0%, #ec4899 45%, #f59e0b 100%)",
             }}>
          {/* decorative glow blobs */}
          <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-40 blur-2xl"
               style={{ background: "radial-gradient(circle, #fde047, transparent 65%)" }} />
          <div className="pointer-events-none absolute -bottom-12 -left-10 w-40 h-40 rounded-full opacity-35 blur-2xl"
               style={{ background: "radial-gradient(circle, #22d3ee, transparent 65%)" }} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.35),transparent_55%)]" />

          <div className="relative flex items-center gap-3">
            <div className="shrink-0 rounded-2xl p-1 bg-white/25 backdrop-blur-sm shadow-lg">
              <MainIdentityCell task={mainTask}
                onStart={() => router.navigate({ to: "/task/$slot", params: { slot: "1" } })}
                onReverify={() => {
                  const url = mainTask.signed_face_url;
                  if (url) {
                    setLightbox({
                      url,
                      label: `আপনার পরিচয় · ${mainTask.face_label || "আপনি"} — রি-ভেরিফাই প্রয়োজন`,
                      action: { label: "রি-ভেরিফাই করুন", tone: "rose", onClick: () => router.navigate({ to: "/reverify", search: { taskId: mainTask.id } as any }) },
                    });
                  } else {
                    router.navigate({ to: "/reverify", search: { taskId: mainTask.id } as any });
                  }
                }}
                onOpenPhoto={(url) => setLightbox({ url, label: `আপনার পরিচয় · ${mainTask.face_label || "আপনি"}` })} />
            </div>
            <div className="min-w-0 flex-1 text-white">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black flex items-center gap-1 text-white/95 drop-shadow">
                <BadgeCheck className="w-3.5 h-3.5" /> {t("ভেরিফাইড পরিচয়", "Verified Identity")}
              </p>
              <p className="text-base font-black mt-1 leading-tight drop-shadow-lg">
                {t("আপনি — এই অ্যাকাউন্টের মালিক", "You — owner of this account")}
              </p>
              <p className="text-[11px] font-semibold mt-1 leading-snug text-white/90 drop-shadow">
                {t("আপনার নিজের ছবি এখানে সুরক্ষিত। বাকি ১০ জন সাক্ষী আপনার পক্ষে সাক্ষ্য দিচ্ছেন যে আপনি সত্যিকারের একজন প্রকৃত ব্যবহারকারী।",
                   "Your own photo is protected here. The other 10 witnesses are testifying that you are a genuine real user.")}
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
              <Users className="w-3 h-3" /> {t("সাক্ষী প্রগ্রেস", "Witness Progress")}
            </p>
            <p className="text-lg font-black mt-0.5 text-navy leading-none">
              <span translate="no">{submittedCount}<span className="text-muted-foreground text-sm">/{total}</span></span>
              <span className="text-[11px] font-bold text-emerald ml-2">{t("জমা", "Done")}</span>
            </p>
            {verifiedCount > 0 && (
              <p className="text-[10px] text-violet mt-0.5 font-bold leading-tight">
                {t(`${verifiedCount} জনের ক্ষেত্রে আনুমানিক ৪–৫ দিনের মধ্যে Re-verify লাগতে পারে`, `${verifiedCount} may need Re-verify in ~4–5 days`)}
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
              return t.status === "verified" && t.whitelist_ok === false && !!t.wallet_address;
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
                          <span className="text-emerald" translate="no">✅ {doneInBox}/{items.length}</span>
                          {readyInBox > 0 && (
                            <span className="text-rose" translate="no">🔄 {readyInBox} {t("রি-ভেরিফাই প্রস্তুত", "re-verify ready")}</span>
                          )}
                        </p>
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="p-3 pt-0 grid gap-2 grid-cols-3 sm:grid-cols-4 animate-in fade-in slide-in-from-top-1">
                        {items.map((task) => (
                          <TaskCell key={task.slot} task={task}
                            onStart={() => router.navigate({ to: "/task/$slot", params: { slot: String(task.slot) } })}
                            onReverify={() => {
                              const url = task.signed_face_url;
                              if (url) {
                                setLightbox({
                                  url,
                                  label: t(`সাক্ষী #${task.slot} · ${(task as any).face_label || "মুখ"} — রি-ভেরিফাই প্রয়োজন`, `Witness #${task.slot} · ${(task as any).face_label || "Face"} — needs re-verify`),
                                  action: { label: t("রি-ভেরিফাই করুন", "Re-verify"), tone: "rose", onClick: () => router.navigate({ to: "/reverify", search: { taskId: task.id } as any }) },
                                });
                              } else {
                                router.navigate({ to: "/reverify", search: { taskId: task.id } as any });
                              }
                            }}
                            onOpenPhoto={(url) => setLightbox({ url, label: t(`সাক্ষী #${task.slot} · ${(task as any).face_label || "মুখ"}`, `Witness #${task.slot} · ${(task as any).face_label || "Face"}`) })} />
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
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("যোগ হচ্ছে…", "Adding…")}</>
              : <><Plus className="w-3.5 h-3.5" /> {t("আরও ১০ জন সাক্ষী যোগ করুন", "Add 10 more witnesses")}</>}
          </button>
        )}
      </div>

      <Leaderboards />

      {!data.wallet && (
        <Link to="/wallet" className="block premium-panel rounded-2xl p-3 border-l-4" style={{ borderLeftColor: "var(--color-amber)" }}>
          <p className="text-sm font-black text-amber">⚠️ {t("ওয়ালেট সেট করুন", "Set up wallet")}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {t("টাকা তোলার আগে bKash / Nagad নম্বর সেট করতে হবে — একবার সেট করলে আর পরিবর্তন হবে না।",
               "Set a bKash / Nagad number before withdrawing — once set, it cannot be changed.")}
          </p>
        </Link>
      )}

      {/* Motivational filler */}
      <div className="grid grid-cols-2 gap-2">
        <div className="premium-panel rounded-2xl p-3 text-center"
             style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.10), rgba(139,92,246,0.08))" }}>
          <Heart className="w-5 h-5 mx-auto text-rose" />
          <p className="text-[11px] font-black text-navy mt-1 leading-tight">{t(<>যত বেশি সাক্ষী,<br/>তত বেশি আয়</>, <>More witnesses,<br/>more earnings</>)}</p>
        </div>
        <div className="premium-panel rounded-2xl p-3 text-center"
             style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.10), rgba(255,209,102,0.10))" }}>
          <ShieldCheck className="w-5 h-5 mx-auto text-emerald" />
          <p className="text-[11px] font-black text-navy mt-1 leading-tight">{t(<>সাক্ষী = আপনার<br/>সততার প্রমাণ</>, <>Witnesses = proof<br/>of your honesty</>)}</p>
        </div>
      </div>

      <div className="premium-panel rounded-2xl p-4 relative overflow-hidden"
           style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(6,182,212,0.08))" }}>
        <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-violet">💡 {t("কেন সাক্ষী?", "Why witnesses?")}</p>
        <p className="text-[12px] text-navy mt-2 leading-relaxed font-medium">
          {t(<>স্কুলে উপবৃত্তি পেতে যেমন বাবা-মায়ের NID, প্রমাণপত্র লাগে — আমাদের এই আর্থিক সহায়ক প্ল্যাটফর্মেও তেমনই <span className="font-black text-violet">১০ জন সাক্ষীর মুখ</span> লাগে। প্রত্যেক সাক্ষী প্রমাণ করছেন যে আপনি সত্যিই সাহায্যের যোগ্য।</>,
             <>Just as a school stipend needs parents' NID and proof, our financial support platform needs <span className="font-black text-violet">10 witness faces</span>. Each witness proves you truly deserve support.</>)}
        </p>
        <p className="text-[12px] text-navy mt-2 leading-relaxed font-medium">
          {t(<><span className="font-black text-rose">যত বেশি সাক্ষী যোগ করবেন, তত বেশি মাসিক আয় হবে।</span> ১০ জন সম্পন্ন হলে আরও ১০ জন যোগ করার সুযোগ পাবেন।</>,
             <><span className="font-black text-rose">The more witnesses you add, the higher your monthly income.</span> After 10 you can add 10 more.</>)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <a href="https://t.me/goodappbuy" target="_blank" rel="noopener noreferrer"
           className="block rounded-2xl p-3.5 text-center shadow-md btn-press"
           style={{ background: "linear-gradient(120deg,#0088cc,#06b6d4)" }}>
          <p className="text-sm font-black text-white flex items-center justify-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> {t("টেলিগ্রাম সাপোর্ট", "Telegram Support")}
          </p>
          <p className="text-[11px] text-white/90 mt-0.5">{t("গ্রুপে মেসেজ দিন — দ্রুত সাহায্য পাবেন", "Message the group — quick help")}</p>
        </a>
        <BotStartButton />
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
              className="max-w-full max-h-[70vh] rounded-2xl border-2 border-white/20 shadow-2xl object-contain" />
            <p className="text-white font-bold text-sm text-center">{lightbox.label}</p>
            {lightbox.action && (
              <button onClick={() => { const a = lightbox.action!; setLightbox(null); a.onClick(); }}
                className={`mt-1 px-6 py-3 rounded-full font-black text-white text-sm shadow-2xl active:scale-95 transition ${
                  lightbox.action.tone === "rose"
                    ? "bg-gradient-to-r from-rose-500 via-pink-500 to-rose-500 animate-pulse"
                    : "gradient-cta"
                }`}>
                {lightbox.action.label}
              </button>
            )}
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
                     Good-App whitelist বাতিল না করা পর্যন্ত কিছু করতে হবে না; বাতিল হলেই app জানাবে, আর সফল Re-verify-এর পর key আবার whitelist হলে সেটি Re-verify হিসেবে গণনা হবে।
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
  const readyToReverify = isVerified && whitelistLost && !!task.wallet_address;
  const faceUrl: string | undefined = task.signed_face_url;

  if (isVerified && !readyToReverify) {
    const anchor = task.last_reverified_at || task.done_at || task.verified_at;
    const days = anchor ? (Date.now() - new Date(anchor).getTime()) / 86400000 : null;
    const remain = days != null ? Math.max(0, 4 - days) : null;
    const hint = remain == null ? null : remain > 0 ? `~${remain.toFixed(1)}d` : "যেকোনো সময়";
    return (
      <button onClick={() => faceUrl && onOpenPhoto(faceUrl)} data-voice="home.open.photo"
        className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 shadow-[0_12px_28px_-8px_rgba(16,185,129,0.75)] active:scale-95 transition"
        style={{ borderColor: "#10b981", background: "linear-gradient(135deg, #10b981, #059669)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_55%)]" />
        <span className="absolute top-1 left-1 right-1 flex items-center justify-center gap-1 rounded-md py-0.5 bg-white text-emerald-700 text-[9px] font-black shadow">
          <ShieldCheck className="w-3 h-3" /> ভেরিফাইড
        </span>
        {hint && (
          <span className="absolute bottom-4 left-1 right-1 text-[9px] font-black text-white mono-num leading-none px-1 py-0.5 rounded bg-black/45 text-center">
            {hint}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck className="w-9 h-9 text-white/95 drop-shadow-lg" />
        </span>
        <p className="absolute bottom-1 left-0 right-0 text-[9px] font-black text-white text-center drop-shadow tracking-wide">
          দেখতে ট্যাপ
        </p>
      </button>
    );
  }

  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify} data-voice="reverify.button"
        className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-rose shadow-[0_12px_32px_-8px_rgba(239,71,111,0.85)] active:scale-95 transition"
        style={{ background: "linear-gradient(135deg, #f43f5e, #ec4899)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.35),transparent_60%)] animate-pulse" />
        <span className="absolute top-1.5 right-1.5 rounded-full bg-white/25 backdrop-blur-sm p-1 shadow animate-pulse">
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </span>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1">
          <Sparkles className="w-6 h-6 text-white drop-shadow" />
          <p className="text-[11px] font-black text-white text-center leading-tight drop-shadow">
            রি-ভেরিফাই<br/>করুন
          </p>
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
  const readyToReverify = isVerified && whitelistLost && !!task.wallet_address;
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
        style={{ borderColor: "#10b981", background: "linear-gradient(135deg, #10b981, #059669)", boxShadow: "0 8px 22px -6px rgba(16,185,129,0.55)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.4),transparent_55%)]" />
        <span className="absolute top-1 left-1 text-[9px] font-black text-white mono-num leading-none px-1 py-0.5 rounded bg-black/45">#{task.slot}</span>
        <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded-md px-1 py-0.5 bg-white text-emerald-700 text-[8px] font-black shadow">
          <ShieldCheck className="w-2.5 h-2.5" /> ✓
        </span>
        <span className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-white/95 drop-shadow-lg" />
        </span>
        {hint && (
          <span className="absolute bottom-4 left-1 right-1 text-[8px] font-black text-white text-center mono-num leading-none py-0.5 rounded bg-black/45">
            {hint}
          </span>
        )}
        <p className="absolute bottom-1 left-0 right-0 text-[9px] font-black text-white text-center drop-shadow leading-none tracking-wide">
          ভেরিফাইড ✓
        </p>
      </button>
    );
  }


  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify}
        className="relative aspect-square rounded-2xl overflow-hidden border-2 border-rose shadow-[0_12px_28px_-8px_rgba(239,71,111,0.85)] active:scale-95 transition-transform"
        style={{ background: "linear-gradient(135deg, #f43f5e, #ec4899)" }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.35),transparent_60%)] animate-pulse" />
        <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/45">#{task.slot}</span>
        <span className="absolute top-1 right-1 rounded-full bg-white/25 backdrop-blur-sm p-0.5 shadow animate-pulse">
          <Sparkles className="w-2.5 h-2.5 text-white" />
        </span>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1">
          <Sparkles className="w-5 h-5 text-white drop-shadow animate-pulse" />
          <p className="text-[10px] font-black text-white text-center leading-tight drop-shadow">
            রি-ভেরিফাই<br/>করুন
          </p>
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

function useLeaderboardsData() {
  return useQuery({
    queryKey: ["leaderboards", "v2"],
    queryFn: () => getLeaderboards(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}

function Leaderboards() {
  const { data } = useLeaderboardsData();
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

function WithdrawFeed() {
  const { data } = useLeaderboardsData();
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
            <span className="ml-2 bg-white/25 backdrop-blur rounded-full px-1.5">💰 মোট {Math.floor(grandTotal)}৳</span>
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
              <div className="rounded-xl bg-white/15 backdrop-blur border border-white/30 p-2.5 mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black text-white">💰 সর্বমোট withdraw payment</p>
                <p className="mono-num font-black text-white text-lg">{Math.floor(grandTotal)}৳</p>
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



