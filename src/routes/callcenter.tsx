import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Headset, Volume2, VolumeX, Grid3x3, ArrowLeft } from "lucide-react";
import greetingA from "@/assets/callcenter/greeting.mp3.asset.json";
import menuA from "@/assets/callcenter/menu.mp3.asset.json";
import withdrawA from "@/assets/callcenter/withdraw.mp3.asset.json";
import miningA from "@/assets/callcenter/mining.mp3.asset.json";
import reverifyA from "@/assets/callcenter/reverify.mp3.asset.json";
import balanceA from "@/assets/callcenter/balance.mp3.asset.json";
import referA from "@/assets/callcenter/refer.mp3.asset.json";
import moreA from "@/assets/callcenter/more.mp3.asset.json";
import agentA from "@/assets/callcenter/agent.mp3.asset.json";
import nopressA from "@/assets/callcenter/nopress.mp3.asset.json";
import byeA from "@/assets/callcenter/bye.mp3.asset.json";
import invalidA from "@/assets/callcenter/invalid.mp3.asset.json";
import agentchargeA from "@/assets/callcenter/agentcharge.mp3.asset.json";
import { SupportLiveCall, type SupportPhase } from "@/components/SupportLiveCall";
import { checkSupportCallBalance } from "@/lib/support-call.functions";

