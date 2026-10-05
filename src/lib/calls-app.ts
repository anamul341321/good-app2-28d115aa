// Detects the separate "GoodApp Call" APK and keeps it limited to calls/messages.
export const CALLS_APP_KEY = "goodapp_calls_app";

/** Pages the calls APK is allowed to show. Everything else redirects to /calls. */
export const CALLS_ALLOWED_RE = /^\/(calls|chat|callcenter|auth)(\/|$)/;

/** The current page is running inside the dedicated calls APK. */
export function detectNativeCallsApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      /GoodAppCall/.test(navigator.userAgent || "") ||
      Boolean((window as any).GoodAppDownloader?.isCallsBuild?.()) ||
      new URLSearchParams(window.location.search).get("app") === "calls"
    );
  } catch {
    return false;
  }
}

export function detectCallsApp(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const native = detectNativeCallsApp();
    if (native) {
      localStorage.setItem(CALLS_APP_KEY, "1");
      localStorage.setItem("goodapp_call_only_mode", "1");
      return true;
    }
    return localStorage.getItem(CALLS_APP_KEY) === "1";
  } catch {
    return false;
  }
}
