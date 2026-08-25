import { createFileRoute } from "@tanstack/react-router";

// ── Caching ─────────────────────────────────────────────────────────────
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL_TRENDING = 60 * 60 * 1000;
const CACHE_TTL_SEARCH = 30 * 60 * 1000;
const YT_KEY_REGEX = /^AIza[0-9A-Za-z_-]{20,}$/;
const CACHE_VERSION = "v3";

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yewtu.be",
  "https://iv.nboeck.de",
  "https://invidious.protokoll-departed.de",
  "https://invidious.privacyredirect.com",
];

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.projectsegfau.lt",
  "https://pipedapi.in.projectsegfau.lt",
];

function getCached(key: string, ttl: number) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { data, ts: Date.now() });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(v => { clearTimeout(id); resolve(v); }).catch(e => { clearTimeout(id); reject(e); });
  });
}

// ── Multi API Key Management ────────────────────────────────────────────
const exhaustedKeys = new Map<string, number>();
const invalidKeys = new Map<string, string>();
const KEY_COOLDOWN = 60 * 60 * 1000;

let cachedApiKeys: string[] = [];
let apiKeysFetchedAt = 0;
const API_KEYS_CACHE_TTL = 5 * 60 * 1000;

async function getAllApiKeys(): Promise<string[]> {
  const envKey = process.env["YOUTUBE_API_KEY"];
  if (Date.now() - apiKeysFetchedAt < API_KEYS_CACHE_TTL && cachedApiKeys.length > 0) {
    return cachedApiKeys;
  }

  const keys: string[] = [];
  if (envKey && YT_KEY_REGEX.test(envKey.trim())) keys.push(envKey.trim());

  cachedApiKeys = keys;
  apiKeysFetchedAt = Date.now();
  return keys;
}

function getAvailableKey(keys: string[]): string | null {
  const now = Date.now();
  for (const key of keys) {
    if (invalidKeys.has(key)) continue;
    const exhaustedAt = exhaustedKeys.get(key);
    if (!exhaustedAt || now - exhaustedAt > KEY_COOLDOWN) {
      exhaustedKeys.delete(key);
      return key;
    }
  }
  return null;
}

function markKeyExhausted(key: string) {
  exhaustedKeys.set(key, Date.now());
}

function markKeyInvalid(key: string, reason: string) {
  invalidKeys.set(key, reason);
}

// ── Fallback Videos ─────────────────────────────────────────────────────
const FALLBACK_VIDEOS = [
  { videoId: "JGwWNGJdvx8", title: "Shape of You - Ed Sheeran", author: "Ed Sheeran" },
  { videoId: "RgKAFK5djSk", title: "See You Again ft. Charlie Puth", author: "Wiz Khalifa" },
  { videoId: "fRh_vgS2dFE", title: "Sorry - Justin Bieber", author: "Justin Bieber" },
  { videoId: "OPf0YbXqDm0", title: "Uptown Funk - Mark Ronson ft. Bruno Mars", author: "Mark Ronson" },
  { videoId: "CevxZvSJLk8", title: "Roar - Katy Perry", author: "Katy Perry" },
  { videoId: "YQHsXMglC9A", title: "Hello - Adele", author: "Adele" },
  { videoId: "hT_nvWreIhg", title: "Counting Stars - OneRepublic", author: "OneRepublic" },
  { videoId: "pRpeEdMmmQ0", title: "Shake It Off - Taylor Swift", author: "Taylor Swift" },
  { videoId: "kJQP7kiw5Fk", title: "Despacito - Luis Fonsi ft. Daddy Yankee", author: "Luis Fonsi" },
  { videoId: "nfs8NYg7yQM", title: "Perfect - Ed Sheeran", author: "Ed Sheeran" },
  { videoId: "60ItHLz5WEA", title: "Alan Walker - Faded", author: "Alan Walker" },
  { videoId: "lp-EO5I60KA", title: "Tera Ban Jaunga", author: "Akhil Sachdeva" },
  { videoId: "bo_efYhYU2A", title: "Tum Hi Ho - Aashiqui 2", author: "Arijit Singh" },
  { videoId: "AtKZKl7Bgu0", title: "Manike Mage Hithe", author: "Yohani" },
  { videoId: "vGJTaP6anOU", title: "Tomake Chai - Gangster", author: "Arijit Singh" },
  { videoId: "BddP6PYo2gs", title: "Mon Majhi Re", author: "Arijit Singh" },
  { videoId: "hoNb6HuNmU0", title: "Tumi Amar Emoni Ekjon", author: "Bangla Song" },
  { videoId: "KgmeRfCQIRo", title: "O Maahi - Dunki", author: "Arijit Singh" },
  { videoId: "koJlIGDImiU", title: "Radioactive - Imagine Dragons", author: "Imagine Dragons" },
  { videoId: "PT2_F-1esPk", title: "The Nights - Avicii", author: "Avicii" },
];

