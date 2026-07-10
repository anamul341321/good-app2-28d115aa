import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { addMoreSlots, batchSubmitPending } from "@/lib/tasks.functions";
import { claimFirstVerifyBonus, claimReverifyBonus } from "@/lib/bonus.functions";
import { MiningCounter } from "@/components/MiningCounter";
import bonusGirl from "@/assets/bonus-girl.png";
import { CheckCircle2, Camera, Lock, Sparkles, Loader2, X, Plus, Crown, Users, Heart, ShieldCheck, BadgeCheck, ChevronDown, MessageCircle, Gift } from "lucide-react";
import { AnnouncementTicker } from "@/components/AnnouncementTicker";
import { TourReplayButton } from "@/components/GuidedTour";
import { PageVoice } from "@/components/PageVoice";

import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

// Single shared ticker for every task cell — 11+ cells all calling
// setInterval(setState, 1000) individually was jank-scrolling on low-end phones.
const NowContext = createContext<number>(Date.now());
function NowProvider({ children }: { children: React.ReactNode }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <NowContext.Provider value={now}>{children}</NowContext.Provider>;
}


function HomePage() {
  const router = useRouter();
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
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

  const claimFirstMut = useMutation({
    mutationFn: () => claimFirstVerifyBonus(),
    onSuccess: (r: any) => { toast.success(`🎁 ${r.amount}৳ বোনাস পেয়েছেন!`); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });
  const claimReverifyMut = useMutation({
    mutationFn: () => claimReverifyBonus(),
    onSuccess: (r: any) => { toast.success(`🎉 ${r.amount}৳ বোনাস পেয়েছেন — মাইনিং চালু!`); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

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


      <div className="text-center">
        <p className="text-[11px] text-muted-foreground">স্বাগতম,</p>
        <h1 className="text-xl font-black mt-0.5">
          {data.profile?.display_name ?? "ইউজার"} 👋
        </h1>
        {data.profile?.id && (
          <button
            data-voice="home.uid"
            onClick={() => {
              navigator.clipboard.writeText(String(data.profile!.id));
              toast.success("UID কপি হয়েছে");
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-widest text-white shadow-md btn-press"
            style={{ background: "linear-gradient(120deg,#8b5cf6,#06b6d4,#10b981)" }}
          >
            <span className="opacity-80">UID</span>
            <span className="mono-num">{String(data.profile.id).replace(/-/g,"").slice(0,12).toUpperCase().match(/.{1,4}/g)?.join(" ")}</span>
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

      {/* Welcome bonus banner + claim cards (new users only, max 200৳) */}
      {(() => {
        const b = (data as any).bonus;
        if (!b) return null;
        const bothClaimed = b.firstClaimed && b.reverifyClaimed;
        if (bothClaimed) return null;
        const remaining =
          (b.firstClaimed ? 0 : b.amount) + (b.reverifyClaimed ? 0 : b.amount);
        return (
          <div className="space-y-2">
            <div className="welcome-bonus-banner rounded-2xl p-4 relative overflow-hidden text-white">
              <div className="welcome-bonus-shimmer" />
              <div className="relative flex items-center gap-3">
                <div className="text-4xl animate-bounce">🎁</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/90">
                    Welcome Bonus
                  </p>
                  <p className="text-2xl font-black leading-tight drop-shadow">
                    {remaining}৳ <span className="text-sm">অপেক্ষমান</span>
                  </p>
                  <p className="text-[11px] text-white/95 leading-snug mt-0.5 font-bold">
                    ১০ ভেরিফাই = ১০০৳ · ১০ রি-ভেরিফাই = আরও ১০০৳
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <BonusClaimCard
                title="প্রথম ভেরিফাই"
                subtitle="১০টি স্লট ভেরিফাই করুন"
                progress={b.firstVerifyCount}
                amount={b.amount}
                claimed={b.firstClaimed}
                claimable={b.firstClaimable}
                loading={claimFirstMut.isPending}
                onClaim={() => claimFirstMut.mutate()}
                accent="cyan"
              />
              <BonusClaimCard
                title="রি-ভেরিফাই"
                subtitle="১০টি স্লট রি-ভেরিফাই"
                progress={b.reverifyCount}
                amount={b.amount}
                claimed={b.reverifyClaimed}
                claimable={b.reverifyClaimable}
                loading={claimReverifyMut.isPending}
                onClaim={() => claimReverifyMut.mutate()}
                accent="amber"
              />
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
                onReverify={() => router.navigate({ to: "/reverify" })}
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
              <p className="text-[10px] text-violet mt-0.5 font-bold">{verifiedCount} জন রি-ভেরিফাইয়ের অপেক্ষায়</p>
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
              return t.status === "verified" && (t.whitelist_ok === false || dueMs <= Date.now());
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
                            onReverify={() => router.navigate({ to: "/reverify" })}
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


      <div className="text-center py-2 space-y-2">
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
    </div>

    </NowProvider>
  );
}



function useTick() {
  return useContext(NowContext);
}


function MainIdentityCell({ task, onStart, onReverify, onOpenPhoto }: { task: any; onStart: () => void; onReverify: () => void; onOpenPhoto: (url: string) => void }) {
  const now = useTick();
  const isVerified = task.status === "verified";
  const dueMs = task.reverify_due_at ? new Date(task.reverify_due_at).getTime() : 0;
  const whitelistLost = task.whitelist_ok === false;
  const readyToReverify = isVerified && (whitelistLost || dueMs <= now);
  const remainingMs = Math.max(0, dueMs - now);
  const faceUrl: string | undefined = task.signed_face_url;

  if (isVerified && !readyToReverify) {
    const totalSec = Math.floor(remainingMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
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
        <p className="absolute bottom-1 left-0 right-0 text-[10px] font-black text-white text-center mono-num drop-shadow">
          {d}d {String(h).padStart(2,"0")}h
        </p>
      </button>
    );
  }

  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify} data-voice="reverify.button"
        className="relative w-24 h-24 rounded-2xl overflow-hidden border-2 shadow-[0_10px_28px_-6px_rgba(139,92,246,0.75)] active:scale-95 transition"
        style={{ borderColor: "var(--color-violet)" }}>
        {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="main" />
                 : <div className="absolute inset-0 task-cell-reverify" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-violet/20 to-black/20" />
        <span className="absolute top-1 right-1 rounded-full p-1 shadow" style={{ background: "var(--color-violet)" }}>
          <Sparkles className="w-3 h-3 text-white" />
        </span>
        <p className="absolute bottom-1 left-1 right-1 rounded-lg bg-white/18 backdrop-blur-[3px] text-[9px] font-black text-white text-center leading-tight py-1 drop-shadow">
          রি-ভেরিফাই
        </p>
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
  const now = useTick();
  const isDone = task.status === "done";
  const isVerified = task.status === "verified";
  const dueMs = task.reverify_due_at ? new Date(task.reverify_due_at).getTime() : 0;
  const whitelistLost = task.whitelist_ok === false;
  const readyToReverify = isVerified && (whitelistLost || dueMs <= now);
  const remainingMs = Math.max(0, dueMs - now);
  const faceUrl: string | undefined = task.signed_face_url;

  if (isVerified && !readyToReverify) {
    const totalSec = Math.floor(remainingMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    return (
      <button onClick={() => faceUrl && onOpenPhoto(faceUrl)} data-voice="home.open.photo"
        className="relative aspect-square rounded-xl overflow-hidden border border-rose/60 shadow-[0_6px_14px_-4px_rgba(239,71,111,0.5)] active:scale-95 transition">
        {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />
                 : <div className="absolute inset-0 bg-surface-2" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />
        <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-[2px]">#{task.slot}</span>
        <span className="absolute top-1 right-1 rounded-full bg-rose p-0.5 shadow"><Lock className="w-2.5 h-2.5 text-white" /></span>
        <div className="absolute bottom-0.5 left-0 right-0 px-1">
          <p className="mono-num text-[11px] font-black text-white text-center drop-shadow leading-none">
            {d}d {String(h).padStart(2,"0")}h
          </p>
          <p className="mono-num text-[8px] text-white/90 text-center drop-shadow font-bold leading-tight">
            {String(m).padStart(2,"0")}m{String(s(totalSec)).padStart(2,"0")}s
          </p>
        </div>
      </button>
    );
  }

  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify} data-voice="reverify.button"
        className="relative aspect-square rounded-xl overflow-hidden border-2 border-violet shadow-[0_8px_18px_-5px_rgba(139,92,246,0.75)] active:scale-95 transition">
        {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />
                 : <div className="absolute inset-0 task-cell-reverify" />}
        <div className="absolute inset-0 bg-gradient-to-t from-violet/95 via-violet/40 to-violet/70" />
        <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/50">#{task.slot}</span>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-1">
          <Sparkles className="w-6 h-6 text-white drop-shadow" />
          <p className="text-[11px] font-black text-white text-center drop-shadow leading-tight">রি-ভেরিফাই</p>
          <p className="text-[8px] font-bold text-white/90 text-center leading-none">চাপুন</p>
        </div>
      </button>
    );
  }

  if (isVerified && readyToReverify) {
    return (
      <button onClick={onReverify} data-voice="reverify.button"
        className="relative flex flex-col overflow-hidden rounded-xl border-2 border-rose shadow-[0_8px_18px_-5px_rgba(239,71,111,0.65)] active:scale-95 transition bg-surface-2">
        <div className="relative aspect-square">
          {faceUrl ? <img src={faceUrl} className="absolute inset-0 h-full w-full object-cover" alt="" />
                   : <div className="absolute inset-0 task-cell-reverify" />}
          <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/55 backdrop-blur-[2px]">#{task.slot}</span>
          <span className="absolute top-1 right-1 rounded-full bg-rose p-1 shadow animate-pulse">
            <Sparkles className="w-3 h-3 text-white" />
          </span>
        </div>
        <div className="bg-rose text-white text-[10px] font-black text-center py-1 leading-tight animate-pulse">
          রি-ভেরিফাই করুন
        </div>
      </button>
    );
  }

  let cellClass = "task-cell-empty";
  let icon = <Camera className="w-5 h-5 text-white drop-shadow" />;
  let label = "শুরু";
  if (isDone) { cellClass = "task-cell-done"; icon = <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />; label = "সম্পন্ন"; }

  return (
    <button onClick={onStart} data-voice="home.tap.slot"
      className={`relative aspect-square rounded-xl ${cellClass} flex flex-col items-center justify-center gap-0.5 btn-press overflow-hidden`}>
      <span className="absolute top-1 left-1 text-[10px] font-black text-white mono-num leading-none px-1.5 py-0.5 rounded-md bg-black/45 backdrop-blur-[2px]">#{task.slot}</span>
      <span>{icon}</span>
      <span className="text-[9px] font-black text-white drop-shadow leading-none">{label}</span>
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

