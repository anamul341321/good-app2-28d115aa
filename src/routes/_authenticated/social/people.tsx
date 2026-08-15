import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, Loader2, UserPlus, ChevronLeft, UserCheck, Clock, CheckCircle2 } from "lucide-react";
import { listUsers, sendFriendRequest, acceptFriendRequest } from "@/lib/social-users.functions";
import { useLang } from "@/lib/i18n";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useInView } from "react-intersection-observer";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/social/people")({
  component: SocialPeoplePage,
});

function SocialPeoplePage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const { ref, inView } = useInView();


  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["users-list", query],
    queryFn: ({ pageParam = 1 }) => listUsers({ data: { page: pageParam, limit: 20, query } }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => 
      lastPage.users.length === 20 ? allPages.length + 1 : undefined,
  });

  const sendFriendMutation = useMutation({
    mutationFn: (friendId: string) => sendFriendRequest({ data: { friendId } }),
    onSuccess: () => {
      toast.success(t("রিকোয়েস্ট পাঠানো হয়েছে", "Request sent"));
      queryClient.invalidateQueries({ queryKey: ["users-list"] });
    },
    onError: (err: any) => toast.error(err.message)
  });


  useEffect(() => {
    if (inView && hasNextPage) fetchNextPage();
  }, [inView, hasNextPage, fetchNextPage]);

  const allUsers = data?.pages.flatMap(p => p.users) || [];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm pt-[env(safe-area-inset-top)] px-4 py-3 flex items-center gap-3">
        <Link to="/social" className="btn-press">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Link>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("নাম, ইউআইডি বা ফোন দিয়ে খুঁজুন...", "Search by name, UID or phone...")}
            className="w-full bg-gray-100 border-none rounded-full pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
          />

        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : allUsers.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
            <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-bold">{t("কোনো ইউজার পাওয়া যায়নি", "No user found")}</p>
            <p className="text-xs text-gray-400 mt-1">{t("অন্য কোনো নাম বা আইডি দিয়ে চেষ্টা করুন", "Try searching with a different name or ID")}</p>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest px-1">
              {query ? t("অনুসন্ধান ফলাফল", "Search Results") : t("সব ব্যবহারকারী", "All Users")}
            </h2>
            {allUsers.map((u: any) => (

              <div key={u.id} className="bg-white p-3 rounded-xl border flex items-center justify-between shadow-sm">
                <button 
                  onClick={() => navigate({ to: "/social/profile", search: { userId: u.id } })}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <MessengerAvatar src={u.avatar_url} name={u.display_name} size="md" />
                  <div>
                    <p className="font-black text-navy leading-tight">{u.display_name || "User"}</p>
                    <div className="flex flex-col mt-0.5">
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">UID {u.uid_seq}</p>
                      {u.phone_number && (
                        <p className="text-[10px] text-gray-400 font-medium">
                          {u.phone_number?.toString().replace(/(\d{3})\d{4}(\d{4})/, "$1****$2") || ""}
                        </p>
                      )}
                    </div>
                  </div>

                </button>
                <div className="flex gap-2">
                  {u.friendship?.status === "accepted" ? (
                    <div className="h-9 w-9 rounded-full bg-emerald/10 text-emerald flex items-center justify-center">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  ) : u.friendship?.status === "pending" ? (
                    <div className="h-9 w-9 rounded-full bg-amber/10 text-amber flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                  ) : (
                    <button 
                      onClick={() => sendFriendMutation.mutate(u.id)}
                      disabled={sendFriendMutation.isPending}
                      className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center btn-press disabled:opacity-50"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  )}
                </div>

              </div>
            ))}
            <div ref={ref} className="h-10 flex justify-center items-center">
              {isFetchingNextPage && <Loader2 className="w-6 h-6 animate-spin text-primary" />}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
