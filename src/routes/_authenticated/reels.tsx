import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Heart,
  MessageCircle,
  Share2,
  Volume2,
  VolumeX,
  Plus,
  Loader2,
  Send,
  X,
  ExternalLink,
  ArrowLeft,
  Play,
  Eye,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  getFeedPosts,
  getBangladeshExternalVideos,
  trackVideoPreference,
  markReelsSeen,
  getShortVideoPostById,
  toggleLike,
  getUserLikes,
  notifyPostShared,
  incrementPostView,
  getPostComments,
  addComment,
  uploadPostMedia,
  createPost,
  type Post,
  type ExternalReelVideo,
  type PostComment,
  LONG_VIDEO_MARKER,
} from "@/lib/feed-api";

import { useFeedMedia, prefetchFeedMedia } from "@/lib/feed-media";
import { attachBackgroundAudio } from "@/lib/background-audio";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMediaFullscreen } from "@/hooks/use-media-fullscreen";

export const Route = createFileRoute("/_authenticated/reels")({
  component: ReelsPage,
  validateSearch: (search: Record<string, unknown>): { postId?: string } => {
    const postId = typeof search.postId === "string" ? search.postId : undefined;
    return postId ? { postId } : {};
  },
  head: () => ({
    meta: [
      { title: "রিলস — good-app" },
      {
        name: "description",
        content: "শর্ট ভিডিও দেখুন এবং শেয়ার করুন — good-app রিলস।",
      },
      { property: "og:title", content: "রিলস — good-app" },
      {
        property: "og:description",
        content: "শর্ট ভিডিও দেখুন এবং শেয়ার করুন — good-app রিলস।",
      },
      { property: "og:type", content: "video.other" },
    ],
  }),
});

type ReelItem =
  | { kind: "local"; id: string; post: Post }
  | { kind: "external"; id: string; video: ExternalReelVideo };

