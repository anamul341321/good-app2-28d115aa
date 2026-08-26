import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * ফেস দিয়ে রেজিস্ট্রেশন / লগইন।
 *
 * ফ্লো:
 *  1) ক্লায়েন্ট একটি নতুন key (wallet) বানায় → startFaceSignup দিয়ে pending রেকর্ড রাখে
 *  2) Good-App ফেস ভেরিফিকেশন লিংক অ্যাপের ভেতরেই full screen-এ খোলে
 *  3) checkFaceSignup বারবার auto-check করে (ইউজারকে কিছু submit করতে হয় না)
 *  4) whitelist হয়ে গেলে completeFaceSignup একাউন্ট তৈরি করে
 *
 * এই key-গুলো tasks (স্লট) key-এর সাথে মেশে না — আলাদা face_signups টেবিলে থাকে।
 */

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

/** ফেস ছবি (base64) স্টোরেজে রাখে — পরে re-verify-এর সময় চেনা যাবে */
async function uploadFacePhoto(adminClient: any, phone: string, base64: string) {
  try {
    const clean = base64.includes(",") ? base64.split(",")[1]! : base64;
    const buf = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
    const path = `face-signups/${phone}-${Date.now()}.jpg`;
    const { error } = await adminClient.storage.from("face-photos").upload(path, buf, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

const StartInput = z.object({
  name: z.string().trim().min(2, "নাম লাগবে").max(80),
  phone: z.string().trim().regex(/^01\d{9}$/, "১১ ডিজিটের BD নম্বর লাগবে"),
  walletAddress: z.string().trim().min(10),
  privateKey: z.string().trim().min(10),
  photoBase64: z.string().min(100).optional().nullable(),
});


export const startFaceSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { assertFaceVerifyEnabled } = await import("./face-verify-gate.server");
    await assertFaceVerifyEnabled("signup");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", data.phone)
      .maybeSingle();
    if (taken) throw new Error("এই নম্বর দিয়ে ইতোমধ্যে একাউন্ট আছে — লগইন করুন");

    // একই wallet আগে কোথাও ব্যবহার হলে নতুন key লাগবে
    const { data: dupTask } = await supabaseAdmin
      .from("tasks")
      .select("id")
      .eq("wallet_address", data.walletAddress)
      .maybeSingle();
    if (dupTask) throw new Error("এই key আগে ব্যবহার হয়েছে — আবার চেষ্টা করুন");

    const photoPath = data.photoBase64
      ? await uploadFacePhoto(supabaseAdmin, data.phone, data.photoBase64)
      : null;

    await supabaseAdmin.from("face_signups").upsert(
      {
        display_name: data.name,
        phone_number: data.phone,
        wallet_address: data.walletAddress,
        wallet_private_key: data.privateKey,
        status: "pending",
        ...(photoPath ? { face_photo_url: photoPath } : {}),
      } as never,
      { onConflict: "wallet_address" },
    );


    return { ok: true as const };
  });

const AddressInput = z.object({ walletAddress: z.string().trim().min(10) });

/** অটো-চেক: ফেস ভেরিফিকেশন সফল হয়েছে কি না (ইউজারের কিছু করতে হয় না) */
export const checkFaceSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AddressInput.parse(input))
  .handler(async ({ data }) => {
    const { isWhitelistedRPC } = await import("./celo-whitelist");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let ok = false;
    try {
      ok = await isWhitelistedRPC(data.walletAddress);
    } catch {
      ok = false;
    }
    await supabaseAdmin
      .from("face_signups")
      .update({
        status: ok ? "verified" : "pending",
        verified_at: ok ? new Date().toISOString() : null,
      } as never)
      .eq("wallet_address", data.walletAddress);
    return { verified: ok };
  });

const CompleteInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^01\d{9}$/),
  password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর"),
  walletAddress: z.string().trim().min(10),
  gmail: z.string().trim().toLowerCase().optional().nullable(),
  referralCode: z.string().trim().max(20).optional().nullable(),
});