function parseDurationText(text: string): number {
  if (!text) return 0;
  const parts = text.split(":").map(Number);
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  return parts[0] || 0;
}

function parseISO8601Duration(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || "0") * 3600) + (parseInt(match[2] || "0") * 60) + parseInt(match[3] || "0");
}

function getFallbackVideos(maxResults = 25): { results: any[]; source: "fallback" } {
  const shuffled = [...FALLBACK_VIDEOS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return {
    source: "fallback",
    results: shuffled.slice(0, maxResults).map(v => ({
      videoId: v.videoId, title: v.title, author: v.author, channelId: "",
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, publishedAt: "",
    })),
  };
}

async function searchViaPiped(query: string, maxResults = 25): Promise<{ results: any[]; source: "piped" }> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], source: "piped" };

  for (const instance of PIPED_INSTANCES) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(trimmed)}&filter=videos`;
      const res = await withTimeout(fetch(url), 7000);
      if (!res.ok) { await res.text().catch(() => {}); continue; }
      const data: any = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      const results = items
        .filter((item: any) => item?.url && item?.title)
        .slice(0, maxResults)
        .map((item: any) => {
          const videoId = item.url?.replace("/watch?v=", "") || "";
          return {
            videoId,
            title: item.title || "",
            author: item.uploaderName || item.uploader || "",
            channelId: item.uploaderUrl?.replace("/channel/", "") || "",
            thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            publishedAt: item.uploadedDate || "",
            lengthSeconds: item.duration || 0,
          };
        })
        .filter((r: any) => r.videoId);

      if (results.length > 0) {
        return { results, source: "piped" };
      }
    } catch {
      continue;
    }
  }

  return { results: [], source: "piped" };
}

async function searchViaInvidious(query: string, maxResults = 25): Promise<{ results: any[]; source: "invidious" }> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], source: "invidious" };

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const params = new URLSearchParams({ q: trimmed, type: "video", sort_by: "relevance", region: "BD" });
      const res = await withTimeout(fetch(`${instance}/api/v1/search?${params}`), 7000);
      if (!res.ok) { await res.text().catch(() => {}); continue; }
      const data: any = await res.json();
      if (!Array.isArray(data)) continue;

      const results = data
        .filter((item: any) => item?.videoId)
        .slice(0, maxResults)
        .map((item: any) => ({
          videoId: item.videoId,
          title: item.title || "",
          author: item.author || "",
          channelId: item.authorId || "",
          thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
          publishedAt: item.publishedText || "",
          lengthSeconds: item.lengthSeconds || 0,
        }));

      if (results.length > 0) {
        return { results, source: "invidious" };
      }
    } catch {
      continue;
    }
  }

  return { results: [], source: "invidious" };
}

async function searchViaYouTubeHTML(query: string, maxResults = 25): Promise<{ results: any[]; source: "youtube-html" }> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], source: "youtube-html" };

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}&sp=EgIQAQ%3D%3D`;
    const res = await withTimeout(fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
      },
    }), 10000);

    if (!res.ok) { await res.text().catch(() => {}); return { results: [], source: "youtube-html" }; }
    const html = await res.text();

    const match = html.match(/var\s+ytInitialData\s*=\s*({.+?});\s*<\/script>/s)
      || html.match(/ytInitialData\s*=\s*({.+?});\s*/s);
    if (!match) {
      return { results: [], source: "youtube-html" };
    }

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents || [];

    const results: any[] = [];
    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item?.videoRenderer;
        if (!vr?.videoId) continue;
        results.push({
          videoId: vr.videoId,
          title: vr.title?.runs?.[0]?.text || "",
          author: vr.ownerText?.runs?.[0]?.text || "",
          channelId: vr.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "",
          thumbnail: `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`,
          publishedAt: vr.publishedTimeText?.simpleText || "",
          lengthSeconds: parseDurationText(vr.lengthText?.simpleText || ""),
        });
        if (results.length >= maxResults) break;
      }
      if (results.length >= maxResults) break;
    }

    return { results, source: "youtube-html" };
  } catch {
    return { results: [], source: "youtube-html" };
  }
}

