import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  adminGetBonusSettings,
  adminUpdateBonusSettings,
  adminSetFirstVerifyMiningMode,
  adminSetMaintenance,
  adminSetFaceVerify,
  adminSetFirstVerify,
  adminSetBonusEnabled,
} from "@/lib/admin.functions";
import { Gift, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ApkUploadCard } from "@/components/admin/ApkUploadCard";
import { TestApkUploadCard } from "@/components/admin/TestApkUploadCard";
import { AppLinksCard } from "@/components/admin/AppLinksCard";
import { AdsSettingsCard } from "@/components/admin/AdsSettingsCard";

export const Route = createFileRoute("/admin/bonus-settings")({ component: BonusSettings });

// Promo dates are stored in UTC but admins type Dhaka (UTC+6) time. Without an
// explicit conversion the value shifted by 6 hours on every save/reload cycle.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

function utcToDhakaInput(iso?: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

function dhakaInputToUtc(local: string): string | null {
  if (!local) return null;
  const ms = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms - DHAKA_OFFSET_MS).toISOString();
}

function BonusSettings() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings() as Promise<any>,
  });

  const [fv, setFv] = useState("");
  const [rv, setRv] = useState("");
  const [rf, setRf] = useState("");
  const [fvMode, setFvMode] = useState(false);
  const [otpMode, setOtpMode] = useState(true);
  // Promo
  const [promoActive, setPromoActive] = useState(false);
  const [promoTitle, setPromoTitle] = useState("");
  const [promoStart, setPromoStart] = useState("");
  const [promoEnd, setPromoEnd] = useState("");
  const [pFv, setPFv] = useState("");
  const [pRv, setPRv] = useState("");
  const [pRf, setPRf] = useState("");
  // Payout methods
  const [bkashOn, setBkashOn] = useState(true);
  const [nagadOn, setNagadOn] = useState(true);
  const [bkashMsg, setBkashMsg] = useState("");
  const [nagadMsg, setNagadMsg] = useState("");
  const [rechargeOn, setRechargeOn] = useState(true);
  const [rechargeMsg, setRechargeMsg] = useState("");
  const [withdrawOn, setWithdrawOn] = useState(true);
  const [withdrawMsg, setWithdrawMsg] = useState("");
  const [offUntil, setOffUntil] = useState<string | null>(null);
  const [fvOn, setFvOn] = useState(true);
  const [firstVOn, setFirstVOn] = useState(true);
  const [firstVMsg, setFirstVMsg] = useState("");
  const [bonusOn, setBonusOn] = useState(true);
  const [fvOffMsg, setFvOffMsg] = useState("");
  const [signupOffMsg, setSignupOffMsg] = useState("");
  const [maintOn, setMaintOn] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [usdtOn, setUsdtOn] = useState(true);
  const [usdtMsg, setUsdtMsg] = useState("");

  const [testApkUrl, setTestApkUrl] = useState("");
  const [testApkVer, setTestApkVer] = useState("");
  const [minVer, setMinVer] = useState("");
  const [forceOn, setForceOn] = useState(true);
  const [forceWeb, setForceWeb] = useState(false);
  const [forceMsg, setForceMsg] = useState("");

  useEffect(() => {
    if (!data) return;
    const d: any = data;
    setFv(String(d.first_verify_bonus ?? 50));
    setRv(String(d.reverify_bonus ?? 200));
    setRf(String(d.referrer_bonus ?? 100));
    setFvMode(!!d.first_verify_mining_mode);
    setOtpMode(d.email_otp_enabled !== false);
    setPromoActive(!!d.promo_active);
    setPromoTitle(d.promo_title ?? "");
    setPromoStart(utcToDhakaInput(d.promo_start_at));
    setPromoEnd(utcToDhakaInput(d.promo_end_at));
    setPFv(String(d.promo_first_verify_bonus ?? 100));
    setPRv(String(d.promo_reverify_bonus ?? 400));
    setPRf(String(d.promo_referrer_bonus ?? 150));
    setBkashOn(d.bkash_enabled !== false);
    setNagadOn(d.nagad_enabled !== false);
    setBkashMsg(d.bkash_off_message ?? "");
    setNagadMsg(d.nagad_off_message ?? "");
    setRechargeOn(d.recharge_enabled !== false);
    setRechargeMsg(d.recharge_off_message ?? "");
    setFvOn(d.face_verify_enabled !== false);
    setFirstVOn(d.first_verify_enabled !== false);
    setFirstVMsg(d.first_verify_off_message ?? "");
    setBonusOn(d.bonus_enabled !== false);
    setFvOffMsg(d.face_verify_off_message ?? "");
    setSignupOffMsg(d.signup_off_message ?? "");
    setMaintOn(d.maintenance_enabled === true);
    setMaintMsg(d.maintenance_message ?? "");
    setUsdtOn(d.usdt_enabled !== false);
    setUsdtMsg(d.usdt_off_message ?? "");
    setWithdrawOn(d.withdraw_enabled !== false);
    setWithdrawMsg(d.withdraw_off_message ?? "");
    setOffUntil(d.withdraw_off_until ?? null);
    setTestApkUrl(d.test_apk_url ?? "");
    setTestApkVer(d.test_apk_version ?? "");
    setMinVer(d.min_app_version ?? "");
    setForceOn(d.force_update_enabled !== false);
    setForceWeb(d.force_update_web === true);
    setForceMsg(d.force_update_message ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: (override?: { email_otp_enabled?: boolean }) =>
      adminUpdateBonusSettings({
        data: {
          first_verify_bonus: Number(fv),
          reverify_bonus: Number(rv),
          referrer_bonus: Number(rf),
          first_verify_mining_mode: fvMode,
          email_otp_enabled: override?.email_otp_enabled ?? otpMode,
          promo_active: promoActive,
          promo_title: promoTitle || null,
          promo_start_at: dhakaInputToUtc(promoStart),
          promo_end_at: dhakaInputToUtc(promoEnd),
          promo_first_verify_bonus: Number(pFv) || 0,
          promo_reverify_bonus: Number(pRv) || 0,
          promo_referrer_bonus: Number(pRf) || 0,
          bkash_enabled: bkashOn,
          nagad_enabled: nagadOn,
          bkash_off_message: bkashMsg || null,
          nagad_off_message: nagadMsg || null,
          recharge_enabled: rechargeOn,
          recharge_off_message: rechargeMsg || null,
          usdt_enabled: usdtOn,
          usdt_off_message: usdtMsg || null,
          withdraw_enabled: withdrawOn,
          withdraw_off_message: withdrawMsg || null,
          withdraw_off_until: withdrawOn ? null : offUntil,
          test_apk_url: testApkUrl || null,
          test_apk_version: testApkVer || null,
          min_app_version: minVer || null,
          force_update_enabled: forceOn,
          force_update_web: forceWeb,
          force_update_message: forceMsg || null,
        } as any,
      }),
    onSuccess: () => {
      toast.success("✅ বোনাস সেটিংস সেভ হয়েছে");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pauseOneDay = useMutation({
    mutationFn: () =>
      adminUpdateBonusSettings({
        data: {
          first_verify_bonus: Number(fv),
          reverify_bonus: Number(rv),
          referrer_bonus: Number(rf),
          withdraw_enabled: false,
          withdraw_off_message:
            withdrawMsg ||
            "উইথড্র রিকোয়েস্ট ১ দিনের জন্য বন্ধ রাখা হয়েছে — আগামীকাল আবার চালু হবে ইনশাআল্লাহ।",
          withdraw_off_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } as any,
      }),
    onSuccess: () => {
      toast.success("⏸️ withdraw ১ দিনের জন্য বন্ধ করা হলো");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resumeNow = useMutation({
    mutationFn: () =>
      adminUpdateBonusSettings({
        data: {
          first_verify_bonus: Number(fv),
          reverify_bonus: Number(rv),
          referrer_bonus: Number(rf),
          withdraw_enabled: true,
          withdraw_off_until: null,
        } as any,
      }),
    onSuccess: () => {
      toast.success("✅ withdraw আবার চালু");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMaint = useMutation({
    mutationFn: (enabled: boolean) =>
      adminSetMaintenance({ data: { enabled, message: maintMsg.trim() || null } }),
    onSuccess: (_r, enabled) => {
      setMaintOn(enabled);
      toast.success(
        enabled ? "🛠️ Maintenance mode ON — অ্যাপ বন্ধ" : "✅ Maintenance mode OFF — অ্যাপ চালু",
      );
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFaceVerify = useMutation({
    mutationFn: (enabled: boolean) =>
      adminSetFaceVerify({
        data: {
          enabled,
          faceMessage: fvOffMsg.trim() || null,
          signupMessage: signupOffMsg.trim() || null,
        },
      }),
    onSuccess: (_r, enabled) => {
      setFvOn(enabled);
      toast.success(
        enabled
          ? "✅ Face verification আবার স্বাভাবিকভাবে চালু"
          : "⏸️ Face verification বন্ধ — নতুন verify ও নতুন signup বন্ধ",
      );
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveFirstVerify = useMutation({
    mutationFn: (enabled: boolean) =>
      adminSetFirstVerify({ data: { enabled, message: firstVMsg.trim() || null } }),
    onSuccess: (_r, enabled) => {
      setFirstVOn(enabled);
      toast.success(
        enabled
          ? "✅ নতুন (first) verify চালু"
          : "⏸️ নতুন (first) verify বন্ধ — re-verify চালু আছে",
      );
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveBonusEnabled = useMutation({
    mutationFn: (enabled: boolean) => adminSetBonusEnabled({ data: { enabled } }),
    onSuccess: (_r, enabled) => {
      setBonusOn(enabled);
      toast.success(
        enabled
          ? "✅ বোনাস অফার চালু — নিচের রেট অনুযায়ী সবাই বোনাস পাবে"
          : "⏸️ বোনাস অফার বন্ধ — কেউ আর বোনাস পাবে না",
      );
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFvMode = useMutation({
    mutationFn: (enabled: boolean) => adminSetFirstVerifyMiningMode({ data: { enabled } }),
    onSuccess: (_r, enabled) => {
      setFvMode(enabled);
      toast.success(
        enabled
          ? "✅ First-verify mining ON — ১০ face হলেই সবার mining চালু"
          : "🔒 First-verify mining OFF — re-verify করলে mining চালু হবে",
      );
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="py-10 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-amber" />
      </div>
    );

  const total = (Number(fv) || 0) + (Number(rv) || 0) + (Number(rf) || 0);

  return (
    <div className="space-y-3">
      <AdsSettingsCard />
      <AppLinksCard />
      <TestApkUploadCard />
      <ApkUploadCard />

      {/* Force update (বাধ্যতামূলক আপডেট) */}
      <div className="rounded-2xl p-4 border-2 border-border bg-surface-2 space-y-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-black text-amber">
            🚀 বাধ্যতামূলক আপডেট
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-1">
            নিচের ভার্সনের চেয়ে পুরোনো অ্যাপ থাকলে ইউজার কিছুই করতে পারবে না — আপডেট করতেই হবে।
          </p>
        </div>
        <label className="block">
          <span className="text-[11px] font-bold text-muted-foreground">Minimum App Version</span>
          <input
            value={minVer}
            onChange={(e) => setMinVer(e.target.value)}
            placeholder="1.22"
            className="mt-1 w-full rounded-xl bg-surface px-3 py-2 text-sm font-bold outline-none border border-border"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">অ্যাপে বাধ্যতামূলক করা</span>
          <button
            type="button"
            onClick={() => setForceOn((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${forceOn ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted-foreground"}`}
          >
            {forceOn ? "ON" : "OFF"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-bold">ওয়েবসাইটেও বাধ্যতামূলক</span>
          <button
            type="button"
            onClick={() => setForceWeb((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black ${forceWeb ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted-foreground"}`}
          >
            {forceWeb ? "ON" : "OFF"}
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-bold text-muted-foreground">নোটিশ (বাংলা)</span>
          <textarea
            value={forceMsg}
            onChange={(e) => setForceMsg(e.target.value)}
            rows={3}
            placeholder="অ্যাপ আপডেট না করলে কোনো কাজ করা যাবে না…"
            className="mt-1 w-full rounded-xl bg-surface px-3 py-2 text-[12px] outline-none border border-border"
          />
        </label>
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate(undefined)}
          className="w-full rounded-xl bg-amber/20 text-amber py-2 text-sm font-black"
        >
          {save.isPending ? "সেভ হচ্ছে…" : "আপডেট সেটিংস সেভ করুন"}
        </button>
      </div>
      
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-amber" />
          <h1 className="text-base font-black text-amber">Bonus Offer Settings</h1>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          এখানে বোনাস টাকার অংক পরিবর্তন করলে সব নতুন ইউজারের জন্য সাথে সাথে চালু হয়ে যাবে। যারা
          আগে বোনাস পেয়ে গেছে তারা আর দ্বিতীয়বার পাবে না — নতুনরা এই নতুন অংক পাবে।
        </p>
      </div>

      {/* Maintenance mode */}
      <div
        className={`rounded-2xl p-4 border-2 space-y-2 ${maintOn ? "border-rose/60 bg-rose/10" : "border-border bg-surface-2"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[11px] uppercase tracking-widest font-black ${maintOn ? "text-rose" : "text-muted-foreground"}`}
            >
              🛠️ Maintenance mode
            </p>
            <p className="text-sm font-black mt-0.5">
              {maintOn
                ? "ON — অ্যাপ বন্ধ, ইউজার শুধু বাংলা নোটিশ দেখবে"
                : "OFF — অ্যাপ স্বাভাবিক চলছে"}
            </p>
          </div>
          <button
            disabled={saveMaint.isPending}
            onClick={() => {
              const next = !maintOn;
              if (
                !confirm(
                  next
                    ? "SURE? ON করলে কোনো user কিছুই করতে পারবে না — শুধু 'কাজ চলছে' মেসেজ দেখবে।"
                    : "Maintenance OFF করে অ্যাপ আবার চালু করবেন?",
                )
              )
                return;
              saveMaint.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${maintOn ? "bg-rose" : "bg-surface-2 border border-border"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${maintOn ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        <textarea
          value={maintMsg}
          onChange={(e) => setMaintMsg(e.target.value.slice(0, 1000))}
          rows={3}
          placeholder="ইউজারকে যা দেখাবেন (খালি রাখলে সুন্দর ডিফল্ট বাংলা মেসেজ যাবে)"
          className="w-full px-3 py-2 rounded-xl bg-white border border-border text-sm outline-none focus:border-rose resize-y"
        />
        <button
          onClick={() => saveMaint.mutate(maintOn)}
          disabled={saveMaint.isPending}
          className="w-full py-2 rounded-xl gradient-navy text-gold font-black text-xs disabled:opacity-50"
        >
          মেসেজ সেভ করুন
        </button>
      </div>

      {/* Face verification master switch */}
      <div
        className={`rounded-2xl p-4 border-2 space-y-2 ${fvOn ? "border-emerald/50 bg-emerald/5" : "border-amber/60 bg-amber/10"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[11px] uppercase tracking-widest font-black ${fvOn ? "text-emerald" : "text-amber"}`}
            >
              🧑‍💻 Face verification system
            </p>
            <p className="text-sm font-black mt-0.5">
              {fvOn
                ? "ON — সব স্বাভাবিক, নতুন verify ও নতুন signup চালু"
                : "OFF — নতুন face verify বন্ধ + নতুন user signup বন্ধ (পুরোনো user ও mining ঠিক আছে)"}
            </p>
          </div>
          <button
            disabled={saveFaceVerify.isPending}
            onClick={() => {
              const next = !fvOn;
              if (
                !confirm(
                  next
                    ? "Face verification আবার চালু করবেন? নতুন signup ও নতুন slot verify আবার স্বাভাবিক হবে।"
                    : "OFF করলে কেউ নতুন করে slot-এ face verify করতে পারবে না এবং নতুন signup বন্ধ হবে। পুরোনো verify করা user ও তাদের mining ঠিক থাকবে।",
                )
              )
                return;
              saveFaceVerify.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${fvOn ? "bg-emerald" : "bg-amber"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${fvOn ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        <textarea
          value={fvOffMsg}
          onChange={(e) => setFvOffMsg(e.target.value.slice(0, 1500))}
          rows={3}
          placeholder="Face verify বন্ধ থাকলে ইউজার যা দেখবে (খালি রাখলে সুন্দর ডিফল্ট বাংলা মেসেজ)"
          className="w-full px-3 py-2 rounded-xl bg-white border border-border text-sm outline-none focus:border-amber resize-y"
        />
        <textarea
          value={signupOffMsg}
          onChange={(e) => setSignupOffMsg(e.target.value.slice(0, 1500))}
          rows={3}
          placeholder="নতুন signup বন্ধ থাকলে login পেজে যা দেখাবে (খালি রাখলে ডিফল্ট বাংলা মেসেজ)"
          className="w-full px-3 py-2 rounded-xl bg-white border border-border text-sm outline-none focus:border-amber resize-y"
        />
        <button
          onClick={() => saveFaceVerify.mutate(fvOn)}
          disabled={saveFaceVerify.isPending}
          className="w-full py-2 rounded-xl gradient-navy text-gold font-black text-xs disabled:opacity-50"
        >
          মেসেজ সেভ করুন
        </button>
      </div>

      {/* First (new) verify only switch — re-verify stays ON */}
      <div
        className={`rounded-2xl p-4 border-2 space-y-2 ${firstVOn ? "border-emerald/50 bg-emerald/5" : "border-amber/60 bg-amber/10"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[11px] uppercase tracking-widest font-black ${firstVOn ? "text-emerald" : "text-amber"}`}
            >
              🆕 শুধু নতুন (first) verify
            </p>
            <p className="text-sm font-black mt-0.5">
              {firstVOn
                ? "ON — নতুন স্লটে first verify করা যাবে"
                : "OFF — নতুন first verify বন্ধ, কিন্তু re-verify চালু আছে"}
            </p>
          </div>
          <button
            disabled={saveFirstVerify.isPending}
            onClick={() => {
              const next = !firstVOn;
              if (
                !confirm(
                  next
                    ? "নতুন (first) verify আবার চালু করবেন?"
                    : "OFF করলে কেউ নতুন স্লটে first verify করতে পারবে না। পুরোনো user-রা re-verify আগের মতোই করতে পারবে।",
                )
              )
                return;
              saveFirstVerify.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${firstVOn ? "bg-emerald" : "bg-amber"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${firstVOn ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        <textarea
          value={firstVMsg}
          onChange={(e) => setFirstVMsg(e.target.value.slice(0, 1500))}
          rows={3}
          placeholder="নতুন first verify বন্ধ থাকলে ইউজার যা দেখবে (খালি রাখলে ডিফল্ট বাংলা মেসেজ)"
          className="w-full px-3 py-2 rounded-xl bg-white border border-border text-sm outline-none focus:border-amber resize-y"
        />
        <button
          onClick={() => saveFirstVerify.mutate(firstVOn)}
          disabled={saveFirstVerify.isPending}
          className="w-full py-2 rounded-xl gradient-navy text-gold font-black text-xs disabled:opacity-50"
        >
          মেসেজ সেভ করুন
        </button>
      </div>

      {/* Global Mining Mode Switch */}
      <div
        className={`rounded-2xl p-4 border-2 space-y-2 ${fvMode ? "border-emerald/50 bg-emerald/5" : "border-amber/50 bg-amber/5"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[11px] uppercase tracking-widest font-black ${fvMode ? "text-emerald" : "text-amber"}`}
            >
              🌐 First-verify mining mode
            </p>
            <p className="text-sm font-black mt-0.5">
              {fvMode
                ? "ON — শুধু ১০ face verify করলেই mining চালু"
                : "OFF — mining এর জন্য re-verify লাগবে (default)"}
            </p>
          </div>
          <button
            disabled={toggleFvMode.isPending}
            onClick={() => {
              const next = !fvMode;
              if (
                !confirm(
                  next
                    ? "SURE? ON করলে সব user ১০ first-verify করলেই mining শুরু হবে — re-verify লাগবে না।"
                    : "SURE? OFF করলে re-verify না করলে mining চালু হবে না। যারা first-verify মোডে চালু ছিল তাদেরও off হয়ে যেতে পারে।",
                )
              )
                return;
              toggleFvMode.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${fvMode ? "bg-emerald" : "bg-surface-2 border border-border"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${fvMode ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {fvMode
            ? "⚡ এখন যে কেউ ১০টা face first-verify complete করলেই তার mining auto চালু হয়ে যাবে। Not-whitelist হলে mining off হয়ে re-verify চাইবে।"
            : "🔒 Default rule: প্রথম verify complete হলে mining চালু হবে না। ১০টা face re-verify complete করতে হবে, তবেই mining শুরু। (individual user er জন্য admin manual override use করা যাবে)"}
        </p>
      </div>

      <ApkUploadCard />

      {/* Gmail কোড (OTP) সিস্টেম Switch */}
      <div
        className={`rounded-2xl p-4 border-2 space-y-2 ${otpMode ? "border-cyan/50 bg-cyan/5" : "border-amber/50 bg-amber/5"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p
              className={`text-[11px] uppercase tracking-widest font-black ${otpMode ? "text-cyan" : "text-amber"}`}
            >
              📧 Gmail কোড (OTP) সিস্টেম
            </p>
            <p className="text-sm font-black mt-0.5">
              {otpMode
                ? "ON — registration/login/password change-এ Gmail কোড লাগবে"
                : "OFF — আগের মতো শুধু নম্বর + পাসওয়ার্ড"}
            </p>
          </div>
          <button
            disabled={save.isPending}
            onClick={() => {
              const next = !otpMode;
              if (
                !confirm(
                  next
                    ? "SURE? ON করলে সবাইকে Gmail verification ও login কোড দিতে হবে।"
                    : "SURE? OFF করলে Gmail verification/কোড লাগবে না — সব আগের মতো নম্বর+পাসওয়ার্ডে চলবে।",
                )
              )
                return;
              setOtpMode(next);
              save.mutate({ email_otp_enabled: next });
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${otpMode ? "bg-cyan" : "bg-surface-2 border border-border"} disabled:opacity-50`}
          >
            <span
              className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${otpMode ? "left-8" : "left-1"}`}
            />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {otpMode
            ? "🔐 এখন Gmail ছাড়া registration হবে না, login-এ কোড যাবে, password change-এও কোড লাগবে।"
            : "🕰️ Legacy mode: Gmail লাগবে না, কোড যাবে না, forgot-password admin থেকে reset করতে হবে।"}
        </p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        {/* ধাপ ১ — মেইন ON/OFF */}
        <div
          className={`rounded-xl border-2 p-3 ${bonusOn ? "border-emerald/60 bg-emerald/10" : "border-rose/60 bg-rose/10"}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-navy">
                ধাপ ১ — 🎁 বোনাস সিস্টেম (মেইন সুইচ)
              </p>
              <p className={`text-sm font-black mt-0.5 ${bonusOn ? "text-emerald" : "text-rose"}`}>
                {bonusOn
                  ? "চালু আছে — নিচের রেট অনুযায়ী সবাই বোনাস পাচ্ছে"
                  : "বন্ধ আছে — কেউ বোনাস পাবে না (অফার সেট থাকলেও কাজ করবে না)"}
              </p>
            </div>
            <button
              disabled={saveBonusEnabled.isPending}
              onClick={() => {
                const next = !bonusOn;
                if (
                  !confirm(
                    next
                      ? "বোনাস সিস্টেম চালু করবেন? নিচের রেট অনুযায়ী সবাই বোনাস পাবে।"
                      : "বন্ধ করলে কেউ আর First verify / Re-verify / Refer বোনাস পাবে না। আগে যারা পেয়েছে তাদের ব্যালেন্স ঠিক থাকবে।",
                  )
                )
                  return;
                saveBonusEnabled.mutate(next);
              }}
              className={`shrink-0 w-16 h-9 rounded-full relative transition ${bonusOn ? "bg-emerald" : "bg-rose"} disabled:opacity-50`}
            >
              <span
                className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${bonusOn ? "left-8" : "left-1"}`}
              />
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">
            এই সুইচটা সাথে সাথেই কাজ করে — Save লাগবে না।
          </p>
        </div>

        <p className="text-[11px] font-black text-navy">
          ধাপ ২ — সাধারণ রেট (অফার না থাকলে এটাই চলবে)
        </p>
        <Field
          label="১) First-verify বোনাস (ইউজারের নিজের)"
          hint="১০টি স্লট first verify complete হলে ইউজার নিজে এই টাকা পাবে"
          value={fv}
          onChange={setFv}
          color="cyan"
        />
        <Field
          label="২) Re-verify বোনাস (ইউজারের নিজের)"
          hint="১০টি স্লট re-verify complete + mining চালু"
          value={rv}
          onChange={setRv}
          color="amber"
        />
        <Field
          label="৩) Referrer বোনাস"
          hint="যাকে refer করা হয়েছে সে ১০টি first verify complete করলে referrer এই টাকা পাবে"
          value={rf}
          onChange={setRf}
          color="violet"
        />

        <div className="rounded-xl bg-gradient-to-r from-amber/20 to-rose/20 border border-amber/40 p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber">
            Total banner amount
          </p>
          <p className="text-2xl font-black text-navy mono-num">{total}৳</p>
          <p className="text-[10px] text-muted-foreground mt-1">Home banner এ এই টাকা দেখাবে</p>
        </div>

        {/* ধাপ ৩ — সীমিত সময়ের স্পেশাল অফার */}
        <div
          className={`rounded-xl border-2 p-3 space-y-2 ${promoActive ? "border-rose bg-rose/5" : "border-border bg-surface-2"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-black text-rose">
                ধাপ ৩ — 🔥 স্পেশাল অফার (নির্দিষ্ট সময়ের জন্য)
              </p>
              <p className="text-[10px] font-bold mt-0.5">
                {promoActive
                  ? "চালু — নিচের Start–End সময়ের মধ্যে নিচের অফার রেট কাজ করবে"
                  : "বন্ধ — শুধু উপরের সাধারণ রেট কাজ করবে"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPromoActive(!promoActive)}
              className={`shrink-0 w-14 h-7 rounded-full relative transition ${promoActive ? "bg-rose" : "bg-surface-2 border border-border"}`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${promoActive ? "left-8" : "left-1"}`}
              />
            </button>
          </div>
          <input
            value={promoTitle}
            onChange={(e) => setPromoTitle(e.target.value)}
            placeholder="ব্যানারের টাইটেল (যেমন 🎊 স্পেশাল বোনাস অফার!)"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-rose"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground font-bold">শুরু (Start)</label>
              <input
                type="datetime-local"
                value={promoStart}
                onChange={(e) => setPromoStart(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground font-bold">শেষ (End)</label>
              <input
                type="datetime-local"
                value={promoEnd}
                onChange={(e) => setPromoEnd(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs outline-none"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const pad = (n: number) => String(n).padStart(2, "0");
              const fmt = (d: Date) =>
                `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
              const now = new Date();
              setPromoStart(fmt(now));
              setPromoEnd(fmt(new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)));
              setPromoActive(true);
            }}
            className="w-full py-2 rounded-lg bg-rose/15 border border-rose/40 text-[11px] font-black text-rose"
          >
            ⚡ এখন থেকে ২ দিনের অফার সেট করুন
          </button>
          <div className="grid grid-cols-3 gap-2">
            <PromoNum label="First verify" value={pFv} onChange={setPFv} />
            <PromoNum label="Re-verify" value={pRv} onChange={setPRv} />
            <PromoNum label="Refer" value={pRf} onChange={setPRf} />
          </div>
          <p className="text-[9px] text-muted-foreground leading-snug">
            ⚠️ এই সেকশনের পরিবর্তন নিচের <b>Save</b> বাটনে চাপলেই কাজ করবে। অফার শেষ হলে অটো সাধারণ
            রেটে ফিরে যাবে।
          </p>
        </div>

        {/* Payout methods */}
        <div className="rounded-xl border-2 border-emerald/40 bg-emerald/5 p-3 space-y-2">
          <p className="text-[11px] font-black text-emerald">💳 Payout methods</p>
          <PayoutRow
            name="🌙 Withdraw request (master)"
            on={withdrawOn}
            setOn={setWithdrawOn}
            msg={withdrawMsg}
            setMsg={setWithdrawMsg}
          />
          <p className="text-[9px] text-muted-foreground -mt-1">
            OFF করলে সব withdraw বন্ধ। কোনো অটো সাপ্তাহিক বন্ধ নেই — শুক্রবারেও withdraw চালু থাকে
            (শুধু জুমা মোবারক ব্যানার দেখায়)।
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => pauseOneDay.mutate()}
              disabled={pauseOneDay.isPending}
              className="rounded-xl bg-rose/15 border-2 border-rose/50 px-3 py-2 text-[11px] font-black text-rose btn-press disabled:opacity-50"
            >
              ⏸️ ১ দিনের জন্য withdraw বন্ধ
            </button>
            <button
              onClick={() => resumeNow.mutate()}
              disabled={resumeNow.isPending}
              className="rounded-xl bg-emerald/15 border-2 border-emerald/50 px-3 py-2 text-[11px] font-black text-emerald btn-press disabled:opacity-50"
            >
              ▶️ এখনই আবার চালু করো
            </button>
          </div>
          {offUntil && withdrawOn === false && (
            <p className="text-[9px] text-rose font-bold">
              অটো চালু হবে: {new Date(offUntil).toLocaleString("bn-BD")}
            </p>
          )}
          <PayoutRow
            name="বিকাশ"
            on={bkashOn}
            setOn={setBkashOn}
            msg={bkashMsg}
            setMsg={setBkashMsg}
          />
          <PayoutRow
            name="নগদ"
            on={nagadOn}
            setOn={setNagadOn}
            msg={nagadMsg}
            setMsg={setNagadMsg}
          />
          <PayoutRow
            name="মোবাইল রিচার্জ"
            on={rechargeOn}
            setOn={setRechargeOn}
            msg={rechargeMsg}
            setMsg={setRechargeMsg}
          />
          <PayoutRow
            name="USDT (Celo)"
            on={usdtOn}
            setOn={setUsdtOn}
            msg={usdtMsg}
            setMsg={setUsdtMsg}
          />
          <p className="text-[9px] text-muted-foreground">
            কোনো method OFF করলে user সেখান দিয়ে withdraw/recharge দিতে পারবে না, message টা তাকে
            দেখানো হবে।
          </p>
        </div>

        <button
          onClick={() => save.mutate(undefined)}
          disabled={save.isPending}
          className="w-full py-3 rounded-xl gradient-cta text-white font-black flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {save.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  color,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  color: "cyan" | "amber" | "violet";
}) {
  return (
    <div className={`rounded-xl border-2 p-3 border-${color}/40 bg-${color}/5`}>
      <label className={`text-[11px] font-black text-${color} block`}>{label}</label>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-lg font-black mono-num outline-none focus:border-amber"
        />
        <span className="text-xl font-black text-muted-foreground">৳</span>
      </div>
    </div>
  );
}

function PromoNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg bg-background border border-border p-2">
      <p className="text-[9px] uppercase text-rose font-black">{label}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 bg-transparent text-base font-black mono-num outline-none"
      />
    </div>
  );
}

function PayoutRow({
  name,
  on,
  setOn,
  msg,
  setMsg,
}: {
  name: string;
  on: boolean;
  setOn: (v: boolean) => void;
  msg: string;
  setMsg: (v: string) => void;
}) {
  return (
    <div className="rounded-lg bg-background p-2 space-y-1 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black">{name}</span>
        <button
          type="button"
          onClick={() => setOn(!on)}
          className={`w-12 h-6 rounded-full relative transition ${on ? "bg-emerald" : "bg-rose/60"}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`}
          />
        </button>
      </div>
      {!on && (
        <input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={`${name} বন্ধ থাকলে user কে যে message দেখাবে`}
          className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-[11px] outline-none focus:border-rose"
        />
      )}
    </div>
  );
}
