import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startSupportCall, endSupportCall } from "@/lib/support-call.functions";
import { SUPPORT_ICE, SUPPORT_LOBBY, supportChannel } from "@/lib/support-rtc";

type S = "idle" | "calling" | "talking" | "busy" | "ended" | "nomic";
const BN = "০১২৩৪৫৬৭৮৯";
const bn = (n: number) => String(n).padStart(2, "0").replace(/\d/g, (d) => BN[+d]);

/** কাস্টমার → অ্যাডমিন প্যানেলে সরাসরি অ্যাপের ভেতরের ভয়েস কল। */
export function SupportLiveCall({ onActive }: { onActive?: (active: boolean) => void }) {
  const [s, setS] = useState<S>("idle");
  const [sec, setSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const r = useRef<{ pc?: RTCPeerConnection; stream?: MediaStream; ch?: any; lobby?: any; id?: string; timers: number[] }>({ timers: [] });
  const remote = useRef<HTMLAudioElement | null>(null);

  const cleanup = (missed: boolean, notify = true) => {
    const c = r.current;
    c.timers.forEach((t) => clearInterval(t));
    c.timers = [];
    if (c.ch) { if (notify) void c.ch.send({ type: "broadcast", event: "hangup", payload: {} }); supabase.removeChannel(c.ch); }
    if (c.lobby) supabase.removeChannel(c.lobby);
    c.pc?.close();
    c.stream?.getTracks().forEach((t) => t.stop());
    if (c.id) void endSupportCall({ data: { id: c.id, missed } }).catch(() => {});
    r.current = { timers: [] };
    onActive?.(false);
  };

  useEffect(() => () => cleanup(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (s !== "talking") return;
    const t = window.setInterval(() => setSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [s]);

  const call = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch { setS("nomic"); return; }
    setS("calling"); setSec(0); onActive?.(true);
    const c = r.current;
    c.stream = stream;
    try {
      const { id, uid, name } = await startSupportCall({ data: {} });
      c.id = id;
      const pc = new RTCPeerConnection(SUPPORT_ICE);
      c.pc = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (e) => { if (remote.current) { remote.current.srcObject = e.streams[0]; void remote.current.play().catch(() => {}); } };
      const ch = supabase.channel(supportChannel(id), { config: { broadcast: { self: false } } });
      c.ch = ch;
      pc.onicecandidate = (e) => { if (e.candidate) void ch.send({ type: "broadcast", event: "ice", payload: { from: "caller", c: e.candidate.toJSON() } }); };
      pc.onconnectionstatechange = () => { if (pc.connectionState === "failed") { cleanup(false); setS("ended"); } };
      ch.on("broadcast", { event: "accept" }, async () => {
        c.timers.forEach((t) => clearInterval(t)); c.timers = [];
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void ch.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
      })
        .on("broadcast", { event: "answer" }, async ({ payload }: any) => {
          await pc.setRemoteDescription(payload.sdp); setS("talking");
        })
        .on("broadcast", { event: "ice", }, async ({ payload }: any) => {
          if (payload.from === "admin") { try { await pc.addIceCandidate(payload.c); } catch { /* ignore */ } }
        })
        .on("broadcast", { event: "hangup" }, () => { cleanup(false, false); setS("ended"); })
        .on("broadcast", { event: "decline" }, () => { cleanup(true, false); setS("busy"); })
        .subscribe();
      const lobby = supabase.channel(SUPPORT_LOBBY);
      c.lobby = lobby;
      lobby.subscribe((st) => {
        if (st !== "SUBSCRIBED") return;
        const ring = () => void lobby.send({ type: "broadcast", event: "ring", payload: { id, uid, name, at: Date.now() } });
        ring();
        c.timers.push(window.setInterval(ring, 3000));
      });
      let waited = 0;
      c.timers.push(window.setInterval(() => {
        waited += 1;
        if (waited >= 45) { cleanup(true); setS("busy"); }
      }, 1000));
    } catch {
      cleanup(false); setS("busy");
    }
  };

  const hang = () => { cleanup(s === "calling"); setS("ended"); };
  const toggleMute = () => {
    const m = !muted; setMuted(m);
    r.current.stream?.getAudioTracks().forEach((t) => (t.enabled = !m));
  };

  return (
    <div className="flex flex-col items-center gap-2.5">
      <audio ref={remote} autoPlay playsInline />
      {(s === "idle" || s === "ended" || s === "busy" || s === "nomic") && (
        <>
          {s === "busy" && <p className="text-center text-xs font-bold text-destructive">এখন সব এজেন্ট ব্যস্ত। একটু পরে আবার চেষ্টা করুন, অথবা টেলিগ্রামে লিখে পাঠান।</p>}
          {s === "ended" && <p className="text-center text-xs font-bold opacity-80">কল শেষ হয়েছে। ধন্যবাদ 💙</p>}
          {s === "nomic" && <p className="text-center text-xs font-bold text-destructive">কথা বলতে মাইক্রোফোনের অনুমতি দিন, তারপর আবার চাপুন।</p>}
          <button onClick={call}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-black text-primary-foreground shadow-lg active:scale-95 transition">
            <Phone className="h-4 w-4" /> এজেন্টের সাথে কথা বলুন
          </button>
        </>
      )}
      {(s === "calling" || s === "talking") && (
        <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card/90 p-4 shadow-lg">
          <p className="text-sm font-black">
            {s === "calling" ? "এজেন্টকে কল করা হচ্ছে… অপেক্ষা করুন" : `এজেন্টের সাথে কথা হচ্ছে · ${bn(Math.floor(sec / 60))}:${bn(sec % 60)}`}
          </p>
          <div className="flex gap-6">
            <button onClick={toggleMute} aria-label="মিউট" className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button onClick={hang} aria-label="কল কাটুন" className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
              <PhoneOff className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
