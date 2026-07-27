import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_WITHDRAW_BDT } from "./constants";
import { computeLiveBalance } from "./mining";

const WithdrawInput = z.object({
  amount: z.number().positive(),
  provider: z.enum(["bkash", "nagad"]).optional(),
});

export const requestWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WithdrawInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = Math.floor(data.amount);
    if (amount < MIN_WITHDRAW_BDT) throw new Error(`সর্বনিম্ন উইথড্র ${MIN_WITHDRAW_BDT}৳`);

    // Daily limit: max 3 withdraw requests per 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: dailyCount } = await supabase
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((dailyCount ?? 0) >= 3) {
      throw new Error("দৈনিক সর্বোচ্চ ৩টি withdraw রিকোয়েস্ট করা যাবে — ২৪ ঘণ্টা পর আবার চেষ্টা করুন");
    }

    // Tiered platform fee: <100৳ → 20%, ≥100৳ → 10%
    const feeRate = amount < 100 ? 0.2 : 0.1;
    const fee = Math.floor(amount * feeRate);
    const payout = amount - fee;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("bonus_settings")
      .select("bkash_enabled,nagad_enabled,bkash_off_message,nagad_off_message")
      .eq("id", "default")
      .maybeSingle();
    const bkashEnabled = settings?.bkash_enabled !== false;
    const nagadEnabled = settings?.nagad_enabled !== false;

    const { data: userWallets } = await supabase.from("wallets").select("*").eq("user_id", userId);
    const walletBkash = (userWallets ?? []).find((w: any) => w.provider === "bkash") ?? null;
    const walletNagad = (userWallets ?? []).find((w: any) => w.provider === "nagad") ?? null;

    let chosen = data.provider ?? null;
    if (!chosen) {
      // Auto: prefer whatever provider is enabled + user has set.
      if (bkashEnabled && walletBkash) chosen = "bkash";
      else if (nagadEnabled && walletNagad) chosen = "nagad";
    }
    if (!chosen) throw new Error("আগে ওয়ালেট নম্বর সেট করুন");

    if (chosen === "bkash" && !bkashEnabled) {
      throw new Error(settings?.bkash_off_message || "বিকাশ withdraw এখন বন্ধ — অনুগ্রহ করে নগদে withdraw দিন");
    }
    if (chosen === "nagad" && !nagadEnabled) {
      throw new Error(settings?.nagad_off_message || "নগদ withdraw এখন বন্ধ — অনুগ্রহ করে বিকাশে withdraw দিন");
    }

    const wallet = chosen === "bkash" ? walletBkash : walletNagad;
    if (!wallet) throw new Error(chosen === "bkash" ? "প্রথমে বিকাশ নম্বর সেট করুন" : "প্রথমে নগদ নম্বর সেট করুন");

    const { data: mining } = await supabase.from("mining_state").select("*").eq("user_id", userId).maybeSingle();
    if (!mining) throw new Error("ব্যালেন্স পাওয়া যায়নি");

    const { data: activeDebts } = await supabaseAdmin
      .from("user_debts").select("amount").eq("user_id", userId).in("status", ["active", "claimed"]);
    const debtTotal = (activeDebts ?? []).reduce((s: number, d: any) => s + Number(d.amount), 0);

    const eff = Number((mining as any).effective_task_count ?? 0);
    const refs = Number((mining as any).qualifying_referees ?? 0);
    const balance = computeLiveBalance({
      accrued: Number(mining.accrued_amount),
      withdrawn: Number(mining.withdrawn_amount),
      isActive: mining.is_active,
      lastCreditedAt: mining.last_credited_at,
      effectiveTaskCount: eff,
      qualifyingReferees: refs,
      debt: debtTotal,
    });

    if (debtTotal > 0) throw new Error(`⚠ আপনার অ্যাকাউন্টে ${Math.ceil(debtTotal)}৳ ওয়ার্নিং আছে — আগে সেটা পরিশোধ করুন`);

    // Bonus balance is always withdrawable. Mining accrual unlocks 30 days after activated_at.
    const bonusTotal = Number((mining as any).bonus_amount ?? 0);
    const withdrawnTotal = Number(mining.withdrawn_amount);
    const bonusWithdrawn = Math.min(withdrawnTotal, bonusTotal);
    const bonusAvailable = Math.max(0, bonusTotal - bonusWithdrawn - debtTotal);
    const activatedAt = mining.activated_at ? new Date(mining.activated_at).getTime() : null;
    const unlockAt = activatedAt ? activatedAt + 30 * 24 * 60 * 60 * 1000 : null;
    const miningLocked = !unlockAt || Date.now() < unlockAt;

    const available = miningLocked ? bonusAvailable : balance;
    if (amount > available) {
      if (miningLocked && amount <= balance) {
        const daysLeft = unlockAt ? Math.ceil((unlockAt - Date.now()) / (24 * 60 * 60 * 1000)) : 30;
        throw new Error(`মাইনিং ব্যালেন্স ৩০ দিন লক — আরও ${daysLeft} দিন পর withdraw করা যাবে। এখন শুধু বোনাস (${Math.floor(bonusAvailable)}৳) withdraw করা যাবে।`);
      }
      throw new Error(`ব্যালেন্স কম: ${Math.floor(available)}৳`);
    }

    const now = new Date();
    const nowMs = now.getTime();
    const lastMs = mining.last_credited_at ? new Date(mining.last_credited_at).getTime() : nowMs;
    const elapsedSec = Math.max(0, (nowMs - lastMs) / 1000);
    const { MINING_RATE_BDT_PER_SEC, TOTAL_TASKS } = await import("./constants");
    const activeRate = mining.is_active
      ? MINING_RATE_BDT_PER_SEC * (eff / TOTAL_TASKS + 0.10 * refs)
      : 0;
    const newAccrued = Number(mining.accrued_amount) + elapsedSec * activeRate;
    const newWithdrawn = Number(mining.withdrawn_amount) + amount;

    const { error: mErr } = await supabaseAdmin
      .from("mining_state")
      .update({
        accrued_amount: newAccrued,
        withdrawn_amount: newWithdrawn,
        last_credited_at: now.toISOString(),
      })
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);

    const { error: wErr } = await supabaseAdmin.from("withdrawals").insert({
      user_id: userId,
      amount: payout,
      provider: chosen,
      wallet_number: wallet.number,
      admin_note: `[Fee ${Math.round(feeRate * 100)}%] Gross ${amount}৳ − Fee ${fee}৳ = Payout ${payout}৳`,
    });
    if (wErr) throw new Error(wErr.message);

    return { ok: true, gross: amount, fee, payout };
  });
