import { createServerFn } from "@tanstack/react-start";

export const FIRST_VERIFY_OFF_DEFAULT =
  "🔧 আপাতত নতুন করে ফেস ভেরিফাই (নতুন স্লট) বন্ধ রাখা হয়েছে। যারা আগে ভেরিফাই করেছেন তারা আগের মতোই রি-ভেরিফাই করতে পারবেন এবং তাদের মাইনিং স্বাভাবিকভাবে চলবে। সবকিছু ঠিক হলে আবার চালু করে দেওয়া হবে ইনশাআল্লাহ।";

export const FACE_VERIFY_OFF_DEFAULT =
  "🔧 আমাদের অ্যাপের সার্ভারে কাজ চলছে, তাই ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ রাখা হয়েছে। যারা আগে ফেস ভেরিফাই করে ফেলেছেন তাদের সব ঠিকঠাক থাকবে — তাদের মাইনিংও স্বাভাবিকভাবে চলবে। শুধু নতুন করে কোনো স্লটে ফেস ভেরিফাই আপাতত করা যাবে না। সবকিছু ঠিক হলে আবার স্বাভাবিকভাবে চালু করে দেওয়া হবে ইনশাআল্লাহ।";

export const SIGNUP_OFF_DEFAULT =
  "🔧 আমাদের অ্যাপের সার্ভারে কাজ চলার কারণে আপাতত নতুন করে কোনো ইউজার নেওয়া হচ্ছে না। এটি সম্পূর্ণ সাময়িক — সবকিছু ঠিক হলে আবার নতুন রেজিস্ট্রেশন চালু করা হবে ইনশাআল্লাহ। পুরোনো ইউজারদের কোনো সমস্যা নেই, তারা আগের মতোই লগইন করে সব কাজ করতে পারবেন।";

/** পাবলিক: অ্যাপ মেইনটেনেন্স মোড + ফেস ভেরিফিকেশন চালু/বন্ধ */
export const FORCE_UPDATE_DEFAULT_MESSAGE =
  "🚀 নতুন ভার্সন এসেছে — অ্যাপ আপডেট না করলে কোনো কাজ (মাইনিং, রিচার্জ, উইথড্র, মেসেঞ্জার) করা যাবে না। নিচের বাটনে চাপ দিয়ে এখনই আপডেট করুন।";

export const getAppStatus = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("bonus_settings")
      .select(
        "maintenance_enabled, maintenance_message, apk_url, apk_version, face_verify_enabled, face_verify_off_message, first_verify_enabled, first_verify_off_message, signup_off_message, min_app_version, force_update_enabled, force_update_web, force_update_message, ads_enabled, ads_test_mode, ads_banner_enabled, ads_rewarded_enabled, ads_appopen_enabled, ads_banner_unit, ads_interstitial_unit, ads_rewarded_unit, bonus_enabled, first_verify_bonus, reverify_bonus",

      )
      .eq("id", "default")
      .maybeSingle();
    const faceVerifyEnabled = (data as any)?.face_verify_enabled !== false;
    const rawApk = ((data as any)?.apk_url as string | null) ?? null;
    const apkVersion = ((data as any)?.apk_version as string | null) ?? null;
    // storage-এ আপলোড করা APK হলে stable public download route দেখাই
    const apkUrl =
      rawApk && !/^https?:\/\//i.test(rawApk)
        ? `/api/public/app/download?v=${encodeURIComponent(apkVersion ?? "latest")}&file=${encodeURIComponent(rawApk)}`
        : rawApk;
    return {
      maintenance: (data as any)?.maintenance_enabled === true,
      message: ((data as any)?.maintenance_message as string | null) ?? null,
      apkUrl,
      apkVersion,
      faceVerifyEnabled,
      firstVerifyEnabled: faceVerifyEnabled && (data as any)?.first_verify_enabled !== false,
      firstVerifyMessage:
        ((data as any)?.first_verify_off_message as string | null) || FIRST_VERIFY_OFF_DEFAULT,
      faceVerifyMessage:
        ((data as any)?.face_verify_off_message as string | null) || FACE_VERIFY_OFF_DEFAULT,
      signupMessage: ((data as any)?.signup_off_message as string | null) || SIGNUP_OFF_DEFAULT,
      minAppVersion: ((data as any)?.min_app_version as string | null) ?? null,
      forceUpdate: (data as any)?.force_update_enabled !== false,
      forceUpdateWeb: (data as any)?.force_update_web === true,
      forceUpdateMessage:
        ((data as any)?.force_update_message as string | null) || FORCE_UPDATE_DEFAULT_MESSAGE,
      adsEnabled: (data as any)?.ads_enabled === true,
      adsTestMode: (data as any)?.ads_test_mode === true,
      adsBannerEnabled: (data as any)?.ads_banner_enabled !== false,
      adsRewardedEnabled: (data as any)?.ads_rewarded_enabled !== false,
      adsAppOpenEnabled: (data as any)?.ads_appopen_enabled !== false,
      adsBannerUnit: ((data as any)?.ads_banner_unit as string | null) ?? null,
      adsInterstitialUnit: ((data as any)?.ads_interstitial_unit as string | null) ?? null,
      adsRewardedUnit: ((data as any)?.ads_rewarded_unit as string | null) ?? null,

    };
  } catch {
    return {
      maintenance: false,
      message: null,
      apkUrl: null,
      apkVersion: null,
      faceVerifyEnabled: true,
      firstVerifyEnabled: true,
      firstVerifyMessage: FIRST_VERIFY_OFF_DEFAULT,
      faceVerifyMessage: FACE_VERIFY_OFF_DEFAULT,
      signupMessage: SIGNUP_OFF_DEFAULT,
      minAppVersion: null,
      forceUpdate: false,
      forceUpdateWeb: false,
      forceUpdateMessage: FORCE_UPDATE_DEFAULT_MESSAGE,
      adsEnabled: false,
      adsTestMode: false,
      adsBannerEnabled: false,
      adsRewardedEnabled: false,
      adsAppOpenEnabled: false,
      adsBannerUnit: null,
      adsInterstitialUnit: null,
      adsRewardedUnit: null,

    };
  }
});
