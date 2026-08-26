import { useState, useEffect } from "react";
import { Sparkles, X, ChevronRight, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import logo from "@/assets/goodapp-logo.png";

/** এই ভার্সনের ব্যানার একবার বন্ধ করলে আর দেখাবে না */
const VERSION_KEY = "new-update-banner-v1.29";

const FEATURES = [
  { icon: "💬", text: "মেসেজ এলে ভাসমান বাবল — অ্যাপ বন্ধ থাকলেও নোটিফিকেশন আসবে" },
  { icon: "🎵", text: "স্ক্রিন বন্ধ বা মিনিমাইজ করলেও গান/অডিও চলবে" },
  { icon: "🎬", text: "ইউটিউব স্টাইল মিনি-প্লেয়ার ও ফুল স্ক্রিন রোটেশন" },
  { icon: "🖼️", text: "নতুন লোগো ও ঝকঝকে নতুন ড্যাশবোর্ড ডিজাইন" },
  { icon: "🔒", text: "ফেস দিয়ে লগইন — সাথে পাসওয়ার্ড বাধ্যতামূলক, আরও নিরাপদ" },
];

/** নতুন আপডেটের ঘোষণা ব্যানার — পুরো স্ক্রিন জুড়ে, ক্লোজ বাটন সহ */
export function NewUpdateBanner() {
  const [closed, setClosed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(VERSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  // বডি স্ক্রল বন্ধ রাখবে যতক্ষণ ব্যানার খোলা
  useEffect(() => {
    if (closed || typeof document === "undefined") return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [closed]);

  if (closed) return null;

  const close = () => {
    setClosed(true);
    try {
      localStorage.setItem(VERSION_KEY, "1");
    } catch {
      /* no-op */
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-white/20 p-5 shadow-2xl ring-1 ring-cyan-400/25"
        style={{ background: "linear-gradient(150deg,#1e0b3a 0%,#2b1c74 45%,#0e7490 100%)" }}
      >
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_2.8s_linear_infinite]" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/30 blur-3xl" />

        <button
          type="button"
          onClick={close}
          aria-label="ব্যানার বন্ধ করুন"
          className="btn-press sticky top-0 ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative flex items-center gap-3 mt-1">
          <img src={logo} alt="গুড-অ্যাপ লোগো" className="h-14 w-14 rounded-2xl shadow-lg" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> নতুন আপডেট
            </p>
            <p className="mt-0.5 text-xl font-black leading-tight text-white">
              গুড-অ্যাপ{" "}
              <span className="text-amber-300" translate="no">
                v1.29
              </span>{" "}
              চলে এসেছে
            </p>
          </div>
        </div>

        <ul className="relative mt-5 space-y-2.5">
          {FEATURES.map((f) => (
            <li
              key={f.text}
              className="flex items-start gap-3 rounded-2xl bg-white/5 p-3 text-[13px] font-semibold leading-snug text-white/90"
            >
              <span className="shrink-0 text-lg">{f.icon}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        <div className="relative mt-5 flex items-center gap-2">
          <Link
            to="/settings"
            className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3.5 text-[13px] font-black text-white shadow-lg"
            style={{ background: "linear-gradient(100deg,#f59e0b,#ef4444 50%,#a855f7 100%)" }}
          >
            <Download className="h-4 w-4" /> নতুন ভার্সন নিন
          </Link>
          <button
            type="button"
            onClick={close}
            className="btn-press flex items-center gap-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3.5 text-[12px] font-bold text-white/80"
          >
            বুঝেছি <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
