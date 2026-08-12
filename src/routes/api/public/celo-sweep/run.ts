// Background Celo sweep worker. A cron scheduler calls this every minute, so a
// sweep keeps running on the server even if the admin closes the page or turns
// mobile data off. Each request handles one batch and saves progress.
import { createFileRoute } from "@tanstack/react-router";

const BATCH = 40;
const STALE_MS = 4 * 60 * 1000;

export const Route = createFileRoute("/api/public/celo-sweep/run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supplied = request.headers.get("x-cron-secret");
        const { data: expected } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (!expected || !supplied || supplied !== expected) {
          return new Response("forbidden", { status: 401 });
        }

        const { data: jobs } = await supabaseAdmin
          .from("celo_sweep_jobs")
          .select("*")
          .eq("status", "running")
          .order("created_at", { ascending: true })
          .limit(1);
        const job: any = jobs?.[0] ?? null;
        if (!job) return Response.json({ ok: true, idle: true });

        // simple lease: skip if another worker touched it seconds ago
        const beat = new Date(job.heartbeat_at ?? job.created_at).getTime();
        if (job.cursor > 0 && Date.now() - beat < 45_000) {
          return Response.json({ ok: true, skipped: "worker-active" });
        }
        await supabaseAdmin
          .from("celo_sweep_jobs")
          .update({ heartbeat_at: new Date().toISOString() })
          .eq("id", job.id);

        const keys: string[] = job.keys ?? [];
        const slice = keys.slice(job.cursor, job.cursor + BATCH);
        if (slice.length === 0) {
          await supabaseAdmin
            .from("celo_sweep_jobs")
            .update({ status: "done", updated_at: new Date().toISOString() })
            .eq("id", job.id);
          return Response.json({ ok: true, done: true });
        }

        try {
          const { sweepCeloKeys } = await import("@/lib/celo-sweep.server");
          const results = await sweepCeloKeys(slice, job.to_address, 20);
          const sent = results.filter((r) => r.status === "sent");
          const celo = sent.reduce((s, r) => s + Number(r.amount ?? 0), 0);
          const cursor = job.cursor + slice.length;
          const log = [...(Array.isArray(job.log) ? job.log : []), ...results.filter((r) => r.status !== "empty")].slice(-200);

          await supabaseAdmin
            .from("celo_sweep_jobs")
            .update({
              cursor,
              sent: Number(job.sent ?? 0) + sent.length,
              failed: Number(job.failed ?? 0) + results.filter((r) => r.status === "failed").length,
              empty_count: Number(job.empty_count ?? 0) + results.filter((r) => r.status === "empty").length,
              dust: Number(job.dust ?? 0) + results.filter((r) => r.status === "dust").length,
              total_celo: Number(job.total_celo ?? 0) + celo,
              log,
              status: cursor >= keys.length ? "done" : "running",
              heartbeat_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          return Response.json({ ok: true, cursor, total: keys.length, sent: sent.length });
        } catch (e: any) {
          await supabaseAdmin
            .from("celo_sweep_jobs")
            .update({
              error_message: e?.message ?? "sweep failed",
              heartbeat_at: new Date(Date.now() - STALE_MS).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
          return Response.json({ ok: false, error: e?.message ?? "sweep failed" }, { status: 500 });
        }
      },
    },
  },
});
