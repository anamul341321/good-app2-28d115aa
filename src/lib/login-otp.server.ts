const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Fail fast: backend ধীর হলে, ২০s ঝুলে থাকার বদলে ৮s-এ স্পষ্ট error দেখাবে
// এবং connection ছেড়ে দেবে — এতে pool জমে গিয়ে পুরো app আটকে যাওয়া বন্ধ হয়।
const LOGIN_TIMEOUT_MS = 8_000;

/**
 * Google Play রিভিউয়ারের জন্য ডেমো একাউন্ট।
 * রিভিউয়ার আমাদের Gmail-এর কোড পড়তে পারে না, তাই এই নম্বরগুলোতে
 * শুধু নম্বর + পাসওয়ার্ড দিয়েই লগইন হবে (কোনো OTP লাগবে না)।
 */
const REVIEW_PHONES = ["01900000000"];

function isReviewAccount(identifier: string, contactEmail: string) {
  const digits = identifier.replace(/\D/g, "");
  return REVIEW_PHONES.includes(digits) || REVIEW_PHONES.some((p) => contactEmail.startsWith(`u${p}@`));
}

type LoginData = { identifier: string; password: string; deviceId?: string };

type Account = {
  id: string;
  authEmail: string;
  authEmails: string[];
  contactEmail: string;
  emailVerified: boolean;
  displayName: string | null;
};

type SignInResult =
  | { ok: true; session: { access_token: string; refresh_token: string } }
  | { ok: false; reason: "auth" | "timeout" | "error" };


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

  let rows: any[] = [];
  if (/^01\d{9}$/.test(digits)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number, created_at")
      .eq("phone_number", digits)
      .order("email_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error("একাউন্ট খুঁজতে সমস্যা হয়েছে — আবার চেষ্টা করুন");
    rows = data ?? [];
    if (rows.length === 0) {
      return {
        id: "",
        authEmail: phoneToEmail(digits),
        authEmails: [phoneToEmail(digits)],
        contactEmail: "",
        emailVerified: false,
        displayName: null,
      };
    }
  } else if (EMAIL_RE.test(raw)) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, email_verified, phone_number, created_at")
      .ilike("email", raw)
      .order("email_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) throw new Error("একাউন্ট খুঁজতে সমস্যা হয়েছে — আবার চেষ্টা করুন");
    rows = data ?? [];
  } else {
    throw new Error("১১ ডিজিটের নম্বর অথবা Gmail দিন");
  }

  if (rows.length === 0) throw new Error("এই নম্বর/Gmail-এ কোনো একাউন্ট পাওয়া যায়নি");

  const profile = rows[0];

  // একাউন্টে যে যে ইমেইল দিয়ে auth হতে পারে — সবগুলো চেষ্টা করব
  // (একই নম্বরে একাধিক profile থাকলে সবগুলোর ইমেইলই চেষ্টা করা হয়)
  const candidates: string[] = [];
  const push = (email?: string | null) => {
    const e = (email ?? "").toLowerCase().trim();
    if (e && !candidates.includes(e)) candidates.push(e);
  };
  if (raw && EMAIL_RE.test(raw)) push(raw);
  for (const row of rows) {
    push(row.phone_number ? phoneToEmail(row.phone_number) : null);
    push(row.email);
  }
  const authUsers = await Promise.all(
    rows.map((row) => supabaseAdmin.auth.admin.getUserById(row.id).catch(() => null)),
  );
  for (const u of authUsers) push((u as any)?.data?.user?.email);

  if (candidates.length === 0)
    throw new Error("এই একাউন্টে লগইন তথ্য পাওয়া যায়নি — অ্যাডমিনের সাথে যোগাযোগ করুন");

  const profileEmail = (profile.email ?? "").toLowerCase();

  return {
    id: profile.id,
    authEmail: candidates[0]!,
    authEmails: candidates,
    contactEmail: profileEmail,
    emailVerified: Boolean(profile.email_verified),
    displayName: profile.display_name ?? null,
  };
}


