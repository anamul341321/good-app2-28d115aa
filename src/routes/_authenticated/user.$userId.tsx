import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  toggleReaction, getUserReactions, getPostComments, addComment,
  REACTION_EMOJIS, type Post, type PostComment,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";
import { listFriends, sendFriendRequest, respondFriendRequest } from "@/lib/friends.functions";
import { getPublicProfile } from "@/lib/social-users.functions";
import {
  ArrowLeft, User, MessageCircle, Calendar, Globe, MoreHorizontal,
  UserPlus, Loader2, Check, Camera,
} from "lucide-react";
import { uploadAvatar, uploadCoverPhoto } from "@/lib/profile.functions";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import VerifiedBadge from "@/components/VerifiedBadge";
import { playUiSound } from "@/lib/ui-sounds";

const db = supabase as any;

export const Route = createFileRoute("/_authenticated/user/$userId")({
  component: UserProfilePage,
  head: () => ({
    meta: [
      { title: "প্রোফাইল — Good-App" },
      { name: "description", content: "এই ব্যবহারকারীর প্রোফাইল, পোস্ট ও কার্যকলাপ দেখুন — Good-App।" },
      { property: "og:title", content: "প্রোফাইল — Good-App" },
      { property: "og:description", content: "এই ব্যবহারকারীর প্রোফাইল, পোস্ট ও কার্যকলাপ দেখুন — Good-App।" },
      { property: "og:type", content: "profile" },
    ],
  }),
});

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  uid_seq: number | null;
  is_verified_badge: boolean | null;
  created_at: string | null;
  bio?: string | null;
};

function Avatar({ path, className, fallback }: { path?: string | null; className?: string; fallback: string }) {
  const url = useFeedMedia(path);
  if (path && url) return <img src={url} className={className} alt="" />;
  return <span className="text-blue-600 dark:text-primary font-bold text-sm">{fallback}</span>;
}

function CoverImg({ path, className }: { path?: string | null; className?: string }) {
  const url = useFeedMedia(path);
  if (!path || !url) return null;
  return <img src={url} alt="Cover" className={className} />;
}

function PostImage({ path, className, onClick }: { path: string; className?: string; onClick?: () => void }) {
  const url = useFeedMedia(path);
  return <img src={url} alt="" className={className} onClick={onClick} />;
}