function useCombinedReels(selectedPostId?: string) {
  // লোকাল ভিডিও আগে দেখানো হয় — বাইরের (YouTube) লিস্ট ব্যাকগ্রাউন্ডে আসে,
  // তাই Short-এ ঢুকলেই আর দীর্ঘ লোডিং স্ক্রিন দেখতে হবে না।
  const localQuery = useQuery({
    queryKey: ["reels-local-posts"],
    queryFn: () => getFeedPosts(30),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
  const externalQuery = useQuery({
    queryKey: ["reels-external"],
    queryFn: () => getBangladeshExternalVideos(1, 20, undefined, undefined, "short"),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 0,
  });

  const selectedPostQuery = useQuery({
    queryKey: ["reels-selected-post", selectedPostId],
    queryFn: () => getShortVideoPostById(selectedPostId || ""),
    enabled: !!selectedPostId,
    staleTime: 60_000,
  });

  // TikTok-এর মতো: প্রতিবার Short খুললে ভিডিওগুলো এলোমেলো (mixed) ক্রমে আসবে,
  // সিরিয়ালি একের পর এক নয়। সেশনের ভেতরে ক্রম স্থির থাকবে।
  const seedRef = useRef<number>(Math.floor(Math.random() * 1_000_000) + 1);

  const items = useMemo<ReelItem[]>(() => {
    let localVideos = (localQuery.data || []).filter(
      (p) => !!p.video_url && !(p.content || "").startsWith(LONG_VIDEO_MARKER),
    );
    let pinned: ReelItem | null = null;
    if (selectedPostQuery.data?.video_url) {
      pinned = {
        kind: "local",
        id: `local-${selectedPostQuery.data.id}`,
        post: selectedPostQuery.data,
      };
      localVideos = localVideos.filter((post) => post.id !== selectedPostQuery.data?.id);
    }
    const external = externalQuery.data?.videos || [];

    const pool: ReelItem[] = [
      ...localVideos.map((post) => ({ kind: "local" as const, id: `local-${post.id}`, post })),
      ...external.map((video, i) => ({ kind: "external" as const, id: `ext-${i}-${video.id}`, video })),
    ];

    // seeded shuffle (Fisher–Yates + mulberry32) — র‍্যান্ডম কিন্তু re-render-এ একই
    let s = seedRef.current;
    const rand = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = pool[i]!;
      pool[i] = pool[j]!;
      pool[j] = tmp;
    }

    return pinned ? [pinned, ...pool] : pool;
  }, [localQuery.data, externalQuery.data, selectedPostQuery.data]);


  return {
    items,
    isLoading: localQuery.isLoading && externalQuery.isLoading,
    isError: localQuery.isError && externalQuery.isError,
  };
}

function ReelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { postId: selectedPostId } = Route.useSearch();
  const { items, isLoading, isError } = useCombinedReels(selectedPostId);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedScrollHandledRef = useRef<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const updateActiveFromScroll = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const center = root.scrollTop + root.clientHeight / 2;
    let bestId: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    Array.from(root.children).forEach((child) => {
      const el = child as HTMLElement;
      const id = el.dataset.reelId;
      if (!id) return;
      const childCenter = el.offsetTop + el.offsetHeight / 2;
      const distance = Math.abs(childCenter - center);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestId = id;
      }
    });
    if (bestId) {
      setActiveId((current) => (current === bestId ? current : bestId));
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      markReelsSeen(user.id).catch(() => {});
    }
  }, [user?.id]);

  const selectedReelId = selectedPostId ? `local-${selectedPostId}` : null;

  useEffect(() => {
    if (
      selectedReelId &&
      items.some((item) => item.id === selectedReelId) &&
      selectedScrollHandledRef.current !== selectedReelId
    ) {
      selectedScrollHandledRef.current = selectedReelId;
      setActiveId(selectedReelId);
      containerRef.current?.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    if (!selectedReelId) {
      selectedScrollHandledRef.current = null;
    }
    if (items.length > 0) {
      setActiveId((current) =>
        current && items.some((item) => item.id === current) ? current : items[0].id,
      );
    }
  }, [items, selectedReelId]);

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((item) => item.id === activeId);
    return idx < 0 ? 0 : idx;
  }, [items, activeId]);

  // signed URL গুলো আগেই তৈরি করে রাখি — তাই স্ক্রল করলেই ভিডিও সাথে সাথে চলে
  useEffect(() => {
    const paths = items
      .slice(Math.max(0, activeIndex - 1), activeIndex + 4)
      .flatMap((item) =>
        item.kind === "local" ? [item.post.video_url, item.post.user?.avatar_url] : [],
      );
    prefetchFeedMedia(paths).catch(() => {});
  }, [items, activeIndex]);


  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("no user");
      const path = await uploadPostMedia(file, file.name, user.id);
      return createPost(user.id, "", undefined, path);
    },
    onSuccess: () => {
      toast.success("রিল আপলোড হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["reels-local-posts"] });
    },
    onError: () => toast.error("আপলোড ব্যর্থ হয়েছে"),
    onSettled: () => setUploading(false),
  });

  const handlePickFile = () => uploadInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      toast.error("শুধুমাত্র ভিডিও ফাইল আপলোড করুন");
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-2 bg-black text-white">
        <p className="text-sm font-bold">রিলস লোড করা যায়নি</p>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <input
        ref={uploadInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {items.length === 0 ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 px-8 text-center text-white">
          <p className="text-lg font-black">Short</p>
          <p className="text-sm font-bold">এখনো কোনো শর্ট ভিডিও নেই</p>
          <p className="text-[12px] font-semibold text-white/70">
            আপনিও শর্ট ভিডিও আপলোড করুন — সবাই দেখতে পাবে, লাভ ও কমেন্ট করতে পারবে।
          </p>
          {user && (
            <Button onClick={handlePickFile} className="gap-2">
              <Plus className="h-4 w-4" /> শর্ট ভিডিও আপলোড করুন
            </Button>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={updateActiveFromScroll}
          className="h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
          style={{
            scrollbarWidth: "none",
            touchAction: "pan-y",
            WebkitOverflowScrolling: "touch" as any,
          }}
        >
          {items.map((item, index) => (
            <ReelSlide
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              isNear={Math.abs(index - activeIndex) <= 1}
              muted={muted}
              setMuted={setMuted}
              onVisible={() => setActiveId(item.id)}
              onOpenComments={(postId) => setCommentPostId(postId)}
            />
          ))}
        </div>
      )}

      {/* Top bar — dashboard back + upload (everyone can upload, TikTok style) */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between safe-top px-3 pb-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="btn-press gradient-amber h-9 rounded-full px-3 flex items-center gap-1.5 ring-2 ring-white/80"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-[11.5px] font-black whitespace-nowrap">Dashboard</span>
        </button>
        <span className="pointer-events-none text-[15px] font-black tracking-tight text-white drop-shadow">
          Short
        </span>
        {user && (
          <button
            onClick={handlePickFile}
            disabled={uploading}
            className="btn-press h-9 px-3 rounded-full flex items-center gap-1.5 bg-rose text-white font-black text-[12px] shadow-lg"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span>শর্ট আপলোড</span>
          </button>
        )}
      </div>
      <CommentsSheet
        postId={commentPostId}
        onClose={() => setCommentPostId(null)}
        userId={user?.id}
      />
    </div>
  );
}

function ReelSlide({
  item,
  isActive,
  isNear,
  muted,
  setMuted,
  onVisible,
  onOpenComments,
}: {
  item: ReelItem;
  isActive: boolean;
  isNear: boolean;
  muted: boolean;
  setMuted: (v: boolean) => void;
  onVisible: () => void;
  onOpenComments: (postId: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            onVisible();
          }
        });
      },
      { threshold: [0.6] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return (
    <div
      ref={wrapperRef}
      data-reel-id={item.id}
      className="relative flex h-full w-full shrink-0 grow-0 basis-full snap-start snap-always items-center justify-center"
      style={{ scrollSnapStop: "always" }}
    >
      {item.kind === "local" ? (
        <LocalReel
          post={item.post}
          isActive={isActive}
          isNear={isNear}
          muted={muted}
          setMuted={setMuted}
          onOpenComments={onOpenComments}
        />
      ) : (
        <ExternalReel video={item.video} isActive={isActive} muted={muted} setMuted={setMuted} />
      )}
    </div>
  );
}

