import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMOJI_PACKS, THEMES } from "@/lib/cosmetics";

export type CosmeticState = {
  theme_key: string;
  emoji_key: string;
  owned: string[];
};

export const getCosmetics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CosmeticState> => {
    const { supabase, userId } = context;
    const [{ data: row }, { data: owned }] = await Promise.all([
      (supabase as any).from("coin_cosmetics").select("theme_key, emoji_key").eq("user_id", userId).maybeSingle(),
      (supabase as any).from("coin_shop_purchases").select("item_key").eq("user_id", userId),
    ]);
    return {
      theme_key: row?.theme_key ?? "default",
      emoji_key: row?.emoji_key ?? "classic",
      owned: (owned ?? []).map((o: { item_key: string }) => o.item_key),
    };
  });

export const buyCosmetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ itemKey: z.string().min(1).max(40) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const theme = THEMES.find((t) => t.key === data.itemKey);
    const pack = EMOJI_PACKS.find((e) => e.key === data.itemKey);
    const item = theme ?? pack;
    if (!item) return { ok: false as const, error: "unknown_item" };

    const { data: result, error } = await (supabase as any).rpc("buy_cosmetic", {
      _user_id: userId,
      _item_key: item.key,
      _item_kind: theme ? "theme" : "emoji",
      _cost: item.cost,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; already?: boolean; balance?: number; error?: string };
  });

export const equipCosmetic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ themeKey: z.string().max(40).optional(), emojiKey: z.string().max(40).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const patch: Record<string, string> = {};
    if (data.themeKey && THEMES.some((t) => t.key === data.themeKey)) patch.theme_key = data.themeKey;
    if (data.emojiKey && EMOJI_PACKS.some((e) => e.key === data.emojiKey)) patch.emoji_key = data.emojiKey;
    if (!Object.keys(patch).length) return { ok: false as const, error: "nothing_to_do" };

    // Free items are always allowed; paid items must be unlocked first.
    const keys = Object.values(patch).filter(
      (k) => (THEMES.find((t) => t.key === k)?.cost ?? EMOJI_PACKS.find((e) => e.key === k)?.cost ?? 0) > 0,
    );
    if (keys.length) {
      const { data: owned } = await (supabase as any)
        .from("coin_shop_purchases")
        .select("item_key")
        .eq("user_id", userId)
        .in("item_key", keys);
      const ownedKeys = new Set((owned ?? []).map((o: { item_key: string }) => o.item_key));
      if (keys.some((k) => !ownedKeys.has(k))) return { ok: false as const, error: "not_owned" };
    }

    const { error } = await (supabase as any)
      .from("coin_cosmetics")
      .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
