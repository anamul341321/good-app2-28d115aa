import { supabase } from "@/integrations/supabase/client";

type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

let inFlight: Promise<SessionResult> | undefined;
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
      if (parsed.expires_at && parsed.expires_at * 1000 <= Date.now() + 30_000) continue;
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

  if (inFlight) return inFlight;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SessionResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({ data: { session: null }, error: null });
    }, 2_000);
  });

  inFlight = Promise.race([supabase.auth.getSession(), timeout])
    .then((value) => {
      cached = { value, expiresAt: Date.now() + 10_000 };
      return value;
    })
    .finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
      inFlight = undefined;
    });

  return inFlight;
}

export function clearSharedSession() {
  cached = undefined;
  inFlight = undefined;
}