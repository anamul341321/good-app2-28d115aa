import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, Loader2, UserPlus, MessageSquare } from "lucide-react";
import { searchUsers } from "@/lib/news-feed.functions";
import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/social/search")({
  component: SocialSearchPage,
  head: () => ({
    meta: [{ title: "Good-App Social · অনুসন্ধান" }],
  }),
});

function SocialSearchPage() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["user-search", query],
    queryFn: () => searchUsers({ data: { query } }),
    enabled: query.length > 1,
  });

  const users = data?.users || [];

  return (
    <div className="flex flex-col min-h-screen bg-white pb-20 pt-[env(safe-area-inset-top)]">
      <header className="sticky top-0 z-40 bg-white border-b px-4 py-2 flex items-center gap-3">
        <Link to="/social" className="btn-press">
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Link>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("অনুসন্ধান করুন...", "Search...")}
            className="w-full bg-gray-100 border-none rounded-full pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full p-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : query.length > 1 && users.length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t("কোনো ব্যবহারকারী খুঁজে পাওয়া যায়নি", "No users found")}</div>
        ) : (
          <div className="space-y-4">
            {users.map((u: any) => (
              <div key={u.id} className="flex items-center justify-between">
                <button 
                  onClick={() => navigate({ to: "/social/profile" as any, search: { userId: u.id } as any })}
                  className="flex items-center gap-3 text-left btn-press"
                >
                  <MessengerAvatar src={u.avatar_url} name={u.display_name} size="md" />
                  <div>
                    <p className="font-bold text-navy">{u.display_name || "User"}</p>
                    <p className="text-xs text-gray-500">UID {u.uid_seq}</p>
                  </div>
                </button>
                {u.id !== currentUser?.id && (
                  <div className="flex gap-2">
                    <button className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center btn-press">
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => navigate({ to: `/social/messenger` as any, search: { peerId: u.id } as any })}
                      className="h-8 w-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center btn-press"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
