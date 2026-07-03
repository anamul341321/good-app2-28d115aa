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
  const [users, tasks, minings, wallets, withdrawals, unverified] = await Promise.all([
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("tasks").select("status"),
    supabaseAdmin.from("mining_state").select("accrued_amount, withdrawn_amount, is_active"),
    supabaseAdmin.from("wallets").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("withdrawals").select("amount, status"),
    supabaseAdmin.from("unverified_attempts").select("id", { count: "exact", head: true }),
  ]);

  const allTasks = tasks.data ?? [];
  const allMining = minings.data ?? [];
  const allWith = withdrawals.data ?? [];

  return {
    users: users.count ?? 0,
    wallets: wallets.count ?? 0,
    unverifiedCount: unverified.count ?? 0,
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
  const { data: profiles } = await supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false });
  const { data: tasks } = await supabaseAdmin.from("tasks").select("user_id, status");
  const { data: minings } = await supabaseAdmin.from("mining_state").select("*");
  const { data: wallets } = await supabaseAdmin.from("wallets").select("*");

  return (profiles ?? []).map((p) => {
    const userTasks = (tasks ?? []).filter((t) => t.user_id === p.id);
    const done = userTasks.filter((t) => t.status === "done").length;
    const verified = userTasks.filter((t) => t.status === "verified").length;
    const m = (minings ?? []).find((x) => x.user_id === p.id);
    const w = (wallets ?? []).find((x) => x.user_id === p.id);
    return { profile: p, done, verified, mining: m, wallet: w };
  });
});

export const adminUserDetail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const [profile, tasks, mining, wallet, withdrawals, unverified] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("tasks").select("*").eq("user_id", data.userId).order("slot"),
      supabaseAdmin.from("mining_state").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("wallets").select("*").eq("user_id", data.userId).maybeSingle(),
      supabaseAdmin.from("withdrawals").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.from("unverified_attempts").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
    ]);

    const taskRows = await Promise.all((tasks.data ?? []).map(async (t) => {
      let signed: string | null = null;
      if (t.face_photo_url) {
        const { data: s } = await supabaseAdmin.storage.from("face-photos").createSignedUrl(t.face_photo_url, 60 * 30);
        signed = s?.signedUrl ?? null;
      }
      return { ...t, signed_url: signed };
    }));

    return {
      profile: profile.data,
      tasks: taskRows,
      mining: mining.data,
      wallet: wallet.data,
      withdrawals: withdrawals.data ?? [],
      unverified: unverified.data ?? [],
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
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, slot, status, whitelist_ok, face_photo_url, face_label, wallet_address, wallet_private_key, initial_verify_at, reverify_due_at, profiles:user_id(display_name, email, phone_number)")
    .not("face_photo_url", "is", null)
    .order("initial_verify_at", { ascending: false });

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
export const adminRecheckAllAttempts = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");
  const { data: attempts } = await supabaseAdmin
    .from("unverified_attempts").select("id, user_id, wallet_address, face_photo_url, face_label, wallet_private_key")
    .not("wallet_address", "is", null);

  let checked = 0, promoted = 0, still = 0, skipped = 0;
  for (const att of attempts ?? []) {
    checked++;
    const ok = await isWhitelistedRPC(att.wallet_address as string);
    if (!ok) { still++; continue; }

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
    await supabaseAdmin.rpc("settle_mining", { _user_id: att.user_id });
    promoted++;
  }
  return { ok: true, checked, promoted, still, skipped };
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
export const adminRunWhitelistCheck = createServerFn({ method: "POST" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");

  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("id, user_id, wallet_address, status, whitelist_ok")
    .in("status", ["verified", "done"])
    .not("wallet_address", "is", null);

  let checked = 0, flipped = 0, restored = 0;
  const affected = new Set<string>();
  const now = new Date().toISOString();
  for (const t of tasks ?? []) {
    checked++;
    const ok = await isWhitelistedRPC(t.wallet_address as string);

    if (!ok && (t.whitelist_ok ?? true)) {
      await supabaseAdmin.from("tasks").update({
        whitelist_ok: false, last_whitelist_check_at: now,
        status: "verified", reverify_due_at: now,
      }).eq("id", t.id);
      affected.add(t.user_id); flipped++;
    } else if (ok && !(t.whitelist_ok ?? true)) {
      await supabaseAdmin.from("tasks").update({
        whitelist_ok: true, last_whitelist_check_at: now,
      }).eq("id", t.id);
      restored++;
    } else {
      await supabaseAdmin.from("tasks").update({ last_whitelist_check_at: now }).eq("id", t.id);
    }
  }
  for (const uid of affected) {
    await supabaseAdmin.rpc("settle_mining", { _user_id: uid });
  }
  return { ok: true, checked, flipped, restored, affected: affected.size };
});

