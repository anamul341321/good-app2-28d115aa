import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";
import { useAuth } from "@/hooks/useAuth";
import { listPosts, getProfileById } from "@/lib/news-feed.functions";
import { MessengerNav } from "@/components/messenger/MessengerNav";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { Home, MessageSquare, Video, Settings, Camera, Sparkles, Image as ImageIcon, Plus, Loader2, ChevronLeft } from "lucide-react";
import { PostCard } from "@/components/social/NewsFeedPage";
import { useLang } from "@/lib/i18n";
import { getDashboard } from "@/lib/dashboard.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import React from "react";

export const Route = createFileRoute("/_authenticated/social/profile")({
  validateSearch: (search) => z.object({
    userId: z.string().uuid().optional(),
  }).parse(search),
  component: SocialProfilePage,
  head: () => ({
    meta: [
      { title: "Good-App Social · প্রোফাইল" },
      { name: "description", content: "আপনার Good-App Social প্রোফাইল দেখুন।" },
      { property: "og:title", content: "প্রোফাইল · Good-App Social" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function SocialProfilePage() {
  const { user: authUser } = useAuth();
  const { userId: targetUserId } = Route.useSearch();
  const { t } = useLang();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const isOwnProfile = !targetUserId || targetUserId === authUser?.id;
  const effectiveUserId = targetUserId || authUser?.id;

  const { data: profileData } = useQuery({
    queryKey: ["profile", effectiveUserId],
    queryFn: () => getProfileById({ data: { userId: effectiveUserId! } }),
    enabled: !!effectiveUserId,
  });

  const profile = isOwnProfile ? authUser?.user_metadata : profileData?.profile;

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
    queryKey: ["posts"],
    queryFn: () => listPosts(),
    enabled: !!effectiveUserId,
  });


  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;
  if (!authUser) return null;

  // Filter posts for this user only
  const posts = (postsData as any)?.posts ?? [];
  const userPosts = posts.filter((p: any) => p.user_id === effectiveUserId) ?? [];
  const monthlyRate = (dashData?.mining as any)?.monthly_rate ?? 500;

  const handleProfileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isOwnProfile) return;
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { uploadMedia } = await import("@/components/social/SocialComponents");
      const url = await uploadMedia(file);
      
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: url }
      });

      if (error) throw error;
      
      toast.success(t("প্রোফাইল ছবি আপডেট করা হয়েছে", "Profile picture updated"));
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (err: any) {
      toast.error(t("আপলোড ব্যর্থ হয়েছে", "Upload failed"));
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col min-h-screen bg-gray-100 pb-20">
      {/* Premium Profile Header */}
      <div className="bg-white border-b shadow-sm overflow-hidden">
        {/* Cover Photo Area */}
        <div className="h-48 bg-gradient-to-br from-[#1877F2] to-[#3B82F6] relative">
          <Link 
            to="/social" 
            className="absolute top-4 left-4 h-9 w-9 flex items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md btn-press z-20"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button className="h-9 w-9 flex items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md btn-press">
              <Camera className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Profile Details Container */}
        <div className="px-4 pb-4 -mt-12 relative z-10">
          <div className="flex flex-col items-center">
            <div className="p-1 bg-white rounded-full shadow-xl relative group">
              <MessengerAvatar 
                src={profile?.avatar_url}
                name={profile?.display_name || profile?.email?.split("@")[0] || "User"} 
                size="xl" 
                className="w-32 h-32 border-4 border-white"
              />
              {isOwnProfile && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 h-8 w-8 bg-[#1877F2] text-white rounded-full flex items-center justify-center border-2 border-white btn-press"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}
            </div>
            
            <h1 className="mt-3 text-2xl font-black text-navy text-center leading-tight">
              {profile?.display_name || profile?.email?.split("@")[0]}
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              UID {profile?.uid_seq || "-"}
            </p>
          </div>

          {/* Mining Info Card - Premium Look */}
          <div className="mt-6 mx-auto max-w-sm rounded-2xl bg-gradient-to-br from-emerald/10 to-emerald/5 border border-emerald/20 p-4">
             <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald/20 flex items-center justify-center text-emerald">
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

          </div>

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2 max-w-md mx-auto">
            {isOwnProfile ? (
              <>
                <button 
                  onClick={() => navigate({ to: "/social" as any })}
                  className="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 rounded-xl font-black text-sm btn-press"
                >
                  <Plus className="w-4 h-4" /> Add Story
                </button>
                <button 
                  onClick={() => toast.info(t("প্রোফাইল সেটিংস শীঘ্রই আসছে", "Profile settings coming soon"))}
                  className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press"
                >
                  <Settings className="w-4 h-4" /> Edit Profile
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
                  onClick={() => {
                    sendFriendRequest({ data: { friendId: effectiveUserId! } })
                      .then(() => toast.success(t("রিকোয়েস্ট পাঠানো হয়েছে", "Request sent")))
                      .catch((e) => toast.error(e.message));
                  }}
                  className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press"
                >
                  <Plus className="w-4 h-4" /> Add Friend
                </button>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Posts Section */}
      <main className="flex-1 max-w-md mx-auto w-full px-2 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-lg font-black text-navy mb-4">
            {isOwnProfile ? "আপনার পোস্টসমূহ" : `${profile?.display_name || "User"}-এর পোস্টসমূহ`}
          </h2>
          
          {postsLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : userPosts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-16 w-16 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-400">কোনো পোস্ট খুঁজে পাওয়া যায়নি</p>
              <Link to="/social" className="mt-4 inline-block text-[#1877F2] font-black text-xs uppercase tracking-wider">ফিড এ যান</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {userPosts.map((post: any) => (
                <PostCard key={post.id} post={post} currentUser={authUser} />
              ))}
            </div>
          )}
        </div>
      </main>
      
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProfileUpload} />
    </div>
  );
}