function ReelActionBar({
  likesCount,
  liked,
  onLike,
  commentsCount,
  onComment,
  onShare,
  disabled,
}: {
  likesCount: number;
  liked: boolean;
  onLike?: () => void;
  commentsCount?: number;
  onComment?: () => void;
  onShare: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5 text-white">
      <button
        onClick={onLike}
        disabled={!onLike || disabled}
        className="btn-press flex flex-col items-center gap-1 disabled:opacity-40"
      >
        <Heart className={liked ? "h-8 w-8 fill-red-500 text-red-500" : "h-8 w-8"} />
        <span className="text-xs font-bold">{likesCount}</span>
      </button>
      {onComment && (
        <button onClick={onComment} className="btn-press flex flex-col items-center gap-1">
          <MessageCircle className="h-8 w-8" />
          <span className="text-xs font-bold">{commentsCount ?? 0}</span>
        </button>
      )}
      <button onClick={onShare} className="btn-press flex flex-col items-center gap-1">
        <Share2 className="h-8 w-8" />
        <span className="text-xs font-bold">শেয়ার</span>
      </button>
    </div>
  );
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** শেয়ার — নেটিভ শেয়ার শিট, না থাকলে ক্লিপবোর্ড, তাও না হলে লিংক দেখানো */
async function shareUrl(url: string, title: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title, url, text: title });
      return;
    }
  } catch (err: any) {
    // ইউজার বাতিল করলে চুপচাপ থামি
    if (err?.name === "AbortError") return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success("লিংক কপি হয়েছে");
      return;
    }
  } catch {
    // fallthrough
  }
  if (legacyCopy(url)) {
    toast.success("লিংক কপি হয়েছে");
    return;
  }
  toast.info(url, { duration: 10000, description: "লিংকটি কপি করে শেয়ার করুন" });
}

/** ভিউ কাউন্ট সংক্ষেপে (1.2K, 3.4M) */
function formatViews(n: number): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}

