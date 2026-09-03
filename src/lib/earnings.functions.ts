import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * মাইনিং ক্লেইমের শর্ত: আজ অ্যাপে কমপক্ষে ১ ঘণ্টা অ্যাক্টিভ থাকতে হবে।
 * সময়টা একবারে লাগে না — সারাদিনে মিলিয়ে ১ ঘণ্টা হলেই চলবে।
 */
async function requireDailyActive(supabase: any, userId: string) {
  const { data } = await supabase.rpc("get_daily_activity", { _user_id: userId });
  const seconds = Number((data as any)?.seconds ?? 0);
  const required = Number((data as any)?.required ?? 3600);
  if (seconds >= required) return;
  const leftMin = Math.max(1, Math.ceil((required - seconds) / 60));
  throw new Error(
    `⏳ আজ মাইনিং ক্লেইম করতে অ্যাপে কমপক্ষে ১ ঘণ্টা অ্যাক্টিভ থাকতে হবে — আর ${leftMin} মিনিট বাকি।`,
  );
}

export type EarningRow = {
  id: string;
  kind: string;
  label: string;
  note: string | null;
  amount: number;
  created_at: string;
};

/**
 * Unified earning/spending ledger for the logged-in user — every taka is
 * labelled with its source in plain Bengali so the user can tell mining income
 * apart from referral 10% commission, bonuses, gifts and withdrawals.
 */
