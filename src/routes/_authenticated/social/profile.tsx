import React, { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  MessageSquare, 
  UserPlus, 
  UserCheck, 
  Settings, 
  MoreHorizontal,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Plus,
  Camera
} from "lucide-react";
import { listPosts, getProfileById } from "@/lib/news-feed.functions";
import { getProfileStats, sendFriendRequest, acceptFriendRequest } from "@/lib/social-users.functions";
import { MessengerNav } from "@/components/messenger/MessengerNav";
import { getAppStatus } from "@/lib/dashboard.functions";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useLang } from "@/lib/i18n";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/social/profile")({
  validateSearch: (search) => z.object({
    userId: z.string().optional(),
  }).parse(search),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { userId: searchUserId } = Route.useSearch();
  
  const effectiveUserId = searchUserId || authUser?.id;
  const isOwnProfile = effectiveUserId === authUser?.id;

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["social-profile", effectiveUserId],
    queryFn: () => getProfileById({ data: { userId: effectiveUserId! } }),
    enabled: !!effectiveUserId && !isOwnProfile,
  });

  const profile = isOwnProfile ? {
    id: authUser?.id,
    display_name: authUser?.user_metadata?.display_name || authUser?.email?.split('@')[0],
    avatar_url: authUser?.user_metadata?.avatar_url,
    uid_seq: authUser?.user_metadata?.uid_seq
  } : profileData?.profile;

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", effectiveUserId],
    queryFn: () => getProfileStats({ data: { userId: effectiveUserId! } }),
    enabled: !!effectiveUserId,
  });

  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 30_000,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["posts-profile", effectiveUserId],
    queryFn: () => listPosts(),
    enabled: !!effectiveUserId,
  });

  const sendFriendMutation = useMutation({
    mutationFn: (friendId: string) => sendFriendRequest({ data: { friendId } }),
    onSuccess: () => {
      toast.success(t("রিকোয়েস্ট পাঠানো হয়েছে", "Friend request sent"));
      queryClient.invalidateQueries({ queryKey: ["social-profile", effectiveUserId] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  if (profileLoading || !effectiveUserId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const monthlyRate = stats?.monthlyRate || 0;
  const verifiedCount = stats?.verifiedCount || 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F2F5] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: "/social" })} className="p-1 btn-press">
            <ArrowLeft className="w-6 h-6 text-navy" />
          </button>
          <h1 className="font-black text-navy text-lg">{profile?.display_name || "Profile"}</h1>
        </div>
        <div className="flex items-center gap-2">
          {isOwnProfile ? (
            <button className="p-2 bg-gray-100 rounded-full btn-press">
              <Settings className="w-5 h-5 text-navy" />
            </button>
          ) : (
            <button className="p-2 bg-gray-100 rounded-full btn-press">
              <MoreHorizontal className="w-5 h-5 text-navy" />
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 w-full max-w-md mx-auto">
        {/* Profile Card */}
        <div className="bg-white pb-6 shadow-sm">
          {/* Cover Photo Placeholder */}
          <div className="h-40 bg-gradient-to-r from-primary/20 to-emerald/20 relative">
            {isOwnProfile && (
              <button className="absolute bottom-3 right-3 bg-white/80 backdrop-blur p-2 rounded-lg shadow-sm btn-press">
                <Camera className="w-4 h-4 text-navy" />
              </button>
            )}
          </div>
          
          <div className="px-4 -mt-16 flex flex-col items-center">
            <div className="relative">
              <MessengerAvatar 
                src={profile?.avatar_url} 
                name={profile?.display_name} 
                size="2xl" 
                className="border-4 border-white shadow-md ring-1 ring-gray-100"
              />
              {isOwnProfile && (
                <button className="absolute bottom-1 right-1 bg-gray-100 p-2 rounded-full border-2 border-white shadow-sm btn-press">
                  <Camera className="w-4 h-4 text-navy" />
                </button>
              )}
            </div>
            
            <div className="mt-3 text-center">
              <h2 className="text-2xl font-black text-navy leading-tight">{profile?.display_name || "User"}</h2>
              <p className="text-sm font-bold text-muted-foreground mt-1 flex items-center justify-center gap-1">
                UID {profile?.uid_seq} • <ShieldCheck className="w-3.5 h-3.5 text-emerald" /> Verified Account
              </p>
            </div>

            {/* Mining Stats Mini Card */}
            <div className="mt-5 w-full bg-gray-50 rounded-2xl p-4 border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald/10 text-emerald flex items-center justify-center">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald uppercase tracking-wider">{t("মাসিক মাইনিং রেট", "Monthly Rate")}</p>
                  <p className="text-lg font-black text-navy leading-none">
                    ৳{monthlyRate} / মাস
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("ভেরিফাইড", "Verified")}</p>
                <p className="text-sm font-black text-emerald">
                  {verifiedCount} Slots
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 w-full grid grid-cols-2 gap-3">
              {isOwnProfile ? (
                <>
                  <button className="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 rounded-xl font-black text-sm shadow-sm btn-press col-span-2">
                    <Plus className="w-4 h-4" /> Add to Story
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press">
                    <Settings className="w-4 h-4" /> Edit Profile
                  </button>
                  <button className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press">
                    <MoreHorizontal className="w-4 h-4" /> More
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => navigate({ to: `/social/messenger` as any, search: { peerId: effectiveUserId } as any })}
                    className="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 rounded-xl font-black text-sm btn-press"
                  >
                    <MessageSquare className="w-4 h-4" /> Message
                  </button>
                  <button 
                    disabled={sendFriendMutation.isPending}
                    onClick={() => sendFriendMutation.mutate(effectiveUserId!)}
                    className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press disabled:opacity-50"
                  >
                    {sendFriendMutation.isPending ? "..." : <><UserPlus className="w-4 h-4" /> Add Friend</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Profile Content Tabs Placeholder */}
        <div className="mt-2 bg-white px-4 py-3 flex items-center justify-around border-y text-sm font-bold text-muted-foreground">
          <button className="text-primary border-b-2 border-primary pb-1">Posts</button>
          <button>Photos</button>
          <button>Friends</button>
        </div>

        {/* Local Posts */}
        <div className="mt-2 space-y-2">
          {postsLoading ? (
            <div className="flex justify-center p-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            postsData?.posts.map((post: any) => (
              <div key={post.id} className="bg-white p-4 shadow-sm border-b">
                {/* Minimal Post Row */}
                <div className="flex gap-3">
                  <MessengerAvatar src={post.author?.avatar_url} name={post.author?.display_name} size="md" />
                  <div>
                    <p className="font-black text-navy">{post.author?.display_name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-navy">{post.body}</p>
              </div>
            ))
          )}
        </div>
      </main>

      <MessengerNav />
    </div>
  );
}
