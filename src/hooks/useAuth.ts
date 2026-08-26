import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSharedSession } from "@/lib/auth-session";
import type { User } from "@supabase/supabase-js";

function readCachedUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        access_token?: string;
        expires_at?: number;
        user?: User;
        currentSession?: { expires_at?: number; user?: User };
      };
      const user = parsed.user ?? parsed.currentSession?.user ?? null;
      const expiresAt = parsed.expires_at ?? parsed.currentSession?.expires_at;
      if (parsed.access_token && user && (!expiresAt || expiresAt * 1000 > Date.now())) {
        return user;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function useAuth() {
  const [auth, setAuth] = useState<{ user: User | null; loading: boolean }>(() => {
    const cachedUser = readCachedUser();
    return { user: cachedUser, loading: !cachedUser };
  });

  useEffect(() => {
    // Initial check
    getSharedSession().then(({ data }) => {
      setAuth({ user: data.session?.user ?? readCachedUser(), loading: false });
    }).catch(() => {
      setAuth({ user: readCachedUser(), loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setAuth({ user: null, loading: false });
        return;
      }
      setAuth((prev) => ({ user: session?.user ?? prev.user ?? readCachedUser(), loading: false }));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return auth;
}
