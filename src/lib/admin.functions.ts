import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REFERRAL_UNLOCK_THRESHOLD, REVERIFY_INTERVAL_MS } from "@/lib/constants";

async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------------- Stats ----------------
export const adminStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [
    usersC, walletsC, unverifiedC, todayVerifiedC, todayDoneC, activeMiningC, kycC, rechargesC,
    doneC, verifiedC, emptyC,
    pendingC, paidC, rejectedC,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("wallets").select("user_id", { count: "exact", head: true }),
    supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("initial_verify_at", todayIso),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("done_at", todayIso),
    supabaseAdmin.from("mining_state").select("user_id", { count: "exact", head: true }).eq("is_active", true),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("kyc_verified", true),
    supabaseAdmin.from("recharges").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "done"),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "verified"),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).eq("status", "empty"),
    supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "paid"),
    supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "rejected"),
  ]);

  return {
    users: usersC.count ?? 0,
    wallets: walletsC.count ?? 0,
    kycVerified: kycC.count ?? 0,
    recharges: rechargesC.count ?? 0,
    unverifiedCount: unverifiedC.count ?? 0,
    reverifyQueue: verifiedC.count ?? 0,
    todayVerified: (todayVerifiedC.count ?? 0) + (todayDoneC.count ?? 0),
    tasks: { done: doneC.count ?? 0, verified: verifiedC.count ?? 0, empty: emptyC.count ?? 0 },
    mining: {
      activeUsers: activeMiningC.count ?? 0,
    },
    withdrawals: {
      pending: pendingC.count ?? 0,
      paid: paidC.count ?? 0,
      rejected: rejectedC.count ?? 0,
    },
  };
});

export const adminMoneyStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const sumPaged = async (table: string, column: string, filter?: (query: any) => any) => {
    let total = 0;
    for (let from = 0; ; from += 1000) {
      let query: any = supabaseAdmin.from(table as any).select(column).range(from, from + 999);
      if (filter) query = filter(query);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      const rows = (data as any[]) ?? [];
      total += rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0);
      if (rows.length < 1000) break;
    }
    return total;
  };
  const [pendingAmount, paidWithdraw, paidRecharge, adminCredits, totalAccrued] = await Promise.all([
    sumPaged("withdrawals", "amount", (query) => query.eq("status", "pending")),
    sumPaged("withdrawals", "amount", (query) => query.eq("status", "paid")),
    sumPaged("recharges", "amount", (query) => query.eq("status", "success")),
    sumPaged("admin_credits", "amount"),
    sumPaged("mining_state", "accrued_amount"),
  ]);
  return {
    pendingAmount,
    totalAccrued,
    totalPaid: paidWithdraw + paidRecharge + Math.max(0, adminCredits),
  };
});




// ---------------- Users ----------------
export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const fetchAll = async (table: "tasks" | "unverified_attempts", select: string) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from(table).select(select).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllProfiles = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllMining = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("mining_state").select("*").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllWallets = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("wallets").select("*").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const [profiles, tasks, attempts, minings, wallets] = await Promise.all([
    fetchAllProfiles(),
    fetchAll("tasks", "id, user_id, slot, status, whitelist_ok, wallet_address, face_photo_url, initial_verify_at, reverify_count"),
    fetchAll("unverified_attempts", "id, user_id, wallet_address, face_photo_url"),
    fetchAllMining(),
    fetchAllWallets(),
  ]);

  const faceKeysByUser = new Map<string, Set<string>>();
  const slotFacesByUser = new Map<string, number>();
  const attemptFacesByUser = new Map<string, number>();

  const addFace = (userId: string, key: string) => {
    const set = faceKeysByUser.get(userId) ?? new Set<string>();
    set.add(key);
    faceKeysByUser.set(userId, set);
  };

  for (const t of tasks ?? []) {
    const hasGoodDollarFace = t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address;
    if (!hasGoodDollarFace) continue;
    addFace(t.user_id, t.wallet_address ? `wallet:${t.wallet_address}` : `task:${t.id}`);
    slotFacesByUser.set(t.user_id, (slotFacesByUser.get(t.user_id) ?? 0) + 1);
  }

  for (const a of attempts ?? []) {
    if (!a.face_photo_url && !a.wallet_address) continue;
    addFace(a.user_id, a.wallet_address ? `wallet:${a.wallet_address}` : `attempt:${a.id}`);
    attemptFacesByUser.set(a.user_id, (attemptFacesByUser.get(a.user_id) ?? 0) + 1);
  }

  const firstVerifySlotsByUser = new Map<string, Set<number>>();
  for (const t of tasks ?? []) {
    if (t.initial_verify_at) {
      const slots = firstVerifySlotsByUser.get(t.user_id) ?? new Set<number>();
      slots.add(Number(t.slot));
      firstVerifySlotsByUser.set(t.user_id, slots);
    }
  }

  const tasksByUser = new Map<string, any[]>();
  for (const t of tasks ?? []) {
    const arr = tasksByUser.get(t.user_id) ?? [];
    arr.push(t);
    tasksByUser.set(t.user_id, arr);
  }
  const miningByUser = new Map<string, any>();
  for (const m of minings ?? []) miningByUser.set(m.user_id, m);
  const walletsByUser = new Map<string, any[]>();
  for (const w of wallets ?? []) {
    const arr = walletsByUser.get(w.user_id) ?? [];
    arr.push(w);
    walletsByUser.set(w.user_id, arr);
  }

  return (profiles ?? []).map((p) => {
    const userTasks = tasksByUser.get(p.id) ?? [];
    const done = userTasks.filter((t: any) => Number(t.reverify_count ?? 0) > 0).length;
    const verified = userTasks.filter((t) => t.status === "verified").length;
    const m = miningByUser.get(p.id);
    const userWallets = walletsByUser.get(p.id) ?? [];
    const w = userWallets.find((x) => x.provider === "bkash") ?? userWallets[0] ?? null;
    const faceTotal = firstVerifySlotsByUser.get(p.id)?.size ?? 0;
    const slotFaces = slotFacesByUser.get(p.id) ?? 0;
    const attemptFaces = attemptFacesByUser.get(p.id) ?? 0;
    const firstVerifies = faceTotal;
    const referralUnlocked = (p as any).referral_unlock_override === true
      || firstVerifies >= REFERRAL_UNLOCK_THRESHOLD;
    return {
      profile: p, done, verified, faceTotal, slotFaces, attemptFaces,
      firstVerifies, reverifies: done,
      serial: Number((p as any).uid_seq ?? 0),
      referralUnlocked, referralOverride: (p as any).referral_unlock_override === true,
      emptySlots: Math.max(0, 10 - slotFaces), mining: m, wallet: w, wallets: userWallets,
    };
  });

});


