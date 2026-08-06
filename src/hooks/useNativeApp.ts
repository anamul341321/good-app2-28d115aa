import { useEffect, useState } from "react";

let initDone = false;

/**
 * Initialize native Capacitor plugins only when running inside the Android/iOS shell.
 * This keeps the deployed web app working unchanged while giving the Play Store app
 * real native behaviour (splash screen, app state, device info, share sheet, etc.).
 */
export function useNativeApp() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (initDone) return;
    initDone = true;

    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform()) return;
    setIsNative(true);

    // Dynamic imports so the browser bundle never tries to load Capacitor modules.
    Promise.all([
      import("@capacitor/splash-screen").then((m) => m.SplashScreen.hide({ fadeOutDuration: 450 })),
      import("@capacitor/app").then((m) => m.App.addListener("backButton", ({ canGoBack }) => {
        if (!canGoBack) {
          m.App.exitApp();
        }
      })),
      import("@capacitor/device").then((m) => m.Device.getInfo().then((info) => {
        // eslint-disable-next-line no-console
        console.log("[Good-App] native device:", info.model, info.platform, info.osVersion);
      })),
    ]).catch(() => {
      // Native APIs are best-effort; the web app must keep working regardless.
    });
  }, []);

  return { isNative };
}
