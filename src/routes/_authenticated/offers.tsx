import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { PromoBanner } from "@/components/PromoBanner";
import { QrCode } from "@/components/QrCode";
import bonusGirl from "@/assets/bonus-girl.png";
import { ArrowLeft, Crown, Lock, Copy, Share2, Sparkles, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";

export const Route = createFileRoute("/_authenticated/offers")({ component: () => isLiteBuild() ? <Navigate to="/home" /> : <OffersPage /> });

function OffersPage() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  if (!data) return <div className="py-10 text-center text-sm text-muted-foreground">{t("লোড হচ্ছে…", "Loading…")}</div>;

  const b = (data as any).bonus;
  const referralLock = (data as any).referralLock as { unlocked: boolean; firstVerifies: number; needed: number } | undefined;
  const referralUnlocked = referralLock?.unlocked === true;
  const refCode: string | undefined = (data.profile as any)?.referral_code;
  const shareUrl = refCode && referralUnlocked
    ? `${typeof window !== "undefined" ? window.location.origin : "https://good-app2.lovable.app"}/?ref=${refCode}`
    : "";
  const firstPct = b ? Math.min(100, Math.round((b.firstVerifyCount / 10) * 100)) : 0;
  const reverifyPct = b ? Math.min(100, Math.round((b.reverifyCount / 10) * 100)) : 0;
  const total = b ? Number(b.totalAmount ?? (b.selfFirstAmount + b.referrerAmount + b.userAmount)) : 0;
  const rechargeOn = (data as any).payoutSettings?.rechargeEnabled !== false;

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link to="/home" className="w-9 h-9 rounded-xl bg-surface-2 border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-amber">Special Offers</p>
          <h1 className="text-lg font-black">🎁 {t("সকল বোনাস অফার", "All Bonus Offers")}</h1>
        </div>
      </div>

      {/* 2X Promo */}
      <PromoBanner rates={(data as any)?.bonus?.rates ?? null} />

      {/* Premium referral-bonus */}
      {b && b.rates?.bonus_enabled !== false && !(b.selfFirstPaid && b.referrerPaid && b.userReverifyPaid) && (
        <div className="referral-bonus-banner rounded-3xl p-4 relative overflow-hidden text-white shadow-[0_20px_50px_-15px_rgba(139,92,246,0.6)]">
          <div className="referral-bonus-shimmer" />
          <div className="referral-bonus-sparkle" />
          <div className="relative flex items-start gap-3">
            <img src={bonusGirl} alt="Bonus" width={92} height={92}
              className="w-[92px] h-[92px] drop-shadow-2xl -mt-1 animate-bounce shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[9px] uppercase tracking-[0.25em] font-black text-white/95 flex items-center gap-1">
                <Crown className="w-3 h-3" /> Premium Bonus
              </p>
              <p className="text-[26px] font-black leading-none mt-0.5 drop-shadow-lg" translate="no">
                {total}৳ <span className="text-xs font-bold">{t("ইনস্ট্যান্ট!", "Instant!")}</span>
              </p>
              <p className="text-[11px] text-white/95 leading-snug mt-1 font-bold">
                🎯 {Number(b.selfFirstAmount) > 0 ? <>{t("First verify", "First verify")} <b translate="no">{b.selfFirstAmount}৳</b> · </> : null}Re-verify <b translate="no">{b.userAmount}৳</b> · {t("বন্ধু আনলে", "Bring a friend")} <b translate="no">{b.referrerAmount}৳</b>
              </p>

            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
              <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">✅ First</p>
              <p className="text-[11px] font-black mt-0.5 leading-tight">{t("১০ Verify", "10 Verify")} → <span className="text-amber-200" translate="no">{b.selfFirstAmount}৳</span></p>
              <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-amber-300" style={{ width: `${firstPct}%` }} />
              </div>
              <p className="text-[9px] mt-0.5 font-bold">{b.selfFirstPaid ? t("✅ পেয়ে গেছেন", "✅ Received") : `${b.firstVerifyCount}/10`}</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
              <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">🔄 Re-verify</p>
              <p className="text-[11px] font-black mt-0.5 leading-tight">{t("১০ Re-verify", "10 Re-verify")} → <span className="text-amber-200" translate="no">{b.userAmount}৳</span></p>
              <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-amber-300" style={{ width: `${reverifyPct}%` }} />
              </div>
              <p className="text-[9px] mt-0.5 font-bold">{b.userReverifyPaid ? t("✅ পেয়ে গেছেন", "✅ Received") : `${b.reverifyCount}/10`}</p>
            </div>
            <div className="rounded-xl bg-white/15 backdrop-blur border border-white/25 p-2">
              <p className="text-[9px] font-black text-white/90 uppercase tracking-wider">👥 Refer</p>
              <p className="text-[11px] font-black mt-0.5 leading-tight">{t("বন্ধু ১০ verify", "Friend 10 verify")} → <span className="text-amber-200" translate="no">{b.referrerAmount}৳</span></p>
              <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-amber-300" style={{ width: `${firstPct}%` }} />
              </div>
              <p className="text-[9px] mt-0.5 font-bold">{b.referrerPaid ? t("✅ Referrer পেয়েছেন", "✅ Referrer received") : t("বন্ধু আনুন", "Invite friends")}</p>
            </div>
          </div>

          {refCode && referralUnlocked ? (
            <div className="relative mt-3 rounded-2xl bg-white p-3 flex items-center gap-3 shadow-lg">
              <div className="shrink-0 rounded-lg overflow-hidden bg-white p-1 border border-navy/10">
                <QrCode value={shareUrl} size={64} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] uppercase tracking-wider font-black text-muted-foreground">{t("আপনার রেফার কোড", "Your referral code")}</p>
                <p className="text-lg font-black text-navy mono-num tracking-widest leading-none mt-0.5" translate="no">{refCode}</p>
                <div className="flex gap-1.5 mt-1.5">
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success(t("লিংক কপি হয়েছে", "Link copied")); }}
                    className="flex-1 text-[10px] font-black bg-navy text-white rounded-lg py-1.5 flex items-center justify-center gap-1 btn-press">
                    <Copy className="w-3 h-3" /> {t("কপি", "Copy")}
                  </button>
                  <button onClick={() => {
                      if (navigator.share) navigator.share({ title: "Good App", url: shareUrl }).catch(() => {});
                      else { navigator.clipboard.writeText(shareUrl); toast.success(t("লিংক কপি হয়েছে", "Link copied")); }
                    }}
                    className="flex-1 text-[10px] font-black bg-emerald text-white rounded-lg py-1.5 flex items-center justify-center gap-1 btn-press">
                    <Share2 className="w-3 h-3" /> {t("শেয়ার", "Share")}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative mt-3 rounded-2xl bg-white/95 p-3 flex items-center gap-3 shadow-lg text-navy">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-rose/15 text-rose flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black">{t("রেফার কোড ও লিংক লক আছে", "Referral code & link are locked")}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  <span translate="no">{referralLock?.firstVerifies ?? 0}/{referralLock?.needed ?? 5}</span> {t("সফল First Verify · পূর্ণ হলেই auto unlock হবে।", "successful First Verifies · auto-unlocks when complete.")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New features banner */}
      {!isLiteBuild() && (
      <div className="rounded-3xl p-4 relative overflow-hidden shadow-[0_20px_50px_-15px_rgba(236,72,153,0.5)] text-white"
           style={{ background: "linear-gradient(135deg,#7c3aed 0%,#ec4899 45%,#f59e0b 100%)" }}>
        <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-40 blur-2xl"
             style={{ background: "radial-gradient(circle,#fde047,transparent 65%)" }} />
        <div className="relative flex items-start gap-3">
          <img src={bonusGirl} alt="Features" width={80} height={80}
               className="w-20 h-20 drop-shadow-2xl shrink-0 animate-bounce" style={{ animationDuration: "2.5s" }} />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.25em] font-black opacity-95">🎉 {t("নতুন ফিচার", "New Features")}</p>
            <p className="text-lg font-black leading-tight mt-0.5 drop-shadow">{t("সেন্ড ব্যালেন্স ও মোবাইল রিচার্জ", "Send Balance & Mobile Recharge")}</p>
            <p className="text-[11px] mt-1 opacity-95 leading-snug">
              {t("বন্ধুকে ব্যালেন্স পাঠান বা যেকোনো নম্বরে recharge করুন — সরাসরি আপনার ব্যালেন্স থেকে।", "Send balance to a friend or recharge any number — straight from your balance.")}
            </p>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-2 mt-3">
          <Link to="/send" className="rounded-2xl p-3 bg-white/95 text-navy shadow-lg btn-press flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white flex items-center justify-center"><Send className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[13px] font-black leading-tight">{t("সেন্ড ব্যালেন্স", "Send Balance")}</p>
              <p className="text-[9px] text-muted-foreground" translate="no">{t("মিন. ১৫৳", "Min 15৳")}</p>
            </div>
          </Link>
          {rechargeOn ? (
            <Link to="/recharge" className="rounded-2xl p-3 bg-white/95 text-navy shadow-lg btn-press flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 text-white flex items-center justify-center"><Smartphone className="w-5 h-5" /></div>
              <div className="min-w-0">
                <p className="text-[13px] font-black leading-tight">{t("মোবাইল রিচার্জ", "Mobile Recharge")}</p>
                <p className="text-[9px] text-muted-foreground" translate="no">{t("মিন. ২০৳", "Min 20৳")}</p>
              </div>
            </Link>
          ) : (
            <div className="rounded-2xl p-3 bg-white/60 text-navy/50 shadow-lg flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center"><Lock className="w-4 h-4" /></div>
              <div className="min-w-0">
                <p className="text-[13px] font-black leading-tight">{t("রিচার্জ বন্ধ", "Recharge off")}</p>
                <p className="text-[9px]">{t("সাময়িক ভাবে অফ", "Temporarily off")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Footer note */}
      <div className="rounded-2xl bg-surface-2 border border-border p-3 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-snug">
          {t("নতুন offer আসলে এই পেজেই দেখতে পাবেন। সব বোনাস auto instant credit হয় — কোনো কিছু claim করতে হয় না।",
             "New offers show up on this page. All bonuses are credited automatically — nothing to claim.")}
        </p>
      </div>
    </div>
  );
}
