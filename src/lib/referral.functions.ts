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
        fetchAll("tasks", "id, user_id, status, whitelist_ok, wallet_address, face_photo_url, initial_verify_at"),
        fetchAll("unverified_attempts", "id, user_id, wallet_address, face_photo_url"),
      ]);
    }

    // Also fetch caller's own first-verify count for the lock gauge.
    // Include tasks that reached verified/done even if initial_verify_at is
    // somehow null (older data). Any of these counts as a successful first verify.
    const { REFERRAL_UNLOCK_THRESHOLD } = await import("./constants");
    const { count: myFirstVerifies } = await supabaseAdmin
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .or("initial_verify_at.not.is.null,status.in.(verified,done)");





    const faceKeysByUser = new Map<string, Set<string>>();
    const doneByUser = new Map<string, number>();
    const slotFacesByUser = new Map<string, number>();
    const backupFacesByUser = new Map<string, number>();
    const firstVerifiesByUser = new Map<string, number>();
    const reverifiesByUser = new Map<string, number>();
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
      if (t.initial_verify_at || t.status === "verified" || t.status === "done") {
        firstVerifiesByUser.set(t.user_id, (firstVerifiesByUser.get(t.user_id) ?? 0) + 1);
      }
      if (t.status === "done") {
        reverifiesByUser.set(t.user_id, (reverifiesByUser.get(t.user_id) ?? 0) + 1);
      }
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
        firstVerifies: firstVerifiesByUser.get(r.id) ?? 0,
        reverifies: reverifiesByUser.get(r.id) ?? 0,
        slotFaces: slotFacesByUser.get(r.id) ?? 0,
        backupFaces: backupFacesByUser.get(r.id) ?? 0,
        qualified,
      };
    }).sort((a, b) => b.faceTotal - a.faceTotal || new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime());

    const qualifiedCount = list.filter((r) => r.qualified).length;
    const totalVerifies = list.reduce((a, r) => a + r.faceTotal, 0);
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


