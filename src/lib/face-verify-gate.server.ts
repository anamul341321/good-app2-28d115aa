/**
 * সার্ভার-সাইড গার্ড: ফেস ভেরিফিকেশন সিস্টেম বন্ধ থাকলে নতুন ভেরিফাই/সাইন-আপ ব্লক।
 *
 * দুইটি আলাদা সুইচ:
 *  • face_verify_enabled  → পুরো সিস্টেম (first verify + re-verify + signup)
 *  • first_verify_enabled → শুধু নতুন (first) ভেরিফাই; re-verify চালু থাকবে
 */
export const FIRST_VERIFY_OFF_DEFAULT =
  "🔧 আপাতত নতুন করে ফেস ভেরিফাই (নতুন স্লট) বন্ধ রাখা হয়েছে। যারা আগে ভেরিফাই করেছেন তারা আগের মতোই রি-ভেরিফাই করতে পারবেন এবং তাদের মাইনিং স্বাভাবিকভাবে চলবে। সবকিছু ঠিক হলে আবার চালু করে দেওয়া হবে ইনশাআল্লাহ।";

async function readSettings(): Promise<{ face: boolean; first: boolean; firstMsg: string | null }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select("face_verify_enabled, first_verify_enabled, first_verify_off_message")
      .eq("id", "default")
      .maybeSingle();
    return {
      face: (data as any)?.face_verify_enabled !== false,
      first: (data as any)?.first_verify_enabled !== false,
      firstMsg: ((data as any)?.first_verify_off_message as string | null) ?? null,
    };
  } catch {
    return { face: true, first: true, firstMsg: null };
  }
}

export async function isFaceVerifyEnabled(): Promise<boolean> {
  return (await readSettings()).face;
}

export async function isFirstVerifyEnabled(): Promise<boolean> {
  const s = await readSettings();
  return s.face && s.first;
}

export async function assertFaceVerifyEnabled(kind: "verify" | "signup") {
  if (await isFaceVerifyEnabled()) return;
  throw new Error(
    kind === "signup"
      ? "আমাদের অ্যাপের সার্ভারে কাজ চলছে — আপাতত নতুন ইউজার নেওয়া হচ্ছে না। সাময়িক সমস্যা, ঠিক হলেই আবার চালু হবে।"
      : "ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ — সার্ভারে কাজ চলছে। ঠিক হলেই আবার চালু হবে।",
  );
}

/** শুধু নতুন (first) ভেরিফাইয়ের গার্ড — re-verify এতে আটকাবে না। */
export async function assertFirstVerifyEnabled() {
  const s = await readSettings();
  if (!s.face)
    throw new Error(
      "ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ — সার্ভারে কাজ চলছে। ঠিক হলেই আবার চালু হবে।",
    );
  if (!s.first) throw new Error(s.firstMsg?.trim() || FIRST_VERIFY_OFF_DEFAULT);
}
