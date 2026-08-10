import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Auto payout settings + whether iPayBD keys are configured. */
export const adminGetPayoutSettings = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await gate();
  const { isIpaybdConfigured } = await import("@/lib/ipaybd.server");
  const { payoutWebhookUrl } = await import("@/lib/payout.server");
  const { data } = await supabaseAdmin
    .from("bonus_settings")
    .select("auto_payout_enabled, auto_payout_max, auto_payout_kyc_only")
    .eq("id", "default")
    .maybeSingle();
  return {
    enabled: (data as any)?.auto_payout_enabled === true,
    max: Number((data as any)?.auto_payout_max ?? 300),
    kycOnly: (data as any)?.auto_payout_kyc_only !== false,
    configured: isIpaybdConfigured(),
    webhookUrl: payoutWebhookUrl(),
  };
});

export const adminSetPayoutSettings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        max: z.number().min(0).max(100000).optional(),
        kycOnly: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const patch: any = { id: "default", updated_at: new Date().toISOString() };
    if (typeof data.enabled === "boolean") patch.auto_payout_enabled = data.enabled;
    if (typeof data.max === "number") patch.auto_payout_max = Math.floor(data.max);
    if (typeof data.kycOnly === "boolean") patch.auto_payout_kyc_only = data.kycOnly;
    const { error } = await supabaseAdmin.from("bonus_settings").upsert(patch);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Send one pending withdrawal through iPayBD right now. */
export const adminSendPayout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    await gate();
    const { sendPayout } = await import("@/lib/payout.server");
    return await sendPayout(data.id);
  });

/** Poll iPayBD for a sent payout when the webhook did not arrive. */
export const adminRefreshPayout = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await gate();
    const { data: w } = await supabaseAdmin
      .from("withdrawals")
      .select("id, payout_trxid")
      .eq("id", data.id)
      .maybeSingle();
    const trxid = (w as any)?.payout_trxid as string | null;
    if (!trxid) return { ok: false, message: "কোনো অটো পেমেন্ট TrxID নেই" };

    const { ipaybdCheckStatus } = await import("@/lib/ipaybd.server");
    const res = await ipaybdCheckStatus(trxid);
    const d = (res as any)?.data ?? res ?? {};
    const status = String(d?.status ?? "").toLowerCase();
    if (!status) return { ok: false, message: "স্ট্যাটাস পাওয়া যায়নি" };

    const { applyPayoutResult } = await import("@/lib/payout.server");
    const success = status === "success" || status === "completed" || status === "paid";
    if (success || status === "rejected" || status === "failed") {
      await applyPayoutResult({
        withdrawId: data.id,
        success,
        detail: String(d?.msg ?? d?.message ?? status),
      });
    }
    return { ok: true, message: `স্ট্যাটাস: ${status}` };
  });
