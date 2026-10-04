import { useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { askCallCenterAi } from "@/lib/callcenter-ai.functions";

type Msg = { role: "user" | "assistant"; content: string };

/** কল সেন্টারের এ আই সহকারী — মুখে প্রশ্ন বলুন, ভয়েসে উত্তর শুনুন। */
export function CallCenterAi({ onSpeak }: { onSpeak?: () => void }) {
  const [state, setState] = useState<"idle" | "listening" | "thinking">("idle");
  const [hist, setHist] = useState<Msg[]>([]);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setState("thinking"); setErr("");
    try {
      const r = await askCallCenterAi({ data: { question: q, history: hist.slice(-6) } });
      setHist((h) => [...h, { role: "user", content: q }, { role: "assistant", content: r.text }]);
      if (r.audio) {
        const a = player.current ?? new Audio();
        player.current = a;
        a.src = `data:audio/mpeg;base64,${r.audio}`;
        void a.play().catch(() => {});
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "দুঃখিত, আবার চেষ্টা করুন");
    }
    setState("idle");
  };

  const listen = () => {
    onSpeak?.();
    player.current?.pause();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setErr("আপনার ফোনে কথা শোনার সুবিধা নেই — নিচে লিখে প্রশ্ন করুন।"); return; }
    const rec = new SR();
    rec.lang = "bn-BD";
    rec.interimResults = false;
    rec.onresult = (e: any) => void ask(e.results[0][0].transcript);
    rec.onerror = () => { setState("idle"); setErr("শুনতে পাইনি, আবার মাইক চাপুন।"); };
    rec.onend = () => setState((s) => (s === "listening" ? "idle" : s));
    setState("listening");
    rec.start();
  };

  const last = hist.slice(-2);
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card/90 p-4 shadow-lg">
      {last.map((m, i) => (
        <p key={i} className={`w-full text-xs leading-5 ${m.role === "user" ? "text-right opacity-70" : "font-semibold"}`}>
          {m.content}
        </p>
      ))}
      {err && <p className="text-center text-xs font-bold text-destructive">{err}</p>}
      <button onClick={listen} disabled={state !== "idle"} aria-label="প্রশ্ন বলুন"
        className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-90 transition ${state === "listening" ? "animate-pulse" : ""}`}>
        {state === "thinking" ? <Loader2 className="h-7 w-7 animate-spin" /> : <Mic className="h-7 w-7" />}
      </button>
      <p className="text-[11px] opacity-70">
        {state === "listening" ? "বলুন, শুনছি…" : state === "thinking" ? "উত্তর তৈরি হচ্ছে…" : "মাইকে চাপ দিয়ে প্রশ্ন বলুন"}
      </p>
      <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); const q = typed; setTyped(""); void ask(q); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="অথবা লিখে প্রশ্ন করুন"
          className="min-w-0 flex-1 rounded-full bg-muted px-3 py-2 text-xs outline-none" />
        <button className="rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">পাঠান</button>
      </form>
    </div>
  );
}
