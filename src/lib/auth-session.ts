import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type SessionResult = {
  data: { session: Session | null };
  error: null;
};

let cached: { value: SessionResult; expiresAt: number } | undefined;
let refreshing: Promise<SessionResult> | undefined;

type Stored = {
  session: Session;
  expired: boolean;
  refreshToken?: string;
};

function readStoredSession(): Stored | undefined {
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
      const expired = Boolean(parsed.expires_at && parsed.expires_at * 1000 <= Date.now());
      return {
        session: parsed as unknown as Session,
        expired,
        refreshToken: parsed.refresh_token,
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * টোকেনের সময় শেষ হলে সাথে সাথে লগআউট করি না — refresh_token দিয়ে
 * নতুন টোকেন আনার চেষ্টা করি। নেটওয়ার্ক সমস্যা হলে পুরোনো সেশনই রেখে দিই,
 * শুধু সার্ভার সত্যিই "invalid refresh token" বললে লগআউট হবে।
 */
async function refreshWithStored(stored: Stored): Promise<SessionResult> {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: stored.refreshToken!,
    });
    if (data?.session) {
      return { data: { session: data.session }, error: null };
    }
    const message = (error?.message ?? "").toLowerCase();
    const terminal =
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found") ||
      message.includes("already used") ||
      message.includes("revoked");
    if (terminal) return { data: { session: null }, error: null };
    // অন্য যেকোনো ব্যর্থতা (নেটওয়ার্ক/সার্ভার) — পুরোনো সেশন রেখে দিই
    return { data: { session: stored.session }, error: null };
  } catch {
    return { data: { session: stored.session }, error: null };
  }
}

/**
 * Collapse concurrent auth reads into one request. Several protected widgets
 * mount together; calling getSession for every server function can otherwise
 * queue behind the browser auth lock and leave the whole app waiting.
 */
export function getSharedSession(options?: { fresh?: boolean }): Promise<SessionResult> {
  const now = Date.now();
  // A forced recheck must join an existing refresh instead of starting a
  // competing refresh with the same single-use refresh token.
  if (refreshing) return refreshing;

  if (!options?.fresh && cached && cached.expiresAt > now) {
    return Promise.resolve(cached.value);
  }

  const stored = readStoredSession();

  if (stored && !stored.expired) {
    const value: SessionResult = { data: { session: stored.session }, error: null };
    cached = { value, expiresAt: now + 30_000 };
    return Promise.resolve(value);
  }

  if (stored?.refreshToken) {
    if (!refreshing) {
      refreshing = refreshWithStored(stored).then((value) => {
        cached = {
          value,
          expiresAt: Date.now() + (value.data.session ? 30_000 : 1_000),
        };
        refreshing = undefined;
        return value;
      });
    }
    return refreshing;
  }

  // কোনো সেশনই নেই — সত্যিকারের সাইনড-আউট অবস্থা।
  const signedOut: SessionResult = { data: { session: null }, error: null };
  cached = { value: signedOut, expiresAt: now + 1_000 };
  return Promise.resolve(signedOut);
}

export function clearSharedSession() {
  cached = undefined;
  refreshing = undefined;
}
