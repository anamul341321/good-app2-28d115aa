import { createServerFn } from "@tanstack/react-start";

/**
 * পাসওয়ার্ড ভুলে গেলে: ইউজারের লিংক করা Telegram-এ ৬ ডিজিটের কোড পাঠানো হয়,
 * কোড দিয়ে নতুন পাসওয়ার্ড সেট করা যায়।
 */

function cleanPhone(input: string) {
  return (input || "").replace(/\D/g, "").slice(0, 11);
}

export const requestPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string }) => d)
  .handler(async ({ data }) => {
    const phone = cleanPhone(data.phone);
    if (!/^01\d{9}$/.test(phone)) {
      throw new Error("১১ ডিজিটের সঠিক মোবাইল নম্বর দিন");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id, display_name, uid_seq, telegram_user_id")
      .eq("phone_number", phone)
      .maybeSingle();

    if (!prof) throw new Error("এই নম্বরে কোনো একাউন্ট পাওয়া যায়নি");
    if (!prof.telegram_user_id) {
      throw new Error(
        "এই একাউন্টে Telegram লিংক করা নেই, তাই কোড পাঠানো যাচ্ছে না। আমাদের Telegram গ্রুপে অ্যাডমিনের সাথে যোগাযোগ করুন।",
      );
    }

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
      channel: "telegram",
      expires_at: expiresAt,
    });

    const { sendMessage } = await import("@/lib/telegram-bot.server");
    await sendMessage(
      prof.telegram_user_id,
      `🔐 পাসওয়ার্ড রিসেট কোড: <b>${code}</b>\n\n১০ মিনিটের মধ্যে ব্যবহার করুন। কোডটি কাউকে দেবেন না।`,
    );

    return { ok: true as const, channel: "telegram" as const };
  });

export const resetPasswordWithOtp = createServerFn({ method: "POST" })
  .inputValidator((d: { phone: string; code: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const phone = cleanPhone(data.phone);
    const code = (data.code || "").replace(/\D/g, "").slice(0, 6);
    if (!/^01\d{9}$/.test(phone)) throw new Error("সঠিক মোবাইল নম্বর দিন");
    if (code.length !== 6) throw new Error("৬ ডিজিটের কোড দিন");
    if ((data.newPassword || "").length < 6) {
      throw new Error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone_number", phone)
      .maybeSingle();
    if (!prof) throw new Error("এই নম্বরে কোনো একাউন্ট পাওয়া যায়নি");

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
