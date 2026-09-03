/**
 * Play Store Lite build detection.
 *
 * When VITE_LITE_BUILD=true the app hides financial features
 * (withdraw, send money, mobile recharge, card purchase) so the APK
 * can be published on a personal Google Play developer account.
 * The full financial app continues to run on the website.
 */
export const isLiteBuild = (): boolean => {
  if (typeof import.meta.env !== "undefined" && import.meta.env.VITE_LITE_BUILD === "true") {
    return true;
  }

  // Android normally loads the live website so server functions keep working.
  // In that case Vite's build-time flag belongs to the website (Full), not to
  // the installed APK. The immutable native BuildConfig marker is therefore
  // the source of truth for an installed Lite binary.
  if (typeof window !== "undefined") {
    try {
      const nativeBridge = (window as any).GoodAppDownloader;
      if (nativeBridge?.isLiteBuild?.() === true) return true;
    } catch {
      // A browser or an older Android shell has no Lite marker and stays Full.
    }
  }
  return false;
};
