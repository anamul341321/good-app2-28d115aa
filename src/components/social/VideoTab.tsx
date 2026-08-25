import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, MoreVertical, Play, Search, Mic, X, ThumbsUp, UploadCloud, User, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  getBangladeshExternalVideos,
  getUploadedLongVideos,
  fetchYouTubeSuggestions,
  trackVideoPreference,
  toggleLike,
  type ExternalReelVideo,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";

const LIKE_KEY = "goodapp_video_likes";

function readLikes(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LIKE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function writeLike(id: string, liked: boolean) {
  try {
    const next = readLikes();
    if (liked) next[id] = true;
    else delete next[id];
    window.localStorage.setItem(LIKE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

/**
 * "ভিডিও দেখুন" tab — YouTube-style suggestions, autocomplete, voice search,
 * inline player (only plays what the user taps) + endless suggested videos.
 */
export default function VideoTab() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [listening, setListening] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chips = [
    { label: "All", value: "" },
    { label: "Music", value: "bangla new song" },
    { label: "Mixes", value: "bangla mashup remix" },
    { label: "Bangla", value: "bangla trending video" },
    { label: "Natok", value: "bangla natok" },
    { label: "News", value: "bangladesh news" },
    { label: "Live", value: "bangla live song" },
  ];

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed-videos", search],
    initialPageParam: { page: 1, token: undefined as string | undefined },
    queryFn: async ({ pageParam }) => {
      const [local, external] = await Promise.all([
        getUploadedLongVideos(pageParam.page, pageParam.page === 1 ? 8 : 3, search || undefined),
        getBangladeshExternalVideos(pageParam.page, 18, undefined, search || undefined, "long", 0, pageParam.token),
      ]);
      const videos = [...local.videos, ...external.videos].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0));
      return { videos, page: pageParam.page, nextPageToken: external.nextPageToken };
    },
    getNextPageParam: (lastPage) => ({ page: lastPage.page + 1, token: lastPage.nextPageToken }),
  });

  const videos = useMemo(() => {
    const seen = new Set<string>();
    return (data?.pages.flatMap((page) => page.videos) || []).filter((video) => {
      if (seen.has(video.id)) return false;
      seen.add(video.id);
      return true;
    });
  }, [data]);

  const playing = videos.find((video) => video.id === playingId) || null;
  const suggestedVideos = playing ? videos.filter((video) => video.id !== playing.id) : videos;

  // Autocomplete: fetch YouTube suggestions while typing (debounced).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const list = await fetchYouTubeSuggestions(term);
        if (!cancelled) setSuggestions(list);
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, videos.length]);

  // Hardware/browser back closes the player instead of leaving the page,
  // and playback stops because the player unmounts.
  useEffect(() => {
    if (!playingId) return;
    window.history.pushState({ goodAppVideoPlayer: true }, "");
    const onPop = () => setPlayingId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [playingId]);

  const runSearch = useCallback((term: string) => {
    setQuery(term);
    setSearch(term.trim());
    setPlayingId(null);
    setShowSuggest(false);
    inputRef.current?.blur();
  }, []);

  const startVoiceSearch = useCallback(() => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("এই ডিভাইসে ভয়েস সার্চ সাপোর্ট করে না");
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = "bn-BD";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onerror = () => {
        setListening(false);
        toast.error("ভয়েস শোনা যায়নি, আবার চেষ্টা করুন");
      };
      recognition.onend = () => setListening(false);
      recognition.onresult = (event: any) => {
        const text = String(event?.results?.[0]?.[0]?.transcript || "").trim();
        if (text) runSearch(text);
      };
      recognition.start();
    } catch {
      setListening(false);
      toast.error("ভয়েস সার্চ চালু করা যায়নি");
    }
  }, [runSearch]);

  const playVideo = (video: ExternalReelVideo) => {
    setPlayingId(video.id);
    trackVideoPreference({ title: video.title, category: video.category });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  return (
    <div className="mx-auto max-w-lg pb-6 bg-white dark:bg-background min-h-screen">
      <div className="sticky top-[96px] z-30 bg-white dark:bg-card border-b border-gray-100 dark:border-border/30">
        <div className="px-3 py-2">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              runSearch(query);
            }}
            className="relative"
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggest(true);
              }}
              onFocus={() => setShowSuggest(true)}
              placeholder="গান, নাটক, খবর খুঁজুন..."
              className="w-full bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground rounded-full pl-10 pr-20 py-2 text-sm border-none outline-none placeholder:text-gray-400"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query ? (
                <button
                  type="button"
                  aria-label="মুছুন"
                  onClick={() => { setQuery(""); setSuggestions([]); }}
                  className="grid h-7 w-7 place-items-center rounded-full text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                aria-label="ভয়েস সার্চ"
                onClick={startVoiceSearch}
                className={`grid h-8 w-8 place-items-center rounded-full ${listening ? "bg-red-600 text-white animate-pulse" : "bg-gray-200 dark:bg-background text-gray-700 dark:text-foreground"}`}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>
          </form>

          {showSuggest && suggestions.length > 0 ? (
            <div className="mt-1 overflow-hidden rounded-2xl border border-gray-200 dark:border-border/40 bg-white dark:bg-card shadow-lg">
              {suggestions.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => runSearch(item)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13.5px] font-semibold text-gray-800 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary"
                >
                  <Search className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 px-3 pb-2">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg bg-red-600 px-3 text-[12.5px] font-black text-white hover:bg-red-700"
            onClick={() => navigate({ to: "/studio" })}
          >
            <UploadCloud className="mr-1 h-4 w-4" /> ভিডিও আপলোড
          </Button>
          {user ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-[12.5px] font-black"
              onClick={() => navigate({ to: "/channel/$userId", params: { userId: user.id } })}
            >
              <User className="mr-1 h-4 w-4" /> আমার চ্যানেল
            </Button>
          ) : null}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
          {chips.map((chip) => {
            const active = search === chip.value || (!search && chip.value === "");
            return (
              <Button
                key={chip.label}
                type="button"
                variant={active ? "default" : "secondary"}
                size="sm"
                className="h-8 shrink-0 rounded-lg px-3 text-[13px] font-bold"
                onClick={() => runSearch(chip.value)}
              >
                {chip.label}
              </Button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : videos.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold text-gray-500">কোনো ভিডিও পাওয়া যায়নি</p>
      ) : (
        <div className="space-y-1">
          {playing && (
            <InlinePlayer
              key={playing.id}
              video={playing}
              userId={user?.id}
              onClose={() => setPlayingId(null)}
            />
          )}

          {suggestedVideos.map((video) => (
            <VideoCard key={video.id} video={video} onPlay={() => playVideo(video)} />
          ))}

          <div ref={sentinelRef} className="flex justify-center py-5">
            {isFetchingNextPage ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            ) : (
              <span className="text-xs font-bold text-gray-400">আরও ভিডিও আসছে...</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InlinePlayer({ video, userId, onClose }: { video: ExternalReelVideo; userId?: string; onClose: () => void }) {
  const source = useFeedMedia(video.source === "good-app" ? video.video_url : undefined);
  const viewLabel = formatViews(video.view_count);
  const [liked, setLiked] = useState<boolean>(() => !!readLikes()[video.id]);

  useEffect(() => {
    try {
      (window as any).GoodAppDownloader?.beginMediaPlayback?.();
    } catch {}
    return () => {
      try {
        (window as any).GoodAppDownloader?.endMediaPlayback?.();
      } catch {}
    };
  }, [video.id]);

  const onLike = async () => {
    const next = !liked;
    setLiked(next);
    writeLike(video.id, next);
    if (video.source === "good-app" && userId) {
      try {
        await toggleLike(video.id, userId);
      } catch {
        // like still tracked locally
      }
    }
  };

  return (
    <div className="bg-white dark:bg-card border-b border-gray-100 dark:border-border/30">
      <div className="aspect-video w-full bg-black">
        {video.source === "good-app" ? (
          <video src={source} controls autoPlay playsInline className="h-full w-full" />
        ) : (
          <iframe
            src={`${video.video_url}${video.video_url.includes("?") ? "&" : "?"}autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
          />
        )}
      </div>
      <div className="px-3 py-3">
        <h2 className="text-[17px] font-black leading-snug text-gray-950 dark:text-foreground">{video.title}</h2>
        <p className="mt-1 text-[12.5px] font-semibold text-gray-500 dark:text-muted-foreground">
          {viewLabel ? `${viewLabel} views · ` : ""}{video.creator || "YouTube"}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={liked ? "default" : "secondary"}
            className="h-8 rounded-full px-3 text-[12.5px] font-black"
            onClick={onLike}
          >
            <ThumbsUp className="mr-1 h-4 w-4" /> {liked ? "লাইক করা হয়েছে" : "লাইক"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 rounded-full px-3 text-[12.5px] font-black"
            onClick={onClose}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> আরও খুঁজুন
          </Button>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: ExternalReelVideo; onPlay: () => void }) {
  const thumb = useFeedMedia(video.thumbnail_url || undefined);
  const viewLabel = formatViews(video.view_count);

  return (
    <Button variant="ghost" onClick={onPlay} className="block h-auto w-full rounded-none p-0 text-left hover:bg-transparent">
      <span className="block w-full bg-white dark:bg-card pb-3 active:scale-[0.995] transition">
        <span className="relative block aspect-video w-full overflow-hidden bg-gray-200 dark:bg-secondary">
          {thumb ? <img src={thumb} alt={video.title} className="h-full w-full object-cover" /> : null}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55">
              <Play className="h-4 w-4 text-white" />
            </span>
          </span>
          {video.duration ? (
            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-black text-white">
              {formatDuration(video.duration)}
            </span>
          ) : null}
        </span>
        <span className="flex gap-3 px-3 pt-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-200 dark:bg-secondary text-[13px] font-black text-gray-600 dark:text-muted-foreground">
            {(video.creator || "Y").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[15px] font-black leading-snug text-gray-950 dark:text-foreground">{video.title}</span>
            <span className="mt-1 block truncate text-[12px] font-semibold text-gray-500 dark:text-muted-foreground">
              {video.creator || "YouTube"} · {viewLabel ? `${viewLabel} views` : video.source === "good-app" ? "Good-App" : "Suggested"}
            </span>
          </span>
          <span className="mt-0.5 shrink-0 text-gray-500 dark:text-muted-foreground">
            <MoreVertical className="h-5 w-5" />
          </span>
        </span>
      </span>
    </Button>
  );
}

function formatViews(value?: number): string {
  const views = Number(value || 0);
  if (!Number.isFinite(views) || views <= 0) return "";
  if (views >= 1_000_000_000) return `${trimNumber(views / 1_000_000_000)}B`;
  if (views >= 1_000_000) return `${trimNumber(views / 1_000_000)}M`;
  if (views >= 1_000) return `${trimNumber(views / 1_000)}K`;
  return String(Math.round(views));
}

function trimNumber(value: number): string {
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, "");
}

function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}
