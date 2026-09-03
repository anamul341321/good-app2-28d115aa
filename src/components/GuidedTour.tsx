// First-time guided tour with the same cheerful cached TTS as PageVoice.
// - Auto-shows once per browser (localStorage flag).
// - Starts with a "শুরু করুন" tap so browser autoplay unlocks.
// - No robotic speechSynthesis fallback — only the expressive cached premium voice.
import { useEffect, useRef, useState } from "react";
import { X, Volume2, VolumeX, ChevronRight, SkipForward, Sparkles } from "lucide-react";
import type { NarrationKey } from "@/lib/narrations";
import { isLiteBuild } from "@/lib/lite-build";
import {
  isVoiceMuted,
  playVoiceFromGesture,
  preloadVoices,
  setVoiceMuted,
  stopVoice,
} from "@/lib/voice-guide";

export type TourStep = {
  selector?: string; // optional — welcome/finish have no target
  title: string;
  text: string; // written tooltip
  voice: NarrationKey; // narration key played through /api/public/tour-audio
};

const DEFAULT_STEPS: TourStep[] = [
  { title: "স্বাগত!", text: "চলুন এক মিনিটে গোটা অ্যাপটা ঘুরে দেখি। শুরু করুন চাপ দিয়ে শুরু করুন।", voice: "tour.welcome" },
  { selector: "[data-tour='mining']", title: "মাইনিং কার্ড", text: "এখানে আপনার আয় লাইভ বাড়ছে। জমা টাকা ক্লেইম করে উইথড্র করুন।", voice: "tour.mining" },
  { selector: "[data-tour='main-identity']", title: "প্রধান পরিচয়", text: "প্রথমে এই ঘরে নিজের মুখ ভেরিফাই করুন।", voice: "tour.main" },
  { selector: "[data-tour='witness-grid']", title: "সাক্ষী ঘর", text: "নয়টি ঘরে সাক্ষী যোগ করুন — যত বেশি সাক্ষী তত বেশি আয়।", voice: "tour.witness" },
  { selector: "[data-tour='nav-reverify']", title: "রি-ভেরিফাই", text: "তিন দিন পর পুরনো মুখ এখান থেকে আবার ভেরিফাই করবেন।", voice: "tour.reverify" },
  { selector: "[data-tour='nav-referral']", title: "রেফার", text: "বন্ধু রেফার করলে দশ শতাংশ বোনাস আপনি পাবেন।", voice: "tour.referral" },
  { selector: "[data-tour='nav-wallet']", title: "ওয়ালেট", text: "বিকাশ বা নগদ নম্বর এখানে সেট করুন — একবারই।", voice: "tour.wallet" },
  { selector: "[data-tour='nav-withdraw']", title: "উইথড্র", text: "জমা টাকা এখান থেকে তুলুন।", voice: "tour.withdraw" },
  { selector: "[data-tour='profile']", title: "প্রোফাইল", text: "উপরের বাম কোণে আপনার প্রোফাইল, পাসপোর্ট কার্ড ও ইতিহাস।", voice: "tour.profile" },
  { title: "শেষ!", text: "ব্যস! এখন যেকোনো জায়গায় চাপ দিলেই বলে দিব পরে কী করতে হবে।", voice: "tour.finish" },
];

/** Lite (Play Store) tour — social & account-security only, no financial wording. */
const LITE_STEPS: TourStep[] = [
  { title: "স্বাগত!", text: "চলুন এক মিনিটে অ্যাপটা ঘুরে দেখি। শুরু করুন চাপ দিয়ে শুরু করুন।", voice: "tour.welcome" },
  { selector: "[data-tour='main-identity']", title: "পরিচয় সুরক্ষা", text: "অ্যাকাউন্ট নিরাপদ রাখতে প্রথমে নিজের ছবি দিয়ে পরিচয় নিশ্চিত করুন।", voice: "tour.main" },
  { selector: "[data-tour='nav-reverify']", title: "নিরাপত্তা আপডেট", text: "মাঝে মাঝে এখান থেকে পরিচয় আবার নিশ্চিত করবেন — এতে অ্যাকাউন্ট সুরক্ষিত থাকে।", voice: "tour.reverify" },
  { selector: "[data-tour='profile']", title: "প্রোফাইল", text: "উপরের বাম কোণে আপনার প্রোফাইল ও সেটিংস।", voice: "tour.profile" },
  { title: "শেষ!", text: "ব্যস! এখন যেকোনো জায়গায় চাপ দিলেই বলে দিব পরে কী করতে হবে।", voice: "tour.finish" },
];

const STORAGE_KEY = "good-app-tour-v2";
const FORCE_STORAGE_KEY = "good-app-tour-force";

export function GuidedTour({ steps, autoStart = true }: { steps?: TourStep[]; autoStart?: boolean }) {
  const steps_ = steps ?? (isLiteBuild() ? LITE_STEPS : DEFAULT_STEPS);
  return <GuidedTourInner steps={steps_} autoStart={autoStart} />;
}

