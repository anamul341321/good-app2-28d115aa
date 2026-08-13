/**
 * Server-only payout settlement shared by the admin "Auto Pay" action and the
 * iPayBD webhook. Money is already debited when the user creates the request,
 * so a successful payout only flips the row to "paid"; a failure leaves the
 * row pending so an admin can retry or pay manually.
 */
import type { MfsOperator } from "@/lib/ipaybd.server";

export const PAYOUT_WEBHOOK_PATH = "/api/public/ipaybd-webhook";

export function payoutWebhookUrl() {
  const base = (process.env["PUBLIC_SITE_URL"] ?? "https://good-app2.lovable.app").replace(/\/$/, "");
  return `${base}${PAYOUT_WEBHOOK_PATH}`;
}

export function toMfsOperator(provider: string | null | undefined): MfsOperator | null {
  const p = String(provider ?? "").toLowerCase();
  if (p === "bkash" || p === "nagad" || p === "rocket" || p === "upay") return p as MfsOperator;
  return null;
}

/** Fire the payout for a pending withdrawal row. Returns a Bangla message. */
export async function sendPayout(withdrawalId: string, opts?: { auto?: boolean }) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { ipaybdCreateWithdraw, isIpaybdConfigured } = await import("@/lib/ipaybd.server");

  if (!isIpaybdConfigured()) return { ok: false, message: "অটো পেমেন্ট কনফিগার করা নেই" };

  const { data: w } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status, payout_status, payout_trxid")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (!w) return { ok: false, message: "Withdrawal পাওয়া যায়নি" };
  if (w.status !== "pending") return { ok: false, message: "এই রিকোয়েস্ট আগেই প্রসেস হয়েছে" };
  if ((w as any).payout_status === "sent" || (w as any).payout_status === "success") {
    return { ok: false, message: "অটো পেমেন্ট আগেই পাঠানো হয়েছে" };
  }

  const operator = toMfsOperator((w as any).provider);
  if (!operator) return { ok: false, message: "এই মেথডে অটো পেমেন্ট সম্ভব না (শুধু bKash/Nagad/Rocket/Upay)" };

  const number = String((w as any).wallet_number ?? "").replace(/\D/g, "");
  if (number.length < 11) return { ok: false, message: "ওয়ালেট নম্বর ঠিক নেই" };

  const amount = Math.floor(Number(w.amount));
  if (!(amount > 0)) return { ok: false, message: "Amount ঠিক নেই" };

  await supabaseAdmin
    .from("withdrawals")
    .update({
      payout_provider: "ipaybd",
      payout_status: "sending",
      payout_requested_at: new Date().toISOString(),
    } as any)
    .eq("id", w.id);

  const res = await ipaybdCreateWithdraw({
    amount,
    operator,
    customerNumber: number,
    withdrawId: String(w.id),
    webhookUrl: payoutWebhookUrl(),
  });

  await supabaseAdmin
    .from("withdrawals")
    .update({
      payout_status: res.ok ? "sent" : "failed",
      payout_trxid: res.trxid,
      payout_message: res.message,
    } as any)
    .eq("id", w.id);

  if (!res.ok) {
    try {
      const { alertOwnerPrivate } = await import("@/lib/withdraw-fastpay.server");
      await alertOwnerPrivate(`⚠️ অটো পেমেন্ট ব্যর্থ — ${amount}৳ · ${operator} ${number}\nকারণ: ${res.message}`);
    } catch {
      /* ignore */
    }
    return { ok: false, message: res.message };
  }

  if (opts?.auto) {
    try {
      const { alertOwnerPrivate } = await import("@/lib/withdraw-fastpay.server");
      await alertOwnerPrivate(`🚀 অটো পেমেন্ট পাঠানো হলো — ${amount}৳ · ${operator} ${number}`);
    } catch {
      /* ignore */
    }
  }

  return { ok: true, message: `পেমেন্ট রিকোয়েস্ট পাঠানো হয়েছে (TrxID: ${res.trxid ?? "—"})` };
}

/** Apply a final payout result (from webhook or a status poll). */
export async function applyPayoutResult(input: {
  withdrawId: string;
  success: boolean;
  detail: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: w } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status")
    .eq("id", input.withdrawId)
    .maybeSingle();
  if (!w) return { ok: false };

  const payout = Math.floor(Number(w.amount));

  if (input.success) {
    if (w.status === "pending") {
      await supabaseAdmin
        .from("withdrawals")
        .update({
          status: "paid",
          paid_by: "Auto (iPayBD)",
          processed_at: new Date().toISOString(),
          payout_status: "success",
          payout_message: input.detail,
        } as any)
        .eq("id", w.id);

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
          `${payout}৳ আপনার ${String((w as any).provider).toUpperCase()} ${(w as any).wallet_number ?? ""} নম্বরে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।` +
          `\nTrxID: ${input.detail}`,
      });

      try {
        const { markFastPayCardDone } = await import("@/lib/withdraw-fastpay.server");
        await markFastPayCardDone({ withdrawalId: String(w.id), action: "paid", by: "Auto (iPayBD)" });
      } catch {
        /* ignore */
      }
    } else {
      await supabaseAdmin
        .from("withdrawals")
        .update({ payout_status: "success", payout_message: input.detail } as any)
        .eq("id", w.id);
    }
  } else {
    // Failure: leave the request pending (money still debited) so an admin can
    // retry or pay manually / reject with refund.
    await supabaseAdmin
      .from("withdrawals")
      .update({ payout_status: "rejected", payout_message: input.detail } as any)
      .eq("id", w.id);
    try {
      const { alertOwnerPrivate } = await import("@/lib/withdraw-fastpay.server");
      await alertOwnerPrivate(
        `❌ অটো পেমেন্ট ফেল — ${payout}৳ · ${String((w as any).provider).toUpperCase()} ${(w as any).wallet_number ?? ""}\nকারণ: ${input.detail}\nম্যানুয়ালি দেখুন।`,
      );
    } catch {
      /* ignore */
    }
  }

  return { ok: true };
}

/** Auto-pay a freshly created request when the admin switch allows it. */
export async function maybeAutoPay(withdrawalId: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("bonus_settings")
      .select("auto_payout_enabled, auto_payout_max, auto_payout_kyc_only")
      .eq("id", "default")
      .maybeSingle();
    if ((s as any)?.auto_payout_enabled !== true) return;

    const { data: w } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, amount, provider")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (!w) return;

    const max = Number((s as any)?.auto_payout_max ?? 300);
    if (Number(w.amount) > max) return;
    if (!toMfsOperator((w as any).provider)) return;

    if ((s as any)?.auto_payout_kyc_only !== false) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("kyc_verified, telegram_user_id")
        .eq("id", w.user_id)
        .maybeSingle();
      const kycOk = !!(prof as any)?.kyc_verified || !!(prof as any)?.telegram_user_id;
      if (!kycOk) return;
    }


    await sendPayout(withdrawalId, { auto: true });
  } catch {
    /* auto-pay must never break the user's request */
  }
}
