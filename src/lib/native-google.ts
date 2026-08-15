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

/**
 * সফল হলে true — session বসে গেছে। না পারলে false (caller web flow-এ যাবে)।
 */
export async function signInWithNativeGoogle(): Promise<boolean> {
  if (!nativeGoogleAvailable()) return false;

  const { SocialLogin } = await import("@capgo/capacitor-social-login");

  await SocialLogin.initialize({
    google: { webClientId: WEB_CLIENT_ID, mode: "online" },
  });

  // Credential Manager কখনো "authorized accounts only" মোডে খালি ফেরত দেয়,
  // তখন দ্বিতীয়বার সব একাউন্ট দেখিয়ে চেষ্টা করি — এতে বার বার লুপ হয় না।
  const attempts = [
    { forcePrompt: true, filterByAuthorizedAccounts: false, autoSelectEnabled: false },
  ];

  let idToken: string | undefined;
  let lastError: unknown;
  for (const options of attempts) {
    try {
      const res: any = await SocialLogin.login({ provider: "google", options });
      idToken =
        res?.result?.idToken ?? res?.result?.authentication?.idToken ?? res?.idToken;
      if (idToken) break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!idToken) {
    const msg = (lastError as any)?.message ?? "";
    throw new Error(
      msg
        ? `Google Sign-In: ${msg}`
        : "ফোনের Google একাউন্ট থেকে টোকেন পাওয়া যায়নি — একবার Settings → Google একাউন্ট চেক করুন",
    );
  }

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw new Error(error.message);

  return true;
}
