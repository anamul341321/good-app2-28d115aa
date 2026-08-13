import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Mic,
  MicOff,
  PhoneOff,
  Video,
  VideoOff,
  PhoneIncoming,
  Phone,
  MonitorUp,
  MonitorOff,
  SwitchCamera,
  Volume2,
} from "lucide-react";
import { playIncomingRing, playRingback } from "@/lib/ringtone";
import { supabase } from "@/integrations/supabase/client";
import { getMyCallIdentity } from "@/lib/friends.functions";
import { createCall, getCall, updateCall } from "@/lib/calls.functions";

type Signal =
  | { kind: "offer"; from: string; fromName: string; video: boolean; sdp: any; callId?: string }
  | { kind: "answer"; from: string; sdp: any }
  | { kind: "ice"; from: string; candidate: any }
  | { kind: "end"; from: string }
  | { kind: "busy"; from: string };

type CallState = "idle" | "calling" | "ringing" | "connecting" | "active";

type Ctx = {
  startCall: (peerId: string, peerName: string, video: boolean) => void;
  state: CallState;
};

const CallContext = createContext<Ctx>({ startCall: () => {}, state: "idle" });
export const useCalls = () => useContext(CallContext);

const ICE = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ],
};

/**
 * পুরো অ্যাপে অডিও/ভিডিও কল। সিগন্যালিং হয় Supabase Realtime broadcast দিয়ে
 * (প্রতি ইউজারের নিজের চ্যানেল), মিডিয়া যায় সরাসরি WebRTC পিয়ার-টু-পিয়ার।
 */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { data: me } = useQuery({
    queryKey: ["my-call-identity"],
    queryFn: () => getMyCallIdentity(),
    staleTime: 5 * 60 * 1000,
  });
  const myId = (me as any)?.userId as string | undefined;
  const myName = ((me as any)?.name as string | undefined) ?? "ইউজার";

  const [state, setState] = useState<CallState>("idle");
  const [peer, setPeer] = useState<{ id: string; name: string } | null>(null);
  const [withVideo, setWithVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const facing = useRef<"user" | "environment">("user");
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const shareStream = useRef<MediaStream | null>(null);
  const ring = useRef<{ stop: () => void } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<any>(null);
  const pendingIce = useRef<any[]>([]);
  const currentCallId = useRef<string | null>(null);
  const outRef = useRef<any>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);

  const sendTo = useCallback(async (peerId: string, payload: Signal) => {
    let ch = outRef.current;
    if (!ch || ch.__peerId !== peerId) {
      if (ch) supabase.removeChannel(ch);
      ch = supabase.channel(`call-${peerId}`, { config: { broadcast: { self: false } } });
      ch.__peerId = peerId;
      await new Promise<void>((resolve) => {
        ch.subscribe((status: string) => {
          if (status === "SUBSCRIBED") resolve();
        });
        window.setTimeout(resolve, 4000);
      });
      outRef.current = ch;
    }
    await ch.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => {
      try {
        s.track?.stop();
      } catch {}
    });
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    localStream.current?.getTracks().forEach((t) => t.stop());
    localStream.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    currentCallId.current = null;
    if (outRef.current) {
      supabase.removeChannel(outRef.current);
      outRef.current = null;
    }
    shareStream.current?.getTracks().forEach((t) => t.stop());
    shareStream.current = null;
    camTrack.current = null;
    ring.current?.stop();
    ring.current = null;
    setPeer(null);
    setState("idle");
    setMuted(false);
    setCamOff(false);
    setSharing(false);
    setSeconds(0);
  }, []);

  const hangUp = useCallback(() => {
    if (peer) void sendTo(peer.id, { kind: "end", from: myId ?? "" });
    if (currentCallId.current) {
      void updateCall({ data: { callId: currentCallId.current, status: state === "ringing" ? "declined" : "ended" } });
    }
    cleanup();
  }, [peer, myId, sendTo, cleanup, state]);

  const waitForIce = useCallback((pc: RTCPeerConnection) => {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        if (pc.iceGatheringState !== "complete") return;
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      };
      pc.addEventListener("icegatheringstatechange", done);
      window.setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", done);
        resolve();
      }, 3500);
    });
  }, []);

  const attachRemote = useCallback((stream: MediaStream) => {
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = stream;
      void remoteVideo.current.play().catch(() => {});
    }
    if (remoteAudio.current) {
      remoteAudio.current.srcObject = stream;
      void remoteAudio.current.play().catch(() => {});
    }
  }, []);

  const buildPeer = useCallback(
    async (peerId: string, video: boolean) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: video
          ? {
              facingMode: facing.current,
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            }
          : false,
      });
      localStream.current = stream;
      const pc = new RTCPeerConnection(ICE);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const remote = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        attachRemote(e.streams[0] ?? remote);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) void sendTo(peerId, { kind: "ice", from: myId ?? "", candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setState("active");
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          toast.error("কল কেটে গেছে");
          cleanup();
        }
      };
      pcRef.current = pc;
      camTrack.current = stream.getVideoTracks()[0] ?? null;
      // ভিডিও যেন ক্লিয়ার দেখা যায় — বিটরেট বাড়িয়ে দিই
      try {
        const sender = pc.getSenders().find((x) => x.track?.kind === "video");
        if (sender) {
          const params = sender.getParameters();
          params.encodings = [{ maxBitrate: 1_800_000, maxFramerate: 30 }];
          void sender.setParameters(params);
        }
      } catch {}
      if (localVideo.current && video) {
        localVideo.current.srcObject = stream;
        void localVideo.current.play().catch(() => {});
      }
      return pc;
    },
    [attachRemote, cleanup, myId, sendTo],
  );

  const startCall = useCallback(
    async (peerId: string, peerName: string, video: boolean) => {
      if (!myId) return;
      if (state !== "idle") {
        toast.error("একটি কল ইতিমধ্যেই চলছে");
        return;
      }
      try {
        setPeer({ id: peerId, name: peerName });
        setWithVideo(video);
        setState("calling");
        const pc = await buildPeer(peerId, video);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIce(pc);
        const finalOffer = pc.localDescription?.toJSON() ?? offer;
        const created = await createCall({ data: { peerId, video, offer: finalOffer } });
        currentCallId.current = created.callId;
        await sendTo(peerId, {
          kind: "offer",
          from: myId,
          fromName: myName,
          video,
          sdp: finalOffer,
          callId: created.callId,
        });
      } catch (e) {
        toast.error("মাইক/ক্যামেরার অনুমতি দিন");
        cleanup();
      }
    },
    [buildPeer, cleanup, myId, myName, sendTo, state, waitForIce],
  );

  const acceptCall = useCallback(async () => {
    if (!peer || !pendingOffer.current || !myId) return;
    try {
      setState("connecting");
      const pc = await buildPeer(peer.id, withVideo);
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      for (const c of pendingIce.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch {}
      }
      pendingIce.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitForIce(pc);
      const finalAnswer = pc.localDescription?.toJSON() ?? answer;
      await sendTo(peer.id, { kind: "answer", from: myId, sdp: finalAnswer });
      if (currentCallId.current) {
        await updateCall({ data: { callId: currentCallId.current, status: "accepted", answer: finalAnswer } });
      }
    } catch {
      toast.error("মাইক/ক্যামেরার অনুমতি দিন");
      hangUp();
    }
  }, [buildPeer, hangUp, myId, peer, sendTo, withVideo, waitForIce]);

  // Native incoming-call screen থেকে app খুললে durable offer দিয়ে call screen পুনরুদ্ধার করি।
  useEffect(() => {
    if (!myId || state !== "idle") return;
    const callId = new URLSearchParams(window.location.search).get("call");
    if (!callId) return;
    void getCall({ data: { callId } }).then(({ call }) => {
      if (!call || call.calleeId !== myId || !["calling", "ringing"].includes(call.status)) return;
      currentCallId.current = call.id;
      pendingOffer.current = call.offer;
      setPeer({ id: call.callerId, name: call.otherName });
      setWithVideo(call.video);
      setState("ringing");
    });
  }, [myId, state]);

  useEffect(() => {
    if (state !== "ringing") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("accept") !== "1") return;
    params.delete("accept");
    const next = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
    void acceptCall();
  }, [state, acceptCall]);

  // Receiver background-এ থাকলে answer database-এ আসে; caller সেটি এখান থেকে নেয়।
  useEffect(() => {
    if (state !== "calling" || !currentCallId.current) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      const callId = currentCallId.current;
      if (!callId) return;
      checks += 1;
      void getCall({ data: { callId } }).then(async ({ call }) => {
        if (call?.status === "accepted" && call.answer && pcRef.current && !pcRef.current.remoteDescription) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(call.answer));
          setState("connecting");
        } else if (call && ["declined", "missed", "cancelled", "failed"].includes(call.status)) {
          toast(call.status === "declined" ? "কলটি কেটে দেওয়া হয়েছে" : "কলটি ধরা হয়নি");
          cleanup();
        } else if (checks >= 23) {
          await updateCall({ data: { callId, status: "missed", reason: "no_answer" } });
          toast("কলটি ধরা হয়নি");
          cleanup();
        }
      }).catch(() => {});
    }, 2000);
    return () => window.clearInterval(timer);
  }, [state, cleanup]);

  // নিজের চ্যানেলে সিগন্যাল শোনা
  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`call-${myId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const sig = payload as Signal;
        if (sig.kind === "offer") {
          if (state !== "idle") {
            void sendTo(sig.from, { kind: "busy", from: myId });
            return;
          }
          pendingOffer.current = sig.sdp;
          currentCallId.current = sig.callId ?? null;
          setPeer({ id: sig.from, name: sig.fromName });
          setWithVideo(sig.video);
          setState("ringing");
          return;
        }
        if (sig.kind === "answer") {
          try {
            await pcRef.current?.setRemoteDescription(new RTCSessionDescription(sig.sdp));
            setState("connecting");
          } catch {}
          return;
        }
        if (sig.kind === "ice") {
          if (pcRef.current?.remoteDescription) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.candidate));
            } catch {}
          } else {
            pendingIce.current.push(sig.candidate);
          }
          return;
        }
        if (sig.kind === "busy") {
          toast.error("ইউজার এখন অন্য কলে ব্যস্ত");
          cleanup();
          return;
        }
        if (sig.kind === "end") {
          toast("কল শেষ হয়েছে");
          cleanup();
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [myId, state, sendTo, cleanup]);

  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };
  const toggleCam = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCamOff(!track.enabled);
  };

  // রিংটোন: কল আসলে মেলোডি, কল দিলে রিং-ব্যাক
  useEffect(() => {
    ring.current?.stop();
    ring.current = null;
    if (state === "ringing") ring.current = playIncomingRing();
    else if (state === "calling") ring.current = playRingback();
    return () => {
      ring.current?.stop();
      ring.current = null;
    };
  }, [state]);

  // কলের সময় গণনা
  useEffect(() => {
    if (state !== "active") return;
    const id = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const replaceVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const sender = pcRef.current?.getSenders().find((x) => x.track?.kind === "video");
    if (sender && track) await sender.replaceTrack(track);
    if (localVideo.current && track) {
      const ms = new MediaStream([track]);
      localVideo.current.srcObject = ms;
      void localVideo.current.play().catch(() => {});
    }
  }, []);

  const toggleShare = useCallback(async () => {
    try {
      if (sharing) {
        shareStream.current?.getTracks().forEach((t) => t.stop());
        shareStream.current = null;
        await replaceVideoTrack(camTrack.current);
        setSharing(false);
        return;
      }
      const ds = await (navigator.mediaDevices as any).getDisplayMedia?.({
        video: { frameRate: 15 },
        audio: false,
      });
      if (!ds) throw new Error("no-display");
      shareStream.current = ds;
      const track = ds.getVideoTracks()[0] as MediaStreamTrack;
      track.onended = () => void toggleShare();
      await replaceVideoTrack(track);
      setSharing(true);
    } catch {
      toast.error("স্ক্রিন শেয়ার করা যায়নি (ফোনের ব্রাউজার/অ্যাপ সাপোর্ট করছে না)");
    }
  }, [replaceVideoTrack, sharing]);

  const switchCamera = useCallback(async () => {
    try {
      facing.current = facing.current === "user" ? "environment" : "user";
      const ns = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing.current, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const track = ns.getVideoTracks()[0]!;
      camTrack.current?.stop();
      camTrack.current = track;
      if (!sharing) await replaceVideoTrack(track);
    } catch {
      toast.error("ক্যামেরা বদলানো যায়নি");
    }
  }, [replaceVideoTrack, sharing]);

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const value = useMemo<Ctx>(() => ({ startCall: (a, b, c) => void startCall(a, b, c), state }), [startCall, state]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      {/* ইনকামিং কল — মেসেঞ্জারের মতো ফুল স্ক্রিন */}
      {state === "ringing" && peer && (
        <div
          className="fixed inset-0 z-[95] flex flex-col items-center justify-between px-6 pb-12 pt-20 text-white"
          style={{ background: "radial-gradient(120% 80% at 50% 0%,#1b2a6b 0%,#0b1024 55%,#05060f 100%)" }}
        >
          <div className="flex flex-col items-center">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-300">
              {withVideo ? "ভিডিও কল আসছে" : "অডিও কল আসছে"}
            </p>
            <div className="relative mt-10 grid place-items-center">
              <span className="absolute h-40 w-40 animate-ping rounded-full bg-cyan-400/20" />
              <span className="absolute h-52 w-52 animate-pulse rounded-full bg-violet-500/10" />
              <div className="relative grid h-32 w-32 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-5xl font-black shadow-2xl">
                {peer.name.slice(0, 1)}
              </div>
            </div>
            <p className="mt-8 text-2xl font-black">{peer.name}</p>
            <p className="mt-1 text-xs font-bold text-white/60">good-app কল</p>
          </div>

          <div className="flex w-full items-end justify-around">
            <button
              onClick={hangUp}
              className="btn-press flex flex-col items-center gap-2"
              aria-label="কল কাটুন"
            >
              <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-rose-600 shadow-[0_10px_30px_-8px_rgba(244,63,94,0.9)]">
                <PhoneOff className="h-7 w-7" />
              </span>
              <span className="text-[11px] font-black text-white/80">কেটে দিন</span>
            </button>
            <button
              onClick={() => void acceptCall()}
              className="btn-press flex flex-col items-center gap-2"
              aria-label="কল ধরুন"
            >
              <span className="grid h-[72px] w-[72px] animate-bounce place-items-center rounded-full bg-emerald-500 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.9)]">
                <PhoneIncoming className="h-7 w-7" />
              </span>
              <span className="text-[11px] font-black text-white/80">রিসিভ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* চলমান কল */}
      {(state === "calling" || state === "connecting" || state === "active") && peer && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-[#05060f]">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${withVideo ? "" : "opacity-0"}`}
            />
            {!withVideo && (
              <div
                className="absolute inset-0 grid place-items-center"
                style={{ background: "radial-gradient(120% 80% at 50% 0%,#1b2a6b 0%,#0b1024 60%,#05060f 100%)" }}
              >
                <div className="text-center text-white">
                  <div className="relative mx-auto grid h-28 w-28 place-items-center">
                    {state === "active" && (
                      <span className="absolute h-32 w-32 animate-ping rounded-full bg-cyan-400/15" />
                    )}
                    <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-4xl font-black">
                      {peer.name.slice(0, 1)}
                    </div>
                  </div>
                  <p className="mt-5 text-xl font-black">{peer.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-cyan-300">
                    <Volume2 className="h-3.5 w-3.5" />
                    {state === "active" ? clock : state === "calling" ? "রিং হচ্ছে…" : "সংযোগ হচ্ছে…"}
                  </p>
                </div>
              </div>
            )}
            {withVideo && (
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="absolute bottom-5 right-4 h-44 w-32 rounded-2xl border border-white/25 object-cover shadow-2xl"
              />
            )}
            <div className="absolute left-0 right-0 top-0 flex flex-col items-center gap-1 bg-gradient-to-b from-black/60 to-transparent p-5 text-white">
              <p className="text-base font-black drop-shadow">{peer.name}</p>
              <p className="rounded-full bg-white/10 px-3 py-0.5 text-[11px] font-black text-white/85">
                {state === "active" ? clock : state === "calling" ? "রিং হচ্ছে…" : "সংযোগ হচ্ছে…"}
                {sharing ? " • স্ক্রিন শেয়ার" : ""}
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/70 px-4 pb-8 pt-5 backdrop-blur">
            <div className="flex items-center justify-center gap-4">
              <CallCtl active={muted} onClick={toggleMute} label={muted ? "আনমিউট" : "মিউট"}>
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </CallCtl>
              {withVideo && (
                <CallCtl active={camOff} onClick={toggleCam} label="ক্যামেরা">
                  {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </CallCtl>
              )}
              <CallCtl active={sharing} onClick={() => void toggleShare()} label="স্ক্রিন">
                {sharing ? <MonitorOff className="h-6 w-6" /> : <MonitorUp className="h-6 w-6" />}
              </CallCtl>
              {withVideo && (
                <CallCtl active={false} onClick={() => void switchCamera()} label="ক্যাম বদল">
                  <SwitchCamera className="h-6 w-6" />
                </CallCtl>
              )}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={hangUp}
                className="btn-press grid h-[68px] w-[68px] place-items-center rounded-full bg-rose-600 text-white shadow-[0_12px_30px_-8px_rgba(244,63,94,0.9)]"
                aria-label="কল কাটুন"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
            </div>
          </div>
        </div>
      )}
    </CallContext.Provider>
  );
}

/** বন্ধুর পাশে কল বাটন */
export function CallButtons({ userId, name }: { userId: string; name: string }) {
  const { startCall } = useCalls();
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => startCall(userId, name, false)}
        className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500"
        aria-label="অডিও কল"
      >
        <Phone className="h-4 w-4" />
      </button>
      <button
        onClick={() => startCall(userId, name, true)}
        className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"
        aria-label="ভিডিও কল"
      >
        <Video className="h-4 w-4" />
      </button>
    </div>
  );
}

/** কল কন্ট্রোল বাটন (মিউট/ক্যামেরা/স্ক্রিন শেয়ার) */
function CallCtl({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="btn-press flex flex-col items-center gap-1.5" aria-label={label}>
      <span
        className={`grid h-14 w-14 place-items-center rounded-full border text-white transition ${
          active ? "border-white/40 bg-white/85 text-[#0b1024]" : "border-white/15 bg-white/10"
        }`}
      >
        {children}
      </span>
      <span className="text-[10px] font-black text-white/70">{label}</span>
    </button>
  );
}