function LocalReel({
  post,
  isActive,
  isNear = true,
  muted,
  setMuted,
  onOpenComments,
}: {
  post: Post;
  isActive: boolean;
  isNear?: boolean;
  muted: boolean;
  setMuted: (v: boolean) => void;
  onOpenComments: (postId: string) => void;
}) {
  const { user } = useAuth();
  const videoUrl = useFeedMedia(post.video_url);
  const posterUrl = useFeedMedia(post.image_url || undefined);
  const avatarUrl = useFeedMedia(post.user?.avatar_url || undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [viewsCount, setViewsCount] = useState(Number(post.views_count || 0));
  const viewCountedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);
  const [burst, setBurst] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<number | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, fallbackFullscreen, toggleFullscreen } = useMediaFullscreen(playerBoxRef);

  // আগে লাইক দেওয়া আছে কি না
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    getUserLikes(user.id, [post.id])
      .then((set) => {
        if (alive) setLiked(set.has(post.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user?.id, post.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isActive) {
      setPaused(false);
      el.muted = muted;
      el.play().catch(() => {
        // ব্রাউজার সাউন্ড সহ অটোপ্লে ব্লক করলে মিউট করে চালাই
        el.muted = true;
        setMuted(true);
        el.play().catch(() => {});
      });
      if (!viewCountedRef.current) {
        viewCountedRef.current = true;
        setViewsCount((c) => c + 1);
        incrementPostView(post.id)
          .then((v) => {
            if (v > 0) setViewsCount(v);
          })
          .catch(() => {});
      }
    } else {
      // শুধু current ভিডিওই বাজবে — বাকিগুলো পজ ও মিউট
      el.pause();
      el.muted = true;
      try {
        el.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }, [isActive, videoUrl, muted]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl || !isActive || mediaFailed) return;
    return attachBackgroundAudio(el, videoUrl, {
      title: post.content || "good-app reel",
      artist: post.user?.display_name || "good-app",
      artwork: post.image_url || undefined,
    });
  }, [isActive, mediaFailed, post.content, post.image_url, post.user?.display_name, videoUrl]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      return toggleLike(post.id, user.id);
    },
    onError: () => {
      setLiked((prev) => !prev);
      setLikesCount((c) => (liked ? c + 1 : Math.max(0, c - 1)));
    },
  });

  const applyLike = (forceLove: boolean) => {
    if (!user) {
      toast.error("লাইক দিতে লগইন করুন");
      return;
    }
    if (forceLove && liked) {
      // ডাবল ট্যাপে শুধু লাভ দেবে, তুলে নেবে না
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikesCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    if (next) {
      setBurst(true);
      window.setTimeout(() => setBurst(false), 700);
    }
    likeMutation.mutate();
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  const toggleMute = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    const nextMuted = !muted;
    setMuted(nextMuted);
    const el = videoRef.current;
    if (!el) return;
    el.muted = nextMuted;
    if (!nextMuted) {
      el.volume = 1;
      el.play().catch(() => {});
      setPaused(false);
    }
  };

  // এক ট্যাপ = সাউন্ড চালু / পজ-প্লে, ডাবল ট্যাপ = লাভ (TikTok স্টাইল)
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      lastTapRef.current = 0;
      if (singleTapTimer.current) {
        window.clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      applyLike(true);
      return;
    }
    lastTapRef.current = now;
    singleTapTimer.current = window.setTimeout(() => {
      singleTapTimer.current = null;
      if (muted) {
        // প্রথম ট্যাপে সাউন্ড চালু হবে
        toggleMute();
        return;
      }
      togglePlay();
    }, 280);
  };

  return (
    <div
      ref={playerBoxRef}
      className={
        fallbackFullscreen
          ? "fixed inset-0 z-[999] h-[100dvh] w-screen bg-black"
          : "relative h-full w-full"
      }
    >
      {videoUrl && !mediaFailed && isNear ? (
        <video
          key={mediaKey}
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain bg-black"
          loop
          playsInline
          muted={muted}
          poster={posterUrl}
          preload="auto"
          onLoadedData={() => setMediaFailed(false)}
          onError={() => setMediaFailed(true)}
        />
      ) : (
        <div className="relative flex h-full w-full items-center justify-center bg-black">
          {posterUrl && (
            <img
              src={posterUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-contain opacity-60"
            />
          )}
          {mediaFailed ? (
            <Button
              variant="secondary"
              onClick={() => {
                setMediaFailed(false);
                setMediaKey((value) => value + 1);
              }}
            >
              ভিডিও আবার চালান
            </Button>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          )}
        </div>
      )}

      {/* ট্যাপ লেয়ার — এক ট্যাপে পজ, ডাবল ট্যাপে লাভ */}
      <div className="absolute inset-0 z-10" onClick={handleTap} />

      {paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Play className="h-16 w-16 text-white/80 drop-shadow-lg" />
        </div>
      )}

      {muted && isActive && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/60 px-4 py-2 text-[12px] font-black text-white">
          ট্যাপ করে সাউন্ড চালু করুন
        </div>
      )}

      {burst && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 animate-ping fill-red-500 text-red-500 drop-shadow-2xl" />
        </div>
      )}

      <button
        type="button"
        aria-label={muted ? "সাউন্ড চালু করুন" : "সাউন্ড বন্ধ করুন"}
        onClick={toggleMute}
        className="absolute right-3 top-[calc(max(env(safe-area-inset-top),3rem)+3.75rem)] z-40 flex h-10 items-center justify-center gap-1.5 rounded-full bg-black/65 px-3 text-white shadow-lg backdrop-blur"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        <span className="text-[11px] font-black">{muted ? "Unmute" : "Mute"}</span>
      </button>

      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={isFullscreen ? "ফুল স্ক্রিন বন্ধ করুন" : "ফুল স্ক্রিন করুন"}
        onClick={(event) => {
          event.stopPropagation();
          void toggleFullscreen();
        }}
        className="absolute right-3 top-[calc(max(env(safe-area-inset-top),3rem)+6.75rem)] z-40 text-white hover:bg-black/60 hover:text-white"
      >
        {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
      </Button>

      <div className="absolute bottom-6 left-3 z-20 max-w-[75%] text-white">
        <div className="mb-2 flex items-center gap-2">
          <MessengerAvatar name={post.user?.display_name || "User"} src={avatarUrl} size="sm" />
          <span className="text-sm font-black">{post.user?.display_name || "User"}</span>
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold">
            <Eye className="h-3 w-3" />
            {formatViews(viewsCount)}
          </span>
        </div>
        {post.content && <p className="line-clamp-3 text-sm">{post.content}</p>}
      </div>

      <ReelActionBar
        likesCount={likesCount}
        liked={liked}
        onLike={() => applyLike(false)}
        commentsCount={post.comments_count}
        onComment={() => onOpenComments(post.id)}
        onShare={() => {
          shareUrl(`${window.location.origin}/watch/${post.id}`, post.content || "good-app reel");
          if (user) notifyPostShared(post.id, user.id).catch(() => {});
        }}
      />
    </div>
  );
}

