/**
 * সার্ভার-সাইড গার্ড: ফেস ভেরিফিকেশন সিস্টেম বন্ধ থাকলে নতুন ভেরিফাই/সাইন-আপ ব্লক।
 */
export async function isFaceVerifyEnabled(): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select("face_verify_enabled")
      .eq("id", "default")
      .maybeSingle();
    return (data as any)?.face_verify_enabled !== false;
  } catch {
    return true;
  }
}

export async function assertFaceVerifyEnabled(kind: "verify" | "signup") {
  if (await isFaceVerifyEnabled()) return;
  throw new Error(
    kind === "signup"
      ? "আমাদের অ্যাপের সার্ভারে কাজ চলছে — আপাতত নতুন ইউজার নেওয়া হচ্ছে না। সাময়িক সমস্যা, ঠিক হলেই আবার চালু হবে।"
      : "ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ — সার্ভারে কাজ চলছে। ঠিক হলেই আবার চালু হবে।",
  );
}
