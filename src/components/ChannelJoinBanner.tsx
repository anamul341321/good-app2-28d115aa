import { Youtube, Send } from "lucide-react";

export const YOUTUBE_URL = "https://youtube.com/@cryptocourse34?si=FBiehWSY0sU-yxRq";
export const TELEGRAM_CHANNEL_URL = "https://t.me/goodappofficials";

/** ইউটিউব ও টেলিগ্রাম চ্যানেলে যুক্ত হওয়ার ব্যানার — 2K হলে বোনাস চালু হবে। */
export function ChannelJoinBanner() {
  return (
    <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card p-4 shadow-sm">
      <p className="text-sm font-black">🎁 2K হলেই বোনাস চালু!</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        আমাদের YouTube ও Telegram চ্যানেলে 2,000 সাবস্ক্রাইবার/মেম্বার পূর্ণ হলেই রেফার বোনাস ও রি-ভেরিফাই বোনাস চালু হবে। এখনই যুক্ত হোন, বন্ধুদেরও বলুন।
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a href={YOUTUBE_URL} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-full bg-destructive px-3 py-2.5 text-xs font-black text-destructive-foreground shadow active:scale-95 transition">
          <Youtube className="h-4 w-4" /> Subscribe
        </a>
        <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2.5 text-xs font-black text-primary-foreground shadow active:scale-95 transition">
          <Send className="h-4 w-4" /> Join করুন
        </a>
      </div>
    </div>
  );
}
