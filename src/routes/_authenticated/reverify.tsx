import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listReverifyCandidates, completeReverify } from "@/lib/tasks.functions";
import { buildVerifyUrl, isWhitelisted } from "@/lib/gooddollar";
import { FaceCapture } from "@/components/FaceCapture";
import { ArrowLeft, ExternalLink, Loader2, RefreshCcw, Search, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import { playVoiceAuto } from "@/lib/voice-guide";
import { getAppStatus } from "@/lib/app-status.functions";
import { FaceVerifyPausedNotice } from "@/components/FaceVerifyPausedNotice";
import { isLiteBuild } from "@/lib/lite-build";


export const Route = createFileRoute("/_authenticated/reverify")({
  component: ReverifyPage,
  validateSearch: (s: Record<string, unknown>) => ({ taskId: typeof s.taskId === "string" ? s.taskId : undefined }),
});

type Step = "list" | "verify" | "photo" | "done";

function formatRemaining(ms: number) {
  if (ms <= 0) return "0 দিন";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days} দিন ${hours} ঘন্টা`;
  if (hours > 0) return `${hours} ঘন্টা ${mins} মিনিট`;
  return `${mins} মিনিট`;
}

function ReverifyPage() {
  const lite = isLiteBuild();
  const { taskId: initialTaskId } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("list");
  const [opened, setOpened] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [preChecking, setPreChecking] = useState<string | null>(null);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const [tick, setTick] = useState(0);
  const returnedRef = useRef(false);
  const leftForGoodDollarRef = useRef(false);
  const goodDollarOpenedAtRef = useRef(0);
  const submitReadySpokenRef = useRef(false);

  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 60_000,
  });
  const faceVerifyOff = appStatus?.faceVerifyEnabled === false;

  const { data: candidates, isFetching, refetch } = useQuery({
    queryKey: ["reverify-candidates", query],
    queryFn: () => listReverifyCandidates({ data: { query } }),
  });

  // Live tick every 30s so countdown labels stay fresh.
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const { readyList, waitingList } = useMemo(() => {
    const now = Date.now();
    const ready: any[] = [];
    const waiting: any[] = [];
    for (const c of (candidates ?? []) as any[]) {
      const due = c.reverify_due_at ? new Date(c.reverify_due_at).getTime() : 0;
      const whitelistLost = c.whitelist_ok === false;
      // Only trigger re-verify when Good-App has actually dropped the whitelist.
      // Time alone (4 days) is just a guideline — never enough by itself.
      if (whitelistLost) ready.push({ ...c, _whitelistLost: true, _rem: 0 });
      else waiting.push({ ...c, _rem: Math.max(0, due - now) });
    }
    return { readyList: ready, waitingList: waiting };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, tick]);

  // Auto-select the task the user tapped on the home page.
  useEffect(() => {
    if (autoSelectDone || !initialTaskId || !candidates) return;
    const match = (candidates as any[]).find((c) => c.id === initialTaskId);
    if (match) {
      setAutoSelectDone(true);
      onSelect(match);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, initialTaskId, autoSelectDone]);

  const completeMut = useMutation({
    mutationFn: (input: { taskId: string; newPhotoBase64?: string }) => completeReverify({ data: input }),
    onSuccess: (r: any) => {
      toast.success(lite ? "নিরাপত্তা আপডেট সম্পন্ন হয়েছে!" : r.miningActivated ? "🎉 মাইনিং শুরু হয়েছে!" : "রি-ভেরিফাই সম্পন্ন হয়েছে!");
      setStep("done");
      setTimeout(() => { setStep("list"); setSelected(null); setVerifyUrl(null); refetch(); }, 2500);
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (step !== "verify" || !opened) return;
    const markLeft = () => { leftForGoodDollarRef.current = true; };
    const onReturn = () => {
      const openedLongEnough = goodDollarOpenedAtRef.current > 0 && Date.now() - goodDollarOpenedAtRef.current > 1500;
      if (document.visibilityState === "visible" && (leftForGoodDollarRef.current || openedLongEnough) && !returnedRef.current) {
        returnedRef.current = true;
        setCountdown(10);
        playVoiceAuto("task.gd.after");
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") markLeft();
      else onReturn();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", markLeft);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", markLeft);
      window.removeEventListener("focus", onReturn);
    };
  }, [step, opened]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    submitReadySpokenRef.current = false;
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (step === "verify" && opened && returnedRef.current && countdown === 0 && !submitReadySpokenRef.current) {
      submitReadySpokenRef.current = true;
      playVoiceAuto("reverify.submit.ready");
    }
  }, [step, opened, countdown]);

  useEffect(() => {
    if (step === "photo") playVoiceAuto("reverify.photo");
  }, [step]);

  const onSelect = async (cand: any) => {
    if (faceVerifyOff) {
      toast.error("রি-ভেরিফাই আপাতত সাময়িকভাবে বন্ধ আছে — সার্ভারে কাজ চলছে।", { duration: 5000 });
      return;
    }
    // Pre-check: if the key is still whitelisted on Good-App, block —
    // re-verify won't do anything. This prevents users burning the same
    // face verify twice in a row.
    setPreChecking(cand.id);
    try {
      const stillWhitelisted = await isWhitelisted(cand.wallet_address);
      if (stillWhitelisted) {
        toast.error("এখনো এই key ভেরিফাইড আছে — এখন রি-ভেরিফাই লাগবে না। দয়া করে পরে আবার চেষ্টা করুন।", { duration: 5000 });
        refetch();
        return;
      }
      setSelected(cand);
      const { url } = await buildVerifyUrl(cand.wallet_private_key, cand.face_label || "User");
      setVerifyUrl(url);
      setStep("verify");
      setOpened(false);
      returnedRef.current = false;
      leftForGoodDollarRef.current = false;
      goodDollarOpenedAtRef.current = 0;
      setCountdown(null);
    } catch (e: any) {
      toast.error(e.message ?? "কিছু ভুল হয়েছে");
    } finally {
      setPreChecking(null);
    }
  };

  const onSubmit = async () => {
    if (!selected) return;
    setChecking(true);
    try {
      const ok = await isWhitelisted(selected.wallet_address);
      if (!ok) {
        toast.error("হোয়াইটলিস্টে পাওয়া যায়নি — good-app ভেরিফাই শেষ করুন");
        return;
      }
      setStep("photo");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChecking(false);
    }
  };

  const onNewPhoto = (b64: string) => {
    if (!selected) return;
    completeMut.mutate({ taskId: selected.id, newPhotoBase64: b64 });
  };

  const renderCard = (c: any, ready: boolean) => {
    const isPre = preChecking === c.id;
    const lost = c._whitelistLost;
    return (
      <button
        key={c.id}
        disabled={!ready || isPre}
        onClick={() => onSelect(c)}
        data-voice={ready ? "reverify.button" : "common.saved"}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition ${
          ready
            ? lost
              ? "border-rose bg-rose/10 hover:bg-rose/15 shadow-lg shadow-rose/10"
              : "border-amber bg-amber/10 hover:bg-amber/15 shadow-lg shadow-amber/10"
            : "border-border bg-surface-2 opacity-70"
        }`}
      >
        {c.photo_url
          ? <img src={c.photo_url} alt={c.face_label ?? ""} className={`w-20 h-20 rounded-xl object-cover border-2 ${ready ? "border-amber/60" : "border-border"}`} />
          : <div className="w-20 h-20 rounded-xl bg-surface-2 flex items-center justify-center text-2xl">👤</div>}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-base font-black truncate">{c.face_label || "নামহীন"}</p>
          <p className="text-[10px] text-muted-foreground mono-num truncate">
            স্লট #{c.slot} · {c.wallet_address?.slice(0, 10)}…{c.wallet_address?.slice(-4)}
          </p>
          {ready ? (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
              lost ? "bg-rose text-white" : "bg-amber text-background"
            }`}>
              {isPre ? <><Loader2 className="w-3 h-3 animate-spin" /> চেক হচ্ছে…</>
                : lost ? <><AlertTriangle className="w-3 h-3" /> এখনই রি-ভেরিফাই করুন</>
                : <><RefreshCcw className="w-3 h-3" /> রি-ভেরিফাই প্রস্তুত</>}
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-surface-2 text-muted-foreground border border-border">
              <Clock className="w-3 h-3" /> ভেরিফাইড ✓ · আনুমানিক ৪–৫ দিনের মধ্যে লাগতে পারে
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="reverify" steps={["reverify.intro","reverify.search","reverify.button","task.gd.after","reverify.submit.ready","reverify.submit.clicked","reverify.photo"]} />
      <Link to="/home" data-voice="common.back"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full gradient-cta text-white text-sm font-black shadow-lg btn-press">
        <ArrowLeft className="w-4 h-4" /> পিছনে যান
      </Link>

      {faceVerifyOff ? (
        <FaceVerifyPausedNotice message={appStatus?.faceVerifyMessage} />
      ) : (
      <>
      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <RefreshCcw className="w-5 h-5 text-amber shrink-0" />
        <div className="min-w-0">
          <h1 className="text-base font-black text-amber">{lite ? "নিরাপত্তা আপডেট" : "রি-ভেরিফাই"}</h1>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {lite ? "আপনার সংরক্ষিত পরিচয় তথ্য আপডেটের প্রয়োজন হলে অ্যাপ এখানে জানাবে। সব ঠিক থাকলে কিছু করতে হবে না।" : "শুধুমাত্র যখন Good-App হোয়াইটলিস্ট বাতিল করবে তখনই এই অ্যাপ রি-ভেরিফাই চাইবে। হোয়াইটলিস্ট ঠিক থাকলে কিছু করতে হবে না — কোনো সময়সীমা নেই, অপেক্ষার দরকার নেই।"}
          </p>
        </div>
      </div>

      {step === "list" && (
        <>
          {/* 🔴 Ready-to-reverify block — always on top, prominent */}
          {readyList.length > 0 && (
            <div className="rounded-2xl p-3 border-2 border-amber/60 bg-linear-to-br from-amber/15 via-rose/5 to-transparent space-y-2">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] uppercase tracking-widest font-black text-amber flex items-center gap-1.5">
                   🔔 {lite ? "এখনই নিরাপত্তা আপডেট করুন" : "এখনই রি-ভেরিফাই করুন"}
                </p>
                <span className="mono-num text-[11px] font-black text-amber bg-amber/20 px-2.5 py-0.5 rounded-full">
                  {readyList.length}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground px-1">
                 {lite ? "নিচের পরিচয়গুলোর নিরাপত্তা আপডেট প্রয়োজন। ট্যাপ করে ধাপগুলো সম্পন্ন করুন।" : "নিচের face গুলোর হোয়াইটলিস্ট বাতিল হয়েছে। ট্যাপ করলে সরাসরি রি-ভেরিফাই খুলবে।"}
              </p>
              <div className="space-y-2">
                {readyList.map((c) => renderCard(c, true))}
              </div>
            </div>
          )}

          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="relative" data-voice="reverify.search">
              <Search className="w-4 h-4 absolute top-3 left-3 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="নাম দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber" />
            </div>

            {isFetching ? (
              <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-amber" /></div>
            ) : (readyList.length === 0 && waitingList.length === 0) ? (
              <p className="text-center text-xs text-muted-foreground py-6">
                 {query ? "এই নামে কিছু পাওয়া যায়নি" : lite ? "এখন কোনো নিরাপত্তা আপডেট প্রয়োজন নেই" : "রি-ভেরিফাই এর জন্য এখনও কিছু নেই"}
              </p>
            ) : waitingList.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black px-1">
                  ✅ ভেরিফাইড ({waitingList.length}) — এখন কিছু করতে হবে না
                </p>
                {waitingList.map((c) => renderCard(c, false))}
              </div>
            )}
          </div>
        </>
      )}

      {step === "verify" && selected && verifyUrl && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="rounded-xl bg-amber/10 border border-amber/30 p-3 flex items-center gap-3">
            {selected.photo_url && <img src={selected.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover" />}
            <div className="min-w-0">
              <p className="text-sm font-black text-amber truncate">🔄 {selected.face_label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 break-all">{selected.wallet_address}</p>
            </div>
          </div>
          <a href={verifyUrl} target="_blank" rel="noopener noreferrer" data-voice="reverify.button"
            onClick={() => { setOpened(true); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = Date.now(); }}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl gradient-cta font-black">
             <ExternalLink className="w-4 h-4" /> {lite ? "পরিচয় যাচাই খুলুন" : "Good-App রি-ভেরিফাই খুলুন"}
          </a>
          {opened && countdown !== null && countdown > 0 && (
            <div className="text-center py-3 rounded-xl bg-amber/10 border border-amber/30">
              <p className="text-xs text-muted-foreground">জমা দিন বাটন আসবে</p>
              <p className="text-3xl font-black text-amber mono-num">{countdown}s</p>
            </div>
          )}
          {opened && countdown === 0 && (
            <button onClick={onSubmit} disabled={checking} data-voice="reverify.submit.clicked"
              className="w-full py-4 rounded-xl gradient-cta font-black flex items-center justify-center gap-2">
              {checking ? <><Loader2 className="w-4 h-4 animate-spin" /> যাচাই হচ্ছে…</> : <><ShieldCheck className="w-4 h-4" /> জমা দিন</>}
            </button>
          )}
          <button onClick={() => { setStep("list"); setSelected(null); setVerifyUrl(null); setOpened(false); setCountdown(null); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = 0; }}
            className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground">বাতিল</button>
        </div>
      )}

      {step === "photo" && selected && (
        <div className="glass rounded-2xl p-4 space-y-2">
          <p className="text-xs text-emerald font-bold text-center">✅ Whitelist নিশ্চিত হয়েছে — নতুন ছবি তুলুন</p>
          <FaceCapture title="নতুন ছবি" onCapture={onNewPhoto}
            onCancel={() => setStep("verify")} isUploading={completeMut.isPending} />
        </div>
      )}

      {step === "done" && (
        <div className="rounded-2xl bg-emerald/10 border border-emerald/40 p-6 text-center">
          <ShieldCheck className="w-12 h-12 text-emerald mx-auto mb-2" />
           <p className="font-black text-emerald">{lite ? "নিরাপত্তা আপডেট সফল হয়েছে" : "রি-ভেরিফাই সফল হয়েছে"}</p>
        </div>
      )}
      </>
      )}
    </div>
  );
}
