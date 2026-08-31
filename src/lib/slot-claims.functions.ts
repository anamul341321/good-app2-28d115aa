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

    const taskIds = Array.from(new Set(((data ?? []) as any[]).map((r) => String(r.task_id))));
    const taskInfo = new Map<string, { whitelistOk: boolean; locked: number; dueAt: string | null }>();
    if (taskIds.length) {
      const { data: tasks } = await supabaseAdmin
        .from("tasks" as any)
        .select("id, whitelist_ok, locked_mined, reverify_due_at")
        .in("id", taskIds);
      for (const t of (tasks ?? []) as any[]) {
        taskInfo.set(String(t.id), {
          whitelistOk: t.whitelist_ok === true,
          locked: Number(t.locked_mined ?? 0),
          dueAt: (t.reverify_due_at as string | null) ?? null,
        });
      }
    }

    // এক ঘরে একাধিক pending থাকলে একসাথে যোগ করে দেখাই
    const map = new Map<string, { taskId: string; slot: number; bonus: number; mining: number; whitelistOk: boolean; dueAt: string | null }>();
    for (const row of (data ?? []) as any[]) {
      const key = row.task_id as string;
      const info = taskInfo.get(key);
      const prev = map.get(key) ?? {
        taskId: key,
        slot: Number(row.slot),
        bonus: 0,
        // ঘরে জমে থাকা (এখনো ক্লেইম না করা) মাইনিংও যোগ করে দেখাই — কয়েকদিন
        // জমিয়ে ক্লেইম করলেও এক টাকাও হারায় না।
        mining: info?.locked ?? 0,
        whitelistOk: info?.whitelistOk ?? false,
        dueAt: info?.dueAt ?? null,
      };
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

    // ক্লেইমের ঠিক আগে আবার on-chain whitelist যাচাই — কোনো ঘর whitelist না
    // থাকলে সেই ঘরের বোনাস/মাইনিং মেইন ব্যালেন্সে আসবে না।
    const { data: task } = await supabaseAdmin
      .from("tasks" as any)
      .select("id, wallet_address, whitelist_ok")
      .eq("id", data.taskId)
      .eq("user_id", context.userId)
      .maybeSingle();
    const walletAddress = (task as any)?.wallet_address as string | null;
    if (walletAddress) {
      try {
        const { isWhitelistedRPC } = await import("@/lib/celo-whitelist");
        const ok = await isWhitelistedRPC(walletAddress);
        if (!ok) {
          // whitelist_ok = false করলে DB trigger আগে ক্লেইম করা টাকাও
          // মেইন ব্যালেন্স থেকে মাইনিং ব্যালেন্সে ফিরিয়ে নেবে।
          await supabaseAdmin
            .from("tasks" as any)
            .update({ whitelist_ok: false })
            .eq("id", data.taskId)
            .eq("user_id", context.userId);
          throw new Error(
            "এই ঘরটি এখন whitelist-এ নেই — Re-verify সম্পন্ন করলেই এই ঘরের মাইনিং ও ১০৳ বোনাস মেইন ব্যালেন্সে নেওয়া যাবে।",
          );
        }
      } catch (e: any) {
        if (typeof e?.message === "string" && e.message.includes("whitelist-এ নেই")) throw e;
        // RPC নেটওয়ার্ক সমস্যায় ক্লেইম আটকে দেব না — DB-র whitelist_ok চেকই চলবে।
      }
    }

    const { data: res, error } = await supabaseAdmin.rpc("claim_slot_reward" as any, {
      _user_id: context.userId,
      _task_id: data.taskId,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as any;
    if (!out.ok) {
      throw new Error(
        out.reason === "reverify_required"
          ? "এই ঘরে আবার Re-verify চাওয়া হয়েছে — Re-verify করলেই মাইনিং ও ১০৳ বোনাস খুলবে।"
          : "এই ঘরে এখন ক্লেইম করার মতো কিছু নেই।",
      );
    }

    return {
      ok: true,
      bonus: Number(out.bonus ?? 0),
      mining: Number(out.mining ?? 0),
      total: Number(out.total ?? 0),
    };
  });
