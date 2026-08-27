import { supabase } from "@/integrations/supabase/client";

/**
 * নেটিভ Android অ্যাপে Google Sign-In।
 * Android Credential Manager ব্যবহার করে — তাই ফোনে যুক্ত সব Gmail account
 * সরাসরি chooser-এ দেখায় (নতুন করে Gmail লিখতে হয় না)।
 *
 * Web/browser-এ এটি কিছু করে না (false ফেরায়) — তখন আগের OAuth flow চলবে।
 */

// Google OAuth Web Client ID (publishable — safe in client code).
const DEFAULT_WEB_CLIENT_ID =
  "563284519487-uegat97otset76iem1fhdnm5jpvluqph.apps.googleusercontent.com";

const WEB_CLIENT_ID =
  ((import.meta as any).env?.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  DEFAULT_WEB_CLIENT_ID;

export function isNativeApp(): boolean {
  try {
    const cap = (globalThis as any).Capacitor;
    return !!cap?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function nativeGoogleAvailable(): boolean {
  return isNativeApp() && !!WEB_CLIENT_ID;
}

export type NativeGoogleResult = {
  ok: boolean;
  /** chooser-এ বেছে নেওয়া Gmail (web fallback-এ login_hint হিসেবে কাজে লাগে) */
  email?: string;
  error?: string;
};

function decodeJwtPayload(token: string): any {
  try {
    const base = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base + "=".repeat((4 - (base.length % 4)) % 4)));
  } catch {
    return {};
  }
}

/**
 * ফোনের Google একাউন্ট chooser দেখিয়ে সাইন-ইন। কখনোই throw করে না —
 * ব্যর্থ হলে { ok:false, error, email } ফেরায় যাতে caller web flow-এ যেতে পারে।
 */
export async function signInWithNativeGoogle(): Promise<NativeGoogleResult> {
  if (!nativeGoogleAvailable()) return { ok: false, error: "native-unavailable" };

  let email: string | undefined;
  try {
    const { SocialLogin } = await import("@capgo/capacitor-social-login");

    await SocialLogin.initialize({
      google: { webClientId: WEB_CLIENT_ID, mode: "online" },
    });

    // প্রথমে আগে-অনুমোদিত একাউন্ট, না পেলে ফোনের সব একাউন্ট দেখাই।
    const attempts = [
      { filterByAuthorizedAccounts: true, autoSelectEnabled: false },
      { forcePrompt: true, filterByAuthorizedAccounts: false, autoSelectEnabled: false },
    ];

    let idToken: string | undefined;
    let lastError: unknown;
    for (const options of attempts) {
      try {
        const res: any = await SocialLogin.login({ provider: "google", options });
        idToken =
          res?.result?.idToken ?? res?.result?.authentication?.idToken ?? res?.idToken;
        email = res?.result?.profile?.email ?? res?.result?.email ?? email;
        if (idToken) break;
      } catch (e) {
        lastError = e;
      }
    }

    if (!idToken) {
      return {
        ok: false,
        email,
        error:
          (lastError as any)?.message ??
          "ফোনের Google একাউন্ট থেকে টোকেন পাওয়া যায়নি",
      };
    }

    const claims = decodeJwtPayload(idToken);
    email = claims?.email ?? email;

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) {
      // সাধারণত "Unacceptable audience" — তখন web OAuth flow-ই ব্যবহার হবে।
      return { ok: false, email, error: error.message };
    }

    return { ok: true, email };
  } catch (e: any) {
    return { ok: false, email, error: e?.message ?? "native-google-failed" };
  }
}

