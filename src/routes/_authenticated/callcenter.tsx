import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  Wallet,
  Pickaxe,
  ShieldCheck,
  Coins,
  Gift,
  Headset,
  Volume2,
  Delete,
} from "lucide-react";
import { CALL_CENTER_SCRIPTS } from "@/routes/api/public/callcenter-tts";
import { PageBackHeader } from "@/components/PageBackHeader";

export const Route = createFileRoute("/_authenticated/callcenter")({
  head: () => ({
    meta: [
      { title: "কল সেন্টার — Good-App" },
      {
        name: "description",
        content:
          "গুড অ্যাপ কল সেন্টার — উইথড্র, মাইনিং, রি ভেরিফাই ও ব্যালেন্স সংক্রান্ত তথ্য ভয়েসে শুনুন, অথবা কাস্টমার কেয়ারের সাথে কথা বলুন।",
      },
      { property: "og:title", content: "কল সেন্টার — Good-App" },
      {
        property: "og:description",
        content: "ভয়েস মেনু দিয়ে উইথড্র, মাইনিং ও ব্যালেন্সের তথ্য শুনুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CallCenterPage,
});

const TELEGRAM_SUPPORT_URL = "https://t.me/GoodAppOwner";

const MENU = [
  { digit: "১", key: "withdraw", label: "উইথড্র", icon: Wallet },
  { digit: "২", key: "mining", label: "মাইনিং ও ক্লেইম", icon: Pickaxe },
  { digit: "৩", key: "reverify", label: "রি ভেরিফাই", icon: ShieldCheck },
  { digit: "৪", key: "balance", label: "ব্যালেন্স", icon: Coins },
  { digit: "৫", key: "refer", label: "রেফার বোনাস", icon: Gift },
  { digit: "০", key: "agent", label: "কাস্টমার কেয়ার", icon: Headset },
] as const;

const DIAL_PAD = ["১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯", "*", "০", "#"];

type CallState = "idle" | "ringing" | "playing" | "ended";

function CallCenterPage() {
  const [state, setState] = useState<CallState>("idle");
  const [dialed, setDialed] = useState("");
  const [nowPlaying, setNowPlaying] = useState<string>("");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
  }, []);

  const hangUp = useCallback(() => {
    clearTimers();
    stopAudio();
    setState("idle");
    setDialed("");
    setNowPlaying("");
  }, [stopAudio]);

  useEffect(() => () => hangUp(), [hangUp]);

  const playScript = useCallback(
    (key: string, title: string) => {
      stopAudio();
      setNowPlaying(title);
      setState("playing");
      const audio = new Audio(`/api/public/callcenter-tts?key=${key}`);
      audioRef.current = audio;
      audio.onended = () => {
        setState("idle");
        setNowPlaying("");
        setDialed("");
      };
      audio.onerror = () => {
        setError("ভয়েস লোড হয়নি, আবার চেষ্টা করুন");
        setState("idle");
        setNowPlaying("");
      };
      void audio.play().catch(() => {
        setError("ভয়েস চালু হয়নি, আবার চাপ দিন");
        setState("idle");
        setNowPlaying("");
      });
    },
    [stopAudio]
  );

  const startCall = useCallback(() => {
    setError("");
    setDialed("");
    setState("ringing");
    // ছোট রিং পজ — আসল কল সেন্টারের মতো লাগে
    timersRef.current.push(
      window.setTimeout(() => playScript("greeting", "স্বাগতম"), 1600)
    );
  }, [playScript]);

  const pressDigit = useCallback(
    (digit: string) => {
      if (state !== "idle" && state !== "ended") return;
      setError("");
      const item = MENU.find((m) => m.digit === digit);
      if (item) {
        setDialed(digit);
        playScript(item.key, item.label);
      } else if (digit === "*" || digit === "#" || "৬৭৮৯".includes(digit)) {
        setDialed(digit);
        playScript("invalid", "ভুল বোতাম");
      }
    },
    [state, playScript]
  );

  const greeting = CALL_CENTER_SCRIPTS.find((s) => s.key === "greeting");

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageBackHeader title="কল সেন্টার" />

      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* ফোন স্টাইল কার্ড */}
        <div className="rounded-3xl border border-border bg-card p-5 shadow-lg">
          <div className="flex flex-col items-center gap-3 py-2">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full ${
                state === "playing" || state === "ringing"
                  ? "bg-primary/15 animate-pulse"
                  : "bg-muted"
              }`}
            >
              {state === "idle" ? (
                <Phone className="h-9 w-9 text-primary" />
              ) : state === "ringing" ? (
                <Volume2 className="h-9 w-9 text-primary animate-bounce" />
              ) : (
                <Headset className="h-9 w-9 text-primary" />
              )}
            </div>

            <div className="text-center">
              <p className="text-lg font-black text-foreground">
                Good-App কল সেন্টার
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {state === "idle" && "কল করতে নিচের সবুজ বোতামে চাপ দিন"}
                {state === "ringing" && "কল কানেক্ট হচ্ছে…"}
                {state === "playing" && `শুনছেন: ${nowPlaying}`}
              </p>
            </div>

            <div className="flex gap-3 mt-1">
              {state === "idle" ? (
                <button
                  onClick={startCall}
                  className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition"
                >
                  <Phone className="h-4 w-4" /> কল করুন
                </button>
              ) : (
                <button
                  onClick={hangUp}
                  className="flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-md active:scale-95 transition"
                >
                  <PhoneOff className="h-4 w-4" /> কল কাটুন
                </button>
              )}
            </div>

            {error && (
              <p className="text-xs font-semibold text-destructive">{error}</p>
            )}
          </div>

          {/* ডায়াল প্যাড */}
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-center gap-2">
              <div className="h-8 min-w-[3rem] rounded-lg bg-muted px-3 flex items-center justify-center text-lg font-black tracking-widest text-foreground">
                {dialed || " "}
              </div>
              {dialed && (
                <button
                  onClick={() => setDialed("")}
                  className="text-muted-foreground"
                  aria-label="মুছুন"
                >
                  <Delete className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DIAL_PAD.map((d) => (
                <button
                  key={d}
                  onClick={() => pressDigit(d)}
                  disabled={state === "ringing" || state === "playing"}
                  className="h-12 rounded-2xl bg-muted text-xl font-black text-foreground active:bg-primary/20 disabled:opacity-40 transition"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* মেনু তালিকা */}
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="text-sm font-black text-foreground mb-3">
            মেনু — সরাসরি চাপ দিয়েও শুনতে পারবেন
          </p>
          <div className="space-y-2">
            {MENU.map((m) => (
              <button
                key={m.key}
                onClick={() => pressDigit(m.digit)}
                disabled={state === "ringing" || state === "playing"}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-left active:bg-muted disabled:opacity-40 transition"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
                  {m.digit}
                </span>
                <m.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* সরাসরি কথা */}
        <a
          href={TELEGRAM_SUPPORT_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-md active:scale-95 transition"
        >
          <Headset className="h-4 w-4" />
          কাস্টমার কেয়ারের সাথে কথা বলুন (সকাল ১০টা – রাত ১০টা)
        </a>

        {greeting && (
          <p className="text-center text-[11px] text-muted-foreground">
            সব তথ্য বাংলা ভয়েসে শুনতে কল করুন বাটনে চাপ দিন
          </p>
        )}

        <div className="text-center">
          <Link to="/menu" className="text-xs text-primary underline">
            মেনুতে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
}
