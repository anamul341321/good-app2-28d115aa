import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MonitorPlay, Save } from "lucide-react";
import { adminGetBonusSettings, adminSetAdsSettings } from "@/lib/admin.functions";
import type { DiagStep } from "@/lib/ads-diagnostics";

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

  const [diag, setDiag] = useState<DiagStep[]>([]);
  const [diagRunning, setDiagRunning] = useState(false);

  const runDiag = async () => {
    setDiagRunning(true);
    setDiag([]);
    try {
      const { runAdsDiagnostics } = await import("@/lib/ads-diagnostics");
      setDiag(await runAdsDiagnostics());
    } catch (e: any) {
      setDiag([{ name: "Diagnostic crash", ok: false, detail: e?.message ?? String(e) }]);
    } finally {
      setDiagRunning(false);
    }
  };

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
        <p className="text-[11px] font-black text-navy">📺 Unity Ads (আসল অ্যাড)</p>
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
          মাস্টার সুইচ ON করলেই ইউজাররা আসল Unity অ্যাড দেখবে এবং আয় গোনা হবে।
        </p>

      </div>

      <div className="space-y-2 opacity-100">
        <div className="rounded-xl bg-emerald/10 p-2.5 border border-emerald/30">
          <p className="text-[11px] font-bold text-navy">✅ সবসময় আসল (Live) Unity Ads</p>
          <p className="text-[9px] text-muted-foreground">
            Test Mode বাদ দেওয়া হয়েছে — অ্যাপে সবসময় আসল অ্যাড আসবে, তাই Unity Dashboard-এ আয় গোনা হবে।
          </p>
        </div>

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


      <div className="rounded-xl bg-white/5 p-2.5">
        <p className="text-[11px] font-bold text-navy">Unity Ads — Game ID 800366349</p>
        <p className="text-[9px] text-muted-foreground">
          Placement: Rewarded_Android / Interstitial_Android / Banner_Android — কোনো Ad Unit ID বসাতে হবে না।
        </p>
      </div>

      <button
        disabled={save.isPending}
        onClick={() => save.mutate({ enabled: on })}
        className="w-full rounded-xl bg-cyan/90 py-2.5 text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        অ্যাড সেটিং সেভ করুন
      </button>

      <div className="rounded-xl border border-cyan/40 bg-cyan/5 p-3 space-y-2">
        <p className="text-[11px] font-black text-navy">🔎 Ad Diagnostic (ফোনে চালান)</p>
        <p className="text-[9px] text-muted-foreground">
          APK-তে এই বাটনে চাপ দিলে AdMob-এর প্রতিটি ধাপের আসল ফল/এরর দেখাবে — কেন অ্যাড আসছে না তা নিশ্চিতভাবে বোঝা যাবে।
        </p>
        <button
          disabled={diagRunning}
          onClick={runDiag}
          className="w-full rounded-xl bg-navy/90 py-2.5 text-xs font-black text-white disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {diagRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorPlay className="w-4 h-4" />}
          অ্যাড টেস্ট চালান
        </button>
        {diag.length > 0 && (
          <div className="space-y-1">
            {diag.map((s) => (
              <div key={s.name} className="rounded-lg bg-white/5 p-2">
                <p className={`text-[10px] font-black ${s.ok ? "text-emerald" : "text-rose"}`}>
                  {s.ok ? "✅" : "❌"} {s.name}
                </p>
                <p className="text-[9px] break-all text-muted-foreground">{s.detail}</p>
              </div>
            ))}
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(
                  diag.map((s) => `${s.ok ? "OK" : "FAIL"} ${s.name}: ${s.detail}`).join("\n"),
                );
                toast.success("রিপোর্ট কপি হয়েছে");
              }}
              className="w-full rounded-xl bg-white/10 py-2 text-[10px] font-bold"
            >
              রিপোর্ট কপি করুন
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
