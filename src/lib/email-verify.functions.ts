import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidEmail, maskEmail } from "@/lib/google-profile.server";

/**
 * Gmail/ইমেইল ভেরিফিকেশন — লগইন করা ইউজার নিজের ইমেইল দিয়ে ৬ ডিজিটের কোড নিয়ে
 * ইমেইলটি একাউন্টের সাথে স্থায়ীভাবে লিংক করবে। পরে "পাসওয়ার্ড ভুলে গেছেন?"-এ
 * এই ইমেইলেই কোড যাবে।
 */

export const getEmailVerifyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("email, email_verified")
      .eq("id", context.userId)
      .maybeSingle();

    const email = String((data as any)?.email ?? "").trim().toLowerCase();
    const verified = !!(data as any)?.email_verified && !!email;

    // Google দিয়ে ঢোকা ইউজারের Gmail নিজে থেকেই জানা — সে নিজে ইমেইল লিখবে না
    let oauthEmail: string | null = null;
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const authUser = (u as any)?.user;
      const ids: any[] = authUser?.identities ?? [];
      const g = ids.find((i) => i.provider === "google");
      if (g) oauthEmail = String(g.identity_data?.email ?? authUser?.email ?? "").toLowerCase() || null;

      // পুরোনো phone-based account-এ Gmail আগে profile-এ verify করা থাকলে
      // auth email-ও একই Gmail করি। এতে Google ওই account-কেই চিনতে পারে।
      const authEmail = String(authUser?.email ?? "").toLowerCase();
      if (verified && !g && email && authEmail !== email) {
        const { error: syncError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
          email,
          email_confirm: true,
        });
        if (syncError) console.error("verified Gmail auth sync failed", syncError);
      }
    } catch {
      /* ignore */
    }

    return {
      verified,
      // Google একাউন্টে ভেরিফিকেশন বাধ্যতামূলক, বাকিরা চাইলে পরেও করতে পারবে
      required: !!oauthEmail,
      oauthEmail,
      email: email ? maskEmail(email) : null,
      pendingEmail: verified ? null : email || null,
    };
  });

export const requestEmailVerifyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data, context }) => {
    const email = (data.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) throw new Error("সঠিক Gmail/ইমেইল ঠিকানা দিন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // এক ইমেইল = এক একাউন্ট
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error("এই ইমেইলটি অন্য একটি একাউন্টে ব্যবহার করা হয়েছে");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email, email_verified")
      .eq("id", context.userId)
      .maybeSingle();

    if ((prof as any)?.email_verified && ((prof as any)?.email ?? "").toLowerCase() === email) {
      return { ok: true as const, alreadyVerified: true as const, destination: maskEmail(email) };
    }

    // ৬০ সেকেন্ডে একবারের বেশি কোড নয়
    const { data: recent } = await supabaseAdmin
      .from("email_verify_otps")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      throw new Error("একটু অপেক্ষা করুন — ১ মিনিট পর আবার কোড চাইতে পারবেন");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("email_verify_otps").insert({
      user_id: context.userId,
      email,
      code,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    try {
      const { sendSystemEmail } = await import("@/lib/email-otp.server");
      await sendSystemEmail({
        templateName: "email-verify-otp",
        to: email,
        templateData: { code, name: (prof as any)?.display_name ?? undefined },
      });
    } catch (err) {
      console.error("email verify send failed", err);
      throw new Error("কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন");
    }

    return { ok: true as const, alreadyVerified: false as const, destination: maskEmail(email) };
  });

export const confirmEmailVerifyOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => d)
  .handler(async ({ data, context }) => {
    const code = (data.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("email_verify_otps")
      .select("id, code, email, attempts, expires_at")
      .eq("user_id", context.userId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
    if (new Date((otp as any).expires_at).getTime() < Date.now()) {
      throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
    }
    if (((otp as any).attempts ?? 0) >= 5) {
      throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
    }
    if ((otp as any).code !== code) {
      await supabaseAdmin
        .from("email_verify_otps")
        .update({ attempts: ((otp as any).attempts ?? 0) + 1 })
        .eq("id", (otp as any).id);
      throw new Error("কোড মেলেনি");
    }

    const email = String((otp as any).email).toLowerCase();

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error("এই ইমেইলটি অন্য একটি একাউন্টে ব্যবহার করা হয়েছে");

    const { error: authEmailError } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email,
      email_confirm: true,
    });
    if (authEmailError) {
      console.error("verified Gmail auth link failed", authEmailError);
      throw new Error("Gmail একাউন্টে যুক্ত করা যায়নি — আবার চেষ্টা করুন");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        email,
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      } as any)
      .eq("id", context.userId);
    if (error) throw new Error("ইমেইল সেভ করা যায়নি, আবার চেষ্টা করুন");

    await supabaseAdmin
      .from("email_verify_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", (otp as any).id);

    return { ok: true as const, email: maskEmail(email) };
  });
