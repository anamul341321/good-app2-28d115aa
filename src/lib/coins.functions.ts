import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoinSummary = {
  balance: number;
  total_earned: number;
  today: number;
  watch_today: number;
  watch_daily_cap: number;
  telegram_joined: boolean;
};

export const getCoinSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("get_coin_summary", { _user_id: userId });
    if (error) throw new Error(error.message);
    return (data ?? {
      balance: 0,
      total_earned: 0,
      today: 0,
      watch_today: 0,
      watch_daily_cap: 9000,
      telegram_joined: false,
    }) as CoinSummary;
  });

export const awardCoinEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        event: z.enum(["reel", "post", "story", "comment", "message"]),
        referenceId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await (supabase as any).rpc("award_coin_event", {
      _user_id: userId,
      _event: data.event,
      _reference_id: data.referenceId ?? null,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; awarded: number; capped: boolean; balance: number };
  });

export const claimWatchCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ seconds: z.number().int().min(0).max(600) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await (supabase as any).rpc("claim_watch_coins", {
      _user_id: userId,
      _seconds: data.seconds,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; awarded: number; capped?: boolean; balance?: number; error?: string };
  });

export const claimTelegramJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("claim_telegram_join", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; awarded: number; already: boolean; balance: number };
  });
