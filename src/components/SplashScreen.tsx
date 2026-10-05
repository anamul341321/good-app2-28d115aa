import { useEffect, useRef, useState } from "react";
import logo from "@/assets/goodapp-logo.png";

/**
 * Short, lightweight branded launch mark. Call and admin entry bypass it.
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
      // আলাদা "GoodApp Call" অ্যাপ থেকে খুললে কোনো অ্যানিমেশন নয়।
      if (sp.get("app") === "calls" || Boolean((window as any).GoodAppDownloader?.isCallsBuild?.())) {
        localStorage.setItem("goodapp_calls_app", "1");
        localStorage.setItem("goodapp_call_only_mode", "1");
      }
      const instant =
        localStorage.getItem("goodapp_calls_app") === "1" ||
        window.location.pathname.startsWith("/calls") ||
        window.location.pathname.startsWith("/callcenter") ||
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

    const safetyTimer = setTimeout(finish, 1050);

    return () => {
      clearTimeout(safetyTimer);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`ga-splash${leaving ? " ga-splash-out" : ""}`} aria-hidden="true">
      <style>{`
.ga-splash{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;overflow:hidden;background:hsl(var(--background));transition:opacity .2s ease;isolation:isolate}
.ga-splash-out{opacity:0;pointer-events:none}
.ga-splash-mark{display:flex;flex-direction:column;align-items:center;gap:12px;animation:ga-logo-arrive .7s cubic-bezier(.2,.8,.25,1) both}
.ga-splash-logo{width:76px;height:76px;border-radius:18px;box-shadow:0 16px 40px color-mix(in srgb,hsl(var(--primary)) 32%,transparent)}
.ga-splash-name{color:hsl(var(--foreground));font:800 20px/1.1 'Plus Jakarta Sans',sans-serif;letter-spacing:0}
@keyframes ga-logo-arrive{0%{opacity:0;transform:scale(.78) translateY(8px)}65%{opacity:1;transform:scale(1.05) translateY(0)}100%{opacity:1;transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.ga-splash{transition:none}.ga-splash-mark{animation:none}}
      `}</style>
      <div className="ga-splash-mark">
        <img className="ga-splash-logo" src={logo} alt="" />
        <span className="ga-splash-name">GoodApp</span>
      </div>
    </div>
  );
}
