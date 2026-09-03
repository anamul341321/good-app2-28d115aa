import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift, Sparkles, Lock, Crown, MessageCircle, ShieldCheck, Users, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { DashSection } from "@/components/DashSection";
import { AllOptionsGrid } from "@/components/AllOptionsGrid";
import { Leaderboards } from "@/components/Leaderboards";
import { ReferralCommissionCard } from "@/components/ReferralCommissionCard";
import { PaymentHistoryCard } from "@/components/PaymentHistoryCard";
import { ComplianceDisclaimer } from "@/components/ComplianceDisclaimer";

import { ApkDownloadCard } from "@/components/ApkDownloadCard";
import { BotStartButton } from "@/components/BotStartButton";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { TourReplayButton } from "@/components/GuidedTour";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";

export const Route = createFileRoute("/_authenticated/menu")({
  component: MenuPage,
  head: () => ({
    meta: [
      { title: "মেনু · সব ফিচার — good-app" },
      { name: "description", content: "good-app-এর সব অপশন এক জায়গায় — বোনাস অফার, সেন্ড ব্যালেন্স, মোবাইল রিচার্জ, রেফার, লিডারবোর্ড, সাপোর্ট ও নিয়ম-কানুন।" },
      { property: "og:title", content: "মেনু · সব ফিচার — good-app" },
      { property: "og:description", content: "বোনাস অফার, সেন্ড, রিচার্জ, রেফার, লিডারবোর্ড ও সাপোর্ট — সব এক মেনুতে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MenuPage() {
  const { t } = useLang();
  const lite = isLiteBuild();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    staleTime: 30_000,
  });
  const b = (data as any)?.bonus;
  const bonusTotal = b ? Number(b.pendingAmount ?? b.totalAmount ?? 0) : 0;
  const bonusOn = b?.rates?.bonus_enabled !== false;
  const hasUnclaimed = bonusOn && b && !(b.selfFirstPaid && b.referrerPaid && b.userReverifyPaid);
  const rechargeOn = (data as any)?.payoutSettings?.rechargeEnabled !== false;

  return (
    <div className="space-y-4 pt-1 pb-6">
      <div className="text-center">
        <h1 className="text-lg font-black text-navy">{t("মেনু", "Menu")}</h1>
        <p className="text-[11px] text-muted-foreground font-bold">
          {t("সব ফিচার আলাদা আলাদা ভাগে সাজানো", "Every feature, neatly grouped")}
        </p>
      </div>

      <DashSection
        icon={<Users className="w-4 h-4" />}
        tint="violet"
        title={t("সব অপশন", "All Options")}
        subtitle={t("এক ট্যাপে যেকোনো সেকশনে যান", "Jump to any section in one tap")}
      >
        <AllOptionsGrid hideSocial />
      </DashSection>

      <DashSection
        icon={<Gift className="w-4 h-4" />}
        tint="rose"
        title={t("অফার ও দ্রুত কাজ", "Offers & Quick Actions")}
        subtitle={lite ? t("বোনাস · রেফার · রি-ভেরিফাই", "Bonus · Refer · Re-verify") : t("বোনাস · সেন্ড ব্যালেন্স · মোবাইল রিচার্জ", "Bonus · Send balance · Mobile recharge")}
      >
        <Link to="/offers"
          className="block rounded-3xl p-4 relative overflow-hidden shadow-[0_20px_45px_-20px_rgba(236,72,153,0.6)] btn-press border border-white/20"
          style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 55%,#f59e0b 100%)" }}>
          {!lite && hasUnclaimed && (
            <span className="absolute top-2.5 right-2.5 text-[10px] font-black bg-white text-rose px-2.5 py-1 rounded-full shadow-lg animate-pulse" translate="no">
              🎯 {bonusTotal}৳ {t("পেন্ডিং", "pending")}
            </span>
          )}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-3 text-white relative">
            <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur border border-white/40 flex items-center justify-center text-3xl shadow-lg shrink-0">🎁</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-95 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Special Offers
              </p>
              <p className="text-lg font-black leading-tight drop-shadow mt-0.5">{t("সকল বোনাস অফার", "All Bonus Offers")}</p>
              <p className="text-[11px] opacity-95 font-bold mt-0.5">{t("স্পেশাল প্রোমো · রেফার · রি-ভেরিফাই", "Special Promo · Refer · Re-verify")}</p>
            </div>
            <span className="text-3xl opacity-90 font-black">›</span>
          </div>
        </Link>

        {!lite && (
          <div className="grid grid-cols-2 gap-3">
            <Link to="/send"
              className="rounded-3xl p-4 btn-press flex flex-col items-start gap-2 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(124,58,237,0.55)] text-white border border-white/20"
              style={{ background: "linear-gradient(135deg,#7c3aed,#ec4899)" }}>
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
              <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-2xl shrink-0 relative">💸</div>
              <div className="min-w-0 relative">
                <p className="text-base font-black leading-tight">{t("সেন্ড ব্যালেন্স", "Send Balance")}</p>
                <p className="text-[11px] opacity-95 font-bold mt-0.5" translate="no">{t("সর্বনিম্ন ১৫৳", "Min 15৳")}</p>
              </div>
            </Link>

            <Link to="/history"
              className="rounded-3xl p-4 btn-press flex flex-col items-start gap-2 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(124,58,237,0.55)] text-white border border-white/20"
              style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}>
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
              <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-2xl shrink-0 relative">🧾</div>
              <div className="min-w-0 relative">
                <p className="text-base font-black leading-tight">{t("সব ইতিহাস", "All History")}</p>
                <p className="text-[11px] opacity-95 font-bold mt-0.5">{t("রিচার্জ · কার্ড · উইথড্র", "Recharge · Card · Withdraw")}</p>
              </div>
            </Link>


            {rechargeOn ? (
              <Link to="/recharge"
                className="rounded-3xl p-4 btn-press flex flex-col items-start gap-2 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(6,182,212,0.55)] text-white border border-white/20"
                style={{ background: "linear-gradient(135deg,#06b6d4,#10b981)" }}>
                <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/15 blur-xl" />
                <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center text-2xl shrink-0 relative">📱</div>
                <div className="min-w-0 relative">
                  <p className="text-base font-black leading-tight">{t("মোবাইল রিচার্জ", "Mobile Recharge")}</p>
                  <p className="text-[11px] opacity-95 font-bold mt-0.5" translate="no">{t("সর্বনিম্ন ২০৳", "Min 20৳")}</p>
                </div>
              </Link>
            ) : (
              <div className="rounded-3xl p-4 bg-surface-2 border-2 border-dashed border-border opacity-70 flex flex-col items-start gap-2">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center"><Lock className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <p className="text-base font-black leading-tight">{t("রিচার্জ বন্ধ", "Recharge off")}</p>
                  <p className="text-[11px] text-muted-foreground font-bold">{t("সাময়িক", "Temporary")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {lite && (
          <a
            href="https://t.me/goodappbuy"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-3xl p-4 relative overflow-hidden shadow-[0_15px_35px_-15px_rgba(6,182,212,0.55)] btn-press border border-white/20"
            style={{ background: "linear-gradient(135deg,#0088cc,#06b6d4)" }}
          >
            <div className="flex items-center gap-3 text-white relative">
              <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-black leading-tight">{t("সাপোর্ট গ্রুপ", "Support group")}</p>
                <p className="text-[11px] opacity-95 font-bold mt-0.5">{t("যেকোনো প্রশ্ন? গ্রুপে মেসেজ দিন — দ্রুত সাহায্য", "Any question? Message the group — quick help")}</p>
              </div>
              <ExternalLink className="w-5 h-5 shrink-0" />
            </div>
          </a>
        )}

        {!lite && <ReferralCommissionCard />}
      </DashSection>

      <DashSection
        icon={<Crown className="w-4 h-4" />}
        tint="emerald"
        title={t("লিডারবোর্ড", "Leaderboard")}
        subtitle={t("সেরা ইউজারদের তালিকা", "Top performing users")}
      >
        <Leaderboards />
      </DashSection>

      {!lite && (
      <DashSection
        icon={<Sparkles className="w-4 h-4" />}
        tint="rose"
        title={t("পেমেন্ট হিস্টরি", "Payment History")}
        subtitle={t("কে কত টাকা পেয়েছেন — লাইভ", "Who got paid, live")}
      >
        <PaymentHistoryCard />
        <ComplianceDisclaimer />
      </DashSection>
      )}


      <DashSection
        icon={<MessageCircle className="w-4 h-4" />}
        tint="cyan"
        title={t("তথ্য, সাপোর্ট ও অ্যাপ", "Info, Support & App")}
        subtitle={t("সাহায্য · টিউটোরিয়াল · নিয়ম-কানুন", "Help · Tutorial · Policies")}
      >
        <a href="https://t.me/goodappbuy" target="_blank" rel="noopener noreferrer"
           className="block rounded-2xl p-3.5 text-center shadow-md btn-press"
           style={{ background: "linear-gradient(120deg,#0088cc,#06b6d4)" }}>
          <p className="text-sm font-black text-white flex items-center justify-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> {t("টেলিগ্রাম সাপোর্ট", "Telegram Support")}
          </p>
          <p className="text-[11px] text-white/90 mt-0.5">{t("গ্রুপে মেসেজ দিন — দ্রুত সাহায্য পাবেন", "Message the group — quick help")}</p>
        </a>
        <BotStartButton />
        {!lite && <ApkDownloadCard />}

        <div className="text-center py-1 space-y-3">
          <VideoTutorialButton />
          <p className="text-[11px] text-muted-foreground italic">
            🌸 "হাজার জনের সহযোগিতা, একজনের হাসি" 🌸
          </p>
          <TourReplayButton />
        </div>

        <div className="glass rounded-2xl p-3">
          <p className="text-[10px] font-black text-muted-foreground mb-2 text-center">{t("আইন ও নিরাপত্তা", "Legal & Safety")}</p>
          <div className="grid grid-cols-3 gap-2">
            <Link to="/privacy" className="btn-press flex flex-col items-center gap-1 rounded-xl bg-surface-2 border border-border py-2.5 text-[10px] font-black">
              <Lock className="w-4 h-4 text-cyan" /> {t("প্রাইভেসি", "Privacy")}
            </Link>
            <Link to="/terms" className="btn-press flex flex-col items-center gap-1 rounded-xl bg-surface-2 border border-border py-2.5 text-[10px] font-black">
              <ShieldCheck className="w-4 h-4 text-amber" /> {t("শর্তাবলি", "Terms")}
            </Link>
            <Link to="/settings" className="btn-press flex flex-col items-center gap-1 rounded-xl bg-surface-2 border border-border py-2.5 text-[10px] font-black">
              <Sparkles className="w-4 h-4 text-violet-400" /> {t("সেটিংস", "Settings")}
            </Link>
            <Link to="/rates" className="btn-press col-span-3 flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-[11px] font-black text-emerald-300">
              🌍 {t("দেশভিত্তিক মাইনিং রেট ও রেফার বোনাস", "Country mining rates & referral bonus")}
            </Link>
            <Link to="/rules" className="btn-press col-span-3 flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 border border-border py-2.5 text-[11px] font-black">
              📘 {t("সব নিয়ম", "All rules")}
            </Link>
          </div>

        </div>
      </DashSection>
    </div>
  );
}
