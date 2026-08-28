import { Capacitor } from "@capacitor/core";
import { loadAdsConfig } from "@/lib/ads-config";

/**
 * Good-App Ads (Google AdMob) — শুধুমাত্র Android/iOS অ্যাপে চলে এবং
 * অ্যাডমিন প্যানেলের "Ads" সুইচ ON থাকলেই চলে (ডিফল্ট OFF)।
 *
 * ⚠️ নিচের ID গুলো Google-এর টেস্ট ID — অ্যাডমিন প্যানেলে আসল Ad Unit ID
 * বসালে সেগুলোই ব্যবহার হবে। App ID বসাতে হবে
 * android/app/src/main/AndroidManifest.xml এর meta-data তে।
 */
export const ADS_CONFIG = {
  interstitialId: "ca-app-pub-3940256099942544/1033173712",
  rewardedId: "ca-app-pub-3940256099942544/5224354917",
  bannerId: "ca-app-pub-3940256099942544/6300978111",
  dailyInterstitialLimit: 1,
};

const isNative = () => Capacitor.isNativePlatform();

/**
 * টেস্ট মোড ON থাকলে সবসময় Google-এর স্যাম্পল Ad Unit ব্যবহার হয় —
 * আসল ID + isTesting মিশে গেলে AdMob কোনো অ্যাড দেয় না (no-fill),
 * তাই টেস্ট করার সময় অ্যাড দেখাই যেত না।
 */
function pickUnit(test: boolean, custom: string | null, sample: string) {
  return test ? sample : custom || sample;
}

async function getAdMob() {
  if (!isNative()) return null;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    return AdMob;
  } catch {
    return null;
  }
}

let initialized = false;

/** অ্যাপ চালু হলে একবার কল করুন — AdMob initialize করে (সুইচ ON হলে) */
export async function initAds() {
  if (initialized) return;
  const cfg = await loadAdsConfig();
  if (!cfg.enabled) return;
  const AdMob = await getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: cfg.test });
    initialized = true;
  } catch (e) {
    console.warn("AdMob init failed", e);
  }
}


const DAY_KEY = "ga_last_daily_ad";

/**
 * দিনের প্রথমবার অ্যাপে ঢুকলে একটি interstitial অ্যাড দেখায়।
 * একই দিনে আবার দেখায় না (localStorage দিয়ে ট্র্যাক) — যাতে ইউজার বিরক্ত না হয়।
 */
export async function showDailyAppOpenAd() {
  const cfg = await loadAdsConfig();
  if (!cfg.appOpen) return;
  if (ADS_CONFIG.dailyInterstitialLimit <= 0) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(DAY_KEY) === today) return;
  } catch {
    return;
  }
  const AdMob = await getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.prepareInterstitial({
      adId: pickUnit(cfg.test, cfg.interstitialUnit, ADS_CONFIG.interstitialId),
      isTesting: cfg.test,
    });

    await AdMob.showInterstitial();
    localStorage.setItem(DAY_KEY, today);
  } catch {
    // অ্যাড লোড না হলে চুপচাপ বাদ — ইউজারকে বিরক্ত করা যাবে না
  }
}

/** Rewarded অ্যাড দেখিয়ে সফল হলে true দেয় (ইউজার নিজে ইচ্ছা করে দেখে) */
export async function showRewardedAd(): Promise<boolean> {
  const cfg = await loadAdsConfig();
  if (!cfg.rewarded) return false;
  await initAds();
  const AdMob = await getAdMob();
  if (!AdMob) return false;
  try {
    await AdMob.prepareRewardVideoAd({
      adId: pickUnit(cfg.test, cfg.rewardedUnit, ADS_CONFIG.rewardedId),
      isTesting: cfg.test,
    });

    const res = await AdMob.showRewardVideoAd();
    return !!(res as any)?.reward;
  } catch {
    return false;
  }
}

let bannerShown = false;

/** নিচে ছোট একটি banner অ্যাড দেখায় (নন-ইন্ট্রুসিভ, কনটেন্ট ঢাকে না) */
export async function showBottomBanner(): Promise<boolean> {
  const cfg = await loadAdsConfig();
  if (!cfg.banner) return false;
  await initAds();
  const AdMob = await getAdMob();
  if (!AdMob) return false;
  if (bannerShown) return true;
  try {
    const { BannerAdSize, BannerAdPosition } = await import("@capacitor-community/admob");
    await AdMob.showBanner({
      adId: pickUnit(cfg.test, cfg.bannerUnit, ADS_CONFIG.bannerId),
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: cfg.test,
    });

    bannerShown = true;
    return true;
  } catch {
    // অ্যাড না এলে নিচে কোনো জায়গা রাখা হবে না
    return false;
  }
}

/** ব্যানার সরিয়ে দেয় (পেজ ছাড়লে) */
export async function hideBottomBanner() {
  const AdMob = await getAdMob();
  if (!AdMob || !bannerShown) return;
  try {
    await AdMob.removeBanner();
  } catch {
    /* ignore */
  }
  bannerShown = false;
}

/** ব্যানার অ্যাড আসলে চালু আছে কি না (UI-তে জায়গা রাখার জন্য) */
export async function isBannerActive(): Promise<boolean> {
  if (!isNative()) return false;
  const cfg = await loadAdsConfig();
  return cfg.banner;
}
