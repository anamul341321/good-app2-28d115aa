import { createFileRoute } from "@tanstack/react-router";

const titles: Record<string, string> = {
  comment: "নতুন কমেন্ট",
  reply: "নতুন রিপ্লাই",
  mention: "আপনাকে মেনশন করা হয়েছে",
  like: "নতুন লাইক",
  share: "পোস্ট শেয়ার হয়েছে",
  friend_request: "নতুন ফ্রেন্ড রিকুয়েস্ট",
  friend_accept: "ফ্রেন্ড রিকুয়েস্ট গ্রহণ হয়েছে",
};

export const Route = createFileRoute("/api/public/push/feed-notification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let id = "";
        try {
          id = String(((await request.json()) as { id?: string })?.id ?? "");
        } catch {
          return new Response("bad request", { status: 400 });
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: notice } = await supabaseAdmin
          .from("feed_notifications")
          .select("user_id, type, reference_id, content, created_at")
          .eq("id", id)
          .maybeSingle();
        if (!notice) return new Response("not found", { status: 404 });
        const ageMs = Date.now() - new Date((notice as any).created_at).getTime();
        if (ageMs > 10 * 60 * 1000) return new Response("stale", { status: 409 });

        const type = String((notice as any).type ?? "social_notification");
        const { sendPushToUser } = await import("@/lib/push.server");
        const res = await sendPushToUser((notice as any).user_id, {
          title: titles[type] ?? "Good-App নোটিফিকেশন",
          body: String((notice as any).content ?? "").slice(0, 300),
          url: (notice as any).reference_id ? `/feed?post=${(notice as any).reference_id}` : "/feed",
          collapseKey: `${type}-${(notice as any).reference_id ?? id}`,
          data: {
            type: "social_notification",
            social_type: type,
            reference_id: String((notice as any).reference_id ?? id),
          },
        });
        return Response.json({ ok: true, ...res });
      },
    },
  },
});