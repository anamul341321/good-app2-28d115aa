import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search, UserPlus, Users, X, Loader2, PhoneCall, MessageCircle, ChevronLeft } from "lucide-react";
import {
  listFriends,
  respondFriendRequest,
  searchPeople,
  sendFriendRequest,
  removeFriend,
} from "@/lib/friends.functions";
import { CallButtons } from "@/components/CallProvider";
import { MessengerAvatar } from "@/components/messenger/MessengerAvatar";
import { MessengerNav } from "@/components/messenger/MessengerNav";
import { usePresence } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
  head: () => ({
    meta: [
      { title: "People — good-app" },
      {
        name: "description",
        content: "Messenger-style People section.",
      },
      { property: "og:title", content: "People — good-app" },
      { property: "og:type", content: "website" },
    ],
  }),
});

function FriendsPage() {
  const [q, setQ] = useState("");
  const onlineIds = usePresence();
  const { data, refetch, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => listFriends(),
    refetchInterval: 30_000,
  });

  const search = useMutation({
    mutationFn: (query: string) => searchPeople({ data: { query } }),
  });
  const add = useMutation({
    mutationFn: (userId: string) => sendFriendRequest({ data: { userId } }),
    onSuccess: (r: any) => {
      toast.success(r?.already ? "আগেই রিকোয়েস্ট আছে" : "ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে");
      void refetch();
    },
    onError: () => toast.error("রিকোয়েস্ট পাঠানো যায়নি"),
  });
  const respond = useMutation({
    mutationFn: (v: { linkId: string; accept: boolean }) => respondFriendRequest({ data: v }),
    onSuccess: () => void refetch(),
  });
  const drop = useMutation({
    mutationFn: (linkId: string) => removeFriend({ data: { linkId } }),
    onSuccess: () => void refetch(),
  });

  const found = (search.data as any)?.people ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      {/* Messenger-style Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md px-4 py-3 flex flex-col gap-3 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2">
          <Link 
            to="/social"
            className="btn-press h-9 w-9 flex items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-primary" />
          </Link>
          <h1 className="text-2xl font-black text-foreground tracking-tight">People</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) search.mutate(q.trim());
            }}
            placeholder="Search by UID or Name"
            className="w-full h-10 bg-surface-2 rounded-full pl-10 pr-4 text-sm font-bold focus:outline-none transition-shadow"
          />
        </div>
      </header>

      <main className="flex-1 px-4 py-2 space-y-6">
        {/* Search Results */}
        {search.isPending && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {found.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase text-muted-foreground tracking-wider pl-1">Search Results</h2>
            <div className="space-y-1">
              {found.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  <MessengerAvatar name={p.display_name ?? "User"} online={onlineIds.has(p.id)} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-black">{p.display_name ?? "User"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">UID {p.uid_seq ?? "-"}</p>
                  </div>
                  <button
                    onClick={() => add.mutate(p.id)}
                    className="btn-press flex items-center gap-1.5 rounded-full bg-surface-2 px-4 py-2 text-[11px] font-black text-foreground"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incoming Requests */}
        {(data?.incoming?.length ?? 0) > 0 && (
          <div className="space-y-4">
            <h2 className="text-xs font-black uppercase text-muted-foreground tracking-wider pl-1">Friend Requests</h2>
            <div className="space-y-3">
              {data!.incoming.map((r) => (
                <div key={r.linkId} className="flex items-center gap-3">
                  <MessengerAvatar name={r.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-black">{r.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Wants to be friends</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond.mutate({ linkId: r.linkId, accept: true })}
                      className="btn-press px-4 py-2 rounded-full bg-primary text-white text-[11px] font-black"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => respond.mutate({ linkId: r.linkId, accept: false })}
                      className="btn-press px-4 py-2 rounded-full bg-surface-2 text-foreground text-[11px] font-black"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pl-1">
            <h2 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Active Friends</h2>
            <Link to="/friends" className="text-[11px] font-black text-primary">SEE ALL</Link>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (data?.friends?.length ?? 0) === 0 ? (
            <div className="py-10 text-center">
              <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs font-bold text-muted-foreground">No friends yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {data!.friends.map((f) => (
                <div key={f.linkId} className="flex items-center gap-3 py-2">
                  <MessengerAvatar name={f.name} online={onlineIds.has(f.userId)} size="lg" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-black">{f.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{onlineIds.has(f.userId) ? "Active Now" : `UID ${f.uid ?? "-"}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/chat/$peerId"
                      params={{ peerId: f.userId }}
                      className="btn-press h-9 w-9 flex items-center justify-center rounded-full bg-surface-2 text-foreground"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Link>
                    <CallButtons userId={f.userId} name={f.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      
    </div>
  );
}