async function searchFallback(query: string, maxResults = 25): Promise<{ results: any[]; source: string }> {
  const ytHtml = await searchViaYouTubeHTML(query, maxResults);
  if (ytHtml.results.length > 0) return ytHtml;

  const piped = await searchViaPiped(query, maxResults);
  if (piped.results.length > 0) return piped;

  const invidious = await searchViaInvidious(query, maxResults);
  if (invidious.results.length > 0) return invidious;

  return getFallbackVideos(maxResults);
}

async function youtubeApiFetch(url: string, apiKey: string): Promise<Response> {
  const separator = url.includes("?") ? "&" : "?";
  return withTimeout(fetch(`${url}${separator}key=${apiKey}`), 8000);
}

async function searchYouTubeWithRotation(
  keys: string[], query: string, pageToken?: string, maxResults = 25, order = "relevance"
): Promise<{ results: any[]; nextPageToken?: string; source?: string }> {
  const params = new URLSearchParams({
    part: "snippet", q: query, type: "video", maxResults: String(maxResults),
    order, regionCode: "BD", relevanceLanguage: "bn", videoDuration: "medium",
  });
  if (pageToken) params.set("pageToken", pageToken);
  const baseUrl = `https://www.googleapis.com/youtube/v3/search?${params}`;

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const apiKey = getAvailableKey(keys);
    if (!apiKey) break;

    try {
      const res = await youtubeApiFetch(baseUrl, apiKey);
      if (!res.ok) {
        const errBody = await res.text();
        const errLower = errBody.toLowerCase();
        if (res.status === 403 && errBody.includes("quotaExceeded")) {
          markKeyExhausted(apiKey);
          continue;
        }
        if (res.status === 400 || (res.status === 403 && (errLower.includes("apikey") || errLower.includes("accessnotconfigured") || errLower.includes("forbidden")))) {
          markKeyInvalid(apiKey, `http_${res.status}`);
          continue;
        }
        continue;
      }
      const data: any = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const results = items.filter((item: any) => item?.id?.videoId).map((item: any) => ({
        videoId: item.id.videoId,
        title: item.snippet?.title || "",
        author: item.snippet?.channelTitle || "",
        channelId: item.snippet?.channelId || "",
        thumbnail: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
        publishedAt: item.snippet?.publishedAt || "",
      }));
      return { results, nextPageToken: data?.nextPageToken, source: "youtube" };
    } catch (e) {
      if (String(e).includes("timeout")) continue;
      throw e;
    }
  }

  return await searchFallback(query, maxResults);
}

