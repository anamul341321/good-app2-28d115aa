import { MessageCircle, Info } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { TELEGRAM_GROUP_URL } from "@/lib/coins";

/**
 * Shown in the Play Store build when a user opens a screen that is not part of
 * this app version. No external app link and no payment/withdrawal wording —
 * only a friendly note plus our Telegram support group for help.
 */
export function LiteFeatureBlock({ title }: { title?: string }) {
  const { t } = useLang();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-6 text-center space-y-4 border border-border shadow-xl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center">
          <Info className="w-8 h-8 text-cyan" />
        </div>
        <h1 className="text-lg font-black text-navy">
          {title
            ? t(`${title} — এই সংস্করণে নেই`, `${title} — not in this version`)
            : t("এই অংশটি এই সংস্করণে নেই", "This section is not in this version")}
        </h1>
        <p className="text-xs text-muted-foreground font-bold leading-relaxed">
          {t(
            "এই অ্যাপ সংস্করণে মেসেঞ্জার, রিলস, প্রোফাইল, ভেরিফিকেশন ও রিওয়ার্ড ফিচারগুলো আছে। কোনো প্রশ্ন বা সাহায্যের দরকার হলে আমাদের সাপোর্ট গ্রুপে মেসেজ দিন — দ্রুত উত্তর পাবেন।",
            "This app version includes messenger, reels, profile, verification and reward features. If you need any help, message our support group — we reply quickly.",
          )}
        </p>
        <a
          href={TELEGRAM_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl px-4 py-3 text-sm font-black text-white btn-press"
          style={{ background: "linear-gradient(120deg,#0088cc,#06b6d4)" }}
        >
          <MessageCircle className="w-4 h-4" />
          {t("সাপোর্টে মেসেজ দিন", "Message support")}
        </a>
        <Link
          to="/home"
          className="block text-[11px] font-black text-muted-foreground btn-press"
        >
          {t("← হোমে ফিরে যান", "← Back to home")}
        </Link>
      </div>
    </div>
  );
}
