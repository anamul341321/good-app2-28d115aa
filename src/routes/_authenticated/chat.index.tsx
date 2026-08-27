import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Users, Check, MessageCircle, Home, Loader2 } from "lucide-react";
import { createGroup, listChats } from "@/lib/chat.functions";
import { listFriends } from "@/lib/friends.functions";
import { getPublicProfile } from "@/lib/social-users.functions";
import { createStory, uploadStoryMedia } from "@/lib/feed-api";
import { useAuth } from "@/hooks/useAuth";
import { usePresence } from "@/lib/presence";
import { StoryRow } from "@/components/messenger/StoryRow";
import { ChatRow } from "@/components/messenger/ChatRow";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { MessengerSearchOverlay } from "@/components/messenger/MessengerSearchOverlay";
import StoryEditor from "@/components/social/StoryEditor";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

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
  const { user } = useAuth();
  const onlineIds = usePresence();
  const [showSearch, setShowSearch] = useState(false);
  const [showGroup, setShowGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [storyEditorFile, setStoryEditorFile] = useState<File | null>(null);
  const storyInputRef = useRef<HTMLInputElement>(null);

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

  const meProfile = useQuery({
    queryKey: ["social-profile", user?.id],
    queryFn: () => getPublicProfile({ data: { userId: user?.id ?? "" } }),
    enabled: !!user?.id,
    staleTime: 60_000,
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
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "গ্রুপ তৈরি হয়নি"),
  });

  const storyMutation = useMutation({
    mutationFn: async ({ file, musicName }: { file: File; musicName?: string }) => {
      if (!user?.id) throw new Error("Login");
      const url = await uploadStoryMedia(file, user.id);
      await createStory(user.id, url, musicName);
    },
    onSuccess: () => {
      setStoryEditorFile(null);
      void qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("স্টোরি যোগ হয়েছে");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "স্টোরি যোগ হয়নি"),
  });

  const handleStorySelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setStoryEditorFile(file);
    event.target.value = "";
  };

  const handleStoryPublish = (editedFile: File, musicName?: string) => {
    storyMutation.mutate({ file: editedFile, musicName });
  };

  const allConversations = useMemo(() => {
    return [...chats, ...groups].sort((a, b) => 
      new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    );
  }, [chats, groups]);


  const activeCount = useMemo(() => friendList.filter((friend) => onlineIds.has(friend.userId)).length, [friendList, onlineIds]);

  const activeUsers = useMemo(() => {
    return [...friendList]
      .sort((a, b) => Number(onlineIds.has(b.userId)) - Number(onlineIds.has(a.userId)))
      .map(f => ({
        userId: f.userId,
        name: f.name,
        online: onlineIds.has(f.userId),
        avatar: f.avatar_url ?? null,
        hasStory: onlineIds.has(f.userId),
      }));
  }, [friendList, onlineIds]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {/* Messenger Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/95 px-4 pb-2 safe-top backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {user?.id && (
              <Link to="/user/$userId" params={{ userId: user.id }} className="btn-press shrink-0 rounded-full" aria-label="আমার প্রোফাইল">
                <MessengerAvatar
                  name={(meProfile.data as any)?.display_name ?? "Me"}
                  src={(meProfile.data as any)?.avatar_url ?? null}
                  gender={(meProfile.data as any)?.gender ?? null}
                  online
                  size="md"
                />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="font-sans text-[31px] font-black leading-none tracking-normal text-messenger-blue">goodapp massage</h1>
              <p className="mt-0.5 text-[12px] font-bold text-muted-foreground">{activeCount} জন active now</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Button asChild variant="secondary" size="sm" className="gradient-amber h-10 rounded-full px-3 font-black" aria-label="ড্যাশবোর্ডে ফিরুন">
              <Link to="/home">
                <Home className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </div>

        {/* Search Bar (Triggers Overlay) */}
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowSearch(true)}
          className="relative mt-5 h-12 w-full justify-start rounded-full bg-surface-2 px-4 text-left text-muted-foreground hover:bg-surface-2"
        >
          <Search className="h-6 w-6 text-muted-foreground" />
          <span className="text-[17px] font-medium">Search Messenger</span>
        </Button>
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
      <section className="border-b border-border/35 bg-background">
        <StoryRow activeUsers={activeUsers} activeCount={activeCount} onCreateStory={() => storyInputRef.current?.click()} creatingStory={storyMutation.isPending} />
        <input ref={storyInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleStorySelect} />
      </section>

      {/* Conversation List */}
      <main className="flex-1 overflow-y-auto pb-24">
        {isLoading && allConversations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-messenger-blue border-t-transparent" />
          </div>
        ) : allConversations.length === 0 ? (
          <div className="px-10 py-20 text-center">
            <MessageCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-bold text-muted-foreground">No conversations found</p>
            <Button type="button" onClick={() => setShowSearch(true)} className="mt-4 rounded-full bg-messenger-blue px-5 font-black text-primary-foreground">
              নতুন চ্যাট শুরু করুন
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {allConversations.map((conv) => (
              <ChatRow
                key={'groupId' in conv ? conv.groupId : conv.peerId}
                id={'groupId' in conv ? conv.groupId : conv.peerId}
                name={conv.name}
                avatar={'avatar_url' in conv ? conv.avatar_url : null}
                gender={'gender' in conv ? (conv as any).gender : null}
                uid={'uid' in conv ? conv.uid : null}
                lastMessage={'mine' in conv && conv.mine ? `You: ${conv.lastBody}` : conv.lastBody}
                time={formatChatTime(conv.lastAt)}
                unreadCount={conv.unread}
                online={'peerId' in conv ? onlineIds.has(conv.peerId) : false}
                isGroup={'groupId' in conv}
              />
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-border/50 bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-20px_var(--color-foreground)] backdrop-blur-md">
        <div className="mx-auto grid max-w-lg grid-cols-3 px-6 py-2">
          <MessengerTab to="/chat" icon={<MessageCircle className="h-6 w-6" />} label="Chats" active badge={data?.unreadTotal ?? 0} />
          <MessengerTab to="/friends" icon={<Users className="h-6 w-6" />} label="People" />
          <MessengerTab to="/home" icon={<Home className="h-6 w-6" />} label="Dashboard" highlight />
        </div>
      </nav>

      {storyEditorFile && (
        <StoryEditor imageFile={storyEditorFile} onClose={() => setStoryEditorFile(null)} onPublish={handleStoryPublish} isPending={storyMutation.isPending} />
      )}

    </div>
  );
}

function MessengerTab({
  to,
  icon,
  label,
  active,
  badge,
  highlight,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to as any}
      className={`btn-press relative flex flex-col items-center justify-center gap-1 rounded-2xl py-1.5 text-[13px] font-semibold ${active ? "text-messenger-blue" : highlight ? "text-amber" : "text-muted-foreground"}`}
    >
      <span className="relative">
        {icon}
        {!!badge && badge > 0 && (
          <span className="absolute -right-2.5 -top-2 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-black leading-5 text-destructive-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span>{label}</span>
    </Link>
  );
}

function formatChatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const today = date.toDateString() === now.toDateString();
  if (today) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  const withinWeek = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
  if (withinWeek) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
