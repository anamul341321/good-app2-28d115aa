import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, Loader2, Maximize2, Minimize2, Send, ThumbsUp, Users } from "lucide-react";
import { PageBackHeader } from "@/components/PageBackHeader";
import {
  getUploadedLongVideoByPostId,
  getUploadedLongVideos,
  getBangladeshExternalVideos,
  getChannelStats,
  toggleChannelSubscription,
  getLocalVideoEngagement,
  toggleLike,
  getPostComments,
  addComment,
  type ExternalReelVideo,
  type PostComment,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";
import { attachBackgroundAudio } from "@/lib/background-audio";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useMediaFullscreen } from "@/hooks/use-media-fullscreen";

export const Route = createFileRoute("/_authenticated/watch/$postId")({
  component: WatchPage,
  head: () => ({
    meta: [
      { title: "ভিডিও দেখুন — good-app" },
      {
        name: "description",
        content: "লম্বা ভিডিও দেখুন, লাইক করুন এবং মন্তব্য করুন — good-app ওয়াচ।",
      },
      { property: "og:title", content: "ভিডিও দেখুন — good-app" },
      {
        property: "og:description",
        content: "লম্বা ভিডিও দেখুন, লাইক করুন এবং মন্তব্য করুন — good-app ওয়াচ।",
      },
      { property: "og:type", content: "video.other" },
    ],
  }),
});

