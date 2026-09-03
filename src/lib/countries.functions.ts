import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CountrySetting = {
  code: string;
  name_en: string;
  name_local: string;
  flag: string;
  monthly_mining_bdt: number;
  referral_bonus_bdt: number;
  referral_bonus_active: boolean;
  signup_allowed: boolean;
  tier: string;
};

function serverPublicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  return { url, key };
}

/** Public: everyone (even guests) can see each country's mining rate + bonus. */
export const listCountryRates = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { url, key } = serverPublicClient();
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data } = await sb
    .from("country_settings")
    .select("code, name_en, name_local, flag, monthly_mining_bdt, referral_bonus_bdt, referral_bonus_active, signup_allowed, tier")
    .order("referral_bonus_active", { ascending: false })
    .order("monthly_mining_bdt", { ascending: false })
    .order("name_en", { ascending: true });
  return (data ?? []).map((r: any) => ({
    ...r,
    monthly_mining_bdt: Number(r.monthly_mining_bdt),
    referral_bonus_bdt: Number(r.referral_bonus_bdt),
  })) as CountrySetting[];
});

// ---------------- Admin ----------------

async function gate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const adminListCountries = createServerFn({ method: "GET" }).handler(async () => {
  const db = await gate();
  const { data } = await db.from("country_settings").select("*").order("code");
  return (data ?? []).map((r: any) => ({
    ...r,
    monthly_mining_bdt: Number(r.monthly_mining_bdt),
    referral_bonus_bdt: Number(r.referral_bonus_bdt),
  })) as CountrySetting[];
});

export const adminUpdateCountry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().trim().min(2).max(8),
        monthly_mining_bdt: z.number().min(0).max(5000),
        referral_bonus_bdt: z.number().min(0).max(5000),
        referral_bonus_active: z.boolean(),
        signup_allowed: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    const { error } = await db
      .from("country_settings")
      .update({
        monthly_mining_bdt: data.monthly_mining_bdt,
        referral_bonus_bdt: data.referral_bonus_bdt,
        referral_bonus_active: data.referral_bonus_active,
        signup_allowed: data.signup_allowed,
        updated_at: new Date().toISOString(),
      })
      .eq("code", data.code.toUpperCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddCountry = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        code: z.string().trim().min(2).max(8),
        name_en: z.string().trim().min(2).max(60),
        flag: z.string().trim().max(8).optional(),
        monthly_mining_bdt: z.number().min(0).max(5000),
        referral_bonus_bdt: z.number().min(0).max(5000),
        referral_bonus_active: z.boolean(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const db = await gate();
    const code = data.code.toUpperCase();
    const { error } = await db.from("country_settings").upsert(
      {
        code,
        name_en: data.name_en,
        name_local: data.name_en,
        flag: data.flag || "🌐",
        monthly_mining_bdt: data.monthly_mining_bdt,
        referral_bonus_bdt: data.referral_bonus_bdt,
        referral_bonus_active: data.referral_bonus_active,
        tier: data.referral_bonus_active ? "premium" : "standard",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
