import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { base64: string; contentType: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buf = Buffer.from(data.base64, "base64");
    const ext = data.contentType.includes("png") ? "png" : "jpg";
    const path = `${context.userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, buf, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { error: pErr } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", context.userId);
    if (pErr) throw new Error(pErr.message);
    return { ok: true, path };
  });

export const updateProfileDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    nid_number?: string;
    date_of_birth?: string;
    father_name?: string;
    mother_name?: string;
    village_area?: string;
    post_office?: string;
    thana_upazila?: string;
    district?: string;
    full_address?: string;
  }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const clean = (value?: string, max = 180) => {
      const text = String(value ?? "").trim();
      return text ? text.slice(0, max) : null;
    };

    const payload = {
      nid_number: clean(data.nid_number, 32),
      date_of_birth: clean(data.date_of_birth, 16),
      father_name: clean(data.father_name),
      mother_name: clean(data.mother_name),
      village_area: clean(data.village_area),
      post_office: clean(data.post_office),
      thana_upazila: clean(data.thana_upazila),
      district: clean(data.district),
      full_address: clean(data.full_address, 500),
    };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(payload)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getProfileHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: mining }, { data: wallet }, { data: withdrawals }, { data: claims }, { data: tasks }] =
      await Promise.all([
        context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
        context.supabase.from("mining_state").select("*").eq("user_id", context.userId).maybeSingle(),
        context.supabase.from("wallets").select("*").eq("user_id", context.userId).maybeSingle(),
        context.supabase.from("withdrawals").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
        context.supabase.from("mining_claims").select("*").eq("user_id", context.userId).order("created_at", { ascending: false }),
        supabaseAdmin.from("tasks").select("slot,status,whitelist_ok,initial_verify_at").eq("user_id", context.userId),
      ]);

    let avatar_signed: string | null = null;
    if (profile?.avatar_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 60 * 60);
      avatar_signed = signed?.signedUrl ?? null;
    }
    return { profile, mining, wallet, withdrawals: withdrawals ?? [], claims: claims ?? [], tasks: tasks ?? [], avatar_signed };
  });

export const claimMining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("settle_mining", { _user_id: context.userId });
    const { data: mining } = await supabaseAdmin.from("mining_state").select("*").eq("user_id", context.userId).maybeSingle();
    const balance = Number(mining?.accrued_amount ?? 0) - Number(mining?.withdrawn_amount ?? 0);
    const { error } = await supabaseAdmin.from("mining_claims").insert({
      user_id: context.userId,
      amount: balance,
      balance_after: balance,
      note: "Manual claim snapshot",
    });
    if (error) throw new Error(error.message);
    return { ok: true, balance };
  });

// Public card viewer (no auth) — safe non-sensitive info only
export const getPublicCardDetails = createServerFn({ method: "GET" })
  .inputValidator((data: { uid: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const raw = String(data.uid ?? "").trim();
    if (!raw) throw new Error("UID লাগবে");

    let profileRow: any = null;
    const cardColumns = "id,uid_seq,display_name,referral_code,avatar_url,created_at,kyc_verified,kyc_verified_at";
    if (/^\d+$/.test(raw)) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select(cardColumns)
        .eq("uid_seq", Number(raw))
        .maybeSingle();
      profileRow = p;
    } else if (/^[0-9a-f-]{32,}$/i.test(raw)) {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select(cardColumns)
        .eq("id", raw)
        .maybeSingle();
      profileRow = p;
    }
    if (!profileRow) throw new Error("কার্ড খুঁজে পাওয়া যায়নি");

    const [{ data: mining }, { data: tasks }, { data: withdrawals }, { count: refCount }] =
      await Promise.all([
        supabaseAdmin.from("mining_state").select("accrued_amount,withdrawn_amount,is_active").eq("user_id", profileRow.id).maybeSingle(),
        supabaseAdmin.from("tasks").select("status,whitelist_ok").eq("user_id", profileRow.id),
        supabaseAdmin.from("withdrawals").select("amount,status").eq("user_id", profileRow.id).eq("status", "paid"),
        supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("referred_by", profileRow.id),
      ]);

    let avatar_signed: string | null = null;
    if (profileRow.avatar_url) {
      const { data: signed } = await supabaseAdmin.storage.from("avatars").createSignedUrl(profileRow.avatar_url, 60 * 60);
      avatar_signed = signed?.signedUrl ?? null;
    }

    const done = (tasks ?? []).filter((t: any) => t.status === "done" && (t.whitelist_ok ?? true)).length;
    const totalWithdrawn = (withdrawals ?? []).reduce((s: number, w: any) => s + Number(w.amount ?? 0), 0);
    const balance = Number(mining?.accrued_amount ?? 0) - Number(mining?.withdrawn_amount ?? 0);

    return {
      profile: {
        id: profileRow.id,
        uid_seq: profileRow.uid_seq,
        display_name: profileRow.display_name,
        referral_code: profileRow.referral_code,
        created_at: profileRow.created_at,
        kyc_verified: profileRow.kyc_verified,
        kyc_verified_at: profileRow.kyc_verified_at,
      },
      avatar_signed,
      stats: {
        verified: done,
        totalTasks: (tasks ?? []).length,
        withdrawCount: (withdrawals ?? []).length,
        totalWithdrawn,
        referrals: refCount ?? 0,
        balance,
        mining_active: !!mining?.is_active,
      },
    };
  });

// কভার ফটো আপলোড — avatars bucket-এ রেখে profiles.cover_url আপডেট
export const uploadCoverPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { base64: string; contentType: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const buf = Buffer.from(data.base64, "base64");
    const ext = data.contentType.includes("png") ? "png" : "jpg";
    const path = `${context.userId}/cover-${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("avatars")
      .upload(path, buf, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);
    const { error: pErr } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ cover_url: path })
      .eq("id", context.userId);
    if (pErr) throw new Error(pErr.message);
    return { ok: true, path };
  });

// প্রোফাইল bio আপডেট — সর্বোচ্চ 160 অক্ষর
export const updateBio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { bio: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bio = String(data.bio ?? "").trim().slice(0, 160);
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ bio })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, bio };
  });
