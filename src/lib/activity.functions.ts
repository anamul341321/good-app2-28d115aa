import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActivityStatus = {
  seconds: number;
  required: number;
  ok: boolean;
  day: string;
};

/** আজকের অ্যাক্টিভ সময় (সেকেন্ডে) — মাইনিং ক্লেইমের জন্য দিনে ১ ঘণ্টা লাগে */
export const getActivityToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActivityStatus> => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("get_daily_activity", { _user_id: userId });
    if (error) throw new Error(error.message);
    return (data ?? { seconds: 0, required: 3600, ok: false, day: "" }) as ActivityStatus;
  });

/** অ্যাপ খোলা থাকা অবস্থায় নিয়ম করে সময় যোগ হয় (সর্বোচ্চ ১২০ সেকেন্ড প্রতি কল) */
export const pingActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ seconds: z.number().int().min(1).max(120) }).parse(i))
  .handler(async ({ data, context }): Promise<ActivityStatus> => {
    const { supabase, userId } = context;
    const { data: res, error } = await (supabase as any).rpc("touch_daily_activity", {
      _user_id: userId,
      _seconds: data.seconds,
    });
    if (error) throw new Error(error.message);
    return (res ?? { seconds: 0, required: 3600, ok: false, day: "" }) as ActivityStatus;
  });
