import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Phone, PhoneOff, Mic, MicOff, Headset } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { agentAcceptSupportCall, agentEndSupportCall, amICallAgent } from "@/lib/support-call.functions";
import { SUPPORT_ICE, SUPPORT_LOBBY, supportChannel, type RingPayload } from "@/lib/support-rtc";

/** অ্যাপে লগইন থাকা কল এজেন্টদের কাছে কাস্টমার কেয়ারের কল আসে — যেকোনো একজন ধরলেই বাকিদের থেকে কেটে যায়। */
export function AgentIncomingCall() {
  const { data } = useQuery({ queryKey: ["am-call-agent"], queryFn: () => amICallAgent(), staleTime: 5 * 60_000 });
  if (!data?.agent) return null;
  return <AgentCallInner />;
}

function AgentCallInner() {
  const [ringing, setRinging] = useState<Record<string, RingPayload>>({});
  const [active, setActive] = useState<RingPayload | null>(null);
  const [talking, setTalking] = useState(false);
  const [sec, setSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const remote = useRef<HTMLAudioElement | null>(null);
  const taken = useRef<Set<string>>(new Set());
  const lobbyRef = useRef<any>(null);
  const rtc = useRef<{ pc?: RTCPeerConnection; stream?: MediaStream; ch?: any }>({});

  useEffect(() => {
    const lobby = supabase.channel(SUPPORT_LOBBY, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "ring" }, ({ payload }: any) => {
        if (taken.current.has(payload.id)) return;
        setRinging((m) => ({ ...m, [payload.id]: { ...payload, at: Date.now() } }));
      })
      .on("broadcast", { event: "taken" }, ({ payload }: any) => {
        taken.current.add(payload.id);
        setRinging((m) => { const n = { ...m }; delete n[payload.id]; return n; });
      })
      .subscribe();
    lobbyRef.current = lobby;
    const sweep = window.setInterval(() => setRinging((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => Date.now() - v.at < 8000))), 2000);
    // প্রথম চাপেই রিং সাউন্ড আনলক
    const unlock = () => { try { const C = window.AudioContext || (window as any).webkitAudioContext; ctx.current = ctx.current ?? new C(); void ctx.current.resume(); } catch { /* ignore */ } };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => { supabase.removeChannel(lobby); clearInterval(sweep); window.removeEventListener("pointerdown", unlock); };
  }, []);

  const list = active ? [] : Object.values(ringing);
  const first = list[0];

  useEffect(() => {
    if (!first) return;
    const beep = () => {
      navigator.vibrate?.([300, 200, 300]);
      const c = ctx.current; if (!c) return;
      [0, 0.4].forEach((t) => {
        const o = c.createOscillator(); const g = c.createGain();
        o.frequency.value = 880; g.gain.value = 0.2;
        o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.25);
      });
    };
    beep();
    const t = window.setInterval(beep, 2000);
    return () => clearInterval(t);
  }, [first?.id]);

  useEffect(() => {
    if (!talking) return;
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [talking]);

  const teardown = (notify: boolean) => {
    const c = rtc.current;
    if (c.ch) { if (notify) void c.ch.send({ type: "broadcast", event: "hangup", payload: {} }); supabase.removeChannel(c.ch); }
    c.pc?.close(); c.stream?.getTracks().forEach((t) => t.stop());
    rtc.current = {};
    setActive(null); setTalking(false); setSec(0); setMuted(false);
  };

  const drop = (id: string) => setRinging((m) => { const n = { ...m }; delete n[id]; return n; });

  const accept = async (r: RingPayload) => {
    if (active) return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { alert("কথা বলতে মাইক্রোফোনের অনুমতি দিন"); return; }
    const ok = await agentAcceptSupportCall({ data: { id: r.id } }).catch(() => ({ ok: false }));
    if (!ok.ok) { stream.getTracks().forEach((t) => t.stop()); drop(r.id); return; }
    void lobbyRef.current?.send({ type: "broadcast", event: "taken", payload: { id: r.id } });
    setActive(r);
    const pc = new RTCPeerConnection(SUPPORT_ICE);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => { if (remote.current) { remote.current.srcObject = e.streams[0]; void remote.current.play().catch(() => {}); } };
    const ch = supabase.channel(supportChannel(r.id), { config: { broadcast: { self: false } } });
    rtc.current = { pc, stream, ch };
    pc.onicecandidate = (e) => { if (e.candidate) void ch.send({ type: "broadcast", event: "ice", payload: { from: "admin", c: e.candidate.toJSON() } }); };
    ch.on("broadcast", { event: "offer" }, async ({ payload }: any) => {
      await pc.setRemoteDescription(payload.sdp);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      void ch.send({ type: "broadcast", event: "answer", payload: { sdp: ans } });
      setTalking(true);
    })
      .on("broadcast", { event: "ice" }, async ({ payload }: any) => {
        if (payload.from === "caller") { try { await pc.addIceCandidate(payload.c); } catch { /* ignore */ } }
      })
      .on("broadcast", { event: "hangup" }, () => teardown(false))
      .subscribe((st) => { if (st === "SUBSCRIBED") void ch.send({ type: "broadcast", event: "accept", payload: {} }); });
  };

  const decline = (r: RingPayload) => { taken.current.add(r.id); drop(r.id); };
  const hang = async () => { const id = active?.id; teardown(true); if (id) await agentEndSupportCall({ data: { id } }).catch(() => {}); };
  const who = (r: RingPayload) => `${r.name ?? "অতিথি"}${r.uid ? ` · UID ${r.uid}` : " · লগইন নেই"}`;

  if (!active && !first) return <audio ref={remote} autoPlay playsInline className="hidden" />;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-between bg-gradient-to-b from-primary/90 via-background to-background px-6 py-14 text-foreground">
      <audio ref={remote} autoPlay playsInline className="hidden" />
      <div className="flex flex-col items-center">
        <div className="relative">
          <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-card shadow-2xl"><Headset className="h-14 w-14 text-primary" /></div>
        </div>
        <p className="mt-5 text-sm font-bold opacity-80">কাস্টমার কেয়ার কল</p>
        <p className="mt-1 text-2xl font-black text-center">{who((active ?? first)!)}</p>
        <p className="mt-2 text-sm font-semibold opacity-80">
          {active ? (talking ? `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}` : "সংযোগ হচ্ছে…") : "কল আসছে…"}
        </p>
      </div>
      {active ? (
        <div className="flex items-center gap-8">
          <button aria-label="মাইক" onClick={() => { const m = !muted; setMuted(m); rtc.current.stream?.getAudioTracks().forEach((t) => (t.enabled = !m)); }}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card shadow">{muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}</button>
          <button aria-label="কল কাটুন" onClick={hang} className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl"><PhoneOff className="h-9 w-9" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-16">
          <button aria-label="কেটে দিন" onClick={() => decline(first!)} className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-2xl"><PhoneOff className="h-9 w-9" /></button>
          <button aria-label="ধরুন" onClick={() => accept(first!)} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl animate-pulse"><Phone className="h-9 w-9" /></button>
        </div>
      )}
    </div>
  );
}
