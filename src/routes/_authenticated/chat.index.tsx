import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MessageCircle, Plus, UserPlus, Users, X } from "lucide-react";
import { createGroup, listChats } from "@/lib/chat.functions";
import { listFriends } from "@/lib/friends.functions";
import { usePresence } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatListPage,
  head: () => ({
    meta: [
      { title: "মেসেজ, গ্রুপ ও কল — good-app" },
      {
        name: "description",
        content:
          "good-app-এ ফ্রি মেসেজ, ছবি ও ভিডিও শেয়ার, ভয়েস মেসেজ, গ্রুপ চ্যাট এবং অডিও/ভিডিও কল — এক জায়গায় সব।",
      },
      { property: "og:title", content: "মেসেজ, গ্রুপ ও কল — good-app" },
      { property: "og:description", content: "ফ্রি চ্যাট, গ্রুপ, ভয়েস মেসেজ ও কল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Avatar({ name, online, group }: { name: string; online?: boolean; group?: boolean }) {
  return (
    <span className="relative shrink-0">
      <span
        className={`grid h-12 w-12 place-items-center rounded-full text-base font-black text-white ${
          group
            ? "bg-gradient-to-br from-amber-500 to-rose-500"
            : "bg-gradient-to-br from-cyan-500 to-violet-600"
        }`}
      >
        {group ? <Users className="h-5 w-5" /> : name.slice(0, 1)}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
      )}
    </span>
  );
}

type Tab = "chats" | "requests" | "groups";

function ChatListPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const onlineIds = usePresence();
  const [tab, setTab] = useState<Tab>("chats");
  const [newGroup, setNewGroup] = useState(false);
  const [gName, setGName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["chats"],
    queryFn: () => listChats(),
    refetchInterval: 15_000,
  });
  const friends = useQuery({ queryKey: ["friends"], queryFn: () => listFriends(), staleTime: 30_000 });

  const make = useMutation({
    mutationFn: () => createGroup({ data: { name: gName.trim(), memberIds: picked } }),
    onSuccess: (r: any) => {
      toast.success("গ্রুপ তৈরি হয়েছে");
      setNewGroup(false);
      setGName("");
      setPicked([]);
      void qc.invalidateQueries({ queryKey: ["chats"] });
      if (r?.groupId) void navigate({ to: "/chat/group/$groupId", params: { groupId: r.groupId } });
    },
    onError: (e: any) => toast.error(e?.message ?? "গ্রুপ তৈরি হয়নি"),
  });

  const chats = data?.chats ?? [];
  const requests = data?.requests ?? [];
  const groups = data?.groups ?? [];
  const friendList = friends.data?.friends ?? [];
  const chatted = new Set(chats.map((c) => c.peerId));
  const others = friendList.filter((f) => !chatted.has(f.userId));
  const reqUnread = requests.reduce((s, r) => s + r.unread, 0);
  const groupUnread = groups.reduce((s, g) => s + g.unread, 0);
  const friendReqs = friends.data?.incoming?.length ?? 0;

  const TabBtn = ({ id, label, badge }: { id: Tab; label: string; badge?: number }) => (
    <button
      onClick={() => setTab(id)}
      className={`btn-press relative flex-1 rounded-xl px-3 py-2 text-[11px] font-black transition ${
        tab === id ? "gradient-cta text-white shadow-lg" : "bg-surface-2 text-muted-foreground"
      }`}
    >
      {label}
      {!!badge && badge > 0 && (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );

  const activeFriends = friendList.filter((f) => onlineIds.has(f.userId));

  return (
    <div className="space-y-4 pb-8 pt-1">
      <div className="text-center">
        <h1 className="text-lg font-black text-navy">মেসেজ, গ্রুপ ও কল</h1>
        <p className="text-[11px] font-bold text-muted-foreground">
          ছবি, ভিডিও, ভয়েস মেসেজ ও ফ্রি অডিও/ভিডিও কল
        </p>
      </div>

      {/* এখন অ্যাকটিভ — মেসেঞ্জারের মতো সবুজ ডটসহ সারি */}
      <div className="glass rounded-2xl p-3">
        <p className="flex items-center gap-2 text-[11px] font-black">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          {activeFriends.length > 0
            ? `এখন অ্যাকটিভ — ${activeFriends.length} জন`
            : "এখন কেউ অ্যাকটিভ নেই"}
        </p>
        {activeFriends.length > 0 && (
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {activeFriends.map((f) => (
              <Link
                key={f.userId}
                to="/chat/$peerId"
                params={{ peerId: f.userId }}
                className="btn-press flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <Avatar name={f.name} online />
                <span className="w-full truncate text-center text-[10px] font-bold text-muted-foreground">
                  {f.name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>


      <div className="grid grid-cols-2 gap-2">
        <Link
          to="/friends"
          className="glass btn-press relative flex items-center gap-2 rounded-2xl p-3"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-500">
            <UserPlus className="h-5 w-5" />
          </span>
          <span className="min-w-0 text-[11px] font-black leading-tight">
            বন্ধু যোগ করুন
            <span className="block font-bold text-muted-foreground">UID/নাম দিয়ে খুঁজুন</span>
          </span>
          {friendReqs > 0 && (
            <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
              {friendReqs}
            </span>
          )}
        </Link>
        <button
          onClick={() => setNewGroup((v) => !v)}
          className="glass btn-press flex items-center gap-2 rounded-2xl p-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-500">
            <Plus className="h-5 w-5" />
          </span>
          <span className="min-w-0 text-[11px] font-black leading-tight">
            নতুন গ্রুপ
            <span className="block font-bold text-muted-foreground">বন্ধুদের নিয়ে গ্রুপ</span>
          </span>
        </button>
      </div>

      {newGroup && (
        <div className="glass rounded-2xl p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black">নতুন গ্রুপ তৈরি করুন</p>
            <button onClick={() => setNewGroup(false)} aria-label="বন্ধ" className="btn-press">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <input
            value={gName}
            onChange={(e) => setGName(e.target.value)}
            placeholder="গ্রুপের নাম"
            className="mt-2 w-full rounded-xl bg-surface-2 px-3 py-2.5 text-sm font-bold outline-none"
          />
          <p className="mt-3 text-[11px] font-black text-muted-foreground">সদস্য বাছুন</p>
          <div className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto">
            {friendList.length === 0 && (
              <p className="rounded-xl bg-surface-2 p-3 text-center text-[11px] font-bold text-muted-foreground">
                আগে বন্ধু যোগ করুন
              </p>
            )}
            {friendList.map((f) => {
              const on = picked.includes(f.userId);
              return (
                <button
                  key={f.userId}
                  onClick={() =>
                    setPicked((p) => (on ? p.filter((x) => x !== f.userId) : [...p, f.userId]))
                  }
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left ${
                    on ? "bg-emerald-500/15" : "bg-surface-2"
                  }`}
                >
                  <Avatar name={f.name} online={onlineIds.has(f.userId)} />
                  <span className="min-w-0 flex-1 truncate text-xs font-black">{f.name}</span>
                  <span className="text-[10px] font-black text-emerald-600">{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => make.mutate()}
            disabled={make.isPending || !gName.trim()}
            className="gradient-cta btn-press mt-3 w-full rounded-xl py-2.5 text-xs font-black text-white disabled:opacity-50"
          >
            {make.isPending ? "তৈরি হচ্ছে…" : "গ্রুপ তৈরি করুন"}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <TabBtn id="chats" label="চ্যাট" />
        <TabBtn id="requests" label="মেসেজ রিকোয়েস্ট" badge={requests.length ? requests.length : reqUnread} />
        <TabBtn id="groups" label="গ্রুপ" badge={groupUnread} />
      </div>

      <div className="glass rounded-2xl p-3">
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
          </p>
        ) : tab === "chats" ? (
          <div className="space-y-2">
            {chats.length === 0 && others.length === 0 && (
              <p className="rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-muted-foreground">
                এখনো কোনো চ্যাট নেই — উপরে বন্ধু যোগ করুন
              </p>
            )}
            {chats.map((c) => (
              <Row
                key={c.peerId}
                to="peer"
                id={c.peerId}
                name={c.name}
                sub={`${c.mine ? "আপনি: " : ""}${c.lastBody}`}
                unread={c.unread}
                online={onlineIds.has(c.peerId)}
              />
            ))}
            {others.map((f) => (
              <Row
                key={f.userId}
                to="peer"
                id={f.userId}
                name={f.name}
                sub="নতুন কথা শুরু করুন"
                unread={0}
                online={onlineIds.has(f.userId)}
              />
            ))}
          </div>
        ) : tab === "requests" ? (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-muted-foreground">
                কোনো মেসেজ রিকোয়েস্ট নেই
              </p>
            ) : (
              requests.map((c) => (
                <Row
                  key={c.peerId}
                  to="peer"
                  id={c.peerId}
                  name={c.name}
                  sub={c.lastBody}
                  unread={c.unread}
                  online={onlineIds.has(c.peerId)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.length === 0 ? (
              <p className="rounded-xl bg-surface-2 p-4 text-center text-xs font-bold text-muted-foreground">
                কোনো গ্রুপ নেই — উপরে "নতুন গ্রুপ" চাপুন
              </p>
            ) : (
              groups.map((g) => (
                <Row key={g.groupId} to="group" id={g.groupId} name={g.name} sub={g.lastBody} unread={g.unread} group />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  to,
  id,
  name,
  sub,
  unread,
  online,
  group,
}: {
  to: "peer" | "group";
  id: string;
  name: string;
  sub: string;
  unread: number;
  online?: boolean;
  group?: boolean;
}) {
  const hot = unread > 0;
  const inner = (
    <>
      <Avatar name={name} online={online} group={group} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-black ${hot ? "text-rose-500" : ""}`}>{name}</span>
        <span
          className={`block truncate text-[11px] ${
            hot ? "font-black text-foreground" : "font-bold text-muted-foreground"
          }`}
        >
          {sub}
        </span>
      </span>
      {hot && (
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </>
  );
  const cls = "btn-press flex items-center gap-3 rounded-xl bg-surface-2 p-2.5";
  return to === "group" ? (
    <Link to="/chat/group/$groupId" params={{ groupId: id }} className={cls}>
      {inner}
    </Link>
  ) : (
    <Link to="/chat/$peerId" params={{ peerId: id }} className={cls}>
      {inner}
    </Link>
  );
}
