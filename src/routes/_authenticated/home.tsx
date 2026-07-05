import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { addMoreSlots, batchSubmitPending } from "@/lib/tasks.functions";
import { MiningCounter } from "@/components/MiningCounter";
import { CheckCircle2, Camera, Lock, Sparkles, Loader2, X, Plus, Crown, Users, Heart, ShieldCheck, BadgeCheck, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
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
  const [witnessPage, setWitnessPage] = useState(0);
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
      />
      </div>

      {/* Premium hero submit button — placed near the top so it's the first thing users see. */}
      {(firstEmpty || allSubmitted) && (
        <button
          onClick={() => {
            if (firstEmpty) {
              router.navigate({ to: "/task/$slot", params: { slot: String(firstEmpty.slot) } });
              return;
            }
            addSlots.mutate();
          }}
          disabled={!firstEmpty && addSlots.isPending}
          className="submit-hero w-full rounded-3xl px-5 py-5 text-white font-black btn-press flex items-center gap-3 disabled:opacity-70"
        >
          <span className="shrink-0 w-14 h-14 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-3xl border border-white/40 shadow-inner">
            {addSlots.isPending && !firstEmpty
              ? <Loader2 className="w-7 h-7 animate-spin" />
              : <span className="rocket">🚀</span>}
          </span>
          <span className="flex-1 text-left leading-tight">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-white/85 font-bold">
              {firstEmpty ? "এক ট্যাপে সাক্ষী যোগ" : "নতুন ব্যাচ আনলক"}
            </span>
            <span className="block text-2xl font-black drop-shadow-sm mt-0.5">
              {firstEmpty ? "জমা দিন" : "আরও ১০ Slot"}
            </span>
            <span className="block text-[11px] text-white/90 font-bold mt-0.5">
              {firstEmpty
                ? `Slot #${firstEmpty.slot} · এখনই ছবি তুলুন`
                : "১০ জন সম্পন্ন — আরও যোগ করুন"}
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
          const PAGE_SIZE = 10;
          const pageCount = Math.max(1, Math.ceil(witnessTasks.length / PAGE_SIZE));
          const safePage = Math.min(witnessPage, pageCount - 1);
          const pageTasks = witnessTasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
          return (
            <>
              {pageCount > 1 && (
                <div className="flex items-center justify-between mb-2 gap-2">
                  <button onClick={() => setWitnessPage(Math.max(0, safePage - 1))}
                    disabled={safePage === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-bold disabled:opacity-40 btn-press">
                    <ChevronLeft className="w-3.5 h-3.5" /> আগের
                  </button>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {Array.from({ length: pageCount }).map((_, i) => (
                      <button key={i} onClick={() => setWitnessPage(i)}
                        className={`min-w-8 h-8 px-2 rounded-lg text-[11px] font-black btn-press ${
                          i === safePage ? "bg-rose text-white shadow" : "bg-surface-2 border border-border text-muted-foreground"
                        }`}>
                        {i * PAGE_SIZE + 1}–{Math.min((i + 1) * PAGE_SIZE, witnessTasks.length)}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setWitnessPage(Math.min(pageCount - 1, safePage + 1))}
                    disabled={safePage >= pageCount - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-bold disabled:opacity-40 btn-press">
                    পরের <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
                {pageTasks.map((t) => (
                  <TaskCell key={t.slot} task={t}
                    onStart={() => router.navigate({ to: "/task/$slot", params: { slot: String(t.slot) } })}
                    onReverify={() => router.navigate({ to: "/reverify" })}
                    onOpenPhoto={(url) => setLightbox({ url, label: `সাক্ষী #${t.slot} · ${t.face_label || "মুখ"}` })} />
                ))}
              </div>
            </>
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

  let cellClass = "task-cell-empty";
  let icon = <Camera className="w-5 h-5 text-white drop-shadow" />;
  let label = "শুরু";
  if (isDone) { cellClass = "task-cell-done"; icon = <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />; label = "সম্পন্ন"; }
  else if (readyToReverify) { cellClass = "task-cell-reverify"; icon = <Sparkles className="w-5 h-5 text-white drop-shadow" />; label = "রি-ভেরিফাই"; }

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
