// Resumable Good-App whitelist worker. It saves progress after every 100 keys.
import { createFileRoute } from "@tanstack/react-router";
import { isWhitelistedRPC } from "@/lib/celo-whitelist";

const BATCH_SIZE = 100;
// Exactly one 100-key batch per request. The scheduler resumes from the saved
// cursor, so no request can grow long enough to hit the platform timeout.
const MAX_BATCHES_PER_REQUEST = 1;
const NEXT_CYCLE_DELAY_MS = 3 * 60 * 1000;

export const Route = createFileRoute("/api/public/whitelist-recheck")({
  server: { handlers: { POST: async ({ request }) => {
    const expectedApiKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!expectedApiKey || request.headers.get("apikey") !== expectedApiKey) {
      return new Response("forbidden", { status: 401 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: activeRows } = await supabaseAdmin.from("whitelist_runs").select("*")
      .eq("status", "running").order("started_at", { ascending: false }).limit(1);
    let run: any = activeRows?.[0] ?? null;

    if (!run) {
      const { data: lastRows } = await supabaseAdmin.from("whitelist_runs").select("finished_at")
        .eq("status", "done").order("finished_at", { ascending: false }).limit(1);
      const lastFinished = lastRows?.[0]?.finished_at ? new Date(lastRows[0].finished_at).getTime() : 0;
      const waitMs = NEXT_CYCLE_DELAY_MS - (Date.now() - lastFinished);
      if (lastFinished && waitMs > 0) {
        return Response.json({ ok: true, waiting: true, nextInSeconds: Math.ceil(waitMs / 1000) });
      }
      const [walletCount, pendingCount] = await Promise.all([
        supabaseAdmin.from("tasks").select("id", { count: "exact", head: true })
          .in("status", ["verified", "done"]).not("wallet_address", "is", null),
        supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true })
          .in("kind", ["first_verify", "reverify"]).not("wallet_address", "is", null),
      ]);
      const { data: created, error } = await supabaseAdmin.from("whitelist_runs").insert({
        status: "running", batch_size: BATCH_SIZE, phase: "wallets",
        wallets_total: walletCount.count ?? 0, pending_total: pendingCount.count ?? 0,
        heartbeat_at: new Date().toISOString(),
      }).select("*").maybeSingle();
      if (error || !created) return Response.json({ error: error?.message ?? "run create failed" }, { status: 500 });
      run = created;
    }

    const leaseToken = crypto.randomUUID();
    const { data: leaseClaimed, error: leaseError } = await supabaseAdmin.rpc("claim_whitelist_run", {
      _run_id: run.id,
      _lease_token: leaseToken,
    });
    if (leaseError) return Response.json({ error: leaseError.message }, { status: 500 });
    if (!leaseClaimed) return Response.json({ ok: true, skipped: "worker-active" });

    const affected = new Set<string>();
    let phase = run.phase ?? "wallets";
    let walletCursor = run.wallet_cursor as string | null;
    let pendingCursor = run.pending_cursor as string | null;
    let walletsChecked = Number(run.wallets_checked ?? 0);
    let pendingChecked = Number(run.pending_checked ?? 0);
    let pendingPromoted = Number(run.pending_promoted ?? 0);
    let flipped = Number(run.flipped ?? 0);
    let restored = Number(run.restored ?? 0);
    let batchesDone = Number(run.batches_done ?? 0);
    let completed = false;
    let batchesThisRequest = 0;

    const save = async (extra: Record<string, unknown> = {}) => {
      await supabaseAdmin.from("whitelist_runs").update({
        phase, wallet_cursor: walletCursor, pending_cursor: pendingCursor,
        wallets_checked: walletsChecked, pending_checked: pendingChecked,
        pending_promoted: pendingPromoted, flipped, restored, batches_done: batchesDone,
        heartbeat_at: new Date().toISOString(), ...extra,
      }).eq("id", run.id).eq("lease_token", leaseToken);
    };

    while (batchesThisRequest < MAX_BATCHES_PER_REQUEST && !completed) {
      if (phase === "wallets") {
        let query = supabaseAdmin.from("tasks").select("id,user_id,wallet_address")
          .in("status", ["verified", "done"]).not("wallet_address", "is", null)
          .order("id").limit(BATCH_SIZE);
        if (walletCursor) query = query.gt("id", walletCursor);
        const { data, error } = await query;
        if (error) {
          await save({ status: "error", error_message: error.message, finished_at: new Date().toISOString() });
          return Response.json({ error: error.message }, { status: 500 });
        }
        const batch = data ?? [];
        if (!batch.length) { phase = "pending"; await save(); continue; }
        const flags = await Promise.all(batch.map((task) =>
          isWhitelistedRPC(task.wallet_address as string).catch(() => null)));
        const changes = await Promise.all(batch.map(async (task, index) => {
          if (flags[index] === null) return null;
          const result = await supabaseAdmin.rpc("transition_task_whitelist", {
            _task_id: task.id, _is_whitelisted: flags[index] as boolean,
          });
          return result.error ? null : { state: result.data, userId: task.user_id };
        }));
        for (const change of changes) {
          if (change?.state === "lost") { flipped++; affected.add(change.userId); }
          if (change?.state === "restored") { restored++; affected.add(change.userId); }
        }
        walletsChecked += batch.length;
        walletCursor = batch[batch.length - 1]?.id ?? walletCursor;
        batchesDone++;
        batchesThisRequest++;
        await save();
        continue;
      }

      let query = supabaseAdmin.from("unverified_attempts")
        .select("id,user_id,slot,kind,face_label,face_photo_url,wallet_address,wallet_private_key")
        .in("kind", ["first_verify", "reverify"]).not("wallet_address", "is", null)
        .order("id").limit(BATCH_SIZE);
      if (pendingCursor) query = query.gt("id", pendingCursor);
      const { data, error } = await query;
      if (error) {
        await save({ status: "error", error_message: error.message, finished_at: new Date().toISOString() });
        return Response.json({ error: error.message }, { status: 500 });
      }
      const batch = data ?? [];
      if (!batch.length) { completed = true; break; }
      const flags = await Promise.all(batch.map((attempt) =>
        isWhitelistedRPC(attempt.wallet_address as string).catch(() => null)));
      await Promise.all(batch.map(async (attempt, index) => {
        if (flags[index] !== true) return;
        const { data: existing } = await supabaseAdmin.from("tasks").select("id,user_id")
          .eq("wallet_address", attempt.wallet_address).maybeSingle();
        if (existing) {
          if (attempt.kind === "reverify") {
            const transition = await supabaseAdmin.rpc("transition_task_whitelist", {
              _task_id: existing.id, _is_whitelisted: true,
            });
            if (transition.data === "restored") { restored++; affected.add(existing.user_id); }
          }
          await supabaseAdmin.from("unverified_attempts").delete().eq("id", attempt.id);
          return;
        }
        const { data: userTasks } = await supabaseAdmin.from("tasks").select("id,slot,status")
          .eq("user_id", attempt.user_id).order("slot");
        const target = (userTasks ?? []).find((task) =>
          task.status === "empty" && (!attempt.slot || task.slot === attempt.slot));
        if (!target) return;
        const verifiedAt = new Date();
        const update = await supabaseAdmin.from("tasks").update({
          face_photo_url: attempt.face_photo_url, face_label: attempt.face_label,
          wallet_address: attempt.wallet_address, wallet_private_key: attempt.wallet_private_key,
          status: "verified", initial_verify_at: verifiedAt.toISOString(),
          reverify_due_at: new Date(verifiedAt.getTime() + 4 * 86400000).toISOString(),
          whitelist_ok: true, last_whitelist_check_at: verifiedAt.toISOString(),
        }).eq("id", target.id);
        if (!update.error) {
          await supabaseAdmin.from("unverified_attempts").delete().eq("id", attempt.id);
          pendingPromoted++; affected.add(attempt.user_id);
        }
      }));
      pendingChecked += batch.length;
      pendingCursor = batch[batch.length - 1]?.id ?? pendingCursor;
      batchesDone++;
      batchesThisRequest++;
      await save();
    }

    await Promise.all(Array.from(affected).map((userId) =>
      supabaseAdmin.rpc("settle_mining", { _user_id: userId })));
    if (completed) await save({ status: "done", finished_at: new Date().toISOString(), error_message: null });
    return Response.json({ ok: true, completed, phase, walletsChecked, pendingChecked, batchesDone });
  } } },
});