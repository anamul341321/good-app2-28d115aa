import { supabase } from "@/integrations/supabase/client";

type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

let inFlight: Promise<SessionResult> | undefined;
let cached: { value: SessionResult; expiresAt: number } | undefined;

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
  if (inFlight) return inFlight;

  inFlight = supabase.auth.getSession()
    .then((value) => {
      cached = { value, expiresAt: Date.now() + 10_000 };
      return value;
    })
    .finally(() => {
      inFlight = undefined;
    });

  return inFlight;
}

export function clearSharedSession() {
  cached = undefined;
  inFlight = undefined;
}