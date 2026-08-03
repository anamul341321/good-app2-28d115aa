import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * একাউন্ট সেটিংস — মোবাইল নম্বর পরিবর্তন (কোড লাগবে না)।
 * লগইন হয় নম্বর → internal email দিয়ে, তাই auth email-ও আপডেট হয়।
 */

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

export const getAccountSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone_number, email, email_verified")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      name: ((data as any)?.display_name ?? "") as string,
      phone: ((data as any)?.phone_number ?? "") as string,
      email: ((data as any)?.email ?? "") as string,
      emailVerified: !!(data as any)?.email_verified,
    };
  });

export const changePhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data, context }) => {
    const phone = (data.phone || "").replace(/\D/g, "").slice(0, 11);
    if (!/^01\d{9}$/.test(phone)) throw new Error("১১ ডিজিটের সঠিক নম্বর দিন (০১ দিয়ে শুরু)");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error("এই নম্বরটি অন্য একটি একাউন্টে ব্যবহার হচ্ছে");

    const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email: phoneToEmail(phone),
      email_confirm: true,
      user_metadata: { phone_number: phone },
    });
    if (authErr) throw new Error("নম্বর পরিবর্তন করা যায়নি — আবার চেষ্টা করুন");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ phone_number: phone } as any)
      .eq("id", context.userId);
    if (error) throw new Error("নম্বর সেভ করা যায়নি");

    return { ok: true as const, phone };
  });
