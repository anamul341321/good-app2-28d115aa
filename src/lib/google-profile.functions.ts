import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Google দিয়ে সাইন-আপ/লগইন:
 *  - নতুন Gmail (একাউন্ট নেই) → নাম + পাসওয়ার্ড (+ optional referral) নিয়ে একাউন্ট সম্পূর্ণ হবে,
 *    তারপর ওই Gmail-এ কোড গিয়ে ভেরিফিকেশন হবে।
 *  - যে Gmail আগেই কোনো একাউন্টে ভেরিফাইড আছে → কোড দিয়ে যাচাই করে সেই পুরোনো
 *    একাউন্টেই লগইন হবে (নতুন কোনো একাউন্ট তৈরি হবে না)।
 */

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

function maskEmail(email: string) {
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l.slice(0, 2)}***@${d}`;
}

async function publishableClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** এই ইউজারটি Google দিয়ে ঢুকেছে কি না + তার Google Gmail */
async function googleIdentity(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const u: any = data?.user;
  const ids: any[] = u?.identities ?? [];
  const google = ids.find((i) => i.provider === "google");
  return {
    isGoogle: !!google,
    googleEmail: String(google?.identity_data?.email ?? u?.email ?? "").toLowerCase(),
    completed: !!u?.user_metadata?.profile_completed,
    metaName: String(u?.user_metadata?.full_name ?? u?.user_metadata?.name ?? ""),
  };
}

export const getGoogleProfileStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const g = await googleIdentity(context.userId);

    const { data } = await supabaseAdmin
      .from("profiles")
      .select("display_name, phone_number, email")
      .eq("id", context.userId)
      .maybeSingle();

    const email = (((data as any)?.email ?? g.googleEmail) || "").toLowerCase();
    const name = ((data as any)?.display_name ?? "") as string;

    // এই Gmail আগেই অন্য একাউন্টে ভেরিফাইড আছে কি না
    let conflict = false;
    let conflictEmail: string | null = null;
    if (g.isGoogle && g.googleEmail) {
      const { data: other } = await supabaseAdmin
        .from("profiles")
        .select("id, email_verified")
        .ilike("email", g.googleEmail)
        .neq("id", context.userId)
        .maybeSingle();
      if (other) {
        conflict = true;
        conflictEmail = maskEmail(g.googleEmail);
      }
    }

    const needsProfile = g.isGoogle && !conflict && !(g.completed && name.trim().length >= 2);

    return {
      isGoogle: g.isGoogle,
      needsProfile,
      conflict,
      conflictEmail,
      email,
      suggestedName: name || g.metaName,
      name,
    };
  });

export const completeGoogleProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "নাম লিখুন").max(80),
        password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে"),
        phone: z.string().trim().optional().nullable(),
        referralCode: z.string().trim().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const phone = (data.phone ?? "").replace(/\D/g, "").slice(0, 11);
    if (phone && !/^01\d{9}$/.test(phone)) {
      throw new Error("নম্বর দিলে ১১ ডিজিটের সঠিক নম্বর দিন (০১ দিয়ে শুরু)");
    }
    if (phone) {
      const { data: taken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("phone_number", phone)
        .neq("id", context.userId)
        .maybeSingle();
      if (taken) throw new Error("এই নম্বরে ইতোমধ্যে একাউন্ট আছে — নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন");
    }

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
        ...(phone ? { phone_number: phone } : {}),
        ...(referredBy && !(current as any)?.referred_by ? { referred_by: referredBy } : {}),
      } as any)
      .eq("id", context.userId);
    if (error) throw new Error("সেভ করা যায়নি — আবার চেষ্টা করুন");

    // পাসওয়ার্ড সেট — পরে নম্বর/Gmail + পাসওয়ার্ড দিয়েও লগইন করা যাবে
    const { error: passErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
      user_metadata: {
        display_name: data.name.trim(),
        profile_completed: true,
        ...(phone ? { phone_number: phone } : {}),
      },
    });
    if (passErr) throw new Error("পাসওয়ার্ড সেট করা যায়নি — আবার চেষ্টা করুন");

    return { ok: true as const, phone, loginEmail: phone ? phoneToEmail(phone) : null };
  });

/** পুরোনো একাউন্টের সাথে Google লিংক — ধাপ ১: ওই Gmail-এ কোড পাঠানো */
export const startGoogleAccountLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const g = await googleIdentity(context.userId);
    if (!g.isGoogle || !g.googleEmail) throw new Error("Google একাউন্ট পাওয়া যায়নি");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name")
      .ilike("email", g.googleEmail)
      .neq("id", context.userId)
      .maybeSingle();
    if (!target) throw new Error("এই Gmail-এ পুরোনো কোনো একাউন্ট পাওয়া যায়নি");

    const { data: recent } = await supabaseAdmin
      .from("email_verify_otps")
      .select("created_at")
      .eq("user_id", (target as any).id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      return { ok: true as const, resent: false as const, destination: maskEmail(g.googleEmail) };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await supabaseAdmin.from("email_verify_otps").insert({
      user_id: (target as any).id,
      email: g.googleEmail,
      code,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    try {
      const { sendSystemEmail } = await import("@/lib/email-otp.server");
      await sendSystemEmail({
        templateName: "email-verify-otp",
        to: g.googleEmail,
        templateData: { code, name: (target as any).display_name ?? undefined },
      });
    } catch (err) {
      console.error("google link otp failed", err);
      throw new Error("কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন");
    }

    return { ok: true as const, resent: true as const, destination: maskEmail(g.googleEmail) };
  });

/** ধাপ ২: কোড মিললে পুরোনো একাউন্টেই লগইন সেশন দেওয়া হয়, নতুন Google একাউন্ট মুছে যায় */
export const completeGoogleAccountLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().trim() }).parse(input))
  .handler(async ({ data, context }) => {
    const code = data.code.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");

    const g = await googleIdentity(context.userId);
    if (!g.isGoogle || !g.googleEmail) throw new Error("Google একাউন্ট পাওয়া যায়নি");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", g.googleEmail)
      .neq("id", context.userId)
      .maybeSingle();
    if (!target) throw new Error("এই Gmail-এ পুরোনো কোনো একাউন্ট পাওয়া যায়নি");

    const targetId = (target as any).id as string;

    const { data: otp } = await supabaseAdmin
      .from("email_verify_otps")
      .select("id, code, attempts, expires_at")
      .eq("user_id", targetId)
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
        .from("email_verify_otps")
        .update({ attempts: ((otp as any).attempts ?? 0) + 1 })
        .eq("id", (otp as any).id);
      throw new Error("কোড মেলেনি");
    }

    // পুরোনো একাউন্টের লগইন ইমেইল
    const { data: tu } = await supabaseAdmin.auth.admin.getUserById(targetId);
    const targetAuthEmail = (tu as any)?.user?.email as string | undefined;
    if (!targetAuthEmail) throw new Error("পুরোনো একাউন্টে লগইন করা যায়নি — অ্যাডমিনের সাথে যোগাযোগ করুন");

    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: targetAuthEmail,
    } as any);
    const tokenHash = (link as any)?.properties?.hashed_token as string | undefined;
    if (linkErr || !tokenHash) throw new Error("লগইন সেশন তৈরি করা যায়নি — আবার চেষ্টা করুন");

    const pub = await publishableClient();
    const { data: sess, error: otpErr } = await pub.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    } as any);
    if (otpErr || !sess?.session) throw new Error("লগইন সেশন তৈরি করা যায়নি — আবার চেষ্টা করুন");

    await supabaseAdmin
      .from("email_verify_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", (otp as any).id);

    await supabaseAdmin
      .from("profiles")
      .update({ email_verified: true, email_verified_at: new Date().toISOString() } as any)
      .eq("id", targetId);

    // অতিরিক্ত (Google-এ তৈরি) একাউন্টটি মুছে ফেলা হয় — যাতে ডুপ্লিকেট না থাকে
    try {
      await supabaseAdmin.auth.admin.deleteUser(context.userId);
    } catch (err) {
      console.error("google duplicate cleanup failed", err);
    }

    return {
      ok: true as const,
      session: {
        access_token: sess.session.access_token,
        refresh_token: sess.session.refresh_token,
      },
    };
  });
