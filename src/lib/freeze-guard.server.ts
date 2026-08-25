// ব্যালেন্স freeze থাকলে টাকা বের করার সব পথ (send / recharge / card / withdraw) বন্ধ।
export async function assertBalanceNotFrozen(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("balance_frozen, balance_frozen_reason")
    .eq("id", userId)
    .maybeSingle();
  if ((data as any)?.balance_frozen === true) {
    const reason = (data as any)?.balance_frozen_reason;
    throw new Error(
      "🧊 আপনার ব্যালেন্স সাময়িকভাবে freeze করা হয়েছে — এখন টাকা পাঠানো, রিচার্জ, কার্ড কেনা বা withdraw করা যাবে না।" +
        (reason ? ` কারণ: ${reason}` : "") +
        " সহায়তার জন্য সাপোর্টে যোগাযোগ করুন।",
    );
  }
}
