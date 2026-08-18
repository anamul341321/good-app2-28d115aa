import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** প্রতিটি ঘরের (স্লট) জন্য দাবি করার মতো পুরস্কার — বোনাস + ওই ঘরের মাইনিং */
export const listSlotClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("settle_mining", { _user_id: context.userId });

    const { data, error } = await supabaseAdmin
      .from("slot_claims" as any)
      .select("id, task_id, slot, bonus_amount, mining_amount, created_at")
      .eq("user_id", context.userId)
      .eq("status", "pending")
      .order("slot", { ascending: true });
    if (error) throw new Error(error.message);

    // এক ঘরে একাধিক pending থাকলে একসাথে যোগ করে দেখাই
    const map = new Map<string, { taskId: string; slot: number; bonus: number; mining: number }>();
    for (const row of (data ?? []) as any[]) {
      const key = row.task_id as string;
      const prev = map.get(key) ?? { taskId: key, slot: Number(row.slot), bonus: 0, mining: 0 };
      prev.bonus += Number(row.bonus_amount ?? 0);
      prev.mining += Number(row.mining_amount ?? 0);
      map.set(key, prev);
    }
    return Array.from(map.values());
  });

/** এক ঘরের বোনাস + মাইনিং একসাথে মেইন ব্যালেন্সে নেওয়া */
export const claimSlotReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ taskId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("claim_slot_reward" as any, {
      _user_id: context.userId,
      _task_id: data.taskId,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as any;
    if (!out.ok) throw new Error("এই ঘরে এখন ক্লেইম করার মতো কিছু নেই।");
    return {
      ok: true,
      bonus: Number(out.bonus ?? 0),
      mining: Number(out.mining ?? 0),
      total: Number(out.total ?? 0),
    };
  });
