import { useEffect, useState } from "react";
import brandLogo from "@/assets/goodapp-logo.png";

/**
 * Branded launch animation. Rendered during SSR too, so users never see a raw
 * white screen while the app boots. Fades out as soon as the page is ready:
 * fast connections get a short, light animation; slow ones see the full loader.
 */
const SESSION_KEY = "__goodapp_splash_shown";
const SOUND_KEY = "goodapp_splash_sound";

function playChime() {
  try {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(SOUND_KEY) === "off") return;
    const Ctx: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") { void ctx.resume(); }
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);

    // soft rising 3-note brand chime
    [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.11 },
      { f: 987.77, t: 0.22 },
    ].forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.9, now + t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.7);
      osc.connect(g);
      g.connect(master);
      osc.start(now + t);
      osc.stop(now + t + 0.8);
    });
    setTimeout(() => { void ctx.close().catch(() => {}); }, 1600);
  } catch {
    /* audio blocked — silent boot */
  }
}

export function SplashScreen() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

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
        try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
        setGone(true);
        return;
      }
    } catch { /* noop */ }

    let repeat = false;
    try { repeat = sessionStorage.getItem(SESSION_KEY) === "1"; } catch { /* noop */ }
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }

    // Fast path: already booted once this session → barely-there flash.
    const minMs = repeat ? 260 : 950;
    if (!repeat) playChime();

    const start = Date.now();
    let hideTimer: ReturnType<typeof setTimeout>;
    let doneTimer: ReturnType<typeof setTimeout>;

    const finish = () => {
      const wait = Math.max(0, minMs - (Date.now() - start));
      hideTimer = setTimeout(() => {
        setLeaving(true);
        doneTimer = setTimeout(() => setGone(true), 420);
      }, wait);
    };

    if (document.readyState === "complete") finish();
    else {
      window.addEventListener("load", finish, { once: true });
      // safety net: never trap the user behind the splash
      hideTimer = setTimeout(finish, 4000);
    }

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
      window.removeEventListener("load", finish);
    };
  }, []);

  if (gone) return null;

  return (
    <div className={`ga-splash${leaving ? " ga-splash-out" : ""}`} aria-hidden="true">
      <style>{`
.ga-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;
background:radial-gradient(120% 90% at 50% 0%,oklch(0.32 0.16 300) 0%,oklch(0.16 0.08 290) 45%,oklch(0.08 0.03 280) 100%);
transition:opacity .4s ease,transform .4s ease;}
.ga-splash-out{opacity:0;transform:scale(1.04);pointer-events:none}
.ga-splash::after{content:"";position:absolute;inset:-30%;background:conic-gradient(from 0deg,transparent,oklch(0.7 0.2 320/.22),transparent 55%);animation:ga-sweep 3.2s linear infinite}
.ga-mark{position:relative;width:112px;height:112px;display:grid;place-items:center;animation:ga-pop .7s cubic-bezier(.2,1.4,.4,1) both}
.ga-mark-ring{position:absolute;inset:0;border-radius:999px;border:2px solid oklch(0.75 0.2 320/.5);border-top-color:transparent;animation:ga-spin 1.1s linear infinite}
.ga-mark-ring.two{inset:10px;border:2px solid oklch(0.85 0.16 200/.45);border-bottom-color:transparent;animation-direction:reverse;animation-duration:1.7s}
.ga-mark-core{width:84px;height:84px;border-radius:24px;display:block;object-fit:cover;
 box-shadow:0 12px 40px oklch(0.6 0.24 300/.55);animation:ga-breathe 1.8s ease-in-out infinite}
.ga-title{font-size:26px;font-weight:900;color:#fff;letter-spacing:.4px;position:relative;z-index:1;
background:linear-gradient(90deg,#fff,oklch(0.85 0.16 320),#fff);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:ga-shine 2.2s linear infinite}
.ga-sub{font-size:13px;color:oklch(0.9 0.02 300/.7);z-index:1}
.ga-bar{position:relative;z-index:1;width:170px;height:5px;border-radius:99px;overflow:hidden;background:oklch(1 0 0/.12)}
.ga-bar i{position:absolute;inset:0;width:45%;border-radius:99px;background:linear-gradient(90deg,oklch(0.7 0.22 300),oklch(0.85 0.16 200));animation:ga-slide 1.1s ease-in-out infinite}
@keyframes ga-spin{to{transform:rotate(360deg)}}
@keyframes ga-sweep{to{transform:rotate(360deg)}}
@keyframes ga-pop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
@keyframes ga-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
@keyframes ga-shine{to{background-position:-200% 0}}
@keyframes ga-slide{0%{left:-45%}100%{left:100%}}
@media (prefers-reduced-motion:reduce){.ga-splash *,.ga-splash::after{animation:none!important}}
      `}</style>
      <div className="ga-mark">
        <span className="ga-mark-ring" />
        <span className="ga-mark-ring two" />
        <span className="ga-mark-core">G</span>
      </div>
      <div className="ga-title">Good-App</div>
      <div className="ga-sub">লোড হচ্ছে, একটু অপেক্ষা করুন…</div>
      <div className="ga-bar"><i /></div>
    </div>
  );
}
