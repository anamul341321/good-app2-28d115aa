import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * পাসওয়ার্ড পরিবর্তনে Gmail কোড বাধ্যতামূলক — কোড ইউজারের ভেরিফাইড Gmail-এ যায়।
 */

function maskEmail(email: string) {
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l.slice(0, 2)}***@${d}`;
}

async function loadProfile(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email, email_verified")
    .eq("id", userId)
    .maybeSingle();
  const email = ((data as any)?.email ?? "").toLowerCase();
  if (!email || !(data as any)?.email_verified) {
    throw new Error("আগে Gmail ভেরিফাই করুন — তারপর পাসওয়ার্ড পরিবর্তন করা যাবে");
  }
  return { email, name: ((data as any)?.display_name ?? null) as string | null };
}

export const requestPasswordChangeOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isEmailOtpEnabled } = await import("./auth-mode.server");
    if (!(await isEmailOtpEnabled())) {
      return { ok: true as const, skipOtp: true as const, destination: null };
    }
    const prof = await loadProfile(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");


    const { data: recent } = await supabaseAdmin
      .from("password_reset_otps")
      .select("created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      return { ok: true as const, resent: false as const, destination: maskEmail(prof.email) };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("password_reset_otps").insert({
      user_id: context.userId,
      code,
      channel: "email",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    try {
      const { sendSystemEmail } = await import("@/lib/email-otp.server");
      await sendSystemEmail({
        templateName: "password-reset-otp",
        to: prof.email,
        templateData: { code, name: prof.name ?? undefined },
      });
    } catch (err) {
      console.error("password change otp failed", err);
      throw new Error("কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন");
    }

    return { ok: true as const, resent: true as const, destination: maskEmail(prof.email) };
  });

export const changePasswordWithOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().trim(),
        newPassword: z.string().min(6, "নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isEmailOtpEnabled } = await import("./auth-mode.server");

    // Gmail কোড সিস্টেম বন্ধ থাকলে কোড ছাড়াই পাসওয়ার্ড পরিবর্তন
    if (!(await isEmailOtpEnabled())) {
      const { error: e } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
        password: data.newPassword,
      });
      if (e) throw new Error("পাসওয়ার্ড পরিবর্তন করা যায়নি, আবার চেষ্টা করুন");
      return { ok: true as const };
    }

    const code = data.code.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");


    const { data: otp } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, code, attempts, expires_at")
      .eq("user_id", context.userId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
    if (new Date((otp as any).expires_at).getTime() < Date.now()) {
      throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
    }
    if (((otp as any).attempts ?? 0) >= 5) throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
    if ((otp as any).code !== code) {
      await supabaseAdmin
        .from("password_reset_otps")
        .update({ attempts: ((otp as any).attempts ?? 0) + 1 })
        .eq("id", (otp as any).id);
      throw new Error("কোড মেলেনি");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.newPassword,
    });
    if (error) throw new Error("পাসওয়ার্ড পরিবর্তন করা যায়নি, আবার চেষ্টা করুন");

    await supabaseAdmin
      .from("password_reset_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", (otp as any).id);

    return { ok: true as const };
  });
