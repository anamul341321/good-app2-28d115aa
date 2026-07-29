import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callSuccessTopup } from "@/lib/recharge.server";

const OPERATORS = ["grameenphone", "robi", "banglalink", "airtel", "teletalk"] as const;

const RechargeInput = z.object({
  mobile: z.string().trim().regex(/^0?1\d{9,10}$/, "সঠিক মোবাইল নম্বর দিন"),
  operator: z.enum(OPERATORS),
  connection_type: z.enum(["prepaid", "postpaid"]).default("prepaid"),
  amount: z.number().int().min(20, "সর্বনিম্ন ২০৳"),
});

export const submitRecharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RechargeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mobile = data.mobile.replace(/\D/g, "");

    // Reserve balance atomically
    const { data: rpcRes, error } = await supabaseAdmin.rpc("create_recharge_request", {
      _user: context.userId,
      _mobile: mobile,
      _operator: data.operator,
      _connection_type: data.connection_type,
      _amount: data.amount,
    });
    if (error) throw new Error(error.message);
    const r = rpcRes as any;
    if (!r?.ok) throw new Error(r?.error ?? "রিচার্জ শুরু করা যায়নি");
    const rechargeId = r.recharge_id as string;

    // Call provider
    const call = await callSuccessTopup({
      mobile,
      operator: data.operator,
      connectionType: data.connection_type,
      amount: data.amount,
      transactionId: rechargeId,
    });

    const status = call.ok ? "success" : "failed";
    await supabaseAdmin.rpc("mark_recharge_result", {
      _recharge_id: rechargeId,
      _status: status,
      _provider_ref: call.transactionId ?? "",
      _provider_response: JSON.parse(JSON.stringify(call.json ?? {})),
      _error: call.ok ? "" : call.message,
    });

    return {
      ok: call.ok,
      recharge_id: rechargeId,
      transaction_id: call.transactionId,
      message: call.message,
    };
  });

export const getMyRecharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("recharges")
      .select("id, mobile, operator, connection_type, amount, status, provider_ref, error_message, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

// ---------- Admin ----------
async function adminGate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminListRecharges = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await adminGate();
  const { data } = await supabaseAdmin
    .from("recharges")
    .select("id, user_id, mobile, operator, connection_type, amount, status, provider_ref, error_message, created_at, profiles:profiles!recharges_user_id_fkey(display_name, phone_number, uid_seq)")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
});

export const adminListTransfers = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await adminGate();
  const { data } = await supabaseAdmin
    .from("transfers")
    .select("id, sender_id, receiver_id, amount, note, created_at, sender:profiles!transfers_sender_id_fkey(display_name, uid_seq), receiver:profiles!transfers_receiver_id_fkey(display_name, uid_seq)")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
});

export const adminListKycProfiles = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await adminGate();
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq, phone_number, email, nid_number, date_of_birth, father_name, mother_name, full_address, village_area, post_office, thana_upazila, district, avatar_url, kyc_photo_url, kyc_nid_front_url, kyc_nid_back_url, kyc_verified_at, created_at")
      .eq("kyc_verified", true)
      .order("kyc_verified_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  // Sign avatar + NID URLs
  const signed = await Promise.all(rows.map(async (r) => {
    const sign = async (bucket: string, path: string | null) => {
      if (!path) return null;
      const s = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 60 * 30);
      return s.data?.signedUrl ?? null;
    };
    const [avatar, photo, nidFront, nidBack] = await Promise.all([
      sign("avatars", r.avatar_url),
      sign("kyc", r.kyc_photo_url),
      sign("kyc", r.kyc_nid_front_url),
      sign("kyc", r.kyc_nid_back_url),
    ]);
    return { ...r, avatar_signed: avatar, kyc_photo_signed: photo, kyc_nid_front_signed: nidFront, kyc_nid_back_signed: nidBack };
  }));
  return signed;
});
