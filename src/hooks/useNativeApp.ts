import { useEffect, useState } from "react";
import { savePushToken } from "@/lib/push.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

let initDone = false;
let latestPushToken: string | null = null;
let lastRootBackPress = 0;

const EXIT_ROUTES = new Set(["/", "/home", "/auth"]);

async function persistPushToken() {
  if (!latestPushToken) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  await savePushToken({ data: { token: latestPushToken, platform: "android" } });
}

/**
 * Initialize native Capacitor plugins only when running inside the Android/iOS shell.
 * This keeps the deployed web app working unchanged while giving the Play Store app
 * real native behaviour (splash screen, app state, device info, push, share sheet).
 */
export function useNativeApp() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    if (initDone) return;
    initDone = true;

    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform()) return;
    setIsNative(true);

    // The native token can arrive before login finishes. Save it again as soon
    // as a session exists, otherwise the protected save call is lost forever.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => persistPushToken().catch(() => {}), 0);
      }
    });

    // Dynamic imports so the browser bundle never tries to load Capacitor modules.
    Promise.all([
      import("@capacitor/splash-screen").then((m) => m.SplashScreen.hide({ fadeOutDuration: 450 })),
      import("@capacitor/app").then((m) =>
        m.App.addListener("backButton", () => {
          const path = window.location.pathname.replace(/\/+$/, "") || "/";
          if (!EXIT_ROUTES.has(path)) {
            window.history.back();
            return;
          }

          const now = Date.now();
          if (now - lastRootBackPress < 2_000) {
            m.App.exitApp();
            return;
          }
          lastRootBackPress = now;
          toast("অ্যাপ বন্ধ করতে আবার Back চাপুন");
        }),
      ),
      import("@capacitor/device").then((m) =>
        m.Device.getInfo().then((info) => {
          // eslint-disable-next-line no-console
          console.log("[Good-App] native device:", info.model, info.platform, info.osVersion);
        }),
      ),
      // ফোনের push notification — permission নিয়ে token সার্ভারে পাঠায়
      import("@capacitor/push-notifications").then(async (m) => {
        const { PushNotifications } = m;
        PushNotifications.addListener("registration", (t) => {
          latestPushToken = t.value;
          persistPushToken().catch(() => {});
        });
        PushNotifications.addListener("registrationError", (e) => {
          // eslint-disable-next-line no-console
          console.warn("[Good-App] push registration error", e);
        });
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const url = (action.notification.data as any)?.url;
          if (typeof url === "string" && url.startsWith("/")) window.location.assign(url);
        });
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive === "granted") await PushNotifications.register();
        const bridge = (window as any).GoodAppDownloader;
        if (perm.receive === "granted" && bridge?.areBubblesAllowed?.() === false) {
          window.setTimeout(() => {
            toast("মেসেঞ্জার বাবল বন্ধ আছে", {
              description: "ভাসমান মেসেজ পেতে Android সেটিংসে বাবল চালু করুন।",
              duration: 12_000,
              action: {
                label: "চালু করুন",
                onClick: () => bridge.openBubbleSettings?.(),
              },
            });
          }, 1_500);
        }
      }),
    ]).catch(() => {
      // Native APIs are best-effort; the web app must keep working regardless.
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return { isNative };
}
