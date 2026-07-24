import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REVERIFY_INTERVAL_MS } from "@/lib/constants";

async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// ---------------- Stats ----------------
export const adminStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const fetchAllTasks = async () => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin.from("tasks").select("status").range(from, from + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return rows;
  };
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayIso = startOfToday.toISOString();

  const [users, tasks, minings, wallets, withdrawals, unverified, todayVerifiedRes, todayDoneRes] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    fetchAllTasks(),
    supabaseAdmin.from("mining_state").select("accrued_amount, withdrawn_amount, is_active"),
    supabaseAdmin.from("wallets").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("withdrawals").select("amount, status"),
    supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("initial_verify_at", todayIso),
    supabaseAdmin.from("tasks").select("id", { count: "exact", head: true }).gte("done_at", todayIso),
  ]);

  const allTasks = tasks ?? [];
  const allMining = minings.data ?? [];
  const allWith = withdrawals.data ?? [];

  return {
    users: users.count ?? 0,
    wallets: wallets.count ?? 0,
    unverifiedCount: unverified.count ?? 0,
    reverifyQueue: allTasks.filter((t) => t.status === "verified").length,
    todayVerified: (todayVerifiedRes.count ?? 0) + (todayDoneRes.count ?? 0),
    tasks: {
      done: allTasks.filter((t) => t.status === "done").length,
      verified: allTasks.filter((t) => t.status === "verified").length,
      empty: allTasks.filter((t) => t.status === "empty").length,
    },
    mining: {
      activeUsers: allMining.filter((m) => m.is_active).length,
      totalAccrued: allMining.reduce((a, m) => a + Number(m.accrued_amount ?? 0), 0),
      totalWithdrawn: allMining.reduce((a, m) => a + Number(m.withdrawn_amount ?? 0), 0),
    },
    withdrawals: {
      pending: allWith.filter((w) => w.status === "pending").length,
      paid: allWith.filter((w) => w.status === "paid").length,
      rejected: allWith.filter((w) => w.status === "rejected").length,
      pendingAmount: allWith.filter((w) => w.status === "pending").reduce((a, w) => a + Number(w.amount), 0),
      paidAmount: allWith.filter((w) => w.status === "paid").reduce((a, w) => a + Number(w.amount), 0),
    },
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
    fetchAll("tasks", "id, user_id, status, whitelist_ok, wallet_address, face_photo_url, initial_verify_at, reverify_count"),
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

  const firstVerifiesByUser = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (t.initial_verify_at) {
      firstVerifiesByUser.set(t.user_id, (firstVerifiesByUser.get(t.user_id) ?? 0) + 1);
    }
  }

  return (profiles ?? []).map((p) => {
    const userTasks = (tasks ?? []).filter((t) => t.user_id === p.id);
    const done = userTasks.reduce((sum, t) => sum + Number(t.reverify_count ?? 0), 0);
    const verified = userTasks.filter((t) => t.status === "verified").length;
    const m = (minings ?? []).find((x) => x.user_id === p.id);
    const w = (wallets ?? []).find((x) => x.user_id === p.id);
    // Leaderboards count only successful GoodDollar first-verifications.
    // Generated/failed backup attempts are kept for recovery, but must not
    // inflate a user's successful face count.
    const faceTotal = firstVerifiesByUser.get(p.id) ?? 0;
    const slotFaces = slotFacesByUser.get(p.id) ?? 0;
    const attemptFaces = attemptFacesByUser.get(p.id) ?? 0;
    const firstVerifies = firstVerifiesByUser.get(p.id) ?? 0;
    const referralUnlocked = (p as any).referral_unlock_override === true || firstVerifies >= 5;
    return {
      profile: p, done, verified, faceTotal, slotFaces, attemptFaces,
      firstVerifies, reverifies: done,
      serial: Number((p as any).uid_seq ?? 0),
      referralUnlocked, referralOverride: (p as any).referral_unlock_override === true,
      emptySlots: Math.max(0, 10 - slotFaces), mining: m, wallet: w,
    };
  });
});