export const adminUserDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const [profile, tasks, mining, wallets, withdrawals, unverified, referrals, debts, vouchersAll, creditsAll, rechargesAll, transfersIn, transfersOut] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("tasks").select("*").eq("user_id", data.userId).order("slot"),
      supabaseAdmin.from("mining_state").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", data.userId).order("provider"),
      supabaseAdmin.from("withdrawals").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("unverified_attempts").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, display_name, phone_number, email, created_at").eq("referred_by", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("user_debts").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("bonus_vouchers").select("id, amount, reason, status, created_at, claimed_at").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("admin_credits").select("id, amount, note, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("recharges").select("id, amount, mobile, operator, status, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("transfers").select("id, amount, note, sender_id, created_at").eq("receiver_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("transfers").select("id, amount, note, receiver_id, created_at").eq("sender_id", data.userId).order("created_at", { ascending: false }),
    ]);

    const taskRows = await Promise.all((tasks.data ?? []).map(async (t) => {
      let signed: string | null = null;
      if (t.face_photo_url) {
        const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url, 60 * 30);
        signed = s?.signedUrl ?? null;
      }
      return { ...t, signed_url: signed };
    }));

    const referrerId = profile.data?.referred_by ?? null;
    const referrer = referrerId
      ? await supabaseAdmin
          .from("profiles")
          .select("id, uid_seq, display_name, phone_number, email, referral_code, created_at")
          .eq("id", referrerId)
          .maybeSingle()
      : null;

    const myFaceKeys = new Set<string>();
    for (const t of taskRows) {
      const hasGoodDollarFace = t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address;
      if (hasGoodDollarFace) myFaceKeys.add(t.wallet_address ? `wallet:${t.wallet_address}` : `task:${t.id}`);
    }
    for (const a of unverified.data ?? []) {
      if (a.face_photo_url || a.wallet_address) myFaceKeys.add(a.wallet_address ? `wallet:${a.wallet_address}` : `attempt:${a.id}`);
    }

    const referralIds = (referrals.data ?? []).map((r) => r.id);
    let referralRows: any[] = [];
    if (referralIds.length > 0) {
      const fetchReferralRows = async (table: "tasks" | "unverified_attempts", select: string) => {
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabaseAdmin.from(table).select(select).in("user_id", referralIds).range(from, from + 999);
          if (error) throw new Error(error.message);
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return rows;
      };
       const refTasks = await fetchReferralRows("tasks", "id, user_id, slot, status, wallet_address, initial_verify_at, reverify_count");
       const refFirstVerifySlots = new Map<string, Set<number>>();
      const refReverifySlots = new Map<string, Set<number>>();
      for (const t of refTasks ?? []) {
         if (t.initial_verify_at) {
           const slots = refFirstVerifySlots.get(t.user_id) ?? new Set<number>();
           slots.add(Number(t.slot));
           refFirstVerifySlots.set(t.user_id, slots);
        }
        if (Number(t.reverify_count ?? 0) > 0) {
          const slots = refReverifySlots.get(t.user_id) ?? new Set<number>();
          slots.add(Number(t.slot));
          refReverifySlots.set(t.user_id, slots);
        }
      }
      referralRows = (referrals.data ?? []).map((r) => ({
        ...r,
         faceTotal: refFirstVerifySlots.get(r.id)?.size ?? 0,
         firstVerifies: refFirstVerifySlots.get(r.id)?.size ?? 0,
        reverifies: refReverifySlots.get(r.id)?.size ?? 0,
      })).sort((a, b) => b.faceTotal - a.faceTotal || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return {
      profile: profile.data,
      referrer: referrer?.data ?? null,
      blocked: await (async () => {
        try {
          const { data: au } = await supabaseAdmin.auth.admin.getUserById(data.userId);
          const bu = (au?.user as any)?.banned_until as string | null | undefined;
          if (!bu) return false;
          return new Date(bu).getTime() > Date.now();
        } catch { return false; }
      })(),
      tasks: taskRows,
      mining: mining.data,
      wallet: (wallets.data ?? []).find((w) => w.provider === "bkash") ?? wallets.data?.[0] ?? null,
      wallets: wallets.data ?? [],
      withdrawals: withdrawals.data ?? [],
      unverified: unverified.data ?? [],
      faceSummary: {
        total: myFaceKeys.size,
        slotFaces: taskRows.filter((t) => t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address).length,
        backupFaces: (unverified.data ?? []).filter((a) => a.face_photo_url || a.wallet_address).length,
        done: taskRows.filter((t) => t.status === "done").length,
        verified: taskRows.filter((t) => t.status === "verified").length,
        firstVerifies: new Set(taskRows.filter((t) => !!t.initial_verify_at).map((t) => Number(t.slot))).size,
        reverifies: taskRows.filter((t: any) => Number(t.reverify_count ?? 0) > 0).length,
        emptySlots: taskRows.filter((t) => t.status === "empty" && !t.face_photo_url && !t.wallet_address).length,
      },
      referrals: referralRows,
      referralSummary: {
        totalAccounts: referrals.data?.length ?? 0,
        activeAccounts: referralRows.filter((r) => r.faceTotal > 0).length,
        totalFaces: referralRows.reduce((sum, r) => sum + r.faceTotal, 0),
      },
      referralLock: {
        override: (profile.data as any)?.referral_unlock_override === true,
        firstVerifies: new Set(taskRows.filter((t) => !!t.initial_verify_at).map((t) => Number(t.slot))).size,
        unlocked: (profile.data as any)?.referral_unlock_override === true
          || new Set(taskRows.filter((t) => !!t.initial_verify_at).map((t) => Number(t.slot))).size >= REFERRAL_UNLOCK_THRESHOLD,
      },
      debts: debts.data ?? [],
      debtTotal: (debts.data ?? []).filter((d: any) => d.status === "active").reduce((s: number, d: any) => s + Number(d.amount), 0),
      income: {
        vouchers: vouchersAll.data ?? [],
        adminCredits: creditsAll.data ?? [],
        recharges: rechargesAll.data ?? [],
        transfersIn: transfersIn.data ?? [],
        transfersOut: transfersOut.data ?? [],
        totals: {
          vouchersClaimed: (vouchersAll.data ?? []).filter((v: any) => v.status === "claimed").reduce((s: number, v: any) => s + Number(v.amount), 0),
          adminCreditsPositive: (creditsAll.data ?? []).filter((c: any) => Number(c.amount) > 0).reduce((s: number, c: any) => s + Number(c.amount), 0),
          adminCreditsNegative: (creditsAll.data ?? []).filter((c: any) => Number(c.amount) < 0).reduce((s: number, c: any) => s + Number(c.amount), 0),
          rechargesSuccess: (rechargesAll.data ?? []).filter((r: any) => r.status === "success").reduce((s: number, r: any) => s + Number(r.amount), 0),
          transfersInTotal: (transfersIn.data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0),
          transfersOutTotal: (transfersOut.data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0),
          withdrawalsPaid: (withdrawals.data ?? []).filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount), 0),
        },
      },
    };
  });


