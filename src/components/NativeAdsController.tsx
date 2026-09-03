import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useRouterState } from "@tanstack/react-router";

/**
 * Starts native app-open ads from the app lifecycle rather than from a page.
 * This keeps the request working across login redirects and route changes.
 */
export function NativeAdsController() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

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

    // Warm up Unity Ads immediately so the launch ad can appear within a few seconds.
    void (async () => {
      const [{ initUnityAds }, { loadAdsConfig }] = await Promise.all([
        import("@/lib/unity-ads"),
        import("@/lib/ads-config"),
      ]);
      const cfg = await loadAdsConfig();
      if (cfg.enabled) void initUnityAds(cfg.test);
    })();

    // Wait until the WebView and native bridge have both completed startup.
    launchTimer = window.setTimeout(() => void requestAd(), 2_500);

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

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || pathname.startsWith("/call")) return;
    const timer = window.setTimeout(() => {
      void import("@/lib/ads").then(({ showDailyAppOpenAd }) => showDailyAppOpenAd());
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}