function WatchPage() {
  const { postId } = useParams({ from: "/_authenticated/watch/$postId" });
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [mediaFailed, setMediaFailed] = useState(false);
  const [mediaKey, setMediaKey] = useState(0);

  const {
    data: video,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["watch-video", postId],
    queryFn: () => getUploadedLongVideoByPostId(postId),
  });

  const videoUrl = useFeedMedia(video?.video_url);
  const thumbUrl = useFeedMedia(video?.thumbnail_url || undefined);
  const avatarUrl = useFeedMedia(video?.uploader_avatar_url || undefined);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, fallbackFullscreen, toggleFullscreen } = useMediaFullscreen(playerBoxRef);

  useEffect(() => {
    const el = playerRef.current;
    if (!el || !videoUrl) return;
    return attachBackgroundAudio(el, videoUrl, {
      title: video?.title || "good-app",
      artist: video?.creator || "good-app",
      artwork: thumbUrl || undefined,
    });
  }, [videoUrl, thumbUrl, video?.title, video?.creator]);

  const { data: engagement } = useQuery({
    queryKey: ["watch-engagement", postId],
    queryFn: () => getLocalVideoEngagement(postId),
    enabled: !!video,
  });

  const { data: channelStats } = useQuery({
    queryKey: ["watch-channel-stats", video?.uploader_user_id, user?.id],
    queryFn: () => {
      const uploaderId = video?.uploader_user_id;
      if (!uploaderId) throw new Error("ভিডিও আপলোডার পাওয়া যায়নি");
      return getChannelStats(uploaderId, user?.id);
    },
    enabled: !!video?.uploader_user_id,
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["watch-comments", postId],
    queryFn: () => getPostComments(postId, user?.id),
    enabled: !!video,
  });

  const { data: suggested } = useQuery({
    queryKey: ["watch-suggested"],
    queryFn: async () => {
      const [local, external] = await Promise.all([
        getUploadedLongVideos(1, 10),
        getBangladeshExternalVideos(1, 10, undefined, undefined, "long"),
      ]);
      return [...local.videos, ...external.videos].filter((v) => !v.id.includes(postId));
    },
    enabled: !!video,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      return toggleLike(postId, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watch-engagement", postId] }),
    onError: () => toast.error("লাইক করা যায়নি"),
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !video?.uploader_user_id) throw new Error("invalid");
      return toggleChannelSubscription(user.id, video.uploader_user_id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["watch-channel-stats", video?.uploader_user_id, user?.id],
      }),
    onError: () => toast.error("সাবস্ক্রাইব করা যায়নি"),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!user || !commentText.trim()) throw new Error("invalid");
      return addComment(postId, user.id, commentText.trim());
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["watch-comments", postId] });
    },
    onError: () => toast.error("মন্তব্য যোগ করা যায়নি"),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !video) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background">
        <p className="text-sm font-bold text-muted-foreground">ভিডিওটি পাওয়া যায়নি</p>
        <Link to="/reels" search={{}} className="text-sm font-bold text-primary">
          রিলসে ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4">
        <PageBackHeader fallbackTo="/videos" />
      </div>
      <div
        ref={playerBoxRef}
        className={
          fallbackFullscreen
            ? "fixed inset-0 z-[999] flex h-[100dvh] w-screen items-center justify-center bg-black"
            : "sticky top-0 z-20 w-full bg-black"
        }
      >
        {videoUrl && !mediaFailed ? (
          <video
            key={mediaKey}
            ref={playerRef}
            src={videoUrl}
            poster={thumbUrl}
            controls
            playsInline
            preload="metadata"
            onLoadedData={() => setMediaFailed(false)}
            onError={() => setMediaFailed(true)}
            className={
              fallbackFullscreen
                ? "h-full w-full object-contain bg-black"
                : "mx-auto aspect-video max-h-[60vh] w-full object-contain bg-black"
            }
          />
        ) : (
          <div className="flex h-[40vh] w-full items-center justify-center">
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
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={isFullscreen ? "ফুল স্ক্রিন বন্ধ করুন" : "ফুল স্ক্রিন করুন"}
          onClick={() => void toggleFullscreen()}
          className="absolute bottom-3 right-3 z-30 text-white hover:bg-black/60 hover:text-white"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-4">
        <h1 className="text-lg font-black text-foreground">{video.title}</h1>
        {video.duration ? (
          <p className="mt-1 text-xs text-muted-foreground">
            দৈর্ঘ্য: {Math.round(video.duration)} সেকেন্ড
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-y border-border py-3">
          <Link
            to="/channel/$userId"
            params={{ userId: video.uploader_user_id || "" }}
            className="flex items-center gap-3"
          >
            <MessengerAvatar name={video.creator || "Channel"} src={avatarUrl} size="lg" />
            <div>
              <p className="text-sm font-black text-foreground">{video.creator || "Unknown"}</p>
              <p className="text-xs text-muted-foreground">
                {(channelStats?.subscriber_count ?? 0).toLocaleString()} সাবস্ক্রাইবার
              </p>
            </div>
          </Link>
          {user && user.id !== video.uploader_user_id && (
            <Button
              variant={channelStats?.is_subscribed ? "secondary" : "default"}
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
            >
              {channelStats?.is_subscribed ? "সাবস্ক্রাইব করা আছে" : "সাবস্ক্রাইব"}
            </Button>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={() => likeMutation.mutate()}
            disabled={!user || likeMutation.isPending}
            className="btn-press flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-sm font-black text-foreground"
          >
            <ThumbsUp className="h-4 w-4" />
            {engagement?.likes_count ?? video.likes_count ?? 0}
          </button>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-black text-foreground">
            মন্তব্য ({engagement?.comments_count ?? video.comments_count ?? 0})
          </h2>
          {user && (
            <div className="mb-4 flex items-center gap-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="মন্তব্য লিখুন..."
                rows={1}
                className="min-h-9 flex-1 resize-none"
              />
              <Button
                size="icon"
                onClick={() => commentMutation.mutate()}
                disabled={!commentText.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          {commentsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (comments || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">এখনো কোনো মন্তব্য নেই</p>
          ) : (
            <div className="space-y-3">
              {(comments || []).map((c: PostComment) => (
                <div key={c.id} className="flex items-start gap-2">
                  <MessengerAvatar name={c.user?.display_name || "User"} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-foreground">
                      {c.user?.display_name || "User"}
                    </p>
                    <p className="text-sm text-foreground">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-black text-foreground">আরও ভিডিও</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(suggested || []).map((v) => (
              <SuggestedCard key={v.id} video={v} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SuggestedCard({ video }: { video: ExternalReelVideo }) {
  const thumb = useFeedMedia(video.thumbnail_url || undefined);
  const isLocal = video.source === "good-app" && video.local_post_id;

  const content = (
    <div className="flex gap-3">
      <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
        {thumb ? (
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Users className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold text-foreground">{video.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{video.creator || "Unknown"}</p>
      </div>
    </div>
  );

  if (isLocal) {
    return (
      <Link
        to="/watch/$postId"
        params={{ postId: video.local_post_id as string }}
        className="block"
      >
        {content}
      </Link>
    );
  }

  return (
    <a href={video.watch_url || video.video_url} target="_blank" rel="noreferrer" className="block">
      {content}
    </a>
  );
}
