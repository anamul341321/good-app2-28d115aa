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
      .select("display_name, phone_number, email, email_verified, gender, bio")
...
      gender: (((data as any)?.gender ?? null) as "male" | "female" | null),
      bio: (((data as any)?.bio ?? "") as string),
    };
  });

/** লিঙ্গ (ছেলে/মেয়ে) সেভ — ছবি না থাকলে এই অনুযায়ী ডিফল্ট অবতার দেখাবে */
export const setMyGender = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { gender: "male" | "female" }) => d)
  .handler(async ({ data, context }) => {
    const gender = data.gender === "female" ? "female" : data.gender === "male" ? "male" : null;
    if (!gender) throw new Error("ছেলে অথবা মেয়ে সিলেক্ট করুন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ gender } as any)
      .eq("id", context.userId);
    if (error) throw new Error("সেভ করা যায়নি — আবার চেষ্টা করুন");
    await supabaseAdmin.auth.admin.updateUserById(context.userId, { user_metadata: { gender } });
    return { ok: true as const, gender };
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

/**
 * সত্যিকারের একাউন্ট ডিলিট — ইউজার নিজেই করতে পারবে।
 * ফেস ছবি, avatar, KYC ফাইল স্টোরেজ থেকে মুছে auth ইউজার ডিলিট হয় (DB rows cascade)।
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { confirm: string }) => d)
  .handler(async ({ data, context }) => {
    const word = String(data.confirm ?? "").trim().toUpperCase();
    if (word !== "DELETE") throw new Error('নিশ্চিত করতে বড় হাতের DELETE লিখুন');

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    // পেন্ডিং উইথড্র থাকলে ডিলিট আটকে দিন
    const { data: pending } = await supabaseAdmin
      .from("withdrawals")
      .select("id")
      .eq("user_id", uid)
      .eq("status", "pending")
      .limit(1);
    if (pending && pending.length > 0) {
      throw new Error("আপনার একটি উইথড্র রিকোয়েস্ট পেন্ডিং আছে — সেটি শেষ হলে ডিলিট করতে পারবেন");
    }

    // ফেস ছবি মুছুন
    try {
      const { data: tasks } = await supabaseAdmin
        .from("tasks")
        .select("face_photo_url")
        .eq("user_id", uid);
      const paths = (tasks ?? [])
        .map((t: any) => t.face_photo_url)
        .filter((p: any): p is string => !!p);
      if (paths.length) await supabaseAdmin.storage.from("face-photos").remove(paths);
    } catch { /* ছবি না মুছলেও ডিলিট চলবে */ }

    // avatar + KYC ফাইল মুছুন
    for (const bucket of ["avatars", "kyc"]) {
      try {
        const { data: files } = await supabaseAdmin.storage.from(bucket).list(uid, { limit: 200 });
        const paths = (files ?? []).map((f: any) => `${uid}/${f.name}`);
        if (paths.length) await supabaseAdmin.storage.from(bucket).remove(paths);
      } catch { /* ignore */ }
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("একাউন্ট ডিলিট করা যায়নি — সাপোর্টে জানান");

    return { ok: true as const };
  });
