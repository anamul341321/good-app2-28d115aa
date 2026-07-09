import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const TASK_COLS = "id,slot,status,face_label,face_photo_url,wallet_address,initial_verify_at,reverify_due_at,done_at,whitelist_ok,last_whitelist_check_at,created_at,user_id";
    const [{ data: profile }, tasksResult, { data: mining }, { data: wallet }, { data: roles }, { count: pendingCount }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabaseAdmin.from("tasks").select(TASK_COLS).eq("user_id", userId).order("slot"),
        supabase.from("mining_state").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("kind", "first_verify"),
      ]);

    const bonusFirstClaimed = !!(profile as any)?.bonus_first_verify_claimed;
    const bonusReverifyClaimed = !!(profile as any)?.bonus_reverify_claimed;

    if (tasksResult.error) throw new Error(tasksResult.error.message);

    let tasks = tasksResult.data ?? [];
    if (tasks.length === 0) {
      const rows = Array.from({ length: 10 }, (_, index) => ({
        user_id: userId,
        slot: index + 1,
        status: "empty" as const,
      }));

      const { error: seedError } = await supabaseAdmin
        .from("tasks")
        .upsert(rows, { onConflict: "user_id,slot", ignoreDuplicates: true });
      if (seedError) throw new Error(seedError.message);

      const { data: seededTasks, error: refetchError } = await supabaseAdmin
        .from("tasks")
        .select(TASK_COLS)
        .eq("user_id", userId)
        .order("slot");
      if (refetchError) throw new Error(refetchError.message);
      tasks = seededTasks ?? [];
    }

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const tasksWithPhotos = await Promise.all(
      (tasks ?? []).map(async (task: any) => {
        if (!task.face_photo_url) return { ...task, signed_face_url: null };
        const { data: signed } = await supabaseAdmin.storage
          .from("face-photos")
          .createSignedUrl(task.face_photo_url, 60 * 30);
        return { ...task, signed_face_url: signed?.signedUrl ?? null };
      }),
    );

    const firstVerifyCount = (tasksWithPhotos ?? []).filter(
      (t: any) => t.status === "verified" || t.status === "done",
    ).length;
    const reverifyCount = (tasksWithPhotos ?? []).filter((t: any) => t.status === "done").length;

    return {
      profile,
      tasks: tasksWithPhotos,
      mining,
      wallet,
      isAdmin,
      pendingSubmits: pendingCount ?? 0,
      bonus: {
        firstVerifyCount,
        reverifyCount,
        firstClaimed: bonusFirstClaimed,
        reverifyClaimed: bonusReverifyClaimed,
        firstClaimable: firstVerifyCount >= 10 && !bonusFirstClaimed,
        reverifyClaimable: reverifyCount >= 10 && !bonusReverifyClaimed,
        amount: 100,
      },
    };
  });

export const getMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("withdrawals")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });
