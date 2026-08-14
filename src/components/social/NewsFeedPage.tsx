import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Bell, Menu, User, Image as ImageIcon, MessageCircle, Share2, MoreHorizontal, Send, Heart, Smile, Frown, Angry, MessageSquare } from "lucide-react";
import { listPosts, createPost, reactToPost } from "@/lib/news-feed.functions";
import { useLang } from "@/lib/i18n";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export function NewsFeedPage() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: postsData, isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => listPosts(),
    refetchInterval: 30000,
  });

  const posts = postsData?.posts ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-surface-2 pb-20">
      <header className="sticky top-0 z-40 bg-background border-b px-4 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-primary tracking-tight">good-app</h1>
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 btn-press">
              <Search className="h-5 w-5" />
            </button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 btn-press">
              <Plus className="h-5 w-5" />
            </button>
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 btn-press">
              <Bell className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full space-y-2 pt-2">
        {/* Composer */}
        <div className="bg-background p-4 shadow-sm border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-surface-2 border overflow-hidden shrink-0" />
            <button 
              className="flex-1 h-10 px-4 rounded-full bg-surface-2 text-muted-foreground text-sm font-medium text-left active:bg-surface-3 transition-colors"
              onClick={() => toast.info("Post creation coming soon")}
            >
              {t("আপনি কী ভাবছেন?", "What's on your mind?")}
            </button>
          </div>
          <div className="flex items-center gap-1 mt-3 pt-3 border-t">
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors">
              <ImageIcon className="h-4 w-4 text-emerald" /> {t("ছবি", "Photo")}
            </button>
            <div className="w-px h-4 bg-border" />
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors">
              <Plus className="h-4 w-4 text-violet" /> {t("লাইভ", "Live")}
            </button>
            <div className="w-px h-4 bg-border" />
            <button className="flex-1 flex items-center justify-center gap-2 h-9 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors">
              <Smile className="h-4 w-4 text-amber" /> {t("অনুভূতি", "Feeling")}
            </button>
          </div>
        </div>

        {/* Posts List */}
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-background p-10 text-center rounded-xl border border-dashed mx-2">
            <p className="text-sm font-bold text-muted-foreground">No posts yet. Be the first to share something!</p>
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
    <div className="bg-background shadow-sm border-b">
      <div className="p-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-surface-2 border overflow-hidden shrink-0">
          {post.author?.avatar_url && <img src={post.author.avatar_url} className="w-full h-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-sm text-foreground">{post.author?.display_name || "User"}</p>
          <p className="text-[10px] text-muted-foreground font-bold">{new Date(post.created_at).toLocaleString()}</p>
        </div>
        <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="px-4 pb-3">
        <p className="text-sm whitespace-pre-line leading-relaxed">{post.body}</p>
      </div>

      {post.media_urls && post.media_urls.length > 0 && (
        <div className="border-y bg-surface-1">
          <div className={`grid gap-0.5 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {post.media_urls.map((url: string, i: number) => (
              <img key={i} src={url} className="w-full aspect-square object-cover" />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground border-b border-surface-2">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-white ring-1 ring-background"><Heart className="h-2 w-2 fill-current" /></div>
            <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center text-[8px] text-white ring-1 ring-background"><Smile className="h-2 w-2 fill-current" /></div>
          </div>
          <span>{post.reactions?.length || 0}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{post.comment_count?.length || 0} {t("মন্তব্য", "Comments")}</span>
          <span>0 {t("শেয়ার", "Shares")}</span>
        </div>
      </div>

      <div className="flex items-center px-2 py-1">
        <button 
          className="flex-1 flex items-center justify-center gap-2 h-10 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors"
          onClick={() => reactMut.mutate("like")}
        >
          <Heart className={`h-4 w-4 ${post.reactions?.some((r: any) => r.reaction_type === "like") ? "fill-rose-500 text-rose-500" : ""}`} /> 
          {t("লাইক", "Like")}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 h-10 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors">
          <MessageSquare className="h-4 w-4" /> {t("মন্তব্য", "Comment")}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 h-10 text-xs font-black text-muted-foreground hover:bg-surface-2 rounded-lg transition-colors">
          <Share2 className="h-4 w-4" /> {t("শেয়ার", "Share")}
        </button>
      </div>
    </div>
  );
}
