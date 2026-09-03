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
let openAdLoading: Promise<boolean> | null = null;

/**
 * অ্যাপে ঢোকার পরপরই একটি interstitial অ্যাড দেখায় (প্রতিবার খুললেই)।
 * পরপর দুইবার না দেখাতে ৩ মিনিটের ছোট cooldown আছে।
 */
export async function showDailyAppOpenAd(): Promise<boolean> {
  if (!isNative()) return false;
  const cfg = await loadAdsConfig();
  if (!cfg.enabled || !cfg.appOpen) return false;
  if (Date.now() - lastOpenAdAt < OPEN_AD_COOLDOWN_MS) return true;
  if (openAdLoading) return openAdLoading;
  openAdLoading = showUnityInterstitial(false).then((shown) => {
    if (shown) lastOpenAdAt = Date.now();
    return shown;
  });
  try {
    return await openAdLoading;
  } finally {
    openAdLoading = null;
  }
}

/** Rewarded অ্যাড — ইউজার পুরোটা দেখলে true (তখনই রিওয়ার্ড দেওয়া হয়) */
export async function showRewardedAd(): Promise<boolean> {
  if (!isNative()) throw new Error("অ্যাড শুধু Android অ্যাপে দেখা যাবে");
  const cfg = await loadAdsConfig();
  if (!cfg.enabled) throw new Error("অ্যাড সিস্টেম এখন বন্ধ আছে");
  if (!cfg.rewarded) throw new Error("Rewarded ad এখন বন্ধ আছে");
  if (!unityAvailable()) {
    // Unity নেই → Monetag fallback
    return showMonetagRewardFallback();
  }

  if (!(await initUnityAds(false))) {
    return showMonetagRewardFallback();
  }
  try {
    return await showUnityRewarded(false);
  } catch {
    // Unity no-fill বা অন্য সমস্যা → Monetag vignette দেখিয়ে রিওয়ার্ড দেই,
    // যাতে ইউজার কখনো "অ্যাড নেই" দেখে ব্যর্থ না হয়।
    return showMonetagRewardFallback();
  }
}

/**
 * Unity ব্যর্থ হলে Monetag vignette দেখায়। APK আসলে ওয়েবসাইট WebView হিসেবে
 * চলে, তাই vignette script এখানেও কাজ করে এবং earning Monetag dashboard-এ যায়।
 * অ্যাড render হওয়ার জন্য কিছু সময় দেই, তারপর রিওয়ার্ড allow করি।
 */
function showMonetagRewardFallback(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const s = document.createElement("script");
      s.src = `https://n6wxm.com/vignette.min.js?_=${Date.now()}`;
      s.dataset.zone = "11713170";
      s.async = true;
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
      // Vignette সাধারণত সাথে সাথেই ওপেন হয়; ১২ সেকেন্ড পর রিওয়ার্ড দেই।
      window.setTimeout(() => resolve(true), 12_000);
    } catch {
      resolve(false);
    }
  });
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
