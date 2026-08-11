/**
 * Fast-pay from Telegram — server only.
 *
 * When a user creates a withdraw request the bot pushes a card to the admin
 * chat/group with two inline buttons: "✅ পেমেন্ট দিয়েছি" and "❌ বাতিল + ফেরত".
 * The admin never has to open the admin panel, so payouts go out much faster.
 */

type Btn = { text: string; callback_data?: string; url?: string };

async function tgApi(method: string, body: Record<string, unknown>) {
  const token = process.env["TG_MOD_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function botSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("tg_bot_settings")
    .select("group_chat_id, admin_chat_id, admin_mention")
    .eq("id", "default")
    .maybeSingle();
  return (data ?? {}) as { group_chat_id?: string; admin_chat_id?: string; admin_mention?: string };
}

/** Owner's private chat only — withdraw কার্ড কখনো গ্রুপে যাবে না। */
export async function ownerPrivateChatIds(): Promise<string[]> {
  const s = await botSettings();
  const group = String(s.group_chat_id ?? "").trim();
  const ids = [String(s.admin_chat_id ?? "").trim(), String(process.env["TELEGRAM_CHAT_ID"] ?? "").trim()]
    .filter(Boolean)
    .filter((id) => id !== group && !id.startsWith("-")); // "-" = group/channel
  return Array.from(new Set(ids));
}

/** Telegram admin → admin-panel-এ যে নামে paid দেখাবে। */
export async function payerName(from: any): Promise<string> {
  const s = await botSettings();
  const mention = String(s.admin_mention ?? "").replace(/^@/, "").toLowerCase();
  const uname = String(from?.username ?? "").toLowerCase();
  if (uname === "anamulmunni" || (mention && uname && uname === mention)) return "anamul";
  return (
    (from?.username ? `@${from.username}` : [from?.first_name, from?.last_name].filter(Boolean).join(" ")) ||
    "Telegram Admin"
  );
}

/** Only the owner/admin may press the pay buttons. */
export async function canFastPay(from: any, chatId: number | string): Promise<boolean> {
  const s = await botSettings();
  const mention = String(s.admin_mention ?? "").replace(/^@/, "").toLowerCase();
  const uname = String(from?.username ?? "").toLowerCase();
  if (uname === "anamulmunni") return true;
  if (mention && uname && mention === uname) return true;
  if (s.admin_chat_id && String(from?.id ?? "") === String(s.admin_chat_id).trim()) return true;
  try {
    const { isChatAdmin } = await import("@/lib/telegram-bot.server");
    return await isChatAdmin(chatId as any, from?.id);
  } catch {
    return false;
  }
}

function grossOf(payout: number, note: string | null) {
  const m = /Gross\s+([\d.]+)/.exec(String(note ?? ""));
  return m ? Number(m[1]) : Math.round(payout / (payout < 90 ? 0.8 : 0.9));
}


/** Push the fast-pay card for one pending withdrawal. */
export async function sendFastPayCard(withdrawalId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: w } = await supabaseAdmin
    .from("withdrawals")
    .select("id, user_id, amount, provider, wallet_number, status, admin_note, created_at")
    .eq("id", withdrawalId)
    .maybeSingle();
  if (!w || w.status !== "pending") return;

  const { data: p } = await supabaseAdmin
    .from("profiles")
    .select("uid_seq, display_name, kyc_verified, phone_number")
    .eq("id", w.user_id)
    .maybeSingle();

  const payout = Math.floor(Number(w.amount));
  const gross = grossOf(Number(w.amount), (w as any).admin_note);
  const fee = Math.max(0, Math.round(gross - Number(w.amount)));
  const num = String((w as any).wallet_number ?? "");
  const method = String((w as any).provider ?? "").toUpperCase();

  const text =
    `💸 <b>নতুন উইথড্র রিকোয়েস্ট</b>\n` +
    `👤 ${(p as any)?.display_name ?? "User"} · UID <code>${(p as any)?.uid_seq ?? "—"}</code> · KYC ${(p as any)?.kyc_verified ? "✅" : "❌"}\n` +
    `🏦 <b>${method}</b>\n` +
    `📱 <code>${num}</code>  <i>(ট্যাপ করলেই কপি হবে)</i>\n` +
    `💰 পাঠাতে হবে: <b>${payout}৳</b>  <i>(Gross ${Math.round(gross)}৳ · ফি ${fee}৳)</i>\n\n` +
    `টাকা পাঠিয়ে নিচের বাটনে চাপ দিন 👇`;

  const keyboard: Btn[][] = [
    [
      { text: `✅ ${payout}৳ পেমেন্ট দিয়েছি`, callback_data: `wd:paid:${w.id}` },
      { text: "❌ বাতিল + ফেরত", callback_data: `wd:rej:${w.id}` },
    ],
    [{ text: "🌐 Admin প্যানেল", url: "https://good-app2.lovable.app/admin/withdrawals" }],
  ];

  const s = await botSettings();
  const targets = [s.admin_chat_id, s.group_chat_id].map((v) => (v ? String(v).trim() : "")).filter(Boolean);
  const seen = new Set<string>();
  for (const chat_id of targets) {
    if (seen.has(chat_id)) continue;
    seen.add(chat_id);
    await tgApi("sendMessage", {
      chat_id,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}

/**
 * Handle a `wd:*` inline-button press. Returns true when the update was a
 * fast-pay callback (so the webhook can stop processing it).
 */
export async function handleFastPayCallback(update: any): Promise<boolean> {
  const cq = update?.callback_query;
  const data = String(cq?.data ?? "");
  if (!cq || !/^wd:(paid|rej):/.test(data)) return false;

  const answer = (text: string) => tgApi("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert: true });
  const chatId = cq.message?.chat?.id;

  if (!(await canFastPay(cq.from, chatId))) {
    await answer("এই বাটন শুধু অ্যাডমিনের জন্য।");
    return true;
  }

  const [, action, id] = data.split(":");
  const { processWithdrawalFast } = await import("@/lib/withdraw-process.server");
  const by =
    (cq.from?.username ? `@${cq.from.username}` : [cq.from?.first_name, cq.from?.last_name].filter(Boolean).join(" ")) ||
    "Telegram Admin";

  const res = await processWithdrawalFast({
    id: String(id),
    action: action === "paid" ? "paid" : "rejected",
    by,
    reason: action === "paid" ? undefined : "অ্যাডমিন বাতিল করেছেন — টাকা ব্যালেন্সে ফেরত দেওয়া হয়েছে",
  });

  await answer(res.message);

  if (res.ok && chatId && cq.message?.message_id) {
    const stamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
    const badge =
      action === "paid"
        ? `\n\n✅ <b>PAID</b> — ${by} · ${stamp}`
        : `\n\n❌ <b>বাতিল + ফেরত</b> — ${by} · ${stamp}`;
    await tgApi("editMessageText", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      text: `${cq.message.text ?? ""}${badge}`.replace(/টাকা পাঠিয়ে নিচের বাটনে চাপ দিন 👇/, ""),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }

  return true;
}
