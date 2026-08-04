import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Referral commission = 10% of the 500৳/month base rate for every referee whose
// mining is actually running (all 10 slots valid + whitelisted AND all 10 slots
// re-verified at least once). If a referee loses even one slot the commission
// stops until they re-verify again — the database mirrors this rule in
// public.settle_mining().
export const MONTHLY_PER_REFEREE = 500 * 0.1;
// Referrer gets 10% of the referee's actual monthly earning.
// Referee earns 50৳/month per re-verified slot → referrer gets 5৳ per slot.
export const MONTHLY_PER_REFEREE_SLOT = 5;

export const getReferralCommission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Keep the live counters fresh before reading them.
    await supabaseAdmin.rpc("settle_mining", { _user_id: userId });

    const { data: mining } = await supabase
      .from("mining_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const referees: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, uid_seq, display_name, phone_number, created_at")
        .eq("referred_by", userId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      referees.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const ids = referees.map((r) => r.id);
    let tasks: any[] = [];
    if (ids.length > 0) {
      const CHUNK = 150;
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
      const results = await Promise.all(
        chunks.map(async (chunk) => {
          const rows: any[] = [];
          for (let from = 0; ; from += 1000) {
            const { data, error } = await supabaseAdmin
              .from("tasks")
              .select("user_id, slot, status, whitelist_ok, wallet_address, reverify_count")
              .in("user_id", chunk)
              .order("user_id")
              .range(from, from + 999);
            if (error) throw new Error(error.message);
            rows.push(...(data ?? []));
            if (!data || data.length < 1000) break;
          }
          return rows;
        }),
      );
      tasks = results.flat();
    }

    const validByUser = new Map<string, number>();
    const reverifySlots = new Map<string, Set<number>>();
    for (const t of tasks) {
      if (t.status === "done" && (t.whitelist_ok ?? true) === true && t.wallet_address) {
        validByUser.set(t.user_id, (validByUser.get(t.user_id) ?? 0) + 1);
      }
      if (Number(t.reverify_count ?? 0) > 0) {
        const set = reverifySlots.get(t.user_id) ?? new Set<number>();
        set.add(Number(t.slot));
        reverifySlots.set(t.user_id, set);
      }
    }

    const list = referees
      .map((r) => {
        const valid = validByUser.get(r.id) ?? 0;
        const reverifies = reverifySlots.get(r.id)?.size ?? 0;
        const mining = valid >= 10 && reverifies >= 10;
        const phone: string = r.phone_number ?? "";
        return {
          id: r.id as string,
          uid: Number(r.uid_seq ?? 0),
          name: (r.display_name as string) ?? "User",
          phone: phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone,
          valid,
          reverifies,
          mining,
          // প্রতি ১০টি রি-ভেরিফাই = রেফারির ৫০০৳/মাস স্তর → তার ১০% = ৫০৳
          slots: mining ? reverifies : 0,
          units: mining ? reverifies * 0.1 : 0,
          monthly: mining ? MONTHLY_PER_REFEREE_SLOT * reverifies : 0,
        };
      })
      .sort((a, b) => Number(b.mining) - Number(a.mining) || b.reverifies - a.reverifies);

    const miningReferees = list.filter((r) => r.mining);

    return {
      referralAccrued: Number((mining as any)?.referral_accrued ?? 0),
      qualifyingReferees: Number((mining as any)?.qualifying_referees ?? 0),
      isActive: !!(mining as any)?.is_active,
      lastCreditedAt: (mining as any)?.last_credited_at ?? null,
      monthlyPerReferee: MONTHLY_PER_REFEREE,
      monthlyPerRefereeSlot: MONTHLY_PER_REFEREE_SLOT,
      referralUnits: Number((mining as any)?.referral_units ?? 0),
      monthlyTotal: miningReferees.reduce((sum, r) => sum + r.monthly, 0),
      totalReferred: list.length,
      miningCount: miningReferees.length,
      referees: list,
    };
  });
