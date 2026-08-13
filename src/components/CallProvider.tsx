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
import { Mic, MicOff, PhoneOff, Video, VideoOff, PhoneIncoming, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyCallIdentity } from "@/lib/friends.functions";

type Signal =
  | { kind: "offer"; from: string; fromName: string; video: boolean; sdp: any }
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<any>(null);
  const pendingIce = useRef<any[]>([]);
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
    if (outRef.current) {
      supabase.removeChannel(outRef.current);
      outRef.current = null;
    }
    setPeer(null);
    setState("idle");
    setMuted(false);
    setCamOff(false);
  }, []);

  const hangUp = useCallback(() => {
    if (peer) void sendTo(peer.id, { kind: "end", from: myId ?? "" });
    cleanup();
  }, [peer, myId, sendTo, cleanup]);

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
        video: video ? { facingMode: "user", width: { ideal: 640 } } : false,
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
        await sendTo(peerId, {
          kind: "offer",
          from: myId,
          fromName: myName,
          video,
          sdp: offer,
        });
      } catch (e) {
        toast.error("মাইক/ক্যামেরার অনুমতি দিন");
        cleanup();
      }
    },
    [buildPeer, cleanup, myId, myName, sendTo, state],
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
      await sendTo(peer.id, { kind: "answer", from: myId, sdp: answer });
    } catch {
      toast.error("মাইক/ক্যামেরার অনুমতি দিন");
      hangUp();
    }
  }, [buildPeer, hangUp, myId, peer, sendTo, withVideo]);

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

  const value = useMemo<Ctx>(() => ({ startCall: (a, b, c) => void startCall(a, b, c), state }), [startCall, state]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={remoteAudio} autoPlay playsInline className="hidden" />

      {state === "ringing" && peer && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="glass w-full max-w-sm rounded-3xl border border-cyan-400/30 p-6 text-center">
            <div className="mx-auto grid h-20 w-20 animate-pulse place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-2xl font-black text-white">
              {peer.name.slice(0, 1)}
            </div>
            <p className="mt-4 text-sm font-black">{peer.name}</p>
            <p className="text-[11px] font-bold text-muted-foreground">
              {withVideo ? "ভিডিও কল আসছে…" : "অডিও কল আসছে…"}
            </p>
            <div className="mt-6 flex items-center justify-center gap-6">
              <button
                onClick={hangUp}
                className="btn-press grid h-14 w-14 place-items-center rounded-full bg-rose-600 text-white"
                aria-label="কল কাটুন"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
              <button
                onClick={() => void acceptCall()}
                className="btn-press grid h-14 w-14 animate-bounce place-items-center rounded-full bg-emerald-600 text-white"
                aria-label="কল ধরুন"
              >
                <PhoneIncoming className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {(state === "calling" || state === "connecting" || state === "active") && peer && (
        <div className="fixed inset-0 z-[95] flex flex-col bg-[#07091a]">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className={`h-full w-full object-cover ${withVideo ? "" : "opacity-0"}`}
            />
            {!withVideo && (
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center text-white">
                  <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-3xl font-black">
                    {peer.name.slice(0, 1)}
                  </div>
                  <p className="mt-4 text-lg font-black">{peer.name}</p>
                </div>
              </div>
            )}
            {withVideo && (
              <video
                ref={localVideo}
                autoPlay
                playsInline
                muted
                className="absolute bottom-4 right-4 h-40 w-28 rounded-2xl border border-white/30 object-cover shadow-xl"
              />
            )}
            <div className="absolute left-0 right-0 top-0 p-4 text-center text-white">
              <p className="text-sm font-black drop-shadow">{peer.name}</p>
              <p className="text-[11px] font-bold text-white/70">
                {state === "active" ? "সংযুক্ত • কথা বলুন" : "সংযোগ হচ্ছে…"}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-5 bg-black/60 px-4 py-6">
            <button
              onClick={toggleMute}
              className={`btn-press grid h-14 w-14 place-items-center rounded-full text-white ${muted ? "bg-white/25" : "bg-white/10"}`}
              aria-label="মাইক"
            >
              {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
            <button
              onClick={hangUp}
              className="btn-press grid h-16 w-16 place-items-center rounded-full bg-rose-600 text-white shadow-lg"
              aria-label="কল কাটুন"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            {withVideo && (
              <button
                onClick={toggleCam}
                className={`btn-press grid h-14 w-14 place-items-center rounded-full text-white ${camOff ? "bg-white/25" : "bg-white/10"}`}
                aria-label="ক্যামেরা"
              >
                {camOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
              </button>
            )}
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
