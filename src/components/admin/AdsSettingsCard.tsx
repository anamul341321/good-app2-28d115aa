import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MonitorPlay, Save } from "lucide-react";
import { adminGetBonusSettings, adminSetAdsSettings } from "@/lib/admin.functions";

function Toggle({
  on,
  onChange,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`shrink-0 w-14 h-8 rounded-full relative transition ${on ? "bg-emerald" : "bg-rose"} disabled:opacity-50`}
    >
      <span
        className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`}
      />
    </button>
  );
}

/** অ্যাডমিন প্যানেল — Google AdMob অ্যাড সিস্টেম নিয়ন্ত্রণ */
export function AdsSettingsCard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-ads-settings"],
    queryFn: () => adminGetBonusSettings() as Promise<any>,
  });

  const [on, setOn] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [banner, setBanner] = useState(true);
  const [rewarded, setRewarded] = useState(true);
  const [appOpen, setAppOpen] = useState(true);
  const [bannerUnit, setBannerUnit] = useState("");
  const [interstitialUnit, setInterstitialUnit] = useState("");
  const [rewardedUnit, setRewardedUnit] = useState("");

  useEffect(() => {
    if (!data) return;
    setOn(data.ads_enabled === true);
    setTestMode(data.ads_test_mode === true);
    setBanner(data.ads_banner_enabled !== false);
    setRewarded(data.ads_rewarded_enabled !== false);
    setAppOpen(data.ads_appopen_enabled !== false);
    setBannerUnit(data.ads_banner_unit ?? "");
    setInterstitialUnit(data.ads_interstitial_unit ?? "");
    setRewardedUnit(data.ads_rewarded_unit ?? "");
  }, [data]);


  const save = useMutation({
    mutationFn: (next: { enabled: boolean; testMode?: boolean }) =>
      adminSetAdsSettings({
        data: {
          enabled: next.enabled,
          testMode: next.testMode ?? testMode,
          banner,
          rewarded,
          appOpen,
          bannerUnit,
          interstitialUnit,
          rewardedUnit,
        },
      }),

    onSuccess: () => {
      toast.success("অ্যাড সেটিং সেভ হয়েছে");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "সেভ হয়নি"),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 flex items-center gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> লোড হচ্ছে…
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MonitorPlay className="w-4 h-4 text-cyan" />
        <p className="text-[11px] font-black text-navy">📺 Google Ads (AdMob)</p>
      </div>

      <div
        className={`rounded-xl border-2 p-3 ${on ? "border-emerald/60 bg-emerald/10" : "border-rose/60 bg-rose/10"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-navy">মাস্টার সুইচ</p>
            <p className={`text-sm font-black mt-0.5 ${on ? "text-emerald" : "text-rose"}`}>
              {on
                ? "চালু — ইউজাররা অ্যাড দেখতে পাবে (Ad Boost কাজ করবে)"
                : "বন্ধ — অ্যাপ আগের মতোই সম্পূর্ণ অ্যাড-মুক্ত"}
            </p>
          </div>
          <Toggle
            on={on}
            disabled={save.isPending}
            onChange={(v) => {
              setOn(v);
              save.mutate({ enabled: v });
            }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">
          মাস্টার সুইচ ON করলেই কাজ করে — নিচের "Test Mode" ON থাকলে Google-এর demo ID দিয়ে টেস্ট অ্যাড দেখাবে (কোনো আয় হবে না)।
        </p>

      </div>

      <div className="space-y-2 opacity-100">
        {[
          {
            label: "Banner অ্যাড (স্ক্রিনের নিচে ছোট)",
            v: banner,
            set: setBanner,
            hint: "কনটেন্ট ঢাকে না — Google policy-safe",
          },
          {
            label: "Rewarded অ্যাড (Ad Boost)",
            v: rewarded,
            set: setRewarded,
            hint: "ইউজার নিজে ইচ্ছা করে দেখে, বাধ্যতামূলক নয়",
          },
          {
            label: "দিনে ১টি App-open অ্যাড",
            v: appOpen,
            set: setAppOpen,
            hint: "দিনের প্রথমবার ঢুকলে একবারই",
          },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-2.5">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-navy">{r.label}</p>
              <p className="text-[9px] text-muted-foreground">{r.hint}</p>
            </div>
            <Toggle on={r.v} disabled={!on || save.isPending} onChange={r.set} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {[
          { label: "Banner Ad Unit ID", v: bannerUnit, set: setBannerUnit },
          { label: "Interstitial Ad Unit ID", v: interstitialUnit, set: setInterstitialUnit },
          { label: "Rewarded Ad Unit ID", v: rewardedUnit, set: setRewardedUnit },
        ].map((f) => (
          <label key={f.label} className="block">
            <span className="text-[10px] font-bold text-muted-foreground">{f.label}</span>
            <input
              value={f.v}
              onChange={(e) => f.set(e.target.value)}
              placeholder="ca-app-pub-…/…"
              className="mt-1 w-full rounded-xl bg-white/10 px-3 py-2 text-xs outline-none"
            />
          </label>
        ))}
      </div>

      <button
        disabled={save.isPending}
        onClick={() => save.mutate({ enabled: on })}
        className="w-full rounded-xl bg-cyan/90 py-2.5 text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        অ্যাড সেটিং সেভ করুন
      </button>
    </div>
  );
}