export const adminAddDebt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    amount: z.number().positive(),
    provider: z.enum(["bkash", "nagad"]),
    paymentNumber: z.string().min(4),
    message: z.string().max(2000).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("user_debts").insert({
      user_id: data.userId,
      amount: data.amount,
      provider: data.provider,
      payment_number: data.paymentNumber,
      message: data.message ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveDebt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ debtId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("user_debts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", data.debtId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDebt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ debtId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("user_debts").delete().eq("id", data.debtId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// List debts claimed by users, pending admin approval
export const adminListDebtClaims = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data: debts, error } = await supabaseAdmin
    .from("user_debts")
    .select("*")
    .eq("status", "claimed")
    .order("claimed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const userIds = Array.from(new Set((debts ?? []).map((d: any) => d.user_id)));
  if (userIds.length === 0) return [];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, phone_number, uid_seq")
    .in("id", userIds);
  const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return (debts ?? []).map((d: any) => ({ ...d, profile: pMap.get(d.user_id) ?? null }));
});



// ---------------- Withdrawals ----------------
export const adminListWithdrawals = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  // Load pending in full + latest 500 processed rows; the withdrawals page can page further if needed.
  const [pendingRes, recentRes] = await Promise.all([
    supabaseAdmin
      .from("withdrawals")
      .select("*, profiles:user_id(display_name, email, phone_number, uid_seq, created_at)")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("withdrawals")
      .select("*, profiles:user_id(display_name, email, phone_number, uid_seq, created_at)")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (pendingRes.error) throw new Error(pendingRes.error.message);
  if (recentRes.error) throw new Error(recentRes.error.message);
  const rows: any[] = [...(pendingRes.data ?? []), ...(recentRes.data ?? [])];

  // Suspicion signals for pending rows only
  const pendingUserIds = Array.from(new Set(rows.filter((r) => r.status === "pending").map((r) => r.user_id)));
  const signalsMap = new Map<string, any>();
  if (pendingUserIds.length > 0) {
    const [tasksRes, miningRes, debtsRes, prevPaidRes, unverifiedRes, refereesRes, settingsRes] = await Promise.all([
      supabaseAdmin.from("tasks").select("user_id, status, whitelist_ok, wallet_address, reverify_count").in("user_id", pendingUserIds),
      supabaseAdmin.from("mining_state").select("user_id, accrued_amount, withdrawn_amount, is_active").in("user_id", pendingUserIds),
      supabaseAdmin.from("user_debts").select("user_id, amount, status").in("user_id", pendingUserIds).eq("status", "active"),
      supabaseAdmin.from("withdrawals").select("user_id, amount, status").in("user_id", pendingUserIds).eq("status", "paid"),
      supabaseAdmin.from("unverified_attempts").select("user_id").in("user_id", pendingUserIds),
      supabaseAdmin.from("profiles").select("id, uid_seq, display_name, phone_number, referred_by, bonus_first_verify_claimed").in("referred_by", pendingUserIds),
      supabaseAdmin.from("bonus_settings").select("referrer_bonus, promo_active, promo_start_at, promo_end_at, promo_referrer_bonus").eq("id", "default").maybeSingle(),
    ]);

    // Compute qualifying first-verify counts for every referee
    const refereeIds = (refereesRes.data ?? []).map((r: any) => r.id);
    let refereeTaskRows: any[] = [];
    if (refereeIds.length > 0) {
      const { data: rt } = await supabaseAdmin
        .from("tasks")
        .select("user_id, status, whitelist_ok, wallet_address")
        .in("user_id", refereeIds);
      refereeTaskRows = rt ?? [];
    }
    const doneByReferee = new Map<string, number>();
    for (const t of refereeTaskRows) {
      if ((t.status === "done" || t.status === "verified") && t.whitelist_ok && t.wallet_address) {
        doneByReferee.set(t.user_id, (doneByReferee.get(t.user_id) ?? 0) + 1);
      }
    }
    const bs: any = settingsRes.data ?? {};
    const nowMs = Date.now();
    const inPromo = !!bs.promo_active && bs.promo_start_at && bs.promo_end_at
      && nowMs >= new Date(bs.promo_start_at).getTime()
      && nowMs <= new Date(bs.promo_end_at).getTime();
    const refBase = Number(bs.referrer_bonus ?? 100);
    const refPromo = bs.promo_referrer_bonus != null ? Number(bs.promo_referrer_bonus) : refBase;

    for (const uid of pendingUserIds) {
      const uTasks = (tasksRes.data ?? []).filter((t: any) => t.user_id === uid);
      const verified = uTasks.filter((t: any) => (t.status === "done" || t.status === "verified") && t.whitelist_ok && t.wallet_address).length;
      const notWhitelisted = uTasks.filter((t: any) => t.wallet_address && !t.whitelist_ok).length;
      const totalReverify = uTasks.reduce((a: number, t: any) => a + (t.reverify_count ?? 0), 0);
      const m = (miningRes.data ?? []).find((x: any) => x.user_id === uid);
      const accrued = m ? Number(m.accrued_amount ?? 0) : 0;
      const withdrawn = m ? Number(m.withdrawn_amount ?? 0) : 0;
      const bal = accrued - withdrawn;
      const debt = (debtsRes.data ?? []).filter((d: any) => d.user_id === uid).reduce((a: number, d: any) => a + Number(d.amount), 0);
      const prevPaidCount = (prevPaidRes.data ?? []).filter((w: any) => w.user_id === uid).length;
      const prevPaidSum = (prevPaidRes.data ?? []).filter((w: any) => w.user_id === uid).reduce((a: number, w: any) => a + Number(w.amount), 0);
      const failedAttempts = (unverifiedRes.data ?? []).filter((u: any) => u.user_id === uid).length;

      const myReferees = (refereesRes.data ?? []).filter((r: any) => r.referred_by === uid);
      const referralBonuses = myReferees.map((r: any) => {
        const first = doneByReferee.get(r.id) ?? 0;
        const paidBonus = !!r.bonus_first_verify_claimed;
        const phone: string = r.phone_number ?? "";
        const masked = phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;
        return {
          id: r.id,
          uid: r.uid_seq ?? null,
          name: r.display_name ?? "User",
          phone: masked,
          firstVerifies: first,
          qualified: first >= 10,
          bonusPaid: paidBonus,
          bonusAmount: paidBonus ? (inPromo ? refPromo : refBase) : 0,
        };
      }).sort((a: any, b: any) => Number(b.bonusPaid) - Number(a.bonusPaid) || b.firstVerifies - a.firstVerifies);
      const referralBonusTotal = referralBonuses.reduce((s: number, r: any) => s + r.bonusAmount, 0);
      const referralPaidCount = referralBonuses.filter((r: any) => r.bonusPaid).length;

      signalsMap.set(uid, {
        verifiedTasks: verified,
        notWhitelistedTasks: notWhitelisted,
        reverifyCount: totalReverify,
        balance: bal,
        accrued,
        withdrawn,
        activeDebt: debt,
        miningActive: !!m?.is_active,
        prevPaidCount,
        prevPaidSum,
        failedAttempts,
        referralBonuses,
        referralBonusTotal,
        referralPaidCount,
      });
    }
  }

  return rows.map((r) => ({
    ...r,
    isAdminPayout: typeof r.admin_note === "string" && r.admin_note.startsWith("[Admin Payout]"),
    signals: r.status === "pending" ? signalsMap.get(r.user_id) ?? null : null,
  }));
});


const ActionInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["paid", "rejected"]),
  note: z.string().optional(),
});

export const adminUpdateWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: w } = await supabaseAdmin.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!w) throw new Error("Withdrawal na");
    if (w.status !== "pending") throw new Error("Already processed");

    const { error } = await supabaseAdmin.from("withdrawals").update({
      status: data.action,
      admin_note: data.note ?? null,
      processed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.action === "rejected") {
      const { data: mining } = await supabaseAdmin.from("mining_state")
        .select("withdrawn_amount").eq("user_id", w.user_id).maybeSingle();
      if (mining) {
        await supabaseAdmin.from("mining_state")
          .update({ withdrawn_amount: Math.max(0, Number(mining.withdrawn_amount) - Number(w.amount)) })
          .eq("user_id", w.user_id);
      }
    }
    return { ok: true };
  });

// ---------------- Faces ----------------
export const adminListFaces = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const tasks: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, slot, status, whitelist_ok, face_photo_url, face_label, wallet_address, wallet_private_key, initial_verify_at, reverify_due_at, reverify_count, last_reverified_at, profiles:user_id(display_name, email, phone_number)")
      .not("face_photo_url", "is", null)
      .order("initial_verify_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    tasks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // Bulk-sign in chunks to avoid per-file round-trips (was timing out on 1000+ faces).
  const paths = tasks.map((t) => t.face_photo_url as string);
  const signedMap = new Map<string, string>();
  const CHUNK = 200;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK);
    const { data: signedList } = await supabaseAdmin.storage
      .from("face-photos")
      .createSignedUrls(slice, 60 * 30);
    (signedList ?? []).forEach((s: any) => {
      if (s?.path && s?.signedUrl) signedMap.set(s.path, s.signedUrl);
    });
  }
  return tasks.map((t) => ({ ...t, signed_url: signedMap.get(t.face_photo_url) ?? null }));
});

export const adminResetTask = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: t, error: taskError } = await supabaseAdmin
      .from("tasks")
      .select("user_id, slot, face_photo_url, wallet_address")
      .eq("id", data.taskId)
      .maybeSingle();
    if (taskError) throw new Error(taskError.message);
    if (!t) throw new Error("Slot পাওয়া যায়নি");

    // Remove every pending backup for this slot before emptying it. Otherwise
    // the 5-minute whitelist job can promote the old face/key back into it.
    const { error: pendingError } = await supabaseAdmin
      .from("unverified_attempts")
      .delete()
      .eq("user_id", t.user_id)
      .eq("slot", t.slot);
    if (pendingError) throw new Error(pendingError.message);

    if (t.wallet_address) {
      const { error: walletPendingError } = await supabaseAdmin
        .from("unverified_attempts")
        .delete()
        .eq("user_id", t.user_id)
        .eq("wallet_address", t.wallet_address);
      if (walletPendingError) throw new Error(walletPendingError.message);
    }
    if (t?.face_photo_url) {
      await supabaseAdmin.storage.from("face-photos").remove([t.face_photo_url]);
    }
    const { error } = await supabaseAdmin.from("tasks").update({
      status: "empty",
      face_photo_url: null,
      face_label: null,
      wallet_address: null,
      wallet_private_key: null,
      initial_verify_at: null,
      reverify_due_at: null,
      done_at: null,
      whitelist_ok: true,
      last_whitelist_check_at: null,
      last_reverified_at: null,
      reverify_count: 0,
      // This lifecycle timestamp invalidates stale progress saved on the
      // user's device, so an admin reset cannot restore an old key.
      created_at: new Date().toISOString(),
    }).eq("id", data.taskId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Unverified ----------------
export const adminListUnverified = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("unverified_attempts")
    .select("id, user_id, slot, kind, face_label, face_photo_url, wallet_address, wallet_private_key, reason, created_at, profiles:user_id(display_name, phone_number, email)")
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all((data ?? []).map(async (r: any) => {
    let signed: string | null = null;
    if (r.face_photo_url) {
      const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(r.face_photo_url, 60 * 30);
      signed = s?.signedUrl ?? null;
    }
    return { ...r, signed_url: signed };
  }));
  return withUrls;
});

export const adminমুছুনUnverified = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: r } = await supabaseAdmin.from("unverified_attempts").select("face_photo_url").eq("id", data.id).maybeSingle();
    if (r?.face_photo_url) {
      await supabaseAdmin.storage.from("face-photos").remove([r.face_photo_url]);
    }
    await supabaseAdmin.from("unverified_attempts").delete().eq("id", data.id);
    return { ok: true };
  });

