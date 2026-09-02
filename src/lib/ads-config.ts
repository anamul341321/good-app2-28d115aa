import { getAppStatus } from "@/lib/app-status.functions";

export type AdsConfig = {
  enabled: boolean;
  test: boolean;
  banner: boolean;
  rewarded: boolean;
  appOpen: boolean;
  bannerUnit: string | null;
  interstitialUnit: string | null;
  rewardedUnit: string | null;
};

const OFF: AdsConfig = {
  enabled: false,
  test: false,
  banner: false,
  rewarded: false,
  appOpen: false,
  bannerUnit: null,
  interstitialUnit: null,
  rewardedUnit: null,
};


let cache: AdsConfig | null = null;
let cachedAt = 0;
let inflight: Promise<AdsConfig> | null = null;

const CACHE_TTL_MS = 15_000;

/** অ্যাডমিন প্যানেলের সুইচ অনুযায়ী অ্যাড কনফিগ (একবার fetch করে ক্যাশ করে) */
export async function loadAdsConfig(): Promise<AdsConfig> {
  if (cache && Date.now() - cachedAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const s: any = await getAppStatus();
      const enabled = s?.adsEnabled === true;
      const cfg: AdsConfig = {
        enabled,
        // সবসময় live অ্যাড — কোনো test ad দেখানো হবে না (আয় হতে হবে)
        test: false,
        banner: enabled && s?.adsBannerEnabled !== false,
        rewarded: enabled && s?.adsRewardedEnabled !== false,
        appOpen: enabled && s?.adsAppOpenEnabled !== false,
        bannerUnit: s?.adsBannerUnit ?? null,
        interstitialUnit: s?.adsInterstitialUnit ?? null,
        rewardedUnit: s?.adsRewardedUnit ?? null,
      };

      cache = cfg;
      cachedAt = Date.now();
      return cfg;
    } catch {
      return OFF;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function adsConfigSnapshot(): AdsConfig | null {
  return cache;
}
