import { PlayCircle } from "lucide-react";
import { isLiteBuild } from "@/lib/lite-build";

const VIDEO_URL = "https://youtu.be/gbUn9GdDvK8?si=TuIhMdVWVuW2rmOy";

export function VideoTutorialButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  // Play Store Lite build ships no external tutorial link.
  if (isLiteBuild()) return null;
  const compact = variant === "compact";
  return (
    <a
      href={VIDEO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`video-tutorial-btn relative overflow-hidden group flex items-center justify-center gap-2 rounded-2xl font-black text-white btn-press ${
        compact ? "px-3 py-2 text-[11px]" : "w-full px-4 py-3 text-sm"
      }`}
      style={{
        background: "linear-gradient(120deg,#ef4444 0%,#dc2626 40%,#b91c1c 100%)",
        boxShadow: "0 8px 24px -8px rgba(220,38,38,0.55)",
      }}
    >
      <span className="absolute inset-0 pointer-events-none video-tutorial-shine" />
      <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm">
        <PlayCircle className={`${compact ? "w-4 h-4" : "w-5 h-5"} text-white`} />
      </span>
      <span className="relative">📺 ভিডিও দেখুন — কিভাবে কাজ করে</span>
      <span className="relative ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/25 font-black">HD</span>
    </a>
  );
}
