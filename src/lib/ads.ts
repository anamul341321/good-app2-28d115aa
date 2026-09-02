import { Capacitor } from "@capacitor/core";
import { loadAdsConfig } from "@/lib/ads-config";
import {
  initUnityAds,
  showUnityInterstitial,
  showUnityRewarded,
  showUnityBanner,
  hideUnityBanner,
  unityAvailable,
} from "@/lib/unity-ads";

/**
 * Good-App Ads — সম্পূর্ণ Unity Ads দিয়ে চলে (AdMob বাদ দেওয়া হয়েছে)।
 * শুধুমাত্র Android অ্যাপে চলে এবং অ্যাডমিন প্যানেলের "Ads" মাস্টার সুইচ ON থাকলেই চলে।
 * সবসময় আসল (live) অ্যাড — কোনো test ad নেই, তাই আয় হয়।
 */
const isNative = () => Capacitor.isNativePlatform();

/** অ্যাপ চালু হলে একবার কল করুন — Unity Ads initialize করে (সুইচ ON হলে) */
export async function initAds(): Promise<boolean> {
  if (!isNative()) return false;
  const cfg = await loadAdsConfig();
  if (!cfg.enabled) return false;
  return initUnityAds(false);
}

const OPEN_AD_COOLDOWN_MS = 3 * 60_000;
let lastOpenAdAt = 0;

/**
 * অ্যাপে ঢোকার পরপরই একটি interstitial অ্যাড দেখায় (প্রতিবার খুললেই)।
 * পরপর দুইবার না দেখাতে ৩ মিনিটের ছোট cooldown আছে।
 */
export async function showDailyAppOpenAd(): Promise<boolean> {
  if (!isNative()) return false;
  const cfg = await loadAdsConfig();
  if (!cfg.enabled || !cfg.appOpen) return false;
  if (Date.now() - lastOpenAdAt < OPEN_AD_COOLDOWN_MS) return true;

  const shown = await showUnityInterstitial(false);
  if (shown) lastOpenAdAt = Date.now();
  return shown;
}

/** Rewarded অ্যাড — ইউজার পুরোটা দেখলে true (তখনই রিওয়ার্ড দেওয়া হয়) */
export async function showRewardedAd(): Promise<boolean> {
  if (!isNative()) throw new Error("অ্যাড শুধু Android অ্যাপে দেখা যাবে");
  const cfg = await loadAdsConfig();
  if (!cfg.enabled) throw new Error("অ্যাড সিস্টেম এখন বন্ধ আছে");
  if (!cfg.rewarded) throw new Error("Rewarded ad এখন বন্ধ আছে");
  if (!unityAvailable()) throw new Error("এই APK-তে অ্যাড সিস্টেম নেই — নতুন ভার্সন ইনস্টল করুন");

  if (!(await initUnityAds(false))) {
    throw new Error("অ্যাড চালু করা যায়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন");
  }
  return showUnityRewarded(false);
}

let bannerShown = false;
let bannerLoading: Promise<boolean> | null = null;

/** নিচে ছোট একটি banner অ্যাড দেখায় (নন-ইন্ট্রুসিভ, কনটেন্ট ঢাকে না) */
export async function showBottomBanner(): Promise<boolean> {
  if (bannerShown) return true;
  if (bannerLoading) return bannerLoading;
  bannerLoading = (async () => {
    if (!isNative()) return false;
    const cfg = await loadAdsConfig();
    if (!cfg.enabled || !cfg.banner) return false;
    const ok = await showUnityBanner(false);
    bannerShown = ok;
    return ok;
  })();
  try {
    return await bannerLoading;
  } finally {
    bannerLoading = null;
  }
}

/** ব্যানার সরিয়ে দেয় (পেজ ছাড়লে) */
export async function hideBottomBanner() {
  if (!bannerShown) return;
  await hideUnityBanner();
  bannerShown = false;
}

/** ব্যানার অ্যাড আসলে চালু আছে কি না (UI-তে জায়গা রাখার জন্য) */
export async function isBannerActive(): Promise<boolean> {
  if (!isNative()) return false;
  const cfg = await loadAdsConfig();
  return cfg.enabled && cfg.banner;
}