async function getTrendingWithRotation(
  keys: string[], maxResults = 25, categoryId?: string
): Promise<{ results: any[]; source?: string }> {
  const categories = categoryId ? [categoryId] : ["10", "24", "1", "22"];
  const perCategory = categoryId ? maxResults : Math.ceil(maxResults / categories.length) + 5;
  const allResults: any[] = [];

  for (const catId of categories) {
    const params = new URLSearchParams({
      part: "snippet,contentDetails", chart: "mostPopular",
      regionCode: "BD", maxResults: String(perCategory), videoCategoryId: catId,
    });
    const baseUrl = `https://www.googleapis.com/youtube/v3/videos?${params}`;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const apiKey = getAvailableKey(keys);
      if (!apiKey) break;

      try {
        const res = await youtubeApiFetch(baseUrl, apiKey);
        if (!res.ok) {
          const errBody = await res.text();
          const errLower = errBody.toLowerCase();
          if (res.status === 403 && errBody.includes("quotaExceeded")) {
            markKeyExhausted(apiKey);
            continue;
          }
          if (res.status === 400 || (res.status === 403 && (errLower.includes("apikey") || errLower.includes("accessnotconfigured") || errLower.includes("forbidden")))) {
            markKeyInvalid(apiKey, `http_${res.status}`);
            continue;
          }
          break;
        }
        const data: any = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        allResults.push(...items.filter((item: any) => item?.id).map((item: any) => ({
          videoId: item.id,
          title: item.snippet?.title || "",
          author: item.snippet?.channelTitle || "",
          channelId: item.snippet?.channelId || "",
          thumbnail: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
          publishedAt: item.snippet?.publishedAt || "",
          lengthSeconds: parseISO8601Duration(item.contentDetails?.duration || ""),
        })));
        break;
      } catch {
        continue;
      }
    }
  }

  for (let i = allResults.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allResults[i], allResults[j]] = [allResults[j], allResults[i]];
  }
  const seen = new Set<string>();
  const deduped = allResults.filter(r => { if (seen.has(r.videoId)) return false; seen.add(r.videoId); return true; });
  if (deduped.length > 0) return { results: deduped.slice(0, maxResults), source: "youtube" };

  return await searchFallback("bangla trending song 2026", maxResults);
}

async function probeYouTubeKey(key: string): Promise<{ state: "ok" | "quota" | "invalid" | "error"; message: string }> {
  try {
    const params = new URLSearchParams({ part: "id", id: "UC_x5XG1OV2P6uZZ5FSM9Ttw", key });
    const res = await withTimeout(fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`), 5000);
    if (res.ok) { await res.text(); return { state: "ok", message: "Ready" }; }

    const errBody = await res.text();
    const errLower = errBody.toLowerCase();
    if (res.status === 403 && errLower.includes("quotaexceeded")) return { state: "quota", message: "Quota exceeded" };
    if (res.status === 400 || (res.status === 403 && (errLower.includes("apikey") || errLower.includes("accessnotconfigured") || errLower.includes("forbidden") || errLower.includes("iprefererblocked"))))
      return { state: "invalid", message: "Invalid/restricted key" };
    return { state: "error", message: `HTTP ${res.status}` };
  } catch {
    return { state: "error", message: "Probe timeout/network error" };
  }
}

async function getYouTubeSuggestions(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const params = new URLSearchParams({ client: "youtube", ds: "yt", q: query, hl: "bn", gl: "BD" });
    const url = `https://suggestqueries.google.com/complete/search?${params}&callback=`;
    const res = await withTimeout(fetch(url), 4000);
    if (!res.ok) return [];
    const text = await res.text();
    const jsonStr = text.replace(/^[^[]*/, "").replace(/[^]]*$/, "");
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed) && Array.isArray(parsed[1])) {
      return parsed[1].map((item: any) => (Array.isArray(item) ? item[0] : String(item))).filter(Boolean).slice(0, 10);
    }
    return [];
  } catch { return []; }
}

const jsonHeaders = { "Content-Type": "application/json" };

