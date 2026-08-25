import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { playMessageTone } from "@/lib/msg-sound";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";
import { MessageReplyToast } from "@/components/MessageReplyToast";

/**
 * পুরো অ্যাপ জুড়ে নতুন মেসেজ শোনে — শব্দ বাজায়, টোস্ট দেখায় এবং
 * না-পড়া ব্যাজ (লাল) সাথে সাথে আপডেট করে।
 */
export function ChatNotifier() {
  const qc = useQueryClient();
  const router = useRouter();
  const meRef = useRef<string | null>(null);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      const me = data.session?.user?.id ?? null;
      if (!me || cancelled) return;
      meRef.current = me;

      channel = supabase
        .channel(`msg-inbox-${me}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${me}` },
          (payload: any) => {
            const body = String(payload?.new?.body ?? "");
            const peerId = String(payload?.new?.sender_id ?? "");
            playMessageTone();
            void qc.invalidateQueries({ queryKey: ["unread-msgs"] });
            void qc.invalidateQueries({ queryKey: ["chat-unread-count"] });
            void qc.invalidateQueries({ queryKey: ["chats"] });
            void qc.invalidateQueries({ queryKey: ["thread", peerId] });
            const onThread = window.location.pathname.includes(`/chat/${peerId}`);
            if (!onThread && peerId) {
              void (async () => {
                let name = "নতুন মেসেজ";
                let avatarUrl: string | null = null;
                try {
                  const { data: prof } = await supabase
                    .from("profiles")
                    .select("display_name, avatar_url")
                    .eq("id", peerId)
                    .maybeSingle();
                  if (prof?.display_name) name = prof.display_name;
                  avatarUrl = (prof as any)?.avatar_url ?? null;
                } catch {
                  // no-op
                }
                toast.custom(
                  (id) => (
                    <MessageReplyToast
                      toastId={id}
                      peerId={peerId}
                      name={name}
                      avatarUrl={avatarUrl}
                      body={body}
                      onOpen={() => {
                        toast.dismiss(id);
                        router.navigate({ to: "/chat/$peerId", params: { peerId } });
                      }}
                      onSent={() => {
                        void qc.invalidateQueries({ queryKey: ["thread", peerId] });
                        void qc.invalidateQueries({ queryKey: ["chats"] });
                      }}
                    />
                  ),
                  { duration: 9000 },
                );
              })();
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "friend_links", filter: `addressee_id=eq.${me}` },
          () => {
            void qc.invalidateQueries({ queryKey: ["friends-summary"] });
            void qc.invalidateQueries({ queryKey: ["friends"] });
            void qc.invalidateQueries({ queryKey: ["suggested-people"] });
            toast("নতুন ফ্রেন্ড রিকুয়েস্ট", { description: "Feed-এর Friends ট্যাবে দেখুন" });
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "friend_links", filter: `requester_id=eq.${me}` },
          () => {
            void qc.invalidateQueries({ queryKey: ["friends-summary"] });
            void qc.invalidateQueries({ queryKey: ["friends"] });
            void qc.invalidateQueries({ queryKey: ["suggested-people"] });
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "feed_notifications", filter: `user_id=eq.${me}` },
          (payload: any) => {
            void qc.invalidateQueries({ queryKey: ["notif-count"] });
            void qc.invalidateQueries({ queryKey: ["notifications-list"] });
            const type = String(payload?.new?.type ?? "");
            if (["comment", "reply", "mention", "like", "share", "follow", "subscribe"].includes(type)) {
              const label =
                type === "like" ? "❤️ নতুন লাইক"
                : type === "share" ? "🔗 কেউ শেয়ার করেছে"
                : type === "mention" ? "@ আপনাকে মেনশন করা হয়েছে"
                : type === "subscribe" || type === "follow" ? "🔔 নতুন সাবস্ক্রাইবার"
                : "💬 নতুন কমেন্ট";
              toast(label, { description: String(payload?.new?.content ?? "").slice(0, 90) });
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "friend_messages", filter: `sender_id=eq.${me}` },
          (payload: any) => {
            const peerId = String(payload?.new?.receiver_id ?? "");
            if (peerId) void qc.invalidateQueries({ queryKey: ["thread", peerId] });
            void qc.invalidateQueries({ queryKey: ["chats"] });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc, router]);

  return null;
}
