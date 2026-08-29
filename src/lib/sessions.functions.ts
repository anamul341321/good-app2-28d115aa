import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * ইউজারের ডিভাইস/সেশন ম্যানেজমেন্ট — ইউজার নিজের অন্য ফোন থেকে
 * নিজের একাউন্ট লগআউট করে দিতে পারবে।
 */

export const touchDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; label?: string; userAgent?: string }) => d)
  .handler(async ({ data, context }) => {
    const deviceId = (data.deviceId || "").trim().slice(0, 64);
    if (!deviceId) return { revoked: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("user_devices")
      .select("id, revoked_at, approval_state")
      .eq("user_id", context.userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if ((existing as any)?.revoked_at) {
      // মেইন ফোন থেকে অনুমতি দেওয়া হয়ে থাকলে এই ফোনটি আবার চালু হয়ে যাবে।
      if ((existing as any).approval_state === "approved") {
        await supabaseAdmin
          .from("user_devices")
          .update({
            revoked_at: null,
            approval_state: null,
            approval_requested_at: null,
            last_seen_at: new Date().toISOString(),
          } as any)
          .eq("id", (existing as any).id);
        return { revoked: false as const, justApproved: true as const };
      }
      // কোনো "মেইন ফোন" না থাকলে অনুমতি দেওয়ার কেউ নেই — তখন নিজের একাউন্টে
      // আটকে থাকা যাবে না, এই ফোনটিই আবার চালু হয়ে যাবে।
      const { data: others } = await supabaseAdmin
        .from("user_devices")
        .select("id, last_seen_at")
        .eq("user_id", context.userId)
        .is("revoked_at", null)
        .neq("device_id", deviceId)
        .gte("last_seen_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString())
        .limit(1);
      if (!others?.length) {
        await supabaseAdmin
          .from("user_devices")
          .update({
            revoked_at: null,
            approval_state: null,
            approval_requested_at: null,
            last_seen_at: new Date().toISOString(),
          } as any)
          .eq("id", (existing as any).id);
        return { revoked: false as const, selfRestored: true as const };
      }
      return {
        revoked: true as const,
        approvalState: ((existing as any).approval_state as string) ?? null,
      };
    }


    if (existing) {
      await supabaseAdmin
        .from("user_devices")
        .update({ last_seen_at: new Date().toISOString() } as any)
        .eq("id", (existing as any).id);
    } else {
      await supabaseAdmin.from("user_devices").insert({
        user_id: context.userId,
        device_id: deviceId,
        label: (data.label || "").slice(0, 60) || null,
        user_agent: (data.userAgent || "").slice(0, 250) || null,
      } as any);
    }

    return { revoked: false as const };
  });

/** লগআউট করা ফোন আবার ঢুকতে চাইলে — মেইন ফোনে অনুমতির অনুরোধ পাঠায় */
export const requestDeviceApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; label?: string; userAgent?: string }) => d)
  .handler(async ({ data, context }) => {
    const deviceId = (data.deviceId || "").trim().slice(0, 64);
    if (!deviceId) throw new Error("ডিভাইস শনাক্ত করা যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("user_devices")
      .update({
        approval_state: "pending",
        approval_requested_at: new Date().toISOString(),
        label: (data.label || "").slice(0, 60) || null,
        user_agent: (data.userAgent || "").slice(0, 250) || null,
      } as any)
      .eq("user_id", context.userId)
      .eq("device_id", deviceId);

    const [{ data: mains }, { data: prof }] = await Promise.all([
      supabaseAdmin
        .from("user_devices")
        .select("label, user_agent, last_seen_at")
        .eq("user_id", context.userId)
        .is("revoked_at", null)
        .order("last_seen_at", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("profiles")
        .select("email, email_verified")
        .eq("id", context.userId)
        .maybeSingle(),
    ]);

    const main = (mains ?? [])[0] as any;
    const email = ((prof as any)?.email as string) || "";

    // অনুমতি দেওয়ার মতো কোনো সক্রিয় ফোন নেই — তাহলে এই ফোনটিই চালু করে দিই,
    // না হলে ইউজার নিজের একাউন্টেই ঢুকতে পারবে না।
    if (!main) {
      await supabaseAdmin
        .from("user_devices")
        .update({
          revoked_at: null,
          approval_state: null,
          approval_requested_at: null,
          last_seen_at: new Date().toISOString(),
        } as any)
        .eq("user_id", context.userId)
        .eq("device_id", deviceId);
      return {
        autoUnlocked: true as const,
        mainDeviceLabel: null,
        mainDeviceLastSeen: null,
        emailAvailable: !!((prof as any)?.email_verified && email),
        emailMasked: email ? email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null,
      };
    }

    return {
      autoUnlocked: false as const,
      mainDeviceLabel: (main?.label as string) || null,
      mainDeviceLastSeen: (main?.last_seen_at as string) || null,
      emailAvailable: !!((prof as any)?.email_verified && email),
      emailMasked: email ? email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : null,
    };
  });


/** এই ফোনটি এখনো অনুমতির অপেক্ষায় আছে কি না */
export const getDeviceApprovalState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("user_devices")
      .select("revoked_at, approval_state")
      .eq("user_id", context.userId)
      .eq("device_id", (data.deviceId || "").trim())
      .maybeSingle();
    return {
      revoked: !!(row as any)?.revoked_at,
      approvalState: ((row as any)?.approval_state as string) ?? null,
    };
  });

