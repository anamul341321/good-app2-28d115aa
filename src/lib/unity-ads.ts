import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Unity Ads — Good-App-এর প্রধান অ্যাড নেটওয়ার্ক।
 * Unity Ads Play Store listing ছাড়াও আসল অ্যাড দেয়, তাই AdMob no-fill দিলেও
 * এখান থেকে অ্যাড আসে এবং আয় হয় (Unity dashboard → Monetize → Revenue)।
 */
export const UNITY_ADS = {
  gameId: "800366349",
  rewarded: "Rewarded_Android",
  interstitial: "Interstitial_Android",
  banner: "Banner_Android",
};

type UnityAdsPlugin = {
  initialize(options: { gameId: string; testMode: boolean }): Promise<{ initialized: boolean }>;
  show(options: { placementId: string }): Promise<{ shown: boolean; completed: boolean }>;
  showBanner(options: { placementId: string }): Promise<{ shown: boolean }>;
  hideBanner(): Promise<void>;
};

const UnityAdsNative = registerPlugin<UnityAdsPlugin>("UnityAds");

export function unityAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("UnityAds");
}

let ready: Promise<boolean> | null = null;

/** একবারই initialize হয় — পরে সব কল সাথে সাথে কাজ করে */
export function initUnityAds(testMode = false): Promise<boolean> {
  if (!unityAvailable()) return Promise.resolve(false);
  if (!ready) {
    ready = UnityAdsNative.initialize({ gameId: UNITY_ADS.gameId, testMode })
      .then((r) => r.initialized === true)
      .catch((e) => {
        console.warn("Unity Ads init failed", e);
        ready = null;
        return false;
      });
  }
  return ready;
}

/** Interstitial দেখায় — সফল হলে true */
export async function showUnityInterstitial(testMode = false): Promise<boolean> {
  if (!(await initUnityAds(testMode))) return false;
  try {
    const r = await UnityAdsNative.show({ placementId: UNITY_ADS.interstitial });
    return r.shown === true;
  } catch (e) {
    console.warn("Unity interstitial failed", e);
    return false;
  }
}

/** Rewarded দেখায় — ইউজার পুরোটা দেখলে true (রিওয়ার্ড দেওয়া যাবে) */
export async function showUnityRewarded(testMode = false): Promise<boolean> {
  if (!(await initUnityAds(testMode))) throw new Error("Unity Ads চালু করা যায়নি");
  const r = await UnityAdsNative.show({ placementId: UNITY_ADS.rewarded });
  return r.completed === true;
}

export async function showUnityBanner(testMode = false): Promise<boolean> {
  if (!(await initUnityAds(testMode))) return false;
  try {
    const r = await UnityAdsNative.showBanner({ placementId: UNITY_ADS.banner });
    return r.shown === true;
  } catch (e) {
    console.warn("Unity banner failed", e);
    return false;
  }
}

export async function hideUnityBanner(): Promise<void> {
  if (!unityAvailable()) return;
  try {
    await UnityAdsNative.hideBanner();
  } catch {
    /* ignore */
  }
}