export const adminUserDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const [profile, tasks, mining, wallet, withdrawals, unverified, referrals] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("tasks").select("*").eq("user_id", data.userId).order("slot"),
      supabaseAdmin.from("mining_state").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("withdrawals").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("unverified_attempts").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, display_name, phone_number, email, created_at").eq("referred_by", data.userId).order("created_at", { ascending: false }),
    ]);

    const taskRows = await Promise.all((tasks.data ?? []).map(async (t) => {
      let signed: string | null = null;
      if (t.face_photo_url) {
        const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url, 60 * 30);
        signed = s?.signedUrl ?? null;
      }
      return { ...t, signed_url: signed };
    }));

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
      const refTasks = await fetchReferralRows("tasks", "id, user_id, status, wallet_address, face_photo_url");
      const refFaceKeys = new Map<string, Set<string>>();
      const refSlotFaces = new Map<string, number>();
      const refAttemptFaces = new Map<string, number>();
      const refDone = new Map<string, number>();
      const refVerified = new Map<string, number>();
      const addRefFace = (userId: string, key: string) => {
        const set = refFaceKeys.get(userId) ?? new Set<string>();
        set.add(key);
        refFaceKeys.set(userId, set);
      };
      for (const t of refTasks ?? []) {
        const hasGoodDollarFace = t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address;
        if (!hasGoodDollarFace) continue;
        addRefFace(t.user_id, t.wallet_address ? `wallet:${t.wallet_address}` : `task:${t.id}`);
        refSlotFaces.set(t.user_id, (refSlotFaces.get(t.user_id) ?? 0) + 1);
        if (t.status === "done") refDone.set(t.user_id, (refDone.get(t.user_id) ?? 0) + 1);
        if (t.status === "verified") refVerified.set(t.user_id, (refVerified.get(t.user_id) ?? 0) + 1);
      }
      referralRows = (referrals.data ?? []).map((r) => ({
        ...r,
        faceTotal: (refDone.get(r.id) ?? 0) + (refVerified.get(r.id) ?? 0),
        slotFaces: refSlotFaces.get(r.id) ?? 0,
        attemptFaces: refAttemptFaces.get(r.id) ?? 0,
        done: refDone.get(r.id) ?? 0,
        verified: refVerified.get(r.id) ?? 0,
      })).sort((a, b) => b.faceTotal - a.faceTotal || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return {
      profile: profile.data,
      tasks: taskRows,
      mining: mining.data,
      wallet: wallet.data,
      withdrawals: withdrawals.data ?? [],
      unverified: unverified.data ?? [],
      faceSummary: {
        total: myFaceKeys.size,
        slotFaces: taskRows.filter((t) => t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address).length,
        backupFaces: (unverified.data ?? []).filter((a) => a.face_photo_url || a.wallet_address).length,
        done: taskRows.filter((t) => t.status === "done").length,
        verified: taskRows.filter((t) => t.status === "verified").length,
        firstVerifies: taskRows.filter((t) => !!t.initial_verify_at).length,
        reverifies: taskRows.reduce((sum, t) => sum + Number(t.reverify_count ?? 0), 0),
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
        firstVerifies: taskRows.filter((t) => !!t.initial_verify_at).length,
        unlocked: (profile.data as any)?.referral_unlock_override === true
          || taskRows.filter((t) => !!t.initial_verify_at).length >= 5,
      },
    };
  });


// ---------------- Withdrawals ----------------
export const adminListWithdrawals = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { data } = await supabaseAdmin
    .from("withdrawals")
    .select("*, profiles:user_id(display_name, email, phone_number)")
    .order("created_at", { ascending: false });
  return data ?? [];
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
      .select("id, user_id, slot, status, whitelist_ok, face_photo_url, face_label, wallet_address, wallet_private_key, initial_verify_at, reverify_due_at, profiles:user_id(display_name, email, phone_number)")
      .not("face_photo_url", "is", null)
      .order("initial_verify_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    tasks.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const withUrls = await Promise.all((tasks ?? []).map(async (t) => {
    const { data: signed } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url!, 60 * 30);
    return { ...t, signed_url: signed?.signedUrl ?? null };
  }));
  return withUrls;
});

