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
  return false;
};
