import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Volume2 } from "lucide-react";
import { askCallCenterAi, greetCallCenterAi } from "@/lib/callcenter-ai.functions";

type Msg = { role: "user" | "assistant"; content: string };
type State = "greeting" | "speaking" | "listening" | "thinking" | "idle";

/**
 * কল সেন্টারের এ আই সহকারী — মানুষের মতো কথোপকথন।
 * সালাম দিয়ে শুরু করে, তারপর নিজে থেকেই শোনে; মাইক চাপতে হয় না।
 */
export function CallCenterAi({ onSpeak }: { onSpeak?: () => void }) {
  const [state, setState] = useState<State>("greeting");
  const [hist, setHist] = useState<Msg[]>([]);
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const player = useRef<HTMLAudioElement | null>(null);
  const recRef = useRef<any>(null);
  const alive = useRef(true);
  const histRef = useRef<Msg[]>([]);
  const silentRounds = useRef(0);

  const play = (audio: string | null, mime: string, after: () => void) => {
    if (!audio) { after(); return; }
    const a = player.current ?? new Audio();
    player.current = a;
    a.src = `data:${mime};base64,${audio}`;
    a.onended = () => after();
    a.onerror = () => after();
    setState("speaking");
    void a.play().catch(() => after());
  };

  const listen = () => {
    if (!alive.current) return;
    onSpeak?.();
    player.current?.pause();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setState("idle"); setErr("আপনার ফোনে কথা শোনার সুবিধা নেই — নিচে লিখে প্রশ্ন করুন।"); return; }
    try { recRef.current?.abort(); } catch { /* noop */ }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = "bn-BD";
    rec.interimResults = false;
    let got = false;
    rec.onresult = (e: any) => { got = true; silentRounds.current = 0; void ask(e.results[0][0].transcript); };
    rec.onerror = () => { /* onend handles */ };
    rec.onend = () => {
      if (got || !alive.current) return;
      // চুপ থাকলে আবার শুনবে; কয়েকবার চুপ থাকলে থামবে
      silentRounds.current += 1;
      if (silentRounds.current < 3) setTimeout(listen, 300);
      else setState("idle");
    };
    setState("listening");
    try { rec.start(); } catch { setState("idle"); }
  };

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setState("thinking"); setErr("");
    try {
      const r = await askCallCenterAi({ data: { question: q, history: histRef.current.slice(-6) } });
      histRef.current = [...histRef.current, { role: "user", content: q }, { role: "assistant", content: r.text }];
      setHist(histRef.current);
      play(r.audio, r.mime, listen);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "দুঃখিত, আবার চেষ্টা করুন");
      setState("idle");
    }
  };

  useEffect(() => {
    alive.current = true;
    void greetCallCenterAi().then((g) => {
      if (!alive.current) return;
      histRef.current = [{ role: "assistant", content: g.text }];
      setHist(histRef.current);
      play(g.audio, g.mime, listen);
    }).catch(() => listen());
    return () => {
      alive.current = false;
      try { recRef.current?.abort(); } catch { /* noop */ }
      player.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = hist.slice(-2);
  const label =
    state === "greeting" ? "সংযোগ হচ্ছে…" :
    state === "speaking" ? "সহকারী কথা বলছেন…" :
    state === "listening" ? "বলুন, শুনছি…" :
    state === "thinking" ? "একটু অপেক্ষা করুন…" : "আবার কথা বলতে মাইকে চাপুন";

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-card/90 p-4 shadow-lg">
      {last.map((m, i) => (
        <p key={i} className={`w-full text-xs leading-5 ${m.role === "user" ? "text-right opacity-70" : "font-semibold"}`}>
          {m.content}
        </p>
      ))}
      {err && <p className="text-center text-xs font-bold text-destructive">{err}</p>}
      <button onClick={listen} disabled={state !== "idle"} aria-label="কথা বলুন"
        className={`flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-90 transition ${state === "listening" ? "animate-pulse" : ""}`}>
        {state === "thinking" || state === "greeting" ? <Loader2 className="h-7 w-7 animate-spin" /> :
          state === "speaking" ? <Volume2 className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
      </button>
      <p className="text-[11px] opacity-70">{label}</p>
      <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); const q = typed; setTyped(""); void ask(q); }}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="অথবা লিখে প্রশ্ন করুন"
          className="min-w-0 flex-1 rounded-full bg-muted px-3 py-2 text-xs outline-none" />
        <button className="rounded-full bg-primary px-3 text-xs font-bold text-primary-foreground">পাঠান</button>
      </form>
    </div>
  );
}
