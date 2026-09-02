import { Capacitor } from "@capacitor/core";
import { loadAdsConfig } from "@/lib/ads-config";

export type DiagStep = { name: string; ok: boolean; detail: string };

const msg = (e: unknown) => {
  if (!e) return "unknown";
  if (typeof e === "string") return e;
  const any = e as any;
  return any?.message ?? any?.error ?? JSON.stringify(any);
};

/**
 * ডিভাইসে চালিয়ে Unity Ads-এর আসল ফল/error ধরার ডায়াগনস্টিক।
 * কোনো অনুমান নয় — প্রতিটি native step এর সত্যিকারের ফল দেখায়।
 */
export async function runAdsDiagnostics(): Promise<DiagStep[]> {
  const steps: DiagStep[] = [];
  const native = Capacitor.isNativePlatform();
  steps.push({
    name: "1. Native app (APK)",
    ok: native,
    detail: native
      ? `platform: ${Capacitor.getPlatform()}`
      : "ব্রাউজারে চলছে — ব্রাউজারে অ্যাড কখনোই চলবে না, APK-তে খুলুন",
  });
  if (!native) return steps;

  let cfg;
  try {
    cfg = await loadAdsConfig();
    steps.push({
      name: "2. Admin ad settings",
      ok: cfg.enabled,
      detail: `enabled=${cfg.enabled} banner=${cfg.banner} appOpen=${cfg.appOpen} rewarded=${cfg.rewarded} (সবসময় live ad)`,
    });
  } catch (e) {
    steps.push({ name: "2. Admin ad settings", ok: false, detail: msg(e) });
    return steps;
  }
  if (!cfg.enabled) return steps;

  try {
    const { unityAvailable, initUnityAds, showUnityInterstitial, showUnityBanner, hideUnityBanner, UNITY_ADS } =
      await import("@/lib/unity-ads");

    const has = unityAvailable();
    steps.push({
      name: "3. Unity Ads plugin",
      ok: has,
      detail: has ? `gameId ${UNITY_ADS.gameId}` : "এই APK-তে Unity plugin নেই — নতুন APK build করুন",
    });
    if (!has) return steps;

    const init = await initUnityAds(false);
    steps.push({ name: "4. Unity initialize()", ok: init, detail: init ? "ok (live mode)" : "init ব্যর্থ" });
    if (!init) return steps;

    const shown = await showUnityInterstitial(false);
    steps.push({
      name: "5. Interstitial অ্যাড",
      ok: shown,
      detail: shown ? "অ্যাড দেখানো হয়েছে" : `load/show হয়নি (${UNITY_ADS.interstitial}) — Unity dashboard-এ placement চালু আছে কি না দেখুন`,
    });

    const banner = await showUnityBanner(false);
    steps.push({
      name: "6. Banner অ্যাড",
      ok: banner,
      detail: banner ? "banner দেখানো হয়েছে" : `banner আসেনি (${UNITY_ADS.banner})`,
    });
    if (banner) await hideUnityBanner();
  } catch (e) {
    steps.push({ name: "3. Unity Ads", ok: false, detail: msg(e) });
  }

  return steps;
}
