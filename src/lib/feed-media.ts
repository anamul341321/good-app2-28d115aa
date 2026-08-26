import { supabase } from "@/integrations/supabase/client";
import { getSharedSession } from "@/lib/auth-session";

const BUCKET = "social_media";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

type CacheEntry = { url: string; expiresAt: number };

const STORAGE_KEY = "feed_media_signed_urls_v1";

const signedUrlCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string>>();

/** পেজ রিলোডেও signed URL গুলো ধরে রাখা হয়, তাই ছবি সাথে সাথেই দেখা যায় */
function loadPersisted() {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry?.url && entry.expiresAt > now) signedUrlCache.set(key, entry);
    }
  } catch {
    /* ignore corrupt cache */
  }
}
loadPersisted();

let persistTimer: ReturnType<typeof setTimeout> | undefined;
function persistSoon() {
  if (typeof localStorage === "undefined") return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    try {
      const now = Date.now();
      const obj: Record<string, CacheEntry> = {};
      for (const [key, entry] of signedUrlCache) {
        if (entry.expiresAt > now) obj[key] = entry;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* quota — ignore */
    }
  }, 500);
}

/** cache-এ থাকলে সাথে সাথেই URL ফেরত দেয় (কোনো await ছাড়া) */
export function peekFeedMedia(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined;
  if (isHttpUrl(pathOrUrl)) return pathOrUrl;
  const cached = signedUrlCache.get(pathOrUrl);
  return cached && cached.expiresAt > Date.now() ? cached.url : undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}


/**
 * Resolves a stored media path (or already-public URL) to a usable URL.
 * Paths stored under the private `social_media` bucket are converted into
 * time-limited signed URLs, cached in-memory to avoid refetching.
 */
/** avatar পাথগুলো `avatars` bucket-এ থাকে, পোস্ট/মিডিয়া `social_media`-তে */
const BUCKET_CHAIN = [BUCKET, "avatars"] as const;

export async function resolveFeedMedia(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return pathOrUrl;
  if (isHttpUrl(pathOrUrl)) return pathOrUrl;

  const cached = signedUrlCache.get(pathOrUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const pending = inFlight.get(pathOrUrl);
  if (pending) return pending;

  const looksLikeAvatar = /avatar/i.test(pathOrUrl);
  const buckets = looksLikeAvatar ? [...BUCKET_CHAIN].reverse() : [...BUCKET_CHAIN];

  const promise = (async () => {
    try {
      // Private media needs the restored auth session. A cold Android WebView can
      // mount the feed before the client has finished refreshing its token.
      await getSharedSession();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        for (const bucket of buckets) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(pathOrUrl, SIGNED_URL_TTL_SECONDS);
          if (error || !data?.signedUrl) continue;
          signedUrlCache.set(pathOrUrl, {
            url: data.signedUrl,
            expiresAt: Date.now() + (SIGNED_URL_TTL_SECONDS - 60) * 1000,
          });
          persistSoon();
          return data.signedUrl;
        }
        if (attempt === 0) {
          await getSharedSession({ fresh: true });
        }
      }
      throw new Error("Media URL could not be signed");
    } finally {
      inFlight.delete(pathOrUrl);
    }
  })();

  inFlight.set(pathOrUrl, promise);
  return promise;
}



/**
 * অনেকগুলো মিডিয়া পাথ আগেই sign করে রাখে, তাই যখন ভিডিও দেখানো হয় তখন
 * আর নেটওয়ার্ক রাউন্ড-ট্রিপের জন্য অপেক্ষা করতে হয় না (লোডিং কমে যায়)।
 */
export async function prefetchFeedMedia(paths: Array<string | null | undefined>, limit = 6) {
  const pending = Array.from(
    new Set(
      paths.filter(
        (p): p is string => !!p && !isHttpUrl(p) && !peekFeedMedia(p) && !inFlight.has(p),
      ),
    ),
  ).slice(0, 30);
  if (pending.length === 0) return;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, pending.length) }, async () => {
    while (cursor < pending.length) {
      const path = pending[cursor++];
      await resolveFeedMedia(path).catch(() => undefined);
    }
  });
  await Promise.all(workers);
}

// React hook wrapper is defined below; kept in the same file per spec.
import { useEffect, useState } from "react";

export function useFeedMedia(pathOrUrl?: string | null): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(() => peekFeedMedia(pathOrUrl));

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
    const known = peekFeedMedia(pathOrUrl);
    setResolved(known);
    resolveFeedMedia(pathOrUrl)
      .then((url) => {
        if (!cancelled) setResolved(url);
      })
      .catch(() => {
        if (!cancelled) setResolved(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl]);

  return resolved;
}
