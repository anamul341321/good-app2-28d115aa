import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Users, Loader2 } from "lucide-react";
import { listChats } from "@/lib/chat.functions";
import { listFriends } from "@/lib/friends.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatListPage,
  head: () => ({
    meta: [
      { title: "মেসেজ ও কল — good-app" },
      {
        name: "description",
        content: "good-app-এ বন্ধুর সাথে ফ্রি মেসেজ, অডিও কল ও ভিডিও কল — এক জায়গায় সব কথাবার্তা।",
      },
      { property: "og:title", content: "মেসেজ ও কল — good-app" },
      { property: "og:description", content: "বন্ধুর সাথে ফ্রি মেসেজ ও কল করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Avatar({ name, ring }: { name: string; ring?: boolean }) {
  return (
    <div
      className={`grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-base font-black text-white ${
        ring ? "ring-2 ring-rose-500" : ""
      }`}
    >
      {name.slice(0, 1)}
    </div>
  );
}

function ChatListPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => listChats(),
    refetchInterval: 15_000,
  });
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => listFriends(), staleTime: 30_000 });

  const chats = data?.chats ?? [];
  const chatted = new Set(chats.map((c) => c.peerId));
  const others = (friends.data?.friends ?? []).filter((f) => !chatted.has(f.userId));

  return (
    <div className="space-y-4 pb-8 pt-1">
      <div className="text-center">
        <h1 className="text-lg font-black text-navy">মেসেজ ও কল</h1>
        <p className="text-[11px] font-bold text-muted-foreground">
          বন্ধুর সাথে ফ্রি চ্যাট, অডিও ও ভিডিও কল
        </p>
      </div>

      <Link
        to="/friends"
        className="glass btn-press flex items-center gap-3 rounded-2xl p-3"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
          <Users className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black">বন্ধু যোগ করুন / রিকোয়েস্ট</span>
          <span className="block text-[11px] font-bold text-muted-foreground">
            UID বা নাম দিয়ে খুঁজে বন্ধু বানান
          </span>
        </span>
        {(friends.data?.incoming?.length ?? 0) > 0 && (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
            {friends.data!.incoming.length}
          </span>
        )}
      </Link>

      <div className="glass rounded-2xl p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-cyan">
          <MessageCircle className="h-4 w-4" /> কথাবার্তা
        </p>
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
          </p>
        ) : chats.length === 0 && others.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-muted-foreground">
            এখনো কোনো চ্যাট নেই — আগে বন্ধু যোগ করুন
          </p>
        ) : (
          <div className="space-y-2">
            {chats.map((c) => (
              <Link
                key={c.peerId}
                to="/chat/$peerId"
                params={{ peerId: c.peerId }}
                className="btn-press flex items-center gap-3 rounded-xl bg-surface-2 p-2.5"
              >
                <Avatar name={c.name} ring={c.unread > 0} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${c.unread > 0 ? "font-black text-rose-500" : "font-black"}`}>
                    {c.name}
                  </p>
                  <p
                    className={`truncate text-[11px] ${
                      c.unread > 0 ? "font-black text-foreground" : "font-bold text-muted-foreground"
                    }`}
                  >
                    {c.mine ? "আপনি: " : ""}
                    {c.lastBody}
                  </p>
                </div>
                {c.unread > 0 && (
                  <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black text-white">
                    {c.unread}
                  </span>
                )}
              </Link>
            ))}

            {others.map((f) => (
              <Link
                key={f.userId}
                to="/chat/$peerId"
                params={{ peerId: f.userId }}
                className="btn-press flex items-center gap-3 rounded-xl bg-surface-2/60 p-2.5"
              >
                <Avatar name={f.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{f.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">নতুন কথা শুরু করুন</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