function GuidedTourInner({ steps, autoStart }: { steps: TourStep[]; autoStart: boolean }) {

  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [muted, setMuted] = useState(false);
  const gestureStartedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!autoStart || startedRef.current) return;
    if (typeof window === "undefined") return;
    const forced = localStorage.getItem(FORCE_STORAGE_KEY) === "1";
    if (!forced && localStorage.getItem(STORAGE_KEY) === "done") return;
    if (forced) localStorage.removeItem(FORCE_STORAGE_KEY);
    startedRef.current = true;
    setMuted(isVoiceMuted());
    preloadVoices(steps.map((step) => step.voice));
    const t = setTimeout(() => setActive(true), 700);
    return () => clearTimeout(t);
  }, [autoStart, steps]);

  useEffect(() => {
    if (!active) return;
    const step = steps[idx]; if (!step) return;
    if (step.selector) {
      const el = document.querySelector(step.selector) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => setRect(el.getBoundingClientRect()), 350);
      } else setRect(null);
    } else setRect(null);
    const onResize = () => {
      if (!step.selector) return;
      const e = document.querySelector(step.selector) as HTMLElement | null;
      if (e) setRect(e.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, idx, steps, muted]);

  const finish = () => {
    setActive(false);
    stopVoice();
    try { localStorage.setItem(STORAGE_KEY, "done"); } catch {}
  };
  const startCurrent = () => {
    gestureStartedRef.current = true;
    playVoiceFromGesture(steps[idx].voice);
  };
  const next = () => {
    if (!gestureStartedRef.current) { startCurrent(); return; }
    if (idx >= steps.length - 1) { playVoiceFromGesture(steps[idx].voice); setTimeout(finish, 200); return; }
    setIdx(idx + 1);
    // Play next step's audio inside this same gesture.
    const nextStep = steps[idx + 1];
    if (nextStep) playVoiceFromGesture(nextStep.voice);
  };

  useEffect(() => {
    (window as any).__startGoodAppTour = () => { setIdx(0); gestureStartedRef.current = false; setActive(true); };
  }, []);

  if (!active) return null;
  const step = steps[idx];
  const pad = 8;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tooltipBelow = !spot || spot.top + spot.height + 200 < vh;
  const tooltipStyle: React.CSSProperties = spot
    ? tooltipBelow
      ? { top: spot.top + spot.height + 12, left: 12, right: 12 }
      : { top: Math.max(12, spot.top - 200), left: 12, right: 12 }
    : { top: "35%", left: 16, right: 16 };

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" onClick={() => { if (!gestureStartedRef.current) startCurrent(); }}>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            {spot && <rect x={spot.left} y={spot.top} width={spot.width} height={spot.height} rx="16" ry="16" fill="black" />}
          </mask>
          <linearGradient id="tour-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#ef476f" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="rgba(9,12,28,0.72)" mask="url(#tour-mask)" />
        {spot && (
          <rect x={spot.left} y={spot.top} width={spot.width} height={spot.height} rx="16" ry="16"
            fill="none" stroke="url(#tour-stroke)" strokeWidth="3" className="tour-pulse" />
        )}
      </svg>

      <div className="absolute pointer-events-auto rounded-2xl p-4 shadow-2xl border-2 border-white/40 backdrop-blur-xl"
        style={{ ...tooltipStyle, background: "linear-gradient(135deg, rgba(255,255,255,0.98), rgba(250,245,255,0.95))" }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.15em] font-black text-violet-500">ধাপ {idx + 1} / {steps.length}</p>
            <h3 className="text-base font-black text-navy mt-0.5 leading-tight flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-amber-500" />{step.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={(e) => {
              e.stopPropagation();
              const m = !muted; setMuted(m);
              setVoiceMuted(m);
              if (m) stopVoice();
              else { gestureStartedRef.current = true; playVoiceFromGesture(step.voice); }
            }} className="p-2 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-600" title={muted ? "ভয়েস চালু" : "ভয়েস বন্ধ"}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); finish(); }} className="p-2 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-600" title="বন্ধ করুন">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-[13px] text-navy leading-relaxed font-medium">{step.text}</p>

        <div className="flex items-center justify-between gap-2 mt-3">
          <button onClick={(e) => { e.stopPropagation(); finish(); }} className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 hover:text-rose">
            <SkipForward className="w-3.5 h-3.5" /> স্কিপ
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }}
            className="gradient-cta rounded-xl px-5 py-2.5 text-xs font-black flex items-center gap-1.5 active:scale-95 transition shadow-lg">
            {!gestureStartedRef.current ? "🔊 শুরু করুন" : idx >= steps.length - 1 ? "শেষ" : "পরবর্তী"} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-3 h-1 rounded-full bg-violet-100 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 transition-all"
            style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

export function TourReplayButton() {
  return (
    <button onClick={() => {
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      (window as any).__startGoodAppTour?.();
    }} data-voice="tour.replay"
      className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-3.5 text-sm font-black text-white shadow-2xl btn-press shine"
      style={{
        background: "linear-gradient(120deg, #8b5cf6 0%, #ef476f 48%, #ffd166 100%)",
        boxShadow: "0 18px 40px -14px rgba(239,71,111,0.8)",
      }}>
      <Sparkles className="w-5 h-5 animate-pulse" />
      কিভাবে কাজ করতে হয় জানতে ক্লিক করুন
    </button>
  );
}
