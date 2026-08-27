import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(10).max(400),
  peerId: z.string().uuid(),
  body: z.string().min(1).max(2000),
});

export const Route = createFileRoute("/api/public/chat/reply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const { verifyReplyToken } = await import("@/lib/chat-reply-token.server");
        const userId = verifyReplyToken(parsed.token);
        if (!userId) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // শুধু accepted বন্ধুকেই রিপ্লাই যাবে।
        const { data: link } = await supabaseAdmin
          .from("friend_links")
          .select("id")
          .eq("status", "accepted")
          .or(
            `and(requester_id.eq.${userId},addressee_id.eq.${parsed.peerId}),and(requester_id.eq.${parsed.peerId},addressee_id.eq.${userId})`,
          )
          .maybeSingle();
        if (!link) return new Response("Forbidden", { status: 403 });

        const { error } = await supabaseAdmin.from("friend_messages").insert({
          sender_id: userId,
          receiver_id: parsed.peerId,
          body: parsed.body,
          kind: "text",
        } as any);
        if (error) return new Response("Failed", { status: 500 });

        try {
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("display_name, avatar_url")
            .eq("id", userId)
            .maybeSingle();
          let senderAvatar = "";
          const avatarPath = (prof as any)?.avatar_url as string | null | undefined;
          if (avatarPath) {
            if (/^https:\/\//i.test(avatarPath)) {
              senderAvatar = avatarPath;
            } else {
              const { data: signed } = await supabaseAdmin.storage
                .from("avatars")
                .createSignedUrl(avatarPath, 60 * 60 * 24 * 7);
              senderAvatar = signed?.signedUrl ?? "";
            }
          }
          const { sendPushToUser } = await import("@/lib/push.server");
          const { createReplyToken } = await import("@/lib/chat-reply-token.server");
          await sendPushToUser(parsed.peerId, {
            title: `💬 ${(prof as any)?.display_name ?? "একজন বন্ধু"}`,
            body: parsed.body.slice(0, 120),
            url: `/chat/${userId}`,
            collapseKey: `chat-${userId}`,
            data: {
              type: "chat_message",
              sender_id: userId,
              sender_name: (prof as any)?.display_name ?? "একজন বন্ধু",
              sender_avatar_url: senderAvatar,
              body: parsed.body.slice(0, 120),
              reply_token: createReplyToken(parsed.peerId),
            },
          });
        } catch {
          /* push best effort */
        }

        return Response.json({ ok: true });
      },
    },
  },
});
