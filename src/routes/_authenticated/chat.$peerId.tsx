import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, Info, Check, X, UserPlus, Loader2, Maximize2, MoreVertical, Trash2, Ban } from "lucide-react";
import { deleteMessage, deleteAllMessages, getThread, markChatRead, reactToMessage, sendMessage } from "@/lib/chat.functions";
import { awardCoins } from "@/lib/coins";
import { respondFriendRequest, sendFriendRequest } from "@/lib/friends.functions";
import { CallButtons } from "@/components/CallProvider";
import { playSentTone } from "@/lib/msg-sound";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type SendPayload } from "@/components/chat/Composer";
import { useIsOnline } from "@/lib/presence";
import { formatLastActive, isRecentlyActive } from "@/lib/last-active";
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement | null>(null);
  const presenceOnline = useIsOnline(peerId);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; body?: string; kind?: string; name?: string; mediaUrl?: string | null } | null>(null);

  // রিপ্লাই প্রিভিউতে ট্যাপ করলে মূল মেসেজে স্ক্রল হয়ে হাইলাইট হবে
  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-primary/10", "rounded-2xl");
    window.setTimeout(() => el.classList.remove("bg-primary/10", "rounded-2xl"), 1200);
  };
  // বাবল উইন্ডোতে খোলা হলে ফুল স্ক্রিনে যাওয়ার বাটন দেখাবে
  const inBubble = typeof window !== "undefined" && Boolean((window as any).GoodAppBubble);
  const openFullscreen = () => {
    try {
      (window as any).GoodAppBubble?.openFullscreen?.(peerId);
    } catch {
      /* ignore */
    }
  };

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
      void awardCoins("message");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: (res: any) => {
      if (!res?.ok) {
        toast.error(res?.error ?? "মেসেজ মোছা যায়নি");
        return;
      }
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "মেসেজ মোছা যায়নি"),
  });


  const react = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string | null }) =>
      reactToMessage({ data: { messageId: id, emoji } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["thread", peerId] }),
  });

  const deleteAll = useMutation({
    mutationFn: () => deleteAllMessages({ data: { peerId } }),
    onSuccess: () => {
      toast.success("সব মেসেজ মুছে ফেলা হয়েছে");
      void qc.invalidateQueries({ queryKey: ["chats"] });
      void qc.invalidateQueries({ queryKey: ["unread-msgs"] });
      navigate({ to: "/chat" });
    },
    onError: (e: any) => toast.error(e?.message ?? "মেসেজ মুছা যায়নি"),
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

  const peerLastActive = (data?.peer as any)?.lastActiveAt as string | null | undefined;
  const online = presenceOnline || isRecentlyActive(peerLastActive);
  const activityLabel = online
    ? "Active now"
    : (formatLastActive(peerLastActive) ?? `UID ${data?.peer?.uid ?? "-"}`);

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
                gender={(data.peer as any)?.gender ?? null}
                online={online}
                size="md"
              />
            </Link>
          ) : (
            <MessengerAvatar name="User" online={online} size="md" />
          )}
          <div className="flex flex-col min-w-0">
            <h1 className="truncate text-sm font-black text-foreground">{data?.peer?.name ?? "Chat"}</h1>
            <p className={`truncate text-[10px] font-bold tracking-tight ${online ? "text-emerald-500" : "text-muted-foreground"}`}>
              {activityLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 pr-1">
          {inBubble && (
            <button
              onClick={openFullscreen}
              aria-label="ফুল স্ক্রিনে খুলুন"
              className="btn-press h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            >
              <Maximize2 className="h-5 w-5 text-primary" />
            </button>
          )}
          {data?.peer && <CallButtons userId={data.peer.userId} name={data.peer.name} />}
          <div className="relative">
            <button
              onClick={() => setShowHeaderMenu((v) => !v)}
              className="btn-press h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            >
              <MoreVertical className="h-5 w-5 text-primary" />
            </button>
            {showHeaderMenu && (
              <>
                <div className="fixed inset-0 z-[70]" onClick={() => setShowHeaderMenu(false)} />
                <div className="absolute right-0 top-full mt-1 min-w-[180px] rounded-xl border border-border/60 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md z-[80] animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setShowHeaderMenu(false);
                      if (confirm("এই চ্যাটের সব মেসেজ মুছে ফেলবেন?")) {
                        deleteAll.mutate();
                      }
                    }}
                    disabled={deleteAll.isPending}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-rose-500 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" /> {deleteAll.isPending ? "মুছছি..." : "সব মেসেজ ডিলিট"}
                  </button>
                  <button
                    onClick={() => setShowHeaderMenu(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-black text-foreground hover:bg-surface-2 transition-colors"
                  >
                    <Ban className="h-4 w-4" /> বন্ধ করুন
                  </button>
                </div>
              </>
            )}
          </div>
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
                meId={me}
                onReact={(id, emoji) => react.mutate({ id, emoji })}
                onDelete={(id) => del.mutate(id)}
                onJumpTo={jumpToMessage}
                onReply={(msg) =>
                  setReplyTo({
                    id: msg.id,
                    body: msg.body,
                    kind: msg.kind,
                    mediaUrl: msg.mediaUrl,
                    name: msg.senderId === me ? "আপনি" : (data?.peer?.name ?? "User"),
                  })
                }
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
        <Composer
          onSend={(p) => send.mutate(p)}
          sending={send.isPending}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </footer>
    </div>
  );
}
