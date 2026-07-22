import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SetWalletInput = z.object({
  provider: z.enum(["bkash", "nagad"]),
  number: z.string().trim().regex(/^01\d{9}$/, "Bangladeshi mobile number lagbe (11 digit, 01 diye shuru)"),
});

// Set (or add) a wallet number for a specific provider.
// A user can hold ONE bkash + ONE nagad entry — never two of the same kind.
// Existing (user, provider) rows are protected from being overwritten by
// the user themselves (admin panel handles resets).
export const setWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetWalletInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: existing } = await supabase
      .from("wallets")
      .select("provider")
      .eq("user_id", userId)
      .eq("provider", data.provider)
      .maybeSingle();
    if (existing) {
      throw new Error(
        data.provider === "bkash"
          ? "বিকাশ নম্বর ইতিমধ্যে সেট করা হয়েছে — পরিবর্তন করতে admin এর সাথে যোগাযোগ করুন"
          : "নগদ নম্বর ইতিমধ্যে সেট করা হয়েছে — পরিবর্তন করতে admin এর সাথে যোগাযোগ করুন"
      );
    }

    const { error } = await supabase.from("wallets").insert({
      user_id: userId,
      provider: data.provider,
      number: data.number,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
