import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ClaimInput = z.object({
  debtId: z.string().uuid(),
  fromNumber: z.string().trim().min(4, "সঠিক নম্বর দিন").max(30),
  note: z.string().trim().max(500).optional().nullable(),
});

// User declares they refunded the mistakenly-received payment.
// Sets status='claimed' and stores the number they Cash-Out'd from + a note.
// Admin later approves (adminResolveDebt) which flips to 'resolved'.
export const claimDebtRepaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ClaimInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: debt, error: fErr } = await supabaseAdmin
      .from("user_debts")
      .select("id, user_id, status")
      .eq("id", data.debtId)
      .maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!debt) throw new Error("Warning পাওয়া যায়নি");
    if (debt.user_id !== context.userId) throw new Error("এটা আপনার warning না");
    if (debt.status === "resolved") throw new Error("এই warning ইতিমধ্যে সমাধান হয়েছে");

    const { error } = await supabaseAdmin
      .from("user_debts")
      .update({
        status: "claimed",
        claim_from_number: data.fromNumber,
        claim_note: data.note?.trim() || null,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", data.debtId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