// Promote a not-whitelisted attempt into a real verified slot for the user.
// - Copies photo + wallet + key + label into the chosen slot (or first empty slot).
// - Marks status='verified', reverify_due_at=3 days later just like normal first verify.
// - Removes the unverified_attempts row (photo stays, moved semantically).
export const adminPromoteUnverified = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    slot: z.number().int().min(1).max(1000).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: att } = await supabaseAdmin
      .from("unverified_attempts").select("*").eq("id", data.id).maybeSingle();
    if (!att) throw new Error("Attempt পাওয়া যায়নি");
    if (!att.wallet_address || !att.wallet_private_key || !att.face_photo_url) {
      throw new Error("Attempt-এ photo/key/wallet সম্পূর্ণ নেই");
    }

    // Reject if this wallet is already bound to any task
    const { data: dup } = await supabaseAdmin
      .from("tasks").select("id, user_id, slot").eq("wallet_address", att.wallet_address).maybeSingle();
    if (dup) throw new Error(`এই wallet ইতিমধ্যে slot #${dup.slot}-এ bind আছে`);

    // Pick slot: requested slot (must be empty & owned by user) else first empty
    const { data: userTasks } = await supabaseAdmin
      .from("tasks").select("id, slot, status").eq("user_id", att.user_id).order("slot");
    let target = (userTasks ?? []).find((t) =>
      data.slot ? t.slot === data.slot : t.status === "empty"
    );
    if (data.slot && target && target.status !== "empty") {
      throw new Error(`Slot #${data.slot} খালি নেই`);
    }
    if (!target) throw new Error("খালি slot নেই — user-এর সব slot পূর্ণ");

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const dueAt = new Date(nowDate.getTime() + REVERIFY_INTERVAL_MS).toISOString();
    const { error } = await supabaseAdmin.from("tasks").update({
      face_photo_url: att.face_photo_url,
      face_label: att.face_label,
      wallet_address: att.wallet_address,
      wallet_private_key: att.wallet_private_key,
      status: "verified",
      initial_verify_at: now,
      reverify_due_at: dueAt,
      whitelist_ok: true,
      last_whitelist_check_at: now,
    }).eq("id", target.id);
    if (error) throw new Error(error.message);

    // মুছুন the attempt row but keep the photo (task now owns it)
    await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
    return { ok: true, slot: target.slot };
  });

// ---------------- Mining adjust ----------------
const AdjustInput = z.object({
  userId: z.string().uuid(),
  delta: z.number(),
  note: z.string().optional(),
});

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdjustInput.parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: m } = await supabaseAdmin.from("mining_state").select("*").eq("user_id", data.userId).maybeSingle();
    if (!m) throw new Error("No mining state");
    const newAccrued = Math.max(0, Number(m.accrued_amount) + data.delta);
    const newBonus = Math.max(0, Number((m as any).bonus_amount ?? 0) + data.delta);
    const { error } = await supabaseAdmin.from("mining_state")
      .update({ accrued_amount: newAccrued, bonus_amount: newBonus })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    // Log the admin credit/debit so it shows in Admin Payout history
    await supabaseAdmin.from("admin_credits").insert({
      user_id: data.userId,
      amount: data.delta,
      note: (data as any).note ?? null,
    });
    return { ok: true, new_balance: newAccrued };
  });

export const adminListCredits = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data, error } = await supabaseAdmin
    .from("admin_credits")
    .select("id, user_id, amount, note, created_at, profiles:user_id(display_name, phone_number, uid_seq)")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
});

// Admin manual override — sets admin_forced_active so settle_mining stops
// flipping the switch back based on whitelist/re-verify state.
export const adminToggleMining = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const patch: any = {
      is_active: data.active,
      admin_forced_active: data.active,
    };
    if (data.active) {
      patch.activated_at = new Date().toISOString();
      patch.last_credited_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("mining_state").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    if (data.active) {
      await supabaseAdmin.rpc("settle_mining", { _user_id: data.userId });
    }
    return { ok: true };
  });

// Clear admin override — settle_mining resumes auto rules (10/10 + no whitelist loss).
export const adminClearMiningOverride = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin
      .from("mining_state")
      .update({ admin_forced_active: false } as any)
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("settle_mining", { _user_id: data.userId });
    return { ok: true };
  });

// Re-check whitelist for a single unverified attempt. If it's now
// whitelisted → promote it into the user's next empty slot automatically.
export const adminRecheckAttempt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");
    const { data: att } = await supabaseAdmin
      .from("unverified_attempts").select("*").eq("id", data.id).maybeSingle();
    if (!att) throw new Error("Attempt নেই");
    if (!att.wallet_address) throw new Error("Wallet নেই");

    const ok = await isWhitelistedRPC(att.wallet_address);
    if (!ok) return { ok: true, whitelisted: false };

    // Wallet already bound elsewhere?
    const { data: dup } = await supabaseAdmin
      .from("tasks").select("id, slot").eq("wallet_address", att.wallet_address).maybeSingle();
    if (dup) {
      await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
      return { ok: true, whitelisted: true, alreadyBound: true, slot: dup.slot };
    }

    const { data: userTasks } = await supabaseAdmin
      .from("tasks").select("id, slot, status").eq("user_id", att.user_id).order("slot");
    const target = (userTasks ?? []).find((t) => t.status === "empty");
    if (!target) throw new Error("খালি slot নেই");

    const nowDate = new Date();
    const now = nowDate.toISOString();
    const dueAt = new Date(nowDate.getTime() + REVERIFY_INTERVAL_MS).toISOString();
    const { error } = await supabaseAdmin.from("tasks").update({
      face_photo_url: att.face_photo_url,
      face_label: att.face_label,
      wallet_address: att.wallet_address,
      wallet_private_key: att.wallet_private_key,
      status: "verified",
      initial_verify_at: now,
      reverify_due_at: dueAt,
      whitelist_ok: true,
      last_whitelist_check_at: now,
    }).eq("id", target.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
    return { ok: true, whitelisted: true, slot: target.slot };
  });

