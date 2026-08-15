import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listCardStore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("card_products")
      .select("id, name, operator, card_type, amount_label, selling_price, validity, description, card_codes(id)")
      .eq("is_active", true)
      .order("operator")
      .order("selling_price");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => {
      const { card_codes, ...rest } = p;
      return { ...rest, stock: 0 as number, _ids: card_codes };
    }).map((p: any) => ({ ...p, stock: (p._ids ?? []).length, _ids: undefined }));
  });

export const purchaseCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ productId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("purchase_card", {
      _user_id: context.userId,
      _product_id: data.productId,
    });
    if (error) throw new Error(error.message);
    const r = res as any;
    if (!r?.ok) throw new Error(r?.error ?? "কার্ড কেনা যায়নি");
    return r as { ok: true; code: string; name: string; price: number; amount_label: string };
  });

export const myCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("card_codes")
      .select("id, code, used_at, card_products(name, operator, card_type, amount_label, selling_price, validity)")
      .eq("used_by", context.userId)
      .order("used_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });
