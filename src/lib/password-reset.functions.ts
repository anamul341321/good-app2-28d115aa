import { createServerFn } from "@tanstack/react-start";

/**
 * পাসওয়ার্ড ভুলে গেলে: ইউজারের Gmail/ইমেইলে ৬ ডিজিটের কোড যায় (শুধু ইমেইল)।
 */

function maskEmail(email: string) {
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l.slice(0, 2)}***@${d}`;
}

/**
 * identifier হতে পারে: Gmail/ইমেইল, ১১ ডিজিটের মোবাইল নম্বর, অথবা UID।
 * Gmail ভেরিফাইড থাকলেই কোড যাবে — নাহলে অ্যাডমিনের সাথে যোগাযোগ করতে বলা হবে।
 */
async function findProfile(identifier: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw = (identifier || "").trim().toLowerCase();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  const select = "id, display_name, email, email_verified";

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select(select)
      .ilike("email", raw)
      .order("email_verified", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  if (/^01\d{9}$/.test(digits)) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select(select)
      .eq("phone_number", digits)
      .order("email_verified", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  if (/^\d{1,12}$/.test(digits)) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select(select)
      .eq("uid_seq", Number(digits))
      .limit(1)
      .maybeSingle();
    return data;
  }

  return null;
}

function isSynthetic(email: string) {
  return /@facemine\.app$/i.test(email.trim());
}

/**
 * প্রোফাইলে Gmail না থাকলে (যেমন Google দিয়ে লগইন করা একাউন্ট) auth থেকে
 * আসল ইমেইল খুঁজে বের করা হয় এবং প্রোফাইলে সিঙ্ক করা হয়।
 */
async function resolveVerifiedEmail(prof: any): Promise<string | null> {
  const profEmail = ((prof?.email as string) || "").trim();
  if (profEmail && !isSynthetic(profEmail) && prof?.email_verified) return profEmail;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(prof.id);
  const authEmail = (authUser?.user?.email || "").trim();
  const confirmed =
    !!authUser?.user?.email_confirmed_at ||
    !!(authUser?.user?.user_metadata as any)?.email_verified;

  if (authEmail && !isSynthetic(authEmail) && confirmed) {
    // প্রোফাইলে সিঙ্ক করে রাখি যাতে পরেরবার সাথে সাথেই পাওয়া যায়
    await supabaseAdmin
      .from("profiles")
      .update({
        email: authEmail,
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      })
      .eq("id", prof.id);
    return authEmail;
  }

  // Google identity থেকেও চেষ্টা
  const identityEmail = (authUser?.user?.identities || [])
    .map((i: any) => (i?.identity_data?.email || "").trim())
    .find((e: string) => e && !isSynthetic(e));
  if (identityEmail) {
    await supabaseAdmin
      .from("profiles")
      .update({
        email: identityEmail,
        email_verified: true,
        email_verified_at: new Date().toISOString(),
      })
      .eq("id", prof.id);
    return identityEmail;
  }

  if (profEmail && !isSynthetic(profEmail)) return profEmail;
  return null;
}


export const requestPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    const identifier = (data.phone || "").trim().toLowerCase();
    if (!identifier) throw new Error("আপনার Gmail / নম্বর / UID দিন");

    const prof = await findProfile(identifier);
    if (!prof) throw new Error("এই তথ্য দিয়ে কোনো একাউন্ট পাওয়া যায়নি");

    const email = (await resolveVerifiedEmail(prof)) || "";
    if (!email) {
      throw new Error(
        "আপনার একাউন্টে Gmail যোগ করা নেই — পাসওয়ার্ড রিসেট করতে অ্যাডমিনের সাথে যোগাযোগ করুন",
      );
    }

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
