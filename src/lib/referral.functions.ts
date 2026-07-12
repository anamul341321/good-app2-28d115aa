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

    const refereeIds = (referees ?? []).map((r: any) => r.id);
    let tasks: any[] = [];
    let attempts: any[] = [];
    if (refereeIds.length > 0) {
      const fetchAll = async (table: "tasks" | "unverified_attempts", select: string) => {
        const rows: any[] = [];
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabaseAdmin
            .from(table)
            .select(select)
            .in("user_id", refereeIds)
            .range(from, from + 999);
          if (error) throw new Error(error.message);
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        return rows;
      };
      [tasks, attempts] = await Promise.all([
        fetchAll("tasks", "id, user_id, status, whitelist_ok, wallet_address, face_photo_url"),
        fetchAll("unverified_attempts", "id, user_id, wallet_address, face_photo_url"),
      ]);
    }

    const faceKeysByUser = new Map<string, Set<string>>();
    const doneByUser = new Map<string, number>();
    const slotFacesByUser = new Map<string, number>();
    const backupFacesByUser = new Map<string, number>();
    const addFace = (uid: string, key: string) => {
      const set = faceKeysByUser.get(uid) ?? new Set<string>();
      set.add(key);
      faceKeysByUser.set(uid, set);
    };

    for (const t of tasks) {
      const hasGoodDollarFace = t.status === "verified" || t.status === "done" || !!t.face_photo_url || !!t.wallet_address;
      if (!hasGoodDollarFace) continue;
      addFace(t.user_id, t.wallet_address ? `wallet:${t.wallet_address}` : `task:${t.id}`);
      slotFacesByUser.set(t.user_id, (slotFacesByUser.get(t.user_id) ?? 0) + 1);
      if (t.status === "done" && (t.whitelist_ok ?? true) === true) {
        doneByUser.set(t.user_id, (doneByUser.get(t.user_id) ?? 0) + 1);
      }
    }
    for (const a of attempts) {
      if (!a.face_photo_url && !a.wallet_address) continue;
      addFace(a.user_id, a.wallet_address ? `wallet:${a.wallet_address}` : `attempt:${a.id}`);
      backupFacesByUser.set(a.user_id, (backupFacesByUser.get(a.user_id) ?? 0) + 1);
    }

    const list = (referees ?? []).map((r: any) => {
      const validDone = doneByUser.get(r.id) ?? 0;
      const faceTotal = faceKeysByUser.get(r.id)?.size ?? 0;
      const qualified = validDone >= 10;
      const phone: string = r.phone_number ?? "";
      const masked = phone.length >= 11 ? `${phone.slice(0, 3)}****${phone.slice(-3)}` : phone;
      return {
        id: r.id,
        name: r.display_name ?? "User",
        phone: masked,
        joinedAt: r.created_at,
        validDone,
        faceTotal,
        slotFaces: slotFacesByUser.get(r.id) ?? 0,
        backupFaces: backupFacesByUser.get(r.id) ?? 0,
        qualified,
      };
    }).sort((a, b) => b.faceTotal - a.faceTotal || new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    const qualifiedCount = list.filter((r) => r.qualified).length;
    // Total GoodDollar face verification/backup aggregated across all referred friends
    const totalVerifies = list.reduce((a, r) => a + r.faceTotal, 0);
    // How many of the referred users actually did at least 1 GoodDollar face
    const activeReferees = list.filter((r) => r.faceTotal > 0).length;

    return {
      referralCode: me?.referral_code ?? null,
      totalReferred: list.length,
      qualifiedCount,
      totalVerifies,
      activeReferees,
      referees: list,
    };
  });