function ExternalReel({
  video,
  isActive,
  muted,
  setMuted,
}: {
  video: ExternalReelVideo;
  isActive: boolean;
  muted: boolean;
  setMuted: (v: boolean) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [paused, setPaused] = useState(false);
  const isDirectVideo = /\.(mp4|webm|ogg)(\?|$)/i.test(video.video_url || "");
  const embedSrc = `${video.video_url}${video.video_url.includes("?") ? "&" : "?"}autoplay=${isActive ? 1 : 0}&mute=${muted ? 1 : 0}&playsinline=1&enablejsapi=1&controls=0&modestbranding=1&rel=0`;

  useEffect(() => {
    trackVideoPreference({ title: video.title, category: video.category });
  }, [video.id]);

  useEffect(() => {
    if (isDirectVideo) {
      const el = videoRef.current;
      if (!el) return;
      if (isActive) {
        setPaused(false);
        el.play().catch(() => {});
      } else {
        el.pause();
      }
      return;
    }
    // YouTube ইফ্রেম — postMessage দিয়ে প্লে/পজ
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const cmd = isActive ? "playVideo" : "pauseVideo";
    setPaused(false);
    win.postMessage(JSON.stringify({ event: "command", func: cmd, args: [] }), "*");
  }, [isActive, isDirectVideo]);

  useEffect(() => {
    if (isDirectVideo) {
      const el = videoRef.current;
      if (el) el.muted = muted;
      return;
    }
    if (!isActive) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func: muted ? "mute" : "unMute", args: [] }),
      "*",
    );
  }, [muted, isActive, isDirectVideo]);

  const togglePlay = () => {
    if (isDirectVideo) {
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) {
        el.play().catch(() => {});
        setPaused(false);
      } else {
        el.pause();
        setPaused(true);
      }
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const next = !paused;
    win.postMessage(
      JSON.stringify({ event: "command", func: next ? "pauseVideo" : "playVideo", args: [] }),
      "*",
    );
    setPaused(next);
  };

  const toggleMute = (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (isDirectVideo) {
      const el = videoRef.current;
      if (!el) return;
      el.muted = nextMuted;
      if (!nextMuted) {
        el.volume = 1;
        el.play().catch(() => {});
        setPaused(false);
      }
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      JSON.stringify({ event: "command", func: nextMuted ? "mute" : "unMute", args: [] }),
      "*",
    );
    if (!nextMuted) {
      win.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      setPaused(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      {isDirectVideo ? (
        <video
          ref={videoRef}
          src={video.video_url}
          poster={video.thumbnail_url || undefined}
          className="h-full w-full object-contain bg-black"
          loop
          playsInline
          muted={muted}
        />
      ) : isActive ? (
        // pointer-events-none — না হলে ইফ্রেম টাচ খেয়ে ফেলে, স্ক্রল/সোয়াইপ কাজ করে না
        <iframe
          ref={iframeRef}
          src={embedSrc}
          className="pointer-events-none h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          title={video.title}
        />
      ) : (
        <div className="h-full w-full bg-black">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="grid h-full w-full place-items-center bg-black text-white/60">
              <Play className="h-12 w-12" />
            </div>
          )}
        </div>
      )}

      {/* স্ক্রল ও ট্যাপ লেয়ার — মিউট থাকলে প্রথম ট্যাপে সাউন্ড চালু */}
      <div
        className="absolute inset-0 z-10"
        onClick={() => {
          if (muted) {
            toggleMute();
            return;
          }
          togglePlay();
        }}
      />

      {paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Play className="h-16 w-16 text-white/80 drop-shadow-lg" />
        </div>
      )}

      <button
        type="button"
        aria-label={muted ? "সাউন্ড চালু করুন" : "সাউন্ড বন্ধ করুন"}
        onClick={toggleMute}
        className="absolute right-3 top-[calc(max(env(safe-area-inset-top),3rem)+3.75rem)] z-40 flex h-10 items-center justify-center gap-1.5 rounded-full bg-black/65 px-3 text-white shadow-lg backdrop-blur"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        <span className="text-[11px] font-black">{muted ? "Unmute" : "Mute"}</span>
      </button>

      <div className="absolute bottom-6 left-3 z-20 max-w-[75%] text-white">
        <span className="mb-1 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase">
          {video.source}
        </span>
        <p className="line-clamp-2 text-sm font-bold">{video.title}</p>
        {video.creator && <p className="text-xs text-white/70">{video.creator}</p>}
      </div>

      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5 text-white">
        {video.watch_url && (
          <a
            href={video.watch_url}
            target="_blank"
            rel="noreferrer"
            className="btn-press flex flex-col items-center gap-1"
          >
            <ExternalLink className="h-7 w-7" />
            <span className="text-xs font-bold">সোর্স</span>
          </a>
        )}
        <button
          onClick={() => shareUrl(video.watch_url || video.video_url, video.title)}
          className="btn-press flex flex-col items-center gap-1"
        >
          <Share2 className="h-8 w-8" />
          <span className="text-xs font-bold">শেয়ার</span>
        </button>
      </div>
    </div>
  );
}

function CommentsSheet({
  postId,
  onClose,
  userId,
}: {
  postId: string | null;
  onClose: () => void;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["reel-comments", postId],
    queryFn: () => getPostComments(postId as string, userId),
    enabled: !!postId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!postId || !userId || !text.trim()) throw new Error("invalid");
      return addComment(postId, userId, text.trim());
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["reel-comments", postId] });
    },
    onError: () => toast.error("মন্তব্য যোগ করা যায়নি"),
  });

  return (
    <Sheet open={!!postId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[70dvh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>মন্তব্যসমূহ</SheetTitle>
        </SheetHeader>
        <div className="flex h-[calc(100%-90px)] flex-col gap-3 overflow-y-auto py-3">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (comments || []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">এখনো কোনো মন্তব্য নেই</p>
          ) : (
            (comments || []).map((c: PostComment) => (
              <div key={c.id} className="flex items-start gap-2">
                <MessengerAvatar name={c.user?.display_name || "User"} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black">{c.user?.display_name || "User"}</p>
                  <p className="text-sm text-foreground">{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>
        {userId ? (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="মন্তব্য লিখুন..."
              className="min-h-9 flex-1 resize-none"
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => addMutation.mutate()}
              disabled={!text.trim() || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
