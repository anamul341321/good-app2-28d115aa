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

export const respondSlotReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        approve: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const mod = await import("@/lib/slot-reset-requests.server");
    if (!data.approve) {
      await mod.declineResetRequest(data.requestId, context.userId);
      return { ok: true, approved: false, done: [] as number[] };
    }
    const res = await mod.applyApprovedReset(data.requestId, context.userId);
    return { ok: true, approved: true, done: res.done };
  });

/**
 * ইউজার নিজেই নিজের একটি স্লট রিসেট করতে পারবে (অ্যাডমিনকে বলার দরকার নেই)।
 * রিসেটের পর স্লটটি খালি হবে এবং নতুন করে ফেস ভেরিফিকেশন করা যাবে।
 * ফিরিয়ে আনা (restore) শুধু অ্যাডমিন প্যানেল থেকেই সম্ভব।
 */
export const selfResetSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ slot: z.number().int().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("id, slot, status")
      .eq("user_id", context.userId)
      .eq("slot", data.slot)
      .maybeSingle();
    if (!task) throw new Error("এই স্লটটি পাওয়া যায়নি");
    if ((task as any).status === "empty") throw new Error("এই স্লটটি এখনই খালি আছে");

    const { resetTaskById } = await import("@/lib/slot-reset-core.server");
    const res = await resetTaskById((task as any).id as string, "user");

    // চলমান কোনো অনুরোধ থাকলে সেটাও বন্ধ করে দিই।
    await supabaseAdmin
      .from("slot_reset_requests")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("status", "pending");

    return { ok: true as const, slot: res.slot };
  });
