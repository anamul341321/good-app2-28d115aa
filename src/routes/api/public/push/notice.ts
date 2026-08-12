import { createFileRoute } from "@tanstack/react-router";

/**
 * Database trigger → এই route। user_notices-এ নতুন নোটিশ ঢুকলেই ওই ইউজারের
 * ফোনে push notification পাঠায়। শুধু notice id নেওয়া হয় — টাইটেল/বডি সার্ভার
 * নিজেই DB থেকে পড়ে, তাই বাইরে থেকে ভুয়া মেসেজ পাঠানো সম্ভব নয়।
 */
export const Route = createFileRoute("/api/public/push/notice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let id = "";
        try {
          const body = (await request.json()) as { id?: string };
          id = String(body?.id ?? "");
        } catch {
          return new Response("bad request", { status: 400 });
        }
        if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("bad id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: notice } = await supabaseAdmin
          .from("user_notices")
          .select("user_id, title, body, created_at")
          .eq("id", id)
          .maybeSingle();
        if (!notice) return new Response("not found", { status: 404 });

        // Only fresh notices may trigger a push — blocks replay of old ones.
        const ageMs = Date.now() - new Date((notice as any).created_at).getTime();
        if (ageMs > 10 * 60 * 1000) return new Response("stale", { status: 409 });

        const { sendPushToUser } = await import("@/lib/push.server");
        const res = await sendPushToUser((notice as any).user_id, {
          title: ((notice as any).title as string | null) || "Good-App",
          body: String((notice as any).body ?? "").slice(0, 300),
          url: "/home",
        });
        return Response.json({ ok: true, ...res });
      },
    },
  },
});