/** মেইন ফোনে দেখানোর জন্য — অপেক্ষমাণ অনুরোধের তালিকা */
export const listPendingDeviceApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { deviceId?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("user_devices")
      .select("id, device_id, label, user_agent, approval_requested_at")
      .eq("user_id", context.userId)
      .eq("approval_state", "pending")
      .gte("approval_requested_at", since)
      .order("approval_requested_at", { ascending: false })
      .limit(5);

    return (rows ?? [])
      .filter((r: any) => !data?.deviceId || r.device_id !== data.deviceId)
      .map((r: any) => ({
        id: r.id as string,
        label: (r.label as string) || "অজানা ফোন",
        requestedAt: r.approval_requested_at as string,
      }));
  });

/** মেইন ফোন থেকে অনুমতি দেওয়া/না দেওয়া */
export const decideDeviceApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_devices")
      .update({ approval_state: data.approve ? "approved" : "rejected" } as any)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("অনুমতি সেভ করা যায়নি");
    return { ok: true as const };
  });

/** Gmail যুক্ত থাকলে — কোড পাঠিয়ে নিজেই ফোনটি আবার চালু করা */
export const sendDeviceUnlockCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, email_verified, display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const email = ((prof as any)?.email as string) || "";
    if (!email || !(prof as any)?.email_verified) throw new Error("এই একাউন্টে ভেরিফাইড Gmail নেই");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabaseAdmin.from("email_verify_otps").insert({
      user_id: context.userId,
      email,
      code,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    } as any);
    if (error) throw new Error("কোড তৈরি করা যায়নি — আবার চেষ্টা করুন");

    const { sendSystemEmail } = await import("@/lib/email-otp.server");
    await sendSystemEmail({
      templateName: "email-verify-otp",
      to: email,
      templateData: { code, name: (prof as any)?.display_name ?? undefined },
    });
    return { sent: true as const, emailMasked: email.replace(/^(.{2}).*(@.*)$/, "$1***$2") };
  });

export const confirmDeviceUnlockCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; code: string }) => d)
  .handler(async ({ data, context }) => {
    const code = (data.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: otp } = await supabaseAdmin
      .from("email_verify_otps")
      .select("id, code, attempts, expires_at")
      .eq("user_id", context.userId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
    if (new Date((otp as any).expires_at).getTime() < Date.now()) throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
    if (((otp as any).attempts ?? 0) >= 5) throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
    if ((otp as any).code !== code) {
      await supabaseAdmin
        .from("email_verify_otps")
        .update({ attempts: ((otp as any).attempts ?? 0) + 1 } as any)
        .eq("id", (otp as any).id);
      throw new Error("কোড মেলেনি");
    }
    await supabaseAdmin
      .from("email_verify_otps")
      .update({ used_at: new Date().toISOString() } as any)
      .eq("id", (otp as any).id);
    await supabaseAdmin
      .from("user_devices")
      .update({
        revoked_at: null,
        approval_state: null,
        approval_requested_at: null,
        last_seen_at: new Date().toISOString(),
      } as any)
      .eq("user_id", context.userId)
      .eq("device_id", (data.deviceId || "").trim());
    return { ok: true as const };
  });


export const listMyDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("user_devices")
      .select("id, device_id, label, user_agent, last_seen_at, revoked_at, created_at")
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(50);

    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      label: (r.label as string) || "অজানা ডিভাইস",
      userAgent: (r.user_agent as string) || "",
      lastSeenAt: r.last_seen_at as string,
      createdAt: r.created_at as string,
      isCurrent: !!data?.deviceId && r.device_id === data.deviceId,
    }));
  });

export const revokeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_devices")
      .update({
        revoked_at: new Date().toISOString(),
        otp_trust_expires_at: null,
        approval_state: null,
        approval_requested_at: null,
      } as any)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("ডিভাইসটি লগআউট করা যায়নি");
    return { ok: true as const };
  });

export const revokeOtherDevices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_devices")
      .update({
        revoked_at: new Date().toISOString(),
        otp_trust_expires_at: null,
        approval_state: null,
        approval_requested_at: null,
      } as any)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .neq("device_id", data.deviceId);
    if (error) throw new Error("অন্য ডিভাইসগুলো লগআউট করা যায়নি");
    return { ok: true as const };
  });
