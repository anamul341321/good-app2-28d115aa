import { Link, useRouterState } from "@tanstack/react-router";
import { MessageCircle, Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * মেসেঞ্জার ↔ ফেসবুক (নিউজ ফিড) — দুইটি বাটন সব সোশ্যাল পেজের একদম উপরে
 * সব সময় দেখা যাবে, তাই ইউজার এক ট্যাপে দুই সেকশনে যেতে পারবে।
 */
export function SocialSwitch({ active, className }: { active?: "messenger" | "facebook"; className?: string }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = active ?? (path.startsWith("/chat") ? "messenger" : "facebook");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Link
        to="/chat"
        className={cn(
          "btn-press flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-black transition active:scale-95",
          current === "messenger"
            ? "text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.9)] bg-gradient-to-r from-violet-600 via-blue-600 to-sky-500"
            : "bg-surface-2 text-foreground/80 border border-border/60",
        )}
      >
        <MessageCircle className="h-4 w-4" /> Messenger
      </Link>
      <Link
        to="/feed"
        className={cn(
          "btn-press flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-black transition active:scale-95",
          current === "facebook"
            ? "text-white shadow-[0_8px_20px_-8px_rgba(219,39,119,0.9)] bg-gradient-to-r from-blue-600 via-indigo-600 to-pink-600"
            : "bg-surface-2 text-foreground/80 border border-border/60",
        )}
      >
        <Newspaper className="h-4 w-4" /> Facebook
      </Link>
    </div>
  );
}
