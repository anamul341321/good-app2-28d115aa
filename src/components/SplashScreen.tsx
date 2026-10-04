import { useEffect, useRef, useState } from "react";
import introVideo from "@/assets/goodapp-logo-intro.mp4.asset.json";

/**
 * Full-screen branded launch video. It plays once whenever the app starts,
 * then fades away to reveal the current screen.
 */

export function SplashScreen() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);
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

    // Safety net: a network or playback error must never trap the user.
    const safetyTimer = setTimeout(finish, 10_000);

    return () => {
      clearTimeout(safetyTimer);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`ga-splash${leaving ? " ga-splash-out" : ""}`} aria-hidden="true">
      <style>{`
.ga-splash{position:fixed;inset:0;z-index:9999;overflow:hidden;background:#0a1117;transition:opacity .35s ease}
.ga-splash-out{opacity:0;pointer-events:none}
.ga-splash-video{width:100%;height:100%;display:block;object-fit:cover;object-position:center}
@media (prefers-reduced-motion:reduce){.ga-splash{transition:none}}
      `}</style>
      <video
        className="ga-splash-video"
        src={introVideo.url}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}
