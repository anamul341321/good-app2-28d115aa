import React, { useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Search, Loader2, UserPlus, ChevronLeft } from "lucide-react";
import { listUsers } from "@/lib/social-users.functions";
import { useLang } from "@/lib/i18n";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useInView } from "react-intersection-observer";

export const Route = createFileRoute("/_authenticated/social/people")({
  component: SocialPeoplePage,
});

function SocialPeoplePage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");
  const { ref, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["users-list", query],
    queryFn: ({ pageParam = 1 }) => listUsers({ data: { page: pageParam, limit: 20, query } }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => 
      lastPage.users.length === 20 ? allPages.length + 1 : undefined,
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
            placeholder={t("অনুসন্ধান করুন...", "Search by name or UID...")}
            className="w-full bg-gray-100 border-none rounded-full pl-9 pr-4 py-2 text-sm"
          />
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <>
            <h2 className="text-xl font-black text-navy px-1">{t("সব ব্যবহারকারী", "All Users")}</h2>
            {allUsers.map((u: any) => (
              <div key={u.id} className="bg-white p-3 rounded-xl border flex items-center justify-between shadow-sm">
                <button 
                  onClick={() => navigate({ to: "/social/profile", search: { userId: u.id } })}
                  className="flex items-center gap-3 text-left flex-1"
                >
                  <MessengerAvatar src={u.avatar_url} name={u.display_name} size="md" />
                  <div>
                    <p className="font-black text-navy leading-tight">{u.display_name || "User"}</p>
                    <p className="text-xs text-gray-500 font-bold mt-0.5">UID {u.uid_seq}</p>
                  </div>
                </button>
                <div className="flex gap-2">
                  <button className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center btn-press">
                    <UserPlus className="w-5 h-5" />
                  </button>
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
