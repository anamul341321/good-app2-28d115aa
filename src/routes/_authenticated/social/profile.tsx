import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAppStatus } from "@/lib/app-status.functions";
import { MaintenanceScreen } from "@/components/MaintenanceGate";
import { useAuth } from "@/hooks/useAuth";
import { listPosts } from "@/lib/news-feed.functions";
import { MessengerNav } from "@/components/messenger/MessengerNav";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { Home, MessageSquare, Video, Settings, Camera, Sparkles, Image as ImageIcon, Plus, Loader2, ChevronLeft } from "lucide-react";
import { PostCard } from "@/components/social/NewsFeedPage";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";
import { getDashboard } from "@/lib/dashboard.functions";

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
  const { user } = useAuth();
  const { t } = useLang();
  
  const { data: appStatus } = useQuery({
    queryKey: ["app-status"],
    queryFn: () => getAppStatus(),
    staleTime: 30_000,
  });

  const { data: dashData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
    staleTime: 60_000,
  });

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: () => listPosts(),
    enabled: !!user,
  });

  if (appStatus?.maintenance) return <MaintenanceScreen message={appStatus.message} />;
  if (!user) return null;

  // Filter posts for this user only
  const posts = (postsData as any)?.posts ?? [];
  const myPosts = posts.filter((p: any) => p.user_id === user.id) ?? [];
  const monthlyRate = (dashData?.mining as any)?.monthly_rate ?? 500;

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
            <div className="p-1 bg-white rounded-full shadow-xl">
              <MessengerAvatar 
                name={user.user_metadata?.display_name || user.email?.split("@")[0] || "User"} 
                size="xl" 
                className="w-32 h-32 border-4 border-white"
              />
            </div>
            
            <h1 className="mt-3 text-2xl font-black text-navy text-center leading-tight">
              {user.user_metadata?.display_name || user.email?.split("@")[0]}
            </h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
              UID {user.user_metadata?.uid_seq || "-"}
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
                <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("স্ট্যাটাস", "Status")}</p>
                <p className={`text-sm font-black ${dashData?.mining?.is_active ? "text-emerald" : "text-rose"}`}>
                  {dashData?.mining?.is_active ? t("সক্রিয়", "Active") : t("নিষ্ক্রিয়", "Inactive")}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-2 max-w-md mx-auto">
            <button className="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-2.5 rounded-xl font-black text-sm btn-press">
              <Plus className="w-4 h-4" /> Add Story
            </button>
            <button className="flex items-center justify-center gap-2 bg-gray-100 text-navy py-2.5 rounded-xl font-black text-sm btn-press">
              <Settings className="w-4 h-4" /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Posts Section */}
      <main className="flex-1 max-w-md mx-auto w-full px-2 py-4 space-y-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <h2 className="text-lg font-black text-navy mb-4">আপনার পোস্টসমূহ</h2>
          
          {postsLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : myPosts.length === 0 ? (
            <div className="py-12 text-center">
              <div className="h-16 w-16 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-sm font-bold text-gray-400">আপনি এখনো কোনো পোস্ট করেননি</p>
              <Link to="/social" className="mt-4 inline-block text-[#1877F2] font-black text-xs uppercase tracking-wider">ফিড এ যান</Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myPosts.map((post: any) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* MessengerNav is now in SocialLayout */}
    </div>
  );
}
