import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Edit, UserCircle } from "lucide-react";
import { createGroup, listChats } from "@/lib/chat.functions";
import { listFriends } from "@/lib/friends.functions";
import { usePresence } from "@/lib/presence";
import { StoryRow } from "@/components/messenger/StoryRow";
import { ChatRow } from "@/components/messenger/ChatRow";
import { MessengerNav } from "@/components/messenger/MessengerNav";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatListPage,
  head: () => ({
    meta: [
      { title: "Chats — good-app" },
      {
        name: "description",
        content: "Messenger-style chat for good-app.",
      },
      { property: "og:title", content: "Chats — good-app" },
      { property: "og:type", content: "website" },
    ],
  }),
});

export function ChatListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const onlineIds = usePresence();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => listChats(),
    refetchInterval: 6_000,
  });

  const friends = useQuery({ 
    queryKey: ["friends"], 
    queryFn: () => listFriends(), 
    staleTime: 30_000 
  });

  const chats = data?.chats ?? [];
  const groups = data?.groups ?? [];
  const friendList = friends.data?.friends ?? [];

  // Filter conversations based on search
  const filteredChats = useMemo(() => {
    const s = search.toLowerCase();
    return chats.filter(c => c.name.toLowerCase().includes(s));
  }, [chats, search]);

  const filteredGroups = useMemo(() => {
    const s = search.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(s));
  }, [groups, search]);

  // Combine and sort for the main list
  const allConversations = useMemo(() => {
    return [...filteredChats, ...filteredGroups].sort((a, b) => 
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [filteredChats, filteredGroups]);

  const activeUsers = useMemo(() => {
    return friendList
      .filter(f => onlineIds.has(f.userId))
      .map(f => ({
        userId: f.userId,
        name: f.name,
        online: true,
        avatar: null, // Profile pics will be handled by MessengerAvatar fallback
      }));
  }, [friendList, onlineIds]);

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Messenger Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: "/profile" as any })}
              className="btn-press"
            >
              <UserCircle className="h-8 w-8 text-muted-foreground" />
            </button>
            <h1 className="text-2xl font-black text-foreground tracking-tight">Chats</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => navigate({ to: "/chat" as any, search: { new: true } as any })}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 btn-press"
            >
              <Edit className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            className="w-full h-10 bg-surface-2 rounded-full pl-10 pr-4 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/30 transition-shadow"
          />
        </div>
      </header>

      {/* Stories Row */}
      <section className="mt-1">
        <StoryRow activeUsers={activeUsers} />
      </section>

      {/* Conversation List */}
      <main className="flex-1 mt-2">
        {isLoading && allConversations.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent animate-spin rounded-full" />
          </div>
        ) : allConversations.length === 0 ? (
          <div className="px-10 py-20 text-center">
            <p className="text-sm font-bold text-muted-foreground">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {allConversations.map((conv) => (
              <ChatRow
                key={'groupId' in conv ? conv.groupId : conv.peerId}
                id={'groupId' in conv ? conv.groupId : conv.peerId}
                name={conv.name}
                lastMessage={'mine' in conv && conv.mine ? `You: ${conv.lastBody}` : conv.lastBody}
                time={new Date(conv.lastAt).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                unreadCount={conv.unread}
                online={'peerId' in conv ? onlineIds.has(conv.peerId) : false}
                isGroup={'groupId' in conv}
              />
            ))}
          </div>
        )}
      </main>

  );
}
