import { ExternalLink, Smartphone } from "lucide-react";
import { useLang } from "@/lib/i18n";

/**
 * Placeholder shown in the Play Store Lite build when a user navigates to
 * a financial route (withdraw, send, recharge). It explains the feature is
 * only available on the full website and offers an "Open in browser" button.
 */
const WEBSITE_ORIGIN = "https://goodapp2.live";

export function LiteFeatureBlock({ title }: { title?: string }) {
  const { t } = useLang();
  const site = WEBSITE_ORIGIN;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-6 text-center space-y-4 border border-amber/30 shadow-[0_20px_50px_-20px_rgba(245,158,11,0.4)]">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber/15 border border-amber/30 flex items-center justify-center">
          <Smartphone className="w-8 h-8 text-amber" />
        </div>
        <h1 className="text-lg font-black text-navy">
          {title || t("এই ফিচারটি এখানে নেই", "This feature is not available here")}
        </h1>
        <p className="text-xs text-muted-foreground font-bold leading-relaxed">
          {t(
            "Play Store নিয়ম অনুযায়ী এ অ্যাপে উইথড্র, সেন্ড মানি ও মোবাইল রিচার্জ রাখা যায় না। এই সুবিধাগুলো পেতে নিচের বাটনে ক্লিক করে আমাদের ওয়েবসাইটে খুলুন।",
            "Due to Play Store policy, withdraw, send money and mobile recharge are not included in this app. Please use our website for these features."
          )}
        </p>
        <a
          href={site}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full rounded-xl gradient-cta px-4 py-3 text-sm font-black text-white btn-press"
        >
          <ExternalLink className="w-4 h-4" />
          {t("ওয়েবসাইটে খুলুন", "Open in browser")}
        </a>
        <p className="text-[10px] text-muted-foreground">
          {t("ঠিকানা:", "URL:")} <span className="mono-num" translate="no">{site.replace(/^https?:\/\//, "")}</span>
        </p>
      </div>
    </div>
  );
}