export const Route = createFileRoute("/callcenter")({
  head: () => ({
    meta: [
      { title: "কল সেন্টার — Good-App" },
      { name: "description", content: "গুড অ্যাপ কল সেন্টার — উইথড্র, মাইনিং, রি ভেরিফাই ও ব্যালেন্সের তথ্য ভয়েসে শুনুন।" },
      { property: "og:title", content: "কল সেন্টার — Good-App" },
      { property: "og:description", content: "ভয়েস মেনু দিয়ে উইথড্র, মাইনিং ও ব্যালেন্সের তথ্য শুনুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallCenterPage,
});

const TELEGRAM_SUPPORT_URL = "https://t.me/GoodAppOwner";

const AUDIO: Record<string, string> = {
  greeting: greetingA.url,
  menu: menuA.url,
  withdraw: withdrawA.url,
  mining: miningA.url,
  reverify: reverifyA.url,
  balance: balanceA.url,
  refer: referA.url,
  more: moreA.url,
  agent: agentA.url,
  nopress: nopressA.url,
  bye: byeA.url,
  invalid: invalidA.url,
  agentcharge: agentchargeA.url,
  // নিচেরগুলো সার্ভার থেকে একই কণ্ঠে তৈরি হয়ে আসে
  transfer: "/api/public/callcenter-tts?key=transfer",
  longwait: "/api/public/callcenter-tts?key=longwait",
  nobalance: "/api/public/callcenter-tts?key=nobalance",
  hold: "/api/public/callcenter-tts?key=hold",
  channels: "/api/public/callcenter-tts?key=channels",
};
const SPOKEN_FALLBACK: Record<string, string> = {
  transfer: "আপনার কলটি একজন কাস্টমার কেয়ার প্রতিনিধির কাছে ট্রান্সফার করা হচ্ছে। দয়া করে অপেক্ষা করুন।",
  longwait: "স্যার, আপনার কলটি আমাদের কাছে খুবই গুরুত্বপূর্ণ! আমাদের সব কয়টি চ্যানেল এই মুহূর্তে ব্যস্ত আছে। লাইন ফ্রি হওয়ার সাথে সাথেই আমাদের একজন প্রতিনিধি আপনার কলটি রিসিভ করবেন। আর একটা দারুণ খুশির খবর! আমাদের ইউটিউব আর টেলিগ্রাম চ্যানেলে দুই হাজার সাবস্ক্রাইবার পূর্ণ হলেই আমরা চালু করব রেফার বোনাস আর রি-ভেরিফাই বোনাস! তাই এখনই সাবস্ক্রাইব আর জয়েন করে পাশে থাকুন। কল রিসিভ না হওয়া পর্যন্ত কোনো চার্জ কাটা হবে না।",
  nobalance: "দুঃখিত, আপনার অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স নেই। তাই প্রতিনিধির সাথে কথা বলা সম্ভব হচ্ছে না।",
  hold: "আপনার কলটি কিছুক্ষণের জন্য হোল্ডে রাখা হয়েছে। দয়া করে লাইনে থাকুন।",
  channels: "আমাদের ইউটিউব চ্যানেল সাবস্ক্রাইব করুন এবং টেলিগ্রাম চ্যানেলে জয়েন করুন। দুই হাজার সাবস্ক্রাইবার পূর্ণ হলেই রেফার বোনাস ও রি-ভেরিফাই বোনাস চালু হবে।",
};

const MENU: Record<string, { key: string; label: string }> = {
  "১": { key: "withdraw", label: "উইথড্র তথ্য" },
  "২": { key: "mining", label: "মাইনিং ও ক্লেইম" },
  "৩": { key: "reverify", label: "রি ভেরিফাই" },
  "৪": { key: "balance", label: "ব্যালেন্স" },
  "৫": { key: "refer", label: "রেফার বোনাস" },
  "৯": { key: "menu", label: "মূল মেনু" },
  "০": { key: "agentcharge", label: "কাস্টমার কেয়ার" },
};

const PAD = ["১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯", "*", "০", "#"];
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n: number) => String(n).padStart(2, "0").replace(/\d/g, (d) => BN[+d]);

type CallState = "idle" | "ringing" | "connected";

function CallCenterPage() {
  const router = useRouter();
  const [state, setState] = useState<CallState>("idle");
  const [label, setLabel] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [showPad, setShowPad] = useState(true);
  const [speaker, setSpeaker] = useState(true);
  const [showAgent, setShowAgent] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const silence = useRef(0);
  const waitTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const timers = useRef<number[]>([]);
  const holdingForAgent = useRef(false);
  const holdFeatureIndex = useRef(0);

  const HOLD_FEATURES = [
    { key: "mining", title: "দৈনিক মাইনিং ও ক্লেইম" },
    { key: "reverify", title: "স্লট রি-ভেরিফাই সুবিধা" },
    { key: "balance", title: "নিরাপদ ব্যালেন্স সুবিধা" },
    { key: "withdraw", title: "সহজ উইথড্র সুবিধা" },
    { key: "refer", title: "রেফার সুবিধা" },
    { key: "channels", title: "ইউটিউব ও টেলিগ্রাম চ্যানেল" },
  ] as const;
  const awaitingConfirm = useRef(false);

  const clearWait = () => { if (waitTimer.current) { window.clearTimeout(waitTimer.current); waitTimer.current = null; } };

  const stopVoice = useCallback(() => {
    clearWait();
    const m = music.current;
    if (m) { clearInterval(m.timer); try { m.gain.disconnect(); } catch { /* ignore */ } music.current = null; }
    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    audio.pause();
    audio.currentTime = 0;
  }, []);

  // একটি ভয়েস চালাও, শেষ হলে next() চলবে
  const say = useCallback((key: string, title: string, next?: () => void) => {
    const a = audioRef.current;
    if (!a) return;
    clearWait();
    a.pause();
    a.src = AUDIO[key];
    a.currentTime = 0;
    a.onended = () => next?.();
    a.onerror = () => {
      const t = SPOKEN_FALLBACK[key];
      if (!t || !("speechSynthesis" in window)) { next?.(); return; }
      const u = new SpeechSynthesisUtterance(t); u.lang = "bn-BD"; u.onend = () => next?.();
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    };
    setLabel(title);
    void a.play().catch(() => setLabel("ভয়েস চালু করতে স্ক্রিনে একবার চাপ দিন"));
  }, []);

  // অপেক্ষার সময় হালকা মিষ্টি ব্যাকগ্রাউন্ড মিউজিক (কথার নিচে নরম করে)
  const music = useRef<{ ctx: AudioContext; timer: number; gain: GainNode } | null>(null);
  const startMusic = useCallback(() => {
    if (music.current) return;
    try {
      // কল শুরুর সময় আনলক করা অডিও ব্যবহার — মোবাইলে নতুনটা চুপ থাকে
      const C = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = ctxRef.current ?? new C();
      ctxRef.current = ctx;
      void ctx.resume();
      const gain = ctx.createGain(); gain.gain.value = 0.09; gain.connect(ctx.destination);
      const chords = [[261.6, 329.6, 392], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
      let i = 0;
      const play = () => {
        const t = ctx.currentTime;
        chords[i++ % chords.length].forEach((f, k) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = k === 0 ? "triangle" : "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.8);
          g.gain.linearRampToValueAtTime(0, t + 3.9);
          o.connect(g); g.connect(gain); o.start(t); o.stop(t + 4);
        });
        // ছোট টুং-টাং মেলোডি
        [0, 1, 2].forEach((n) => {
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = "sine"; o.frequency.value = chords[(i - 1) % chords.length][n] * 2;
          const s = t + 0.5 + n * 0.9;
          g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.5, s + 0.05); g.gain.exponentialRampToValueAtTime(0.001, s + 0.8);
          o.connect(g); g.connect(gain); o.start(s); o.stop(s + 0.85);
        });
      };
      play();
      const timer = window.setInterval(play, 4000);
      music.current = { ctx, timer, gain };
    } catch { /* ignore */ }
  }, []);
  const stopMusic = useCallback(() => {
    const m = music.current; if (!m) return;
    clearInterval(m.timer); try { m.gain.disconnect(); } catch { /* ignore */ } music.current = null;
  }, []);
  useEffect(() => () => stopMusic(), [stopMusic]);

  // সুবিধা → "আপনার কলটি গুরুত্বপূর্ণ…" → পরের সুবিধা — প্রতিনিধি না ধরা পর্যন্ত চলতেই থাকবে
  const playNextHoldFeature = useCallback(function playNextHoldFeature() {
    if (!holdingForAgent.current) return;
    startMusic();
    const step = holdFeatureIndex.current;
    holdFeatureIndex.current += 1;
    const isNotice = step % 2 === 1;
    const feature = HOLD_FEATURES[Math.floor(step / 2) % HOLD_FEATURES.length];
    say(isNotice ? "longwait" : feature.key, isNotice ? "আপনার কলটি আমাদের কাছে গুরুত্বপূর্ণ" : feature.title, () => {
      if (!holdingForAgent.current) return;
      waitTimer.current = window.setTimeout(playNextHoldFeature, 700);
    });
  }, [say, startMusic]);

  const handleAgentPhase = useCallback((phase: SupportPhase) => {
    if (phase === "hold") {
      holdingForAgent.current = true;
      say("hold", "কল হোল্ডে আছে", playNextHoldFeature);
      return;
    }
    if (phase === "unhold") {
      holdingForAgent.current = false;
      stopVoice();
      setLabel("প্রতিনিধির সাথে কথা হচ্ছে");
      return;
    }
    if (phase === "longwait") {
      if (!holdingForAgent.current) return;
      say("longwait", "সব প্রতিনিধি ব্যস্ত", playNextHoldFeature);
      return;
    }
    if (phase === "nobalance") {
      holdingForAgent.current = false;
      say("nobalance", "পর্যাপ্ত ব্যালেন্স নেই");
      return;
    }
    if (phase === "talking") {
      holdingForAgent.current = false;
      stopVoice();
      setLabel("প্রতিনিধির সাথে কথা হচ্ছে");
      return;
    }
    if (phase === "busy" || phase === "ended" || phase === "nomic") {
      holdingForAgent.current = false;
      stopVoice();
    }
  }, [stopVoice, say, playNextHoldFeature]);

  // মেনু বলা শেষে ৮ সেকেন্ড অপেক্ষা; কিছু না চাপলে প্রথমবার মেনুতে ফেরে, দ্বিতীয়বার কল কাটে
  const menu = useCallback((key: "greeting" | "menu" = "menu") => {
    say(key, key === "greeting" ? "স্বাগতম" : "মূল মেনু", () => {
      setLabel("অনুগ্রহ করে একটি নম্বর চাপুন");
      waitTimer.current = window.setTimeout(() => {
        silence.current += 1;
        if (silence.current >= 2) say("bye", "কল শেষ", () => hangUpRef.current());
        else say("nopress", "কোনো বোতাম চাপা হয়নি", () => menu("menu"));
      }, 8000);
    });
  }, [say]);
  const hangUpRef = useRef<() => void>(() => {});

  // আসল ফোনের মতো "টুট… টুট…" রিং টোন
  const ring = (ctx: AudioContext) => {
    [0, 1.2].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 425;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.05);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t + 0.8);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 1);
    });
  };

  const hangUp = useCallback(() => {
    clearWait();
    holdingForAgent.current = false;
    awaitingConfirm.current = false;
    silence.current = 0;
    setShowAi(false);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    stopVoice();
    setState("idle");
    setLabel("");
    setSeconds(0);
    setShowAgent(false);
  }, [stopVoice]);

  hangUpRef.current = hangUp;
  useEffect(() => () => hangUp(), [hangUp]);

  useEffect(() => {
    if (state !== "connected") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = speaker ? 1 : 0.35;
  }, [speaker]);

  const startCall = () => {
    // বোতাম চাপার মুহূর্তেই অডিও আনলক করি — মোবাইলে যাতে সাউন্ড আটকে না যায়
    const a = audioRef.current ?? new Audio();
    audioRef.current = a;
    a.preload = "auto";
    a.src = AUDIO.greeting;
    a.muted = true;
    void a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = ctxRef.current ?? new Ctx();
      void ctxRef.current.resume();
      ring(ctxRef.current);
    } catch { /* রিং টোন না হলেও কল চলবে */ }
    setShowAgent(false);
    setSeconds(0);
    setState("ringing");
    timers.current.push(window.setTimeout(() => {
      setState("connected");
      menu("greeting");
    }, 2600));
  };

  const press = (d: string) => {
    if (state !== "connected") return;
    if (navigator.vibrate) navigator.vibrate(30);
    silence.current = 0;
    holdingForAgent.current = false;
    stopVoice();
    // চার্জ শোনার পর ১ চাপলে প্রতিনিধির কাছে ট্রান্সফার
    if (awaitingConfirm.current && d === "১") {
      awaitingConfirm.current = false;
      setLabel("ব্যালেন্স যাচাই হচ্ছে…");
      void checkSupportCallBalance().then((r) => r.ok).catch(() => false).then((ok) => {
        if (!ok) { say("nobalance", "পর্যাপ্ত ব্যালেন্স নেই (লগইন থাকতে হবে)", () => menu("menu")); return; }
        holdingForAgent.current = true;
        holdFeatureIndex.current = 0;
        setShowAgent(true);
        say("transfer", "প্রতিনিধির কাছে ট্রান্সফার হচ্ছে", playNextHoldFeature);
      });
      return;
    }
    awaitingConfirm.current = false;
    const m = MENU[d];
    setShowAgent(false); setShowAi(false);
    if (!m) { say("invalid", "ভুল বোতাম", () => menu("menu")); return; }
    if (m.key === "menu") { menu("menu"); return; }
    if (m.key === "agentcharge") {
      awaitingConfirm.current = true;
      say("agentcharge", "প্রতি মিনিট ০.৪৳ — নিশ্চিত করতে ১ চাপুন", () => setLabel("নিশ্চিত করতে ১ চাপুন, মেনুতে ফিরতে ৯"));
      return;
    }
    // তথ্য বলা শেষে: "স্যার, আপনাকে আর কীভাবে সাহায্য করতে পারি?" → মেনু
    say(m.key, m.label, () => say("more", "আর কোনো সাহায্য", () => menu("menu")));
  };

  const close = () => { hangUp(); router.history.back(); };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-b from-primary/90 via-background to-background text-foreground overflow-y-auto">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
        <button onClick={close} aria-label="ফিরে যান" className="flex h-10 w-10 items-center justify-center rounded-full bg-background/30 backdrop-blur">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-xs font-bold opacity-80">Good-App কাস্টমার কেয়ার</span>
        <span className="w-10" />
      </div>

      <div className="flex flex-col items-center pt-8 pb-4">
        <div className="relative">
          {state !== "idle" && <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />}
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-card shadow-2xl ring-4 ring-background/40">
            <Headset className="h-14 w-14 text-primary" />
          </div>
        </div>
        <p className="mt-5 text-2xl font-black">কল সেন্টার</p>
        <p className="mt-1 text-sm font-semibold opacity-80">
          {state === "idle" && "কল করতে নিচের সবুজ বোতামে চাপ দিন"}
          {state === "ringing" && "রিং হচ্ছে…"}
          {state === "connected" && `${bn(Math.floor(seconds / 60))}:${bn(seconds % 60)}`}
        </p>
        {state === "connected" && label && (
          <p className="mt-3 rounded-full bg-card/80 px-4 py-1.5 text-xs font-bold shadow">🔊 {label}</p>
        )}
      </div>

      {state === "connected" && showPad && (
        <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3 px-4 animate-fade-in">
          {PAD.map((d) => (
            <button key={d} onClick={() => press(d)}
              className="h-16 rounded-full bg-card/90 text-2xl font-black shadow active:scale-90 active:bg-primary/30 transition">
              {d}
            </button>
          ))}
        </div>
      )}

      {state === "connected" && (
        <div className="mx-auto mt-3 w-full max-w-xs px-4 text-[11px] leading-5 text-muted-foreground text-center">
          ১ উইথড্র · ২ মাইনিং · ৩ রি-ভেরিফাই · ৪ ব্যালেন্স · ৫ রেফার · ৯ মূল মেনু · ০ প্রতিনিধি (প্রতি মিনিট ০.৪৳)
        </div>
      )}

      {showAi && (
        <div className="mx-auto mt-4 w-full max-w-xs px-4 animate-fade-in">
          {null}
        </div>
      )}

      {showAgent && (
        <div className="mx-auto mt-4 flex w-full max-w-xs flex-col gap-2.5 px-4 animate-fade-in">
          <SupportLiveCall autoStart onPhaseChange={handleAgentPhase} />
          <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-bold text-primary-foreground shadow-lg active:scale-95 transition">
            লিখে সমস্যা পাঠান (টেলিগ্রাম)
          </a>
        </div>
      )}

      <div className="mt-auto flex items-center justify-center gap-8 pb-[max(env(safe-area-inset-bottom),2rem)] pt-6">
        {state === "connected" && (
          <button onClick={() => setSpeaker((s) => !s)} aria-label="স্পিকার"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow">
            {speaker ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
          </button>
        )}
        {state === "idle" ? (
          <button onClick={startCall} aria-label="কল করুন"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600 text-white shadow-2xl animate-pulse active:scale-90 transition">
            <Phone className="h-9 w-9" />
          </button>
        ) : (
          <button onClick={hangUp} aria-label="কল কাটুন"
            className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl active:scale-90 transition">
            <PhoneOff className="h-9 w-9" />
          </button>
        )}
        {state === "connected" && (
          <button onClick={() => setShowPad((s) => !s)} aria-label="কীপ্যাড"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow">
            <Grid3x3 className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
