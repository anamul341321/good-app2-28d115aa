const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_TIMEOUT_MS = 15_000;

type LoginData = { identifier: string; password: string };

type Account = {
  id: string;
  authEmail: string;
  contactEmail: string;
  emailVerified: boolean;
  displayName: string | null;
};

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), LOGIN_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveAccount(identifier: string): Promise<Account> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const raw = identifier.trim().toLowerCase();
  const digits = raw.replace(/\D/g, "");

  let profile: any = null;
  if (/^01\d{9}$/.test(digits)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number")
      .eq("phone_number", digits)
      .maybeSingle();
    if (error) throw new Error("একাউন্ট খুঁজতে সমস্যা হয়েছে — আবার চেষ্টা করুন");
    profile = data;
    if (!profile) {
      return {
        id: "",
        authEmail: phoneToEmail(digits),
        contactEmail: "",
        emailVerified: false,
        displayName: null,
      };
    }
  } else if (EMAIL_RE.test(raw)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number")
      .ilike("email", raw)
      .maybeSingle();
    if (error) throw new Error("একাউন্ট খুঁজতে সমস্যা হয়েছে — আবার চেষ্টা করুন");
    profile = data;
  } else {
    throw new Error("১১ ডিজিটের নম্বর অথবা Gmail দিন");
  }

  if (!profile) throw new Error("এই নম্বর/Gmail-এ কোনো একাউন্ট পাওয়া যায়নি");

  let authEmail = profile.phone_number ? phoneToEmail(profile.phone_number) : "";
  if (!authEmail) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    authEmail = data?.user?.email ?? "";
  }
  if (!authEmail) throw new Error("এই একাউন্টে লগইন তথ্য পাওয়া যায়নি — অ্যাডমিনের সাথে যোগাযোগ করুন");

  return {
    id: profile.id,
    authEmail,
    contactEmail: (profile.email ?? "").toLowerCase(),
    emailVerified: Boolean(profile.email_verified),
    displayName: profile.display_name ?? null,
  };
}

async function verifyPassword(authEmail: string, password: string) {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("লগইন সেবা প্রস্তুত নয় — একটু পরে চেষ্টা করুন");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers, signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS) });
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email: authEmail, password });
  if (error || !data.session) throw new Error("ভুল নম্বর/Gmail অথবা পাসওয়ার্ড");
  return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
}

async function startLoginOtpWork(data: LoginData) {
  const account = await resolveAccount(data.identifier);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [session, recentResult] = await Promise.all([
    verifyPassword(account.authEmail, data.password),
    account.id
      ? supabaseAdmin.from("email_verify_otps").select("created_at").eq("user_id", account.id)
          .is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!account.id || !account.contactEmail || !account.emailVerified) {
    return { ok: true as const, needOtp: false as const, session };
  }

  const recent = recentResult.data as { created_at?: string } | null;
  if (recent?.created_at && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
    return { ok: true as const, needOtp: true as const, resent: false as const, destination: maskEmail(account.contactEmail) };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const { error: insertError } = await supabaseAdmin.from("email_verify_otps").insert({
    user_id: account.id,
    email: account.contactEmail,
    code,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (insertError) throw new Error("কোড তৈরি করা যায়নি — আবার চেষ্টা করুন");

  const { sendSystemEmail } = await import("@/lib/email-otp.server");
  await sendSystemEmail({
    templateName: "email-verify-otp",
    to: account.contactEmail,
    templateData: { code, name: account.displayName ?? undefined },
  });
  return { ok: true as const, needOtp: true as const, resent: true as const, destination: maskEmail(account.contactEmail) };
}

export async function startLoginOtpHandler(data: LoginData) {
  return withTimeout(startLoginOtpWork(data), "লগইন করতে বেশি সময় লাগছে — ইন্টারনেট দেখে আবার চেষ্টা করুন");
}

async function completeLoginOtpWork(data: LoginData & { code: string }) {
  const code = data.code.replace(/\D/g, "").slice(0, 6);
  if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");
  const account = await resolveAccount(data.identifier);
  if (!account.id) throw new Error("এই একাউন্টের Gmail ভেরিফিকেশন পাওয়া যায়নি");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [otpResult, sessionResult] = await Promise.all([
    supabaseAdmin.from("email_verify_otps").select("id, code, attempts, expires_at")
      .eq("user_id", account.id).is("used_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    verifyPassword(account.authEmail, data.password).catch((error: unknown) => error),
  ]);
  if (otpResult.error) throw new Error("কোড যাচাই করা যায়নি — আবার চেষ্টা করুন");
  const otp = otpResult.data;
  if (!otp) throw new Error("কোড পাওয়া যায়নি — আবার কোড পাঠান");
  if (new Date(otp.expires_at).getTime() < Date.now()) throw new Error("কোডের সময় শেষ — নতুন কোড নিন");
  if ((otp.attempts ?? 0) >= 5) throw new Error("অনেকবার ভুল হয়েছে — নতুন কোড নিন");
  if (otp.code !== code) {
    await supabaseAdmin.from("email_verify_otps").update({ attempts: (otp.attempts ?? 0) + 1 }).eq("id", otp.id);
    throw new Error("কোড মেলেনি");
  }
  if (sessionResult instanceof Error) throw sessionResult;
  await supabaseAdmin.from("email_verify_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);
  return { ok: true as const, session: sessionResult as { access_token: string; refresh_token: string } };
}

export async function completeLoginOtpHandler(data: LoginData & { code: string }) {
  return withTimeout(completeLoginOtpWork(data), "ভেরিফিকেশনে বেশি সময় লাগছে — আবার চেষ্টা করুন");
}