import { supabase } from "@/integrations/supabase/client";

/**
 * নেটিভ অ্যাপে Google লগইন — ফোনের আসল ব্রাউজার (Chrome Custom Tab) খুলে
 * accounts.google.com দেখায়, ঠিক যেভাবে অন্য অ্যাপে হয়। ব্রাউজারে থাকা Gmail
 * গুলো লিস্টে আসে, একটায় ট্যাপ করলেই লগইন হয়ে অ্যাপে ফিরে আসে।
 *
 * ফেরার পথ: https://www.goodapp2.live/auth/native-callback — এই ডোমেইনটি
 * AndroidManifest-এ App Link হিসেবে যুক্ত, তাই ব্রাউজার URL-টি অ্যাপকেই দেয়।
 */

export const NATIVE_CALLBACK_PATH = "/auth/native-callback";
const CALLBACK_ORIGIN = "https://www.goodapp2.live";

export function isNativeApp(): boolean {
  try {
    return !!(globalThis as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** callback URL থেকে session বসায় (PKCE code অথবা hash token — দুটোই সাপোর্ট) */
export async function completeOAuthFromUrl(
  rawUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(rawUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    const errDesc = url.searchParams.get("error_description") ?? hash.get("error_description");
    if (errDesc) return { ok: false, error: errDesc };

    const code = url.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    return { ok: false, error: "callback-missing-token" };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "callback-failed" };
  }
}

/** ব্রাউজার (Custom Tab) দিয়ে Google সাইন-ইন। কখনো throw করে না। */
export async function signInWithBrowserGoogle(): Promise<{ ok: boolean; error?: string }> {
  if (!isNativeApp()) return { ok: false, error: "not-native" };

  try {
    const { Browser } = await import("@capacitor/browser");
    const { App } = await import("@capacitor/app");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${CALLBACK_ORIGIN}${NATIVE_CALLBACK_PATH}`,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data?.url) {
      return { ok: false, error: error?.message ?? "google-url-missing" };
    }

    const result = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      let settled = false;
      const handles: Array<{ remove: () => Promise<void> | void }> = [];

      const finish = (r: { ok: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        for (const h of handles) {
          try {
            void h.remove();
          } catch {
            /* ignore */
          }
        }
        try {
          void Browser.close();
        } catch {
          /* ignore */
        }
        resolve(r);
      };

      const timer = setTimeout(() => finish({ ok: false, error: "timeout" }), 180_000);

      void App.addListener("appUrlOpen", async ({ url }) => {
        if (!url || !url.includes(NATIVE_CALLBACK_PATH)) return;
        finish(await completeOAuthFromUrl(url));
      }).then((h) => handles.push(h));

      // ইউজার ব্রাউজার বন্ধ করে দিলে — session এসেছে কি না যাচাই করি
      void Browser.addListener("browserFinished", async () => {
        const { data: s } = await supabase.auth.getSession();
        if (s.session?.access_token) finish({ ok: true });
        else finish({ ok: false, error: "cancelled" });
      }).then((h) => handles.push(h));

      void Browser.open({ url: data.url }).catch((e: any) =>
        finish({ ok: false, error: e?.message ?? "browser-open-failed" }),
      );
    });

    return result;
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "browser-google-failed" };
  }
}
