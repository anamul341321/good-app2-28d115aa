import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Google দিয়ে সাইন-আপ/লগইন করার পর প্রোফাইল পূর্ণ করা (নাম + মোবাইল নম্বর)।
 * নম্বর সেভ হওয়ার পর Gmail ভেরিফিকেশন গেট কোড চাইবে — কোড বসালেই একাউন্ট সম্পূর্ণ।
 */

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

export const getGoogleProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone_number, email")
      .eq("id", context.userId)
      .maybeSingle();

    const email = ((data as any)?.email ?? "").toLowerCase();
    const phone = ((data as any)?.phone_number ?? "") as string;

    let conflict = false;
    if (email) {
      const { data: other } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .neq("id", context.userId)
        .maybeSingle();
      conflict = !!other;
    }

    return {
      needsProfile: !phone,
      conflict,
      email,
      name: ((data as any)?.display_name ?? "") as string,
    };
  });

export const completeGoogleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "নাম লিখুন").max(80),
        phone: z.string().trim(),
        referralCode: z.string().trim().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const phone = data.phone.replace(/\D/g, "").slice(0, 11);
    if (!/^01\d{9}$/.test(phone)) throw new Error("১১ ডিজিটের সঠিক নম্বর দিন (০১ দিয়ে শুরু)");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error("এই নম্বরে ইতোমধ্যে একাউন্ট আছে — নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন");

    let referredBy: string | null = null;
    if (data.referralCode && data.referralCode.trim()) {
      const cleaned = data.referralCode.trim().toUpperCase();
      const { data: ref } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", cleaned)
        .maybeSingle();
      if (!ref) throw new Error("Referral code সঠিক নয়");
      if (ref.id === context.userId) throw new Error("নিজের কোড ব্যবহার করা যাবে না");
      referredBy = ref.id;
    }

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        display_name: data.name.trim(),
        phone_number: phone,
        ...(referredBy && !(current as any)?.referred_by ? { referred_by: referredBy } : {}),
      } as any)
      .eq("id", context.userId);
    if (error) throw new Error("সেভ করা যায়নি — আবার চেষ্টা করুন");

    // নম্বর দিয়েও যাতে পরে লগইন করা যায়: auth user-এ নম্বর মেটাডাটা রাখা হয়
    try {
      await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        user_metadata: { display_name: data.name.trim(), phone_number: phone },
      });
    } catch {
      /* ignore */
    }

    return { ok: true as const, phone, loginEmail: phoneToEmail(phone) };
  });
