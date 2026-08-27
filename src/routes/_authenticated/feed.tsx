import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getFeedPosts, createPost, notifyPostShared, toggleReaction, getUserReactions, incrementPostView,
  getPostComments, addComment, uploadPostMedia, getActiveStories,
  createStory, uploadStoryMedia,
  deletePost, deleteStory, deleteComment, toggleCommentLike, updatePost,
  getUnreadNotificationCount, getNotifications, markNotificationsRead, getPostReactors,
  REACTION_EMOJIS, type Post, type PostComment, type Story,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";
import { listFriends, sendFriendRequest, respondFriendRequest, searchPeopleFull } from "@/lib/friends.functions";
import { getUnreadMessageCount } from "@/lib/chat.functions";
import {
  Heart, MessageCircle, Send, Image, X, Home, Users, Bell,
  Plus, User, Search, Phone, Share2, Loader2, MoreHorizontal, Trash2, Globe, UserPlus, ThumbsUp, Video, Film, Pencil, Lock,
  Eye, Play, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import StoryEditor from "@/components/social/StoryEditor";
import StoryViewer from "@/components/social/StoryViewer";
import { PeopleYouMayKnow } from "@/components/social/PeopleYouMayKnow";
import { getPublicProfile } from "@/lib/social-users.functions";
import { playUiSound } from "@/lib/ui-sounds";
import VerifiedBadge from "@/components/VerifiedBadge";

export const Route = createFileRoute("/_authenticated/feed")({
  component: FeedPage,
  head: () => ({
    meta: [
      { title: "নিউজ ফিড — Good-App" },
      { name: "description", content: "বন্ধুদের পোস্ট, স্টোরি ও আপডেট দেখুন — Good-App নিউজ ফিড।" },
      { property: "og:title", content: "নিউজ ফিড — Good-App" },
      { property: "og:description", content: "বন্ধুদের পোস্ট, স্টোরি ও আপডেট দেখুন — Good-App নিউজ ফিড।" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function Avatar({ path, className, fallback }: { path?: string | null; className?: string; fallback: string }) {
  const url = useFeedMedia(path);
  if (path && url) return <img src={url} className={className} alt="" />;
  return <span className="text-blue-600 dark:text-primary font-bold text-sm">{fallback}</span>;
}

function FeedImg({ path, className, onClick }: { path: string; className?: string; onClick?: (e: React.MouseEvent<HTMLImageElement>) => void }) {
  const url = useFeedMedia(path);
  return (
    <img
      src={url}
      alt=""
      loading="eager"
      decoding="async"
      className={`${className ?? ""} bg-gray-100 dark:bg-secondary`}
      onClick={onClick}
    />
  );
}

function CommentImg({ path, className }: { path: string; className?: string }) {
  const directUrl = /^(blob:|data:|https?:\/\/)/i.test(path) ? path : undefined;
  const resolvedUrl = useFeedMedia(directUrl ? undefined : path);
  return <img src={directUrl || resolvedUrl} alt="" className={className} />;
}

function FeedVideo({ path, className, videoRef }: { path: string; className?: string; videoRef?: (el: HTMLVideoElement | null) => void }) {
  const url = useFeedMedia(path);
  return <video ref={videoRef} src={url} muted playsInline preload="metadata" className={className} />;
}

/**
 * ফিডে ভিডিও — স্ক্রল করে সামনে আসলেই নিজে থেকে চলে (mute),
 * নিচে টেনে দেখার (seek) বার আছে এবং "Short এ দেখুন" চাপলে reels-এ যায়।
 */
function FeedVideoPlayer({
  path,
  postId,
  onOpenReels,
  videoRef,
}: {
  path: string;
  postId: string;
  onOpenReels: () => void;
  videoRef?: (el: HTMLVideoElement | null) => void;
}) {
  const url = useFeedMedia(path);
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const attach = useCallback(
    (el: HTMLVideoElement | null) => {
      ref.current = el;
      videoRef?.(el);
    },
    [videoRef],
  );

  // দেখা গেলেই অটো প্লে, চোখের বাইরে গেলে থামে
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          el.muted = muted;
          void el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        } else {
          el.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url, muted]);

  const seek = (clientX: number, bar: HTMLDivElement) => {
    const el = ref.current;
    if (!el || !el.duration || !Number.isFinite(el.duration)) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * el.duration;
    setProgress(ratio * 100);
  };

  return (
    <div className="relative w-full bg-black" data-post-video={postId}>
      <video
        ref={attach}
        src={url}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="w-full max-h-[500px] object-contain"
        onTimeUpdate={(e) => {
          const v = e.currentTarget;
          if (v.duration) setProgress((v.currentTime / v.duration) * 100);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) {
            void el.play().then(() => setPlaying(true)).catch(() => {});
          } else {
            el.pause();
            setPlaying(false);
          }
        }}
      />

      {!playing && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-card/85 text-primary shadow-xl backdrop-blur">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </span>
      )}

      {/* টেনে দেখার বার */}
      <div
        className="absolute bottom-0 left-0 right-0 px-3 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="group h-6 flex items-center cursor-pointer"
          onPointerDown={(e) => {
            e.stopPropagation();
            const bar = e.currentTarget;
            bar.setPointerCapture(e.pointerId);
            seek(e.clientX, bar);
          }}
          onPointerMove={(e) => {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) seek(e.clientX, e.currentTarget);
          }}
        >
          <div className="h-1 w-full rounded-full bg-white/30">
            <div className="relative h-1 rounded-full bg-primary" style={{ width: `${progress}%` }}>
              <span className="absolute -right-1.5 -top-1 h-3 w-3 rounded-full bg-primary shadow" />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMuted((v) => {
            const next = !v;
            if (ref.current) ref.current.muted = next;
            return next;
          });
        }}
        aria-label={muted ? "সাউন্ড চালু" : "সাউন্ড বন্ধ"}
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/55 text-white backdrop-blur"
      >
        <span className="text-sm font-black">{muted ? "🔇" : "🔊"}</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenReels();
        }}
        className="absolute bottom-8 left-3 rounded-full bg-primary px-3 py-1.5 text-[12px] font-black text-primary-foreground shadow-lg"
      >
        Short এ দেখুন
      </button>
      {duration > 0 && (
        <span className="absolute bottom-8 right-3 rounded-full bg-black/60 px-2 py-1 text-[10px] font-black text-white">
          {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}
        </span>
      )}
    </div>
  );
}


const NameWithBadge = ({ name, isVerified, className = "" }: { name: string; isVerified?: boolean; className?: string }) => (
  <span className={`inline-flex items-center gap-1 ${className}`}>
    <span>{name}</span>
    {isVerified && <VerifiedBadge className="h-3.5 w-3.5" />}
  </span>
);

