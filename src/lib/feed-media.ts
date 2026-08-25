import { supabase } from "@/integrations/supabase/client";

const BUCKET = "social_media";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type CacheEntry = { url: string; expiresAt: number };

const signedUrlCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string>>();

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/**
 * Resolves a stored media path (or already-public URL) to a usable URL.
 * Paths stored under the private `social_media` bucket are converted into
 * time-limited signed URLs, cached in-memory to avoid refetching.
 */
export async function resolveFeedMedia(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return pathOrUrl;
  if (isHttpUrl(pathOrUrl)) return pathOrUrl;

  const cached = signedUrlCache.get(pathOrUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const pending = inFlight.get(pathOrUrl);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) {
        return pathOrUrl;
      }
      signedUrlCache.set(pathOrUrl, {
        url: data.signedUrl,
        expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
      });
      return data.signedUrl;
    } catch {
      return pathOrUrl;
    } finally {
      inFlight.delete(pathOrUrl);
    }
  })();

  inFlight.set(pathOrUrl, promise);
  return promise;
}

// React hook wrapper is defined below; kept in the same file per spec.
import { useEffect, useState } from "react";

export function useFeedMedia(pathOrUrl?: string | null): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(
    pathOrUrl && isHttpUrl(pathOrUrl) ? pathOrUrl : undefined,
  );

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setResolved(undefined);
      return;
    }
    if (isHttpUrl(pathOrUrl)) {
      setResolved(pathOrUrl);
      return;
    }
    setResolved(undefined);
    resolveFeedMedia(pathOrUrl).then((url) => {
      if (!cancelled) setResolved(url);
    });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return resolved;
}