function PostVideo({ path, className }: { path: string; className?: string }) {
  const url = useFeedMedia(path);
  return <video src={url} controls playsInline preload="metadata" className={className} />;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "এইমাত্র";
  if (mins < 60) return `${mins} মি.`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ঘ.`;
  return `${Math.floor(hrs / 24)} দি.`;
}

function UserProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/user/$userId" });
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [userReactions, setUserReactions] = useState<Record<string, string>>({});
  const [commentingPostId, setCommentingPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [showPostMenu, setShowPostMenu] = useState<string | null>(null);

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"cover" | "avatar" | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const longPressFiredRef = useRef(false);

  const handleImageUpload = async (file: File, kind: "cover" | "avatar") => {
    if (!file.type.startsWith("image/")) return toast.error("শুধু ছবি দেওয়া যাবে");
    if (file.size > 8 * 1024 * 1024) return toast.error("ছবি ৮MB-এর কম হতে হবে");
    setUploading(kind);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const payload = { data: { base64, contentType: file.type } };
      if (kind === "cover") await uploadCoverPhoto(payload);
      else await uploadAvatar(payload);
      await queryClient.invalidateQueries({ queryKey: ["feed-user-profile", userId] });
      toast.success(kind === "cover" ? "কভার ফটো আপডেট হয়েছে" : "প্রোফাইল ছবি আপডেট হয়েছে");
    } catch {
      toast.error("আপলোড করা যায়নি");
    } finally {
      setUploading(null);
    }
  };


  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/" });
  }, [user, authLoading, navigate]);

  const { data: targetUser, isLoading: userLoading } = useQuery({
    queryKey: ["feed-user-profile", userId],
    queryFn: async () => (await getPublicProfile({ data: { userId } })) as ProfileRow | null,
    enabled: !!userId,
  });


  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ["feed-user-posts", userId],
    queryFn: async () => {
      const { data } = await db
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return ((data || []) as any[]).map((p) => ({
        ...p,
        user: targetUser
          ? { display_name: targetUser.display_name, avatar_url: targetUser.avatar_url, uid_seq: targetUser.uid_seq, is_verified_badge: targetUser.is_verified_badge }
          : null,
      })) as Post[];
    },
    enabled: !!targetUser,
  });

  const { data: friendsData } = useQuery({
    queryKey: ["friends-summary"],
    queryFn: () => listFriends(),
    enabled: !!user,
    staleTime: 30000,
  });

  const friendLink = friendsData
    ? [...friendsData.friends, ...friendsData.incoming, ...friendsData.outgoing].find((f) => f.userId === userId)
    : undefined;

  useEffect(() => {
    if (user && posts.length > 0) {
      getUserReactions(user.id, posts.map((p) => p.id)).then(setUserReactions);
    }
  }, [user, posts]);

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, type }: { postId: string; type: string }) => {
      if (!user) throw new Error("Login");
      return toggleReaction(postId, user.id, type);
    },
    onMutate: ({ postId, type }) => {
      if (userReactions[postId] !== type) playUiSound("like");
      setShowReactionPicker(null);
    },
    onSuccess: (result, { postId, type }) => {
      if (result.reacted) {
        setUserReactions((prev) => ({ ...prev, [postId]: type }));
      } else {
        setUserReactions((prev) => { const n = { ...prev }; delete n[postId]; return n; });
      }
      queryClient.invalidateQueries({ queryKey: ["feed-user-posts", userId] });
    },
  });


  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user || !commentingPostId) throw new Error("Error");
      return addComment(commentingPostId, user.id, commentText.trim());
    },
    onMutate: async () => {
      if (!user || !commentingPostId) return;
      const optimistic: PostComment = {
        id: `temp-${Date.now()}`, post_id: commentingPostId, user_id: user.id,
        content: commentText.trim(), created_at: new Date().toISOString(),
        user: { display_name: (user.user_metadata as any)?.display_name || "You", avatar_url: null },
      };
      setComments((prev) => [...prev, optimistic]);
      setCommentText("");
    },
    onSuccess: () => {
      if (commentingPostId) loadComments(commentingPostId);
      queryClient.invalidateQueries({ queryKey: ["feed-user-posts", userId] });
    },
  });

  const friendRequestMutation = useMutation({
    mutationFn: async () => { await sendFriendRequest({ data: { userId } }); },
    onSuccess: () => {
      toast.success("ফ্রেন্ড রিকুয়েস্ট পাঠানো হয়েছে!");
      queryClient.invalidateQueries({ queryKey: ["friends-summary"] });
    },
    onError: () => toast.error("রিকুয়েস্ট পাঠানো যায়নি"),
  });

  const respondRequestMutation = useMutation({
    mutationFn: async ({ linkId, accept }: { linkId: string; accept: boolean }) =>
      respondFriendRequest({ data: { linkId, accept } }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["friends-summary"] });
      if (vars.accept) toast.success("ফ্রেন্ড রিকুয়েস্ট গ্রহণ করা হয়েছে! 🎉");
    },
  });

  const loadComments = async (postId: string) => {
    setLoadingComments(true);
    setComments(await getPostComments(postId, user?.id));
    setLoadingComments(false);
  };

  const commentingPost = commentingPostId ? posts.find((p) => p.id === commentingPostId) || null : null;

  const openComments = (postId: string) => {
    if (commentingPostId === postId) { setCommentingPostId(null); return; }
    setCommentingPostId(postId);
    loadComments(postId);
  };

  if (authLoading || !user) return null;

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-background">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-background gap-4">
        <p className="text-gray-500">ইউজার পাওয়া যায়নি</p>
        <button onClick={() => navigate({ to: "/feed" })} className="text-blue-600 font-bold">ফিরে যান</button>
      </div>
    );
  }

  const isOwnProfile = targetUser.id === user.id;
  const joinDate = targetUser.created_at
    ? new Date(targetUser.created_at).toLocaleDateString("bn-BD", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background pb-8">
      <header className="sticky top-0 z-50 safe-top bg-blue-600 shadow-md">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate({ to: "/feed" })} className="text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-[17px] font-bold text-white truncate">{targetUser.display_name || "User"}</h1>
        </div>
      </header>

      <div className="bg-white dark:bg-card">
        <div
          className="h-[180px] bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden relative cursor-pointer"
          onClick={() => targetUser.cover_url && setViewingImage(targetUser.cover_url)}
        >
          <CoverImg path={targetUser.cover_url} className="w-full h-full object-cover object-center" />
          {isOwnProfile && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}
              disabled={uploading === "cover"}
              className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 text-white text-[12px] font-semibold backdrop-blur-sm"
            >
              {uploading === "cover" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
              কভার ফটো
            </button>
          )}
        </div>
        <div className="px-4 pb-4 pt-3">
          <div className="relative w-[110px] -mt-16 z-10">
            <button
              onClick={() => targetUser.avatar_url && setViewingImage(targetUser.avatar_url)}
              className="w-[110px] h-[110px] rounded-full overflow-hidden border-4 border-white dark:border-card bg-gray-200 dark:bg-primary/20 flex items-center justify-center shadow-lg"
            >
              {targetUser.avatar_url ? (
                <Avatar path={targetUser.avatar_url} className="w-full h-full object-cover" fallback={targetUser.display_name?.[0]?.toUpperCase() || "?"} />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </button>
            {isOwnProfile && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading === "avatar"}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white dark:border-card shadow"
              >
                {uploading === "avatar" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            )}
          </div>
          {isOwnProfile && (
            <>
              <input ref={coverInputRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleImageUpload(f, "cover"); }} />
              <input ref={avatarInputRef} type="file" accept="image/*" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handleImageUpload(f, "avatar"); }} />
            </>
          )}
          <h2 className="text-[22px] font-black text-gray-900 dark:text-foreground mt-2 inline-flex items-center gap-1.5">
            <span>{targetUser.display_name || "User"}</span>
            {targetUser.is_verified_badge && <VerifiedBadge className="h-5 w-5" />}
          </h2>
          <p className="text-[13px] text-gray-500 dark:text-muted-foreground">
            {targetUser.uid_seq ? `UID: ${targetUser.uid_seq}` : ""}
          </p>
          {targetUser.bio && targetUser.bio.trim() && (
            <p className="mt-1.5 text-[14px] leading-snug text-gray-700 dark:text-foreground/90 whitespace-pre-wrap break-words">
              {targetUser.bio}
            </p>
          )}

          <div className="flex items-center gap-4 mt-3 text-[13px] text-gray-500 dark:text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{joinDate}</span>
            </div>
          </div>

          {!isOwnProfile ? (
            <div className="flex gap-2 mt-3">
              {friendLink?.status === "accepted" ? (
                <button className="flex-1 py-2 bg-gray-200 dark:bg-secondary text-gray-700 dark:text-foreground rounded-md text-[13px] font-semibold flex items-center justify-center gap-1.5">
                  <Check className="w-4 h-4" /> বন্ধু
                </button>
              ) : friendLink?.status === "pending" && friendLink.incoming ? (
                <button
                  onClick={() => respondRequestMutation.mutate({ linkId: friendLink.linkId, accept: true })}
                  disabled={respondRequestMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-md text-[13px] font-semibold flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> গ্রহণ করুন
                </button>
              ) : friendLink?.status === "pending" ? (
                <button disabled className="flex-1 py-2 bg-gray-200 dark:bg-secondary text-gray-600 rounded-md text-[13px] font-semibold">
                  রিকুয়েস্ট পাঠানো হয়েছে
                </button>
              ) : (
                <button
                  onClick={() => friendRequestMutation.mutate()}
                  disabled={friendRequestMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-md text-[13px] font-semibold flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> Add friend
                </button>
              )}
              <button
                onClick={() => navigate({ to: "/chat/$peerId", params: { peerId: userId } })}
                className="flex-1 py-2 bg-gray-200 dark:bg-secondary text-gray-700 dark:text-foreground rounded-md text-[13px] font-semibold flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" /> Message
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate({ to: "/feed" })}
              className="w-full mt-3 py-2 bg-gray-200 dark:bg-secondary text-gray-700 dark:text-foreground rounded-md text-[13px] font-semibold block text-center"
            >
              নিজের ফিডে ফিরুন
            </button>
          )}

          <Link
            to="/channel/$userId"
            params={{ userId }}
            className="w-full mt-2 py-2 border border-blue-600 text-blue-600 rounded-md text-[13px] font-semibold block text-center"
          >
            চ্যানেল দেখুন
          </Link>
        </div>
      </div>

      <div className="mt-2">
        <div className="bg-white dark:bg-card px-3 py-2.5 border-b border-gray-200 dark:border-border/30">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-foreground">পোস্টসমূহ</h3>
        </div>

        {postsLoading ? (
          <div className="flex justify-center py-10 bg-white dark:bg-card">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white dark:bg-card">
            <p className="text-sm">কোনো পোস্ট নেই</p>
          </div>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => {
              const myReaction = userReactions[post.id];
              return (
                <div key={post.id} className="bg-white dark:bg-card">
                  <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                      <Avatar path={post.user?.avatar_url} className="w-full h-full object-cover" fallback={post.user?.display_name?.[0]?.toUpperCase() || "?"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[14px] text-gray-900 dark:text-foreground">
                        {post.user?.display_name || "User"}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-muted-foreground">
                        <span>{timeAgo(post.created_at)}</span>
                        <span>·</span>
                        <Globe className="w-3 h-3" />
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPostMenu(showPostMenu === post.id ? null : post.id)}
                      className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-secondary text-gray-500"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                  </div>

                  <AnimatePresence>
                    {showPostMenu === post.id && !isOwnProfile && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        className="mx-3 mb-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => { navigate({ to: "/chat/$peerId", params: { peerId: userId } }); setShowPostMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 dark:text-foreground hover:bg-gray-50 dark:hover:bg-secondary text-sm"
                        >
                          <MessageCircle className="w-4 h-4" /> মেসেজ পাঠান
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {post.content && (
                    <p className="text-[15px] text-gray-900 dark:text-foreground leading-relaxed px-3 pb-2 whitespace-pre-wrap">{post.content}</p>
                  )}

                  {post.image_url && (() => {
                    const imageUrls = post.image_url!.split(",").map((u) => u.trim()).filter(Boolean);
                    return (
                      <div className={imageUrls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                        {imageUrls.map((url, imgIdx) => (
                          <button key={imgIdx} onClick={() => setViewingImage(url)} className="block w-full">
                            <PostImage path={url} className={`w-full object-cover ${imageUrls.length === 1 ? "max-h-[500px]" : "max-h-[250px]"}`} />
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  {post.video_url && (
                    <div className="bg-black">
                      <PostVideo path={post.video_url} className="w-full max-h-[500px] object-contain" />
                    </div>
                  )}

                  <div className="px-3 py-1.5 flex items-center justify-between text-[13px] text-gray-500 dark:text-muted-foreground">
                    <div className="flex items-center gap-1">
                      {post.likes_count > 0 && (
                        <>
                          <span className="flex -space-x-0.5">
                            <span className="w-[18px] h-[18px] rounded-full bg-blue-600 flex items-center justify-center text-[10px]">👍</span>
                            {myReaction && myReaction !== "like" && (
                              <span className="w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-[10px]">{REACTION_EMOJIS[myReaction]}</span>
                            )}
                          </span>
                          <span>{post.likes_count}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {post.comments_count > 0 && <span>{post.comments_count} মন্তব্য</span>}
                    </div>
                  </div>

                  <div
                    className="border-t border-gray-100 dark:border-border/30 flex items-center px-1 relative select-none"
                    style={{ WebkitUserSelect: "none", userSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
                  >
                    <div className="relative flex-1">
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
                        className={`w-full flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold rounded select-none ${myReaction ? "text-blue-600" : "text-gray-600 dark:text-muted-foreground"}`}
                      >
                        <span className="text-[17px] leading-none">{myReaction ? REACTION_EMOJIS[myReaction] : "👍"}</span>
                        <span className="select-none">{myReaction && myReaction !== "like" ? "রিঅ্যাক্ট" : "লাইক"}</span>
                      </button>

                      {showReactionPicker === post.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowReactionPicker(null)} />
                          <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-card border border-gray-200 dark:border-border rounded-full shadow-xl px-2 py-1.5 flex gap-0.5 z-50 animate-in fade-in zoom-in-90 duration-150">
                            {Object.entries(REACTION_EMOJIS).map(([type, emoji]) => (
                              <button
                                key={type}
                                onClick={() => reactionMutation.mutate({ postId: post.id, type })}
                                className={`text-2xl p-1 rounded-full transition-transform hover:scale-125 ${myReaction === type ? "bg-blue-50 dark:bg-primary/20" : ""}`}
                                title={type}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => openComments(post.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[13px] font-semibold text-gray-600 dark:text-muted-foreground rounded select-none"
                    >
                      <MessageCircle className="w-4 h-4" /> মন্তব্য
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {commentingPost && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-white dark:bg-background">
          <div className="safe-top flex items-center gap-3 border-b border-gray-200 px-3 py-2.5 dark:border-border/40">
            <button onClick={() => setCommentingPostId(null)} className="text-gray-700 dark:text-foreground">
              <ArrowLeft size={22} />
            </button>
            <h2 className="text-[17px] font-bold text-gray-900 dark:text-foreground">মন্তব্যসমূহ</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="border-b border-gray-200 pb-2 dark:border-border/30">
              <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-primary/20">
                  <Avatar path={commentingPost.user?.avatar_url} className="h-full w-full object-cover" fallback={commentingPost.user?.display_name?.[0]?.toUpperCase() || "?"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-gray-900 dark:text-foreground">{commentingPost.user?.display_name || "User"}</p>
                  <span className="text-[11px] text-gray-500 dark:text-muted-foreground">{timeAgo(commentingPost.created_at)}</span>
                </div>
              </div>
              {commentingPost.content && (
                <p className="whitespace-pre-wrap px-3 pb-2 text-[15px] leading-relaxed text-gray-900 dark:text-foreground">{commentingPost.content}</p>
              )}
              {commentingPost.image_url && (() => {
                const urls = commentingPost.image_url!.split(",").map((u) => u.trim()).filter(Boolean);
                return (
                  <div className={urls.length === 1 ? "" : "grid grid-cols-2 gap-0.5"}>
                    {urls.map((u, i) => (
                      <PostImage key={i} path={u} className="max-h-[320px] w-full object-cover" onClick={() => setViewingImage(u)} />
                    ))}
                  </div>
                );
              })()}
              {commentingPost.video_url && (
                <div className="bg-black">
                  <PostVideo path={commentingPost.video_url} className="max-h-[320px] w-full object-contain" />
                </div>
              )}
              <div className="flex items-center gap-3 px-3 pt-2 text-[13px] text-gray-500 dark:text-muted-foreground">
                <span>{commentingPost.likes_count || 0} লাইক</span>
                <span>{commentingPost.comments_count || 0} মন্তব্য</span>
              </div>
            </div>

            <div className="space-y-3 px-3 py-3">
              {loadingComments ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-gray-500">এখনো কোনো মন্তব্য নেই</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 dark:bg-primary/15">
                      <Avatar path={c.user?.avatar_url} className="h-full w-full object-cover" fallback={c.user?.display_name?.[0]?.toUpperCase() || "?"} />
                    </div>
                    <div className="flex-1 rounded-2xl bg-gray-100 px-3 py-2 dark:bg-secondary">
                      <p className="text-[13px] font-bold text-gray-900 dark:text-foreground">{c.user?.display_name || "User"}</p>
                      <p className="text-[14px] text-gray-800 dark:text-foreground">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] dark:border-border/40">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && commentText.trim()) commentMutation.mutate(); }}
              placeholder="মন্তব্য লিখুন..."
              autoFocus
              className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[14px] text-gray-900 outline-none dark:bg-secondary dark:text-foreground"
            />
            <button
              onClick={() => commentText.trim() && commentMutation.mutate()}
              disabled={!commentText.trim() || commentMutation.isPending}
              className="text-[14px] font-bold text-blue-600 disabled:opacity-40"
            >
              পাঠান
            </button>
          </div>
        </div>
      )}


      <AnimatePresence>
        {viewingImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4"
            onClick={() => setViewingImage(null)}
          >
            <PostImage path={viewingImage} className="max-w-full max-h-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
