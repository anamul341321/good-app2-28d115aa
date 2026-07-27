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

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const task = data?.tasks.find((t: any) => t.slot === slotNum);

  const LS_KEY = `task-progress-${slotNum}`;
  const [step, setStep] = useState<Step>("intro");
  const [faceLabel, setFaceLabel] = useState<string>("");
  const [photoB64, setPhotoB64] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ privateKey: string; address: string; verifyUrl: string } | null>(null);
  const [verifyOpened, setVerifyOpened] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [submitUnlocked, setSubmitUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const [quickSubmitting, setQuickSubmitting] = useState(false);
  const [progressRestored, setProgressRestored] = useState(false);
  const returnedRef = useRef(false);
  const leftForGoodDollarRef = useRef(false);
  const goodDollarOpenedAtRef = useRef(0);
  const submitReadySpokenRef = useRef(false);

  // Restore saved progress after hydration. Invalid/incomplete progress used to
  // leave a slot with no matching screen; normalize it to the nearest safe step.
  useEffect(() => {
    if (!task) return;
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (!saved || typeof saved !== "object") {
        setProgressRestored(true);
        return;
      }
      // Admin reset advances task.created_at. Never restore a face/key saved
      // for an older lifecycle of this slot.
      if (saved.taskVersion !== task.created_at) {
        localStorage.removeItem(LS_KEY);
        setFaceLabel("");
        setPhotoB64(null);
        setIdentity(null);
        setVerifyOpened(false);
        setStep("intro");
        setProgressRestored(true);
        return;
      }
      const savedLabel = typeof saved.faceLabel === "string" ? saved.faceLabel : "";
      const savedPhoto = typeof saved.photoB64 === "string" ? saved.photoB64 : null;
      const savedIdentity = saved.identity?.privateKey && saved.identity?.address && saved.identity?.verifyUrl
        ? saved.identity
        : null;
      setFaceLabel(savedLabel);
      setPhotoB64(savedPhoto);
      setIdentity(savedIdentity);
      setVerifyOpened(saved.verifyOpened === true);
      const safeStep: Step = saved.step === "verify" && savedPhoto && savedIdentity
        ? "verify"
        : saved.step === "photo" && savedLabel.trim().length >= 2
          ? "photo"
          : saved.step === "name" || saved.step === "intro"
            ? saved.step
            : "intro";
      setStep(safeStep);
    } catch {
      localStorage.removeItem(LS_KEY);
    } finally {
      setProgressRestored(true);
    }
  }, [LS_KEY, task?.created_at]);

  // Auto-resolve stale saved key: on slot open, if a previous key+photo exists
  // AND enough time has passed since it was generated, silently check whitelist.
  // If ok → submit. If not → wipe & restart fresh.
  // Guard with a minimum age so the check doesn't fire the moment a user re-enters
  // the slot right after generating the key (before they've even opened Good-App).
  const AUTO_RESOLVE_MIN_AGE_MS = 3 * 60 * 1000; // 3 minutes
  const autoResolvedRef = useRef(false);
  useEffect(() => {
    if (!progressRestored || autoResolvedRef.current) return;
    if (!identity || !photoB64) return;
    if (task?.status !== "empty") return;
    // Read saved timestamp; if too fresh, skip auto-check entirely this session.
    let savedAt = 0;
    try {
      const raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      savedAt = typeof raw?.savedAt === "number" ? raw.savedAt : 0;
    } catch {}
    if (!savedAt || Date.now() - savedAt < AUTO_RESOLVE_MIN_AGE_MS) return;
    autoResolvedRef.current = true;
    (async () => {
      try {
        const ok = await isWhitelisted(identity.address);
        if (ok) {
          setStep("submitting");
          bindMut.mutate({
            photoBase64: photoB64,
            privateKey: identity.privateKey,
            walletAddress: identity.address,
            faceLabel: (faceLabel || data?.profile?.display_name || "নাম নেই").trim(),
          });
        } else {
          try {
            await saveNotWhitelisted({
              data: {
                slot: slotNum, kind: "first_verify",
                photoBase64: photoB64,
                privateKey: identity.privateKey,
                walletAddress: identity.address,
                faceLabel: faceLabel.trim(),
                reason: "পুরনো key — whitelist পাওয়া যায়নি, নতুন করে শুরু",
              },
            });
          } catch {}
          try { localStorage.removeItem(LS_KEY); } catch {}
          setPhotoB64(null); setIdentity(null); setVerifyOpened(false);
          setCountdown(null); setSubmitUnlocked(false);
          returnedRef.current = false; leftForGoodDollarRef.current = false;
          goodDollarOpenedAtRef.current = 0;
          setFaceLabel(""); setStep("intro");
          toast.info("পুরনো key whitelist পায়নি — নতুন করে শুরু করুন");
        }
      } catch {
        // silent — user can retry manually
      }
    })();
  }, [progressRestored, identity, photoB64, task?.status]);

  // Persist progress so refresh doesn't lose the key
  useEffect(() => {
    if (!progressRestored) return;
    if (typeof window === "undefined") return;
    if (step === "intro" && !identity && !photoB64) {
      localStorage.removeItem(LS_KEY);
      return;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({
      step,
      faceLabel,
      photoB64,
      identity,
      verifyOpened,
      taskVersion: task?.created_at,
    }));
  }, [LS_KEY, step, faceLabel, photoB64, identity, verifyOpened, progressRestored, task?.created_at]);

  const clearProgress = () => { try { localStorage.removeItem(LS_KEY); } catch {} };

  // When user returns from Good-App tab, start the 10s countdown before জমা দিন
  useEffect(() => {
    if (step !== "verify" || !verifyOpened) return;
    const markLeft = () => { leftForGoodDollarRef.current = true; };
    const onReturn = () => {
      const openedLongEnough = goodDollarOpenedAtRef.current > 0 && Date.now() - goodDollarOpenedAtRef.current > 1500;
      if (document.visibilityState === "visible" && (leftForGoodDollarRef.current || openedLongEnough) && !returnedRef.current) {
        returnedRef.current = true;
        setSubmitUnlocked(false);
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
    if (countdown <= 0) {
      setSubmitUnlocked(true);
      return;
    }
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
      toast.success("ভেরিফাই সম্পন্ন! Good-App whitelist হারালে অ্যাপ রি-ভেরিফাই চাইবে।");
      refetch();
      nav({ to: "/home" });
    },
    onError: (e: any) => { toast.error(e.message); setStep("verify"); },
  });

  if (isLoading) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;
  }
  if (isError || !task) {
    return (
      <div className="py-16 px-4 text-center space-y-3">
        <p className="text-sm font-black text-rose">Slot #{slotNum} লোড হয়নি</p>
        <p className="text-[11px] text-muted-foreground">{error instanceof Error ? error.message : "Slotটি পাওয়া যায়নি"}</p>
        <button onClick={() => refetch()} className="px-4 py-2 rounded-xl gradient-cta text-sm font-black">আবার চেষ্টা করুন</button>
      </div>
    );
  }

  const isDone = task.status === "done";
  const isVerified = task.status === "verified";
  const whitelistLost = task.whitelist_ok === false;

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
    if (!identity || !photoB64 || !submitUnlocked || countdown !== 0) return;
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
        setSubmitUnlocked(false);
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
          {isVerified && <span className="text-emerald">✅ WHITELISTED — Good-App হোয়াইটলিস্ট বাতিল হলেই কেবল রি-ভেরিফাই লাগবে</span>}
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

      {isVerified && !whitelistLost && (() => {
        const anchor = task.last_reverified_at || task.done_at || task.verified_at;
        const anchorMs = anchor ? new Date(anchor).getTime() : null;
        const elapsedDays = anchorMs ? (Date.now() - anchorMs) / 86400000 : null;
        const remainMin = elapsedDays != null ? Math.max(0, 4 - elapsedDays) : null;
        const remainMax = elapsedDays != null ? Math.max(0, 5 - elapsedDays) : null;
        const pct = elapsedDays != null ? Math.min(100, (elapsedDays / 5) * 100) : 0;
        return (
        <div className="rounded-2xl bg-emerald/10 border border-emerald/40 p-5 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald mx-auto mb-2" />
          <p className="font-bold">এই ঘর হোয়াইটলিস্টেড ✅</p>
          {elapsedDays != null && (
            <div className="mt-3 rounded-xl bg-surface-2/60 border border-emerald/30 p-3">
              <p className="text-[11px] font-black text-emerald">
                ⏳ আনুমানিক রি-ভেরিফাই সময়সূচি
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-black/20 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald via-amber to-rose transition-all"
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {remainMin! > 0
                  ? <>আপনি ফেস ভেরিফাই করেছেন <b className="text-foreground mono-num">{elapsedDays.toFixed(1)}</b> দিন আগে। সাধারণত <b className="text-foreground">৪–৫ দিন</b> পর Good-App রি-ভেরিফাই চাইতে পারে — প্রায় <b className="text-amber mono-num">{remainMin!.toFixed(1)}–{remainMax!.toFixed(1)}</b> দিনের মধ্যে প্রস্তুত থাকুন।</>
                  : <>ইতিমধ্যে <b className="text-foreground mono-num">{elapsedDays.toFixed(1)}</b> দিন হয়েছে — যেকোনো সময় Good-App রি-ভেরিফাই চাইতে পারে। হোয়াইটলিস্ট বাতিল হলে সাথে সাথে এখানে জানানো হবে।</>}
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            Good-App হোয়াইটলিস্ট বাতিল না হওয়া পর্যন্ত কিছু করতে হবে না — বাতিল হলে অ্যাপ নিজেই জানাবে।
          </p>
          <Link to="/home" className="inline-block mt-3 px-4 py-2 rounded-xl gradient-cta text-sm font-bold">হোম</Link>
        </div>
        );
      })()}

      {isVerified && whitelistLost && (
        <div className="rounded-2xl bg-rose/10 border border-rose/40 p-5 text-center">
          <Clock className="w-10 h-10 text-rose mx-auto mb-2" />
          <p className="font-bold">রি-ভেরিফাই প্রয়োজন</p>
          <p className="text-[11px] text-muted-foreground mt-2">
            Good-App হোয়াইটলিস্ট বাতিল হয়েছে। এখনই রি-ভেরিফাই পেজ থেকে ঠিক করুন।
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
              setSubmitUnlocked(false);
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
            onClick={() => { setVerifyOpened(true); setSubmitUnlocked(false); setCountdown(null); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = Date.now(); }}
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
          {verifyOpened && submitUnlocked && countdown === 0 && (
            <button onClick={onSubmit} disabled={checking || bindMut.isPending}
              data-voice="task.submit.clicked"
              className="w-full py-4 rounded-xl gradient-cta font-black flex items-center justify-center gap-2">
              {checking || bindMut.isPending
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
                setSubmitUnlocked(false);
                returnedRef.current = false;
                leftForGoodDollarRef.current = false;
                goodDollarOpenedAtRef.current = 0;
                toast.success("নতুন কী তৈরি হয়েছে");
              } catch (e: any) { toast.error("কী তৈরি হয়নি: " + e.message); }
            }}
            data-voice="task.gd" className="w-full py-3 rounded-xl border border-amber/40 bg-amber/10 text-amber text-xs font-bold">
            🔄 নতুন কী তৈরি করুন
          </button>
          <button onClick={() => { clearProgress(); setStep("intro"); setIdentity(null); setPhotoB64(null); setFaceLabel(""); setVerifyOpened(false); setCountdown(null); setSubmitUnlocked(false); returnedRef.current = false; leftForGoodDollarRef.current = false; goodDollarOpenedAtRef.current = 0; }} data-voice="common.back"
            className="w-full py-2 rounded-xl border border-border text-xs text-muted-foreground">
            বাতিল ও সব মুছে ফেলুন
          </button>
        </div>
      )}
    </div>
  );
}
