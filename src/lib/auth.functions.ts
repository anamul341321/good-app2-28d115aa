import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PhoneSignupInput = z.object({
  name: z.string().trim().min(2, "নাম লাগবে").max(80, "নাম অনেক বড়"),
  phone: z.string().trim().regex(/^01\d{9}$/, "১১ ডিজিটের BD নম্বর লাগবে"),
  password: z.string().min(6, "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর"),
  gmail: z.string().trim().toLowerCase().email("সঠিক Gmail ঠিকানা দিন"),
  referralCode: z.string().trim().max(20).optional().nullable(),
});

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

export const registerWithPhone = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => PhoneSignupInput.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = phoneToEmail(data.phone);
    const gmail = data.gmail.trim().toLowerCase();

    // এক Gmail = এক একাউন্ট
    const { data: gmailTaken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", gmail)
      .maybeSingle();
    if (gmailTaken) throw new Error("এই Gmail দিয়ে ইতোমধ্যে একাউন্ট আছে");

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


    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        display_name: data.name,
        phone_number: data.phone,
        ...(refCode ? { referral_code: refCode } : {}),
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already")) {
        throw new Error("এই নম্বর দিয়ে ইতোমধ্যে account আছে");
      }
      throw new Error(error.message);
    }

    return { ok: true, email };
  });

// Resolve a scanned UID (uuid) → phone number for QR login
export const resolveCardUidForLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ uid: z.string().min(8) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const raw = data.uid.trim();
    let query = supabaseAdmin.from("profiles").select("phone_number,id").limit(1);
    if (/^[0-9a-f-]{32,}$/i.test(raw)) {
      query = query.eq("id", raw);
    } else {
      // compact form like ABCDEF012345 — try prefix match on id text
      const compact = raw.replace(/[^0-9a-f]/gi, "").toLowerCase();
      const { data: rows } = await supabaseAdmin
        .from("profiles")
        .select("phone_number,id")
        .limit(500);
      const found = (rows ?? []).find((r: any) =>
        String(r.id).replace(/-/g, "").toLowerCase().startsWith(compact),
      );
      if (!found?.phone_number) throw new Error("এই কার্ডের UID খুঁজে পাওয়া যায়নি");
      return { phone: found.phone_number as string };
    }
    const { data: row } = await query.maybeSingle();
    if (!row?.phone_number) throw new Error("এই কার্ডের UID খুঁজে পাওয়া যায়নি");
    return { phone: row.phone_number as string };
  });
