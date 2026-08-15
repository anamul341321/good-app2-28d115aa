import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Bell, Image as ImageIcon, Share2, MoreHorizontal, Heart, Smile, MessageSquare, Video, Globe, ChevronLeft, Trash2 } from "lucide-react";
import { listPosts, listStories, reactToPost, deletePost, listNotifications } from "@/lib/news-feed.functions";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { useAuth } from "@/hooks/useAuth";
import { PostComposer, StoryCreator, StoryViewer, ReactionSelector, CommentSection } from "./SocialComponents";

export function NewsFeedPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isStoryCreatorOpen, setIsStoryCreatorOpen] = useState(false);
  const [viewingStoryIndex, setViewingStoryIndex] = useState<number | null>(null);

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => listPosts(),
  });

  const { data: storiesData } = useQuery({
    queryKey: ["stories"],
    queryFn: () => listStories(),
  });

  const { data: notificationsData } = useQuery({
    queryKey: ["social-notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 30000,
  });

  const unreadNotifCount = (notificationsData as any)?.notifications?.filter((n: any) => !n.read_at).length || 0;

  const posts = (postsData as any)?.posts || [];
  const stories = (storiesData as any)?.stories || [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-200 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm pt-[env(safe-area-inset-top)]">
        <div className="max-w-md mx-auto px-4 py-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-1.5 text-[#1877F2] font-black text-sm btn-press">
              <ChevronLeft className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>
            <h1 className="text-xl font-black text-[#1877F2] tracking-tighter">Good-App Social</h1>
            <div className="w-10" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate({ to: "/social/profile" as any })} className="btn-press">
                <MessengerAvatar src={user?.user_metadata?.avatar_url} name={user?.user_metadata?.display_name || "Me"} size="sm" />
              </button>
              <h2 className="text-2xl font-black text-navy tracking-tight">{t("ফিড", "Feed")}</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate({ to: "/social/search" as any })}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press text-gray-600"
              >
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
                onClick={() => navigate({ to: "/social/notifications" as any })}
                className="h-9 w-9 flex items-center justify-center rounded-full bg-gray-100 btn-press relative text-gray-600"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0 right-0 h-4 w-4 bg-rose-500 rounded-full text-[10px] text-white flex items-center justify-center border-2 border-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full space-y-2 py-2">
        {/* Post Composer Trigger */}
        <div className="bg-white p-3 shadow-sm">
          <div className="flex gap-2">
            <MessengerAvatar src={user?.user_metadata?.avatar_url} name="Me" size="md" />
            <button 
              onClick={() => setIsComposerOpen(true)} 
              className="flex-1 text-left px-4 py-2 bg-gray-100 rounded-full text-gray-500 text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {t("আপনার মনে কি চলছে?", "What's on your mind?") }
            </button>
            <div className="flex items-center px-2">
              <ImageIcon className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </div>

        {/* Stories */}
        <div className="bg-white py-3 shadow-sm overflow-hidden">
          <div className="flex gap-2 px-3 overflow-x-auto no-scrollbar">
            <div 
              onClick={() => setIsStoryCreatorOpen(true)}
              className="shrink-0 w-24 h-40 rounded-xl bg-gray-100 border relative overflow-hidden group btn-press cursor-pointer"
            >
              <div className="absolute inset-0 bg-gray-200" />
              <div className="absolute bottom-0 left-0 right-0 bg-white pt-6 pb-2 px-2 text-center">
                <p className="text-[10px] font-bold text-gray-900 leading-tight">Create Story</p>
              </div>
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#1877F2] border-4 border-white flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
            </div>
            
            {stories.map((story: any, idx: number) => (
              <div 
                key={story.id} 
                onClick={() => setViewingStoryIndex(idx)}
                className="shrink-0 w-24 h-40 rounded-xl bg-gray-200 border relative overflow-hidden group btn-press cursor-pointer"
              >
                <img src={story.media_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
                <div className="absolute top-2 left-2 w-8 h-8 rounded-full border-2 border-[#1877F2] overflow-hidden">
                  <MessengerAvatar src={story.author?.avatar_url} name={story.author?.display_name} size="sm" />
                </div>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-[10px] font-bold text-white leading-tight line-clamp-2">{story.author?.display_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Posts */}
        {postsLoading ? (
          <div className="py-10 flex justify-center"><Plus className="w-6 h-6 animate-spin text-[#1877F2]" /></div>
        ) : (
          <div className="space-y-2">
            {posts.map((post: any) => (
              <PostCard key={post.id} post={post} currentUser={user} />
            ))}
          </div>
        )}
      </main>

      {/* Modals */}
      {isComposerOpen && <PostComposer onClose={() => setIsComposerOpen(false)} author={user?.user_metadata} />}
      {isStoryCreatorOpen && <StoryCreator onClose={() => setIsStoryCreatorOpen(false)} />}
      {viewingStoryIndex !== null && (
        <StoryViewer 
          stories={stories} 
          initialIndex={viewingStoryIndex} 
          onClose={() => setViewingStoryIndex(null)} 
        />
      )}
    </div>
  );
}

export function PostCard({ post, currentUser }: { post: any, currentUser: any }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const reactMut = useMutation({
    mutationFn: (type: string) => reactToPost({ data: { postId: post.id, reactionType: type } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deletePost({ data: { postId: post.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("পোস্ট মুছে ফেলা হয়েছে", "Post deleted"));
    },
  });

  const myReaction = post.reactions?.find((r: any) => r.user_id === currentUser?.id);
  const reactionCount = post.reactions?.length || 0;

  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      {/* Post Header */}
      <div className="p-3 flex items-start gap-2">
        <button 
          onClick={() => navigate({ to: `/social/profile` as any, search: { userId: post.user_id } as any })}
          className="btn-press"
        >
          <MessengerAvatar src={post.author?.avatar_url} name={post.author?.display_name || "User"} size="md" />
        </button>
        <div className="flex-1 min-w-0">
          <button 
            onClick={() => navigate({ to: `/social/profile` as any, search: { userId: post.user_id } as any })}
            className="font-bold text-sm text-gray-900 leading-none text-left"
          >
            {post.author?.display_name || "User"}
          </button>
          <div className="flex items-center gap-1 mt-1">
            <p className="text-[11px] text-gray-500 font-medium">{formatPostTime(post.created_at)}</p>
            <span className="text-[11px] text-gray-400">·</span>
            <Globe className="h-3 w-3 text-gray-400" />
          </div>
        </div>
        
        {post.user_id === currentUser?.id && (
          <button 
            onClick={() => { if(confirm(t("আপনি কি নিশ্চিত?", "Are you sure?"))) deleteMut.mutate(); }}
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-rose-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Post Body */}
      <div className="px-3 pb-3">
        <p className="text-[14px] text-gray-900 whitespace-pre-line leading-snug">{post.body}</p>
      </div>

      {/* Media */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="bg-gray-100">
          <div className={`grid gap-0.5 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {post.media_urls.map((url: string, i: number) => (
              <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-100 mx-1">
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-[#1877F2] flex items-center justify-center text-white ring-1 ring-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
            </div>
            <div className="h-4 w-4 rounded-full bg-rose-500 flex items-center justify-center text-white ring-1 ring-white">
              <Heart className="h-2.5 w-2.5 fill-current" />
            </div>
          </div>
          <span className="text-[12px] text-gray-500 font-medium">{reactionCount}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-gray-500 font-medium">
          {post.comments?.length > 0 && <span>{post.comments.length} {t("মন্তব্য", "Comments")}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center px-1 py-1 relative">
        <div className="flex-1 relative">
          <button 
            className={`w-full flex items-center justify-center gap-2 h-9 text-[12px] font-bold ${myReaction ? "text-[#1877F2]" : "text-gray-600"} hover:bg-gray-50 rounded-md transition-colors`}
            onMouseEnter={() => setShowReactions(true)}
            onClick={() => reactMut.mutate("like")}
          >
            <Heart className={`h-4 w-4 ${myReaction ? "fill-current" : ""}`} /> 
            {t(myReaction ? myReaction.reaction_type : "লাইক", myReaction ? myReaction.reaction_type : "Like")}
          </button>
          {showReactions && (
            <div onMouseLeave={() => setShowReactions(false)}>
              <ReactionSelector onSelect={(type) => { reactMut.mutate(type); setShowReactions(false); }} />
            </div>
          )}
        </div>
        <button 
          onClick={() => setShowComments(!showComments)}
          className="flex-1 flex items-center justify-center gap-2 h-9 text-[12px] font-bold text-gray-600 hover:bg-gray-50 rounded-md transition-colors"
        >
          <MessageSquare className="h-4 w-4" /> {t("মন্তব্য", "Comment")}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 h-9 text-[12px] font-bold text-gray-600 hover:bg-gray-50 rounded-md transition-colors">
          <Share2 className="h-4 w-4" /> {t("শেয়ার", "Share")}
        </button>
      </div>

      {showComments && <CommentSection post={post} onPostComment={() => {}} />}
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