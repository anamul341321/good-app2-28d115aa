import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const TASK_COLS = "id,slot,status,face_label,face_photo_url,wallet_address,initial_verify_at,reverify_due_at,done_at,reverify_count,last_reverified_at,whitelist_ok,last_whitelist_check_at,created_at,user_id";
    const [{ data: profile }, tasksResult, { data: mining }, { data: walletList }, { data: roles }, { count: pendingCount }, { data: bonusSettings }, { data: balanceBreakdown }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabaseAdmin.from("tasks").select(TASK_COLS).eq("user_id", userId).order("slot"),
        supabase.from("mining_state").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", userId),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true })
          .eq("user_id", userId).eq("kind", "first_verify"),
        supabaseAdmin.from("bonus_settings").select("bkash_enabled,nagad_enabled,bkash_off_message,nagad_off_message,recharge_enabled,recharge_off_message,usdt_enabled,usdt_off_message,usdt_rate_bdt,withdraw_enabled,withdraw_off_message,withdraw_off_until").eq("id", "default").maybeSingle(),
        supabaseAdmin.rpc("get_user_balance_breakdown", { _user_id: userId }),
      ]);

    if ((profile as any)?.banned) {
      throw new Error(
        `আপনার একাউন্টটি বন্ধ করা হয়েছে${(profile as any)?.banned_reason ? ` — ${(profile as any).banned_reason}` : ""}। অ্যাডমিনের সাথে যোগাযোগ করুন।`,
      );
    }

    if (tasksResult.error) throw new Error(tasksResult.error.message);

    let tasks = tasksResult.data ?? [];
    const existingSlots = new Set(tasks.map((task) => task.slot));
    const missingSlots = Array.from({ length: 10 }, (_, index) => index + 1)
      .filter((slot) => !existingSlots.has(slot));
    if (missingSlots.length > 0) {
      const rows = missingSlots.map((slot) => ({
        user_id: userId,
        slot,
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
    const photoPaths = (tasks ?? [])
      .map((task: any) => task.face_photo_url as string | null)
      .filter((path: string | null): path is string => Boolean(path));
    const signedByPath = new Map<string, string>();
    if (photoPaths.length > 0) {
      const { data: signedPhotos } = await supabaseAdmin.storage
        .from("face-photos")
        .createSignedUrls(photoPaths, 60 * 30);
      for (const photo of signedPhotos ?? []) {
        if (photo.path && photo.signedUrl) signedByPath.set(photo.path, photo.signedUrl);
      }
    }
    const tasksWithPhotos = (tasks ?? []).map((task: any) => ({
      ...task,
      signed_face_url: task.face_photo_url
        ? signedByPath.get(task.face_photo_url) ?? null
        : null,
    }));

    const firstVerifyCount = (tasksWithPhotos ?? []).filter((t: any) => !!t.initial_verify_at).length;
    // Bonus progress is the number of distinct slots re-verified at least once,
    // never the sum of repeated re-verifications on the same slot.
    const reverifyCount = (tasksWithPhotos ?? []).filter(
      (task: any) => Number(task.reverify_count ?? 0) > 0,
    ).length;
    const { REFERRAL_UNLOCK_THRESHOLD } = await import("./constants");
    const referralUnlocked = (profile as any)?.referral_unlock_override === true
      || firstVerifyCount >= REFERRAL_UNLOCK_THRESHOLD;

    const { settleWelcomeBonuses } = await import("./bonus.functions");
    const bonus = await settleWelcomeBonuses(
      supabaseAdmin,
      userId,
      firstVerifyCount,
      reverifyCount,
    );

    let miningFinal = mining;
    if (bonus.userReverifyPaid || bonus.selfFirstPaid) {
      const { data: fresh } = await supabase.from("mining_state").select("*").eq("user_id", userId).maybeSingle();
      miningFinal = fresh ?? mining;
    }

    const { data: pendingVouchers } = await supabaseAdmin
      .from("bonus_vouchers")
      .select("id, amount, reason, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const { data: activeDebts } = await supabaseAdmin
      .from("user_debts")
      .select("id, amount, provider, payment_number, message, status, claim_from_number, claim_note, claimed_at, created_at")
      .eq("user_id", userId)
      .in("status", ["active", "claimed"])
      .order("created_at", { ascending: false });
    const debtTotal = (activeDebts ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);

    const wallets = walletList ?? [];
    const walletBkash = wallets.find((w: any) => w.provider === "bkash") ?? null;
    const walletNagad = wallets.find((w: any) => w.provider === "nagad") ?? null;
    const walletUsdt = wallets.find((w: any) => w.provider === "usdt") ?? null;
    const primaryWallet = walletBkash ?? walletNagad ?? null;

    return {
      profile,
      tasks: tasksWithPhotos,
      mining: miningFinal,
      wallet: primaryWallet,
      wallets,
      walletBkash,
      walletNagad,
      walletUsdt,
      payoutSettings: {
        bkashEnabled: bonusSettings?.bkash_enabled !== false,
        nagadEnabled: bonusSettings?.nagad_enabled !== false,
        bkashOffMessage: bonusSettings?.bkash_off_message ?? null,
        nagadOffMessage: bonusSettings?.nagad_off_message ?? null,
        usdtEnabled: bonusSettings?.usdt_enabled !== false,
        usdtOffMessage: bonusSettings?.usdt_off_message ?? null,
        usdtRateBdt: Number(bonusSettings?.usdt_rate_bdt ?? 130),
        rechargeEnabled: (bonusSettings as any)?.recharge_enabled !== false,
        rechargeOffMessage: (bonusSettings as any)?.recharge_off_message ?? null,
        withdrawEnabled:
          (bonusSettings as any)?.withdraw_enabled !== false ||
          ((bonusSettings as any)?.withdraw_off_until
            ? new Date((bonusSettings as any).withdraw_off_until).getTime() <= Date.now()
            : false),
        withdrawOffUntil: (bonusSettings as any)?.withdraw_off_until ?? null,
        withdrawOffMessage: (bonusSettings as any)?.withdraw_off_message ?? null,
      },
      isAdmin,
      pendingSubmits: pendingCount ?? 0,
      referralLock: {
        unlocked: referralUnlocked,
        override: (profile as any)?.referral_unlock_override === true,
        firstVerifies: firstVerifyCount,
        needed: REFERRAL_UNLOCK_THRESHOLD,
      },
      vouchers: pendingVouchers ?? [],
      debts: activeDebts ?? [],
      debtTotal,
      bonus: {
        firstVerifyCount,
        reverifyCount,
        selfFirstPaid: bonus.selfFirstPaid,
        referrerPaid: bonus.referrerPaid,
        userReverifyPaid: bonus.userReverifyPaid,
        selfFirstAmount: bonus.selfFirstAmount,
        referrerAmount: bonus.referrerAmount,
        userAmount: bonus.userAmount,
        totalAmount: (Number(balanceBreakdown?.bonus ?? 0)),
        hasReferrer: !!(profile as any)?.referred_by,
        rates: bonus.rates,
      },
      balanceBreakdown,
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
