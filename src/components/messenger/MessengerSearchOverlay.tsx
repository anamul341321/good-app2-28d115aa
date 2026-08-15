import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "@/lib/social-users.functions";
import { useState } from "react";
import { Search, X, UserPlus, MessageSquare, Loader2 } from "lucide-react";
import { MessengerAvatar } from "./MessengerAvatar";
import { Link } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";

export function MessengerSearchOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  
  const { data, isLoading } = useQuery({
    queryKey: ["messenger-search", query],
    queryFn: () => searchUsers({ query }),
    enabled: query.trim().length > 0,
    staleTime: 5000,
  });

  const results = data?.users ?? [];

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="px-4 py-3 border-b flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("নাম, UID বা ফোন দিয়ে খুঁজুন", "Search by Name, UID or Phone")}
            className="w-full h-10 bg-surface-2 rounded-full pl-10 pr-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          {query && (
            <button 
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button 
          onClick={onClose}
          className="text-sm font-black text-primary px-2"
        >
          {t("বন্ধ", "Cancel")}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : query.trim() === "" ? (
          <div className="px-6 py-10 text-center space-y-2">
            <div className="h-16 w-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-black text-foreground">{t("কাকে খুঁজছেন?", "Who are you looking for?")}</p>
            <p className="text-xs font-bold text-muted-foreground">{t("বন্ধুদের খুঁজে পেতে নাম বা UID লিখুন", "Type name or UID to find friends")}</p>
          </div>
        ) : results.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-bold text-muted-foreground">{t("কাউকে পাওয়া যায়নি", "No users found")}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {results.map((user: any) => (
              <Link
                key={user.userId}
                to="/chat/$peerId"
                params={{ peerId: user.userId }}
                onClick={onClose}
                className="btn-press flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors border-b border-border/10"
              >
                <MessengerAvatar
                  name={user.name}
                  src={user.avatar}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-black text-foreground">{user.name}</p>
                  <p className="truncate text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                    UID {user.uid_seq} {user.isFriend ? "· Friend" : ""}
                  </p>
                </div>
                <div className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
