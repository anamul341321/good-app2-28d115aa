// Server-only: reset a user's saved payment numbers (bKash / Nagad / USDT)
// on behalf of a Telegram support request. Mirrors adminResetWallet so the bot
// and the admin panel behave identically.

type Provider = "bkash" | "nagad" | "usdt";
const PROVIDERS: Provider[] = ["bkash", "nagad", "usdt"];
const LABEL: Record<Provider, string> = { bkash: "বিকাশ", nagad: "নগদ", usdt: "USDT" };

export type WalletResetResult =
  | { ok: true; name: string; removed: { provider: Provider; number: string }[] }
  | { ok: false; error: string };

/** Mask a payment number so the group never sees the full number. */
function mask(n: string) {
  const s = String(n ?? "");
  if (s.length <= 4) return s;
  return `${s.slice(0, 3)}****${s.slice(-3)}`;
}

/**
 * Deletes saved payment numbers for one account so the user can add a fresh one.
 * `provider` limits the reset to one method; omit it to clear all.
 */
export async function resetPaymentNumbersForUid(
  uid: string,
  provider?: string | null,
): Promise<WalletResetResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { findProfileByUid } = await import("./telegram-slot.server");

  const profile = await findProfileByUid(String(uid ?? ""));
  if (!profile) return { ok: false, error: "এই UID দিয়ে কোনো একাউন্ট পাওয়া যায়নি।" };

  const p = (provider ?? "").toString().trim().toLowerCase();
  const only = PROVIDERS.includes(p as Provider) ? (p as Provider) : null;

  // Don't wipe the number while money is on the way to it.
  const { data: pending } = await supabaseAdmin
    .from("withdrawals")
    .select("id, provider")
    .eq("user_id", profile.id)
    .eq("status", "pending");
  const blocking = (pending ?? []).filter((w: any) => !only || w.provider === only);
  if (blocking.length) {
    return {
      ok: false,
      error: "এই একাউন্টে একটি উইথড্র রিকোয়েস্ট এখনো পেন্ডিং আছে — সেটি সম্পন্ন হওয়ার পর নম্বর রিসেট করা যাবে।",
    };
  }

  let q = supabaseAdmin.from("wallets").select("provider, number").eq("user_id", profile.id);
  if (only) q = q.eq("provider", only);
  const { data: rows } = await q;
  if (!rows?.length) {
    return { ok: false, error: "এই একাউন্টে সেভ করা কোনো পেমেন্ট নম্বর পাওয়া যায়নি।" };
  }

  let del = supabaseAdmin.from("wallets").delete().eq("user_id", profile.id);
  if (only) del = del.eq("provider", only);
  const { error } = await del;
  if (error) return { ok: false, error: "নম্বর রিসেট করা যায়নি, একটু পরে আবার চেষ্টা করুন।" };

  return {
    ok: true,
    name: profile.display_name || `UID ${profile.uid_seq}`,
    removed: rows.map((r: any) => ({ provider: r.provider as Provider, number: r.number as string })),
  };
}

/** Bengali confirmation line for the group. */
export function walletResetReply(res: WalletResetResult): string {
  if (!res.ok) return res.error;
  const list = res.removed.map((r) => `${LABEL[r.provider] ?? r.provider} (${mask(r.number)})`).join(", ");
  return (
    `✅ <b>${res.name}</b> এর সেভ করা পেমেন্ট নম্বর রিসেট করে দেওয়া হয়েছে — ${list}।\n` +
    `এখন অ্যাপের প্রোফাইল/উইথড্র পেজে গিয়ে সঠিক নম্বরটি নতুন করে যোগ করে নিন 💙`
  );
}

/** Read-only: which numbers are saved (masked). */
export async function listPaymentNumbers(uid: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { findProfileByUid } = await import("./telegram-slot.server");
  const profile = await findProfileByUid(String(uid ?? ""));
  if (!profile) return "এই UID দিয়ে কোনো একাউন্ট পাওয়া যায়নি।";
  const { data } = await supabaseAdmin
    .from("wallets").select("provider, number").eq("user_id", profile.id);
  if (!data?.length) return "এই একাউন্টে কোনো পেমেন্ট নম্বর সেভ করা নেই।";
  return data.map((r: any) => `${LABEL[r.provider as Provider] ?? r.provider}: ${mask(r.number)}`).join("\n");
}
