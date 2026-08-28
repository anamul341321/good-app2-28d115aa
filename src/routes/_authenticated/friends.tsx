import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, UserPlus, Users, Loader2, MessageCircle, ChevronLeft, Check, X } from "lucide-react";
import {
  listFriends,
  respondFriendRequest,
  sendFriendRequest,
  removeFriend,
  getSuggestedPeople,
  searchPeopleFull,
} from "@/lib/friends.functions";
import { useFeedMedia } from "@/lib/feed-media";
import { usePresence } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
  head: () => ({
    meta: [
      { title: "বন্ধু — good-app" },
      { name: "description", content: "ফ্রেন্ড রিকোয়েস্ট, সাজেশন ও বন্ধুর তালিকা — good-app।" },
      { property: "og:title", content: "বন্ধু — good-app" },
      { property: "og:description", content: "ফ্রেন্ড রিকোয়েস্ট, সাজেশন ও বন্ধুর তালিকা।" },
      { property: "og:type", content: "website" },
    ],
  }),
});

/** বড় স্কয়ার প্রোফাইল ছবি (ফেসবুক কার্ড স্টাইল) */
function BigPhoto({ path, name }: { path?: string | null; name: string }) {
  const url = useFeedMedia(path);
  if (url) return <img src={url} alt={name} className="h-full w-full object-cover" />;
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-4xl font-black text-blue-600">
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function RoundPhoto({ path, name, online }: { path?: string | null; name: string; online?: boolean }) {
  const url = useFeedMedia(path);
  return (
    <div className="relative h-14 w-14 shrink-0">
      <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-secondary">
        {url ? (
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-black text-blue-600">
            {name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      {online && <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-card bg-green-500" />}
    </div>
  );
}

type Tab = "suggest" | "requests" | "friends";

function FriendsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("suggest");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [people, setPeople] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [sentIds, setSentIds] = useState<Record<string, boolean>>({});
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});

  const queryClient = useQueryClient();
  const onlineIds = usePresence();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: () => listFriends(),
    refetchInterval: 30_000,
  });

  const search = useMutation({ mutationFn: (query: string) => searchPeopleFull({ data: { query } }) });

  const suggested = useQuery({
    queryKey: ["suggested-people", offset],
    queryFn: () => getSuggestedPeople({ data: { limit: 20, offset } }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!suggested.data) return;
    const next = (suggested.data as any).people ?? [];
    setHasMore(Boolean((suggested.data as any).hasMore));
    setPeople((prev) => {
      if (offset === 0) return next;
      const seen = new Set(prev.map((p: any) => p.id));
      return [...prev, ...next.filter((p: any) => !seen.has(p.id))];
    });
  }, [suggested.data, offset]);

  const add = useMutation({
    mutationFn: (userId: string) => sendFriendRequest({ data: { userId } }),
    onSuccess: (r: any, userId) => {
      setSentIds((s) => ({ ...s, [userId]: true }));
      toast.success(r?.already ? "আগেই রিকোয়েস্ট আছে" : "ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে");
      void refetch();
    },
    onError: () => toast.error("রিকোয়েস্ট পাঠানো যায়নি"),
  });

  const respond = useMutation({
    mutationFn: (v: { linkId: string; accept: boolean }) => respondFriendRequest({ data: v }),
    // সাথে সাথেই লিস্ট আপডেট — সার্ভারের উত্তরের জন্য অপেক্ষা করতে হবে না
    onMutate: (v) => {
      queryClient.setQueryData(["friends"], (old: any) => {
        if (!old) return old;
        const item = (old.incoming ?? []).find((i: any) => i.linkId === v.linkId || i.id === v.linkId);
        return {
          ...old,
          incoming: (old.incoming ?? []).filter((i: any) => (i.linkId ?? i.id) !== v.linkId),
          friends: v.accept && item ? [item, ...(old.friends ?? [])] : (old.friends ?? []),
        };
      });
    },
    onSuccess: (_r, v) => {
      toast.success(v.accept ? "এখন আপনারা বন্ধু" : "রিকোয়েস্ট মুছে ফেলা হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["suggested-people"] });
      void refetch();
    },
    onError: () => {
      toast.error("কাজটি করা যায়নি");
      void refetch();
    },
  });


  const drop = useMutation({
    mutationFn: (linkId: string) => removeFriend({ data: { linkId } }),
    onSuccess: () => {
      toast.success("বন্ধু তালিকা থেকে সরানো হয়েছে");
      void refetch();
    },
  });

  const found = (search.data as any)?.people ?? [];
  const incoming = data?.incoming ?? [];
  const friends = data?.friends ?? [];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-background pb-24">
      {/* ফেসবুক-স্টাইল হেডার */}
      <header className="sticky top-0 z-40 bg-white dark:bg-card border-b border-gray-200 dark:border-border/30 safe-top">
        <div className="max-w-lg mx-auto px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={() => navigate({ to: "/feed" })}
            className="btn-press flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-secondary">
            <ChevronLeft className="h-6 w-6 text-blue-600" />
          </button>
          <h1 className="flex-1 text-2xl font-black tracking-tight text-gray-900 dark:text-foreground">বন্ধু</h1>
        </div>

        <div className="max-w-lg mx-auto px-3 pb-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) search.mutate(q.trim());
              }}
              placeholder="নাম বা UID দিয়ে খুঁজুন"
              className="h-10 w-full rounded-full bg-gray-100 dark:bg-secondary pl-10 pr-4 text-sm font-semibold text-gray-900 dark:text-foreground focus:outline-none"
            />
          </div>
        </div>

        <div className="max-w-lg mx-auto flex gap-2 overflow-x-auto px-3 pb-2.5 no-scrollbar">
          {([
            ["suggest", "সাজেশন"],
            ["requests", `রিকোয়েস্ট${incoming.length ? ` (${incoming.length})` : ""}`],
            ["friends", "আপনার বন্ধু"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`btn-press shrink-0 rounded-full px-4 py-2 text-[13px] font-bold ${
                tab === key ? "bg-blue-600 text-white" : "bg-gray-100 dark:bg-secondary text-gray-700 dark:text-muted-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-3 py-3 space-y-3">
        {/* সার্চ রেজাল্ট */}
        {search.isPending && (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
        )}
        {found.length > 0 && (
          <section className="rounded-xl bg-white dark:bg-card p-3">
            <h2 className="mb-2 text-[15px] font-bold text-gray-900 dark:text-foreground">সার্চ রেজাল্ট</h2>
            <div className="space-y-1">
              {found.map((p: any) => {
                const name = p.display_name ?? "User";
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
                    <RoundPhoto path={p.avatar_url} name={name} online={onlineIds.has(p.id)} />
                    <Link to="/user/$userId" params={{ userId: p.id }} className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-gray-900 dark:text-foreground">{name}</p>
                      <p className="text-[12px] text-gray-500 dark:text-muted-foreground">UID {p.uid_seq ?? "-"}</p>
                    </Link>
                    {p.status === "accepted" ? (
                      <Link to="/chat/$peerId" params={{ peerId: p.id }} className="btn-press flex items-center gap-1.5 rounded-md bg-gray-100 dark:bg-secondary px-3 py-2 text-[13px] font-bold text-gray-800 dark:text-foreground">
                        <MessageCircle className="h-4 w-4" /> মেসেজ
                      </Link>
                    ) : p.status === "pending_sent" || sentIds[p.id] ? (
                      <span className="rounded-md bg-gray-200 dark:bg-muted px-3 py-2 text-[13px] font-bold text-gray-600 dark:text-muted-foreground">পাঠানো</span>
                    ) : p.status === "pending_received" ? (
                      <button onClick={() => p.linkId && respond.mutate({ linkId: p.linkId, accept: true })} className="btn-press rounded-md bg-blue-600 px-3 py-2 text-[13px] font-bold text-white">কনফার্ম</button>
                    ) : (
                      <button onClick={() => add.mutate(p.id)} className="btn-press flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[13px] font-bold text-white">
                        <UserPlus className="h-4 w-4" /> যোগ
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* রিকোয়েস্ট ট্যাব */}
        {tab === "requests" && (
          <section className="rounded-xl bg-white dark:bg-card p-3">
            <h2 className="mb-2 text-[17px] font-black text-gray-900 dark:text-foreground">
              ফ্রেন্ড রিকোয়েস্ট {incoming.length > 0 && <span className="text-blue-600">{incoming.length}</span>}
            </h2>
            {incoming.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-500">কোনো ফ্রেন্ড রিকোয়েস্ট নেই</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-border/20">
                {incoming.map((r: any) => (
                  <div key={r.linkId} className="flex items-start gap-3 py-3">
                    <div className="h-[84px] w-[84px] shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-secondary">
                      <BigPhoto path={r.avatar_url} name={r.name} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-gray-900 dark:text-foreground">{r.name}</p>
                      <p className="mb-2 text-[12px] text-gray-500 dark:text-muted-foreground">আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়েছে</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respond.mutate({ linkId: r.linkId, accept: true })}
                          disabled={respond.isPending}
                          className="btn-press flex-1 rounded-md bg-blue-600 py-2 text-[14px] font-bold text-white disabled:opacity-60">
                          কনফার্ম
                        </button>
                        <button
                          onClick={() => respond.mutate({ linkId: r.linkId, accept: false })}
                          disabled={respond.isPending}
                          className="btn-press flex-1 rounded-md bg-gray-200 dark:bg-muted py-2 text-[14px] font-bold text-gray-800 dark:text-foreground disabled:opacity-60">
                          ডিলিট
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* সাজেশন ট্যাব — ফেসবুকের মতো লিস্ট রো */}
        {tab === "suggest" && (
          <section className="rounded-xl bg-white dark:bg-card p-3">
            {incoming.length > 0 && (
              <button
                onClick={() => setTab("requests")}
                className="btn-press mb-3 flex w-full items-center justify-between rounded-lg bg-blue-50 dark:bg-primary/10 px-3 py-2.5">
                <span className="text-[14px] font-bold text-blue-700 dark:text-primary">{incoming.length} টি ফ্রেন্ড রিকোয়েস্ট</span>
                <span className="text-[13px] font-bold text-blue-600">দেখুন</span>
              </button>
            )}
            <h2 className="mb-3 text-[17px] font-black text-gray-900 dark:text-foreground">আপনি চিনতে পারেন</h2>
            {suggested.isLoading && people.length === 0 ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : (
              <>
                <div className="divide-y divide-gray-100 dark:divide-border/20">
                  {people
                    .filter((p: any) => !hiddenIds[p.id])
                    .map((p: any) => {
                      const name = p.display_name ?? "User";
                      const isSent = sentIds[p.id] || p.status === "pending_sent";
                      return (
                        <div key={p.id} className="flex items-center gap-3 py-3">
                          <Link
                            to="/user/$userId"
                            params={{ userId: p.id }}
                            className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-full bg-gray-200 dark:bg-secondary">
                            <BigPhoto path={p.avatar_url} name={name} />
                          </Link>
                          <div className="min-w-0 flex-1">
                            <Link to="/user/$userId" params={{ userId: p.id }} className="block">
                              <p className="truncate text-[16px] font-bold text-gray-900 dark:text-foreground">{name}</p>
                            </Link>
                            <p className="mb-1.5 truncate text-[12.5px] text-gray-500 dark:text-muted-foreground">
                              {p.mutualCount ? `${p.mutualCount} জন কমন বন্ধু` : `UID ${p.uid_seq ?? "-"}`}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => !isSent && add.mutate(p.id)}
                                disabled={isSent || add.isPending}
                                className={`btn-press flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13.5px] font-bold ${
                                  isSent ? "bg-gray-200 dark:bg-muted text-gray-600 dark:text-muted-foreground" : "bg-blue-600 text-white"
                                }`}>
                                {isSent ? <><Check className="h-4 w-4" /> পাঠানো</> : <><UserPlus className="h-4 w-4" /> বন্ধু যোগ</>}
                              </button>
                              <button
                                onClick={() => setHiddenIds((s) => ({ ...s, [p.id]: true }))}
                                className="btn-press flex-1 rounded-md bg-gray-200 dark:bg-muted py-2 text-[13.5px] font-bold text-gray-800 dark:text-foreground">
                                সরান
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>

                {people.length === 0 && (
                  <p className="py-8 text-center text-sm font-semibold text-gray-500">এখন কোনো সাজেশন নেই</p>
                )}
                {hasMore && people.length > 0 && (
                  <button
                    onClick={() => setOffset((v) => v + 20)}
                    disabled={suggested.isFetching}
                    className="btn-press mt-3 w-full rounded-md bg-gray-100 dark:bg-secondary py-2.5 text-[14px] font-bold text-gray-800 dark:text-foreground disabled:opacity-60">
                    {suggested.isFetching ? "লোড হচ্ছে..." : "আরও দেখুন"}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* বন্ধু তালিকা */}
        {tab === "friends" && (
          <section className="rounded-xl bg-white dark:bg-card p-3">
            <h2 className="mb-2 text-[17px] font-black text-gray-900 dark:text-foreground">
              আপনার বন্ধু {friends.length > 0 && <span className="text-gray-500 dark:text-muted-foreground">({friends.length})</span>}
            </h2>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : friends.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                <p className="text-sm font-semibold text-gray-500">এখনো কোনো বন্ধু নেই</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-border/20">
                {friends.map((f: any) => (
                  <div key={f.linkId} className="flex items-center gap-3 py-2.5">
                    <RoundPhoto path={f.avatar_url} name={f.name} online={onlineIds.has(f.userId)} />
                    <Link to="/user/$userId" params={{ userId: f.userId }} className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-gray-900 dark:text-foreground">{f.name}</p>
                      <p className="text-[12px] text-gray-500 dark:text-muted-foreground">
                        {onlineIds.has(f.userId) ? "এখন অনলাইন" : `UID ${f.uid ?? "-"}`}
                      </p>
                    </Link>
                    <Link
                      to="/chat/$peerId"
                      params={{ peerId: f.userId }}
                      className="btn-press flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[13px] font-bold text-white">
                      <MessageCircle className="h-4 w-4" /> মেসেজ
                    </Link>
                    <button
                      onClick={() => drop.mutate(f.linkId)}
                      className="btn-press flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-secondary text-gray-600 dark:text-muted-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