export const adminResetTask = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: t } = await supabaseAdmin.from("tasks").select("face_photo_url").eq("id", data.taskId).maybeSingle();
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
    const { error } = await supabaseAdmin.from("mining_state")
      .update({ accrued_amount: newAccrued })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true, new_balance: newAccrued };
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
      .select("id, user_id, wallet_address, status, whitelist_ok, initial_verify_at")
      .in("status", ["verified", "done"])
      .not("wallet_address", "is", null)
      .order("id")
      .range(data.offset, data.offset + data.limit - 1);

    const list = tasks ?? [];
    let checked = 0, flipped = 0, restored = 0, autoReverified = 0;
    const affected = new Set<string>();
    const now = new Date().toISOString();
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
        const oldEnough = !!t.initial_verify_at
          && Date.now() - new Date(t.initial_verify_at).getTime() >= 6 * 24 * 60 * 60 * 1000;
        if (ok && t.status === "verified" && oldEnough) {
          await supabaseAdmin.from("tasks").update({
            status: "done", done_at: now, whitelist_ok: true, last_whitelist_check_at: now,
          }).eq("id", t.id);
          affected.add(t.user_id); autoReverified++;
        } else if (!ok && (t.status !== "verified" || t.whitelist_ok !== false)) {
          await supabaseAdmin.from("tasks").update({
            whitelist_ok: false, last_whitelist_check_at: now,
            status: "verified", reverify_due_at: now,
          }).eq("id", t.id);
          affected.add(t.user_id); flipped++;
        } else if (ok && !(t.whitelist_ok ?? true)) {
          await supabaseAdmin.from("tasks").update({
            whitelist_ok: true, last_whitelist_check_at: now,
          }).eq("id", t.id);
          affected.add(t.user_id); restored++;
        } else {
          await supabaseAdmin.from("tasks").update({ last_whitelist_check_at: now }).eq("id", t.id);
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
    fetchAll("tasks", "id, user_id, status, initial_verify_at, reverify_count"),
  ]);

  const firstVerifiesByUser = new Map<string, number>();
  const reverifiesByUser = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (t.initial_verify_at) {
      firstVerifiesByUser.set(t.user_id, (firstVerifiesByUser.get(t.user_id) ?? 0) + 1);
    }
    const count = Number(t.reverify_count ?? 0);
    if (count > 0) reverifiesByUser.set(t.user_id, (reverifiesByUser.get(t.user_id) ?? 0) + count);
  }

  const byReferrer = new Map<string, { refereeCount: number; verifiedReferees: number; totalVerifies: number; totalFirstVerifies: number; totalReverifies: number }>();
  for (const p of profiles ?? []) {
    if (!p.referred_by) continue;
    const cur = byReferrer.get(p.referred_by) ?? { refereeCount: 0, verifiedReferees: 0, totalVerifies: 0, totalFirstVerifies: 0, totalReverifies: 0 };
    cur.refereeCount += 1;
    const v = firstVerifiesByUser.get(p.id) ?? 0;
    if (v > 0) cur.verifiedReferees += 1;
    cur.totalVerifies += v;
    cur.totalFirstVerifies += firstVerifiesByUser.get(p.id) ?? 0;
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
    const { error } = await supabaseAdmin.from("wallets").delete().eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
// re-verify (status='done'). Useful when GoodDollar isn't asking re-verify
// but user is stuck waiting. Also resets whitelist_ok=true and pushes the
// next re-verify due date 4 days out, then re-settles mining.
export const adminMarkAsReverified = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: t } = await supabaseAdmin
      .from("tasks").select("id, user_id, status, wallet_address").eq("id", data.taskId).maybeSingle();
    if (!t) throw new Error("Task নেই");
    if (!t.wallet_address) throw new Error("Task-এ wallet নেই");
    const now = new Date();
    const dueAt = new Date(now.getTime() + REVERIFY_INTERVAL_MS).toISOString();
    const { error } = await supabaseAdmin.from("tasks").update({
      status: "done",
      done_at: now.toISOString(),
      whitelist_ok: true,
      last_whitelist_check_at: now.toISOString(),
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
