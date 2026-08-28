import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AD_BOOST } from "./ad-boost";

/** ইউজারের অ্যাড-বুস্ট অবস্থা — আজ কতটা দেখেছে, এই মাসে কত বুস্ট জমেছে */
export const getAdBoostStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("ad_views")
      .select("view_day, cycle_month")
      .eq("user_id", userId)
      .gte("cycle_month", cycleStart());

    const rows = data ?? [];
    const today = dhakaDay();
    const todayCount = rows.filter((r: any) => r.view_day === today).length;
    const cycleCount = rows.length;
    const boosts = Math.min(
      Math.floor(cycleCount / AD_BOOST.adsPerBoost),
      AD_BOOST.maxBoostsPerCycle,
    );
    return { todayCount, cycleCount, boosts };
  });

/** একটি rewarded অ্যাড দেখা শেষ হলে সার্ভারে গোনা হয় (ডেইলি/মাসিক লিমিট সহ) */
export const recordAdView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await (supabase as any).rpc("record_ad_view", {
      _daily_limit: AD_BOOST.dailyAdLimit,
      _max_boosts: AD_BOOST.maxBoostsPerCycle,
      _ads_per_boost: AD_BOOST.adsPerBoost,
    });
    if (error) throw new Error("অ্যাড গোনা যায়নি — একটু পরে আবার চেষ্টা করুন");
    const res = (data ?? {}) as {
      ok: boolean;
      reason?: string;
      today_count: number;
      cycle_count: number;
      boosts: number;
    };
    return {
      ok: !!res.ok,
      reason: res.reason ?? null,
      todayCount: Number(res.today_count ?? 0),
      cycleCount: Number(res.cycle_count ?? 0),
      boosts: Number(res.boosts ?? 0),
    };
  });

function dhakaDay() {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function cycleStart() {
  return dhakaDay().slice(0, 7) + "-01";
}
