import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Info, Check, X, UserPlus, Loader2 } from "lucide-react";
import { deleteMessage, getThread, markChatRead, sendMessage } from "@/lib/chat.functions";
import { respondFriendRequest, sendFriendRequest } from "@/lib/friends.functions";
import { CallButtons } from "@/components/CallProvider";
import { playSentTone } from "@/lib/msg-sound";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type SendPayload } from "@/components/chat/Composer";
import { useIsOnline } from "@/lib/presence";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  component: ThreadPage,
  head: () => ({
    meta: [
      { title: "Chat — good-app" },
      { name: "description", content: "Messenger-style conversation." },
      { property: "og:title", content: "Chat — good-app" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function ThreadPage() {
  const { peerId } = useParams({ from: "/_authenticated/chat/$peerId" });
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement | null>(null);
  const online = useIsOnline(peerId);

  const { data, isLoading } = useQuery({
    queryKey: ["thread", peerId],
    queryFn: () => getThread({ data: { peerId } }),
    refetchInterval: 3_000,
  });

  const read = useMutation({ mutationFn: () => markChatRead({ data: { peerId } }) });

  useEffect(() => {
    read.mutate(undefined, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["unread-msgs"] });
        void qc.invalidateQueries({ queryKey: ["chats"] });
      },
    });
  }, [peerId, data?.messages?.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["thread", peerId] });
    void qc.invalidateQueries({ queryKey: ["chats"] });
  };

  const send = useMutation({
    mutationFn: (p: SendPayload) => sendMessage({ data: { peerId, ...p } }),
    onSuccess: () => {
      playSentTone();
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: refresh,
  });

  const addFriend = useMutation({
    mutationFn: () => sendFriendRequest({ data: { userId: peerId } }),
    onSuccess: () => {
      toast.success("Friend request sent");
      refresh();
    },
  });

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      respondFriendRequest({ data: { linkId: (data as any)?.linkId ?? "", accept } }),
    onSuccess: () => {
      toast.success("Updated");
      refresh();
      void qc.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const me = data?.me as string | undefined;
  const messages = data?.messages ?? [];
  const status = (data as any)?.friendStatus as string | undefined;
  // শেষ যে মেসেজটি পিয়ার পড়েছেন — তার নিচেই ছোট প্রোফাইল ছবি বসবে
  let lastSeenIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.senderId === me && m.readAt && !m.deleted) { lastSeenIndex = i; break; }
  }


  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Messenger-style Conversation Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md px-2 py-2 border-b flex items-center gap-2 safe-top">
        {/* ব্যাক দিলে সবসময় মেসেঞ্জার লিস্টে ফিরবে — ড্যাশবোর্ডে নয় */}
        <Link
          to="/chat"
          className="btn-press h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
        >
          <ChevronLeft className="h-6 w-6 text-primary" />
        </Link>
        
        <div className="flex flex-1 items-center gap-2 min-w-0">
          {data?.peer ? (
            <Link to="/user/$userId" params={{ userId: data.peer.userId }} className="btn-press rounded-full" aria-label={`${data.peer.name} profile`}>
              <MessengerAvatar
                name={data.peer.name ?? "User"}
                src={(data.peer as any)?.avatarUrl ?? null}
                online={online}
                size="md"
              />
            </Link>
          ) : (
            <MessengerAvatar name="User" online={online} size="md" />
          )}
          <div className="flex flex-col min-w-0">
            <h1 className="truncate text-sm font-black text-foreground">{data?.peer?.name ?? "Chat"}</h1>
            <p className="truncate text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
              {online ? "Active Now" : `UID ${data?.peer?.uid ?? "-"}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 pr-1">
          {data?.peer && <CallButtons userId={data.peer.userId} name={data.peer.name} />}
          <button className="btn-press h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors">
            <Info className="h-5 w-5 text-primary" />
          </button>
        </div>
      </header>

      {/* Friend Request Banner */}
      {status !== "accepted" && data?.peer && (
        <div className="mx-4 mt-3 rounded-2xl border bg-surface-2/50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
          {(data as any)?.incomingRequest ? (
            <div className="space-y-3 text-center">
              <p className="text-sm font-black">{data.peer.name} sent you a friend request</p>
              <div className="flex gap-2">
                <button
                  onClick={() => respond.mutate(true)}
                  className="flex-1 rounded-full bg-primary py-2 text-xs font-black text-white btn-press"
                >
                  Accept
                </button>
                <button
                  onClick={() => respond.mutate(false)}
                  className="flex-1 rounded-full bg-surface-3 py-2 text-xs font-black text-foreground btn-press"
                >
                  Decline
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold text-muted-foreground">
                {status === "pending"
                  ? "Request sent — wait for acceptance to call"
                  : "Message request — become friends to unlock all features"}
              </p>
              {status !== "pending" && (
                <button
                  onClick={() => addFriend.mutate()}
                  className="shrink-0 rounded-full bg-primary/10 px-4 py-1.5 text-[11px] font-black text-primary btn-press"
                >
                  Add Friend
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages List */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
        {isLoading && messages.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <MessengerAvatar name={data?.peer?.name ?? "User"} size="xl" />
            <div>
              <h2 className="text-xl font-black">{data?.peer?.name}</h2>
              <p className="text-xs font-bold text-muted-foreground">You're friends on Good-App</p>
            </div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase">Say hi to your new friend 👋</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m, i) => (
              <MessageBubble
                key={m.id}
                m={m}
                mine={m.senderId === me}
                onDelete={(id) => del.mutate(id)}
                seenBy={
                  i === lastSeenIndex && data?.peer
                    ? { name: data.peer.name ?? "User", avatarUrl: (data.peer as any)?.avatarUrl ?? null }
                    : null
                }
              />
            ))}
            <div ref={endRef} />
          </div>

        )}
      </main>

      {/* Composer */}
      <footer className="pb-safe">
        <Composer onSend={(p) => send.mutate(p)} sending={send.isPending} />
      </footer>
    </div>
  );
}
