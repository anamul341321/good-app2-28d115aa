import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Video, Users, Play } from "lucide-react";
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
  const queryClient = useQueryClient();

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
    queryFn: () => getUploadedLongVideos(1, 50),
  });

  const channelVideos = (videosResult?.videos || []).filter((v) => v.uploader_user_id === userId);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("no user");
      return toggleChannelSubscription(user.id, userId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["channel-stats", userId, user?.id] }),
    onError: () => toast.error("সাবস্ক্রাইব করা যায়নি"),
  });

  const avatarUrl = useFeedMedia(profile?.avatar_url || undefined);

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm font-bold text-muted-foreground">চ্যানেল পাওয়া যায়নি</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="h-28 w-full bg-gradient-to-r from-primary/30 to-primary/10" />
      <div className="mx-auto max-w-3xl px-4">
        <div className="-mt-10 flex items-end justify-between">
          <MessengerAvatar name={profile.display_name || "User"} src={avatarUrl} size="xl" className="ring-4 ring-background" />
          {user && user.id !== userId && (
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
            <Video className="h-3.5 w-3.5" /> {stats?.total_videos ?? 0} ভিডিও
          </span>
        </div>

        <section className="mt-6">
          <h2 className="mb-3 text-sm font-black text-foreground">ভিডিওসমূহ</h2>
          {videosLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : channelVideos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">এখনো কোনো ভিডিও নেই</p>
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