export const getEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.rpc("settle_mining", { _user_id: userId });

    const [
      { data: mining },
      { data: claims },
      { data: withdrawals },
      { data: vouchers },
      { data: credits },
      { data: transfersIn },
      { data: transfersOut },
      { data: recharges },
      { data: debts },
      { data: profile },
    ] = await Promise.all([
      supabase.from("mining_state").select("*").eq("user_id", userId).maybeSingle(),
      supabaseAdmin.from("mining_claims").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("bonus_vouchers").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("admin_credits").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("transfers").select("*").eq("receiver_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("transfers").select("*").eq("sender_id", userId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("recharges").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),

      supabaseAdmin.from("user_debts").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("display_name, uid_seq, phone_number").eq("id", userId).maybeSingle(),
    ]);

    const accrued = Number((mining as any)?.accrued_amount ?? 0);
    const bonusTotal = Number((mining as any)?.bonus_amount ?? 0);
    const withdrawn = Number((mining as any)?.withdrawn_amount ?? 0);
    const referralAccrued = Number((mining as any)?.referral_accrued ?? 0);
    const selfMiningTotal = Number((mining as any)?.self_mining_accrued ?? 0);
    const miningTotal = selfMiningTotal + referralAccrued;
    const unclassifiedCredit = Math.max(0, accrued - bonusTotal - miningTotal);

    const claimRows = claims ?? [];
    const miningClaimRows = claimRows.filter((c: any) => (c.kind ?? "mining") === "mining");
    const claimedTotal = miningClaimRows.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
    const claimedReferral = miningClaimRows.reduce((s: number, c: any) => s + Number(c.referral_amount ?? 0), 0);
    const pendingClaim = Math.max(0, miningTotal - claimedTotal);
    const pendingReferral = Math.min(pendingClaim, Math.max(0, referralAccrued - claimedReferral));
    const lastClaimAt = miningClaimRows[0]?.created_at ?? null;
    const nextClaimAt = lastClaimAt
      ? new Date(new Date(lastClaimAt).getTime() + 6 * 60 * 60 * 1000).toISOString()
      : null;

    const rows: EarningRow[] = [];
    for (const c of claimRows) {
      const isMiningClaim = (c.kind ?? "mining") === "mining";
      const self = Number(c.self_amount ?? 0);
      const ref = Number(c.referral_amount ?? 0);
      rows.push({
        id: `claim-${c.id}`,
        kind: isMiningClaim ? "mining" : "bonus",
        label: isMiningClaim ? "⛏️ মাইনিং ক্লেইম" : "🎉 প্রোমো বোনাস সংশোধন",
        note: isMiningClaim
          ? `নিজের স্লট ${self.toFixed(2)}৳ + রেফার ১০% কমিশন ${ref.toFixed(2)}৳`
          : c.note ?? "প্রোমো বোনাস",
        amount: Number(c.amount ?? 0),
        created_at: c.created_at,
      });
    }
    for (const v of vouchers ?? []) {
      rows.push({
        id: `voucher-${v.id}`,
        kind: "bonus",
        label: v.status === "claimed" ? "🎁 বোনাস (claim হয়েছে)" : "🎁 বোনাস (pending)",
        note: v.reason ?? null,
        amount: v.status === "claimed" ? Number(v.amount) : 0,
        created_at: v.created_at,
      });
    }
    for (const c of credits ?? []) {
      const amt = Number(c.amount);
      rows.push({
        id: `credit-${c.id}`,
        kind: amt >= 0 ? "admin_in" : "admin_out",
        label: amt >= 0 ? "➕ অ্যাডমিন ব্যালেন্স দিয়েছে" : "➖ অ্যাডমিন ব্যালেন্স কেটেছে",
        note: c.note ?? null,
        amount: amt,
        created_at: c.created_at,
      });
    }
    for (const t of transfersIn ?? []) {
      rows.push({ id: `tin-${t.id}`, kind: "transfer_in", label: "📥 অন্য ইউজার পাঠিয়েছে", note: t.note ?? null, amount: Number(t.amount), created_at: t.created_at });
    }
    for (const t of transfersOut ?? []) {
      rows.push({ id: `tout-${t.id}`, kind: "transfer_out", label: "📤 অন্যকে পাঠিয়েছেন", note: t.note ?? null, amount: -Number(t.amount) - Number(t.fee_amount || 0), created_at: t.created_at });
    }
    for (const r of recharges ?? []) {
      rows.push({
        id: `rc-${r.id}`,
        kind: "recharge",
        label: `📱 মোবাইল রিচার্জ · ${r.status}`,
        note: r.mobile ?? null,
        amount: r.status === "failed" ? 0 : -Number(r.total_deducted || r.amount),
        created_at: r.created_at,
      });
    }
    for (const w of withdrawals ?? []) {
      rows.push({
        id: `wd-${w.id}`,
        kind: "withdraw",
        label: `💸 উইথড্র · ${w.status === "paid" ? "পেমেন্ট হয়েছে" : w.status === "rejected" ? "বাতিল" : "অপেক্ষায়"}`,
        note: `${String(w.provider).toUpperCase()} ${w.wallet_number ?? ""}`.trim(),
        amount: w.status === "paid" ? -Number(w.amount) : 0,
        created_at: w.created_at,
      });
    }
    for (const d of debts ?? []) {
      rows.push({
        id: `debt-${d.id}`,
        kind: "debt",
        label: `⚠️ ভুল পেমেন্ট ফেরত · ${d.status === "active" ? "বাকি" : "শোধ"}`,
        note: d.message ?? null,
        amount: d.status === "active" ? -Number(d.amount) : 0,
        created_at: d.created_at,
      });
    }
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const voucherClaimed = (vouchers ?? []).filter((v: any) => v.status === "claimed").reduce((s: number, v: any) => s + Number(v.amount), 0);
    const adminIn = (credits ?? []).filter((c: any) => Number(c.amount) > 0).reduce((s: number, c: any) => s + Number(c.amount), 0);
    const transferInTotal = (transfersIn ?? []).reduce((s: number, t: any) => s + Number(t.amount), 0);
    const paidWithdrawals = (withdrawals ?? []).filter((w: any) => w.status === "paid").reduce((s: number, w: any) => s + Number(w.amount), 0);
    const successfulRecharges = (recharges ?? []).filter((r: any) => r.status === "success").reduce((s: number, r: any) => s + Number(r.total_deducted || r.amount), 0);
    const transfersOutTotal = (transfersOut ?? []).reduce((s: number, t: any) => s + Number(t.amount) + Number(t.fee_amount || 0), 0);

    const pendingWithdrawals = (withdrawals ?? []).filter((w: any) => w.status === "pending").reduce((s: number, w: any) => s + Number(w.amount), 0);
    // Pending requests already reserved balance, so they count as accounted-out;
    // otherwise the leftover would be mislabelled as a huge withdraw "fee".
    const accountedOut = paidWithdrawals + pendingWithdrawals + successfulRecharges + transfersOutTotal;
    const feeOrAdjustmentOut = Math.max(0, withdrawn - accountedOut);
    const debtActive = (debts ?? []).filter((d: any) => d.status === "active").reduce((s: number, d: any) => s + Number(d.amount), 0);

    const { buildEarningsBreakdown } = await import("@/lib/earnings-breakdown.server");
    const breakdown = await buildEarningsBreakdown(supabaseAdmin, userId);

    return {
      breakdown,
      totals: {
        accrued,
        withdrawn,
        balance: accrued - withdrawn - debtActive,
        miningTotal,
        selfMiningTotal,
        referralTotal: referralAccrued,
        bonusTotal: Math.max(0, bonusTotal - voucherClaimed - adminIn - transferInTotal),
        voucherClaimed,
        adminIn,
        transferInTotal,
        unclassifiedCredit,
        paidWithdrawals,
        successfulRecharges,
        transfersOutTotal,
        pendingWithdrawals,
        feeOrAdjustmentOut,
        debtActive,
      },
      claim: {
        pending: pendingClaim,
        pendingReferral,
        pendingSelf: Math.max(0, pendingClaim - pendingReferral),
        claimedTotal,
        lastClaimAt,
        nextClaimAt,
        canClaim: pendingClaim >= 0.5 && (!nextClaimAt || new Date(nextClaimAt).getTime() <= Date.now()),
      },
      isActive: !!(mining as any)?.is_active,
      profile: {
        name: (profile as any)?.display_name ?? "ইউজার",
        uid: (profile as any)?.uid_seq ?? null,
        phone: (profile as any)?.phone_number ?? null,
      },
      rows,
    };
  });

