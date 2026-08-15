import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  campaignId: z.string().uuid(),
  token: z.string().min(10).max(200),
});

export const Route = createFileRoute("/api/public/broadcast/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const { verifyCampaignToken, runCampaign } = await import(
          "@/lib/telegram-broadcast.server"
        );
        if (!verifyCampaignToken(parsed.campaignId, parsed.token)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const origin = new URL(request.url).origin;
        const result = await runCampaign(parsed.campaignId, origin);
        return Response.json(result);
      },
    },
  },
});
