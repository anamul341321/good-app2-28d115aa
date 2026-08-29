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

const adErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const value = error as { message?: unknown; error?: unknown; code?: unknown };
    const message = value.message ?? value.error ?? value.code;
    if (typeof message === "string" || typeof message === "number") return String(message);
  }
  return "অজানা AdMob error";
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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
let initialization: Promise<boolean> | null = null;

/** অ্যাপ চালু হলে একবার কল করুন — AdMob initialize করে (সুইচ ON হলে) */
export async function initAds(): Promise<boolean> {
  if (initialized) return true;
  if (initialization) return initialization;
  initialization = initializeAds();
  try {
    return await initialization;
  } finally {
    initialization = null;
  }
}

async function initializeAds(): Promise<boolean> {
  const cfg = await withTimeout(loadAdsConfig(), 10_000, "অ্যাড সেটিংস লোড হতে সময় লেগেছে");
  if (!cfg.enabled) return false;
  const AdMob = await getAdMob();
  if (!AdMob) return false;
  try {
    await withTimeout(
      AdMob.initialize({ initializeForTesting: cfg.test }),
      15_000,
      "AdMob চালু হতে সময় লেগেছে",
    );
    initialized = true;
    return true;
  } catch (e) {
    console.warn("AdMob init failed", e);
    return false;
  }
}


const DAY_KEY = "ga_last_daily_ad";

/**
 * দিনের প্রথমবার অ্যাপে ঢুকলে একটি interstitial অ্যাড দেখায়।
 * একই দিনে আবার দেখায় না (localStorage দিয়ে ট্র্যাক) — যাতে ইউজার বিরক্ত না হয়।
 */
export async function showDailyAppOpenAd(): Promise<boolean> {
  const cfg = await loadAdsConfig();
  if (!cfg.appOpen) return false;
  if (ADS_CONFIG.dailyInterstitialLimit <= 0) return false;
  // টেস্ট মোডে দিনে-একবার সীমা মানা হয় না, যাতে অ্যাডমিন প্রতিবার যাচাই করতে পারেন
  if (!cfg.test) {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(DAY_KEY) === today) return true;
    } catch {
      return false;
    }
  }
  if (!(await initAds())) return false;
  const AdMob = await getAdMob();
  if (!AdMob) return false;

  try {
    await AdMob.prepareInterstitial({
      adId: pickUnit(cfg.test, cfg.interstitialUnit, ADS_CONFIG.interstitialId),
      isTesting: cfg.test,
    });

    await AdMob.showInterstitial();
    localStorage.setItem(DAY_KEY, new Date().toISOString().slice(0, 10));
    return true;
  } catch (error) {
    console.warn("AdMob app-open ad failed", error);
    // অ্যাড লোড না হলে চুপচাপ বাদ — ইউজারকে বিরক্ত করা যাবে না
    return false;
  }
}

/** Rewarded অ্যাড দেখিয়ে সফল হলে true দেয় (ইউজার নিজে ইচ্ছা করে দেখে) */
export async function showRewardedAd(): Promise<boolean> {
  if (!isNative()) throw new Error("অ্যাড শুধু Android অ্যাপে দেখা যাবে");
  const cfg = await withTimeout(loadAdsConfig(), 10_000, "অ্যাড সেটিংস লোড হয়নি — আবার চেষ্টা করুন");
  if (!cfg.enabled) throw new Error("অ্যাড সিস্টেম এখন বন্ধ আছে");
  if (!cfg.rewarded) throw new Error("Rewarded ad এখন বন্ধ আছে");
  if (!(await initAds())) throw new Error("AdMob চালু করা যায়নি — ইন্টারনেট দেখে আবার চেষ্টা করুন");
  const AdMob = await getAdMob();
  if (!AdMob) throw new Error("এই APK-তে AdMob plugin পাওয়া যায়নি");

  const { RewardAdPluginEvents } = await import("@capacitor-community/admob");
  const handles: Array<{ remove: () => Promise<void> }> = [];
  const removeListeners = async () => {
    await Promise.allSettled(handles.map((handle) => handle.remove()));
  };

  try {
    const loadEvent = new Promise<void>(async (resolve, reject) => {
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.Loaded, () => resolve()),
        await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
          reject(new Error(`অ্যাড লোড হয়নি: ${adErrorMessage(error)}`));
        }),
      );
    });

    const loadCommand = AdMob.prepareRewardVideoAd({
      adId: pickUnit(cfg.test, cfg.rewardedUnit, ADS_CONFIG.rewardedId),
      isTesting: cfg.test,
    }).then(() => undefined);

    // Some Android/WebView combinations emit Loaded but leave the bridge promise pending.
    // Accept either signal so the button cannot spin forever after the ad is ready.
    await withTimeout(
      Promise.race([loadCommand, loadEvent]),
      25_000,
      "Google ad server থেকে কোনো response আসেনি — নেটওয়ার্ক বদলে আবার চেষ্টা করুন",
    );

    const rewardEvent = new Promise<boolean>(async (resolve, reject) => {
      let rewarded = false;
      handles.push(
        await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
          rewarded = true;
          resolve(true);
        }),
        await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve(rewarded)),
        await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (error) => {
          reject(new Error(`অ্যাড দেখানো যায়নি: ${adErrorMessage(error)}`));
        }),
      );
    });
    const showCommand = AdMob.showRewardVideoAd().then((reward) => Boolean(reward));
    return await withTimeout(
      Promise.race([showCommand, rewardEvent]),
      3 * 60_000,
      "অ্যাডটি শেষ করা যায়নি — আবার চেষ্টা করুন",
    );
  } catch (error) {
    console.warn("AdMob rewarded ad failed", error);
    throw new Error(adErrorMessage(error));
  } finally {
    await removeListeners();
  }
}

let bannerShown = false;
let bannerLoading: Promise<boolean> | null = null;

/** নিচে ছোট একটি banner অ্যাড দেখায় (নন-ইন্ট্রুসিভ, কনটেন্ট ঢাকে না) */
export async function showBottomBanner(): Promise<boolean> {
  if (bannerShown) return true;
  if (bannerLoading) return bannerLoading;
  bannerLoading = loadBottomBanner();
  try {
    return await bannerLoading;
  } finally {
    bannerLoading = null;
  }
}

async function loadBottomBanner(): Promise<boolean> {
  const cfg = await loadAdsConfig();
  if (!cfg.banner) return false;
  if (!(await initAds())) return false;
  const AdMob = await getAdMob();
  if (!AdMob) return false;
  try {
    const { BannerAdSize, BannerAdPosition, BannerAdPluginEvents } = await import(
      "@capacitor-community/admob"
    );
    return await new Promise<boolean>(async (resolve) => {
      let settled = false;
      const finish = async (loaded: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        await Promise.all([loadedHandle.remove(), failedHandle.remove()]);
        bannerShown = loaded;
        resolve(loaded);
      };
      const loadedHandle = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
        void finish(true);
      });
      const failedHandle = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => {
        console.warn("AdMob banner failed", error);
        void finish(false);
      });
      const timeout = window.setTimeout(() => void finish(false), 15_000);
      try {
        await AdMob.showBanner({
          adId: pickUnit(cfg.test, cfg.bannerUnit, ADS_CONFIG.bannerId),
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: cfg.test,
        });
      } catch (error) {
        console.warn("AdMob banner request failed", error);
        await finish(false);
      }
    });
  } catch (error) {
    console.warn("AdMob banner setup failed", error);
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