// Bulk re-check every not-whitelisted attempt; auto-promote the ones that pass.
// Paginated — client loops with offset until remaining === 0.
export const adminRecheckAllAttempts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const v = (i ?? {}) as { offset?: number; limit?: number };
    return { offset: Math.max(0, v.offset ?? 0), limit: Math.min(40, Math.max(1, v.limit ?? 25)) };
  })
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");

    const { count: total } = await supabaseAdmin
      .from("unverified_attempts").select("id", { count: "exact", head: true })
      .not("wallet_address", "is", null);

    const { data: attempts } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id, user_id, wallet_address, face_photo_url, face_label, wallet_private_key")
      .not("wallet_address", "is", null)
      .order("id")
      .range(data.offset, data.offset + data.limit - 1);

    const list = attempts ?? [];
    let checked = 0, promoted = 0, still = 0, skipped = 0;
    const usersToSettle = new Set<string>();
    const CONCURRENCY = 12;

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const okFlags = await Promise.all(
        chunk.map((a) => isWhitelistedRPC(a.wallet_address as string).catch(() => false)),
      );
      checked += chunk.length;

      for (let j = 0; j < chunk.length; j++) {
        const att = chunk[j];
        if (!okFlags[j]) { still++; continue; }

        const { data: dup } = await supabaseAdmin
          .from("tasks").select("id").eq("wallet_address", att.wallet_address).maybeSingle();
        if (dup) { await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id); skipped++; continue; }

        const { data: userTasks } = await supabaseAdmin
          .from("tasks").select("id, slot, status").eq("user_id", att.user_id).order("slot");
        const target = (userTasks ?? []).find((t) => t.status === "empty");
        if (!target) { skipped++; continue; }

        const nowDate = new Date();
        const now = nowDate.toISOString();
        const dueAt = new Date(nowDate.getTime() + REVERIFY_INTERVAL_MS).toISOString();
        await supabaseAdmin.from("tasks").update({
          face_photo_url: att.face_photo_url,
          face_label: att.face_label,
          wallet_address: att.wallet_address,
          wallet_private_key: att.wallet_private_key,
          status: "verified",
          initial_verify_at: now,
          reverify_due_at: dueAt,
          whitelist_ok: true,
          last_whitelist_check_at: now,
        }).eq("id", target.id);
        await supabaseAdmin.from("unverified_attempts").delete().eq("id", att.id);
        usersToSettle.add(att.user_id);
        promoted++;
      }
    }

    await Promise.all(
      Array.from(usersToSettle).map((uid) => supabaseAdmin.rpc("settle_mining", { _user_id: uid })),
    );

    // Rows may have been deleted (promoted/skipped-dup); so next offset advances only
    // by what remained. Simpler: recompute total for remaining calculation.
    const { count: totalAfter } = await supabaseAdmin
      .from("unverified_attempts").select("id", { count: "exact", head: true })
      .not("wallet_address", "is", null);
    const remaining = totalAfter ?? 0;
    // Advance offset past the "still" ones we didn't touch, otherwise we'd re-check the same rows.
    const nextOffset = data.offset + still;
    return {
      ok: true, checked, promoted, still, skipped,
      total: total ?? 0,
      remaining,
      offset: nextOffset,
      done: list.length === 0 || nextOffset >= remaining,
    };
  });


// ---------------- Re-verify queue ----------------
export const adminReverifyQueue = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, slot, face_label, face_photo_url, reverify_due_at, profiles:user_id(display_name, phone_number, email)")
    .eq("status", "verified")
    .order("reverify_due_at", { ascending: true });

  const withUrls = await Promise.all((data ?? []).map(async (t: any) => {
    let signed: string | null = null;
    if (t.face_photo_url) {
      const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url, 60 * 30);
      signed = s?.signedUrl ?? null;
    }
    return { ...t, signed_url: signed };
  }));
  return withUrls;
});

// ---------------- Wallets ----------------
export const adminListWallets = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("wallets")
    .select("*, profiles:user_id(display_name, phone_number, email)")
    .order("created_at", { ascending: false });
  return data ?? [];
});

// ---------------- মুছুন user ----------------
export const adminমুছুনUser = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    // collect photos
    const { data: tasks } = await supabaseAdmin.from("tasks").select("face_photo_url").eq("user_id", data.userId);
    const { data: unv } = await supabaseAdmin.from("unverified_attempts").select("face_photo_url").eq("user_id", data.userId);
    const paths = [
      ...(tasks ?? []).map((t: any) => t.face_photo_url).filter(Boolean),
      ...(unv ?? []).map((u: any) => u.face_photo_url).filter(Boolean),
    ];
    if (paths.length) await supabaseAdmin.storage.from("face-photos").remove(paths);
    // delete auth user (cascades profile + related rows via FK on delete cascade)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Reset user password ----------------
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(6).max(72),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Manual whitelist re-check (admin) ----------------
// Paginated: client loops with offset until remaining === 0.
// Each call handles at most BATCH tasks so we stay well under the
// Worker time limit ("Failed to fetch" was the 30s cutoff on big sets).
export const adminRunWhitelistCheck = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => {
    const v = (i ?? {}) as { offset?: number; limit?: number };
    return { offset: Math.max(0, v.offset ?? 0), limit: Math.min(60, Math.max(1, v.limit ?? 40)) };
  })
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");

    const { count: total } = await supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .in("status", ["verified", "done"])
      .not("wallet_address", "is", null);

    const { data: tasks } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, wallet_address, status, whitelist_ok, reverify_count")
      .in("status", ["verified", "done"])
      .not("wallet_address", "is", null)
      .order("id")
      .range(data.offset, data.offset + data.limit - 1);

    const list = tasks ?? [];
    let checked = 0, flipped = 0, restored = 0, autoReverified = 0;
    const affected = new Set<string>();
    const CONCURRENCY = 20;

    for (let i = 0; i < list.length; i += CONCURRENCY) {
      const chunk = list.slice(i, i + CONCURRENCY);
      const okFlags = await Promise.all(
        chunk.map((t) => isWhitelistedRPC(t.wallet_address as string).catch(() => null)),
      );
      checked += chunk.length;

      await Promise.all(chunk.map(async (t, j) => {
        const ok = okFlags[j];
        if (ok === null) return;
        const { data: transition, error: transitionError } = await supabaseAdmin
          .rpc("transition_task_whitelist", { _task_id: t.id, _is_whitelisted: ok });
        if (transitionError) return;
        if (transition === "lost") {
          affected.add(t.user_id); flipped++;
        } else if (transition === "restored") {
          affected.add(t.user_id); restored++; autoReverified++;
        }
      }));
    }

    await Promise.all(
      Array.from(affected).map((uid) => supabaseAdmin.rpc("settle_mining", { _user_id: uid })),
    );

    const nextOffset = data.offset + list.length;
    const totalCount = total ?? 0;
    const remaining = Math.max(0, totalCount - nextOffset);
    return {
      ok: true, checked, flipped, restored, autoReverified,
      affected: affected.size,
      offset: nextOffset,
      total: totalCount,
      remaining,
      done: list.length === 0 || remaining === 0,
    };
  });

// ---------------- Bonus Vouchers ----------------
export const adminCreateVoucher = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    amount: z.number().positive().max(100000),
    reason: z.string().trim().min(1).max(500),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: row, error } = await supabaseAdmin
      .from("bonus_vouchers")
      .insert({ user_id: data.userId, amount: data.amount, reason: data.reason, status: "pending" })
      .select().maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, voucher: row };
  });

