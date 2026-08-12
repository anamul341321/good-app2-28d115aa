import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";

type Tile = {
  to: string;
  emoji: string;
  bn: string;
  en: string;
  from: string;
  to2: string;
};

const TILES: Tile[] = [
  { to: "/wallet", emoji: "👛", bn: "ওয়ালেট", en: "Wallet", from: "#f59e0b", to2: "#ef4444" },
  { to: "/withdraw", emoji: "🏧", bn: "উইথড্র", en: "Withdraw", from: "#f43f5e", to2: "#ec4899" },
  { to: "/earnings", emoji: "📊", bn: "আয়ের হিসাব", en: "Earnings", from: "#10b981", to2: "#06b6d4" },
  { to: "/referral", emoji: "🎯", bn: "রেফার", en: "Refer", from: "#8b5cf6", to2: "#6366f1" },
  { to: "/reverify", emoji: "🔄", bn: "রি-ভেরিফাই", en: "Re-verify", from: "#06b6d4", to2: "#3b82f6" },
  { to: "/recharge", emoji: "📱", bn: "রিচার্জ", en: "Recharge", from: "#22c55e", to2: "#14b8a6" },
  { to: "/send", emoji: "💸", bn: "সেন্ড", en: "Send", from: "#a855f7", to2: "#ec4899" },
  { to: "/offers", emoji: "🎁", bn: "অফার", en: "Offers", from: "#ec4899", to2: "#f59e0b" },
  { to: "/kyc", emoji: "🛡️", bn: "কেওয়াইসি", en: "KYC", from: "#6366f1", to2: "#8b5cf6" },
  { to: "/profile", emoji: "👤", bn: "প্রোফাইল", en: "Profile", from: "#0ea5e9", to2: "#14b8a6" },
  { to: "/settings", emoji: "⚙️", bn: "সেটিংস", en: "Settings", from: "#64748b", to2: "#334155" },
  { to: "/task/1", emoji: "📷", bn: "ভেরিফাই", en: "Verify", from: "#f97316", to2: "#facc15" },
];

/**
 * All-options launcher grid — every feature of the app gets its own tile so
 * users can find each section from one place instead of hunting the feed.
 */
export function AllOptionsGrid() {
  const { t } = useLang();
  return (
    <div className="grid grid-cols-4 gap-2.5">
      {TILES.map((tile) => (
        <Link
          key={tile.to}
          to={tile.to as any}
          className="btn-press group flex flex-col items-center gap-1.5 rounded-2xl bg-surface-2/70 border border-border p-2 pt-2.5 text-center"
        >
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl text-white shadow-lg"
            style={{ background: `linear-gradient(135deg,${tile.from},${tile.to2})` }}
          >
            {tile.emoji}
          </span>
          <span className="text-[9.5px] font-black text-navy leading-tight">{t(tile.bn, tile.en)}</span>
        </Link>
      ))}
    </div>
  );
}
