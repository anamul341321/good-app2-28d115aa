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
import { createCall, getCall, ringCall, saveCallOffer, updateCall } from "@/lib/calls.functions";

type Signal =
  | { kind: "offer"; from: string; fromName: string; video: boolean; sdp: any; callId?: string }
  | { kind: "reoffer"; from: string; sdp: any }
  | { kind: "answer"; from: string; sdp: any }
  | { kind: "ice"; from: string; candidate: any }
  | { kind: "pointer"; from: string; x: number; y: number }


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
    // মোবাইল ডাটা/NAT-এ কথা মাঝপথে কেটে না যাওয়ার জন্য relay (TURN)
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 4,
  iceTransportPolicy: "all" as RTCIceTransportPolicy,
  bundlePolicy: "max-bundle" as RTCBundlePolicy,
  rtcpMuxPolicy: "require" as RTCRtcpMuxPolicy,
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
  const stateRef = useRef<CallState>("idle");
  const [peer, setPeer] = useState<{ id: string; name: string } | null>(null);
  const [withVideo, setWithVideo] = useState(false);
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  // অডিও কলে ইয়ারপিস/স্পিকার বদলের জন্য (Messenger-এর মতো)
  const [speakerOn, setSpeakerOn] = useState(false);
  // অন্য পাশ থেকে আসা "এখানে চাপুন" নির্দেশনা — শেয়ার করার সময় স্ক্রিনে মার্কার দেখায়
  const [remotePointer, setRemotePointer] = useState<{ x: number; y: number; at: number } | null>(null);




  const [quality, setQuality] = useState<"good" | "poor" | "reconnecting">("good");
  const [seconds, setSeconds] = useState(0);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const facing = useRef<"user" | "environment">("user");
  const camTrack = useRef<MediaStreamTrack | null>(null);
  const shareTrack = useRef<MediaStreamTrack | null>(null);
  const shareStream = useRef<MediaStream | null>(null);
  // ভিডিও কল রিং হওয়ার সময়েই ক্যামেরা/মাইক আগে থেকে চালু করে রাখি — তাই
  // রিসিভ করার সাথে সাথেই ছবি দেখা যায়, দেরি হয় না।
  const warmStream = useRef<MediaStream | null>(null);
  const warmVideo = useRef<boolean>(false);
  // Android অ্যাপে স্ক্রিন ফ্রেম native থেকে আসে, তাই canvas দিয়ে video track বানানো হয়।
  const shareCanvas = useRef<HTMLCanvasElement | null>(null);
  const ring = useRef<{ stop: () => void } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const pendingOffer = useRef<any>(null);
  const pendingIce = useRef<any[]>([]);
  const currentCallId = useRef<string | null>(null);
  const outRef = useRef<any>(null);
  const localVideo = useRef<HTMLVideoElement | null>(null);
  const remoteVideo = useRef<HTMLVideoElement | null>(null);
  const isCaller = useRef(false);
  const reconnectTimer = useRef<number | null>(null);
  const reconnecting = useRef(false);
  const peerIdRef = useRef<string | null>(null);
  const makingOffer = useRef(false);
  const isNativeApp =
    typeof window !== "undefined" &&
    Boolean((window as any).Capacitor?.isNativePlatform?.() || (window as any).GoodAppDownloader);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    if (reconnectTimer.current) {
      window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    reconnecting.current = false;
    makingOffer.current = false;
    isCaller.current = false;
    peerIdRef.current = null;
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
    remoteStream.current = null;
    pendingOffer.current = null;
    pendingIce.current = [];
    currentCallId.current = null;
    setCallSessionId(null);
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
    setRemotePointer(null);

    setState("idle");

    setMuted(false);
    setCamOff(false);
    setSharing(false);
    setSpeakerOn(false);
    warmStream.current?.getTracks().forEach((t) => t.stop());
    warmStream.current = null;
    setQuality("good");
    setSeconds(0);
    try {
      (window as any).GoodAppDownloader?.endCall?.();
    } catch {}
  }, []);

  const hangUp = useCallback(async () => {
    const callId = currentCallId.current;
    const peerId = peer?.id;
    const finalStatus = state === "ringing" ? "declined" : state === "calling" ? "cancelled" : "ended";
    // Close locally first, then notify through both realtime and the durable database.
    // A slow network path must never leave the ringtone or call screen hanging locally.
    cleanup();
    await Promise.allSettled([
      peerId ? sendTo(peerId, { kind: "end", from: myId ?? "" }) : Promise.resolve(),
      callId ? updateCall({ data: { callId, status: finalStatus } }) : Promise.resolve(),
    ]);
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
       }, 4000);
    });
  }, []);

  const resumeRemoteMedia = useCallback(() => {
    const video = remoteVideo.current;
    const stream = remoteStream.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = false;
    video.volume = 1;
    const tryPlay = (left: number) => {
      void video.play().catch(() => {
        if (left > 0) window.setTimeout(() => tryPlay(left - 1), 220);
      });
    };
    tryPlay(8);
  }, []);

  const attachRemote = useCallback((stream: MediaStream) => {
    remoteStream.current = stream;
    resumeRemoteMedia();
  }, [resumeRemoteMedia]);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const candidates = pendingIce.current.splice(0);
    for (const candidate of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {}
    }
  }, []);

  const buildPeer = useCallback(
    async (peerId: string, video: boolean) => {
      try {
        (window as any).GoodAppDownloader?.beginCall?.(video);
      } catch {}
      const audioOnly = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
          sampleSize: 16,
        },
        video: false as const,
      };
      let stream: MediaStream;
      // রিং হওয়ার সময় আগেই নেওয়া ক্যামেরা/মাইক থাকলে সেটাই ব্যবহার করি — instant connect
      const warm = warmStream.current;
      if (warm && warmVideo.current === video && warm.getTracks().some((t) => t.readyState === "live")) {
        warmStream.current = null;
        localStream.current = warm;
        stream = warm;
      } else {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioOnly.audio,
          video: video
            ? {
                facingMode: facing.current,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
              }
            : false,
        });
      } catch (err) {
        // ক্যামেরা ব্যস্ত/না থাকলে ভিডিও কল অডিও কল হিসেবে চালু থাকবে, কল ভেঙে যাবে না।
        if (!video) throw err;
        stream = await navigator.mediaDevices.getUserMedia(audioOnly);
        setWithVideo(false);
        toast("ক্যামেরা পাওয়া যায়নি — অডিও কল চালু হলো");
      }
      }
      stream.getAudioTracks().forEach((track) => {
        track.contentHint = "speech";
      });
      stream.getVideoTracks().forEach((track) => {
        track.contentHint = "motion";
      });
      localStream.current = stream;
      const pc = new RTCPeerConnection(ICE);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const remote = new MediaStream();
      pc.ontrack = (e) => {
        const tracks = e.streams[0]?.getTracks() ?? [e.track];
        tracks.forEach((track) => {
          if (!remote.getTracks().some((existing) => existing.id === track.id)) remote.addTrack(track);
        });
        attachRemote(remote);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate)
          void sendTo(peerId, {
            kind: "ice",
            from: myId ?? "",
            candidate: e.candidate.toJSON(),
          });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (reconnectTimer.current) {
            window.clearTimeout(reconnectTimer.current);
            reconnectTimer.current = null;
          }
          reconnecting.current = false;
          setState("active");
          return;
        }
        // নেটওয়ার্ক একটু কেটে গেলে সাথে সাথে কল বন্ধ না করে ৩০ সেকেন্ড পর্যন্ত
        // নিজে থেকে আবার জোড়া লাগানোর চেষ্টা করি (Messenger-এর মতো)।
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          if (reconnectTimer.current || reconnecting.current) return;
          reconnecting.current = true;
          setQuality("reconnecting");
          toast("সংযোগ দুর্বল — আবার জোড়া লাগানো হচ্ছে…");
          try {
            pc.restartIce();
          } catch {}
          if (isCaller.current && peerIdRef.current) {
            void (async () => {
              try {
                const offer = await pc.createOffer({ iceRestart: true });
                await pc.setLocalDescription(offer);
                await waitForIce(pc);
                const reconnectPeerId = peerIdRef.current;
                if (!reconnectPeerId) return;
                await sendTo(reconnectPeerId, {
                  kind: "reoffer",
                  from: myId ?? "",
                  sdp: pc.localDescription?.toJSON() ?? offer,
                });
              } catch {}
            })();
          }
          reconnectTimer.current = window.setTimeout(() => {
            reconnectTimer.current = null;
            reconnecting.current = false;
            if (pcRef.current !== pc) return;
            if (pc.connectionState === "connected") return;
            toast.error("কল কেটে গেছে");
            cleanup();
          }, 30000);
        }
      };
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          reconnecting.current = false;
          setQuality("good");
        }
      };

      pcRef.current = pc;
      camTrack.current = stream.getVideoTracks()[0] ?? null;
      // ভিডিও যেন ক্লিয়ার দেখা যায় — বিটরেট বাড়িয়ে দিই
      try {
        const sender = pc.getSenders().find((x) => x.track?.kind === "video");
        if (sender) {
          const params = sender.getParameters();
          params.degradationPreference = "balanced";
          params.encodings = [{ maxBitrate: 2_400_000, maxFramerate: 30, scaleResolutionDownBy: 1 }];
          void sender.setParameters(params);
        }
      } catch {}
      if (localVideo.current && video) {
        localVideo.current.srcObject = stream;
        void localVideo.current.play().catch(() => {});
      }
      return pc;
    },
    [attachRemote, cleanup, myId, sendTo, waitForIce],
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
        isCaller.current = true;
        peerIdRef.current = peerId;
        setWithVideo(video);
        setState("calling");
        const pc = await buildPeer(peerId, video);
        makingOffer.current = true;
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
        await pc.setLocalDescription(offer);
        makingOffer.current = false;
        const finalOffer = pc.localDescription?.toJSON() ?? offer;
        const created = await createCall({ data: { peerId, video, offer: finalOffer } });
        currentCallId.current = created.callId;
        setCallSessionId(created.callId);
        await sendTo(peerId, {
          kind: "offer",
          from: myId,
          fromName: myName,
          video,
          sdp: finalOffer,
          callId: created.callId,
        });
         // Realtime starts the call immediately; FCM independently wakes the native
         // Android full-screen receiver when the app is backgrounded or closed.
         void ringCall({ data: { callId: created.callId } }).catch(() => {});
         // Do not delay ringing for ICE gathering. Persist the completed SDP in the
         // background so a cold-started native receiver still gets every candidate.
         void waitForIce(pc).then(() => {
           const gatheredOffer = pc.localDescription?.toJSON();
           if (gatheredOffer) {
             void saveCallOffer({ data: { callId: created.callId, offer: gatheredOffer } }).catch(() => {});
           }
         });
      } catch (e) {
        makingOffer.current = false;
        toast.error("মাইক/ক্যামেরার অনুমতি দিন");
        if (currentCallId.current) {
          await updateCall({
            data: { callId: currentCallId.current, status: "failed", reason: "media_error" },
          }).catch(() => {});
        }
        cleanup();
      }
    },
    [buildPeer, cleanup, myId, myName, sendTo, state, waitForIce],
  );

  const acceptCall = useCallback(async () => {
    if (!peer || !pendingOffer.current || !myId) return;
    try {
      setState("connecting");
      isCaller.current = false;
      peerIdRef.current = peer.id;
      const pc = await buildPeer(peer.id, withVideo);
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer.current));
      await flushPendingIce(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
       const immediateAnswer = pc.localDescription?.toJSON() ?? answer;
       await sendTo(peer.id, { kind: "answer", from: myId, sdp: immediateAnswer });
       if (currentCallId.current) {
         await updateCall({
           data: { callId: currentCallId.current, status: "accepted", answer: immediateAnswer },
         });
       }
       // Realtime answer immediately starts media. The completed ICE answer is then
       // persisted as a durable fallback for a caller that briefly lost realtime.
       await waitForIce(pc);
       const finalAnswer = pc.localDescription?.toJSON() ?? immediateAnswer;
      if (currentCallId.current) {
        await updateCall({
          data: { callId: currentCallId.current, status: "accepted", answer: finalAnswer },
        });
      }
    } catch {
      toast.error("মাইক/ক্যামেরার অনুমতি দিন");
      hangUp();
    }
  }, [buildPeer, flushPendingIce, hangUp, myId, peer, sendTo, withVideo, waitForIce]);

  // Native incoming-call screen থেকে app খুললে durable offer দিয়ে call screen পুনরুদ্ধার করি।
  useEffect(() => {
    if (!myId || state !== "idle") return;
    const callId = new URLSearchParams(window.location.search).get("call");
    if (!callId) return;
    void getCall({ data: { callId } }).then(({ call }) => {
      if (!call || call.calleeId !== myId || !["calling", "ringing"].includes(call.status)) return;
      currentCallId.current = call.id;
      setCallSessionId(call.id);
      pendingOffer.current = call.offer;
      try {
        (window as any).GoodAppDownloader?.beginCall?.(call.video);
      } catch {}
      setPeer({ id: call.callerId, name: call.otherName });
      setWithVideo(call.video);
      setState("ringing");
    });
  }, [myId, state]);

  useEffect(() => {
    if (state !== "connecting" && state !== "active") return;
    resumeRemoteMedia();
  }, [state, peer?.id, withVideo, resumeRemoteMedia]);

  // কল রিং হওয়ার সময়েই ক্যামেরা/মাইক গরম করে রাখি — রিসিভ করলেই সাথে সাথে ছবি আসে
  useEffect(() => {
    if (state !== "ringing") return;
    let cancelled = false;
    void (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: withVideo
            ? { facingMode: facing.current, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
            : false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        warmStream.current?.getTracks().forEach((t) => t.stop());
        warmStream.current = s;
        warmVideo.current = withVideo;
      } catch {
        /* অনুমতি না থাকলে accept করার সময় আবার চাওয়া হবে */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [state, withVideo]);

  // স্পিকার/ইয়ারপিস — ভিডিও কলে ডিফল্ট স্পিকার, অডিও কলে ইয়ারপিস
  useEffect(() => {
    if (state === "connecting" || state === "active") setSpeakerOn(withVideo);
  }, [state, withVideo]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((prev) => {
      const next = !prev;
      try {
        (window as any).GoodAppDownloader?.setSpeakerphone?.(next);
      } catch {}
      return next;
    });
  }, []);

  const bumpVolume = useCallback((up: boolean) => {
    try {
      (window as any).GoodAppDownloader?.adjustCallVolume?.(up);
    } catch {}
    const v = remoteVideo.current;
    if (v) v.volume = Math.max(0, Math.min(1, (v.volume ?? 1) + (up ? 0.15 : -0.15)));
  }, []);

  useEffect(() => {
    const replay = () => {
      if (stateRef.current !== "connecting" && stateRef.current !== "active") return;
      resumeRemoteMedia();
    };
    window.addEventListener("focus", replay);
    window.addEventListener("pointerdown", replay);
    window.addEventListener("touchend", replay);
    document.addEventListener("visibilitychange", replay);
    return () => {
      window.removeEventListener("focus", replay);
      window.removeEventListener("pointerdown", replay);
      window.removeEventListener("touchend", replay);
      document.removeEventListener("visibilitychange", replay);
    };
  }, [resumeRemoteMedia]);

  // Screen share bridge events
  useEffect(() => {
    // Android WebView-এ getDisplayMedia নেই, তাই native MediaProjection থেকে আসা
    // JPEG ফ্রেম canvas-এ এঁকে captureStream() দিয়ে WebRTC track বানানো হয়।
    const onFrame = async (event: Event) => {
      const detail = (event as CustomEvent).detail as { data: string; width: number; height: number };
      if (!detail?.data || !pcRef.current) return;
      let canvas = shareCanvas.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = detail.width;
        canvas.height = detail.height;
        shareCanvas.current = canvas;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const image = new Image();
      image.src = `data:image/jpeg;base64,${detail.data}`;
      try {
        await image.decode();
      } catch {
        return;
      }
      if (canvas.width !== detail.width || canvas.height !== detail.height) {
        canvas.width = detail.width;
        canvas.height = detail.height;
      }
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      if (!shareTrack.current) {
        const stream = (canvas as any).captureStream(30) as MediaStream;
        shareStream.current = stream;
        const track = stream.getVideoTracks()[0];
        shareTrack.current = track;
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender) await sender.replaceTrack(track);
        setSharing(true);
      }
    };

    const onReady = () => {
      shareCanvas.current = null;
      shareTrack.current = null;
    };

    const onStopped = () => {
      shareCanvas.current = null;
      void stopSharing();
    };

    const onSwitch = () => {
      facing.current = facing.current === "user" ? "environment" : "user";
      if (camTrack.current && !sharing) {
        const constraints = {
          facingMode: facing.current,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        };
        camTrack.current.applyConstraints(constraints).catch(() => {});
      }
    };

    window.addEventListener("goodapp-screen-frame", onFrame as EventListener);
    window.addEventListener("goodapp-screen-share-stopped", onStopped);

    window.addEventListener("goodapp-screen-share-ready", onReady);
    window.addEventListener("goodapp-switch-camera", onSwitch);
    return () => {
      window.removeEventListener("goodapp-screen-frame", onFrame as EventListener);
      window.removeEventListener("goodapp-screen-share-stopped", onStopped);
      window.removeEventListener("goodapp-screen-share-ready", onReady);
      window.removeEventListener("goodapp-switch-camera", onSwitch);
    };
  }, [sharing]);

  const stopSharing = useCallback(async () => {
    if (!pcRef.current || !sharing) return;
    try {
      shareTrack.current?.stop();
      shareStream.current?.getTracks().forEach(t => t.stop());
      
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === "video");
      if (sender && camTrack.current) {
        await sender.replaceTrack(camTrack.current);
      }
      
      setSharing(false);
      shareTrack.current = null;
      shareStream.current = null;
    } catch {}
  }, [sharing]);

  useEffect(() => {
    if (state !== "ringing") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("accept") !== "1") return;
    params.delete("accept");
    const next = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
    void acceptCall();
  }, [state, acceptCall]);

  useEffect(() => {
    if (!myId || state !== "idle") return;
    const params = new URLSearchParams(window.location.search);
    const callId = params.get("call");
    if (!callId || params.get("decline") !== "1") return;
    params.delete("call");
    params.delete("decline");
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
    void updateCall({ data: { callId, status: "declined" } });
  }, [myId, state]);

  // Database call state is durable: realtime signal হারালেও answer/end দুই ফোনেই পৌঁছায়।
  useEffect(() => {
    if (state === "idle" || !callSessionId) return;
    let checks = 0;
    const timer = window.setInterval(() => {
      const callId = callSessionId;
      checks += 1;
      void getCall({ data: { callId } })
        .then(async ({ call }) => {
          if (
            call?.status === "accepted" &&
            call.answer &&
            pcRef.current &&
            !pcRef.current.remoteDescription
          ) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(call.answer));
            await flushPendingIce(pcRef.current);
            setState("connecting");
          } else if (
            call &&
            ["declined", "missed", "cancelled", "failed", "ended"].includes(call.status)
          ) {
            toast(call.status === "declined" ? "কলটি কেটে দেওয়া হয়েছে" : "কলটি ধরা হয়নি");
            cleanup();
          } else if (stateRef.current === "calling" && checks >= 23) {
            await updateCall({ data: { callId, status: "missed", reason: "no_answer" } });
            toast("কলটি ধরা হয়নি");
            cleanup();
          }
        })
        .catch(() => {});
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, callSessionId, cleanup, flushPendingIce]);

  // End/decline updates arrive instantly through database realtime. The two-second
  // poller above remains as a fallback when a phone briefly loses its socket.
  useEffect(() => {
    if (state === "idle" || !callSessionId) return;
    const channel = supabase
      .channel(`call-state-${callSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "call_sessions",
          filter: `id=eq.${callSessionId}`,
        },
        async ({ new: next }: any) => {
          const status = String(next?.status ?? "");
          if (status === "accepted" && next?.answer && pcRef.current && !pcRef.current.remoteDescription) {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(next.answer));
              await flushPendingIce(pcRef.current);
              setState("connecting");
            } catch {}
            return;
          }
          if (["declined", "missed", "cancelled", "failed", "ended"].includes(status)) {
            toast(status === "declined" ? "কলটি কেটে দেওয়া হয়েছে" : "কল শেষ হয়েছে");
            cleanup();
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [state, callSessionId, cleanup, flushPendingIce]);

  // নিজের চ্যানেলে সিগন্যাল শোনা
  useEffect(() => {
    if (!myId) return;
    const ch = supabase
      .channel(`call-${myId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "signal" }, async ({ payload }) => {
        const sig = payload as Signal;
        if (sig.kind === "offer") {
          // Incoming calls are Android-native only. The FCM full-screen activity owns
          // ringing/answering in the app; browsers must never show a second call UI.
          if (!isNativeApp) return;
          if (stateRef.current !== "idle") {
            void sendTo(sig.from, { kind: "busy", from: myId });
            return;
          }
          pendingOffer.current = sig.sdp;
          currentCallId.current = sig.callId ?? null;
          setCallSessionId(sig.callId ?? null);
          setPeer({ id: sig.from, name: sig.fromName });
          setWithVideo(sig.video);
          setState("ringing");
          return;
        }
        if (sig.kind === "reoffer") {
          // সংযোগ ফিরে পাওয়ার জন্য ICE-restart offer — কল না কেটে নতুন করে জোড়া লাগাই
          const pc = pcRef.current;
          if (!pc) return;
          try {
            if (makingOffer.current || pc.signalingState !== "stable") return;
            await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await waitForIce(pc);
            await sendTo(sig.from, {
              kind: "answer",
              from: myId,
              sdp: pc.localDescription?.toJSON() ?? answer,
            });
          } catch {}
          return;
        }
        if (sig.kind === "answer") {
          try {
            const pc = pcRef.current;
            if (pc) {
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
              }
              await flushPendingIce(pc);
            }
            if (stateRef.current !== "active") setState("connecting");
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
        if (sig.kind === "pointer") {
          setRemotePointer({ x: sig.x, y: sig.y, at: Date.now() });
          window.setTimeout(() => {
            setRemotePointer((p) => (p && Date.now() - p.at >= 2500 ? null : p));
          }, 2600);
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
  }, [myId, sendTo, cleanup, flushPendingIce, waitForIce, isNativeApp]);

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
    if (state === "ringing" && !isNativeApp) ring.current = playIncomingRing();
    else if (state === "calling") ring.current = playRingback(withVideo);
    return () => {
      ring.current?.stop();
      ring.current = null;
    };
  }, [state, isNativeApp, withVideo]);

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

    if (isNativeApp) {
      if (sharing) {
        try {
          (window as any).GoodAppDownloader?.stopScreenShare?.();
        } catch {}
        await stopSharing();
      } else {
        try {
          (window as any).GoodAppDownloader?.startScreenShare?.();
        } catch {}
      }
      return;
    }

    try {
      if (sharing) {
        await stopSharing();
        return;
      }
      const ds = await (navigator.mediaDevices as any).getDisplayMedia?.({
        video: { frameRate: 30 },
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
  }, [replaceVideoTrack, sharing, isNativeApp, stopSharing]);

  const triggerSwitchCamera = useCallback(async () => {
    if (isNativeApp) {
      try {
        (window as any).GoodAppDownloader?.switchCamera?.();
      } catch {}
      return;
    }
    
    try {
      facing.current = facing.current === "user" ? "environment" : "user";
      const ns = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing.current, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const track = ns.getVideoTracks()[0];
      if (!track) throw new Error("camera-unavailable");
      camTrack.current?.stop();
      camTrack.current = track;
      if (!sharing) await replaceVideoTrack(track);
    } catch {
      toast.error("ক্যামেরা বদলানো যায়নি");
    }
  }, [replaceVideoTrack, sharing, isNativeApp]);

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const value = useMemo<Ctx>(
    () => ({ startCall: (a, b, c) => void startCall(a, b, c), state }),
    [startCall, state],
  );

  return (
    <CallContext.Provider value={value}>
      {children}

      {/* ইনকামিং কল — মেসেঞ্জারের মতো ফুল স্ক্রিন */}
      {state === "ringing" && peer && !isNativeApp && (
        <div
          className="fixed inset-0 z-[95] flex flex-col items-center justify-between px-6 text-white"
          style={{
            background: "linear-gradient(180deg,#0a1533 0%,#0a1024 45%,#05060f 100%)",
            paddingTop: "calc(env(safe-area-inset-top,0px) + 64px)",
            paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 44px)",
          }}
        >
          <div className="flex flex-col items-center">
            <div className="relative grid place-items-center">
              <span className="absolute h-44 w-44 animate-ping rounded-full bg-white/10" />
              <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-[#0084ff] to-[#a033ff] text-4xl font-black shadow-2xl">
                {peer.name.slice(0, 1)}
              </div>
            </div>
            <p className="mt-7 text-[26px] font-black tracking-tight">{peer.name}</p>
            <p className="mt-1.5 text-sm font-semibold text-white/60">
              {withVideo ? "ভিডিও কল" : "অডিও কল"}
            </p>
          </div>

          <div className="flex w-full max-w-xs items-end justify-between">
            <button
              onClick={hangUp}
              className="btn-press flex flex-col items-center gap-2.5"
              aria-label="কল কাটুন"
            >
              <span className="grid h-[68px] w-[68px] place-items-center rounded-full bg-[#ff3b30] shadow-[0_12px_28px_-10px_rgba(255,59,48,0.95)]">
                <PhoneOff className="h-7 w-7" />
              </span>
              <span className="text-[12px] font-bold text-white/70">কেটে দিন</span>
            </button>
            <button
              onClick={() => void acceptCall()}
              className="btn-press flex flex-col items-center gap-2.5"
              aria-label="কল ধরুন"
            >
              <span className="grid h-[68px] w-[68px] animate-bounce place-items-center rounded-full bg-[#31c454] shadow-[0_12px_28px_-10px_rgba(49,196,84,0.95)]">
                <PhoneIncoming className="h-7 w-7" />
              </span>
              <span className="text-[12px] font-bold text-white/70">রিসিভ করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* চলমান কল — Messenger স্টাইল */}
      {(state === "calling" || state === "connecting" || state === "active") && peer && (
        <div className="fixed inset-0 z-[95] bg-[#05060f]">
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            onPointerDown={(e) => {
              (e.currentTarget as any).__pd = { x: e.clientX, y: e.clientY, t: Date.now() };
            }}
            onPointerUp={(e) => {
              // অন্যজনের স্ক্রিন দেখার সময় ট্যাপ করলে তার স্ক্রিনে শুধু মার্কার যায়
              if (!peer || state !== "active" || !myId) return;
              const el = e.currentTarget as HTMLVideoElement & { __pd?: { x: number; y: number } };
              const r = el.getBoundingClientRect();
              el.__pd = undefined;
              const vw = el.videoWidth || r.width;
              const vh = el.videoHeight || r.height;
              const scale = Math.max(r.width / vw, r.height / vh);
              const dw = vw * scale, dh = vh * scale;
              const ox = (r.width - dw) / 2, oy = (r.height - dh) / 2;
              const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
              const x = clamp01((e.clientX - r.left - ox) / Math.max(1, dw));
              const y = clamp01((e.clientY - r.top - oy) / Math.max(1, dh));
              void sendTo(peer.id, { kind: "pointer", from: myId, x, y });
            }}


            className={`absolute inset-0 h-full w-full object-cover ${withVideo ? "" : "opacity-0"}`}
          />

          {/* নিজে শেয়ার করছি — স্পষ্ট ইন্ডিকেটর */}
          {sharing && (
            <div
              className="absolute left-1/2 z-[3] -translate-x-1/2 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-[12px] font-bold text-emerald-200 backdrop-blur"
              style={{ top: "calc(env(safe-area-inset-top,0px) + 56px)" }}
            >
              🔴 আপনি স্ক্রিন শেয়ার করছেন
            </div>
          )}




          {/* অন্যজনের নির্দেশনা মার্কার — শেয়ার করার সময় "এখানে চাপুন" */}
          {sharing && remotePointer && (
            <div
              className="pointer-events-none absolute z-[4] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${remotePointer.x * 100}%`, top: `${remotePointer.y * 100}%` }}
            >
              <span className="block h-12 w-12 animate-ping rounded-full border-4 border-amber-400" />
            </div>
          )}


          {!withVideo && (
            <div
              className="absolute inset-0 grid place-items-center"
              style={{ background: "linear-gradient(180deg,#0a1533 0%,#0a1024 45%,#05060f 100%)" }}
            >
              <div className="-mt-10 text-center text-white">
                <div className="relative mx-auto grid h-28 w-28 place-items-center">
                  {state !== "active" && (
                    <span className="absolute h-36 w-36 animate-ping rounded-full bg-white/10" />
                  )}
                  <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-[#0084ff] to-[#a033ff] text-4xl font-black">
                    {peer.name.slice(0, 1)}
                  </div>
                </div>
                <p className="mt-6 text-[24px] font-black tracking-tight">{peer.name}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-white/60">
                  <Volume2 className="h-4 w-4" />
                  {state === "active"
                    ? (quality === "poor" ? "সংযোগ দুর্বল…" : quality === "reconnecting" ? "পুনরায় সংযোগ…" : clock)
                    : state === "calling"
                      ? "রিং হচ্ছে…"
                      : "সংযোগ হচ্ছে…"}
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
              className="absolute right-3 h-40 w-28 rounded-[22px] border border-white/20 object-cover shadow-2xl"
              style={{ top: "calc(env(safe-area-inset-top,0px) + 72px)" }}
            />
          )}

          {/* উপরের হেডার */}
          {withVideo && (
            <div
              className="absolute left-0 right-0 top-0 flex flex-col items-center gap-1 bg-gradient-to-b from-black/55 to-transparent px-5 pb-8 text-white"
              style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 14px)" }}
            >
              <p className="text-[15px] font-bold drop-shadow">{peer.name}</p>
              <p className="text-[12px] font-semibold text-white/70">
                {state === "active" 
                  ? (quality === "poor" ? "সংযোগ দুর্বল…" : quality === "reconnecting" ? "পুনরায় সংযোগ…" : clock)
                  : state === "calling" ? "রিং হচ্ছে…" : "সংযোগ হচ্ছে…"}
                {sharing ? " • স্ক্রিন শেয়ার" : ""}
              </p>
            </div>
          )}

          {/* নিচের ভাসমান কন্ট্রোল বার */}
          <div
            className="absolute inset-x-0 bottom-0 px-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom,0px) + 22px)" }}
          >
            <div className="mx-auto flex max-w-sm items-center justify-between gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-3 backdrop-blur-xl">
              <CallCtl active={muted} onClick={toggleMute} label={muted ? "আনমিউট" : "মিউট"}>
                {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </CallCtl>
              {withVideo && (
                <CallCtl active={camOff} onClick={toggleCam} label="ক্যামেরা">
                  {camOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </CallCtl>
              )}
              {withVideo && (
                <CallCtl active={false} onClick={() => void triggerSwitchCamera()} label="বদল">
                  <SwitchCamera className="h-5 w-5" />
                </CallCtl>
              )}
              {withVideo && (
                <CallCtl active={sharing} onClick={() => void toggleShare()} label="শেয়ার">
                  {sharing ? <MonitorOff className="h-5 w-5 text-emerald-400" /> : <MonitorUp className="h-5 w-5" />}
                </CallCtl>
              )}

              <button
                onClick={hangUp}
                className="btn-press grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ff3b30] text-white shadow-[0_10px_24px_-10px_rgba(255,59,48,0.95)]"
                aria-label="কেটে দিন"
              >
                <PhoneOff className="h-5 w-5" />
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
    <button
      onClick={onClick}
      title={label}
      className={`btn-press grid h-12 w-12 shrink-0 place-items-center rounded-full transition ${
        active ? "bg-white text-[#0b1024]" : "bg-white/15 text-white"
      }`}
      aria-label={label}
    >
      {children}
    </button>
  );
}
