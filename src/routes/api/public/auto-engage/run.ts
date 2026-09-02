// অটো-এনগেজমেন্ট ওয়ার্কার — প্রতি ১৫ মিনিটে নতুন পোস্ট/রিলসে অল্প অল্প করে
// আসল ইউজারদের লাইক ও টপিক-অনুযায়ী বাংলা কমেন্ট যোগ করে।
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/auto-engage/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supplied = request.headers.get("x-cron-secret");
        const { data: expected } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (!expected || !supplied || supplied !== expected) {
          return new Response("forbidden", { status: 401 });
        }

        try {
          const { runAutoEngagement } = await import("@/lib/auto-engage.server");
          const result = await runAutoEngagement();
          return Response.json({ ok: true, ...result });
        } catch (err) {
          return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