export const adminListVouchersForUser = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: rows } = await supabaseAdmin
      .from("bonus_vouchers")
      .select("*")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

// ---------------- Referrer Leaderboard ----------------
// Kun user koto jon k reffer korse ar tader theke koita face verification asteche.
export const adminReferrerLeaderboard = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const fetchAll = async (table: "profiles" | "tasks", select: string) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from(table).select(select).range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const [profiles, tasks] = await Promise.all([
    fetchAll("profiles", "id, uid_seq, display_name, phone_number, email, referred_by, referral_code"),
    fetchAll("tasks", "id, user_id, slot, status, initial_verify_at, reverify_count"),
  ]);

  const firstVerifySlotsByUser = new Map<string, Set<number>>();
  const reverifiesByUser = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (t.initial_verify_at) {
      const slots = firstVerifySlotsByUser.get(t.user_id) ?? new Set<number>();
      slots.add(Number(t.slot));
      firstVerifySlotsByUser.set(t.user_id, slots);
    }
    const count = Number(t.reverify_count ?? 0);
    if (count > 0) reverifiesByUser.set(t.user_id, (reverifiesByUser.get(t.user_id) ?? 0) + count);
  }

  const byReferrer = new Map<string, { refereeCount: number; verifiedReferees: number; totalVerifies: number; totalFirstVerifies: number; totalReverifies: number }>();
  for (const p of profiles ?? []) {
    if (!p.referred_by) continue;
    const cur = byReferrer.get(p.referred_by) ?? { refereeCount: 0, verifiedReferees: 0, totalVerifies: 0, totalFirstVerifies: 0, totalReverifies: 0 };
    cur.refereeCount += 1;
    const v = firstVerifySlotsByUser.get(p.id)?.size ?? 0;
    if (v > 0) cur.verifiedReferees += 1;
    cur.totalVerifies += v;
    cur.totalFirstVerifies += v;
    cur.totalReverifies += reverifiesByUser.get(p.id) ?? 0;
    byReferrer.set(p.referred_by, cur);
  }


  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const rows = Array.from(byReferrer.entries()).map(([userId, s]) => {
    const p = profileById.get(userId);
    return {
      userId,
      name: p?.display_name ?? "—",
      phone: p?.phone_number ?? p?.email ?? "",
      referralCode: p?.referral_code ?? null,
      uid: Number(p?.uid_seq ?? 0),
      ...s,
    };
  });
  rows.sort((a, b) => b.totalVerifies - a.totalVerifies || b.refereeCount - a.refereeCount);
  return rows;
});


// ---------------- Referral lock unlock ----------------
export const adminSetReferralUnlock = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    unlocked: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("profiles")
      .update({ referral_unlock_override: data.unlocked } as any)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------- Wallet reset ----------------
export const adminResetWallet = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error, count } = await supabaseAdmin
      .from("wallets")
      .delete({ count: "exact" })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: count ?? 0 };
  });

// ---------------- Delete all not-whitelisted attempts ----------------
export const adminDeleteAllUnverified = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await gate();
  // fetch all photo paths in batches
  const paths: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id, face_photo_url")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of data ?? []) if (r.face_photo_url) paths.push(r.face_photo_url);
    if (!data || data.length < 1000) break;
  }
  if (paths.length > 0) {
    // supabase storage remove has no strict limit but chunk to be safe
    for (let i = 0; i < paths.length; i += 500) {
      await supabaseAdmin.storage.from("face-photos").remove(paths.slice(i, i + 500));
    }
  }
  const { error, count } = await supabaseAdmin
    .from("unverified_attempts")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) throw new Error(error.message);
  return { ok: true, deleted: count ?? 0 };
});


// ---------------- Bonus settings ----------------
export const adminGetBonusSettings = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin.from("bonus_settings").select("*").eq("id", "default").maybeSingle();
  return data ?? { id: "default", first_verify_bonus: 50, reverify_bonus: 200, referrer_bonus: 100 };
});

export const adminUpdateBonusSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    first_verify_bonus: z.number().int().min(0).max(100000),
    reverify_bonus: z.number().int().min(0).max(100000),
    referrer_bonus: z.number().int().min(0).max(100000),
    first_verify_mining_mode: z.boolean().optional(),
    // 2X promo window
    promo_active: z.boolean().optional(),
    promo_title: z.string().max(200).optional().nullable(),
    promo_start_at: z.string().optional().nullable(),
    promo_end_at: z.string().optional().nullable(),
    promo_first_verify_bonus: z.number().int().min(0).max(100000).optional().nullable(),
    promo_reverify_bonus: z.number().int().min(0).max(100000).optional().nullable(),
    promo_referrer_bonus: z.number().int().min(0).max(100000).optional().nullable(),
    // Payout method toggles
    bkash_enabled: z.boolean().optional(),
    nagad_enabled: z.boolean().optional(),
    bkash_off_message: z.string().max(300).optional().nullable(),
    nagad_off_message: z.string().max(300).optional().nullable(),
    recharge_enabled: z.boolean().optional(),
    recharge_off_message: z.string().max(300).optional().nullable(),
    usdt_enabled: z.boolean().optional(),
    usdt_off_message: z.string().max(300).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const patch: any = {
      id: "default",
      first_verify_bonus: data.first_verify_bonus,
      reverify_bonus: data.reverify_bonus,
      referrer_bonus: data.referrer_bonus,
      updated_at: new Date().toISOString(),
    };
    if (typeof data.first_verify_mining_mode === "boolean") patch.first_verify_mining_mode = data.first_verify_mining_mode;
    for (const k of [
      "promo_active","promo_title","promo_start_at","promo_end_at",
      "promo_first_verify_bonus","promo_reverify_bonus","promo_referrer_bonus",
      "bkash_enabled","nagad_enabled","bkash_off_message","nagad_off_message",
      "recharge_enabled","recharge_off_message",
      "usdt_enabled","usdt_off_message",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    const { error } = await supabaseAdmin.from("bonus_settings").upsert(patch);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Toggle just the global "first-verify mining mode" switch. When ON, mining
// starts as soon as user has 10 first-verifies (no re-verify needed).
export const adminSetFirstVerifyMiningMode = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("bonus_settings").upsert({
      id: "default",
      first_verify_mining_mode: data.enabled,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw new Error(error.message);
    // Re-settle every user so mining state reflects the new mode immediately.
    const { data: users } = await supabaseAdmin.from("mining_state").select("user_id");
    for (const u of users ?? []) {
      await supabaseAdmin.rpc("settle_mining", { _user_id: u.user_id });
    }
    return { ok: true };
  });

// Admin: convert a "first-verify" (status='verified') task into a completed
// re-verify (status='done'). Useful when Good-App isn't asking re-verify
// but user is stuck waiting. Also resets whitelist_ok=true and pushes the
// next re-verify due date 4 days out, then re-settles mining.
export const adminMarkAsReverified = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: t } = await supabaseAdmin
      .from("tasks").select("id, user_id, status, wallet_address, reverify_count").eq("id", data.taskId).maybeSingle();
    if (!t) throw new Error("Task নেই");
    if (!t.wallet_address) throw new Error("Task-এ wallet নেই");
    const now = new Date();
    const dueAt = new Date(now.getTime() + REVERIFY_INTERVAL_MS).toISOString();
    const nextCount = Math.max(1, Number(t.reverify_count ?? 0) + 1);
    const { error } = await supabaseAdmin.from("tasks").update({
      status: "done",
      done_at: now.toISOString(),
      whitelist_ok: true,
      last_whitelist_check_at: now.toISOString(),
      last_reverified_at: now.toISOString(),
      reverify_count: nextCount,
      reverify_due_at: dueAt,
    }).eq("id", data.taskId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.rpc("settle_mining", { _user_id: t.user_id });
    return { ok: true };
  });

