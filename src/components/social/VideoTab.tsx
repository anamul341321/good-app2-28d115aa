import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
  notifyPostShared,
  toggleLike,
  getLocalVideoEngagement,
  getChannelStats,
  toggleChannelSubscription,
  getPostComments,
  addComment,
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
  const [playedIds, setPlayedIds] = useState<Set<string>>(() => new Set());
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [listening, setListening] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // প্রতি ৩ মিনিটে নতুন rotation — একই ভিডিও বারবার আসবে না
  const freshness = useMemo(() => Math.floor(Date.now() / (3 * 60 * 1000)) % 9973, []);
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

  const playing = videos.find((video) => video.id === playingId) || null;
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
    setPlayedIds((current) => new Set(current).add(video.id));
    trackVideoPreference({ id: video.id, title: video.title, category: video.category });
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
              suggestedVideos={suggestedVideos}
              onPlaySuggested={playVideo}
              hasMoreSuggested={Boolean(hasNextPage)}
              loadingMoreSuggested={isFetchingNextPage}
              onLoadMoreSuggested={() => void fetchNextPage()}
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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const relatedSearch = useMemo(() => buildRelatedSearchTerm(video), [video]);
  const relatedFreshness = useMemo(() => Math.floor(Date.now() / (3 * 60 * 1000)) % 9973, [video.id]);
  const { data: relatedData, isLoading: relatedLoading } = useQuery({
    queryKey: ["video-related", video.id, relatedSearch, relatedFreshness],
    queryFn: () => getBangladeshExternalVideos(1, 18, undefined, relatedSearch, "long", relatedFreshness),
    staleTime: 3 * 60 * 1000,
  });


  const visibleSuggestedVideos = useMemo(() => {
    const seen = new Set([video.id]);
    const seenTitles = new Set<string>();
    const currentTitle = recommendationTitleKey(video.title);
    return [...(relatedData?.videos || []), ...suggestedVideos].filter((item) => {
      if (seen.has(item.id)) return false;
      const titleKey = recommendationTitleKey(item.title);
      if (titleKey && (titleKey === currentTitle || seenTitles.has(titleKey))) return false;
      seen.add(item.id);
      if (titleKey) seenTitles.add(titleKey);
      return true;
    });
  }, [relatedData?.videos, suggestedVideos, video.id]);

  const playNext = useCallback(() => {
    const next = visibleSuggestedVideos[0];
    if (next) onPlaySuggested(next);
    else if (hasMoreSuggested && !loadingMoreSuggested) onLoadMoreSuggested();
  }, [hasMoreSuggested, loadingMoreSuggested, onLoadMoreSuggested, onPlaySuggested, visibleSuggestedVideos]);

  useEffect(() => {
    if (isLocal) return;
    const onPlayerMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube-nocookie.com") return;
      let payload: any = event.data;
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload); } catch { return; }
      }
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

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-black">
      {/* good-app player header */}
      <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between bg-black px-2 py-1.5">
        <button
          type="button"
          aria-label="ফিরে যান"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-full text-white active:bg-white/15"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[14px] font-black tracking-tight text-white">good-app</span>
        <button
          type="button"
          aria-label="শেয়ার"
          onClick={onShare}
          className="grid h-9 w-9 place-items-center rounded-full text-white active:bg-white/15"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-black">
        {isLocal ? (
          <video src={source} controls autoPlay playsInline onEnded={playNext} className="h-full w-full" />
        ) : (
          <>
            <iframe
              ref={iframeRef}
              id={`goodapp-player-${video.video_id || video.id}`}
              src={`${video.video_url}${video.video_url.includes("?") ? "&" : "?"}autoplay=1&playsinline=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&fs=0&controls=1&disablekb=1&color=white&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              className="h-full w-full border-0"
            />
            {/* Hide external branding: top title/channel/logo strip */}
            <div className="absolute left-0 right-0 top-0 h-11 bg-black" />
            {/* Hide bottom branding row + extra buttons, keep the seek bar visible above it */}
            <div className="absolute bottom-0 left-0 right-0 h-9 bg-black" />
            <span className="absolute left-2 top-2 text-[11px] font-black tracking-tight text-white/90">good-app player</span>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 bg-white px-3 py-3 dark:bg-card">
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
