import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Starts native app-open ads from the app lifecycle rather than from a page.
 * This keeps the request working across login redirects and route changes.
 */
export function NativeAdsController() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    let launchTimer: number | undefined;
    let retryTimer: number | undefined;
    let removeAppListener: (() => Promise<void>) | undefined;
    let running = false;

    const requestAd = async (retry = 0) => {
      if (!active || running) return;
      running = true;
      try {
        const { showDailyAppOpenAd } = await import("@/lib/ads");
        const shown = await showDailyAppOpenAd();
        if (active && !shown && retry < 3) {
          retryTimer = window.setTimeout(() => void requestAd(retry + 1), 5_000);
        }
      } finally {
        running = false;
      }
    };

    // Wait until the WebView and native bridge have both completed startup.
    launchTimer = window.setTimeout(() => void requestAd(), 3_500);

    void import("@capacitor/app").then(async ({ App }) => {
      const handle = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) void requestAd();
      });
      if (!active) {
        await handle.remove();
        return;
      }
      removeAppListener = () => handle.remove();
    });

    return () => {
      active = false;
      if (launchTimer !== undefined) window.clearTimeout(launchTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      void removeAppListener?.();
    };
  }, []);

  return null;
}