// Server-only: pending/recent withdraw status card for the Telegram bot.

function bdt(n: number) {
  return `${Math.round(n).toLocaleString("en-US")}৳`;
}

function dhaka(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} মিনিট`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} ঘণ্টা ${mins % 60} মিনিট`;
  return `${Math.floor(h / 24)} দিন ${h % 24} ঘণ্টা`;
}

export type WithdrawStatus = { found: false } | { found: true; card: string };

export async function buildWithdrawStatusCard(uidRaw: string): Promise<WithdrawStatus> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { findProfileByUid } = await import("@/lib/telegram-slot.server");

  const profile = await findProfileByUid(uidRaw);
  if (!profile) return { found: false };

  const { data: rows } = await db
    .from("withdrawals")
    .select("amount, provider, status, created_at, processed_at, admin_note")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const list = rows ?? [];
  const pending = list.filter((w: any) => w.status === "pending");
  const recent = list.filter((w: any) => w.status !== "pending").slice(0, 3);

  // Average processing time across the last paid requests (all users).
  const { data: paidRows } = await db
    .from("withdrawals")
    .select("created_at, processed_at")
    .eq("status", "paid")
    .not("processed_at", "is", null)
    .order("processed_at", { ascending: false })
    .limit(50);
  const diffs = (paidRows ?? [])
    .map((w: any) => (new Date(w.processed_at).getTime() - new Date(w.created_at).getTime()) / 60000)
    .filter((m: number) => m > 0 && m < 60 * 48);
  const avg = diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;

  const head = `👤 <b>${profile.display_name || "ইউজার"}</b> — UID <code>${profile.uid_seq ?? uidRaw}</code>\n`;

  if (!pending.length) {
    return {
      found: true,
      card:
        head +
        `\n✅ এই মুহূর্তে আপনার <b>কোনো পেন্ডিং উইথড্র নেই</b>।\n` +
        (recent.length
          ? `\n<b>সর্বশেষ রিকোয়েস্ট:</b>\n` +
            recent
              .map(
                (w: any) =>
                  `   • ${bdt(Number(w.amount))} — ${w.status === "paid" ? "✅ পেইড" : "❌ বাতিল"} (${dhaka(
                    w.processed_at ?? w.created_at,
                  )})${w.admin_note ? `\n     📝 ${w.admin_note}` : ""}`,
              )
              .join("\n") + "\n"
          : "") +
        `\nনতুন করে উইথড্র দিলে এখানে জিজ্ঞেস করলেই আমি স্ট্যাটাস দেখে দেব 🙂`,
    };
  }

  const lines = pending.map(
    (w: any) =>
      `   • <b>${bdt(Number(w.amount))}</b> — ${String(w.provider).toUpperCase()}\n     🕒 রিকোয়েস্ট: ${dhaka(
        w.created_at,
      )} (${ago(w.created_at)} আগে)`,
  );

  return {
    found: true,
    card:
      head +
      `\n⏳ <b>পেন্ডিং উইথড্র (${pending.length}টি)</b>\n` +
      lines.join("\n") +
      `\n\n💵 মোট পেন্ডিং: <b>${bdt(pending.reduce((s: number, w: any) => s + Number(w.amount || 0), 0))}</b>\n` +
      (avg !== null
        ? `⌛ গড়ে পেমেন্ট হতে সময় লাগে: <b>${avg < 60 ? `${avg} মিনিট` : `${Math.round(avg / 60)} ঘণ্টা`}</b>\n`
        : "") +
      `\nএকটু অপেক্ষা করুন 🙏 পেমেন্ট প্রসেসিং-এ আছে, খুব শীঘ্রই আপনার নাম্বারে টাকা চলে যাবে ✅`,
  };
}
