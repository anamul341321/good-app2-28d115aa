import { useEffect, useRef, useState } from "react";
import introVideo from "@/assets/goodapp-logo-intro.mp4.asset.json";
import introVideoWebm from "@/assets/goodapp-logo-intro.webm.asset.json";

/**
 * Full-screen branded launch video. It plays once whenever the app starts,
 * then fades away to reveal the current screen.
 */

export function SplashScreen() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [needsSoundTap, setNeedsSoundTap] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
        Boolean((window as any).GoodAppBubble) ||
        sp.has("bubble") ||
        sp.has("call") ||
        sp.has("accept") ||
        sp.has("decline");
      if (instant) {
        setGone(true);
        return;
      }
    } catch { /* noop */ }

    let objectUrl: string | null = null;
    const controller = new AbortController();
    const probe = document.createElement("video");
    const selectedUrl = probe.canPlayType("video/webm; codecs=vp9")
      ? introVideoWebm.url
      : introVideo.url;
    void fetch(selectedUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Intro video could not be loaded");
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setVideoSource(objectUrl);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        finish();
      });

    // Safety net: a network or playback error must never trap the user.
    const safetyTimer = setTimeout(finish, 10_000);

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
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
      setNeedsSoundTap(true);
    });
  }, [videoSource]);

  const playWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = 1;
    void video.play().then(() => setNeedsSoundTap(false)).catch(finish);
  };

  if (gone) return null;

  return (
    <div className={`ga-splash${leaving ? " ga-splash-out" : ""}`} aria-hidden="true">
      <style>{`
.ga-splash{position:fixed;inset:0;z-index:9999;overflow:hidden;background:#0a1117;transition:opacity .35s ease}
.ga-splash-out{opacity:0;pointer-events:none}
.ga-splash-video{width:100%;height:100%;display:block;object-fit:contain;object-position:center}
.ga-splash-sound{position:absolute;inset:0;display:grid;place-items:center;border:0;background:rgba(10,17,23,.46);color:#fff;font:700 16px/1.2 system-ui;cursor:pointer}
.ga-splash-sound span{padding:12px 18px;border:1px solid rgba(255,255,255,.45);border-radius:999px;background:rgba(10,17,23,.78)}
@media (prefers-reduced-motion:reduce){.ga-splash{transition:none}}
      `}</style>
      {videoSource && (
        <video
          ref={videoRef}
          className="ga-splash-video"
          src={videoSource}
          autoPlay
          playsInline
          preload="auto"
          onEnded={finish}
          onError={finish}
        />
      )}
      {needsSoundTap && (
        <button className="ga-splash-sound" type="button" onClick={playWithSound}>
          <span>🔊 সাউন্ডসহ দেখতে ট্যাপ করুন</span>
        </button>
      )}
    </div>
  );
}
