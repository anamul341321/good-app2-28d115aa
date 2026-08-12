import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** ফোনের নোটিফিকেশন টোকেন সেভ করো (native অ্যাপ থেকে) */
export const savePushToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ token: z.string().min(10).max(500), platform: z.string().max(20).default("android") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("push_tokens").delete().eq("token", data.token);
    const { error } = await supabase.from("push_tokens").insert({
      user_id: userId,
      token: data.token,
      platform: data.platform,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
