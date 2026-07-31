import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ইউজারের অপেক্ষমাণ স্লট রিসেট অনুরোধ (টেলিগ্রাম সাপোর্ট থেকে আসা)। */
export const getPendingSlotResets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("slot_reset_requests")
      .select("id, slots, created_at, requested_by")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    return (data ?? []).map((r) => ({
      id: r.id as string,
      slots: (r.slots as number[]) ?? [],
      created_at: r.created_at as string,
    }));
  });

const Respond = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
});

export const respondSlotReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Respond.parse(i))
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/slot-reset-requests.server");
    if (!data.approve) {
      await mod.declineResetRequest(data.requestId, context.userId);
      return { ok: true, approved: false, done: [] as number[] };
    }
    const res = await mod.applyApprovedReset(data.requestId, context.userId);
    return { ok: true, approved: true, done: res.done };
  });
