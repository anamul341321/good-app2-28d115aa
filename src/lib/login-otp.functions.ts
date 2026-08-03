import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * লগইনে Gmail ভেরিফিকেশন (2-step):
 *  1) startLoginOtp  — নম্বর/Gmail + পাসওয়ার্ড চেক করে ইউজারের ভেরিফাইড Gmail-এ ৬ ডিজিটের কোড পাঠায়
 *  2) completeLoginOtp — কোড মিললে session টোকেন ফেরত দেয় (ক্লায়েন্ট setSession করে)
 * যাদের Gmail এখনো লিংক করা নেই, তারা সরাসরি ঢুকবে — ভেতরে Gmail ভেরিফিকেশন গেট আটকাবে।
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email: string) {
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l.slice(0, 2)}***@${d}`;
}

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

const LoginInput = z.object({
  identifier: z.string().trim().min(3, "নম্বর অথবা Gmail দিন"),
  password: z.string().min(1, "পাসওয়ার্ড দিন"),
});

type Account = {
  id: string;
  authEmail: string;
  contactEmail: string;
  emailVerified: boolean;
  displayName: string | null;
};

async function resolveAccount(identifier: string): Promise<Account> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw = identifier.trim().toLowerCase();
  const digits = raw.replace(/\D/g, "");

  let prof: any = null;
  if (/^01\d{9}$/.test(digits)) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number")
      .eq("phone_number", digits)
      .maybeSingle();
    prof = data;
    if (!prof) {
      // পুরোনো একাউন্ট, প্রোফাইলে নম্বর সেভ নেই — internal email দিয়েই চেষ্টা
      return {
        id: "",
        authEmail: phoneToEmail(digits),
        contactEmail: "",
        emailVerified: false,
        displayName: null,
      };
    }
  } else if (EMAIL_RE.test(raw)) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number")
      .ilike("email", raw)
      .maybeSingle();
    prof = data;
  } else {
    throw new Error("১১ ডিজিটের নম্বর অথবা Gmail দিন");
  }

  if (!prof) throw new Error("এই নম্বর/Gmail-এ কোনো একাউন্ট পাওয়া যায়নি");

  let authEmail = prof.phone_number ? phoneToEmail(prof.phone_number) : "";
  if (!authEmail) {
    // নম্বর সেভ নেই — তখনই শুধু auth থেকে ইমেইল আনি (একটা extra roundtrip বাঁচে)
    try {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(prof.id);
      if (u?.user?.email) authEmail = u.user.email;
    } catch {
      /* ignore */
    }
  }
  if (!authEmail) throw new Error("এই একাউন্টে লগইন তথ্য পাওয়া যায়নি — অ্যাডমিনের সাথে যোগাযোগ করুন");

  return {
    id: prof.id,
    authEmail,
    contactEmail: (prof.email ?? "").toLowerCase(),
    emailVerified: !!prof.email_verified,
    displayName: prof.display_name ?? null,
  };
}

async function verifyPassword(authEmail: string, password: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
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
  const { data, error } = await client.auth.signInWithPassword({ email: authEmail, password });
  if (error || !data.session) {
    throw new Error("ভুল নম্বর/Gmail অথবা পাসওয়ার্ড");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

export const startLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => LoginInput.parse(input))
  .handler(async ({ data }) => {
    const acc = await resolveAccount(data.identifier);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // পাসওয়ার্ড চেক আর শেষ কোডের সময় — একসাথে (দ্রুত)
    const [session, recentRes] = await Promise.all([
      verifyPassword(acc.authEmail, data.password),
      acc.id
        ? supabaseAdmin
            .from("email_verify_otps")
            .select("created_at")
            .eq("user_id", acc.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null } as any),
    ]);

    // Gmail লিংক করা নেই → সরাসরি ঢুকবে, ভেতরে গেট Gmail চাইবে
    if (!acc.id || !acc.contactEmail || !acc.emailVerified) {
      return { ok: true as const, needOtp: false as const, session };
    }

    const recent = recentRes?.data as { created_at?: string } | null;
    if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
      return {
        ok: true as const,
        needOtp: true as const,
        resent: false as const,
        destination: maskEmail(acc.contactEmail),
      };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const insertPromise = supabaseAdmin.from("email_verify_otps").insert({
      user_id: acc.id,
      email: acc.contactEmail,
      code,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    try {
      const { sendSystemEmail } = await import("@/lib/email-otp.server");
      // কোড সেভ ও মেইল পাঠানো একসাথে — অপেক্ষা কম
      await Promise.all([
        insertPromise,
        sendSystemEmail({
          templateName: "email-verify-otp",
          to: acc.contactEmail,
          templateData: { code, name: acc.displayName ?? undefined },
        }),
      ]);
    } catch (err) {
      console.error("login otp send failed", err);
      throw new Error("কোড পাঠানো যায়নি, একটু পরে আবার চেষ্টা করুন");
    }


    return {
      ok: true as const,
      needOtp: true as const,
      resent: true as const,
      destination: maskEmail(acc.contactEmail),
    };
  });

export const completeLoginOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    LoginInput.extend({ code: z.string().trim() }).parse(input),
  )
  .handler(async ({ data }) => {
    const code = data.code.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");

    const acc = await resolveAccount(data.identifier);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // কোড যাচাই আর পাসওয়ার্ড/সেশন — একসাথে (দ্রুত লগইন)
    const [otpRes, sessionRes] = await Promise.all([
      supabaseAdmin
        .from("email_verify_otps")
        .select("id, code, attempts, expires_at")
        .eq("user_id", acc.id)
        .is("used_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      verifyPassword(acc.authEmail, data.password).catch((e: any) => e as Error),
    ]);

    const otp = otpRes?.data as any;
    if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
    }
    if ((otp.attempts ?? 0) >= 5) throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
    if (otp.code !== code) {
      await supabaseAdmin
        .from("email_verify_otps")
        .update({ attempts: (otp.attempts ?? 0) + 1 })
        .eq("id", otp.id);
      throw new Error("কোড মেলেনি");
    }

    if (sessionRes instanceof Error) throw sessionRes;
    const session = sessionRes;

    await supabaseAdmin
      .from("email_verify_otps")
      .update({ used_at: new Date().toISOString() })
      .eq("id", otp.id);

    return { ok: true as const, session };

  });
