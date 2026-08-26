import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Video, Users, Play, ArrowLeft, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getChannelStats,
  toggleChannelSubscription,
  getUploadedLongVideos,
  type ExternalReelVideo,
} from "@/lib/feed-api";
import { useFeedMedia } from "@/lib/feed-media";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { Button } from "@/components/ui/button";


export const Route = createFileRoute("/_authenticated/channel/$userId")({
  component: ChannelPage,
  head: () => ({
    meta: [
      { title: "চ্যানেল — good-app" },
      {
        name: "description",
        content: "এই ব্যবহারকারীর সব ভিডিও দেখুন এবং সাবস্ক্রাইব করুন — good-app চ্যানেল।",
      },
      { property: "og:title", content: "চ্যানেল — good-app" },
      {
        property: "og:description",
        content: "এই ব্যবহারকারীর সব ভিডিও দেখুন এবং সাবস্ক্রাইব করুন — good-app চ্যানেল।",
      },
      { property: "og:type", content: "profile" },
    ],
  }),
});

function ChannelPage() {
  const { userId } = useParams({ from: "/_authenticated/channel/$userId" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwner = user?.id === userId;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["channel-profile", userId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, avatar_url, is_verified_badge")
        .eq("id", userId)
        .single();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["channel-stats", userId, user?.id],
    queryFn: () => getChannelStats(userId, user?.id),
  });

  const { data: videosResult, isLoading: videosLoading } = useQuery({
    queryKey: ["channel-videos", userId],
    queryFn: () => getUploadedLongVideos(1, 50, undefined, userId),
  });

  const channelVideos = videosResult?.videos || [];

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      return toggleChannelSubscription(user.id, userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channel-stats", userId, user?.id] }),
    onError: () => toast.error("সাবস্ক্রাইব করা যায়নি"),
  });

  const avatarUrl = useFeedMedia(profile?.avatar_url || undefined);

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
    else void navigate({ to: "/feed" });
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
        <p className="text-sm font-bold text-muted-foreground">চ্যানেল পাওয়া যায়নি</p>
        <Button variant="secondary" onClick={goBack}>
          <ArrowLeft className="mr-1 h-4 w-4" /> ফিরে যান
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 safe-top flex items-center justify-between border-b border-border/40 bg-background/95 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={goBack}
          aria-label="ফিরে যান"
          className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-sm font-black tracking-tight text-foreground">good-app চ্যানেল</span>
        <Button
          size="sm"
          className="h-9 rounded-full bg-red-600 px-3 text-[12.5px] font-black text-white hover:bg-red-700"
          onClick={() => navigate({ to: "/studio" })}
        >
          <UploadCloud className="mr-1 h-4 w-4" /> আপলোড
        </Button>
      </header>

      <div className="h-28 w-full bg-gradient-to-r from-primary/30 to-primary/10" />
      <div className="mx-auto max-w-3xl px-4">
        <div className="-mt-10 flex items-end justify-between">
          <MessengerAvatar name={profile.display_name || "User"} src={avatarUrl} size="xl" className="ring-4 ring-background" />
          {user && !isOwner && (
            <Button
              variant={stats?.is_subscribed ? "secondary" : "default"}
              onClick={() => subscribeMutation.mutate()}
              disabled={subscribeMutation.isPending}
            >
              {stats?.is_subscribed ? "সাবস্ক্রাইব করা আছে" : "সাবস্ক্রাইব"}
            </Button>
          )}
        </div>

        <h1 className="mt-3 text-xl font-black text-foreground">{profile.display_name || "User"}</h1>
        <div className="mt-1 flex items-center gap-4 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {(stats?.subscriber_count ?? 0).toLocaleString()} সাবস্ক্রাইবার
          </span>
          <span className="flex items-center gap-1">
            <Video className="h-3.5 w-3.5" /> {channelVideos.length || stats?.total_videos || 0} ভিডিও
          </span>
        </div>

        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-black text-foreground">ভিডিওসমূহ</h2>
            {isOwner ? (
              <Button
                size="sm"
                variant="secondary"
                className="h-8 rounded-full px-3 text-[12px] font-black"
                onClick={() => navigate({ to: "/studio" })}
              >
                <UploadCloud className="mr-1 h-4 w-4" /> নতুন ভিডিও
              </Button>
            ) : null}
          </div>
          {videosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channelVideos.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <p className="text-sm text-muted-foreground">এখনো কোনো ভিডিও নেই</p>
              {isOwner ? (
                <Button
                  className="rounded-full bg-red-600 px-5 font-black text-white hover:bg-red-700"
                  onClick={() => navigate({ to: "/studio" })}
                >
                  <UploadCloud className="mr-1 h-4 w-4" /> ভিডিও আপলোড করুন
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {channelVideos.map((v) => (
                <ChannelVideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}

function ChannelVideoCard({ video }: { video: ExternalReelVideo }) {
  const thumb = useFeedMedia(video.thumbnail_url || undefined);
  return (
    <Link to="/watch/$postId" params={{ postId: video.local_post_id as string }} className="block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        {thumb ? (
          <img src={thumb} alt={video.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Play className="h-6 w-6" />
          </div>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-bold text-foreground">{video.title}</p>
    </Link>
  );
}
