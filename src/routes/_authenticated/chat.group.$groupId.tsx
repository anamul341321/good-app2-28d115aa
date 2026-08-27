import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, LogOut, Loader2, Users } from "lucide-react";
import {
  deleteMessage,
  getGroupThread,
  leaveGroup,
  markGroupRead,
  sendMessage,
} from "@/lib/chat.functions";
import { playSentTone } from "@/lib/msg-sound";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type SendPayload } from "@/components/chat/Composer";
import { usePresence } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/chat/group/$groupId")({
  component: GroupThreadPage,
  head: () => ({
    meta: [
      { title: "গ্রুপ চ্যাট — good-app" },
      {
        name: "description",
        content: "good-app গ্রুপ চ্যাট — বন্ধুদের সাথে একসাথে মেসেজ, ছবি, ভিডিও ও ভয়েস শেয়ার করুন।",
      },
      { property: "og:title", content: "গ্রুপ চ্যাট — good-app" },
      { property: "og:description", content: "বন্ধুদের সাথে গ্রুপে কথা বলুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function GroupThreadPage() {
  const { groupId } = useParams({ from: "/_authenticated/chat/group/$groupId" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const endRef = useRef<HTMLDivElement | null>(null);
  const onlineIds = usePresence();
  const [showMembers, setShowMembers] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; body?: string; kind?: string; name?: string } | null>(null);


  const { data, isLoading } = useQuery({
    queryKey: ["group-thread", groupId],
    queryFn: () => getGroupThread({ data: { groupId } }),
    refetchInterval: 8_000,
  });

  const read = useMutation({ mutationFn: () => markGroupRead({ data: { groupId } }) });

  useEffect(() => {
    read.mutate(undefined, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["unread-msgs"] });
        void qc.invalidateQueries({ queryKey: ["chats"] });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, data?.messages?.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["group-thread", groupId] });
    void qc.invalidateQueries({ queryKey: ["chats"] });
  };

  const send = useMutation({
    mutationFn: (p: SendPayload) => sendMessage({ data: { groupId, ...p } }),
    onSuccess: () => {
      playSentTone();
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "মেসেজ পাঠানো যায়নি"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: refresh,
  });

  const quit = useMutation({
    mutationFn: () => leaveGroup({ data: { groupId } }),
    onSuccess: () => {
      toast.success("গ্রুপ ছেড়ে দিয়েছেন");
      void qc.invalidateQueries({ queryKey: ["chats"] });
      void navigate({ to: "/chat" });
    },
  });

  const me = data?.me as string | undefined;
  const messages = data?.messages ?? [];
  const members = data?.members ?? [];
  const onlineCount = members.filter((m) => onlineIds.has(m.userId)).length;

  return (
    <div className="flex min-h-[70vh] flex-col pb-6">
      <div className="glass sticky top-0 z-10 safe-top -mx-1 mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5">
        <Link
          to="/chat"
          className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-surface-2"
          aria-label="ফিরে যান"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button onClick={() => setShowMembers((v) => !v)} className="min-w-0 text-left">
          <p className="truncate text-sm font-black">{data?.group?.name ?? "গ্রুপ"}</p>
          <p className="truncate text-[11px] font-bold text-muted-foreground">
            {members.length} জন সদস্য
            {onlineCount > 0 && <span className="text-emerald-500"> • {onlineCount} জন অ্যাকটিভ</span>}
          </p>
        </button>
        <button
          onClick={() => quit.mutate()}
          className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-rose-500/15 text-rose-500"
          aria-label="গ্রুপ ছাড়ুন"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      {showMembers && (
        <div className="glass mb-3 rounded-2xl p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-cyan">
            <Users className="h-4 w-4" /> সদস্য
          </p>
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2">
                <span
                  className={`h-2 w-2 rounded-full ${
                    onlineIds.has(m.userId) ? "bg-emerald-500" : "bg-muted-foreground/40"
                  }`}
                />
                <p className="min-w-0 flex-1 truncate text-xs font-black">{m.name}</p>
                <p className="text-[10px] font-bold text-muted-foreground">
                  {m.role === "admin" ? "অ্যাডমিন" : `UID ${m.uid ?? "-"}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-2">
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
          </p>
        ) : messages.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-center text-xs font-bold text-muted-foreground">
            গ্রুপে এখনো কোনো মেসেজ নেই — প্রথম মেসেজটা আপনিই দিন 👋
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.senderId === me}
              showName
              onDelete={(id) => del.mutate(id)}
              onReply={(msg) =>
                setReplyTo({ id: msg.id, body: msg.body, kind: msg.kind, name: msg.senderName ?? "মেসেজ" })
              }
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <Composer
        onSend={(p) => send.mutate(p)}
        sending={send.isPending}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
