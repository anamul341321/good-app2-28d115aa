import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Search, UserPlus, Users, X, Loader2, PhoneCall, MessageCircle } from "lucide-react";
import {
  listFriends,
  respondFriendRequest,
  searchPeople,
  sendFriendRequest,
  removeFriend,
} from "@/lib/friends.functions";
import { CallButtons } from "@/components/CallProvider";

export const Route = createFileRoute("/_authenticated/friends")({
  component: FriendsPage,
  head: () => ({
    meta: [
      { title: "বন্ধু ও কল — good-app" },
      {
        name: "description",
        content: "good-app-এ বন্ধু যোগ করুন এবং অ্যাপের ভেতরেই ফ্রি অডিও ও ভিডিও কলে কথা বলুন।",
      },
      { property: "og:title", content: "বন্ধু ও কল — good-app" },
      {
        property: "og:description",
        content: "ফ্রেন্ড রিকোয়েস্ট পাঠান, অ্যাকসেপ্ট হলেই ফ্রি অডিও/ভিডিও কল।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Avatar({ name }: { name: string }) {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 text-sm font-black text-white">
      {name.slice(0, 1)}
    </div>
  );
}

function FriendsPage() {
  const [q, setQ] = useState("");
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
    <div className="space-y-4 pb-8 pt-1">
      <div className="text-center">
        <h1 className="text-lg font-black text-navy">বন্ধু ও কল</h1>
        <p className="text-[11px] font-bold text-muted-foreground">
          বন্ধু যোগ করুন — অ্যাকসেপ্ট হলেই ফ্রি অডিও/ভিডিও কল
        </p>
      </div>

      <div className="glass rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && q.trim()) search.mutate(q.trim());
              }}
              placeholder="UID নম্বর বা নাম লিখুন"
              className="w-full bg-transparent text-sm font-bold outline-none"
            />
          </div>
          <button
            onClick={() => q.trim() && search.mutate(q.trim())}

            className="gradient-cta btn-press rounded-xl px-4 py-2.5 text-xs font-black text-white"
          >
            খুঁজুন
          </button>
        </div>

        {search.isPending && (
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> খোঁজা হচ্ছে…
          </p>
        )}
        {!search.isPending && search.isSuccess && found.length === 0 && (
          <p className="mt-3 text-xs font-bold text-muted-foreground">কাউকে পাওয়া যায়নি</p>
        )}
        {found.length > 0 && (
          <div className="mt-3 space-y-2">
            {found.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                <Avatar name={p.display_name ?? "ইউজার"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{p.display_name ?? "ইউজার"}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">UID {p.uid_seq ?? "-"}</p>
                </div>
                <button
                  onClick={() => add.mutate(p.id)}
                  className="btn-press flex items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-[11px] font-black text-violet-500"
                >
                  <UserPlus className="h-3.5 w-3.5" /> যোগ করুন
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(data?.incoming?.length ?? 0) > 0 && (
        <div className="glass rounded-2xl p-3">
          <p className="mb-2 text-xs font-black text-amber">আসা রিকোয়েস্ট</p>
          <div className="space-y-2">
            {data!.incoming.map((r) => (
              <div key={r.linkId} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{r.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">UID {r.uid ?? "-"}</p>
                </div>
                <button
                  onClick={() => respond.mutate({ linkId: r.linkId, accept: true })}
                  className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500"
                  aria-label="গ্রহণ"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => respond.mutate({ linkId: r.linkId, accept: false })}
                  className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-500"
                  aria-label="বাতিল"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-3">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-cyan">
          <Users className="h-4 w-4" /> আমার বন্ধু ({data?.friends?.length ?? 0})
        </p>
        {isLoading ? (
          <p className="text-xs font-bold text-muted-foreground">লোড হচ্ছে…</p>
        ) : (data?.friends?.length ?? 0) === 0 ? (
          <div className="rounded-xl bg-surface-2 p-4 text-center">
            <PhoneCall className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-xs font-bold text-muted-foreground">
              এখনো কোনো বন্ধু নেই — উপরে UID/নাম দিয়ে খুঁজে রিকোয়েস্ট পাঠান
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data!.friends.map((f) => (
              <div key={f.linkId} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                <Avatar name={f.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{f.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">UID {f.uid ?? "-"}</p>
                </div>
                <Link
                  to="/chat/$peerId"
                  params={{ peerId: f.userId }}
                  aria-label="মেসেজ"
                  className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500"
                >
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <CallButtons userId={f.userId} name={f.name} />
                <button
                  onClick={() => drop.mutate(f.linkId)}
                  className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-muted-foreground"
                  aria-label="সরান"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {(data?.outgoing?.length ?? 0) > 0 && (
        <div className="glass rounded-2xl p-3">
          <p className="mb-2 text-xs font-black text-muted-foreground">পাঠানো রিকোয়েস্ট</p>
          <div className="space-y-2">
            {data!.outgoing.map((r) => (
              <div key={r.linkId} className="flex items-center gap-3 rounded-xl bg-surface-2 p-2.5">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{r.name}</p>
                  <p className="text-[11px] font-bold text-muted-foreground">অপেক্ষায় আছে…</p>
                </div>
                <button
                  onClick={() => drop.mutate(r.linkId)}
                  className="btn-press rounded-xl bg-white/5 px-3 py-2 text-[11px] font-black text-muted-foreground"
                >
                  বাতিল
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
