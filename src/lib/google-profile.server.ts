import { createClient } from "@supabase/supabase-js";

export function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createPublishableClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Auth configuration পাওয়া যায়নি");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function getGoogleIdentity(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) throw new Error("Google login তথ্য যাচাই করা যায়নি");

  const user = data.user;
  const identities = user?.identities ?? [];
  const google = identities.find((identity) => identity.provider === "google");

  return {
    isGoogle: Boolean(google),
    googleEmail: String(google?.identity_data?.email ?? user?.email ?? "").trim().toLowerCase(),
    completed: Boolean(user?.user_metadata?.profile_completed),
    metaName: String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ""),
  };
}