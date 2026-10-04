import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminAcceptSupportCall, adminEndSupportCall, adminListSupportCalls } from "@/lib/support-call.functions";
import { SUPPORT_ICE, SUPPORT_LOBBY, supportChannel, type RingPayload } from "@/lib/support-rtc";

export const Route = createFileRoute("/admin/calls")({
  head: () => ({ meta: [{ title: "ইনকামিং কল — Admin" }, { name: "description", content: "কাস্টমার কেয়ার লাইভ কল" }] }),
  component: AdminCalls,
});

const STATUS: Record<string, string> = { ringing: "🔔 রিং", accepted: "🟢 চলছে", ended: "✅ শেষ", missed: "❌ মিসড" };

function AdminCalls() {
  const qc = useQueryClient();
  const { data: log } = useQuery({ queryKey: ["support-calls"], queryFn: () => adminListSupportCalls(), refetchInterval: 15_000 });
  const [ringing, setRinging] = useState<Record<string, RingPayload>>({});
  const [active, setActive] = useState<RingPayload | null>(null);
  const [talking, setTalking] = useState(false);
  const [sec, setSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const remote = useRef<HTMLAudioElement | null>(null);
  const takenRef = useRef<Set<string>>(new Set());
  const lobbyRef = useRef<any>(null);
  const rtc = useRef<{ pc?: RTCPeerConnection; stream?: MediaStream; ch?: any }>({});

  // ইনকামিং রিং শুনি
  useEffect(() => {
    const lobby = supabase.channel(SUPPORT_LOBBY, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "ring" }, ({ payload }: any) => {
        if (takenRef.current.has(payload.id)) return;
        setRinging((m) => ({ ...m, [payload.id]: { ...payload, at: Date.now() } }));
      })
      // অন্য কোনো অ্যাডমিন ধরে ফেললে এখান থেকে রিং বন্ধ
      .on("broadcast", { event: "taken" }, ({ payload }: any) => {
        takenRef.current.add(payload.id);
        setRinging((m) => { const n = { ...m }; delete n[payload.id]; return n; });
      })
      .subscribe();
    const sweep = window.setInterval(() => {
      setRinging((m) => Object.fromEntries(Object.entries(m).filter(([, v]) => Date.now() - v.at < 8000)));
    }, 2000);
    lobbyRef.current = lobby;
    return () => { supabase.removeChannel(lobby); clearInterval(sweep); };
  }, []);

  const list = active ? [] : Object.values(ringing);

  // রিংটোন
  useEffect(() => {
    if (!soundOn || !list.length || active) return;
    const beep = () => {
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
  }, [soundOn, list.length, active]);

  useEffect(() => {
    if (!talking) return;
    const t = window.setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [talking]);

  const enableSound = () => {
    const C = window.AudioContext || (window as any).webkitAudioContext;
    ctx.current = ctx.current ?? new C(); void ctx.current.resume(); setSoundOn(true);
  };

  const teardown = (notify: boolean) => {
    const c = rtc.current;
    if (c.ch) { if (notify) void c.ch.send({ type: "broadcast", event: "hangup", payload: {} }); supabase.removeChannel(c.ch); }
    c.pc?.close(); c.stream?.getTracks().forEach((t) => t.stop());
    rtc.current = {};
    setActive(null); setTalking(false); setSec(0); setMuted(false);
    void qc.invalidateQueries({ queryKey: ["support-calls"] });
  };

  const accept = async (r: RingPayload) => {
    if (active) return;
    const ok = await adminAcceptSupportCall({ data: { id: r.id } });
    if (ok.ok) void lobbyRef.current?.send({ type: "broadcast", event: "taken", payload: { id: r.id } });
    if (!ok.ok) { setRinging((m) => { const n = { ...m }; delete n[r.id]; return n; }); return; }
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { alert("মাইক্রোফোনের অনুমতি দিন"); return; }
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

  const decline = async (r: RingPayload) => {
    const ch = supabase.channel(supportChannel(r.id));
    ch.subscribe((st) => {
      if (st === "SUBSCRIBED") { void ch.send({ type: "broadcast", event: "decline", payload: {} }); setTimeout(() => supabase.removeChannel(ch), 1500); }
    });
    setRinging((m) => { const n = { ...m }; delete n[r.id]; return n; });
  };

  const hang = async () => { const id = active?.id; teardown(true); if (id) await adminEndSupportCall({ data: { id } }).catch(() => {}); };

  const who = (r: { name: string | null; uid: number | null }) => `${r.name ?? "অতিথি"}${r.uid ? ` · UID ${r.uid}` : " · লগইন নেই"}`;

  return (
    <div className="space-y-4">
      <audio ref={remote} autoPlay playsInline />
      <div className="flex items-center gap-2">
        <PhoneIncoming className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-black">ইনকামিং কল</h1>
      </div>
      {!soundOn && (
        <button onClick={enableSound} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground">
          <Volume2 className="h-4 w-4" /> রিং সাউন্ড চালু করুন (একবার চাপুন)
        </button>
      )}
      <p className="text-xs text-muted-foreground">এই পেজ খোলা থাকলেই কল রিং হবে। বন্ধ থাকলে মিসড কলের খবর টেলিগ্রামে যাবে।</p>

      {active && (
        <div className="rounded-2xl border border-primary bg-card p-4 space-y-3">
          <p className="font-black">{talking ? "🟢 কথা চলছে" : "সংযোগ হচ্ছে…"} — {who(active)}</p>
          {talking && <p className="text-2xl font-black">{String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}</p>}
          <div className="flex gap-3">
            <button onClick={() => { const m = !muted; setMuted(m); rtc.current.stream?.getAudioTracks().forEach((t) => (t.enabled = !m)); }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">{muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}</button>
            <button onClick={hang} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-destructive font-black text-destructive-foreground">
              <PhoneOff className="h-5 w-5" /> কল কাটুন
            </button>
          </div>
        </div>
      )}

      {list.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4 animate-pulse">
          <Phone className="h-6 w-6 text-primary" />
          <div className="flex-1 font-bold">{who(r)}</div>
          <button onClick={() => decline(r)} className="rounded-full bg-destructive px-4 py-2 text-xs font-black text-destructive-foreground">কেটে দিন</button>
          <button onClick={() => accept(r)} disabled={!!active} className="rounded-full bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">ধরুন</button>
        </div>
      ))}
      {!list.length && !active && <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">এখন কোনো কল আসছে না</p>}

      <h2 className="pt-2 text-lg font-black">কল লগ</h2>
      <div className="space-y-1.5">
        {(log ?? []).map((c: any) => (
          <div key={c.id} className="flex justify-between rounded-lg border px-3 py-2 text-xs">
            <span>{who({ name: c.caller_name, uid: c.caller_uid })}</span>
            <span>{STATUS[c.status] ?? c.status} · {new Date(c.created_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
              {c.answered_at && c.ended_at ? ` · ${Math.round((+new Date(c.ended_at) - +new Date(c.answered_at)) / 1000)}s` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
