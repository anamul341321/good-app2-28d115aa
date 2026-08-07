import { createServerFn } from "@tanstack/react-start";

/** পাবলিক: অ্যাপ মেইনটেনেন্স মোডে আছে কি না */
export const getAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select("maintenance_enabled, maintenance_message, apk_url, apk_version")
      .eq("id", "default")
      .maybeSingle();
    return {
      maintenance: (data as any)?.maintenance_enabled === true,
      message: ((data as any)?.maintenance_message as string | null) ?? null,
      apkUrl: ((data as any)?.apk_url as string | null) ?? null,
      apkVersion: ((data as any)?.apk_version as string | null) ?? null,
    };
  } catch {
    return { maintenance: false, message: null, apkUrl: null, apkVersion: null };
  }
});

