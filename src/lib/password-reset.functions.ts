import { createServerFn } from "@tanstack/react-start";

/**
 * পাসওয়ার্ড ভুলে গেলে: ইউজারের Gmail/ইমেইলে ৬ ডিজিটের কোড যায় (শুধু ইমেইল)।
 */

function maskEmail(email: string) {
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l.slice(0, 2)}***@${d}`;
}

async function findProfile(identifier: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw = (identifier || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return null;

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, display_name, email")
    .ilike("email", raw)
    .maybeSingle();
  return data;
}


export const requestPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    // Gmail কোড সিস্টেম OFF থাকলে ইমেইলে কোড যায় না — তাই এই পথ বন্ধ।
    const { isEmailOtpEnabled } = await import("./auth-mode.server");
    if (!(await isEmailOtpEnabled())) {
      throw new Error("এখন ইমেইল কোড সিস্টেম বন্ধ — পাসওয়ার্ড রিসেটের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন");
    }

    const identifier = (data.phone || "").trim().toLowerCase();
    if (!identifier) throw new Error("আপনার Gmail/ইমেইল দিন");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
      throw new Error("সঠিক Gmail/ইমেইল ঠিকানা দিন");
    }

    const prof = await findProfile(identifier);
    if (!prof) throw new Error("এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি");

    const email = (prof.email || "").trim();
    if (!email) throw new Error("এই একাউন্টে ইমেইল সেভ নেই — অ্যাডমিনের সাথে যোগাযোগ করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ৬০ সেকেন্ডে একবারের বেশি কোড নয়
    const { data: recent } = await supabaseAdmin
      .from("password_reset_otps")
      .select("created_at")
      .eq("user_id", prof.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      throw new Error("একটু অপেক্ষা করুন — ১ মিনিট পর আবার কোড চাইতে পারবেন");
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    await supabaseAdmin.from("password_reset_otps").insert({
      user_id: prof.id,
      code,
      channel: "email",
      expires_at: expiresAt,
    });

    try {
      const { sendSystemEmail } = await import("@/lib/email-otp.server");
      await sendSystemEmail({
        templateName: "password-reset-otp",
        to: email,
        templateData: { code, name: prof.display_name ?? undefined },
      });
    } catch (err) {
      console.error("password reset email failed", err);
      throw new Error("কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন");
    }

    return {
      ok: true as const,
      channel: "email" as const,
      destination: maskEmail(email),
    };
  });


export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const code = (data.code || "").replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");
    if ((data.newPassword || "").length < 6) {
      throw new Error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    }

    const prof = await findProfile(data.phone);
    if (!prof) throw new Error("এই নম্বর/ইমেইলে কোনো একাউন্ট পাওয়া যায়নি");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: otp } = await supabaseAdmin
      .from("password_reset_otps")
      .select("id, code, attempts, used_at, expires_at")
      .eq("user_id", prof.id)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
    }
    if ((otp.attempts ?? 0) >= 5) {
      throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
    }
    if (otp.code !== code) {
      await supabaseAdmin
        .from("password_reset_otps")
        .update({ attempts: (otp.attempts ?? 0) + 1 })
        .eq("id", otp.id);
      throw new Error("কোড মেলেনি");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(prof.id, {
      password: data.newPassword,
    });
    if (error) throw new Error("পাসওয়ার্ড পরিবর্তন করা যায়নি, আবার চেষ্টা করুন");

    await supabaseAdmin
      .from("password_reset_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otp.id);

    return { ok: true as const };
  });
