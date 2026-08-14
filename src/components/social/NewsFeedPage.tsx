import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Bell, Image as ImageIcon, Share2, MoreHorizontal, Heart, Smile, MessageSquare, Video, Globe, Users, Clock, Camera } from "lucide-react";
import { listPosts, createPost, reactToPost } from "@/lib/news-feed.functions";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";

export function NewsFeedPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: postsData, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => listPosts(),
    refetchInterval: 30000,
  });

  const posts = postsData?.posts ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F2F5] pb-20">
      {/* Top Header - Facebook Lite Style */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="max-w-md mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#1877F2] tracking-tighter">good-app</h1>
          <div className="flex items-center gap-1">
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press">
              <Search className="h-5 w-5 text-gray-600" />
            </button>
            <button 
              onClick={() => navigate({ to: "/chat" as any })}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press"
            >
              <MessageSquare className="h-5 w-5 text-gray-600" />
            </button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press">
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full space-y-2">
        {/* Composer - What's on your mind? */}
        <div className="bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <MessengerAvatar src={null} name="Me" size="md" />
            <button 
              className="flex-1 h-10 px-4 rounded-full border border-gray-200 text-gray-500 text-sm font-medium text-left hover:bg-gray-50 transition-colors"
              onClick={() => toast.info("Post creation coming soon")}
            >
              {t("আপনি কী ভাবছেন?", "What's on your mind?")}
            </button>
          </div>
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-100">
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Video className="h-4 w-4 text-[#F3425F]" /> {t("লাইভ", "Live")}
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <ImageIcon className="h-4 w-4 text-[#45BD62]" /> {t("ছবি", "Photo")}
            </button>
            <div className="w-px h-4 bg-gray-200" />
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-bold text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
              <Smile className="h-4 w-4 text-[#F7B928]" /> {t("অনুভূতি", "Feeling")}
            </button>
          </div>
        </div>

        {/* Dash Section Integration Button - Modern Styled */}
        <div className="px-4 py-3">
          <Link 
            to="/reverify" 
            className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1877F2] to-[#3B82F6] rounded-xl p-4 text-white shadow-md active:scale-[0.98] transition-all"
          >
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
              <Camera className="w-6 h-6" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-black leading-tight">{t("ভেরিফিকেশন সেন্টার এ যান", "Go to Verification Center")}</p>
              <p className="text-[10px] opacity-90 font-bold">{t("আপনার পরিচয় ও ১০ জন সাক্ষী", "Your identity & 10 witnesses")}</p>
            </div>
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        {/* Posts List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 border-2 border-[#1877F2] border-t-transparent animate-spin rounded-full" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white p-10 text-center mx-2 rounded-xl border border-dashed border-gray-300">
            <p className="text-sm font-bold text-gray-400">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))
        )}
      </main>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const reactMut = useMutation({
    mutationFn: (type: string) => reactToPost({ data: { postId: post.id, reactionType: type } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Post Header */}
      <div className="p-3 flex items-start gap-2">
        <MessengerAvatar src={post.author?.avatar_url} name={post.author?.display_name || "User"} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="font-bold text-sm text-gray-900 leading-none">{post.author?.display_name || "User"}</p>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-[11px] text-gray-500 font-medium">{formatPostTime(post.created_at)}</p>
            <span className="text-[11px] text-gray-400">·</span>
            <Globe className="h-3 w-3 text-gray-400" />
          </div>
        </div>
        <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
          <MoreHorizontal className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Post Body */}
      <div className="px-3 pb-3">
        <p className="text-[14px] text-gray-900 whitespace-pre-line leading-snug">{post.body}</p>
      </div>

      {/* Media Grid */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="bg-gray-100">
          <div className={`grid gap-0.5 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {post.media_urls.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Post Footer - Stats */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 mx-1">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-[#1877F2] flex items-center justify-center text-white ring-1 ring-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
            </div>
            <div className="h-4 w-4 rounded-full bg-[#F7B928] flex items-center justify-center text-white ring-1 ring-white">
              <Smile className="h-2.5 w-2.5 fill-current" />
            </div>
          </div>
          <span className="text-[12px] text-gray-500 font-medium">{post.reactions?.length || 0}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium">
          {post.comment_count?.length > 0 && <span>{post.comment_count?.length} {t("মন্তব্য", "Comments")}</span>}
          <span>0 {t("শেয়ার", "Shares")}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center px-1 py-1">
        <button 
          className="flex-1 flex items-center justify-center gap-2 h-9 text-[12px] font-bold text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
          onClick={() => reactMut.mutate("like")}
        >
          <Heart className={`h-4 w-4 ${post.reactions?.some((r: any) => r.user_id === post.user_id) ? "fill-[#1877F2] text-[#1877F2]" : "text-gray-500"}`} /> 
          {t("লাইক", "Like")}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 h-9 text-[12px] font-bold text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
          <MessageSquare className="h-4 w-4 text-gray-500" /> {t("মন্তব্য", "Comment")}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 h-9 text-[12px] font-bold text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
          <Share2 className="h-4 w-4 text-gray-500" /> {t("শেয়ার", "Share")}
        </button>
      </div>
    </div>
  );
}

function Menu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  );
}

function formatPostTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString();
}
