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
      .select("id, revoked_at")
      .eq("user_id", context.userId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if ((existing as any)?.revoked_at) {
      return { revoked: true as const };
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
      .update({ revoked_at: new Date().toISOString() } as any)
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
      .update({ revoked_at: new Date().toISOString() } as any)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .neq("device_id", data.deviceId);
    if (error) throw new Error("অন্য ডিভাইসগুলো লগআউট করা যায়নি");
    return { ok: true as const };
  });
