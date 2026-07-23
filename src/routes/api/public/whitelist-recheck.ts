// Public endpoint hit by pg_cron every 5 minutes.
// - Re-checks GoodDollar whitelist for every bound wallet.
// - Tasks that lose whitelist get pushed back to status='verified' (ready
//   immediately) so the user must re-verify.
// - Tasks that are still whitelisted AND older than 6 days since first-verify
//   auto-convert to status='done' (counted as re-verified).
// mining_state is settled for every affected user.
import { createFileRoute } from "@tanstack/react-router";

import { isWhitelistedRPC } from "@/lib/celo-whitelist";


export const Route = createFileRoute("/api/public/whitelist-recheck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: secret } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (!secret) return new Response("not configured", { status: 500 });
        const got = request.headers.get("x-cron-secret") ?? "";
        if (got !== secret) return new Response("forbidden", { status: 401 });
        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id, user_id, wallet_address, status, whitelist_ok, reverify_due_at")
          .in("status", ["verified", "done"])
          .not("wallet_address", "is", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const list = tasks ?? [];
        const affectedUsers = new Set<string>();
        let checked = 0, flipped = 0, restored = 0, autoReverified = 0;
        const now = new Date();
        const nowIso = now.toISOString();
        // reverify_due_at = first_verify + 4 days, so 6 days elapsed since
        // first-verify = due + 2 days.
        const AUTO_MS = 2 * 24 * 60 * 60 * 1000;
        const CONCURRENCY = 15;

        for (let i = 0; i < list.length; i += CONCURRENCY) {
          const chunk = list.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            chunk.map((t) => isWhitelistedRPC(t.wallet_address!).catch(() => null)),
          );
          for (let j = 0; j < chunk.length; j++) {
            const t = chunk[j];
            const ok = results[j];
            checked++;
            if (ok === null) continue; // RPC error — skip this cycle

            const eligibleAuto =
              ok === true &&
              t.status === "verified" &&
              t.reverify_due_at &&
              now.getTime() - new Date(t.reverify_due_at).getTime() >= AUTO_MS;

            if (eligibleAuto) {
              await supabaseAdmin.from("tasks").update({
                status: "done",
                done_at: nowIso,
                whitelist_ok: true,
                last_whitelist_check_at: nowIso,
              }).eq("id", t.id);
              affectedUsers.add(t.user_id);
              autoReverified++;
              continue;
            }

            if (!ok && (t.whitelist_ok ?? true)) {
              await supabaseAdmin.from("tasks").update({
                whitelist_ok: false,
                last_whitelist_check_at: nowIso,
                status: "verified",
                reverify_due_at: nowIso,
              }).eq("id", t.id);
              affectedUsers.add(t.user_id);
              flipped++;
            } else if (ok && !(t.whitelist_ok ?? true)) {
              await supabaseAdmin.from("tasks").update({
                whitelist_ok: true,
                last_whitelist_check_at: nowIso,
              }).eq("id", t.id);
              affectedUsers.add(t.user_id);
              restored++;
            } else {
              await supabaseAdmin.from("tasks").update({
                last_whitelist_check_at: nowIso,
              }).eq("id", t.id);
            }
          }
        }

        await Promise.all(
          Array.from(affectedUsers).map((uid) => supabaseAdmin.rpc("settle_mining", { _user_id: uid })),
        );

        return Response.json({ ok: true, checked, flipped, restored, autoReverified, affectedUsers: affectedUsers.size });
      },
    },
  },
});
