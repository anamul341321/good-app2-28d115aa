import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PhoneSignupInput = z.object({
  name: z.string().trim().min(2, "নাম লাগবে").max(80, "নাম অনেক বড়"),
  phone: z.string().trim().regex(/^\d{6,15}$/, "সঠিক মোবাইল নম্বর দিন"),
  country: z.string().trim().min(2).max(8).default("BD"),
  timezone: z.string().trim().max(64).optional().nullable(),
  password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর"),
  gender: z.enum(["male", "female"], { message: "ছেলে অথবা মেয়ে সিলেক্ট করুন" }),
  gmail: z.string().trim().toLowerCase().optional().nullable(),
  referralCode: z.string().trim().max(20).optional().nullable(),
});



function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

export const registerWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PhoneSignupInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isEmailOtpEnabled } = await import("./auth-mode.server");
    const otpEnabled = await isEmailOtpEnabled();
    const email = phoneToEmail(data.phone);
    const gmail = (data.gmail ?? "").trim().toLowerCase();

    // দেশভিত্তিক নম্বর যাচাই (BD = 01XXXXXXXXX, অন্য দেশ = নিজের ডিজিট নিয়ম)
    const { validatePhoneForRegion, getRegion } = await import("./regions");
    const region = getRegion(data.country);
    const phoneProblem = validatePhoneForRegion(region.code, data.phone);
    if (phoneProblem) throw new Error(`${region.nameEn}: ${phoneProblem}`);

    // দেশের সেটিংস (mining rate / referral bonus / signup খোলা আছে কিনা)
    const { data: countryRow } = await supabaseAdmin
      .from("country_settings")
      .select("code, monthly_mining_bdt, referral_bonus_bdt, referral_bonus_active, signup_allowed")
      .eq("code", region.code)
      .maybeSingle();
    if (countryRow && (countryRow as any).signup_allowed === false) {
      throw new Error("এই দেশে এখন নতুন একাউন্ট খোলা বন্ধ আছে | Signup is closed for this country");
    }

    // লোকেশন যাচাই — VPN/Proxy দিয়ে বিদেশি একাউন্ট খোলা বন্ধ
    const { verifySignupCountry, timezoneMatches } = await import("./geo.server");
    const { geo, geoVerified, vpnFlagged } = await verifySignupCountry(region.code);
    if (region.code !== "BD" && region.code !== "OTHER" && !timezoneMatches(region.code, data.timezone)) {
      throw new Error(
        "আপনার ফোনের টাইমজোন সিলেক্ট করা দেশের সাথে মিলছে না | Your device timezone does not match the selected country",
      );
    }



    if (otpEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) {
      throw new Error("সঠিক Gmail ঠিকানা দিন");
    }

    // এক Gmail = এক একাউন্ট
    if (gmail) {
      const { data: gmailTaken } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", gmail)
        .maybeSingle();
      if (gmailTaken) throw new Error("এই Gmail দিয়ে ইতোমধ্যে একাউন্ট আছে");
    }

    let refCode: string | null = null;
    if (data.referralCode && data.referralCode.trim().length > 0) {
      const cleaned = data.referralCode.trim().toUpperCase();
      const { data: ref } = await supabaseAdmin
        .from("profiles")
        .select("id, referral_unlock_override")
        .eq("referral_code", cleaned)
        .maybeSingle();
      if (!ref) throw new Error("Referral code সঠিক নয়");

      // Referral lock: owner must meet the shared successful first-verify threshold
      // OR admin has manually unlocked. Prevents self-referral farming.
      if (!(ref as any).referral_unlock_override) {
        const { REFERRAL_UNLOCK_THRESHOLD } = await import("./constants");
        const { count: firstVerifies } = await supabaseAdmin
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", ref.id)
          .not("initial_verify_at", "is", null);
        if ((firstVerifies ?? 0) < REFERRAL_UNLOCK_THRESHOLD) {
          throw new Error(
            `এই referral code এখনো active হয়নি — কোড এর মালিক ${REFERRAL_UNLOCK_THRESHOLD}টি ফেস ভেরিফাই সম্পন্ন করলে বা admin unlock করলে ব্যবহার করা যাবে (${firstVerifies ?? 0}/${REFERRAL_UNLOCK_THRESHOLD})`
          );
        }
      }
      refCode = cleaned;
    }


    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.name,
        phone_number: data.phone,
        contact_email: gmail,
        gender: data.gender,
        country: region.code,
        ...(refCode ? { referral_code: refCode } : {}),
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new Error("এই নম্বর দিয়ে ইতোমধ্যে account আছে");
      }
      throw new Error(error.message);
    }

    // প্রোফাইলে Gmail + লিঙ্গ + লোকেশন প্রমাণ সেভ
    if (created?.user?.id) {
      await supabaseAdmin
        .from("profiles")
        .update({
          gender: data.gender,
          country: region.code,
          signup_ip: geo.ip,
          signup_ip_country: geo.ipCountry,
          signup_timezone: data.timezone ?? null,
          geo_verified: geoVerified,
          vpn_flagged: vpnFlagged,
          ...(gmail ? { email: gmail, email_verified: false } : {}),
        } as any)
        .eq("id", created.user.id);

      // 🌍 বিদেশি রেফারেল বোনাস — সাথে সাথে referrer-এর মেইন ব্যালেন্সে
      const bonusAmount = Number((countryRow as any)?.referral_bonus_bdt ?? 0);
      const bonusActive = !!(countryRow as any)?.referral_bonus_active;
      if (refCode && bonusActive && bonusAmount > 0 && geoVerified && !vpnFlagged) {
        try {
          const { data: refOwner } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("referral_code", refCode)
            .maybeSingle();
          if (refOwner?.id && refOwner.id !== created.user.id) {
            await supabaseAdmin.rpc("credit_bonus_balance", {
              _user_id: refOwner.id,
              _amount: bonusAmount,
              _type: "foreign_referral_bonus",
              _source_id: created.user.id,
              _metadata: { country: region.code, ip_country: geo.ipCountry },
            });
            await supabaseAdmin
              .from("profiles")
              .update({ foreign_referral_bonus_paid: true } as any)
              .eq("id", created.user.id);
            await supabaseAdmin.from("user_notices").insert({
              user_id: refOwner.id,
              title: "🌍 বিদেশি রেফার বোনাস",
              body: `${region.flag} ${region.nameEn} থেকে একজন একাউন্ট খুলেছে — আপনি সাথে সাথে ${bonusAmount}৳ বোনাস পেয়েছেন!`,
              metadata: { kind: "foreign_referral_bonus", amount: bonusAmount, country: region.code },
            } as any);

          }
        } catch {
          // বোনাস ফেল করলেও একাউন্ট তৈরি আটকাবে না
        }
      }
    }




    return { ok: true, email };
  });

// Resolve a scanned UID (uuid) → phone number for QR login
export const resolveCardUidForLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({
    uid: z.string().trim().uuid("সঠিক কার্ড QR স্ক্যান করুন"),
  }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("phone_number")
      .eq("id", data.uid)
      .maybeSingle();
    if (!row?.phone_number) throw new Error("এই কার্ডের UID খুঁজে পাওয়া যায়নি");
    return { phone: row.phone_number as string };
  });
