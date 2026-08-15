import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Bell, Image as ImageIcon, Share2, MoreHorizontal, Heart, Smile, MessageSquare, Video, Globe, Users, Clock, Camera, Home, Menu as MenuIcon } from "lucide-react";
import { listPosts, createPost, reactToPost } from "@/lib/news-feed.functions";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";

export function NewsFeedPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [postBody, setPostBody] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => listPosts(),
  });

  const createMut = useMutation({
    mutationFn: (body: string) => createPost({ data: { body, mediaUrls: [] } }),
    onSuccess: () => {
      setPostBody("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("পোস্ট করা হয়েছে", "Posted successfully"));
    },
  });

  return (
    <div className="flex flex-col min-h-screen bg-gray-200 pb-20">
      {/* Top Header - Facebook Messenger Style */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-4 py-2 flex flex-col gap-2">
          {/* Top Row: Back to Dashboard & Logo */}
          <div className="flex items-center justify-between">
            <Link 
              to="/home" 
              className="flex items-center gap-1.5 text-[#1877F2] font-black text-sm btn-press"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            
            <h1 className="text-xl font-black text-[#1877F2] tracking-tighter">Good-App Social</h1>
            
            <div className="w-10" /> {/* Spacer */}
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessengerAvatar name="Me" size="sm" />
              <h2 className="text-2xl font-black text-navy tracking-tight">{t("ফিড", "Feed")}</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press text-gray-600">
                <Search className="h-5 w-5" />
              </button>
              <button 
                onClick={() => navigate({ to: "/social/messenger" as any })}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press relative text-gray-600"
              >
                <MessageSquare className="h-5 w-5" />
                <span className="absolute top-0 right-0 h-4 w-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">2</span>
              </button>
              <button 
                onClick={() => navigate({ to: "/social/profile" as any })}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press text-gray-600"
              >
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full space-y-2 py-2">
        {/* Post Composer */}
        <div className="bg-white p-3 shadow-sm">
          <div className="flex gap-2">
            <MessengerAvatar name="Me" size="md" />
            <button 
              onClick={() => {}} 
              className="flex-1 text-left px-4 py-2 bg-gray-100 rounded-full text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {t("আপনার মনে কি চলছে?", "What's on your mind?") }
            </button>
            <div className="flex items-center px-2">
              <ImageIcon className="h-6 w-6 text-green-500" />
            </div>
          </div>
          <div className="flex border-t mt-3 pt-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-1 text-[12px] font-bold text-gray-600">
              <Video className="h-4 w-4 text-rose-500" /> {t("লাইভ", "Live")}
            </button>
            <div className="w-px bg-gray-100" />
            <button className="flex-1 flex items-center justify-center gap-2 py-1 text-[12px] font-bold text-gray-600">
              <ImageIcon className="h-4 w-4 text-green-500" /> {t("ছবি", "Photo")}
            </button>
            <div className="w-px bg-gray-100" />
            <button className="flex-1 flex items-center justify-center gap-2 py-1 text-[12px] font-bold text-gray-600">
              <Video className="h-4 w-4 text-purple-500" /> {t("রুম", "Room")}
            </button>
          </div>
        </div>

        {/* Stories - Horizontal Scroll */}
        <div className="bg-white py-3 shadow-sm overflow-hidden">
          <div className="flex gap-2 px-3 overflow-x-auto no-scrollbar">
            <div className="shrink-0 w-24 h-40 rounded-xl bg-gray-100 border relative overflow-hidden group btn-press">
              <div className="absolute inset-0 bg-gray-200" />
              <div className="absolute bottom-0 left-0 right-0 bg-white pt-6 pb-2 px-2 text-center">
                <p className="text-[10px] font-bold text-gray-900 leading-tight">Create Story</p>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1877F2] border-4 border-white flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="shrink-0 w-24 h-40 rounded-xl bg-gray-200 border relative overflow-hidden group btn-press">
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
                <div className="absolute top-2 left-2 w-8 h-8 rounded-full border-2 border-[#1877F2] overflow-hidden">
                  <div className="w-full h-full bg-gray-300" />
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">Friend {i}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Posts */}
        {isLoading ? (
          <div className="py-10 flex justify-center"><Plus className="w-6 h-6 animate-spin text-[#1877F2]" /></div>
        ) : (
          <div className="space-y-2">
            {(posts as any)?.posts?.map((post: any) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export function PostCard({ post }: { post: any }) {
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
