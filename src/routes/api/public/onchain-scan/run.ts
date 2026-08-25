// Background blockchain audit worker for verification wallets.
// One batch per request so no call can hit the platform timeout.
// Protected by the same cron secret as the whitelist worker.
import { createFileRoute } from "@tanstack/react-router";

const BATCH = 40;

export const Route = createFileRoute("/api/public/onchain-scan/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supplied = request.headers.get("x-cron-secret");
        const { data: expected, error: secretError } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (secretError || !expected || !supplied || supplied !== expected) {
          return new Response("forbidden", { status: 401 });
        }

        const wallets = new Set<string>();
        for (let from = 0; ; from += 1000) {
          const { data } = await supabaseAdmin
            .from("tasks")
            .select("wallet_address")
            .not("wallet_address", "is", null)
            .range(from, from + 999);
          (data ?? []).forEach((t: any) => wallets.add(t.wallet_address));
          if (!data || data.length < 1000) break;
        }
        const scanned = new Set<string>();
        for (let from = 0; ; from += 1000) {
          const { data } = await supabaseAdmin
            .from("wallet_onchain_scan")
            .select("wallet_address")
            .range(from, from + 999);
          (data ?? []).forEach((r: any) => scanned.add(r.wallet_address));
          if (!data || data.length < 1000) break;
        }

        const pending = [...wallets].filter((w) => !scanned.has(w));
        const batch = pending.slice(0, BATCH);
        const { scanWallets, recomputePristine } = await import("@/lib/onchain-scan.server");
        if (batch.length > 0) await scanWallets(batch);
        const stats = pending.length <= BATCH ? await recomputePristine() : null;

        return Response.json({
          ok: true,
          total: wallets.size,
          done: scanned.size + batch.length,
          remaining: Math.max(0, pending.length - batch.length),
          pristine: stats?.pristine ?? null,
        });
      },
    },
  },
});
