import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabase
      .from("profiles")
      .select("referral_code, referred_by")
      .eq("id", userId)
      .maybeSingle();

    const { data: referees } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, phone_number, created_at")
      .eq("referred_by", userId)
      .order("created_at", { ascending: false });

    const list = await Promise.all(
      (referees ?? []).map(async (r: any) => {
        const { data: ts } = await supabaseAdmin
          .from("tasks")
          .select("status, whitelist_ok")
          .eq("user_id", r.id);
        const validDone = (ts ?? []).filter(
          (t: any) => t.status === "done" && (t.whitelist_ok ?? true) === true,
        ).length;
        const qualified = validDone >= 10;
        const phone: string = r.phone_number ?? "";
        const masked = phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;
        return {
          id: r.id,
          name: r.display_name ?? "User",
          phone: masked,
          joinedAt: r.created_at,
          validDone,
          qualified,
        };
      }),
    );

    const qualifiedCount = list.filter((r) => r.qualified).length;
    // Total verifications aggregated across all referred friends
    const totalVerifies = list.reduce((a, r) => a + r.validDone, 0);
    // How many of the referred users actually did at least 1 verify
    const activeReferees = list.filter((r) => r.validDone > 0).length;

    return {
      referralCode: me?.referral_code ?? null,
      totalReferred: list.length,
      qualifiedCount,
      totalVerifies,
      activeReferees,
      referees: list,
    };
  });

