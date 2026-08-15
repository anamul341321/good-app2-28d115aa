import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Bell, Heart, MessageSquare, Plus, Check, UserPlus, UserCheck, X } from "lucide-react";
import { listNotifications, markNotificationRead } from "@/lib/news-feed.functions";
import { acceptFriendRequest } from "@/lib/social-users.functions";
import { useLang } from "@/lib/i18n";

import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { format } from "date-fns";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/social/notifications")({
  component: SocialNotificationsPage,
  head: () => ({
    meta: [{ title: "Good-App Social · নোটিফিকেশন" }],
  }),
});

function SocialNotificationsPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["social-notifications"],
    queryFn: () => listNotifications(),
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-notifications"] }),
  });

  const acceptFriendMutation = useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest({ data: { requestId } }),
    onSuccess: () => {
      toast.success(t("বন্ধুত্ব গ্রহণ করা হয়েছে", "Friend request accepted"));
      queryClient.invalidateQueries({ queryKey: ["social-notifications"] });
    },
    onError: (err: any) => toast.error(err.message)
  });

  const notifications = data?.notifications || [];


  const handleNotificationClick = (notif: any) => {
    if (!notif.read_at) markReadMut.mutate(notif.id);
    
    const metadata = notif.metadata as any;
    if (metadata?.post_id) {
      navigate({ to: "/social" as any });
    } else if (metadata?.sender_id) {
      navigate({ to: "/social/profile", search: { userId: metadata.sender_id } });
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-white pb-20 pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-40 bg-white border-b px-4 py-3 flex items-center gap-3">
        <Link to="/social" className="btn-press">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Link>
        <h1 className="text-xl font-black text-navy">{t("নোটিফিকেশন", "Notifications")}</h1>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full">
        {isLoading ? (
          <div className="flex justify-center py-12 text-primary animate-pulse">
            <Bell className="w-8 h-8" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <div className="h-20 w-20 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Bell className="h-10 w-10 text-gray-200" />
            </div>
            <p className="text-gray-500 font-bold">{t("কোনো নোটিফিকেশন নেই", "No notifications yet")}</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((n: any) => (
              <button 
                key={n.id} 
                onClick={() => handleNotificationClick(n)}
                className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${!n.read_at ? "bg-blue-50/50" : "hover:bg-gray-50"}`}
              >
                <div className="relative">
                  <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                    {n.metadata?.type === 'post_reaction' ? (
                      <Heart className="w-6 h-6 text-rose-500 fill-current" />
                    ) : n.metadata?.type === 'post_comment' ? (
                      <MessageSquare className="w-6 h-6 text-blue-500 fill-current" />
                    ) : n.metadata?.type === 'friend_request' ? (
                      <UserPlus className="w-6 h-6 text-primary" />
                    ) : n.metadata?.type === 'friend_request_accepted' ? (
                      <UserCheck className="w-6 h-6 text-emerald" />
                    ) : (
                      <Bell className="w-6 h-6 text-gray-400" />
                    )}

                  </div>
                  {!n.read_at && (
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[14px] leading-snug ${!n.read_at ? "font-bold text-navy" : "text-gray-700"}`}>
                    {n.body}
                  </p>
                  
                  {n.metadata?.type === 'friend_request' && !n.read_at && (
                    <div className="flex gap-2 mt-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          // In a real app we'd need the requestId from metadata
                          // For now this is a placeholder flow
                          toast.info("Opening friend profile...");
                          handleNotificationClick(n);
                        }}
                        className="bg-primary text-white text-xs px-4 py-1.5 rounded-lg font-black"
                      >
                        Confirm
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          markReadMut.mutate(n.id);
                        }}
                        className="bg-gray-100 text-navy text-xs px-4 py-1.5 rounded-lg font-black"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  <p className="text-[11px] text-gray-400 mt-1 font-medium">
                    {format(new Date(n.created_at), "MMM d, h:mm a")}
                  </p>
                </div>

              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