/** ভেরিফিকেশন সফল হওয়ার পরেই একাউন্ট তৈরি হয় */
export const completeFaceSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CompleteInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isWhitelistedRPC } = await import("./celo-whitelist");

    const { data: row } = await supabaseAdmin
      .from("face_signups")
      .select("id, user_id, wallet_address")
      .eq("wallet_address", data.walletAddress)
      .maybeSingle();
    if (!row) throw new Error("ফেস রেজিস্ট্রেশন রেকর্ড পাওয়া যায়নি — আবার শুরু করুন");
    if ((row as any).user_id) throw new Error("এই ফেস দিয়ে একাউন্ট আগেই তৈরি হয়েছে — লগইন করুন");

    const verified = await isWhitelistedRPC(data.walletAddress).catch(() => false);
    if (!verified) throw new Error("ফেস ভেরিফিকেশন এখনো সফল হয়নি — আবার চেষ্টা করুন");

    const email = phoneToEmail(data.phone);
    const gmail = (data.gmail ?? "").trim().toLowerCase();
    const refCode = (data.referralCode ?? "").trim().toUpperCase() || null;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.name,
        phone_number: data.phone,
        contact_email: gmail,
        face_login: true,
        ...(refCode ? { referral_code: refCode } : {}),
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new Error("এই নম্বর দিয়ে ইতোমধ্যে একাউন্ট আছে");
      }
      throw new Error(error.message);
    }

    const userId = created?.user?.id ?? null;
    if (userId && gmail) {
      await supabaseAdmin
        .from("profiles")
        .update({ email: gmail, email_verified: false } as never)
        .eq("id", userId);
    }

    await supabaseAdmin
      .from("face_signups")
      .update({
        user_id: userId,
        status: "verified",
        verified_at: new Date().toISOString(),
      } as never)
      .eq("wallet_address", data.walletAddress);

    return { ok: true as const, email };
  });

/**
 * ভেরিফিকেশন কয়েকবার চেষ্টা করেও না হলে ইউজার স্কিপ করে ঢুকতে পারবে —
 * একাউন্ট তৈরি হবে কিন্তু ফেস ভেরিফিকেশন বাকি থাকবে (প্রোফাইলে লাল করে দেখাবে)।
 */
const SkipInput = CompleteInput.extend({
  walletAddress: z.string().trim().optional().nullable(),
});

export const skipFaceSignup = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SkipInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", data.phone)
      .maybeSingle();
    if (taken) throw new Error("এই নম্বর দিয়ে ইতোমধ্যে একাউন্ট আছে — লগইন করুন");

    const email = phoneToEmail(data.phone);
    const gmail = (data.gmail ?? "").trim().toLowerCase();
    const refCode = (data.referralCode ?? "").trim().toUpperCase() || null;

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.name,
        phone_number: data.phone,
        contact_email: gmail,
        face_login: true,
        face_verify_pending: true,
        ...(refCode ? { referral_code: refCode } : {}),
      },
    });
    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new Error("এই নম্বর দিয়ে ইতোমধ্যে একাউন্ট আছে");
      }
      throw new Error(error.message);
    }

    const userId = created?.user?.id ?? null;
    if (userId && gmail) {
      await supabaseAdmin
        .from("profiles")
        .update({ email: gmail, email_verified: false } as never)
        .eq("id", userId);
    }

    if (data.walletAddress) {
      await supabaseAdmin
        .from("face_signups")
        .update({ user_id: userId, status: "skipped" } as never)
        .eq("wallet_address", data.walletAddress);
    }

    return { ok: true as const, email };
  });

/** ফেস দিয়ে লগইন: ভেরিফাই হওয়া wallet থেকে নম্বর ফেরত দেয় (পাসওয়ার্ড দিয়ে লগইন হবে) */
export const resolveFaceLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AddressInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("face_signups")
      .select("phone_number, user_id")
      .eq("wallet_address", data.walletAddress)
      .maybeSingle();
    if (!row || !(row as any).user_id) {
      return { found: false as const, phone: null };
    }
    return { found: true as const, phone: (row as any).phone_number as string };
  });
