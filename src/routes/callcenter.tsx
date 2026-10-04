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
import aiA from "@/assets/callcenter/ai.mp3.asset.json";
import nopressA from "@/assets/callcenter/nopress.mp3.asset.json";
import byeA from "@/assets/callcenter/bye.mp3.asset.json";
import invalidA from "@/assets/callcenter/invalid.mp3.asset.json";
import { SupportLiveCall } from "@/components/SupportLiveCall";
import { CallCenterAi } from "@/components/CallCenterAi";

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
  ai: aiA.url,
  nopress: nopressA.url,
  bye: byeA.url,
  invalid: invalidA.url,
};

const MENU: Record<string, { key: string; label: string }> = {
  "১": { key: "withdraw", label: "উইথড্র তথ্য" },
  "২": { key: "mining", label: "মাইনিং ও ক্লেইম" },
  "৩": { key: "reverify", label: "রি ভেরিফাই" },
  "৪": { key: "balance", label: "ব্যালেন্স" },
  "৫": { key: "refer", label: "রেফার বোনাস" },
  "৯": { key: "ai", label: "এ আই সহকারী" },
  "০": { key: "agent", label: "কাস্টমার কেয়ার" },
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

  const clearWait = () => { if (waitTimer.current) { window.clearTimeout(waitTimer.current); waitTimer.current = null; } };

  // একটি ভয়েস চালাও, শেষ হলে next() চলবে
  const say = useCallback((key: string, title: string, next?: () => void) => {
    const a = audioRef.current;
    if (!a) return;
    clearWait();
    a.pause();
    a.src = AUDIO[key];
    a.currentTime = 0;
    a.onended = () => next?.();
    setLabel(title);
    void a.play().catch(() => setLabel("ভয়েস চালু করতে স্ক্রিনে একবার চাপ দিন"));
  }, []);

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
    silence.current = 0;
    setShowAi(false);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    audioRef.current?.pause();
    setState("idle");
    setLabel("");
    setSeconds(0);
    setShowAgent(false);
  }, []);

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
    const m = MENU[d];
    setShowAgent(false); setShowAi(false);
    if (!m) { say("invalid", "ভুল বোতাম", () => menu("menu")); return; }
    if (m.key === "agent") { setShowAgent(true); say("agent", m.label); return; }
    if (m.key === "ai") { setShowAi(true); say("ai", m.label); return; }
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
          ১ উইথড্র · ২ মাইনিং · ৩ রি-ভেরিফাই · ৪ ব্যালেন্স · ৫ রেফার · ৯ এ আই সহকারী · ০ প্রতিনিধি
        </div>
      )}

      {showAi && (
        <div className="mx-auto mt-4 w-full max-w-xs px-4 animate-fade-in">
          <CallCenterAi onSpeak={() => { clearWait(); audioRef.current?.pause(); }} />
        </div>
      )}

      {showAgent && (
        <div className="mx-auto mt-4 flex w-full max-w-xs flex-col gap-2.5 px-4 animate-fade-in">
          <SupportLiveCall autoStart onActive={(on) => { if (on) clearWait(); }} />
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