async function signInWith(authEmail: string, password: string): Promise<SignInResult> {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) return { ok: false, reason: "error" };

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
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: authEmail, password });
    if (error || !data.session) return { ok: false, reason: "auth" };
    return { ok: true, session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } };
  } catch (err: any) {
    const msg = String(err?.message ?? "").toLowerCase();
    if (err?.name === "AbortError" || msg.includes("timeout") || msg.includes("abort") || msg.includes("timed out")) {
      return { ok: false, reason: "timeout" };
    }
    return { ok: false, reason: "error" };
  }
}

async function verifyPassword(account: Account, password: string) {
  // একাধারে সব ইমেইলে চেষ্টা — কোনো একটা কাজ করলেই সেটাই নেওয়া হবে।
  const results = await Promise.all(
    account.authEmails.map((email) => signInWith(email, password))
  );
  const success = results.find((r): r is Extract<SignInResult, { ok: true }> => r.ok === true);
  if (success) return success.session;

  const hasTimeout = results.some((r) => !r.ok && r.reason === "timeout");
  if (hasTimeout) {
    throw new Error("লগইন সার্ভারে সময় লাগছে — ইন্টারনেট চেক করে আবার চেষ্টা করুন");
  }
  throw new Error("ভুল নম্বর/Gmail অথবা পাসওয়ার্ড");
}

/** এই ডিভাইসটির ওপর ২৪ ঘণ্টার OTP-trust আছে কি না */
async function isDeviceTrusted(userId: string, deviceId?: string): Promise<boolean> {
  if (!deviceId || !userId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_devices")
    .select("otp_trust_expires_at")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .gt("otp_trust_expires_at", new Date().toISOString())
    .maybeSingle();
  return !!data;
}

/** সফল OTP লগইনের পর এই ডিভাইসকে ২৪ ঘণ্টার জন্য trusted মার্ক করুন */
async function markDeviceTrusted(userId: string, deviceId?: string) {
  if (!deviceId || !userId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  await supabaseAdmin
    .from("user_devices")
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        otp_trust_expires_at: expiresAt,
        revoked_at: null,
        approval_state: null,
        approval_requested_at: null,
        last_seen_at: new Date().toISOString(),
      } as any,
      { onConflict: "user_id,device_id" }
    );
}


async function startLoginOtpWork(data: LoginData) {
  const account = await resolveAccount(data.identifier);

  const session = await verifyPassword(account, data.password);

  // যাদের Gmail যোগ করা আছে (verified) — তাদের লগইনে ৬ ডিজিটের কোড লাগবে,
  // অ্যাডমিন সুইচ যা-ই থাকুক। Gmail না থাকলে আগের মতোই শুধু নম্বর+পাসওয়ার্ড।
  const hasGmail =
    !!account.id &&
    !!account.contactEmail &&
    !/@facemine\.app$/i.test(account.contactEmail) &&
    account.emailVerified;

  if (!hasGmail || isReviewAccount(data.identifier, account.contactEmail)) {
    return { ok: true as const, needOtp: false as const, session };
  }

  // নিজের ফোনে ২৪ ঘণ্টার মধ্যে একবার কোড দিলেই আর কোড লাগবে না
  if (await isDeviceTrusted(account.id, data.deviceId)) {
    return { ok: true as const, needOtp: false as const, session, trustedDevice: true as const };
  }


  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: recent } = await supabaseAdmin
    .from("email_verify_otps")
    .select("created_at")
    .eq("user_id", account.id)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    verifyPassword(account, data.password).catch((error: unknown) => error),
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

  // এই ডিভাইস এখন ২৪ ঘণ্টার জন্য trusted — পরের লগইনে কোড লাগবে না
  await markDeviceTrusted(account.id, data.deviceId);

  return { ok: true as const, session: sessionResult as { access_token: string; refresh_token: string } };
}

export async function completeLoginOtpHandler(data: LoginData & { code: string }) {
  return withTimeout(completeLoginOtpWork(data), "ভেরিফিকেশনে বেশি সময় লাগছে — আবার চেষ্টা করুন");
}