export const claimMiningEarnings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_mining_earnings", { _user_id: context.userId });
    if (error) throw new Error(error.message);
    const res = (data ?? {}) as any;
    if (!res.ok) {
      if (res.reason === "too_soon") {
        throw new Error(`⏳ প্রতি ৬ ঘণ্টায় একবার ক্লেইম করা যায় — পরবর্তী ক্লেইম: ${new Date(res.next_at).toLocaleString("bn-BD")}`);
      }
      if (res.reason === "too_small") {
        throw new Error("এখনো ক্লেইম করার মতো পরিমাণ জমা হয়নি (সর্বনিম্ন ০.৫০৳)।");
      }
      throw new Error("ক্লেইম করা যায়নি — আবার চেষ্টা করুন।");
    }
    return {
      ok: true,
      amount: Number(res.amount ?? 0),
      selfAmount: Number(res.self_amount ?? 0),
      referralAmount: Number(res.referral_amount ?? 0),
    };
  });

/** আনলক হওয়া মাইনিং টাকা → মেইন ব্যালেন্সে নিয়ে নেওয়া (ক্লেইম) */
export const claimMiningToMain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDailyActive(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_mining_to_main" as any, {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const res = (data ?? {}) as any;
    if (!res.ok) {
      throw new Error("এখনো ক্লেইম করার মতো আনলক মাইনিং টাকা জমা হয়নি (সর্বনিম্ন ০.৫০৳)।");
    }
    return { ok: true, amount: Number(res.amount ?? 0) };
  });

/**
 * যে ঘরে GoodDollar এখনো Re-verify চায়নি — সেই ঘরের জমা মাইনিং টাকা এখনই
 * মেইন ব্যালেন্সে নেওয়া যায় (১০৳ Re-verify বোনাস বাদে; সেটা Re-verify করলেই)।
 */
export const claimSlotMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await requireDailyActive(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("claim_slot_mining" as any, {
      _user_id: context.userId,
      _task_id: data.taskId,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as any;
    if (!out.ok) {
      if (out.reason === "reverify_required") throw new Error("🔒 এই ঘরে GoodDollar Re-verify চেয়েছে — Re-verify না করলে এই ঘরের মাইনিং টাকা খুলবে না।");
      if (out.reason === "too_small") throw new Error("এই ঘরে এখনো ক্লেইম করার মতো মাইনিং জমা হয়নি (সর্বনিম্ন ০.৫০৳)।");
      if (out.reason === "use_full_claim") throw new Error("এই ঘরে Re-verify বোনাসসহ পুরো ক্লেইম অপেক্ষা করছে — সেটিই ক্লেইম করুন।");
      throw new Error("ক্লেইম করা যায়নি — আবার চেষ্টা করুন।");
    }
    return { ok: true, mining: Number(out.mining ?? 0) };
  });

/** সব ঘরের জমা মাইনিং একসাথে মেইন ব্যালেন্সে (১০৳ বোনাস ছাড়া — সেটা Re-verify করলেই) */
export const claimAllSlotMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireDailyActive(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("claim_all_slot_mining" as any, {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as any;
    if (!out.ok) {
      if (out.reason === "reverify_required") {
        throw new Error(
          `🔒 ${Number(out.locked_slots ?? 0)}টি ঘরে GoodDollar Re-verify চেয়েছে — ওই ঘরগুলোর মাইনিং টাকা Re-verify করার পরেই খুলবে।`,
        );
      }
      throw new Error("এখনো ক্লেইম করার মতো মাইনিং জমা হয়নি (সর্বনিম্ন ০.৫০৳)।");
    }
    return { ok: true, mining: Number(out.mining ?? 0), slots: Number(out.slots ?? 0) };
  });

