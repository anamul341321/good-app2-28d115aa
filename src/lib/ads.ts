import { Capacitor } from "@capacitor/core";

/**
 * Good-App Ads (Google AdMob) — শুধুমাত্র Android/iOS অ্যাপে চলে।
 *
 * ⚠️ নিচের ID গুলো Google-এর টেস্ট ID — নিজের AdMob অ্যাকাউন্টের ID বসান:
 * 1) https://admob.google.com এ অ্যাপ যোগ করুন
 * 2) App ID → android/app/src/main/AndroidManifest.xml এ meta-data তে বসান
 * 3) Interstitial + Rewarded ad unit ID → নিচে বসান
 * টেস্ট ID রেখে আসল ইনকাম আশা করা যাবে না (টেস্ট অ্যাডে টাকা আসে না)।
 */
export const ADS_CONFIG = {
  // Google টেস্ট Ad Unit IDs — পরে নিজেরটা দিয়ে বদলান
  interstitialId: "ca-app-pub-3940256099942544/1033173712",
  rewardedId: "ca-app-pub-3940256099942544/5224354917",
  // দিনে সর্বোচ্চ কতবার app-open (interstitial) অ্যাড দেখাবে
  dailyInterstitialLimit: 1,
};

const isNative = () => Capacitor.isNativePlatform();

async function getAdMob() {
  if (!isNative()) return null;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    return AdMob;
  } catch {
    return null;
  }
}

/** অ্যাপ চালু হলে একবার কল করুন — AdMob initialize করে */
export async function initAds() {
  const AdMob = await getAdMob();
  if (!AdMob) return;
  try {
    await AdMob.initialize({ initializeForTesting: false });
  } catch (e) {
    console.warn("AdMob init failed", e);
  }
}

const DAY_KEY = "ga_last_daily_ad";

/**
 * দিনের প্রথমবার অ্যাপে ঢুকলে একটি interstitial অ্যাড দেখায়।
 * একই দিনে আবার দেখায় না (localStorage দিয়ে ট্র্যাক)।
 */
export async function showDailyAppOpenAd() {
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
      adId: ADS_CONFIG.interstitialId,
      isTesting: false,
    });
    await AdMob.showInterstitial();
    localStorage.setItem(DAY_KEY, today);
  } catch {
    // অ্যাড লোড না হলে চুপচাপ বাদ — ইউজারকে বিরক্ত করা যাবে না
  }
}

/**
 * Rewarded অ্যাড দেখিয়ে সফল হলে true দেয়।
 * ভবিষ্যতে "অ্যাড দেখে ছোট বোনাস" ফিচারে ব্যবহার করা যাবে।
 */
export async function showRewardedAd(): Promise<boolean> {
  const AdMob = await getAdMob();
  if (!AdMob) return false;
  try {
    await AdMob.prepareRewardVideoAd({ adId: ADS_CONFIG.rewardedId, isTesting: false });
    const res = await AdMob.showRewardVideoAd();
    return !!(res as any)?.reward;
  } catch {
    return false;
  }
}
