import { createServerFn } from "@tanstack/react-start";

export const FACE_VERIFY_OFF_DEFAULT =
  "🔧 আমাদের অ্যাপের সার্ভারে কাজ চলছে, তাই ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ রাখা হয়েছে। যারা আগে ফেস ভেরিফাই করে ফেলেছেন তাদের সব ঠিকঠাক থাকবে — তাদের মাইনিংও স্বাভাবিকভাবে চলবে। শুধু নতুন করে কোনো স্লটে ফেস ভেরিফাই আপাতত করা যাবে না। সবকিছু ঠিক হলে আবার স্বাভাবিকভাবে চালু করে দেওয়া হবে ইনশাআল্লাহ।";

export const SIGNUP_OFF_DEFAULT =
  "🔧 আমাদের অ্যাপের সার্ভারে কাজ চলার কারণে আপাতত নতুন করে কোনো ইউজার নেওয়া হচ্ছে না। এটি সম্পূর্ণ সাময়িক — সবকিছু ঠিক হলে আবার নতুন রেজিস্ট্রেশন চালু করা হবে ইনশাআল্লাহ। পুরোনো ইউজারদের কোনো সমস্যা নেই, তারা আগের মতোই লগইন করে সব কাজ করতে পারবেন।";

/** পাবলিক: অ্যাপ মেইনটেনেন্স মোড + ফেস ভেরিফিকেশন চালু/বন্ধ */
export const getAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select(
        "maintenance_enabled, maintenance_message, apk_url, apk_version, face_verify_enabled, face_verify_off_message, signup_off_message",
      )
      .eq("id", "default")
      .maybeSingle();
    const faceVerifyEnabled = (data as any)?.face_verify_enabled !== false;
    const rawApk = ((data as any)?.apk_url as string | null) ?? null;
    const apkVersion = ((data as any)?.apk_version as string | null) ?? null;
    // storage-এ আপলোড করা APK হলে stable public download route দেখাই
    const apkUrl = rawApk && !/^https?:\/\//i.test(rawApk)
      ? `/api/public/app/download?v=${encodeURIComponent(apkVersion ?? "latest")}&file=${encodeURIComponent(rawApk)}`
      : rawApk;
    return {
      maintenance: (data as any)?.maintenance_enabled === true,
      message: ((data as any)?.maintenance_message as string | null) ?? null,
      apkUrl,
      apkVersion,
      faceVerifyEnabled,
      faceVerifyMessage:
        ((data as any)?.face_verify_off_message as string | null) || FACE_VERIFY_OFF_DEFAULT,
      signupMessage:
        ((data as any)?.signup_off_message as string | null) || SIGNUP_OFF_DEFAULT,
    };
  } catch {
    return {
      maintenance: false,
      message: null,
      apkUrl: null,
      apkVersion: null,
      faceVerifyEnabled: true,
      faceVerifyMessage: FACE_VERIFY_OFF_DEFAULT,
      signupMessage: SIGNUP_OFF_DEFAULT,
    };
  }
});
