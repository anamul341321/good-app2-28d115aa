import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, UserPlus, X } from "lucide-react";
import { deleteMessage, getThread, markChatRead, sendMessage } from "@/lib/chat.functions";
import { respondFriendRequest, sendFriendRequest } from "@/lib/friends.functions";
import { CallButtons } from "@/components/CallProvider";
import { playSentTone } from "@/lib/msg-sound";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { Composer, type SendPayload } from "@/components/chat/Composer";
import { useIsOnline } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  component: ThreadPage,
  head: () => ({
    meta: [
      { title: "চ্যাট — good-app" },
      { name: "description", content: "বন্ধুর সাথে ফ্রি মেসেজ, ছবি, ভিডিও, ভয়েস ও কল — good-app চ্যাট।" },
      { property: "og:title", content: "চ্যাট — good-app" },
      { property: "og:description", content: "ছবি, ভিডিও, ভয়েস মেসেজ ও ফ্রি কল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
    refetchInterval: 8_000,
  });

  const read = useMutation({ mutationFn: () => markChatRead({ data: { peerId } }) });

  useEffect(() => {
    read.mutate(undefined, {
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ["unread-msgs"] });
        void qc.invalidateQueries({ queryKey: ["chats"] });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    onError: (e: any) => toast.error(e?.message ?? "মেসেজ পাঠানো যায়নি"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteMessage({ data: { id } }),
    onSuccess: refresh,
  });

  const addFriend = useMutation({
    mutationFn: () => sendFriendRequest({ data: { userId: peerId } }),
    onSuccess: () => {
      toast.success("ফ্রেন্ড রিকোয়েস্ট পাঠানো হয়েছে");
      refresh();
    },
  });

  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      respondFriendRequest({ data: { linkId: (data as any)?.linkId ?? "", accept } }),
    onSuccess: () => {
      toast.success("হয়ে গেছে");
      refresh();
      void qc.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const me = data?.me as string | undefined;
  const messages = data?.messages ?? [];
  const status = (data as any)?.friendStatus as string | undefined;

  return (
    <div className="flex min-h-[70vh] flex-col pb-6">
      {/* মেসেঞ্জারের মতো — স্ক্রল করলেও কল বাটন সবসময় উপরে আটকে থাকবে */}
      <div
        className="glass sticky z-20 -mx-1 mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-2.5 py-2 shadow-lg"
        style={{ top: "calc(env(safe-area-inset-top,0px) + 4px)" }}
      >
        <Link
          to="/chat"
          className="btn-press grid h-10 w-10 place-items-center rounded-full bg-surface-2"
          aria-label="ফিরে যান"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative shrink-0">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#0084ff] to-[#a033ff] text-sm font-black text-white">
              {(data?.peer?.name ?? "চ").slice(0, 1)}
            </span>
            {online && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{data?.peer?.name ?? "চ্যাট"}</p>
            <p
              className={`truncate text-[11px] font-bold ${
                online ? "text-emerald-500" : "text-muted-foreground"
              }`}
            >
              {online ? "এখন অ্যাকটিভ" : `UID ${data?.peer?.uid ?? "-"}`}
            </p>
          </div>
        </div>
        {data?.peer ? <CallButtons userId={data.peer.userId} name={data.peer.name} /> : <span />}
      </div>

      {status !== "accepted" && data?.peer && (
        <div className="glass mb-3 rounded-2xl p-3">
          {(data as any)?.incomingRequest ? (
            <>
              <p className="text-xs font-black">
                {data.peer.name} আপনাকে ফ্রেন্ড রিকোয়েস্ট পাঠিয়েছে
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => respond.mutate(true)}
                  className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 py-2 text-[11px] font-black text-emerald-500"
                >
                  <Check className="h-3.5 w-3.5" /> অ্যাকসেপ্ট
                </button>
                <button
                  onClick={() => respond.mutate(false)}
                  className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-500/15 py-2 text-[11px] font-black text-rose-500"
                >
                  <X className="h-3.5 w-3.5" /> মুছুন
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-[11px] font-bold text-muted-foreground">
                {status === "pending"
                  ? "রিকোয়েস্ট পাঠানো হয়েছে — অ্যাকসেপ্ট করলে কল করতে পারবেন"
                  : "এটি মেসেজ রিকোয়েস্ট — বন্ধু হলে কল করাও যাবে"}
              </p>
              {status !== "pending" && (
                <button
                  onClick={() => addFriend.mutate()}
                  className="btn-press flex shrink-0 items-center gap-1.5 rounded-xl bg-violet-500/15 px-3 py-2 text-[11px] font-black text-violet-500"
                >
                  <UserPlus className="h-3.5 w-3.5" /> বন্ধু বানান
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2">
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> লোড হচ্ছে…
          </p>
        ) : messages.length === 0 ? (
          <div className="glass rounded-2xl p-5 text-center text-xs font-bold text-muted-foreground">
            এখনো কোনো মেসেজ নেই — নিচে লিখে পাঠান 👋
          </div>
        ) : (
          messages.map((m) => (
            <MessageBubble
              key={m.id}
              m={m}
              mine={m.senderId === me}
              onDelete={(id) => del.mutate(id)}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <Composer onSend={(p) => send.mutate(p)} sending={send.isPending} />
    </div>
  );
}
