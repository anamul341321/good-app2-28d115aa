import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: me } = await supabase
      .from("profiles")
      .select("referral_code, referred_by, referral_unlock_override")
      .eq("id", userId)
      .maybeSingle();


    const referees: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, uid_seq, display_name, phone_number, created_at")
        .eq("referred_by", userId)
        .order("created_at", { ascending: false })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      referees.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }

    const refereeIds = (referees ?? []).map((r: any) => r.id);
    let tasks: any[] = [];
    if (refereeIds.length > 0) {
      const fetchAll = async (select: string) => {
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabaseAdmin
            .from("tasks")
            .select(select)
            .in("user_id", refereeIds)
            .range(from, from + 999);
          if (error) throw new Error(error.message);
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return rows;
      };
      tasks = await fetchAll("id, user_id, status, whitelist_ok, initial_verify_at, reverify_count");
    }

    // Also fetch caller's own first-verify count for the lock gauge.
    // Only a persisted successful first verification counts. Generated keys,
    // failed attempts, and status-only rows must never inflate this number.
    const { REFERRAL_UNLOCK_THRESHOLD } = await import("./constants");
    const { count: myFirstVerifies } = await supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("initial_verify_at", "is", null);





    const doneByUser = new Map<string, number>();
    const firstVerifiesByUser = new Map<string, number>();
    const reverifiesByUser = new Map<string, number>();

    for (const t of tasks) {
      if (t.initial_verify_at) {
        firstVerifiesByUser.set(t.user_id, (firstVerifiesByUser.get(t.user_id) ?? 0) + 1);
      }
      const reverifyCount = Number(t.reverify_count ?? 0);
      if (reverifyCount > 0) {
        reverifiesByUser.set(t.user_id, (reverifiesByUser.get(t.user_id) ?? 0) + reverifyCount);
      }
      if (t.initial_verify_at) {
        doneByUser.set(t.user_id, (doneByUser.get(t.user_id) ?? 0) + 1);
      }
    }
    const list = (referees ?? []).map((r: any) => {
      const validDone = doneByUser.get(r.id) ?? 0;
      const faceTotal = firstVerifiesByUser.get(r.id) ?? 0;
      const qualified = validDone >= 10;
      const phone: string = r.phone_number ?? "";
      const masked = phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;
      return {
        id: r.id,
        uid: Number(r.uid_seq ?? 0),
        name: r.display_name ?? "User",
        phone: masked,
        joinedAt: r.created_at,
        validDone,
        faceTotal,
        firstVerifies: firstVerifiesByUser.get(r.id) ?? 0,
        reverifies: reverifiesByUser.get(r.id) ?? 0,
        qualified,
      };
    }).sort((a, b) => b.faceTotal - a.faceTotal || new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    const qualifiedCount = list.filter((r) => r.qualified).length;
    const totalVerifies = list.reduce((a, r) => a + r.firstVerifies, 0);
    const totalFirstVerifies = list.reduce((a, r) => a + r.firstVerifies, 0);
    const totalReverifies = list.reduce((a, r) => a + r.reverifies, 0);
    const activeReferees = list.filter((r) => r.faceTotal > 0).length;

    const myFirstVerifiesCount = myFirstVerifies ?? 0;
    const referralUnlocked = (me as any)?.referral_unlock_override === true || myFirstVerifiesCount >= REFERRAL_UNLOCK_THRESHOLD;

    return {
      referralCode: me?.referral_code ?? null,
      totalReferred: list.length,
      qualifiedCount,
      totalVerifies,
      totalFirstVerifies,
      totalReverifies,
      activeReferees,
      referees: list,
      lock: {
        unlocked: referralUnlocked,
        override: (me as any)?.referral_unlock_override === true,
        firstVerifies: myFirstVerifiesCount,
        needed: REFERRAL_UNLOCK_THRESHOLD,
      },
    };
  });


