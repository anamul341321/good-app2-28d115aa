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
} from "lucide-react";
import {
  getFeedPosts,
  getBangladeshExternalVideos,
  trackVideoPreference,
  markReelsSeen,
  toggleLike,
  getUserLikes,
  notifyPostShared,
  getPostComments,
  addComment,
  uploadPostMedia,
  createPost,
  type Post,
  type ExternalReelVideo,
  type PostComment,
  LONG_VIDEO_MARKER,
} from "@/lib/feed-api";

import { useFeedMedia } from "@/lib/feed-media";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reels")({
  component: ReelsPage,
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

function useCombinedReels() {
  const localQuery = useQuery({
    queryKey: ["reels-local-posts"],
    queryFn: () => getFeedPosts(30),
  });
  const externalQuery = useQuery({
    queryKey: ["reels-external"],
    queryFn: () => getBangladeshExternalVideos(1, 20, undefined, undefined, "short"),
  });

  const items = useMemo<ReelItem[]>(() => {
    const localVideos = (localQuery.data || []).filter(
      (p) => !!p.video_url && !(p.content || "").startsWith(LONG_VIDEO_MARKER),
    );
    const external = externalQuery.data?.videos || [];
    const merged: ReelItem[] = [];
    const maxLen = Math.max(localVideos.length, external.length);
    let li = 0;
    let ei = 0;
    for (let i = 0; i < maxLen; i++) {
      if (li < localVideos.length) {
        merged.push({ kind: "local", id: `local-${localVideos[li].id}`, post: localVideos[li] });
        li++;
      }
      if (ei < external.length) {
        merged.push({ kind: "external", id: `ext-${ei}-${external[ei].id}`, video: external[ei] });
        ei++;
      }
      // add an extra external item to boost density
      if (ei < external.length) {
        merged.push({ kind: "external", id: `ext-${ei}-${external[ei].id}`, video: external[ei] });
        ei++;
      }
    }

    return merged;
  }, [localQuery.data, externalQuery.data]);

  return {
    items,
    isLoading: localQuery.isLoading || externalQuery.isLoading,
    isError: localQuery.isError && externalQuery.isError,
  };
}

function ReelsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, isLoading, isError } = useCombinedReels();
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      markReelsSeen(user.id).catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    if (items.length > 0 && !activeId) {
      setActiveId(items[0].id);
    }
  }, [items, activeId]);

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
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white">
          <p className="text-sm font-bold">এখনো কোনো রিল নেই</p>
          {user && (
            <Button onClick={handlePickFile} className="gap-2">
              <Plus className="h-4 w-4" /> রিল আপলোড করুন
            </Button>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-contain scroll-smooth"
          style={{ scrollbarWidth: "none", touchAction: "pan-y" }}
        >

          {items.map((item) => (
            <ReelSlide
              key={item.id}
              item={item}
              isActive={activeId === item.id}
              muted={muted}
              setMuted={setMuted}
              onVisible={() => setActiveId(item.id)}
              onOpenComments={(postId) => setCommentPostId(postId)}
            />
          ))}
        </div>
      )}

      {/* Top bar — dashboard back + upload (everyone can upload, TikTok style) */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="btn-press h-9 pl-1.5 pr-3 rounded-full flex items-center gap-1 ring-2 ring-white/80 shadow-[0_4px_14px_rgba(255,193,7,0.55)]"
          style={{ background: "linear-gradient(135deg,#ffd600,#ff9100,#f4511e)" }}
        >
          <ArrowLeft className="h-5 w-5 text-[#1a1a1a]" />
          <span className="text-[11.5px] font-black text-[#1a1a1a] whitespace-nowrap">ড্যাশবোর্ড</span>
        </button>
        {user && (
          <button
            onClick={handlePickFile}
            disabled={uploading}
            className="btn-press h-9 px-3 rounded-full flex items-center gap-1.5 text-white font-black text-[12px] shadow-lg"
            style={{ background: "linear-gradient(135deg,#e11d48,#f97316)" }}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>রিল আপলোড</span>
          </button>
        )}
      </div>

      {user && (
        <button
          onClick={handlePickFile}
          disabled={uploading}
          className="btn-press fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
        </button>
      )}

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
  muted,
  setMuted,
  onVisible,
  onOpenComments,
}: {
  item: ReelItem;
  isActive: boolean;
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
    <div ref={wrapperRef} className="relative flex h-full w-full snap-start items-center justify-center">
      {item.kind === "local" ? (
        <LocalReel post={item.post} isActive={isActive} muted={muted} setMuted={setMuted} onOpenComments={onOpenComments} />
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


function LocalReel({
  post,
  isActive,
  muted,
  setMuted,
  onOpenComments,
}: {
  post: Post;
  isActive: boolean;
  muted: boolean;
  setMuted: (v: boolean) => void;
  onOpenComments: (postId: string) => void;
}) {
  const { user } = useAuth();
  const videoUrl = useFeedMedia(post.video_url);
  const avatarUrl = useFeedMedia(post.user?.avatar_url || undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<number | null>(null);

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
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isActive, videoUrl]);

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

  // এক ট্যাপ = পজ/প্লে, ডাবল ট্যাপ = লাভ (TikTok স্টাইল)
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
      togglePlay();
    }, 280);
  };

  return (
    <div className="relative h-full w-full">
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          className="h-full w-full object-contain bg-black"
          loop
          playsInline
          muted={muted}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {/* ট্যাপ লেয়ার — এক ট্যাপে পজ, ডাবল ট্যাপে লাভ */}
      <div className="absolute inset-0 z-10" onClick={handleTap} />

      {paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Play className="h-16 w-16 text-white/80 drop-shadow-lg" />
        </div>
      )}

      {burst && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <Heart className="h-24 w-24 animate-ping fill-red-500 text-red-500 drop-shadow-2xl" />
        </div>
      )}

      <button
        onClick={() => setMuted(!muted)}
        className="absolute right-3 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div className="absolute bottom-6 left-3 z-20 max-w-[75%] text-white">
        <div className="mb-2 flex items-center gap-2">
          <MessengerAvatar name={post.user?.display_name || "User"} src={avatarUrl} size="sm" />
          <span className="text-sm font-black">{post.user?.display_name || "User"}</span>
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
      ) : (
        // pointer-events-none — না হলে ইফ্রেম টাচ খেয়ে ফেলে, স্ক্রল/সোয়াইপ কাজ করে না
        <iframe
          ref={iframeRef}
          src={embedSrc}
          className="pointer-events-none h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          title={video.title}
        />
      )}

      {/* স্ক্রল ও ট্যাপ লেয়ার */}
      <div className="absolute inset-0 z-10" onClick={togglePlay} />

      {paused && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Play className="h-16 w-16 text-white/80 drop-shadow-lg" />
        </div>
      )}

      <button
        onClick={() => setMuted(!muted)}
        className="absolute right-3 top-16 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white"
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
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
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
