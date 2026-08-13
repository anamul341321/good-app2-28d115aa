import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, PhoneCall, Video } from "lucide-react";
import { getUnreadMessageCount } from "@/lib/chat.functions";

/**
 * হোম পেজের কল ও মেসেজ কার্ড — নতুন মেসেজ থাকলে পুরো কার্ড লাল হয়ে
 * জ্বলবে, সিন করলে আবার স্বাভাবিক হয়ে যাবে।
 */
export function ChatCallCard() {
  const { data } = useQuery({
    queryKey: ["unread-msgs"],
    queryFn: () => getUnreadMessageCount(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });
  const unread = data?.unread ?? 0;
  const hot = unread > 0;

  return (
    <Link
      to="/chat"
      className={`btn-press relative block overflow-hidden rounded-2xl p-3.5 shadow-lg ring-2 transition-colors ${
        hot ? "ring-rose-500 animate-pulse" : "ring-emerald-400/40"
      }`}
      style={{
        background: hot
          ? "linear-gradient(120deg,#e11d48,#fb7185)"
          : "linear-gradient(120deg,#0f766e,#10b981)",
      }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/15 text-white">
          <MessageCircle className="h-6 w-6" />
          {hot && (
            <span className="absolute -right-1 -top-1 grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-[11px] font-black text-rose-600 shadow">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">
            {hot ? `${unread}টি নতুন মেসেজ 💬` : "মেসেজ, অডিও ও ভিডিও কল"}
          </span>
          <span className="block truncate text-[11px] font-bold text-white/90">
            {hot ? "ট্যাপ করে দেখুন — সিন করলে লাল চলে যাবে" : "বন্ধুর সাথে ফ্রি কথা বলুন — একদম ক্লিয়ার"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-white">
          <PhoneCall className="h-5 w-5" />
          <Video className="h-5 w-5" />
        </span>
      </div>
    </Link>
  );
}
