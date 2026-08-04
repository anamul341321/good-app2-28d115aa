let cache: { value: boolean; at: number } | null = null;

/**
 * Gmail কোড সিস্টেম (login OTP / Gmail verification) চালু আছে কি না।
 * Admin panel থেকে switch off করলে সব কিছু আগের মতো — শুধু নম্বর/পাসওয়ার্ড।
 */
export async function isEmailOtpEnabled(): Promise<boolean> {
  if (cache && Date.now() - cache.at < 3_000) return cache.value;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select("email_otp_enabled")
      .eq("id", "default")
      .maybeSingle();
    const value = (data as any)?.email_otp_enabled !== false;
    cache = { value, at: Date.now() };
    return value;
  } catch {
    return true;
  }
}

/** Admin switch toggle করলে cache তৎক্ষণাৎ invalidate হয়ে যাবে। */
export function resetEmailOtpCache() {
  cache = null;
}