/** সংখ্যা সংক্ষেপে দেখানো (1.2K / 3.4M) */
function formatCount(n: number): string {
  const v = Number(n || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(v);
}

function FeedPage() {
  const { user, loading: isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImageFiles, setPostImageFiles] = useState<File[]>([]);
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);
  const [postVideoFile, setPostVideoFile] = useState<File | null>(null);
  const [postVideoPreview, setPostVideoPreview] = useState<string | null>(null);
  const [userReactions, setUserReactions] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [reactorsPostId, setReactorsPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editText, setEditText] = useState("");
  const [editVisibility, setEditVisibility] = useState<"public" | "private">("public");
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [doubleTapTimer, setDoubleTapTimer] = useState<Record<string, number>>({});
  const [showLoveAnimation, setShowLoveAnimation] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"home" | "notif">("home");
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
  const [storyEditorFile, setStoryEditorFile] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const POSTS_PER_PAGE = 20;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);
  const commentImageInputRef = useRef<HTMLInputElement>(null);
  const longPressFiredRef = useRef(false);
  const tapTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedVideoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/" });
  }, [user, isLoading, navigate]);

  const {
    data: postPages,
    isLoading: postsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed-posts", searchQuery, user?.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      getFeedPosts(POSTS_PER_PAGE, searchQuery, (pageParam as number) * POSTS_PER_PAGE, user?.id),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length > 0 ? allPages.length : undefined,
    enabled: !!user,
    staleTime: 60000,
  });

  const posts = useMemo(() => {
    const flat = (postPages?.pages ?? []).flat() as Post[];
    const seen = new Set<string>();
    return flat.filter((p) => {
      if (seen.has(p.id) || hiddenPosts.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [postPages, hiddenPosts]);

  const hasMore = !!hasNextPage;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) void fetchNextPage();
    }, { threshold: 0.1, rootMargin: "600px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);


  const { data: stories = [] } = useQuery({
    queryKey: ["stories"],
    queryFn: getActiveStories,
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["unread-msgs"],
    queryFn: () => getUnreadMessageCount(),
    enabled: !!user,
    refetchInterval: 6000,
    staleTime: 5000,
  });
  const unreadCount = unreadData?.unread || 0;

  const { data: friendsData } = useQuery({
    queryKey: ["friends-summary"],
    queryFn: () => listFriends(),
    enabled: !!user,
    staleTime: 30000,
  });
  const friendRequestCount = friendsData?.incoming.length || 0;

  const { data: notifCount = 0 } = useQuery({
    queryKey: ["notif-count", user?.id],
    queryFn: () => getUnreadNotificationCount(user!.id),
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: notificationsList = [] } = useQuery({
    queryKey: ["notifications-list", user?.id],
    queryFn: () => getNotifications(user!.id),
    enabled: !!user && activeTab === "notif",
  });

  const { data: searchResults = [], isFetching: searchPeopleLoading } = useQuery({
    queryKey: ["feed-user-search", searchQuery],
    queryFn: async () => (await searchPeopleFull({ data: { query: searchQuery.trim() } })).people,
    enabled: searchQuery.trim().length >= 1,
    staleTime: 30_000,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["social-profile", user?.id],
    queryFn: async () => (await getPublicProfile({ data: { userId: user?.id ?? "" } })) as { avatar_url: string | null; display_name: string | null } | null,
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const mentionMatch = commentText.match(/(?:^|\s)@([^@\s]{1,30})$/);
  const mentionQuery = mentionMatch?.[1] ?? "";
  const { data: mentionResults = [] } = useQuery({
    queryKey: ["comment-mention-search", mentionQuery],
    queryFn: async () => (await searchPeopleFull({ data: { query: mentionQuery } })).people,
    enabled: !!commentingPostId && mentionQuery.length >= 1,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (user && posts.length > 0) {
      const visibleIds = posts.map((p) => p.id);
      getUserReactions(user.id, visibleIds).then(setUserReactions);
    }
  }, [user, posts.length]);

  useEffect(() => {
    const channel = supabase.channel("feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => {
        queryClient.invalidateQueries({ queryKey: ["stories"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "feed_notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notif-count"] });
        queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_links" }, () => {
        queryClient.invalidateQueries({ queryKey: ["friends-summary"] });
        queryClient.invalidateQueries({ queryKey: ["suggested-people"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, user?.id]);

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Login required");
      let imageUrl: string | undefined;
      let videoUrl: string | undefined;
      if (postImageFiles.length > 0) {
        const urls: string[] = [];
        for (const file of postImageFiles) urls.push(await uploadPostMedia(file, file.name, user.id));
        imageUrl = urls.join(",");
      }
      if (postVideoFile) videoUrl = await uploadPostMedia(postVideoFile, postVideoFile.name, user.id);
      return createPost(user.id, postContent, imageUrl, videoUrl);
    },
    onSuccess: () => {
      setPostContent(""); setPostImageFiles([]); setPostImagePreviews([]);
      setPostVideoFile(null); setPostVideoPreview(null); setShowCreatePost(false);
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("পোস্ট প্রকাশিত! 🎉");
    },
    onError: (e: Error) => toast.error(e.message || "পোস্ট করা যায়নি"),
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => { if (!user) throw new Error("Login"); await deletePost(postId, user.id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("পোস্ট মুছে ফেলা হয়েছে 🗑️");
      setShowPostMenu(null);
    },
  });

  const editPostMutation = useMutation({
    mutationFn: async ({ postId, content, visibility }: { postId: string; content: string; visibility: "public" | "private" }) => {
      if (!user) throw new Error("Login");
      await updatePost(postId, user.id, { content, visibility });
    },
    onSuccess: () => {
      setEditingPost(null);
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("পোস্ট আপডেট হয়েছে ✅");
    },
    onError: () => toast.error("পোস্ট এডিট করা যায়নি"),
  });

  const visibilityMutation = useMutation({
    mutationFn: async ({ postId, visibility }: { postId: string; visibility: "public" | "private" }) => {
      if (!user) throw new Error("Login");
      await updatePost(postId, user.id, { visibility });
      return { postId, visibility };
    },
    onSuccess: ({ postId, visibility }) => {
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      setShowPostMenu(null);
      toast.success(visibility === "private" ? "পোস্ট এখন শুধু আপনি দেখবেন 🔒" : "পোস্ট এখন সবাই দেখবে 🌐");
    },
    onError: () => toast.error("প্রাইভেসি বদলানো যায়নি"),
  });

  const deleteStoryMutation = useMutation({
    mutationFn: async (storyId: string) => { if (!user) throw new Error("Login"); await deleteStory(storyId, user.id); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      setViewingStory(null);
      toast.success("স্টোরি মুছে ফেলা হয়েছে");
    },
  });

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      if (!user) throw new Error("Login");
      return { postId, ...(await toggleReaction(postId, user.id, type)) };
    },
    onMutate: async ({ postId, type }) => {
      const prev = userReactions[postId];
      const isSameReaction = prev === type;
      if (!isSameReaction) playUiSound("like");
      setUserReactions((r) => {
        const next = { ...r };
        if (isSameReaction) delete next[postId];
        else next[postId] = type;
        return next;
      });
      setShowReactionPicker(null);
    },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ["feed-posts", searchQuery] }); },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ text, imageFile }: { text: string; imageFile?: File | null }) => {
      if (!user || !commentingPostId) throw new Error("Error");
      let imageUrl: string | undefined;
      if (imageFile) imageUrl = await uploadPostMedia(imageFile, imageFile.name, user.id);
      return addComment(commentingPostId, user.id, text, replyingTo?.id, imageUrl);
    },
    onMutate: async ({ text }) => {
      if (!user || !commentingPostId) return;
      const tc: PostComment = {
        id: `temp-${Date.now()}`,
        post_id: commentingPostId,
        user_id: user.id,
        content: text,
        image_url: commentImagePreview,
        created_at: new Date().toISOString(),
        parent_comment_id: replyingTo?.id || null,
        user: { display_name: (user.user_metadata as any)?.display_name || "You", avatar_url: null },
      };
      if (replyingTo) {
        setComments((prev) => prev.map((c) => c.id === replyingTo.id ? { ...c, replies: [...(c.replies || []), tc] } : c));
      } else {
        setComments((prev) => [...prev, tc]);
      }
      setCommentText("");
      setCommentImageFile(null);
      setCommentImagePreview(null);
      setReplyingTo(null);
    },
    onSuccess: () => {
      if (commentingPostId) loadComments(commentingPostId);
      queryClient.invalidateQueries({ queryKey: ["feed-posts", searchQuery] });
    },
    onError: () => { if (commentingPostId) loadComments(commentingPostId); },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => { if (!user) throw new Error("Login"); await deleteComment(commentId, user.id); },
    onSuccess: () => { if (commentingPostId) loadComments(commentingPostId); queryClient.invalidateQueries({ queryKey: ["feed-posts", searchQuery] }); },
  });

  const commentLikeMutation = useMutation({
    mutationFn: async (commentId: string) => { if (!user) throw new Error("Login"); return toggleCommentLike(commentId, user.id); },
    onMutate: async (commentId) => {
      setComments((prev) => prev.map((c) => {
        if (c.id === commentId) return { ...c, liked_by_me: !c.liked_by_me, likes_count: (c.likes_count || 0) + (c.liked_by_me ? -1 : 1) };
        if (c.replies) return { ...c, replies: c.replies.map((r) => r.id === commentId ? { ...r, liked_by_me: !r.liked_by_me, likes_count: (r.likes_count || 0) + (r.liked_by_me ? -1 : 1) } : r) };
        return c;
      }));
    },
  });

  const storyMutation = useMutation({
    mutationFn: async ({ files, musicName }: { files: File[]; musicName?: string }) => {
      if (!user) throw new Error("Login");
      for (const file of files) {
        const url = await uploadStoryMedia(file, user.id);
        await createStory(user.id, url, musicName);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stories"] });
      toast.success("স্টোরি যোগ হয়েছে! ✨");
    },
  });

  const friendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => { await sendFriendRequest({ data: { userId: targetUserId } }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggested-people"] });
      queryClient.invalidateQueries({ queryKey: ["friends-summary"] });
      queryClient.invalidateQueries({ queryKey: ["feed-user-search"] });
      toast.success("ফ্রেন্ড রিকুয়েস্ট পাঠানো হয়েছে! ✅");
    },
    onError: () => toast.error("রিকুয়েস্ট পাঠানো যায়নি"),
  });

  const respondRequestMutation = useMutation({
    mutationFn: async ({ linkId, accept }: { linkId: string; accept: boolean }) => respondFriendRequest({ data: { linkId, accept } }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["friends-summary"] });
      queryClient.invalidateQueries({ queryKey: ["feed-user-search"] });
      queryClient.invalidateQueries({ queryKey: ["suggested-people"] });
      if (vars.accept) toast.success("ফ্রেন্ড রিকুয়েস্ট গ্রহণ করা হয়েছে! 🎉");
    },
  });

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    setComments(await getPostComments(postId, user?.id));
    setLoadingComments(false);
  };

  const openComments = (postId: string) => {
    if (commentingPostId === postId) { setCommentingPostId(null); setReplyingTo(null); return; }
    setCommentingPostId(postId);
    setReplyingTo(null);
    setCommentText("");
    setCommentImageFile(null);
    setCommentImagePreview(null);
    loadComments(postId);
  };

  const commentingPost = useMemo(() => posts.find((p) => p.id === commentingPostId) || null, [posts, commentingPostId]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setPostImageFiles((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => setPostImagePreviews((prev) => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      if (video.duration > 120) {
        toast.error("নিউজ ফিডে সর্বোচ্চ ২ মিনিটের ভিডিও আপলোড করা যাবে");
        return;
      }
      setPostVideoFile(file);
      setPostVideoPreview(video.src);
    };
  };

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (commentImagePreview?.startsWith("blob:")) URL.revokeObjectURL(commentImagePreview);
    setCommentImageFile(file);
    setCommentImagePreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearCommentImage = () => {
    if (commentImagePreview?.startsWith("blob:")) URL.revokeObjectURL(commentImagePreview);
    setCommentImageFile(null);
    setCommentImagePreview(null);
  };

  const handleStorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      setStoryEditorFile(files[0]);
    } else {
      const fileArr = Array.from(files).slice(0, 5);
      storyMutation.mutate({ files: fileArr });
    }
    if (e.target) e.target.value = "";
  };

  const handleStoryPublish = (editedFile: File, musicName?: string) => {
    storyMutation.mutate({ files: [editedFile], musicName });
    setStoryEditorFile(null);
  };

  const countedViewsRef = useRef<Set<string>>(new Set());

  const handleFeedVideoPlay = (activePostId: string) => {
    Object.entries(feedVideoRefs.current).forEach(([postId, videoEl]) => {
      if (!videoEl || postId === activePostId) return;
      if (!videoEl.paused) videoEl.pause();
      videoEl.muted = true;
    });
    const activeVideo = feedVideoRefs.current[activePostId];
    if (activeVideo) activeVideo.muted = false;
    if (!countedViewsRef.current.has(activePostId)) {
      countedViewsRef.current.add(activePostId);
      incrementPostView(activePostId).catch(() => {});
    }
  };

  const handleImageTap = (postId: string, imageUrl: string) => {
    const now = Date.now();
    const lastTap = doubleTapTimer[postId] || 0;
    if (now - lastTap < 300) {
      clearTimeout(tapTimerRef.current[postId]);
      if (!userReactions[postId]) reactionMutation.mutate({ postId, type: "love" });
      setShowLoveAnimation(postId);
      setTimeout(() => setShowLoveAnimation(null), 1000);
      setDoubleTapTimer((prev) => ({ ...prev, [postId]: 0 }));
    } else {
      setDoubleTapTimer((prev) => ({ ...prev, [postId]: now }));
      tapTimerRef.current[postId] = setTimeout(() => setViewingImage(imageUrl), 320);
    }
  };

  const startChatWith = (targetUserId: string) => {
    if (!user || targetUserId === user.id) return;
    navigate({ to: "/chat/$peerId", params: { peerId: targetUserId } });
  };

  const insertMention = (person: any) => {
    const label = person.display_name || (person.uid_seq ? String(person.uid_seq) : "User");
    setCommentText((prev) => prev.replace(/(^|\s)@([^@\s]*)$/, `$1@${label} `));
  };

  const sharePost = async (post: Post) => {
    if (!user) return;
    try {
      const shareContent = post.content ? `শেয়ার করেছে: "${post.content}"` : "একটি পোস্ট শেয়ার করেছে";
      await createPost(user.id, shareContent, post.image_url || undefined, post.video_url || undefined);
      void notifyPostShared(post.id, user.id);
      queryClient.invalidateQueries({ queryKey: ["feed-posts"] });
      toast.success("আপনার প্রোফাইলে শেয়ার করা হয়েছে! ✅");
    } catch {
      toast.error("শেয়ার করা যায়নি");
    }
  };

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "এইমাত্র";
    if (mins < 60) return `${mins} মি.`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} ঘ.`;
    return `${Math.floor(hrs / 24)} দি.`;
  };

  const storyGroups = stories.reduce<Record<string, Story[]>>((acc, s) => {
    (acc[s.user_id] = acc[s.user_id] || []).push(s);
    return acc;
  }, {});
  const sortedStoryEntries = Object.entries(storyGroups).sort(([aId, aStories], [bId, bStories]) => {
    if (aId === user?.id) return -1;
    if (bId === user?.id) return 1;
    const aTime = new Date(aStories[0].created_at || 0).getTime();
    const bTime = new Date(bStories[0].created_at || 0).getTime();
    return bTime - aTime;
  });

  const renderMentionText = (text: string) => {
    const parts = text.split(/(@[\w\s]+?)(?=\s@|\s*$|[.,!?])/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1).trim();
        return <span key={i} className="text-blue-600 dark:text-primary font-bold">@{name}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (isLoading || !user) return null;

  const renderPosts = () => {
    const elements: React.ReactNode[] = [];
    posts.forEach((post, index) => {
      const myReaction = userReactions[post.id];
      elements.push(
        <div key={post.id} className="bg-white dark:bg-card">
          <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
            <Link to="/user/$userId" params={{ userId: post.user_id }}
              className="w-10 h-10 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              <Avatar path={post.user?.avatar_url} className="w-full h-full object-cover" fallback={post.user?.display_name?.[0]?.toUpperCase() || "?"} />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to="/user/$userId" params={{ userId: post.user_id }} className="font-bold text-[15px] text-gray-900 dark:text-foreground hover:underline block">
                <NameWithBadge name={post.user?.display_name || "User"} isVerified={post.user?.is_verified_badge} />
              </Link>
              <div className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-muted-foreground">
                <span>{timeAgo(post.created_at)}</span>
                <span>·</span>
                {(post as any).visibility === "private"
                  ? <Lock className="w-3 h-3" />
                  : <Globe className="w-3 h-3" />}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <div className="relative">
                <button onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                  className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-secondary transition-colors text-gray-500 dark:text-muted-foreground">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showPostMenu === post.id && (
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-xl z-50 overflow-hidden min-w-[180px] animate-in fade-in zoom-in-95 duration-150">
                    {post.user_id === user.id ? (
                      <>
                        <button onClick={() => { setEditingPost(post); setEditText(post.content || ""); setEditVisibility(((post as any).visibility || "public") as "public" | "private"); setShowPostMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary text-sm font-medium transition-colors">
                          <Pencil className="w-4 h-4" /> পোস্ট এডিট করুন
                        </button>
                        <button
                          onClick={() => visibilityMutation.mutate({
                            postId: post.id,
                            visibility: (post as any).visibility === "private" ? "public" : "private",
                          })}
                          disabled={visibilityMutation.isPending}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary text-sm font-medium transition-colors">
                          {(post as any).visibility === "private" ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          {(post as any).visibility === "private" ? "সবার জন্য (Public) করুন" : "প্রাইভেট করুন (শুধু আমি)"}
                        </button>
                        <button onClick={() => deletePostMutation.mutate(post.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-destructive/10 text-sm font-medium transition-colors">
                          <Trash2 className="w-4 h-4" /> পোস্ট মুছুন
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { navigate({ to: "/user/$userId", params: { userId: post.user_id } }); setShowPostMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary text-sm transition-colors">
                          <User className="w-4 h-4" /> প্রোফাইল দেখুন
                        </button>
                        <button onClick={() => { startChatWith(post.user_id); setShowPostMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary text-sm transition-colors">
                          <MessageCircle className="w-4 h-4" /> মেসেজ পাঠান
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setHiddenPosts((prev) => new Set(prev).add(post.id))}
                className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-secondary transition-colors text-gray-500 dark:text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {post.content && (
            <p className="text-[16px] text-gray-900 dark:text-foreground leading-relaxed px-3 pb-2 whitespace-pre-wrap">{renderMentionText(post.content)}</p>
          )}

          {post.image_url && (() => {
            const imageUrls = post.image_url!.split(",").map((u) => u.trim()).filter(Boolean);
            return (
              <div className={imageUrls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                {imageUrls.map((url, imgIdx) => (
                  <div key={imgIdx} className="relative cursor-pointer" onClick={() => handleImageTap(post.id, url)}>
                    <FeedImg path={url} className={`w-full object-cover ${imageUrls.length === 1 ? "max-h-[500px]" : "max-h-[250px]"}`} />
                    {showLoveAnimation === post.id && imgIdx === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-in zoom-in-50 fade-out duration-700">
                        <span className="text-7xl">❤️</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {post.video_url && (
            <FeedVideoPlayer
              path={post.video_url}
              postId={post.id}
              videoRef={(el) => { feedVideoRefs.current[post.id] = el; }}
              onOpenReels={() => navigate({ to: "/reels", search: { postId: post.id } as any })}
            />
          )}

          <div className="px-3 py-2 flex items-center justify-between text-[13px] text-gray-500 dark:text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="flex items-center -space-x-0.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-[11px]">👍</span>
                {myReaction && myReaction !== "like" && (
                  <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[11px]">{REACTION_EMOJIS[myReaction]}</span>
                )}
              </span>
              <button onClick={() => setReactorsPostId(post.id)} className="text-[13px] hover:underline">
                {post.likes_count || 0}
              </button>
            </div>
            <div className="flex items-center gap-3">
              {post.video_url && (
                <span className="flex items-center gap-1 text-[13px]">
                  <Eye className="w-4 h-4" />
                  {formatCount(post.views_count || 0)} ভিউ
                </span>
              )}
              {post.comments_count > 0 ? (
                <button onClick={() => openComments(post.id)} className="hover:underline text-[13px]">{post.comments_count} মন্তব্য</button>
              ) : (
                <span className="text-[13px]">0 মন্তব্য</span>
              )}
            </div>
          </div>

          <div className="px-1 py-1 border-t border-gray-200 dark:border-border/20 grid grid-cols-3 relative select-none" style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}>
            <div className="relative">
              <button
                onClick={() => {
                  if (longPressFiredRef.current) { longPressFiredRef.current = false; return; }
                  reactionMutation.mutate({ postId: post.id, type: myReaction || "like" });
                }}
                onContextMenu={(e) => { e.preventDefault(); longPressFiredRef.current = true; setShowReactionPicker(post.id); }}
                onTouchStart={() => {
                  longPressFiredRef.current = false;
                  const timer = setTimeout(() => {
                    longPressFiredRef.current = true;
                    setShowReactionPicker(post.id);
                    if (navigator.vibrate) navigator.vibrate(15);
                  }, 400);
                  const cleanup = () => {
                    clearTimeout(timer);
                    document.removeEventListener("touchend", cleanup);
                    document.removeEventListener("touchmove", cleanup);
                    document.removeEventListener("touchcancel", cleanup);
                  };
                  document.addEventListener("touchend", cleanup);
                  document.addEventListener("touchmove", cleanup);
                  document.addEventListener("touchcancel", cleanup);
                }}
                style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                className={`flex items-center justify-center gap-2 py-2.5 w-full rounded-lg transition-colors select-none ${myReaction ? "text-blue-600 dark:text-primary" : "text-gray-600 dark:text-muted-foreground"}`}>
                {myReaction ? <span className="text-xl">{REACTION_EMOJIS[myReaction]}</span> : <ThumbsUp className="w-5 h-5" />}
                <span className="text-[13px] font-semibold select-none">{myReaction ? (myReaction === "like" ? "পছন্দ" : REACTION_EMOJIS[myReaction]) : "পছন্দ"}</span>
              </button>


              {showReactionPicker === post.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(null)} />
                  <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full shadow-xl px-2 py-1.5 flex gap-0.5 z-50 animate-in fade-in zoom-in-90 duration-150">
                    {Object.entries(REACTION_EMOJIS).map(([type, emoji], i) => (
                      <button
                        key={type}
                        onClick={() => { playUiSound("like"); reactionMutation.mutate({ postId: post.id, type }); }}
                        style={{ animationDelay: `${i * 45}ms` }}
                        className={`reaction-pop text-3xl p-1 rounded-full transition-transform duration-150 hover:scale-[1.45] active:scale-125 ${myReaction === type ? "bg-blue-50 dark:bg-primary/20" : ""}`}
                        title={type}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => openComments(post.id)}
              className="flex items-center justify-center gap-2 py-2.5 text-gray-600 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/50 rounded-lg transition-colors select-none">
              <MessageCircle className="w-5 h-5" />
              <span className="text-[13px] font-semibold select-none">মন্তব্য</span>
            </button>

            <button onClick={() => sharePost(post)}
              className="flex items-center justify-center gap-2 py-2.5 text-gray-600 dark:text-muted-foreground hover:bg-gray-50 dark:hover:bg-secondary/50 rounded-lg transition-colors select-none">
              <Share2 className="w-5 h-5" />
              <span className="text-[13px] font-semibold select-none">শেয়ার</span>
            </button>
          </div>
        </div>
      );
    });
    return elements;
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background pb-14">
      <header className="sticky top-0 z-50 safe-top border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-border/40 dark:bg-card/95">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="পিছনে যান"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
                else navigate({ to: "/home" });
              }}
              className="btn-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-700 dark:bg-secondary dark:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <Link to="/home" aria-label="ড্যাশবোর্ডে ফিরুন" className="gradient-amber btn-press flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-black ring-1 ring-card/70">
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link to="/user/$userId" params={{ userId: user.id }} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
              <Avatar path={myProfile?.avatar_url} className="w-full h-full object-cover" fallback={myProfile?.display_name?.[0]?.toUpperCase() || "?"} />
            </Link>
            <h1 className="text-[28px] font-black tracking-normal text-blue-600">good-app</h1>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => setShowCreatePost(true)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center transition-colors hover:bg-gray-200 dark:bg-secondary dark:text-foreground">
              <Plus className="w-5 h-5" />
            </button>
            <button onClick={() => setShowSearch(!showSearch)} className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center transition-colors hover:bg-gray-200 dark:bg-secondary dark:text-foreground">
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky safe-top-nav z-40 bg-white/95 dark:bg-card/95 backdrop-blur border-b border-gray-200 dark:border-border/40">
        <div className="max-w-lg mx-auto flex items-center gap-1.5 px-2.5 py-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab("home")}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black transition-all active:scale-95 ${activeTab === "home" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)]" : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-muted-foreground"}`}>
            <Home className="w-4 h-4" /> ফিড
          </button>

          <Link to="/friends"
            className="relative shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black bg-gray-100 dark:bg-secondary text-gray-600 dark:text-muted-foreground active:scale-95 transition-all">
            <Users className="w-4 h-4" /> বন্ধু
            {friendRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {friendRequestCount > 99 ? "99+" : friendRequestCount}
              </span>
            )}
          </Link>

          <Link to="/videos" title="ভিডিও দেখুন"
            className="shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black text-white bg-gradient-to-r from-red-600 to-orange-500 shadow-[0_8px_18px_-8px_rgba(239,68,68,0.8)] active:scale-95 transition-all">
            <Video className="w-4 h-4" /> ভিডিও
          </Link>

          <button onClick={() => navigate({ to: "/reels", search: {} })} title="Short"
            className="shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black text-white bg-gradient-to-r from-pink-600 via-fuchsia-500 to-violet-500 shadow-[0_8px_18px_-8px_rgba(219,39,119,0.8)] active:scale-95 transition-all">
            <Film className="w-4 h-4" /> Short
          </button>

          <button onClick={() => navigate({ to: "/chat" })}
            className={`relative shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black active:scale-95 transition-all ${unreadCount > 0 ? "bg-destructive text-destructive-foreground shadow-[0_8px_18px_-8px_var(--color-destructive)]" : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-muted-foreground"}`}>
            <MessageCircle className="w-4 h-4" /> চ্যাট
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-background text-destructive ring-2 ring-destructive text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          <button onClick={() => { setActiveTab("notif"); if (user) markNotificationsRead(user.id).then(() => queryClient.invalidateQueries({ queryKey: ["notif-count"] })); }}
            className={`relative shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-black transition-all active:scale-95 ${activeTab === "notif" ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_8px_18px_-8px_rgba(37,99,235,0.8)]" : "bg-gray-100 dark:bg-secondary text-gray-600 dark:text-muted-foreground"}`}>
            <Bell className="w-4 h-4" /> নোটিফিকেশন
            {notifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {notifCount > 99 ? "99+" : notifCount}
              </span>
            )}
          </button>
        </div>
      </nav>


      {showSearch && (
        <div className="overflow-hidden bg-white dark:bg-card border-b border-gray-200 dark:border-border/30 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="max-w-lg mx-auto px-3 py-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="পোস্ট বা ইউজার খুঁজুন..."
                className="w-full bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground rounded-full pl-10 pr-10 py-2 text-sm border-none outline-none placeholder:text-gray-400" autoFocus />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
            {searchQuery.trim() && (
              <div className="mt-2 space-y-1">
                <p className="px-2 pb-1 text-[11px] font-black uppercase text-gray-500">ইউজার</p>
                {searchPeopleLoading && (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
                )}
                {searchResults.filter((u: any) => u.id !== user.id).slice(0, 10).map((u: any) => (
                  <div key={u.id} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-secondary transition-colors">
                    <Link to="/user/$userId" params={{ userId: u.id }} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      <Avatar path={u.avatar_url} className="w-full h-full object-cover" fallback={u.display_name?.[0]?.toUpperCase() || "?"} />
                    </Link>
                    <Link onClick={() => setShowSearch(false)} to="/user/$userId" params={{ userId: u.id }} className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-foreground truncate">
                        <NameWithBadge name={u.display_name || "User"} isVerified={u.is_verified_badge} />
                      </p>
                      <p className="text-[11px] text-gray-500 dark:text-muted-foreground">UID {u.uid_seq ?? "—"}</p>
                    </Link>
                    {u.status === "accepted" ? (
                      <button onClick={() => startChatWith(u.id)} className="px-2.5 py-1.5 bg-blue-50 dark:bg-primary/10 text-blue-600 dark:text-primary text-[12px] font-semibold rounded-md shrink-0">মেসেজ</button>
                    ) : u.status === "pending_sent" ? (
                      <span className="px-2.5 py-1.5 bg-gray-100 dark:bg-secondary text-gray-500 text-[12px] font-semibold rounded-md shrink-0">পাঠানো</span>
                    ) : u.status === "pending_received" ? (
                      <button onClick={() => u.linkId && respondRequestMutation.mutate({ linkId: u.linkId, accept: true })} className="px-2.5 py-1.5 bg-blue-600 text-white text-[12px] font-semibold rounded-md shrink-0">গ্রহণ</button>
                    ) : (
                      <button onClick={() => friendRequestMutation.mutate(u.id)} disabled={friendRequestMutation.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white text-[12px] font-semibold rounded-md shrink-0 disabled:opacity-60">
                        <UserPlus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>
                ))}
                {!searchPeopleLoading && searchResults.length === 0 && (
                  <p className="py-4 text-center text-sm font-semibold text-gray-500">কোনো ইউজার পাওয়া যায়নি</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "home" && (
        <>
          {!showSearch && (
            <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border/30">
              <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center gap-3">
                <Link to="/user/$userId" params={{ userId: user.id }} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                  <Avatar path={myProfile?.avatar_url} className="w-full h-full object-cover" fallback={myProfile?.display_name?.[0]?.toUpperCase() || "?"} />
                </Link>
                <button onClick={() => setShowCreatePost(true)} className="flex-1 bg-gray-100 dark:bg-secondary rounded-full px-4 py-2.5 text-left">
                  <span className="text-sm text-gray-400 dark:text-muted-foreground">কি মনে হচ্ছে?</span>
                </button>
                <button onClick={() => { setShowCreatePost(true); setTimeout(() => fileInputRef.current?.click(), 300); }} className="flex flex-col items-center gap-0.5 px-2">
                  <Image className="w-5 h-5 text-green-600" />
                  <span className="text-[10px] text-gray-500 font-medium">ছবি</span>
                </button>
                <button onClick={() => { setShowCreatePost(true); setTimeout(() => videoInputRef.current?.click(), 300); }} className="flex flex-col items-center gap-0.5 px-2">
                  <Video className="w-5 h-5 text-red-500" />
                  <span className="text-[10px] text-gray-500 font-medium">ভিডিও</span>
                </button>
                <button onClick={() => navigate({ to: "/reels", search: {} })} className="flex flex-col items-center gap-0.5 px-2">
                  <Film className="w-5 h-5 text-pink-500" />
                  <span className="text-[10px] text-gray-500 font-medium">Short</span>
                </button>


              </div>
            </div>
          )}

          {!showSearch && (
            <div className="bg-white dark:bg-card border-b border-gray-200 dark:border-border/30">
              <div className="max-w-lg mx-auto px-3 py-3">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  <button onClick={() => storyInputRef.current?.click()}
                    className="relative min-w-[110px] h-[170px] rounded-xl overflow-hidden bg-gray-100 dark:bg-secondary border border-gray-200 dark:border-border flex flex-col shrink-0">
                    <div className="flex-1 bg-gradient-to-b from-blue-100 to-gray-100 dark:from-secondary dark:to-card flex items-center justify-center">
                      <Image className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="relative flex items-center justify-center py-4">
                      <div className="absolute -top-4 w-8 h-8 rounded-full bg-blue-600 border-[3px] border-white dark:border-card flex items-center justify-center">
                        {storyMutation.isPending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Plus className="w-4 h-4 text-white" />}
                      </div>
                      <span className="text-[11px] font-semibold text-gray-900 dark:text-foreground mt-1">Create story</span>
                    </div>
                  </button>
                  <input ref={storyInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleStorySelect} />

                  {sortedStoryEntries.map(([uid, userStories]) => {
                    const storyUser = userStories[0].user;
                    return (
                      <button key={uid} onClick={() => setViewingStory(userStories[0])} className="relative min-w-[110px] h-[170px] rounded-xl overflow-hidden shrink-0">
                        <FeedImg path={userStories[0].image_url} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
                        <span className="absolute top-2 right-2 min-w-[20px] h-[20px] bg-blue-600 text-white text-[10px] font-bold rounded-md flex items-center justify-center px-1">
                          {userStories.length}
                        </span>
                        <div className="absolute top-2 left-2 w-9 h-9 rounded-full p-[2px] bg-blue-600">
                          <div className="w-full h-full rounded-full overflow-hidden bg-white flex items-center justify-center">
                            <Avatar path={storyUser?.avatar_url} className="w-full h-full object-cover" fallback={storyUser?.display_name?.[0]?.toUpperCase() || "?"} />
                          </div>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2">
                          <p className="text-white text-xs font-bold drop-shadow-lg inline-flex items-center gap-1">
                            <span>{uid === user.id ? "Your story" : storyUser?.display_name || "User"}</span>
                            {storyUser?.is_verified_badge && <VerifiedBadge className="h-3 w-3" />}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {!showSearch && <PeopleYouMayKnow />}

          <div className="max-w-lg mx-auto">

            {postsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center py-20 text-gray-500 bg-white dark:bg-card mt-2 rounded-lg mx-3">
                <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
                <p className="font-bold text-gray-700 dark:text-foreground">{searchQuery ? "কিছু পাওয়া যায়নি" : "কোনো পোস্ট নেই"}</p>
                <p className="text-sm mt-1">{searchQuery ? "অন্য কিছু খুঁজুন" : "প্রথম পোস্ট করুন! ✨"}</p>
              </div>
            ) : (
              <div className="space-y-2 mt-2">
                {renderPosts()}
                {hasMore && (
                  <div ref={sentinelRef} className="flex justify-center py-4">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === "notif" && (
        <div className="max-w-lg mx-auto mt-2 px-2">
          <div className="bg-white dark:bg-card rounded-lg">
            <h3 className="px-4 pt-3 pb-2 text-[16px] font-bold text-gray-900 dark:text-foreground">নোটিফিকেশন</h3>
            {notificationsList.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">কোনো নোটিফিকেশন নেই</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-border/20">
                {notificationsList.map((n: any) => (
                  <button key={n.id}
                    onClick={() => {
                      if (n.type === "friend_request" || n.type === "friend_accept") navigate({ to: "/friends" });
                      else if (n.reference_id) { setActiveTab("home"); setTimeout(() => openComments(n.reference_id), 100); }
                      else if (n.from_user_id) navigate({ to: "/user/$userId", params: { userId: n.from_user_id } });
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-secondary/30 transition-colors ${!n.is_read ? "bg-blue-50/60 dark:bg-primary/5" : ""}`}>
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0 relative">
                      <Avatar path={n.from_user?.avatar_url} className="w-full h-full object-cover" fallback="?" />
                       <div className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] ${n.type === "like" ? "bg-blue-600" : n.type === "comment" || n.type === "reply" ? "bg-green-500" : n.type === "mention" ? "bg-orange-500" : n.type === "friend_request" || n.type === "friend_accept" ? "bg-blue-600" : "bg-gray-400"}`}>
                         {n.type === "like" ? "👍" : n.type === "comment" ? "💬" : n.type === "reply" ? "↩️" : n.type === "mention" ? "@" : n.type === "friend_request" || n.type === "friend_accept" ? "👥" : "🔔"}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-gray-900 dark:text-foreground leading-snug">
                        <span className="font-bold">{n.from_user?.display_name || "কেউ"}</span>
                        {n.type === "mention" && " আপনাকে একটি মন্তব্যে মেন্টশন করেছে"}
                        {n.type === "like" && " আপনার পোস্টে লাইক দিয়েছে"}
                        {n.type === "comment" && " আপনার পোস্টে মন্তব্য করেছে"}
                        {n.type === "reply" && " আপনার মন্তব্যে রিপ্লাই দিয়েছে"}
                        {n.type === "friend_request" && " আপনাকে ফ্রেন্ড রিকুয়েস্ট পাঠিয়েছে"}
                        {n.type === "friend_accept" && " আপনার ফ্রেন্ড রিকুয়েস্ট গ্রহণ করেছে"}
                      </p>
                      {n.content && <p className="text-[13px] text-gray-500 dark:text-muted-foreground truncate mt-0.5">"{n.content}"</p>}
                      <p className="text-[12px] text-blue-500 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <div className="w-3 h-3 rounded-full bg-blue-600 shrink-0 mt-2" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {commentingPostId && (
        <div className="fixed inset-0 z-[150] bg-white dark:bg-background animate-in fade-in duration-150">
          <div className="absolute inset-0 flex flex-col">
            <div className="safe-top flex items-center gap-2 px-3 pb-3 border-b border-gray-200 dark:border-border/30 shrink-0">
              <button onClick={() => { setCommentingPostId(null); setReplyingTo(null); }} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-gray-700 dark:text-foreground" />
              </button>
              <h3 className="text-[18px] font-black text-gray-900 dark:text-foreground">পোস্ট</h3>
            </div>

            <div className="flex-1 overflow-y-auto pb-3 space-y-4">
              {commentingPost && (
                <div className="border-b border-gray-200 dark:border-border/30 pb-3">
                  <div className="flex items-center gap-2.5 px-3 py-3">
                    <Link to="/user/$userId" params={{ userId: commentingPost.user_id }} className="w-10 h-10 rounded-full bg-gray-200 dark:bg-primary/15 overflow-hidden shrink-0">
                      <Avatar path={commentingPost.user?.avatar_url} className="w-full h-full object-cover" fallback={commentingPost.user?.display_name?.[0]?.toUpperCase() || "?"} />
                    </Link>
                    <div className="min-w-0">
                      <Link to="/user/$userId" params={{ userId: commentingPost.user_id }} className="text-[15px] font-bold text-gray-900 dark:text-foreground hover:underline block truncate">
                        <NameWithBadge name={commentingPost.user?.display_name || "User"} isVerified={commentingPost.user?.is_verified_badge} />
                      </Link>
                      <span className="text-[12px] text-gray-500">{timeAgo(commentingPost.created_at)}</span>
                    </div>
                  </div>
                  {commentingPost.content && (
                    <p className="px-3 pb-2 text-[16px] leading-relaxed text-gray-900 dark:text-foreground whitespace-pre-wrap break-words">{renderMentionText(commentingPost.content)}</p>
                  )}
                  {commentingPost.image_url && (() => {
                    const urls = commentingPost.image_url!.split(",").map((u) => u.trim()).filter(Boolean);
                    return (
                      <div className={urls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                        {urls.map((url, i) => (
                          <FeedImg key={i} path={url} className={`w-full object-cover ${urls.length === 1 ? "max-h-[420px]" : "max-h-[220px]"}`} />
                        ))}
                      </div>
                    );
                  })()}
                  {commentingPost.video_url && (
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/reels", search: { postId: commentingPost.id } as any })}
                      className="relative block w-full bg-black text-left"
                    >
                      <FeedVideo path={commentingPost.video_url} className="w-full max-h-[420px] object-contain opacity-90" />
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="grid h-14 w-14 place-items-center rounded-full bg-card/90 text-primary shadow-xl">
                          <Play className="ml-1 h-7 w-7 fill-current" />
                        </span>
                      </span>
                    </button>
                  )}
                  <div className="px-3 pt-2 flex items-center gap-4 text-[13px] text-gray-500 dark:text-muted-foreground">
                    <span>{commentingPost.likes_count || 0} লাইক</span>
                    <span>{commentingPost.comments_count || 0} মন্তব্য</span>
                  </div>
                </div>
              )}
              <div className="px-4 space-y-4">


              {loadingComments ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-[15px] text-gray-500">এখনো কোনো মন্তব্য নেই</p>
                  <p className="text-[13px] text-gray-400 mt-1">প্রথম মন্তব্য করুন!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex gap-2.5">
                      <Link to="/user/$userId" params={{ userId: c.user_id }} className="w-9 h-9 rounded-full bg-gray-200 dark:bg-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
                        <Avatar path={c.user?.avatar_url} className="w-full h-full object-cover" fallback={c.user?.display_name?.[0]?.toUpperCase() || "?"} />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="bg-gray-100 dark:bg-secondary rounded-2xl px-3 py-2.5">
                          <Link to="/user/$userId" params={{ userId: c.user_id }} className="text-[14px] font-bold text-gray-900 dark:text-foreground hover:underline block">
                            <NameWithBadge name={c.user?.display_name || "User"} isVerified={c.user?.is_verified_badge} />
                          </Link>
                          {c.content && <p className="text-[15px] leading-relaxed text-gray-900 dark:text-foreground mt-0.5 break-words whitespace-pre-wrap">{renderMentionText(c.content)}</p>}
                          {c.image_url && (
                            <CommentImg path={c.image_url} className="mt-2 max-h-64 w-full rounded-xl object-cover" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 px-1 mt-1">
                          <span className="text-[12px] text-gray-500">{timeAgo(c.created_at)}</span>
                          <button onClick={() => commentLikeMutation.mutate(c.id)} className={`text-[12px] font-bold ${c.liked_by_me ? "text-blue-600" : "text-gray-500"}`}>
                            পছন্দ {(c.likes_count || 0) > 0 ? `(${c.likes_count})` : ""}
                          </button>
                          <button onClick={() => setReplyingTo({ id: c.id, name: c.user?.display_name || "User" })} className="text-[12px] font-bold text-gray-500">Reply</button>
                          {c.user_id === user.id && (
                            <button onClick={() => deleteCommentMutation.mutate(c.id)} className="text-[12px] font-bold text-red-500">মুছুন</button>
                          )}
                        </div>
                        {c.replies && c.replies.length > 0 && (
                          <div className="ml-5 mt-1.5">
                            {!expandedReplies.has(c.id) ? (
                              <button onClick={() => setExpandedReplies((prev) => new Set(prev).add(c.id))}
                                className="flex items-center gap-1.5 text-[13px] font-bold text-gray-600 dark:text-muted-foreground hover:text-blue-600 dark:hover:text-primary py-1">
                                <span className="w-6 h-0 border-t-2 border-gray-300 dark:border-border/50" />
                                {c.replies.length === 1 ? "১টি রিপ্লাই দেখুন" : `${c.replies.length}টি রিপ্লাই দেখুন`}
                              </button>
                            ) : (
                              <>
                                <button onClick={() => setExpandedReplies((prev) => { const s = new Set(prev); s.delete(c.id); return s; })}
                                  className="flex items-center gap-1.5 text-[13px] font-bold text-gray-600 dark:text-muted-foreground hover:text-blue-600 dark:hover:text-primary py-1 mb-1.5">
                                  <span className="w-6 h-0 border-t-2 border-gray-300 dark:border-border/50" />
                                  রিপ্লাই লুকান
                                </button>
                                <div className="space-y-2 border-l-2 border-gray-200 dark:border-border/30 pl-3">
                                  {c.replies.map((r) => (
                                    <div key={r.id} className="flex gap-2">
                                      <Link to="/user/$userId" params={{ userId: r.user_id }} className="w-7 h-7 rounded-full bg-gray-200 dark:bg-primary/15 flex items-center justify-center shrink-0 overflow-hidden">
                                        <Avatar path={r.user?.avatar_url} className="w-full h-full object-cover" fallback={r.user?.display_name?.[0]?.toUpperCase() || "?"} />
                                      </Link>
                                      <div className="flex-1 min-w-0">
                                        <div className="bg-gray-100 dark:bg-secondary rounded-xl px-2.5 py-2">
                                          <Link to="/user/$userId" params={{ userId: r.user_id }} className="text-[13px] font-bold text-gray-900 dark:text-foreground">
                                            <NameWithBadge name={r.user?.display_name || "User"} isVerified={r.user?.is_verified_badge} />
                                          </Link>
                                          {r.content && <p className="text-[14px] leading-relaxed text-gray-900 dark:text-foreground break-words">{renderMentionText(r.content)}</p>}
                                          {r.image_url && (
                                            <CommentImg path={r.image_url} className="mt-2 max-h-48 w-full rounded-lg object-cover" />
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 px-1 mt-0.5">
                                          <span className="text-[11px] text-gray-500">{timeAgo(r.created_at)}</span>
                                          <button onClick={() => commentLikeMutation.mutate(r.id)} className={`text-[11px] font-bold ${r.liked_by_me ? "text-blue-600" : "text-gray-500"}`}>
                                            পছন্দ {(r.likes_count || 0) > 0 ? `(${r.likes_count})` : ""}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>


            <div className="border-t border-gray-200 dark:border-border/30 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              {replyingTo && (
                <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 bg-gray-100 dark:bg-secondary rounded-lg text-[12px]">
                  <span className="text-gray-600 dark:text-muted-foreground">Replying to <b>{replyingTo.name}</b></span>
                  <button onClick={() => setReplyingTo(null)}><X className="w-3.5 h-3.5 text-gray-500" /></button>
                </div>
              )}
              {mentionResults.length > 0 && (
                <div className="mb-2 max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-border/30 bg-white dark:bg-card shadow-lg">
                  {mentionResults.slice(0, 6).map((person: any) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => insertMention(person)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-secondary/50"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 dark:bg-primary/10 text-[12px] font-black text-blue-600 dark:text-primary">
                        {(person.display_name || "U").slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-black text-gray-900 dark:text-foreground">{person.display_name || "User"}</span>
                        <span className="block text-[11px] font-semibold text-gray-500 dark:text-muted-foreground">UID {person.uid_seq ?? "—"}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {commentImagePreview && (
                <div className="mb-2 flex items-end gap-2">
                  <div className="relative h-24 w-24 overflow-hidden rounded-xl bg-gray-100 dark:bg-secondary">
                    <img src={commentImagePreview} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={clearCommentImage} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input ref={commentImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCommentImageSelect} />
                <button type="button" onClick={() => commentImageInputRef.current?.click()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gray-100 text-green-600 dark:bg-secondary">
                  <Image className="h-4.5 w-4.5" />
                </button>
                <input value={commentText} onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (commentText.trim() || commentImageFile)) commentMutation.mutate({ text: commentText.trim(), imageFile: commentImageFile }); }}
                  placeholder="মন্তব্য লিখুন..."
                  className="flex-1 bg-gray-100 dark:bg-secondary text-gray-900 dark:text-foreground rounded-full px-4 py-2.5 text-sm border-none outline-none placeholder:text-gray-400" />
                <button onClick={() => (commentText.trim() || commentImageFile) && commentMutation.mutate({ text: commentText.trim(), imageFile: commentImageFile })}
                  disabled={(!commentText.trim() && !commentImageFile) || commentMutation.isPending}
                  className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center disabled:opacity-40 shrink-0">
                  {commentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreatePost && (
        <div className="fixed inset-0 z-[150] bg-black/50 flex items-end sm:items-center justify-center animate-in fade-in duration-150" onClick={() => setShowCreatePost(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-border/30">
              <h3 className="text-[17px] font-bold text-gray-900 dark:text-foreground">পোস্ট তৈরি করুন</h3>
              <button onClick={() => setShowCreatePost(false)} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-secondary flex items-center justify-center">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="কি মনে হচ্ছে?" rows={4}
                className="w-full resize-none text-[16px] text-gray-900 dark:text-foreground bg-transparent outline-none placeholder:text-gray-400" autoFocus />
              {postImagePreviews.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {postImagePreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} className="w-full h-32 object-cover rounded-lg" />
                      <button onClick={() => { setPostImageFiles((p) => p.filter((_, idx) => idx !== i)); setPostImagePreviews((p) => p.filter((_, idx) => idx !== i)); }}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {postVideoPreview && (
                <div className="relative">
                  <video src={postVideoPreview} controls className="w-full max-h-64 rounded-lg" />
                  <button onClick={() => { setPostVideoFile(null); setPostVideoPreview(null); }}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center">
                    <X className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3 border border-gray-200 dark:border-border rounded-lg p-3">
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                  <Image className="w-5 h-5" /> ছবি
                </button>
                <button onClick={() => videoInputRef.current?.click()} className="flex items-center gap-1.5 text-red-500 text-sm font-semibold">
                  <Video className="w-5 h-5" /> ভিডিও
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
              <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-border/30">
              <button onClick={() => createPostMutation.mutate()}
                disabled={createPostMutation.isPending || (!postContent.trim() && postImageFiles.length === 0 && !postVideoFile)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold disabled:opacity-40 flex items-center justify-center gap-2">
                {createPostMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "পোস্ট করুন"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reactorsPostId && (
        <ReactorsModal postId={reactorsPostId} onClose={() => setReactorsPostId(null)} />
      )}

      {viewingImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center animate-in fade-in duration-150" onClick={() => setViewingImage(null)}>
          <button onClick={() => setViewingImage(null)} className="absolute top-4 right-4 z-10 text-white/80 hover:text-white">
            <X size={28} />
          </button>
          <FeedImg path={viewingImage} className="max-w-full max-h-full object-contain p-4" onClick={(e: any) => e.stopPropagation()} />
        </div>
      )}

      {editingPost && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditingPost(null)}>
          <div className="w-full sm:max-w-lg bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-border/30">
              <button onClick={() => setEditingPost(null)} className="p-1"><X className="w-5 h-5" /></button>
              <p className="flex-1 text-[16px] font-bold">পোস্ট এডিট করুন</p>
              <button
                onClick={() => editPostMutation.mutate({ postId: editingPost.id, content: editText, visibility: editVisibility })}
                disabled={editPostMutation.isPending || !editText.trim()}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[14px] font-bold disabled:opacity-50"
              >
                {editPostMutation.isPending ? "…" : "সেভ"}
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={6}
              className="w-full p-4 bg-transparent text-[16px] outline-none resize-none"
              placeholder="কিছু লিখুন…"
            />
            <div className="px-4 pb-4">
              <p className="text-[13px] font-bold text-gray-700 dark:text-foreground mb-2">দেখার অনুমতি</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditVisibility("public")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${editVisibility === "public" ? "border-blue-600 bg-blue-600/10 text-blue-600" : "border-gray-200 dark:border-border/40 text-gray-700 dark:text-foreground"}`}
                >
                  <Globe className="w-4 h-4" /> সবাই দেখবে
                </button>
                <button
                  onClick={() => setEditVisibility("private")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${editVisibility === "private" ? "border-blue-600 bg-blue-600/10 text-blue-600" : "border-gray-200 dark:border-border/40 text-gray-700 dark:text-foreground"}`}
                >
                  <Lock className="w-4 h-4" /> শুধু আমি
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {storyEditorFile && (
        <StoryEditor imageFile={storyEditorFile} onClose={() => setStoryEditorFile(null)} onPublish={handleStoryPublish} isPending={storyMutation.isPending} />
      )}

      {viewingStory && (
        <StoryViewer
          story={viewingStory}
          allStories={storyGroups[viewingStory.user_id]}
          userId={user.id}
          onClose={() => setViewingStory(null)}
          onDelete={(id) => deleteStoryMutation.mutate(id)}
          onMessage={(uid) => { setViewingStory(null); startChatWith(uid); }}
          onCall={() => {}}
          onProfile={(uid) => { setViewingStory(null); navigate({ to: "/user/$userId", params: { userId: uid } }); }}
          timeAgo={timeAgo}
        />
      )}
    </div>
  );
}

/** কে কোন রিঅ্যাকশন দিয়েছে — Facebook-এর মতো তালিকা */
function ReactorsModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["post-reactors", postId],
    queryFn: () => getPostReactors(postId),
    staleTime: 15_000,
  });
  const [filter, setFilter] = useState<string | null>(null);
  const people = (data?.people ?? []).filter((p) => !filter || p.reaction_type === filter);

  return (
    <div className="fixed inset-0 z-[220] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white dark:bg-card rounded-t-2xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-border/30">
          <p className="flex-1 text-sm font-black">রিঅ্যাকশন {data ? `(${data.total})` : ""}</p>
          <button onClick={onClose} aria-label="বন্ধ" className="p-1">
            <X className="h-5 w-5 text-gray-500 dark:text-muted-foreground" />
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-2 border-b border-gray-100 dark:border-border/30">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-3 py-1 text-[12px] font-black ${filter === null ? "bg-primary text-primary-foreground" : "bg-gray-100 dark:bg-secondary"}`}
          >
            সব {data?.total ?? 0}
          </button>
          {Object.entries(data?.counts ?? {}).map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-black ${filter === type ? "bg-primary text-primary-foreground" : "bg-gray-100 dark:bg-secondary"}`}
            >
              <span className="text-base">{REACTION_EMOJIS[type]}</span> {count}
            </button>
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto divide-y divide-gray-100 dark:divide-border/20">
          {isLoading && (
            <p className="flex items-center justify-center gap-2 p-5 text-xs font-bold text-gray-500 dark:text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে…
            </p>
          )}
          {!isLoading && people.length === 0 && (
            <p className="p-6 text-center text-xs font-bold text-gray-500 dark:text-muted-foreground">
              এখনো কেউ রিঅ্যাক্ট করেনি
            </p>
          )}
          {people.map((p) => (
            <Link
              key={`${p.user_id}-${p.reaction_type}`}
              to="/user/$userId"
              params={{ userId: p.user_id }}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-blue-100 dark:bg-secondary">
                <Avatar path={p.avatar_url} className="h-10 w-10 rounded-full object-cover" fallback={(p.display_name ?? "U").charAt(0)} />
                <span className="absolute -bottom-0.5 -right-0.5 text-sm">{REACTION_EMOJIS[p.reaction_type]}</span>
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{p.display_name ?? "User"}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
