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
 * ডিভাইসে চালিয়ে AdMob-এর আসল error ধরার ডায়াগনস্টিক।
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
      : "ব্রাউজারে চলছে — ব্রাউজারে AdMob কখনোই চলবে না, APK-তে খুলুন",
  });
  if (!native) return steps;

  const pluginAvailable = Capacitor.isPluginAvailable("AdMob");
  steps.push({
    name: "2. AdMob native plugin",
    ok: pluginAvailable,
    detail: pluginAvailable
      ? "plugin bridge পাওয়া গেছে"
      : "APK-তে AdMob plugin নেই — নতুন APK build করে ইনস্টল করতে হবে",
  });
  if (!pluginAvailable) return steps;

  let cfg;
  try {
    cfg = await loadAdsConfig();
    steps.push({
      name: "3. Admin ad settings",
      ok: cfg.enabled,
      detail: `enabled=${cfg.enabled} test=${cfg.test} banner=${cfg.banner} appOpen=${cfg.appOpen} rewarded=${cfg.rewarded}`,
    });
  } catch (e) {
    steps.push({ name: "3. Admin ad settings", ok: false, detail: msg(e) });
    return steps;
  }
  if (!cfg.enabled) return steps;

  // Unity Ads প্রথমে যাচাই — এটিই এখন প্রধান নেটওয়ার্ক
  try {
    const { unityAvailable, initUnityAds, showUnityInterstitial, UNITY_ADS } = await import(
      "@/lib/unity-ads"
    );
    const has = unityAvailable();
    steps.push({
      name: "U1. Unity Ads plugin",
      ok: has,
      detail: has ? `gameId ${UNITY_ADS.gameId}` : "এই APK-তে Unity plugin নেই — নতুন APK build করুন",
    });
    if (has) {
      const init = await initUnityAds(cfg.test);
      steps.push({ name: "U2. Unity initialize()", ok: init, detail: init ? "ok" : "init ব্যর্থ" });
      if (init) {
        const shown = await showUnityInterstitial(cfg.test);
        steps.push({
          name: "U3. Unity Interstitial",
          ok: shown,
          detail: shown ? "অ্যাড দেখানো হয়েছে" : `load/show হয়নি (${UNITY_ADS.interstitial})`,
        });
      }
    }
  } catch (e) {
    steps.push({ name: "U1. Unity Ads", ok: false, detail: msg(e) });
  }

  let AdMob: any;
  try {
    AdMob = (await import("@capacitor-community/admob")).AdMob;
    steps.push({ name: "4. Plugin import", ok: !!AdMob, detail: AdMob ? "ok" : "AdMob undefined" });
  } catch (e) {
    steps.push({ name: "4. Plugin import", ok: false, detail: msg(e) });
    return steps;
  }

  try {
    const r = await AdMob.initialize({ initializeForTesting: cfg.test });
    steps.push({ name: "5. AdMob.initialize()", ok: true, detail: JSON.stringify(r ?? {}) || "ok" });
  } catch (e) {
    steps.push({ name: "5. AdMob.initialize()", ok: false, detail: msg(e) });
    return steps;
  }

  // Interstitial (app-open) — real load result, not a guess
  const interstitialId = cfg.test
    ? "ca-app-pub-3940256099942544/1033173712"
    : cfg.interstitialUnit || "ca-app-pub-3940256099942544/1033173712";
  try {
    await AdMob.prepareInterstitial({ adId: interstitialId, isTesting: cfg.test });
    steps.push({ name: "6. prepareInterstitial()", ok: true, detail: `loaded: ${interstitialId}` });
    try {
      await AdMob.showInterstitial();
      steps.push({ name: "7. showInterstitial()", ok: true, detail: "অ্যাড দেখানো হয়েছে" });
    } catch (e) {
      steps.push({ name: "7. showInterstitial()", ok: false, detail: msg(e) });
    }
  } catch (e) {
    steps.push({
      name: "6. prepareInterstitial()",
      ok: false,
      detail: `${msg(e)} (adId: ${interstitialId})`,
    });
  }

  return steps;
}
