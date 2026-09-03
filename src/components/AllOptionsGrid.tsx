import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import {
  Wallet,
  ArrowDownToLine,
  BarChart3,
  RefreshCcw,
  Smartphone,
  Send,
  Gift,
  ShieldCheck,
  User,
  Settings,
  Camera,
  Newspaper,
  Clapperboard,
  Youtube,
  Coins,
  ChevronRight,

  type LucideIcon,
} from "lucide-react";

type Tile = {
  to: string;
  Icon: LucideIcon;
  bn: string;
  en: string;
  hintBn: string;
  hintEn: string;
  from: string;
  to2: string;
};

// Referral lives in its own dedicated nav button now, so it is intentionally
// not part of this grid.
const TILES: Tile[] = [
  { to: "/coins", Icon: Coins, bn: "আরও আয় করুন", en: "Earn More", hintBn: "কয়েন ওয়ালেট", hintEn: "Coin wallet", from: "#f59e0b", to2: "#ea580c" },
  { to: "/feed", Icon: Newspaper, bn: "নিউজ ফিড", en: "News Feed", hintBn: "পোস্ট · স্টোরি", hintEn: "Posts · stories", from: "#1877F2", to2: "#42a5f5" },
  { to: "/reels", Icon: Clapperboard, bn: "রিলস", en: "Reels", hintBn: "শর্ট ভিডিও", hintEn: "Short videos", from: "#e11d48", to2: "#f97316" },
  { to: "/studio", Icon: Youtube, bn: "ভিডিও", en: "Videos", hintBn: "ভিডিও আপলোড", hintEn: "Upload video", from: "#dc2626", to2: "#ef4444" },
  { to: "/wallet", Icon: Wallet, bn: "ওয়ালেট", en: "Wallet", hintBn: "bKash · Nagad নম্বর", hintEn: "bKash · Nagad number", from: "#f59e0b", to2: "#ef4444" },

  { to: "/withdraw", Icon: ArrowDownToLine, bn: "উইথড্র", en: "Withdraw", hintBn: "টাকা তুলুন", hintEn: "Cash out", from: "#f43f5e", to2: "#ec4899" },
  { to: "/earnings", Icon: BarChart3, bn: "আয়ের হিসাব", en: "Earnings", hintBn: "সম্পূর্ণ হিসাব", hintEn: "Full statement", from: "#10b981", to2: "#06b6d4" },
  { to: "/reverify", Icon: RefreshCcw, bn: "রি-ভেরিফাই", en: "Re-verify", hintBn: "৪ দিন পর", hintEn: "Every 4 days", from: "#06b6d4", to2: "#3b82f6" },
  { to: "/recharge", Icon: Smartphone, bn: "রিচার্জ", en: "Recharge", hintBn: "মোবাইল রিচার্জ", hintEn: "Mobile top-up", from: "#22c55e", to2: "#14b8a6" },
  { to: "/send", Icon: Send, bn: "সেন্ড", en: "Send", hintBn: "ব্যালেন্স পাঠান", hintEn: "Send balance", from: "#a855f7", to2: "#ec4899" },
  { to: "/offers", Icon: Gift, bn: "অফার", en: "Offers", hintBn: "বোনাস অফার", hintEn: "Bonus offers", from: "#ec4899", to2: "#f59e0b" },
  { to: "/task/1", Icon: Camera, bn: "ভেরিফাই", en: "Verify", hintBn: "নতুন স্লট", hintEn: "New slot", from: "#f97316", to2: "#facc15" },
  { to: "/kyc", Icon: ShieldCheck, bn: "কেওয়াইসি", en: "KYC", hintBn: "পরিচয় যাচাই", hintEn: "Identity check", from: "#6366f1", to2: "#8b5cf6" },
  { to: "/profile", Icon: User, bn: "প্রোফাইল", en: "Profile", hintBn: "আপনার তথ্য", hintEn: "Your details", from: "#0ea5e9", to2: "#14b8a6" },
  { to: "/settings", Icon: Settings, bn: "সেটিংস", en: "Settings", hintBn: "ভাষা · নিরাপত্তা", hintEn: "Language · security", from: "#64748b", to2: "#334155" },
];

/**
 * All-options launcher — real, tappable rows with clear icons, titles and a
 * one-line hint so users know exactly what each option does.
 */
export function AllOptionsGrid({ hideSocial }: { hideSocial?: boolean }) {
  const { t } = useLang();
  const tiles = hideSocial ? TILES.filter(t => !['/profile'].includes(t.to)) : TILES;

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map(({ to, Icon, bn, en, hintBn, hintEn, from, to2 }) => (
        <Link
          key={to}
          to={to as any}
          className="btn-press group flex items-center gap-2.5 rounded-2xl border border-border bg-surface-2/70 p-2.5 shadow-sm active:scale-[0.97] transition"
        >
          <span
            className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white shadow-lg"
            style={{ background: `linear-gradient(135deg,${from},${to2})` }}
          >
            <Icon className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-black text-navy leading-tight truncate">{t(bn, en)}</span>
            <span className="block text-[9.5px] font-bold text-muted-foreground leading-tight truncate">
              {t(hintBn, hintEn)}
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  );
}
