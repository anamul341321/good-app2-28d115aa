import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminGetBonusSettings, adminUpdateBonusSettings, adminSetFirstVerifyMiningMode, adminSetMaintenance } from "@/lib/admin.functions";
import { Gift, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/bonus-settings")({ component: BonusSettings });

function BonusSettings() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-bonus-settings"],
    queryFn: () => adminGetBonusSettings(),
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
  const [maintOn, setMaintOn] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [apkUrl, setApkUrl] = useState("");
  const [apkVer, setApkVer] = useState("");
  const [usdtOn, setUsdtOn] = useState(true);
  const [usdtMsg, setUsdtMsg] = useState("");

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
    setPromoStart(d.promo_start_at ? d.promo_start_at.slice(0, 16) : "");
    setPromoEnd(d.promo_end_at ? d.promo_end_at.slice(0, 16) : "");
    setPFv(String(d.promo_first_verify_bonus ?? 100));
    setPRv(String(d.promo_reverify_bonus ?? 400));
    setPRf(String(d.promo_referrer_bonus ?? 150));
    setBkashOn(d.bkash_enabled !== false);
    setNagadOn(d.nagad_enabled !== false);
    setBkashMsg(d.bkash_off_message ?? "");
    setNagadMsg(d.nagad_off_message ?? "");
    setRechargeOn(d.recharge_enabled !== false);
    setRechargeMsg(d.recharge_off_message ?? "");
    setMaintOn(d.maintenance_enabled === true);
    setMaintMsg(d.maintenance_message ?? "");
    setApkUrl(d.apk_url ?? "");
    setApkVer(d.apk_version ?? "");
    setUsdtOn(d.usdt_enabled !== false);
    setUsdtMsg(d.usdt_off_message ?? "");
    setWithdrawOn(d.withdraw_enabled !== false);
    setWithdrawMsg(d.withdraw_off_message ?? "");
    setOffUntil(d.withdraw_off_until ?? null);
  }, [data]);

  const save = useMutation({
    mutationFn: (override?: { email_otp_enabled?: boolean }) => adminUpdateBonusSettings({
      data: {
        first_verify_bonus: Number(fv),
        reverify_bonus: Number(rv),
        referrer_bonus: Number(rf),
        first_verify_mining_mode: fvMode,
        email_otp_enabled: override?.email_otp_enabled ?? otpMode,
        promo_active: promoActive,
        promo_title: promoTitle || null,
        promo_start_at: promoStart ? new Date(promoStart).toISOString() : null,
        promo_end_at:   promoEnd   ? new Date(promoEnd).toISOString()   : null,
        promo_first_verify_bonus: Number(pFv) || 0,
        promo_reverify_bonus:     Number(pRv) || 0,
        promo_referrer_bonus:     Number(pRf) || 0,
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
        apk_url: apkUrl.trim() || null,
        apk_version: apkVer.trim() || null,
      } as any,
    }),
    onSuccess: () => { toast.success("✅ বোনাস সেটিংস সেভ হয়েছে"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const pauseOneDay = useMutation({
    mutationFn: () => adminUpdateBonusSettings({
      data: {
        first_verify_bonus: Number(fv),
        reverify_bonus: Number(rv),
        referrer_bonus: Number(rf),
        withdraw_enabled: false,
        withdraw_off_message: withdrawMsg || "উইথড্র রিকোয়েস্ট ১ দিনের জন্য বন্ধ রাখা হয়েছে — আগামীকাল আবার চালু হবে ইনশাআল্লাহ।",
        withdraw_off_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any,
    }),
    onSuccess: () => { toast.success("⏸️ withdraw ১ দিনের জন্য বন্ধ করা হলো"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const resumeNow = useMutation({
    mutationFn: () => adminUpdateBonusSettings({
      data: {
        first_verify_bonus: Number(fv),
        reverify_bonus: Number(rv),
        referrer_bonus: Number(rf),
        withdraw_enabled: true,
        withdraw_off_until: null,
      } as any,
    }),
    onSuccess: () => { toast.success("✅ withdraw আবার চালু"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMaint = useMutation({
    mutationFn: (enabled: boolean) => adminSetMaintenance({ data: { enabled, message: maintMsg.trim() || null } }),
    onSuccess: (_r, enabled) => {
      setMaintOn(enabled);
      toast.success(enabled ? "🛠️ Maintenance mode ON — অ্যাপ বন্ধ" : "✅ Maintenance mode OFF — অ্যাপ চালু");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleFvMode = useMutation({
    mutationFn: (enabled: boolean) => adminSetFirstVerifyMiningMode({ data: { enabled } }),
    onSuccess: (_r, enabled) => {
      setFvMode(enabled);
      toast.success(enabled
        ? "✅ First-verify mining ON — ১০ face হলেই সবার mining চালু"
        : "🔒 First-verify mining OFF — re-verify করলে mining চালু হবে");
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber" /></div>;

  const total = (Number(fv) || 0) + (Number(rv) || 0) + (Number(rf) || 0);

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="w-5 h-5 text-amber" />
          <h1 className="text-base font-black text-amber">Bonus Offer Settings</h1>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          এখানে বোনাস টাকার অংক পরিবর্তন করলে সব নতুন ইউজারের জন্য সাথে সাথে চালু হয়ে যাবে।
          যারা আগে বোনাস পেয়ে গেছে তারা আর দ্বিতীয়বার পাবে না — নতুনরা এই নতুন অংক পাবে।
        </p>
      </div>

      {/* Maintenance mode */}
      <div className={`rounded-2xl p-4 border-2 space-y-2 ${maintOn ? "border-rose/60 bg-rose/10" : "border-border bg-surface-2"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-widest font-black ${maintOn ? "text-rose" : "text-muted-foreground"}`}>
              🛠️ Maintenance mode
            </p>
            <p className="text-sm font-black mt-0.5">
              {maintOn ? "ON — অ্যাপ বন্ধ, ইউজার শুধু বাংলা নোটিশ দেখবে" : "OFF — অ্যাপ স্বাভাবিক চলছে"}
            </p>
          </div>
          <button
            disabled={saveMaint.isPending}
            onClick={() => {
              const next = !maintOn;
              if (!confirm(next
                ? "SURE? ON করলে কোনো user কিছুই করতে পারবে না — শুধু 'কাজ চলছে' মেসেজ দেখবে।"
                : "Maintenance OFF করে অ্যাপ আবার চালু করবেন?")) return;
              saveMaint.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${maintOn ? "bg-rose" : "bg-surface-2 border border-border"} disabled:opacity-50`}>
            <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${maintOn ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <textarea value={maintMsg} onChange={(e) => setMaintMsg(e.target.value.slice(0, 1000))} rows={3}
          placeholder="ইউজারকে যা দেখাবেন (খালি রাখলে সুন্দর ডিফল্ট বাংলা মেসেজ যাবে)"
          className="w-full px-3 py-2 rounded-xl bg-white border border-border text-sm outline-none focus:border-rose resize-y" />
        <button onClick={() => saveMaint.mutate(maintOn)} disabled={saveMaint.isPending}
          className="w-full py-2 rounded-xl gradient-navy text-gold font-black text-xs disabled:opacity-50">
          মেসেজ সেভ করুন
        </button>
      </div>

      {/* Global Mining Mode Switch */}
      <div className={`rounded-2xl p-4 border-2 space-y-2 ${fvMode ? "border-emerald/50 bg-emerald/5" : "border-amber/50 bg-amber/5"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-widest font-black ${fvMode ? "text-emerald" : "text-amber"}`}>
              🌐 First-verify mining mode
            </p>
            <p className="text-sm font-black mt-0.5">
              {fvMode ? "ON — শুধু ১০ face verify করলেই mining চালু" : "OFF — mining এর জন্য re-verify লাগবে (default)"}
            </p>
          </div>
          <button
            disabled={toggleFvMode.isPending}
            onClick={() => {
              const next = !fvMode;
              if (!confirm(next
                ? "SURE? ON করলে সব user ১০ first-verify করলেই mining শুরু হবে — re-verify লাগবে না।"
                : "SURE? OFF করলে re-verify না করলে mining চালু হবে না। যারা first-verify মোডে চালু ছিল তাদেরও off হয়ে যেতে পারে।")) return;
              toggleFvMode.mutate(next);
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${fvMode ? "bg-emerald" : "bg-surface-2 border border-border"} disabled:opacity-50`}>
            <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${fvMode ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {fvMode
            ? "⚡ এখন যে কেউ ১০টা face first-verify complete করলেই তার mining auto চালু হয়ে যাবে। Not-whitelist হলে mining off হয়ে re-verify চাইবে।"
            : "🔒 Default rule: প্রথম verify complete হলে mining চালু হবে না। ১০টা face re-verify complete করতে হবে, তবেই mining শুরু। (individual user er জন্য admin manual override use করা যাবে)"}
        </p>
      </div>

      {/* Android APK ডাউনলোড লিংক */}
      <div className="rounded-2xl p-4 border-2 border-emerald/40 bg-emerald/5 space-y-2">
        <p className="text-[11px] uppercase tracking-widest font-black text-emerald">📲 Android অ্যাপ ডাউনলোড লিংক</p>
        <input
          value={apkUrl}
          onChange={(e) => setApkUrl(e.target.value)}
          placeholder="https://... (APK file link অথবা Play Store link)"
          className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-bold" />
        <input
          value={apkVer}
          onChange={(e) => setApkVer(e.target.value)}
          placeholder="ভার্সন (যেমন 1.0.0) — optional"
          className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-bold" />
        <p className="text-[10px] text-muted-foreground leading-snug">
          লিংক দিলেই লগইন পেজ ও হোম পেজে সব ইউজার "অ্যাপ ডাউনলোড" কার্ড দেখবে। খালি রাখলে কার্ড দেখাবে না।
          Play Store-এ published হলে এখানে Play Store লিংক বসিয়ে দিন — কার্ডটা তখন Play Store-এ নিয়ে যাবে।
          নিচের Save বাটনে চাপুন।
        </p>
      </div>

      {/* Gmail কোড (OTP) সিস্টেম Switch */}
      <div className={`rounded-2xl p-4 border-2 space-y-2 ${otpMode ? "border-cyan/50 bg-cyan/5" : "border-amber/50 bg-amber/5"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] uppercase tracking-widest font-black ${otpMode ? "text-cyan" : "text-amber"}`}>
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
              if (!confirm(next
                ? "SURE? ON করলে সবাইকে Gmail verification ও login কোড দিতে হবে।"
                : "SURE? OFF করলে Gmail verification/কোড লাগবে না — সব আগের মতো নম্বর+পাসওয়ার্ডে চলবে।")) return;
              setOtpMode(next);
              save.mutate({ email_otp_enabled: next });
            }}
            className={`shrink-0 w-16 h-9 rounded-full relative transition ${otpMode ? "bg-cyan" : "bg-surface-2 border border-border"} disabled:opacity-50`}>
            <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow transition-all ${otpMode ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {otpMode
            ? "🔐 এখন Gmail ছাড়া registration হবে না, login-এ কোড যাবে, password change-এও কোড লাগবে।"
            : "🕰️ Legacy mode: Gmail লাগবে না, কোড যাবে না, forgot-password admin থেকে reset করতে হবে।"}
        </p>
      </div>




      <div className="glass rounded-2xl p-4 space-y-3">
        <Field
          label="১) First-verify বোনাস (ইউজারের নিজের)"
          hint="১০ জন first verify complete হলে ইউজার নিজে এই টাকা পাবে (default 50৳)"
          value={fv} onChange={setFv} color="cyan" />
        <Field
          label="২) Re-verify বোনাস (ইউজারের নিজের)"
          hint="১০ জন re-verify complete + mining চালু (default 200৳)"
          value={rv} onChange={setRv} color="amber" />
        <Field
          label="৩) Referrer বোনাস"
          hint="যাকে refer করা হয়েছে সে ১০ first verify complete করলে referrer এই টাকা পাবে (default 100৳)"
          value={rf} onChange={setRf} color="violet" />

        <div className="rounded-xl bg-gradient-to-r from-amber/20 to-rose/20 border border-amber/40 p-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-amber">Total banner amount</p>
          <p className="text-2xl font-black text-navy mono-num">{total}৳</p>
          <p className="text-[10px] text-muted-foreground mt-1">Home banner এ এই টাকা দেখাবে</p>
        </div>

        {/* 2X Promo window */}
        <div className={`rounded-xl border-2 p-3 space-y-2 ${promoActive ? "border-rose bg-rose/5" : "border-border bg-surface-2"}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black text-rose">🔥 2X Bonus Promo</p>
            <button
              type="button"
              onClick={() => setPromoActive(!promoActive)}
              className={`w-14 h-7 rounded-full relative transition ${promoActive ? "bg-rose" : "bg-surface-2 border border-border"}`}>
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all ${promoActive ? "left-8" : "left-1"}`} />
            </button>
          </div>
          <input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)}
            placeholder="Banner title (e.g. 🎊 2X বোনাস অফার!)"
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs outline-none focus:border-rose" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground font-bold">Start</label>
              <input type="datetime-local" value={promoStart} onChange={(e) => setPromoStart(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs outline-none" />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground font-bold">End</label>
              <input type="datetime-local" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-xs outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <PromoNum label="First" value={pFv} onChange={setPFv} />
            <PromoNum label="Re-vf"  value={pRv} onChange={setPRv} />
            <PromoNum label="Refer" value={pRf} onChange={setPRf} />
          </div>
          <p className="text-[9px] text-muted-foreground leading-snug">
            Active থাকলে Start–End সময়ের মধ্যে এই টাকা কাজ করবে, বাকি সময়ে base rate চালু।
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
            OFF করলে সব withdraw বন্ধ। কোনো অটো সাপ্তাহিক বন্ধ নেই — শুক্রবারেও withdraw চালু থাকে (শুধু জুমা মোবারক ব্যানার দেখায়)।
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
          <PayoutRow name="বিকাশ" on={bkashOn} setOn={setBkashOn} msg={bkashMsg} setMsg={setBkashMsg} />
          <PayoutRow name="নগদ"  on={nagadOn} setOn={setNagadOn} msg={nagadMsg} setMsg={setNagadMsg} />
          <PayoutRow name="মোবাইল রিচার্জ" on={rechargeOn} setOn={setRechargeOn} msg={rechargeMsg} setMsg={setRechargeMsg} />
          <PayoutRow name="USDT (Celo)" on={usdtOn} setOn={setUsdtOn} msg={usdtMsg} setMsg={setUsdtMsg} />
          <p className="text-[9px] text-muted-foreground">
            কোনো method OFF করলে user সেখান দিয়ে withdraw/recharge দিতে পারবে না, message টা তাকে দেখানো হবে।
          </p>
        </div>

        <button
          onClick={() => save.mutate(undefined)}
          disabled={save.isPending}
          className="w-full py-3 rounded-xl gradient-cta text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
      </div>
    </div>
  );
}

function Field({ label, hint, value, onChange, color }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; color: "cyan" | "amber" | "violet";
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

function PromoNum({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="rounded-lg bg-background border border-border p-2">
      <p className="text-[9px] uppercase text-rose font-black">{label}</p>
      <input type="number" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-0.5 bg-transparent text-base font-black mono-num outline-none" />
    </div>
  );
}

function PayoutRow({ name, on, setOn, msg, setMsg }: {
  name: string; on: boolean; setOn: (v: boolean) => void; msg: string; setMsg: (v: string) => void;
}) {
  return (
    <div className="rounded-lg bg-background p-2 space-y-1 border border-border">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black">{name}</span>
        <button type="button" onClick={() => setOn(!on)}
          className={`w-12 h-6 rounded-full relative transition ${on ? "bg-emerald" : "bg-rose/60"}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-6" : "left-1"}`} />
        </button>
      </div>
      {!on && (
        <input value={msg} onChange={(e) => setMsg(e.target.value)}
          placeholder={`${name} বন্ধ থাকলে user কে যে message দেখাবে`}
          className="w-full px-2 py-1.5 rounded-lg bg-surface-2 border border-border text-[11px] outline-none focus:border-rose" />
      )}
    </div>
  );
}

