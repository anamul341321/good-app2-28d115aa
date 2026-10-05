/**
 * Google Play (store) build detection.
 *
 * A "store" build is the Good-App APK/AAB that is uploaded to the Play Store.
 * It keeps every account feature the app actually needs — slot verify,
 * re-verify, withdraw, send money, mobile recharge — but hides the things Play
 * policy penalises: links that install another APK from outside the store,
 * crypto (USDT) payouts and the admin panel.
 *
 * Detection mirrors isLiteBuild(): a Vite flag for web/dev builds plus the
 * immutable native BuildConfig marker for an installed APK, because the Android
 * shell normally loads the live website where Vite's flag belongs to the site.
 */
export const isStoreBuild = (): boolean => {
  if (typeof import.meta.env !== "undefined" && import.meta.env.VITE_STORE_BUILD === "true") {
    return true;
  }

  if (typeof window !== "undefined") {
    try {
      if (/GoodAppStore/.test(window.navigator.userAgent || "")) return true;
      const nativeBridge = (window as any).GoodAppDownloader;
      if (nativeBridge?.isStoreBuild?.() === true) return true;
    } catch {
      // A browser or an older Android shell has no store marker and stays Full.
    }
  }
  return false;
};
