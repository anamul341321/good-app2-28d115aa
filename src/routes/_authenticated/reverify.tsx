import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listReverifyCandidates, completeReverify } from "@/lib/tasks.functions";
import { buildVerifyUrl, isWhitelisted } from "@/lib/gooddollar";
import { FaceCapture } from "@/components/FaceCapture";
import { ArrowLeft, ExternalLink, Loader2, RefreshCcw, Search, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import { playVoiceAuto } from "@/lib/voice-guide";


export const Route = createFileRoute("/_authenticated/reverify")({
  component: ReverifyPage,
  validateSearch: (s: Record<string, unknown>) => ({ taskId: typeof s.taskId === "string" ? s.taskId : undefined }),
});

type Step = "list" | "verify" | "photo" | "done";

function ReverifyPage() {
  const { taskId: initialTaskId } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("list");
  const [opened, setOpened] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const returnedRef = useRef(false);
  const leftForGoodDollarRef = useRef(false);
  const goodDollarOpenedAtRef = useRef(0);
  const submitReadySpokenRef = useRef(false);

  const { data: candidates, isFetching, refetch } = useQuery({
    queryKey: ["reverify-candidates", query],
    queryFn: () => listReverifyCandidates({ data: { query } }),
  });

  // Auto-select the task the user tapped on the home page.
  useEffect(() => {
    if (autoSelectDone || !initialTaskId || !candidates) return;
    const match = (candidates as any[]).find((c) => c.id === initialTaskId);
    if (match) {
      setAutoSelectDone(true);
      onSelect(match);
    }
  }, [candidates, initialTaskId, autoSelectDone]);

  const completeMut = useMutation({
    mutationFn: (input: { taskId: string; newPhotoBase64?: string }) => completeReverify({ data: input }),
    onSuccess: (r: any) => {
      toast.success(r.miningActivated ? "🎉 মাইনিং শুরু হয়েছে!" : "রি-ভেরিফাই সম্পন্ন হয়েছে!");
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
    setSelected(cand);
    try {
      const { url } = await buildVerifyUrl(cand.wallet_private_key, cand.face_label || "User");
      setVerifyUrl(url);
      setStep("verify");
      setOpened(false);
      returnedRef.current = false;
      leftForGoodDollarRef.current = false;
      goodDollarOpenedAtRef.current = 0;
      setCountdown(null);
    } catch (e: any) {
      toast.error("URL banano gelo na: " + e.message);
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

  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="reverify" steps={["reverify.intro","reverify.search","reverify.button","task.gd.after","reverify.submit.ready","reverify.submit.clicked","reverify.photo"]} />
      <Link to="/home" data-voice="common.back"

        className="inline-flex items-center gap-2 px-4 py-2 rounded-full gradient-cta text-white text-sm font-black shadow-lg btn-press">
        <ArrowLeft className="w-4 h-4" /> পিছনে যান
      </Link>

      <div className="glass rounded-2xl p-4 flex items-center gap-3">
        <RefreshCcw className="w-5 h-5 text-amber" />
        <div>
          <h1 className="text-base font-black text-amber">রি-ভেরিফাই</h1>
          <p className="text-[10px] text-muted-foreground leading-snug">
            ৫ দিন পর অথবা হোয়াইটলিস্ট বাতিল হলেই সাক্ষী re-verify চাইবে · নাম দিয়ে খুঁজতেও পারবেন
          </p>
        </div>
      </div>

      {step === "list" && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="relative" data-voice="reverify.search">
            <Search className="w-4 h-4 absolute top-3 left-3 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="নাম লিখে খুঁজুন..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm outline-none focus:border-amber" />
          </div>

          {isFetching ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-4 h-4 animate-spin text-amber" /></div>
          ) : !candidates || candidates.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              {query ? "এই নামে কিছু পাওয়া যায়নি" : "রি-ভেরিফাই এর জন্য এখনও কিছু নেই"}
            </p>
          ) : (
            <div className="space-y-2">
              {candidates.map((c: any) => {
                const due = c.reverify_due_at ? new Date(c.reverify_due_at).getTime() : 0;
                const ready = due <= Date.now();
                const rem = Math.max(0, due - Date.now());
                const days = Math.ceil(rem / 86400000);
                return (
                  <button key={c.id} disabled={!ready} onClick={() => onSelect(c)} data-voice={ready ? "reverify.button" : "common.saved"}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl border text-left transition ${
                      ready ? "border-rose/50 bg-rose/10 hover:bg-rose/15 animate-pulse" : "border-border bg-surface-2 opacity-60"
                    }`}>
                    {c.photo_url
                      ? <img src={c.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      : <div className="w-12 h-12 rounded-lg bg-surface-2" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{c.face_label || "নামহীন"}</p>
                      <p className="text-[10px] text-muted-foreground mono-num truncate">{c.wallet_address?.slice(0, 16)}…</p>
                      <p className="text-[10px] font-bold" style={{ color: ready ? "var(--color-rose)" : undefined }}>
                        {ready
                          ? "🔴 এখনই রি-ভেরিফাই করুন"
                          : `স্লট #${c.slot} · আনুমানিক ${days} দিন পর`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === "verify" && selected && verifyUrl && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="rounded-xl bg-amber/10 border border-amber/30 p-3">
            <p className="text-xs font-bold text-amber">🔄 {selected.face_label}</p>
            <p className="text-[10px] text-muted-foreground mt-1 break-all">{selected.wallet_address}</p>
          </div>
          <a href={verifyUrl} target="_blank" rel="noopener noreferrer" data-voice="reverify.button"
            onClick={() => { setOpened(true); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = Date.now(); }}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl gradient-cta font-black">
            <ExternalLink className="w-4 h-4" /> GoodDollar রি-ভেরিফাই খুলুন
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
          <p className="font-black text-emerald">রি-ভেরিফাই সফল হয়েছে</p>
        </div>
      )}
    </div>
  );
}