async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action") || "search";
    const query = String(url.searchParams.get("q") || "").trim().slice(0, 140);
    const pageToken = url.searchParams.get("pageToken") || undefined;
    const order = url.searchParams.get("order") || "relevance";
    const maxResults = Math.min(50, Math.max(5, Number(url.searchParams.get("maxResults") || "25")));

    if (action === "suggest") {
      const cacheKey = `${CACHE_VERSION}:suggest:${query}`;
      const cached = getCached(cacheKey, 60 * 60 * 1000);
      if (cached) return new Response(JSON.stringify(cached), { headers: jsonHeaders });
      const suggestions = await getYouTubeSuggestions(query);
      const response = { suggestions };
      if (suggestions.length > 0) setCache(cacheKey, response);
      return new Response(JSON.stringify(response), { headers: jsonHeaders });
    }

    if (action === "key-status") {
      const keys = await getAllApiKeys();
      const shouldProbe = url.searchParams.get("probe") === "1";
      const probeMap = new Map<string, { state: string; message: string }>();

      if (shouldProbe) {
        const probeResults = await Promise.all(keys.map(async (k) => ({ key: k, result: await probeYouTubeKey(k) })));
        for (const entry of probeResults) {
          probeMap.set(entry.key, entry.result);
          if (entry.result.state === "quota") markKeyExhausted(entry.key);
          if (entry.result.state === "invalid") markKeyInvalid(entry.key, "probe_invalid_or_restricted");
        }
      }

      const now = Date.now();
      const statuses = keys.map((k, i) => {
        const probe = probeMap.get(k);
        const exhaustedAt = exhaustedKeys.get(k);
        const invalidReason = invalidKeys.get(k);
        const exhausted = !!exhaustedAt && now - exhaustedAt <= KEY_COOLDOWN;
        const available = !invalidReason && !exhausted;
        const cooldownMinutes = exhaustedAt ? Math.max(0, Math.ceil((KEY_COOLDOWN - (now - exhaustedAt)) / 60000)) : 0;
        return {
          index: i, prefix: k.slice(0, 8) + "...", available,
          status: invalidReason ? "invalid/restricted" : exhausted ? "cooldown" : "active",
          exhaustedMinAgo: exhaustedAt ? Math.round((now - exhaustedAt) / 60000) : null,
          cooldownMinutes,
          message: probe?.message || (invalidReason ? "Key invalid বা API restriction আছে" : exhausted ? `Quota শেষ, ${cooldownMinutes} মিনিট পরে retry` : "Ready"),
        };
      });
      return new Response(JSON.stringify({ totalKeys: keys.length, available: statuses.filter(s => s.available).length, keys: statuses }), {
        headers: jsonHeaders,
      });
    }

    const keys = await getAllApiKeys();

    if (keys.length === 0) {
      const fallback = await searchFallback(query || "bangla trending song 2026", maxResults);
      return new Response(JSON.stringify(fallback), { status: 200, headers: jsonHeaders });
    }

    if (action === "trending") {
      const categoryId = url.searchParams.get("categoryId") || undefined;
      const cacheKey = `${CACHE_VERSION}:trending:${categoryId || "all"}:${maxResults}`;
      const cached = getCached(cacheKey, CACHE_TTL_TRENDING);
      if (cached) return new Response(JSON.stringify(cached), { headers: jsonHeaders });
      const response = await getTrendingWithRotation(keys, maxResults, categoryId);
      if (response.results.length > 0 && response.source !== "fallback") setCache(cacheKey, response);
      return new Response(JSON.stringify(response), { headers: jsonHeaders });
    }

    if (!query) {
      const cacheKey = `${CACHE_VERSION}:trending:default:${maxResults}`;
      const cached = getCached(cacheKey, CACHE_TTL_TRENDING);
      if (cached) return new Response(JSON.stringify(cached), { headers: jsonHeaders });
      const response = await getTrendingWithRotation(keys, maxResults);
      if (response.results.length > 0 && response.source !== "fallback") setCache(cacheKey, response);
      return new Response(JSON.stringify(response), { headers: jsonHeaders });
    }

    const cacheKey = `${CACHE_VERSION}:search:${query}:${order}:${maxResults}:${pageToken || ""}`;
    const cached = getCached(cacheKey, CACHE_TTL_SEARCH);
    if (cached) return new Response(JSON.stringify(cached), { headers: jsonHeaders });
    const response = await searchYouTubeWithRotation(keys, query, pageToken, maxResults, order);
    const responseWithToken = { ...response, nextPageToken: (response as any).nextPageToken };
    if (response.results.length > 0 && response.source !== "fallback") setCache(cacheKey, responseWithToken);
    return new Response(JSON.stringify(responseWithToken), { headers: jsonHeaders });

  } catch (e) {
    console.error("youtube-search error:", e);
    return new Response(JSON.stringify(getFallbackVideos(25)), {
      status: 200, headers: jsonHeaders,
    });
  }
}

export const Route = createFileRoute("/api/youtube-search")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
