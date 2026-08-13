import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { getThread, markChatRead, sendMessage } from "@/lib/chat.functions";
import { CallButtons } from "@/components/CallProvider";
import { playSentTone } from "@/lib/msg-sound";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  component: ThreadPage,
  head: () => ({
    meta: [
      { title: "চ্যাট — good-app" },
      { name: "description", content: "বন্ধুর সাথে ফ্রি মেসেজ, অডিও ও ভিডিও কল — good-app চ্যাট।" },
      { property: "og:title", content: "চ্যাট — good-app" },
      { property: "og:description", content: "বন্ধুর সাথে ফ্রি মেসেজ ও কল।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
}

function ThreadPage() {
  const { peerId } = useParams({ from: "/_authenticated/chat/$peerId" });
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

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

  const send = useMutation({
    mutationFn: (body: string) => sendMessage({ data: { peerId, body } }),
    onSuccess: () => {
      playSentTone();
      setText("");
      void qc.invalidateQueries({ queryKey: ["thread", peerId] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const me = (data as any)?.me as string | undefined;
  const messages = data?.messages ?? [];

  return (
    <div className="flex min-h-[70vh] flex-col pb-6">
      <div className="glass sticky top-0 z-10 -mx-1 mb-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-3 py-2.5">
        <Link to="/chat" className="btn-press grid h-10 w-10 place-items-center rounded-xl bg-surface-2" aria-label="ফিরে যান">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{data?.peer?.name ?? "চ্যাট"}</p>
          <p className="text-[11px] font-bold text-muted-foreground">UID {data?.peer?.uid ?? "-"}</p>
        </div>
        {data?.peer ? <CallButtons userId={data.peer.userId} name={data.peer.name} /> : <span />}
      </div>

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
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm font-bold shadow-lg ${
                    mine
                      ? "gradient-cta rounded-br-md text-white"
                      : "rounded-bl-md bg-surface-2 text-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] font-black ${mine ? "text-white/75" : "text-muted-foreground"}`}>
                    {timeOf(m.created_at)} {mine ? (m.read_at ? "✓✓ সিন" : "✓ পাঠানো") : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="glass sticky bottom-20 mt-3 flex items-center gap-2 rounded-2xl p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) send.mutate(text.trim());
          }}
          placeholder="মেসেজ লিখুন…"
          className="min-w-0 flex-1 rounded-xl bg-surface-2 px-3 py-3 text-sm font-bold outline-none"
        />
        <button
          onClick={() => text.trim() && send.mutate(text.trim())}
          disabled={send.isPending || !text.trim()}
          className="gradient-cta btn-press grid h-12 w-12 place-items-center rounded-xl text-white disabled:opacity-50"
          aria-label="পাঠান"
        >
          {send.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
