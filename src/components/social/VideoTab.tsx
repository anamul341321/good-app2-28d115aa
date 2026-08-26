import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listUsers } from "@/lib/social-users.functions";
import {
  Loader2,
  MoreVertical,
  Play,
  Search,
  Mic,
  X,
  ThumbsUp,
  UploadCloud,
  User,
  ArrowLeft,
  MessageCircle,
  Share2,
  Send,
  Bell,
  ChevronDown,
  History,
  Maximize2,
  Minimize2,
  

  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { useAuth } from "@/hooks/useAuth";
import {
  getBangladeshExternalVideos,
  getUploadedLongVideos,
  fetchYouTubeSuggestions,
  trackVideoPreference,
  incrementPostView,
  notifyPostShared,
  toggleLike,
  getLocalVideoEngagement,
  getChannelStats,
  toggleChannelSubscription,
  getPostComments,
  addComment,
  type ExternalReelVideo,
} from "@/lib/feed-api";
import {
  addWatchHistory,
  clearWatchHistory,
  readWatchHistory,
  removeWatchHistory,
  watchedAgoLabel,
  type WatchHistoryItem,
} from "@/lib/video-history";
import { useFeedMedia } from "@/lib/feed-media";
import { attachBackgroundAudio, attachBackgroundEmbed } from "@/lib/background-audio";
import { getYoutubeAudioStream } from "@/lib/yt-audio.functions";




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
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set());
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [listening, setListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);

  useEffect(() => {
    setHistory(readWatchHistory());
  }, []);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Advance the recommendation query while the tab stays open.
  const [freshness, setFreshness] = useState(() => Math.floor(Date.now() / (3 * 60 * 1000)) % 9973);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFreshness(Math.floor(Date.now() / (3 * 60 * 1000)) % 9973);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    queryKey: ["feed-videos", search, freshness],
    initialPageParam: { page: 1, token: undefined as string | undefined },
    queryFn: async ({ pageParam }) => {
      const [local, external] = await Promise.all([
        getUploadedLongVideos(pageParam.page, pageParam.page === 1 ? 8 : 3, search || undefined),
        getBangladeshExternalVideos(pageParam.page, 18, undefined, search || undefined, "long", freshness, pageParam.token),

      ]);
      // Keep the recommendation provider's relevance order. Sorting every page
      // by lifetime views made the same old songs occupy the first rows forever.
      const videos = [...external.videos];
      local.videos.forEach((video, index) => videos.splice(Math.min(index * 5 + 2, videos.length), 0, video));
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

  const playing =
    videos.find((video) => video.id === playingId) ||
    history.find((video) => video.id === playingId) ||
    null;
  const suggestedVideos = playing
    ? videos.filter((video) => video.id !== playing.id && !playedIds.has(video.id))
    : videos;


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

  // সার্চ করলে ভিডিওর সাথে মিলিয়ে চ্যানেলও (ইউজার) দেখাবে — YouTube-এর মতো
  const { data: channelHits } = useQuery({
    queryKey: ["video-channel-search", search],
    queryFn: () => listUsers({ data: { page: 1, limit: 6, query: search } }),
    enabled: !!search && !showHistory,
    staleTime: 60_000,
  });

  const playVideo = (video: ExternalReelVideo) => {
    setPlayingId(video.id);
    setPlayedIds((current) => new Set(current).add(video.id));
    setHistory(addWatchHistory(video));
    trackVideoPreference({ id: video.id, title: video.title, category: video.category });
    if (video.local_post_id) incrementPostView(video.local_post_id).catch(() => {});
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };


  return (
    <div className="mx-auto max-w-lg pb-6 bg-white dark:bg-background min-h-screen">
      <div className="sticky safe-top-video-search z-30 bg-white dark:bg-card border-b border-gray-100 dark:border-border/30">
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

        <div className="flex items-center gap-2 overflow-x-auto px-3 pb-2 scrollbar-hide">
          {user ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-black"
              onClick={() => navigate({ to: "/channel/$userId", params: { userId: user.id } })}
            >
              <User className="mr-1 h-4 w-4" /> আমার চ্যানেল
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant={showHistory ? "default" : "secondary"}
            className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-black"
            onClick={() => {
              setHistory(readWatchHistory());
              setShowHistory((prev) => !prev);
            }}
          >
            <History className="mr-1 h-4 w-4" /> হিস্টোরি
          </Button>
          {showHistory && history.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 shrink-0 rounded-lg px-2.5 text-[12.5px] font-black text-red-600"
              onClick={() => {
                clearWatchHistory();
                setHistory([]);
                toast.success("হিস্টোরি মুছে ফেলা হয়েছে");
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> সব মুছুন
            </Button>
          ) : null}
        </div>

        {!showHistory ? (
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
        ) : null}

        {search && !showHistory ? (
          <div className="flex items-center justify-between gap-2 px-3 pb-2">
            <button
              type="button"
              onClick={() => { setQuery(""); setSuggestions([]); setShowSuggest(false); runSearch(""); }}
              className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-secondary px-3 py-1.5 text-[12.5px] font-black text-gray-800 dark:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> হোমে ফিরুন
            </button>
            <span className="truncate text-[11.5px] font-bold text-gray-500">“{search}” — ফলাফল</span>
          </div>
        ) : null}
      </div>

      {search && !showHistory && (channelHits?.users?.length ?? 0) > 0 ? (
        <div className="border-b border-gray-100 dark:border-border/30 px-3 py-2">
          <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-gray-500">চ্যানেল</p>
          <div className="space-y-1">
            {(channelHits?.users ?? []).map((u: any) => (
              <button
                key={u.id}
                type="button"
                onClick={() => navigate({ to: "/channel/$userId", params: { userId: u.id } })}
                className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-gray-50 dark:hover:bg-secondary"
              >
                <MessengerAvatar name={u.display_name || "User"} src={u.avatar_url ?? undefined} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-black text-gray-900 dark:text-foreground">
                    {u.display_name || "User"}
                  </span>
                  <span className="block text-[11px] text-gray-500">চ্যানেল দেখুন</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {playing && (
        <InlinePlayer
          key={playing.id}
          video={playing}
          userId={user?.id}
          suggestedVideos={suggestedVideos}
          onPlaySuggested={playVideo}
          hasMoreSuggested={Boolean(hasNextPage)}
          loadingMoreSuggested={isFetchingNextPage}
          onLoadMoreSuggested={() => void fetchNextPage()}
          onClose={() => setPlayingId(null)}
        />
      )}

      {showHistory ? (
        <div className="space-y-1">
          <p className="px-3 pt-3 text-[13px] font-black text-gray-600 dark:text-muted-foreground">
            আগে যেগুলো দেখেছেন — চাইলে আবার চালান
          </p>
          {history.length === 0 ? (
            <p className="py-16 text-center text-sm font-bold text-gray-500">এখনো কোনো হিস্টোরি নেই</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="relative">
                <VideoCard video={item} onPlay={() => playVideo(item)} />
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-[11.5px] font-bold text-gray-500 dark:text-muted-foreground">
                    {watchedAgoLabel(item.watched_at)} দেখা হয়েছে
                  </span>
                  <button
                    type="button"
                    aria-label="হিস্টোরি থেকে সরান"
                    onClick={() => setHistory(removeWatchHistory(item.id))}
                    className="rounded-full p-1 text-gray-400 active:bg-gray-100 dark:active:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : videos.length === 0 ? (
        <p className="py-16 text-center text-sm font-bold text-gray-500">কোনো ভিডিও পাওয়া যায়নি</p>
      ) : (
        <div className="space-y-1">
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

      {/* ভিডিও আপলোড — নিচে ভাসমান + বাটন */}
      <button
        type="button"
        aria-label="ভিডিও আপলোড"
        onClick={() => navigate({ to: "/studio" })}
        className="fixed bottom-24 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-red-600 text-white shadow-[0_10px_28px_rgba(220,38,38,0.5)] active:scale-95 transition"
      >
        <Plus className="h-7 w-7" />
        <span className="sr-only">
          <UploadCloud className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}


function InlinePlayer({
  video,
  userId,
  suggestedVideos,
  onPlaySuggested,
  hasMoreSuggested,
  loadingMoreSuggested,
  onLoadMoreSuggested,
  onClose,
}: {
  video: ExternalReelVideo;
  userId?: string;
  suggestedVideos: ExternalReelVideo[];
  onPlaySuggested: (video: ExternalReelVideo) => void;
  hasMoreSuggested: boolean;
  loadingMoreSuggested: boolean;
  onLoadMoreSuggested: () => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLocal = video.source === "good-app";
  const postId = video.local_post_id || "";
  const source = useFeedMedia(isLocal ? video.video_url : undefined);
  const avatar = useFeedMedia(video.uploader_avatar_url || undefined);
  const viewLabel = formatViews(video.view_count);
  const [liked, setLiked] = useState<boolean>(() => !!readLikes()[video.id]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [playerMode, setPlayerMode] = useState<"expanded" | "mini">("expanded");
  const [localMediaFailed, setLocalMediaFailed] = useState(false);
  const [localMediaKey, setLocalMediaKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cssFullscreen, setCssFullscreen] = useState(false);
  const [viewportBox, setViewportBox] = useState({ w: 0, h: 0 });
  const dragStartY = useRef<number | null>(null);
  const playerModeRef = useRef(playerMode);

  useEffect(() => {
    const sync = () => setViewportBox({ w: window.innerWidth, h: window.innerHeight });
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);



  const relatedTerms = useMemo(() => buildRelatedSearchTerms(video), [video]);
  const [relatedFreshness, setRelatedFreshness] = useState(() => Math.floor(Date.now() / (3 * 60 * 1000)) % 9973);
  useEffect(() => {
    setRelatedFreshness(Math.floor(Date.now() / (3 * 60 * 1000)) % 9973);
    const timer = window.setInterval(() => {
      setRelatedFreshness(Math.floor(Date.now() / (3 * 60 * 1000)) % 9973);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [video.id]);
  const { data: relatedData, isLoading: relatedLoading } = useQuery({
    queryKey: ["video-related", video.id, relatedTerms[0], relatedFreshness],
    queryFn: () => getBangladeshExternalVideos(1, 14, undefined, relatedTerms[0], "long", relatedFreshness),
    staleTime: 3 * 60 * 1000,
  });
  const { data: relatedData2 } = useQuery({
    queryKey: ["video-related-2", video.id, relatedTerms[1], relatedFreshness],
    queryFn: () => getBangladeshExternalVideos(1, 14, undefined, relatedTerms[1], "long", relatedFreshness),
    enabled: !!relatedTerms[1] && relatedTerms[1] !== relatedTerms[0],
    staleTime: 3 * 60 * 1000,
  });


  const visibleSuggestedVideos = useMemo(() => {
    const seen = new Set([video.id]);
    const seenTitles = new Set<string>();
    const currentTitle = recommendationTitleKey(video.title);
    const currentWords = new Set(currentTitle.split(" ").filter((w) => w.length > 2));
    // Interleave the two topical result sets so suggestions stay varied.
    const a = relatedData?.videos || [];
    const b = relatedData2?.videos || [];
    const merged: ExternalReelVideo[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i]) merged.push(a[i]);
      if (b[i]) merged.push(b[i]);
    }
    return [...merged, ...suggestedVideos].filter((item) => {
      if (seen.has(item.id)) return false;
      const titleKey = recommendationTitleKey(item.title);
      if (titleKey && (titleKey === currentTitle || seenTitles.has(titleKey))) return false;
      // Drop near-duplicates of the playing song (same song, other uploads).
      if (titleKey && currentWords.size) {
        const words = titleKey.split(" ").filter((w) => w.length > 2);
        if (words.length) {
          const overlap = words.filter((w) => currentWords.has(w)).length / words.length;
          if (overlap >= 0.7) return false;
        }
      }
      seen.add(item.id);
      if (titleKey) seenTitles.add(titleKey);
      return true;
    });
  }, [relatedData?.videos, relatedData2?.videos, suggestedVideos, video.id, video.title]);


  const playNextImpl = useCallback(() => {
    const next = visibleSuggestedVideos[0];
    if (next) onPlaySuggested(next);
    else if (hasMoreSuggested && !loadingMoreSuggested) onLoadMoreSuggested();
  }, [hasMoreSuggested, loadingMoreSuggested, onLoadMoreSuggested, onPlaySuggested, visibleSuggestedVideos]);

  // Keep a stable callback identity so player/background-audio effects never
  // re-run (which used to pause playback mid-video).
  const playNextRef = useRef(playNextImpl);
  useEffect(() => {
    playNextRef.current = playNextImpl;
  }, [playNextImpl]);
  const playNext = useCallback(() => {
    playNextRef.current();
  }, []);

  // এমবেড প্লেয়ারের বর্তমান পজিশন — background handoff-এ ঠিক জায়গা থেকে চালু হবে
  const embedPositionRef = useRef(0);

  const youtubeId = useMemo(() => {
    if (isLocal) return null;
    if (video.video_id) return String(video.video_id);
    const match = String(video.video_url || "").match(/embed\/([A-Za-z0-9_-]{6,})/);
    return match?.[1] ?? null;
  }, [isLocal, video.video_id, video.video_url]);

  const { data: bgAudio } = useQuery({
    queryKey: ["yt-audio-stream", youtubeId],
    queryFn: () => getYoutubeAudioStream({ data: { videoId: youtubeId as string } }),
    enabled: !!youtubeId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const bgAudioRef = useRef<string | null>(null);
  useEffect(() => {
    bgAudioRef.current = bgAudio?.url ?? null;
  }, [bgAudio?.url]);

  useEffect(() => {
    if (isLocal) return;
    const onPlayerMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      let payload: any = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
      const current = payload?.info?.currentTime;
      if (typeof current === "number" && Number.isFinite(current)) embedPositionRef.current = current;
      if (payload?.event === "onStateChange" && Number(payload?.info) === 0) playNext();
    };
    window.addEventListener("message", onPlayerMessage);
    const frame = iframeRef.current;
    const timer = window.setTimeout(() => {
      frame?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: frame.id }), "https://www.youtube-nocookie.com");
    }, 700);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onPlayerMessage);
    };
  }, [isLocal, playNext, video.id]);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const info = {
      title: video.title,
      artist: video.creator || "good-app",
      artwork: video.thumbnail_url || undefined,
    };
    if (isLocal) {
      const el = localVideoRef.current;
      if (!el || !source) return;
      return attachBackgroundAudio(el, source, info, { onNext: playNext });
    }
    return attachBackgroundEmbed(
      () => iframeRef.current?.contentWindow,
      "https://www.youtube-nocookie.com",
      info,
      { onNext: playNext },
      {
        getAudioSrc: () => bgAudioRef.current,
        getPosition: () => embedPositionRef.current,
      },
    );
  }, [isLocal, source, video.id, video.title, video.creator, video.thumbnail_url, playNext]);




  const { data: engagement } = useQuery({
    queryKey: ["video-engagement", postId],
    queryFn: () => getLocalVideoEngagement(postId),
    enabled: isLocal && !!postId,
  });

  const { data: channelStats } = useQuery({
    queryKey: ["video-channel", video.uploader_user_id, userId],
    queryFn: () => getChannelStats(video.uploader_user_id as string, userId),
    enabled: isLocal && !!video.uploader_user_id,
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["video-comments", postId],
    queryFn: () => getPostComments(postId, userId),
    enabled: isLocal && !!postId && showComments,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !video.uploader_user_id) throw new Error("invalid");
      return toggleChannelSubscription(userId, video.uploader_user_id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["video-channel", video.uploader_user_id, userId] }),
    onError: () => toast.error("সাবস্ক্রাইব করা যায়নি"),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !postId || !commentText.trim()) throw new Error("invalid");
      return addComment(postId, userId, commentText.trim());
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["video-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["video-engagement", postId] });
    },
    onError: () => toast.error("মন্তব্য যোগ করা যায়নি"),
  });

  const onLike = async () => {
    const next = !liked;
    setLiked(next);
    writeLike(video.id, next);
    if (isLocal && postId && userId) {
      try {
        await toggleLike(postId, userId);
        queryClient.invalidateQueries({ queryKey: ["video-engagement", postId] });
      } catch {
        // like still tracked locally
      }
    }
  };

  const onShare = async () => {
    const url = isLocal && postId
      ? `${window.location.origin}/watch/${postId}`
      : video.watch_url || video.video_url;
    try {
      if (navigator.share) await navigator.share({ title: video.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("লিংক কপি হয়েছে");
      }
      if (isLocal && postId && userId) void notifyPostShared(postId, userId);
    } catch {
      // user cancelled
    }
  };

  const likeCount = isLocal ? engagement?.likes_count ?? video.likes_count ?? 0 : 0;
  const commentCount = isLocal ? engagement?.comments_count ?? video.comments_count ?? 0 : 0;

  useEffect(() => {
    setPlayerMode("expanded");
  }, [video.id]);

  useEffect(() => {
    playerModeRef.current = playerMode;
  }, [playerMode]);

  useEffect(() => {
    window.history.pushState({ goodAppVideoPlayer: true }, "");
    const onPop = () => {
      if (playerModeRef.current === "expanded") setPlayerMode("mini");
      else onClose();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose, video.id]);

  useEffect(() => {
    const onFsChange = () => {
      const active = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(active);
      if (active) {
        try { (window as any).GoodAppDownloader?.enterVideoFullscreen?.(); } catch { /* web preview */ }
        try { void (screen.orientation as any)?.lock?.("landscape"); } catch { /* unsupported */ }
      } else {
        try { (window as any).GoodAppDownloader?.exitVideoFullscreen?.(); } catch { /* web preview */ }
        try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
    };
  }, []);

  // আমাদের নিজের রোটেট বাটন — YouTube এর fullscreen বাটন ব্যবহার হয় না।
  const toggleFullscreen = useCallback(async () => {
    const nativeActive = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
    if (nativeActive || cssFullscreen) {
      try {
        if (nativeActive && document.exitFullscreen) await document.exitFullscreen();
        else (document as any).webkitExitFullscreen?.();
      } catch { /* ignore */ }
      setCssFullscreen(false);
      try { (window as any).GoodAppDownloader?.exitVideoFullscreen?.(); } catch { /* web preview */ }
      try { (screen.orientation as any)?.unlock?.(); } catch { /* ignore */ }
      return;
    }
    setPlayerMode("expanded");
    setCssFullscreen(true);
    try { (window as any).GoodAppDownloader?.enterVideoFullscreen?.(); } catch { /* web preview */ }
    try { await (screen.orientation as any)?.lock?.("landscape"); } catch { /* ignore — CSS rotate fallback */ }
  }, [cssFullscreen]);

  const effectiveFullscreen = isFullscreen || cssFullscreen;
  // ফোন যদি ঘুরতে না চায়, তখন প্লেয়ারটাকেই ৯০° ঘুরিয়ে পুরো স্ক্রিন ভরে দেওয়া হয়
  const rotateStage = effectiveFullscreen && viewportBox.h > viewportBox.w && viewportBox.w > 0;
  const stageStyle = rotateStage
    ? {
        width: `${viewportBox.h}px`,
        height: `${viewportBox.w}px`,
        transform: "translate(-50%, -50%) rotate(90deg)",
        position: "absolute" as const,
        top: "50%",
        left: "50%",
      }
    : undefined;



  const beginCollapseDrag = (event: PointerEvent) => {
    if (playerMode !== "expanded") return;
    dragStartY.current = event.clientY;
  };

  const finishCollapseDrag = (event: PointerEvent) => {
    if (dragStartY.current === null) return;
    const distance = event.clientY - dragStartY.current;
    dragStartY.current = null;
    if (distance > 56) setPlayerMode("mini");
  };

  return (
    <div
      className={
        playerMode === "mini"
          ? "fixed inset-x-2 bottom-[calc(78px+env(safe-area-inset-bottom))] z-[70] mx-auto max-w-lg pointer-events-none"
          : "fixed inset-0 z-[70] flex flex-col overflow-hidden bg-white dark:bg-background"
      }
    >
      <div
        className={
          playerMode === "mini"
            ? "pointer-events-auto flex h-20 overflow-hidden rounded-2xl border border-border/40 bg-card shadow-[0_12px_40px_rgba(15,23,42,0.28)]"
            : "flex h-screen flex-col bg-white dark:bg-background"
        }
      >
        {playerMode === "expanded" ? (
          <div
            className="sticky top-0 z-10 shrink-0 bg-black safe-top"
            onPointerDown={beginCollapseDrag}
            onPointerUp={finishCollapseDrag}
            onPointerCancel={() => {
              dragStartY.current = null;
            }}
          >
            <div className="flex h-11 items-center justify-between px-2">
              <button
                type="button"
                aria-label="ছোট করুন"
                onClick={() => setPlayerMode("mini")}
                className="grid h-9 w-9 place-items-center rounded-full text-white active:bg-white/15"
              >
                <ChevronDown className="h-6 w-6" />
              </button>
              <span className="text-[14px] font-black tracking-tight text-white">good-app player</span>
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label={effectiveFullscreen ? "ফুল স্ক্রিন বন্ধ" : "রোটেট করে ফুল স্ক্রিন"}
                  onClick={toggleFullscreen}
                  className="grid h-9 w-9 place-items-center rounded-full text-white active:bg-white/15"
                >
                  {effectiveFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                <button
                  type="button"
                  aria-label="বন্ধ করুন"
                  onClick={onClose}
                  className="grid h-9 w-9 place-items-center rounded-full text-white active:bg-white/15"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

            </div>
          </div>
        ) : null}

      <div
        ref={playerBoxRef}
        className={
          playerMode === "mini"
            ? "relative h-20 w-36 shrink-0 overflow-hidden bg-black"
            : effectiveFullscreen
              ? "fixed inset-0 z-[999] flex h-[100dvh] w-screen items-center justify-center overflow-hidden bg-black"
              : "relative aspect-video w-full shrink-0 overflow-hidden bg-black"
        }
      >
        <div
          className={rotateStage ? "overflow-hidden bg-black" : "relative h-full w-full overflow-hidden bg-black"}
          style={stageStyle}
        >
        {isLocal && source && !localMediaFailed ? (
          <video
            key={localMediaKey}
            ref={localVideoRef}
            src={source}
            controls
            autoPlay
            playsInline
            preload="metadata"
            onLoadedData={() => setLocalMediaFailed(false)}
            onError={() => setLocalMediaFailed(true)}
            onEnded={playNext}
            className="h-full w-full object-contain"
          />
        ) : isLocal ? (
          <div className="grid h-full w-full place-items-center bg-black">
            {localMediaFailed ? (
              <Button variant="secondary" onClick={() => { setLocalMediaFailed(false); setLocalMediaKey((value) => value + 1); }}>
                ভিডিও আবার চালান
              </Button>
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            )}
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            id={`goodapp-player-${video.video_id || video.id}`}
            src={`${video.video_url}${video.video_url.includes("?") ? "&" : "?"}autoplay=1&playsinline=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=0&controls=1&color=white&enablejsapi=1${typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : ""}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            className="h-full w-full border-0"
          />
        )}
        {playerMode === "expanded" ? (
          <>
            {/* YouTube ব্র্যান্ডিং ঢেকে দিতে good-app ওয়াটারমার্ক — ভিডিও চলার পুরো সময় দেখা যাবে */}
            <div className="pointer-events-none absolute bottom-0 right-0 z-20 flex h-12 w-[132px] items-center justify-center bg-black/85">
              <span className="text-[13px] font-black tracking-tight text-white">good-app</span>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 z-20 flex h-12 w-[76px] items-center justify-center bg-black/85">
              <span className="text-[11px] font-black tracking-tight text-white">good-app</span>
            </div>
            <button
              type="button"
              aria-label={effectiveFullscreen ? "ফুল স্ক্রিন বন্ধ করুন" : "ফুল স্ক্রিন"}
              onClick={toggleFullscreen}
              className="absolute bottom-[52px] right-1 z-30 grid h-10 w-10 place-items-center rounded-sm text-white/95 active:opacity-70"
            >
              {effectiveFullscreen ? <Minimize2 className="h-7 w-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" /> : <Maximize2 className="h-7 w-7 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />}
            </button>
          </>
        ) : null}

        </div>
      </div>



        {playerMode === "mini" ? (
          <div className="flex min-w-0 flex-1 items-center gap-1 px-2">
            <button
              type="button"
              onClick={() => setPlayerMode("expanded")}
              className="min-w-0 flex-1 text-left"
            >
              <span className="line-clamp-1 text-[12.5px] font-black leading-tight text-foreground">{video.title}</span>
              <span className="mt-0.5 block truncate text-[11px] font-semibold text-muted-foreground">
                {video.creator || "good-app"}
              </span>
            </button>
            <button
              type="button"
              aria-label="বড় করুন"
              onClick={() => setPlayerMode("expanded")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground active:bg-secondary"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="বন্ধ করুন"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground active:bg-secondary"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white px-3 py-3 dark:bg-card">
        <h2 className="text-[17px] font-black leading-snug text-gray-950 dark:text-foreground">{video.title}</h2>
        <p className="mt-1 text-[12.5px] font-semibold text-gray-500 dark:text-muted-foreground">
          {viewLabel ? `${viewLabel} views · ` : ""}{video.creator || "good-app"}
        </p>

        {isLocal && video.uploader_user_id ? (
          <div className="mt-3 flex items-center justify-between border-y border-gray-100 dark:border-border/30 py-2.5">
            <button
              type="button"
              className="flex items-center gap-2 text-left"
              onClick={() => navigate({ to: "/channel/$userId", params: { userId: video.uploader_user_id as string } })}
            >
              <MessengerAvatar name={video.creator || "Channel"} src={avatar} size="md" />
              <span className="block">
                <span className="block text-[13.5px] font-black text-gray-950 dark:text-foreground">{video.creator || "Channel"}</span>
                <span className="block text-[11.5px] font-semibold text-gray-500 dark:text-muted-foreground">
                  {(channelStats?.subscriber_count ?? 0).toLocaleString()} সাবস্ক্রাইবার
                </span>
              </span>
            </button>
            {userId && userId !== video.uploader_user_id ? (
              <Button
                size="sm"
                variant={channelStats?.is_subscribed ? "secondary" : "default"}
                className="h-8 rounded-full px-3 text-[12px] font-black"
                onClick={() => subscribeMutation.mutate()}
                disabled={subscribeMutation.isPending}
              >
                <Bell className="mr-1 h-4 w-4" />
                {channelStats?.is_subscribed ? "সাবস্ক্রাইব করা আছে" : "সাবস্ক্রাইব"}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Button
            type="button"
            size="sm"
            variant={liked ? "default" : "secondary"}
            className="h-8 shrink-0 rounded-full px-3 text-[12.5px] font-black"
            onClick={onLike}
          >
            <ThumbsUp className="mr-1 h-4 w-4" /> {isLocal ? likeCount : liked ? "লাইক করা হয়েছে" : "লাইক"}
          </Button>
          {isLocal ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 rounded-full px-3 text-[12.5px] font-black"
              onClick={() => setShowComments((prev) => !prev)}
            >
              <MessageCircle className="mr-1 h-4 w-4" /> {commentCount} মন্তব্য
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 shrink-0 rounded-full px-3 text-[12.5px] font-black"
            onClick={onShare}
          >
            <Share2 className="mr-1 h-4 w-4" /> শেয়ার
          </Button>
        </div>

        {isLocal && showComments ? (
          <div className="mt-3 border-t border-gray-100 dark:border-border/30 pt-3">
            {userId ? (
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="মন্তব্য লিখুন..."
                  className="flex-1 rounded-full bg-gray-100 dark:bg-secondary px-3 py-2 text-sm outline-none"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : null}
            {commentsLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : (comments || []).length === 0 ? (
              <p className="py-2 text-xs font-semibold text-gray-500">এখনো কোনো মন্তব্য নেই</p>
            ) : (
              <div className="space-y-3">
                {(comments || []).map((comment: any) => (
                  <div key={comment.id} className="flex items-start gap-2">
                    <MessengerAvatar name={comment.user?.display_name || "User"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-black text-gray-950 dark:text-foreground">
                        {comment.user?.display_name || "User"}
                      </p>
                      <p className="text-[13.5px] text-gray-800 dark:text-foreground">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-border/30">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[15px] font-black text-gray-950 dark:text-foreground">এরকম আরও ভিডিও</h3>
            {relatedLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
          </div>
          <div className="-mx-3 space-y-1">
            {visibleSuggestedVideos.length > 0 ? (
              visibleSuggestedVideos.map((item) => (
                <VideoCard key={item.id} video={item} onPlay={() => onPlaySuggested(item)} />
              ))
            ) : relatedLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
            ) : (
              <p className="px-3 py-8 text-center text-xs font-bold text-gray-500 dark:text-muted-foreground">
                আরও ভিডিও লোড হচ্ছে...
              </p>
            )}
          </div>
          {hasMoreSuggested ? (
            <Button
              type="button"
              variant="secondary"
              className="mt-2 h-10 w-full rounded-full text-[13px] font-black"
              onClick={onLoadMoreSuggested}
              disabled={loadingMoreSuggested}
            >
              {loadingMoreSuggested ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              আরও ভিডিও দেখুন
            </Button>
          ) : null}
        </div>
      </div>
          </>
        )}
      </div>
    </div>
  );
}

function buildRelatedSearchTerm(video: ExternalReelVideo): string {
  const title = (video.title || "").replace(/[#|।].*$/g, " ").replace(/\s+/g, " ").trim();
  if (title.length >= 4) return title.slice(0, 90);
  if (video.category === "music") return "bangla new song 2026";
  return "bangla trending video";
}

function recommendationTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/\([^)]*(official|lyrics?|audio|video|৪k|4k|hd)[^)]*\)/gi, " ")
    .replace(/\[[^\]]*(official|lyrics?|audio|video|৪k|4k|hd)[^\]]*\]/gi, " ")
    .replace(/\b(official|music|lyric|lyrics|audio|video|full|hd|4k|বাংলা|bangla|bengali)\b/gi, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 72);
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
