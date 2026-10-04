import { useEffect, useRef, useState } from "react";
import introVideo from "@/assets/goodapp-logo-intro.mp4.asset.json";

/**
 * Full-screen branded launch video. It plays once whenever the app starts,
 * then fades away to reveal the current screen.
 */

export function SplashScreen() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const videoSource = introVideo.url;
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const finishing = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    setLeaving(true);
    finishTimer.current = setTimeout(() => setGone(true), 350);
  };

  useEffect(() => {
    // বাবল উইন্ডো বা কল রিসিভ/ডিক্লাইন থেকে খুললে কোনো ব্র্যান্ড অ্যানিমেশন দেখাব না —
    // সাথে সাথেই চ্যাট/কল স্ক্রিন দেখা যাবে (Messenger-এর মতো)।
    try {
      const sp = new URLSearchParams(window.location.search);
      const instant =
        window.location.pathname.startsWith("/admin") ||
        Boolean((window as any).GoodAppBubble) ||
        sp.has("bubble") ||
        sp.has("call") ||
        sp.has("supportCall") ||
        localStorage.getItem("ga_call_agent") === "1" ||
        window.location.pathname.startsWith("/chat/support") ||
        sp.has("accept") ||
        sp.has("decline");
      if (instant) {
        setGone(true);
        return;
      }
    } catch { /* noop */ }

    // Safety net: a network or playback error must never trap the user.
    const safetyTimer = setTimeout(finish, 10_000);

    return () => {
      clearTimeout(safetyTimer);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) return;

    video.muted = false;
    video.volume = 1;
    void video.play().then(() => setNeedsSoundTap(false)).catch(() => {
      // Mobile browsers require a real user gesture before playing sound.
      video.muted = true;
      void video.play().catch(finish);
      setNeedsSoundTap(true);
    });
  }, [videoSource]);

  const playWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    const backgroundVideo = backgroundVideoRef.current;
    video.currentTime = 0;
    if (backgroundVideo) {
      backgroundVideo.currentTime = 0;
      void backgroundVideo.play().catch(() => undefined);
    }
    video.muted = false;
    video.volume = 1;
    void video.play().then(() => setNeedsSoundTap(false)).catch(finish);
  };

  const syncBackdrop = () => {
    const video = videoRef.current;
    const backgroundVideo = backgroundVideoRef.current;
    if (!video || !backgroundVideo) return;
    if (Math.abs(backgroundVideo.currentTime - video.currentTime) > 0.12) {
      backgroundVideo.currentTime = video.currentTime;
    }
    void backgroundVideo.play().catch(() => undefined);
  };

  if (gone) return null;

  return (
    <div className={`ga-splash${leaving ? " ga-splash-out" : ""}`} aria-hidden="true">
      <style>{`
.ga-splash{position:fixed;inset:0;z-index:9999;overflow:hidden;background:hsl(var(--background));transition:opacity .35s ease;isolation:isolate}
.ga-splash-out{opacity:0;pointer-events:none}
.ga-splash-scene{position:absolute;inset:0;overflow:hidden;animation:ga-scene-arrive 1.15s cubic-bezier(.2,.75,.25,1) both}
.ga-splash-backdrop{position:absolute;inset:-5%;width:110%;height:110%;object-fit:cover;filter:blur(15px) saturate(1.08) brightness(.76);transform:scale(1.05)}
.ga-splash-shade{position:absolute;inset:0;background:linear-gradient(to bottom,color-mix(in srgb,hsl(var(--background)) 22%,transparent),transparent 28%,transparent 72%,color-mix(in srgb,hsl(var(--background)) 22%,transparent));pointer-events:none}
.ga-splash-stage{position:absolute;inset:0;display:grid;place-items:center;-webkit-mask-image:linear-gradient(to bottom,transparent 0%,#000 12%,#000 88%,transparent 100%);mask-image:linear-gradient(to bottom,transparent 0%,#000 12%,#000 88%,transparent 100%)}
.ga-splash-video{width:100%;height:100%;display:block;object-fit:contain;object-position:center;filter:saturate(1.03) contrast(1.02)}
.ga-splash-sound{position:absolute;inset:0;display:grid;place-items:center;border:0;background:color-mix(in srgb,hsl(var(--foreground)) 42%,transparent);color:hsl(var(--background));font:700 16px/1.2 system-ui;cursor:pointer}
.ga-splash-sound span{padding:12px 18px;border:1px solid color-mix(in srgb,hsl(var(--background)) 45%,transparent);border-radius:999px;background:color-mix(in srgb,hsl(var(--foreground)) 78%,transparent)}
@keyframes ga-scene-arrive{from{opacity:0;transform:scale(1.035)}to{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.ga-splash{transition:none}.ga-splash-scene{animation:none}}
      `}</style>
      {videoSource && (
        <div className="ga-splash-scene">
          <video
            ref={backgroundVideoRef}
            className="ga-splash-backdrop"
            src={videoSource}
            autoPlay
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="ga-splash-shade" />
          <div className="ga-splash-stage">
            <video
              ref={videoRef}
              className="ga-splash-video"
              src={videoSource}
              autoPlay
              playsInline
              preload="auto"
              onPlaying={syncBackdrop}
              onEnded={finish}
              onError={finish}
            />
          </div>
        </div>
      )}
      {needsSoundTap && (
        <button className="ga-splash-sound" type="button" onClick={playWithSound}>
          <span>🔊 সাউন্ডসহ দেখতে ট্যাপ করুন</span>
        </button>
      )}
    </div>
  );
}
