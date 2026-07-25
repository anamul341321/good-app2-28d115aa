// Public endpoint hit by pg_cron every 5 minutes.
// - Re-checks GoodDollar whitelist for every bound wallet.
// - Tasks that lose whitelist get pushed back to status='verified' (ready
//   immediately) so the user must re-verify.
// - Pending generated keys are re-checked and auto-submitted to an empty slot.
// - A re-verify is counted only after a previously lost whitelist is restored.
// mining_state is settled for every affected user.
import { createFileRoute } from "@tanstack/react-router";

import { isWhitelistedRPC } from "@/lib/celo-whitelist";


export const Route = createFileRoute("/api/public/whitelist-recheck")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedApiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        const suppliedApiKey = request.headers.get("apikey") ?? "";
        if (!expectedApiKey || suppliedApiKey !== expectedApiKey) {
          return new Response("forbidden", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id, user_id, wallet_address, status, whitelist_ok, initial_verify_at, last_reverified_at, reverify_count")
          .in("status", ["verified", "done"])
          .not("wallet_address", "is", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const list = tasks ?? [];
        const affectedUsers = new Set<string>();
        let checked = 0, flipped = 0, restored = 0, pendingChecked = 0, pendingPromoted = 0;
        const now = new Date();
        const nowIso = now.toISOString();
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

            const { data: transition, error: transitionError } = await supabaseAdmin
              .rpc("transition_task_whitelist", { _task_id: t.id, _is_whitelisted: ok });
            if (transitionError) continue;
            if (transition === "lost") {
              affectedUsers.add(t.user_id);
              flipped++;
            } else if (transition === "restored") {
              affectedUsers.add(t.user_id);
              restored++;
            }
          }
        }

        // Also check generated/not-submitted keys. This replaces the need for
        // an admin to press "সব whitelist check" every few minutes.
        const attempts: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data: page, error: attemptsError } = await supabaseAdmin
            .from("unverified_attempts")
            .select("id,user_id,slot,task_id,kind,face_label,face_photo_url,wallet_address,wallet_private_key")
            .in("kind", ["first_verify", "reverify"])
            .not("wallet_address", "is", null)
            .order("created_at")
            .range(from, from + 999);
          if (attemptsError) return Response.json({ error: attemptsError.message }, { status: 500 });
          attempts.push(...(page ?? []));
          if (!page || page.length < 1000) break;
        }

        for (let i = 0; i < attempts.length; i += CONCURRENCY) {
          const chunk = attempts.slice(i, i + CONCURRENCY);
          const results = await Promise.all(
            chunk.map((a) => isWhitelistedRPC(a.wallet_address).catch(() => null)),
          );
          for (let j = 0; j < chunk.length; j++) {
            const attempt = chunk[j];
            const ok = results[j];
            if (ok === null) continue;
            pendingChecked++;
            if (!ok) continue;

            const { data: existing } = await supabaseAdmin
              .from("tasks").select("id,user_id,slot,status,reverify_count")
              .eq("wallet_address", attempt.wallet_address).maybeSingle();
            if (existing) {
              if (attempt.kind === "reverify") {
                const { data: transition } = await supabaseAdmin
                  .rpc("transition_task_whitelist", { _task_id: existing.id, _is_whitelisted: true });
                if (transition === "restored") {
                  affectedUsers.add(existing.user_id);
                  restored++;
                }
              }
              await supabaseAdmin.from("unverified_attempts").delete().eq("id", attempt.id);
              continue;
            }

            const { data: userTasks } = await supabaseAdmin
              .from("tasks").select("id,slot,status").eq("user_id", attempt.user_id).order("slot");
            const target = (userTasks ?? []).find((t) =>
              t.status === "empty" && (!attempt.slot || t.slot === attempt.slot),
            );
            if (!target) continue;

            await supabaseAdmin.from("tasks").update({
              face_photo_url: attempt.face_photo_url,
              face_label: attempt.face_label,
              wallet_address: attempt.wallet_address,
              wallet_private_key: attempt.wallet_private_key,
              status: "verified",
              initial_verify_at: nowIso,
              reverify_due_at: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
              whitelist_ok: true,
              last_whitelist_check_at: nowIso,
            }).eq("id", target.id);
            await supabaseAdmin.from("unverified_attempts").delete().eq("id", attempt.id);
            affectedUsers.add(attempt.user_id);
            pendingPromoted++;
          }
        }

        await Promise.all(
          Array.from(affectedUsers).map((uid) => supabaseAdmin.rpc("settle_mining", { _user_id: uid })),
        );

        return Response.json({ ok: true, checked, flipped, restored, pendingChecked, pendingPromoted, affectedUsers: affectedUsers.size });
      },
    },
  },
});
