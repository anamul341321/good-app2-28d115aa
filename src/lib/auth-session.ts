import type { Session } from "@supabase/supabase-js";

type SessionResult = {
  data: { session: Session | null };
  error: null;
};

let cached: { value: SessionResult; expiresAt: number } | undefined;

function readStoredSession(): SessionResult | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
        user?: unknown;
      };
      if (!parsed.access_token || !parsed.refresh_token) continue;
       if (parsed.expires_at && parsed.expires_at * 1000 <= Date.now()) continue;
      return {
        data: { session: parsed as NonNullable<SessionResult["data"]["session"]> },
        error: null,
      } as SessionResult;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Collapse concurrent auth reads into one request. Several protected widgets
 * mount together; calling getSession for every server function can otherwise
 * queue behind the browser auth lock and leave the whole app waiting.
 */
export function getSharedSession(options?: { fresh?: boolean }): Promise<SessionResult> {
  const now = Date.now();
  if (!options?.fresh && cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  // The browser client has already persisted and validated this session.
  // Return it synchronously instead of entering its global auth lock. This is
  // the normal path for every protected page and server-function call.
  const stored = readStoredSession();
  if (stored) {
    cached = { value: stored, expiresAt: now + 30_000 };
    return Promise.resolve(stored);
  }

  // Never enter the auth SDK's browser-wide Web Lock from page rendering or
  // server-function middleware. A stalled refresh in another tab can keep
  // getSession() pending indefinitely. Auth state changes keep localStorage
  // current, so a missing usable stored session is a terminal signed-out state.
  const signedOut: SessionResult = { data: { session: null }, error: null };
  cached = { value: signedOut, expiresAt: now + 1_000 };
  return Promise.resolve(signedOut);
}

export function clearSharedSession() {
  cached = undefined;
}