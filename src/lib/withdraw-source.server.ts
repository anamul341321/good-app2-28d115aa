/**
 * Server-only: "এই withdraw-এর টাকা কোথা থেকে এলো?" card for the Telegram bot.
 *
 * The owner can tap the 🔍 button on a fast-pay card (or ask the bot with a UID)
 * and the bot checks the database — bonus, mining, referral commission, admin
 * credit, অন্য user-এর পাঠানো টাকা — then replies with a short verdict.
 */

function bdt(n: number) {
  return `${Math.round(n).toLocaleString("en-US")}৳`;
}

export async function buildWithdrawSourceCard(opts: {
  withdrawalId?: string;
  uid?: string;
}): Promise<string> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  let userId: string | null = null;
  let amount: number | null = null;

  if (opts.withdrawalId) {
    const { data: w } = await db
      .from("withdrawals")
      .select("user_id, amount, provider, status, wallet_number")
      .eq("id", opts.withdrawalId)
      .maybeSingle();
    if (!w) return "❌ এই withdraw রিকোয়েস্টটি পাওয়া যায়নি।";
    userId = String((w as any).user_id);
    amount = Number((w as any).amount);
  } else if (opts.uid) {
    const { findProfileByUid } = await import("@/lib/telegram-slot.server");
    const p = await findProfileByUid(opts.uid);
    if (!p) return "❌ এই UID-এর ইউজার পাওয়া যায়নি।";
    userId = p.id;
  }
  if (!userId) return "❌ ইউজার খুঁজে পাইনি।";

  const { data: prof } = await db
    .from("profiles")
    .select("uid_seq, display_name, kyc_verified, banned, balance_frozen")
    .eq("id", userId)
    .maybeSingle();

  const { buildEarningsBreakdown } = await import("@/lib/earnings-breakdown.server");
  let b: any;
  try {
    b = await buildEarningsBreakdown(db, userId);
  } catch (e: any) {
    console.error("earnings breakdown failed", e);
    b = null;
  }

  let adminCredited = 0;
  try {
    const { data: creditRows } = await db.from("admin_credits").select("amount").eq("user_id", userId);
    adminCredited = (creditRows ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  } catch {
    adminCredited = 0;
  }

  const { data: paidRows } = await db
    .from("withdrawals")
    .select("amount")
    .eq("user_id", userId)
    .eq("status", "paid");
  const paidSum = (paidRows ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

  const headBase =
    `🔍 <b>টাকার উৎস</b> — ${(prof as any)?.display_name ?? "User"} · UID <code>${(prof as any)?.uid_seq ?? opts.uid ?? "—"}</code>\n` +
    (amount !== null ? `💸 এই রিকোয়েস্ট: <b>${bdt(amount)}</b>\n` : "");

  if (!b) {
    return (
      headBase +
      `\n🧾 আগে পেইড হয়েছে: <b>${bdt(paidSum)}</b>\n` +
      (adminCredited > 0 ? `⚠️ অ্যাডমিন ম্যানুয়ালি দিয়েছে: <b>${bdt(adminCredited)}</b>\n` : "") +
      `\n⚠️ বিস্তারিত হিসাব এই মুহূর্তে বের করা যায়নি — Admin প্যানেলে ইউজারের Details দেখুন।`
    );
  }


  const flags: string[] = [];
  if (b.transfersInTotal > 0) {
    const froms = b.transfersIn
      .slice(0, 4)
      .map((t) => `UID ${t.uid ?? "—"} (${bdt(t.amount)})`)
      .join(", ");
    flags.push(`⚠️ অন্য ইউজারের পাঠানো টাকা আছে — ${bdt(b.transfersInTotal)} · ${froms}`);
  }
  if (adminCredited > 0) flags.push(`⚠️ অ্যাডমিন ম্যানুয়ালি দিয়েছে — ${bdt(adminCredited)}`);
  if (!(prof as any)?.kyc_verified) flags.push("⚠️ KYC ভেরিফাইড নয়");
  if ((prof as any)?.banned) flags.push("🚫 অ্যাকাউন্ট ব্যান করা");
  if ((prof as any)?.balance_frozen) flags.push("🧊 ব্যালেন্স ফ্রিজ করা");

  const realEarned = b.bonus.total + b.mining.total;
  if (amount !== null && paidSum + amount > realEarned + 1) {
    flags.push(
      `⚠️ মোট withdraw (${bdt(paidSum + amount)}) নিজের আয় (${bdt(realEarned)})-এর চেয়ে বেশি`,
    );
  }

  const head =
    `🔍 <b>টাকার উৎস</b> — ${(prof as any)?.display_name ?? "User"} · UID <code>${(prof as any)?.uid_seq ?? opts.uid ?? "—"}</code>\n` +
    (amount !== null ? `💸 এই রিকোয়েস্ট: <b>${bdt(amount)}</b>\n` : "");

  const body =
    `\n<b>নিজের আয়ের হিসাব</b>\n` +
    `   • 🎁 বোনাস (main balance): <b>${bdt(b.bonus.total)}</b>\n` +
    `      – ফার্স্ট ভেরিফাই: ${bdt(b.bonus.selfFirst)}\n` +
    `      – রি-ভেরিফাই: ${bdt(b.bonus.selfReverify)}\n` +
    `      – রেফার বোনাস (${b.bonus.referrerPaidCount} জন): ${bdt(b.bonus.referrerTotal)}\n` +
    (b.bonus.otherTotal ? `      – অন্যান্য: ${bdt(b.bonus.otherTotal)}\n` : "") +
    `   • ⛏️ মাইনিং: <b>${bdt(b.mining.total)}</b> (নিজের ${bdt(b.mining.selfTotal)} · রেফার ১০% ${bdt(
      b.mining.referralTotal,
    )})\n` +
    `      – স্লট ${b.mining.selfSlots}টি · মাসিক ~${bdt(b.mining.monthlyTotal)} · চালু ${b.mining.daysRunning} দিন\n` +
    `   • 🧾 আগে পেইড হয়েছে: ${bdt(paidSum)}\n` +
    `   • ✅ মোট নিজের আয়: <b>${bdt(realEarned)}</b>\n`;

  const verdict = flags.length
    ? `\n<b>যাচাই</b>\n${flags.map((f) => `   ${f}`).join("\n")}\n\n🤔 পেমেন্টের আগে একটু দেখে নিন।`
    : `\n✅ সব হিসাব ঠিক আছে — টাকাটা নিজের ভেরিফাই/মাইনিং থেকেই এসেছে। নিশ্চিন্তে পেমেন্ট দিতে পারেন।`;

  return head + body + verdict;
}
