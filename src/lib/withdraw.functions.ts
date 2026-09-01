import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_WITHDRAW_BDT, MIN_PAYOUT_BDT, withdrawPayout, withdrawFee, withdrawDebit } from "./constants";
import { computeLiveBalance } from "./mining";
import { withdrawCountdownInfo } from "./withdraw-window";
import { AD_BOOST, adBoostWithdrawInfo } from "./ad-boost";

const CELO_ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

const WithdrawInput = z.object({
  amount: z.number().positive(),
  provider: z.enum(["bkash", "nagad", "usdt"]).optional(),
  usdtAddress: z.string().trim().optional(),
});

export const requestWithdraw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => WithdrawInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const amount = Math.floor(data.amount);
    if (amount < MIN_WITHDRAW_BDT || withdrawPayout(amount) < MIN_PAYOUT_BDT) {
      throw new Error(`সর্বনিম্ন উইথড্র ${MIN_WITHDRAW_BDT}৳ — ফি কাটার পর হাতে কমপক্ষে ${MIN_PAYOUT_BDT}৳ আসতে হবে`);
    }

    // KYC (টেলিগ্রাম বট লিংক) ছাড়া উইথড্র বন্ধ
    const { data: kycProf } = await supabase
      .from("profiles")
      .select("kyc_verified, telegram_user_id, email, email_verified, banned, balance_frozen, balance_frozen_reason, uid_seq, display_name")
      .eq("id", userId)
      .maybeSingle();
    if ((kycProf as any)?.banned === true) {
      throw new Error("আপনার account block করা আছে — admin-এর সাথে যোগাযোগ করুন");
    }
    if ((kycProf as any)?.balance_frozen === true) {
      throw new Error(
        `🧊 আপনার ব্যালেন্স আপাতত freeze করা আছে — উইথড্র করা যাবে না।${
          (kycProf as any)?.balance_frozen_reason ? ` কারণ: ${(kycProf as any).balance_frozen_reason}` : ""
        } Telegram সাপোর্টে যোগাযোগ করুন।`,
      );
    }
    // টেলিগ্রাম লিংক থাকলেই KYC ধরা হবে (পুরোনো লিংক করা একাউন্টও চলবে)
    const kycOk = !!(kycProf as any)?.telegram_user_id || !!(kycProf as any)?.kyc_verified;
    if (!kycOk) {
      throw new Error("🔐 উইথড্র করতে আগে KYC করতে হবে — হোম পেজের 'KYC করুন' বাটনে চাপ দিয়ে টেলিগ্রাম বট Start করুন (১ মিনিটের কাজ)।");
    }

    // Gmail ভেরিফিকেশন শুধু তখনই বাধ্যতামূলক, যখন admin panel থেকে
    // Gmail কোড (OTP) সিস্টেম ON করা আছে। OFF থাকলে Gmail অপশনাল —
    // KYC verified হলেই উইথড্র করা যাবে।
    const { isEmailOtpEnabled } = await import("./auth-mode.server");
    if (await isEmailOtpEnabled()) {
      const emailOk = !!(kycProf as any)?.email_verified && !!(kycProf as any)?.email;
      if (!emailOk) {
        throw new Error("📧 উইথড্র চালু করতে আগে Gmail ভেরিফাই করুন — উপরের লাল বারে চাপ দিয়ে Gmail-এ কোড নিয়ে ভেরিফাই করে নিন (১ মিনিটের কাজ)।");
      }
    }


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

    // Percentage platform fee: 20% below 100৳, 10% for 100৳ and above.
    // Only whole taka is paid out; leftover paisa stays in the user's balance,
    // so we debit payout + fee instead of the full requested amount.
    const fee = withdrawFee(amount);
    const payout = withdrawPayout(amount);
    const debit = withdrawDebit(amount);


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("bonus_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle();
    const bkashEnabled = settings?.bkash_enabled !== false;
    const nagadEnabled = settings?.nagad_enabled !== false;
    const usdtEnabled = (settings as any)?.usdt_enabled !== false;
    const usdtRate = Number((settings as any)?.usdt_rate_bdt ?? 130);

    // No automatic weekly pause anymore — only the manual admin switch.
    // If `withdraw_off_until` is set and already past, the pause has expired.
    const offUntil = (settings as any)?.withdraw_off_until
      ? new Date((settings as any).withdraw_off_until).getTime()
      : null;
    const pauseExpired = offUntil !== null && offUntil <= Date.now();
    if ((settings as any)?.withdraw_enabled === false && !pauseExpired) {
      throw new Error((settings as any)?.withdraw_off_message || "উইথড্র রিকোয়েস্ট আপাতত বন্ধ আছে — একটু পরে আবার চেষ্টা করুন।");
    }

    // মাইনিং টাকা withdraw শুধু প্রতি মাসের ১–৩ তারিখে (Asia/Dhaka)।
    // বোনাস/মেইন ব্যালেন্স যেকোনো সময় তোলা যায়।
    // Ad Boost: 5 rewarded ads = 1 boost = 5 days less waiting (max 25 days).
    let miningWindowOpen = true;
    let miningWindowDaysLeft = 0;
    {
      const win = withdrawCountdownInfo(Date.now());
      if (!win.isOpen) {
        const cycleStart = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 7) + "-01";
        const { count: adCount } = await supabase
          .from("ad_views")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("cycle_month", cycleStart);
        const boostInfo = adBoostWithdrawInfo({
          now: Date.now(),
          nextFirstAt: win.nextFirstAt,
          isOpen: false,
          boosts: Math.floor((adCount ?? 0) / AD_BOOST.adsPerBoost),
        });
        miningWindowOpen = boostInfo.unlocked;
        miningWindowDaysLeft = boostInfo.effectiveDaysLeft;
      }
    }

    const { data: userWallets } = await supabase.from("wallets").select("*").eq("user_id", userId);
    const walletBkash = (userWallets ?? []).find((w: any) => w.provider === "bkash") ?? null;
    const walletNagad = (userWallets ?? []).find((w: any) => w.provider === "nagad") ?? null;

    let chosen = data.provider ?? null;
    if (!chosen) {
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
    if (chosen === "usdt" && !usdtEnabled) {
      throw new Error((settings as any)?.usdt_off_message || "USDT withdraw এখন বন্ধ");
    }

    let walletNumber: string;
    let providerNote = "";
    if (chosen === "usdt") {
      const addr = (data.usdtAddress ?? "").trim();
      if (!CELO_ADDR_RE.test(addr)) {
        throw new Error("সঠিক Celo network address দিন (0x দিয়ে শুরু, 42 character) — TRC20/ERC20 address দিলে টাকা হারাবেন");
      }
      walletNumber = addr;
      const usdAmount = (payout / usdtRate).toFixed(2);
      providerNote = `[USDT · Celo · Rate ${usdtRate}৳/$] Debit ${debit}৳ − Fee ${fee}৳ = ${payout}৳ ≈ ${usdAmount}$`;
    } else {
      const wallet = chosen === "bkash" ? walletBkash : walletNagad;
      if (!wallet) throw new Error(chosen === "bkash" ? "প্রথমে বিকাশ নম্বর সেট করুন" : "প্রথমে নগদ নম্বর সেট করুন");
      walletNumber = wallet.number;
      providerNote = `[Fee ${fee}৳] Debit ${debit}৳ − Fee ${fee}৳ = Payout ${payout}৳`;
    }

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
      selfSlots: Number((mining as any).self_slots ?? 0),
      referralUnits: Number((mining as any).referral_units ?? 0),
    selfQualified: (mining as any).self_qualified !== false,
      debt: debtTotal,
    });

    if (debtTotal > 0) throw new Error(`⚠ আপনার অ্যাকাউন্টে ${Math.ceil(debtTotal)}৳ ওয়ার্নিং আছে — আগে সেটা পরিশোধ করুন`);

    // মেইন ব্যালেন্স + আনলক হওয়া মাইনিং ব্যালেন্স — যেকোনো সময় withdraw করা যাবে।
    // মাইনিংয়ের লক অংশ শুধু ওই স্লট রি-ভেরিফাই করলেই আনলক হয়।
    const { data: bdRaw } = await (supabaseAdmin as any).rpc("get_user_balance_breakdown", { _user_id: userId });
    const bd = (bdRaw ?? {}) as Record<string, number>;
    const bonusAvailable = Number(bd.bonus_part ?? 0);
    const miningAvailable = Number(bd.mining_available ?? 0);
    const miningLockedAmount = Number(bd.mining_locked ?? 0);
    const available = bonusAvailable + miningAvailable;

    if (!miningWindowOpen && amount > bonusAvailable) {
      throw new Error(
        `⛏️ মাইনিং ব্যালেন্স শুধু প্রতি মাসের ১–৩ তারিখের মধ্যে withdraw করা যায় — আরও ${miningWindowDaysLeft} দিন বাকি। এখন শুধু মেইন/বোনাস ব্যালেন্স ${Math.floor(bonusAvailable)}৳ তোলা যাবে। (উইথড্র পেজে অ্যাড দেখে সময় কমাতে পারেন — ${AD_BOOST.adsPerBoost}টি অ্যাড = ${AD_BOOST.daysPerBoost} দিন কম)`,
      );
    }

    if (amount > available) {
      if (miningLockedAmount > 0 && amount <= balance) {
        throw new Error(`আপনার ${Math.floor(miningLockedAmount)}৳ মাইনিং ব্যালেন্স এখনো লক — যে স্লট রি-ভেরিফাই করবেন, সেই স্লটের মাইনিং টাকা আনলক হবে। এখন তোলা যাবে: ${Math.floor(available)}৳।`);
      }
      throw new Error(`ব্যালেন্স কম: ${Math.floor(available)}৳`);
    }

    // Final balance check, debit and request creation happen under one row lock.
    // This prevents rapid/concurrent requests from spending the same balance twice.
    const { data: atomicData, error: atomicError } = await (supabaseAdmin as any).rpc(
      "create_withdrawal_request_atomic",
      {
        _user_id: userId,
        _gross: debit,
        _payout: payout,
        _provider: chosen,
        _wallet_number: walletNumber,
        _admin_note: providerNote,
      },
    );
    if (atomicError) throw new Error(atomicError.message);
    const atomicResult = (atomicData ?? {}) as { ok?: boolean; error?: string };
    if (!atomicResult.ok) throw new Error(atomicResult.error || "উইথড্র রিকোয়েস্ট করা যায়নি");

    const newAccrued = Number(mining.accrued_amount);

    const newId =
      (atomicResult as any).withdrawal_id ??
      (atomicResult as any).id ??
      (
        await supabaseAdmin
          .from("withdrawals")
          .select("id")
          .eq("user_id", userId)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data?.id;

    // ---- নতুন withdraw request → অ্যাডমিনের ফোনে push notification ----
    // Auto-pay/Telegram কাজের আগে পাঠাই, যাতে ওই service ধীর হলেও alert দেরি না হয়।
    try {
      const { sendPushToAdmins } = await import("@/lib/push.server");
      const uidA = (kycProf as any)?.uid_seq ?? "—";
      const nameA = (kycProf as any)?.display_name ?? "User";
      await sendPushToAdmins({
        title: `💸 নতুন Withdraw ${payout}৳`,
        body: `${nameA} (UID ${uidA}) · ${chosen} · ${walletNumber}`,
        url: "/admin/withdrawals",
      });
    } catch (error) {
      console.error("[withdraw] admin push failed", error);
    }

    // ---- অটো পেমেন্ট (iPayBD) — admin switch on থাকলে সাথে সাথেই পাঠাবে ----
    try {
      if (newId) {
        const { maybeAutoPay } = await import("@/lib/payout.server");
        await maybeAutoPay(String(newId));
        // ⚡ এখনও pending থাকলে Telegram-এ fast-pay কার্ড পাঠাই (এক ট্যাপে paid/বাতিল)।
        try {
          const { sendFastPayCard } = await import("@/lib/withdraw-fastpay.server");
          await sendFastPayCard(String(newId));
        } catch {
          /* ignore */
        }
      }
    } catch {
      // অটো পেমেন্ট ফেল করলেও রিকোয়েস্ট থেকে যাবে (admin ম্যানুয়ালি দিবে)
    }

    // ---- সন্দেহজনক লেনদেন হলে Telegram-এ admin-কে mention করে জানাবে ----
    try {
      const { data: t10 } = await supabaseAdmin
        .from("tasks")
        .select("slot, status, whitelist_ok, wallet_address, reverify_count, initial_verify_at")
        .eq("user_id", userId)
        .lte("slot", 10);
      const rows = t10 ?? [];
      const first10 = rows.filter((t: any) => t.initial_verify_at).length;
      const reverified10 = rows.filter((t: any) => (t.reverify_count ?? 0) > 0).length;
      const { data: prof } = await supabaseAdmin
        .from("profiles").select("bonus_reverify_claimed").eq("id", userId).maybeSingle();
      const { data: paid } = await supabaseAdmin
        .from("withdrawals").select("amount").eq("user_id", userId).eq("status", "paid");
      const paidSum = (paid ?? []).reduce((s: number, w: any) => s + Number(w.amount), 0);

      const reasons: string[] = [];
      if (first10 < 10) reasons.push(`প্রথম ১০ slot-এ মাত্র ${first10}টি first verify`);
      if ((prof as any)?.bonus_reverify_claimed && reverified10 < 10) {
        reasons.push(`re-verify বোনাস পেয়েছে অথচ প্রথম ১০ slot-এ মাত্র ${reverified10}টি re-verify`);
      }
      if (paidSum + amount > newAccrued + 1) {
        reasons.push(`মোট withdraw (${Math.round(paidSum + amount)}৳) তার মোট আয় (${Math.round(newAccrued)}৳)-এর চেয়ে বেশি`);
      }

      // অন্য user-এর পাঠানো টাকা দিয়ে withdraw — খুব সন্দেহজনক
      const { data: recvT } = await supabaseAdmin
        .from("transfers")
        .select("amount, created_at, sender:profiles!transfers_sender_id_fkey(uid_seq, display_name)")
        .eq("receiver_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      const recvList = recvT ?? [];
      const recvSum = recvList.reduce((s: number, r: any) => s + Number(r.amount), 0);
      if (recvSum > 0) {
        const froms = recvList
          .slice(0, 4)
          .map((r: any) => `UID ${r.sender?.uid_seq ?? "—"} (${Math.round(Number(r.amount))}৳)`)
          .join(", ");
        reasons.push(`অন্য user-এর পাঠানো টাকা আছে — মোট ${Math.round(recvSum)}৳ · ${froms}`);
      }

      // লক থাকা মাইনিং ব্যালেন্স থাকা অবস্থায় বড় অংশ withdraw
      if (miningLockedAmount > 0 && amount > bonusAvailable + 1) {
        reasons.push(`লক মাইনিং (${Math.floor(miningLockedAmount)}৳) থাকা অবস্থায় বোনাস (${Math.floor(bonusAvailable)}৳)-এর বেশি withdraw চেয়েছে`);
      }

      if (reasons.length > 0) {
        const { alertAdminPrivate } = await import("./telegram-alert.server");
        const uid = (kycProf as any)?.uid_seq ?? "—";
        const name = (kycProf as any)?.display_name ?? "User";
        await alertAdminPrivate(

          `🚨 <b>সন্দেহজনক withdraw request</b>\n` +
            `👤 ${name} (UID ${uid})\n` +
            `💸 Gross ${amount}৳ · Fee ${fee}৳ · Payout ${payout}৳ · ${chosen}\n` +
            `⚠️ কারণ:\n• ${reasons.join("\n• ")}\n\n` +
            `Admin দয়া করে চেক করুন 🙏`,
        );
      }
    } catch {
      // Alerting must never block a legitimate withdraw request.
    }

    return { ok: true, gross: amount, fee, payout, provider: chosen };
  });

// Rejection screenshot for one of the caller's own withdrawals.
export const getMyRejectProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("withdrawals")
      .select("reject_proof_path")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    const path = (row as any)?.reject_proof_path as string | null;
    if (!path) return { url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage
      .from("withdraw-proof")
      .createSignedUrl(path, 60 * 30);
    return { url: signed?.signedUrl ?? null };
  });
