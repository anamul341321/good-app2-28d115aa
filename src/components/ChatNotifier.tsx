import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { playMessageTone } from "@/lib/msg-sound";
import { toast } from "sonner";
import { useRouter } from "@tanstack/react-router";

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
            void qc.invalidateQueries({ queryKey: ["chats"] });
            void qc.invalidateQueries({ queryKey: ["thread", peerId] });
            const onThread = window.location.pathname.includes(`/chat/${peerId}`);
            if (!onThread) {
              toast("💬 নতুন মেসেজ", {
                description: body.slice(0, 90),
                action: {
                  label: "দেখুন",
                  onClick: () => router.navigate({ to: "/chat/$peerId", params: { peerId } }),
                },
              });
            }
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