// ---------------- Re-verify grouped by user ----------------
// One card per user: shows how many faces need re-verify (whitelist off = urgent,
// timer expired = ready, still waiting = normal). Click through to user detail.
export const adminReverifyByUser = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, user_id, slot, face_label, reverify_due_at, whitelist_ok, status, profiles:user_id(display_name, phone_number)")
      .eq("status", "verified")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const now = Date.now();
  const byUser = new Map<string, any>();
  for (const t of rows) {
    const dueMs = t.reverify_due_at ? new Date(t.reverify_due_at).getTime() : 0;
    const notWl = t.whitelist_ok === false;
    const ready = notWl || dueMs <= now;
    const entry = byUser.get(t.user_id) ?? {
      user_id: t.user_id,
      display_name: t.profiles?.display_name ?? "—",
      phone_number: t.profiles?.phone_number ?? "",
      total: 0, ready: 0, urgent: 0, waiting: 0,
      soonestDue: null as number | null,
    };
    entry.total += 1;
    if (notWl) entry.urgent += 1;
    if (ready) entry.ready += 1; else entry.waiting += 1;
    if (dueMs > 0 && (entry.soonestDue === null || dueMs < entry.soonestDue)) {
      entry.soonestDue = dueMs;
    }
    byUser.set(t.user_id, entry);
  }
  return Array.from(byUser.values()).sort((a, b) => b.urgent - a.urgent || b.ready - a.ready || b.total - a.total);
});

// ---------------- Admin Direct Payout ----------------
// Admin manually sends TK to a user's Bkash/Nagad. Records in withdrawals
// (status=paid) so the user sees it in their history AND it appears in the
// admin withdrawals panel. Also deducts from user's balance.
export const adminDirectPayout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    amount: z.number().positive().max(1000000),
    provider: z.enum(["bkash", "nagad"]),
    walletNumber: z.string().trim().min(6).max(20),
    note: z.string().trim().max(500).optional(),
    deductBalance: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const now = new Date().toISOString();
    const cleanNum = data.walletNumber.replace(/\D/g, "");
    const { data: row, error } = await supabaseAdmin.from("withdrawals").insert({
      user_id: data.userId,
      amount: data.amount,
      provider: data.provider,
      wallet_number: cleanNum,
      status: "paid",
      admin_note: `[Admin Payout] ${data.note ?? ""}`.trim(),
      processed_at: now,
    }).select().maybeSingle();
    if (error) throw new Error(error.message);

    if (data.deductBalance) {
      const { data: m } = await supabaseAdmin.from("mining_state")
        .select("withdrawn_amount").eq("user_id", data.userId).maybeSingle();
      if (m) {
        await supabaseAdmin.from("mining_state")
          .update({ withdrawn_amount: Number(m.withdrawn_amount ?? 0) + data.amount })
          .eq("user_id", data.userId);
      }
    }
    return { ok: true, withdrawal: row };
  });

// ---------------- Paid Report (per-user totals) ----------------
export const adminPaidReport = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const fetchAllPaged = async <T = any>(table: string, select: string, filter?: (q: any) => any): Promise<T[]> => {
    const rows: T[] = [];
    for (let from = 0; ; from += 1000) {
      let q: any = supabaseAdmin.from(table as any).select(select).range(from, from + 999);
      if (filter) q = filter(q);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...((data as any[]) ?? []) as T[]);
      if (!data || data.length < 1000) break;
    }
    return rows;
  };

  const [profiles, withdrawals, recharges, credits] = await Promise.all([
    fetchAllPaged<{ id: string; display_name: string | null; phone_number: string | null; uid_seq: number | null }>("profiles", "id, display_name, phone_number, uid_seq"),
    fetchAllPaged<{ user_id: string; amount: number }>("withdrawals", "user_id, amount", (q) => q.eq("status", "paid")),
    fetchAllPaged<{ user_id: string; amount: number }>("recharges", "user_id, amount", (q) => q.eq("status", "success")),
    fetchAllPaged<{ user_id: string; amount: number }>("admin_credits", "user_id, amount"),
  ]);

  const map = new Map<string, { userId: string; name: string; phone: string; uid: number | null; withdraw: number; recharge: number; adminCredit: number; total: number }>();
  for (const p of profiles) {
    map.set(p.id, { userId: p.id, name: p.display_name ?? "—", phone: p.phone_number ?? "—", uid: p.uid_seq, withdraw: 0, recharge: 0, adminCredit: 0, total: 0 });
  }
  for (const w of withdrawals) {
    const r = map.get(w.user_id); if (!r) continue;
    r.withdraw += Number(w.amount) || 0;
  }
  for (const r0 of recharges) {
    const r = map.get(r0.user_id); if (!r) continue;
    r.recharge += Number(r0.amount) || 0;
  }
  for (const c of credits) {
    const r = map.get(c.user_id); if (!r) continue;
    r.adminCredit += Math.max(0, Number(c.amount) || 0);
  }
  const rows = Array.from(map.values())
    .map((r) => ({ ...r, total: r.withdraw + r.recharge + r.adminCredit }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((a, r) => a + r.total, 0);
  return { rows, grandTotal, generatedAt: new Date().toISOString() };
});

// ---------------- Block / Unblock user ----------------
export const adminSetUserBlocked = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    blocked: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, blocked: data.blocked };
  });
