import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Edit, ChevronLeft, Plus, Users, Check } from "lucide-react";
import { createGroup, listChats } from "@/lib/chat.functions";
import { listFriends } from "@/lib/friends.functions";
import { usePresence } from "@/lib/presence";
import { StoryRow } from "@/components/messenger/StoryRow";
import { ChatRow } from "@/components/messenger/ChatRow";
import { MessengerSearchOverlay } from "@/components/messenger/MessengerSearchOverlay";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatListPage,
  head: () => ({
    meta: [
      { title: "Good-App Messenger" },
      {
        name: "description",
        content: "Good-App Messenger এ বন্ধুদের সাথে চ্যাট ও কল করুন।",
      },
      { property: "og:title", content: "Good-App Messenger" },
      { property: "og:description", content: "Good-App Messenger এ বন্ধুদের সাথে চ্যাট, গ্রুপ ও কল করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),

});

export function ChatListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const onlineIds = usePresence();
  const [showSearch, setShowSearch] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

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

  const groupMutation = useMutation({
    mutationFn: () => createGroup({ data: { name: groupName, memberIds: selectedMembers } }),
    onSuccess: (res) => {
      toast.success("গ্রুপ তৈরি হয়েছে");
      setShowGroup(false);
      setGroupName("");
      setSelectedMembers([]);
      void qc.invalidateQueries({ queryKey: ["chats"] });
      if (res.groupId) navigate({ to: "/chat/group/$groupId", params: { groupId: res.groupId } });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "গ্রুপ তৈরি হয়নি"),
  });

  const allConversations = useMemo(() => {
    return [...chats, ...groups].sort((a, b) => 
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [chats, groups]);


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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Messenger Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-3 flex flex-col gap-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-foreground tracking-tight">Messenger</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* যারা ড্যাশবোর্ডে যেতে চান শুধু তারাই এই বাটনে ট্যাপ করবেন */}
            <Link
              to="/home"
              className="btn-press h-9 px-3 flex items-center gap-1.5 rounded-full bg-surface-2 text-[11px] font-black text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> ড্যাশবোর্ড
            </Link>
            <button 
              onClick={() => navigate({ to: "/chat" as any, search: { new: true } as any })}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 btn-press"
              aria-label="নতুন মেসেজ"
            >
              <Edit className="h-5 w-5 text-foreground" />
            </button>
            <Button
              size="icon"
              onClick={() => setShowGroup(true)}
              aria-label="গ্রুপ তৈরি"
              className="h-9 w-9 rounded-full"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search Bar (Triggers Overlay) */}
        <button
          onClick={() => setShowSearch(true)}
          className="relative w-full text-left"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div className="w-full h-10 bg-surface-2 rounded-full pl-10 pr-4 flex items-center text-sm font-bold text-muted-foreground">
            খুঁজুন (নাম, UID বা ফোন)

          </div>
        </button>
      </header>

      {showSearch && <MessengerSearchOverlay onClose={() => setShowSearch(false)} />}

      {showGroup && (
        <div className="fixed inset-0 z-50 flex items-end bg-background/70 backdrop-blur-sm sm:items-center sm:justify-center">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full rounded-t-3xl border border-border bg-surface p-4 shadow-2xl sm:max-w-md sm:rounded-3xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-black text-foreground">নতুন গ্রুপ</h2>
                  <p className="text-xs font-semibold text-muted-foreground">বন্ধু সিলেক্ট করে গ্রুপ খুলুন</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowGroup(false)}>বন্ধ</Button>
            </div>

            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="গ্রুপের নাম"
              className="mt-4 h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-primary"
            />

            <div className="mt-4 max-h-[38vh] space-y-1 overflow-y-auto pr-1">
              {friendList.length === 0 ? (
                <p className="py-8 text-center text-sm font-bold text-muted-foreground">আগে বন্ধু যোগ করুন</p>
              ) : friendList.map((friend) => {
                const checked = selectedMembers.includes(friend.userId);
                return (
                  <Button
                    key={friend.userId}
                    type="button"
                    variant="ghost"
                    onClick={() => setSelectedMembers((current) => checked
                      ? current.filter((id) => id !== friend.userId)
                      : [...current, friend.userId])}
                    className="h-auto w-full justify-start rounded-2xl px-3 py-2"
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-2 text-sm font-black">
                      {friend.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-black">{friend.name}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full ${checked ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}>
                      {checked && <Check className="h-4 w-4" />}
                    </span>
                  </Button>
                );
              })}
            </div>

            <Button
              className="mt-4 h-11 w-full rounded-2xl font-black"
              disabled={groupMutation.isPending || !groupName.trim()}
              onClick={() => groupMutation.mutate()}
            >
              <Users className="h-4 w-4" />
              গ্রুপ তৈরি করুন
            </Button>
          </div>
        </div>
      )}


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

    </div>
  );
}
