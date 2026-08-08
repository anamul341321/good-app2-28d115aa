// Server-only: admin alerts. Sends to the private admin chat AND to the
// Telegram group with the admin mentioned, so nothing gets missed.

export async function alertAdminGroup(message: string): Promise<void> {
  // 1) Private admin chat (existing behaviour)
  try {
    const { sendTelegram } = await import("./telegram.server");
    await sendTelegram(message);
  } catch {
    // never block the caller
  }

  // 2) Group chat with @mention
  try {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: s } = await db
      .from("tg_bot_settings")
      .select("group_chat_id, admin_chat_id, admin_mention")
      .eq("id", "default")
      .maybeSingle();

    const mention = ((s as any)?.admin_mention ?? "").trim();
    const targets = [ (s as any)?.group_chat_id, (s as any)?.admin_chat_id ]
      .map((v: any) => (v ? String(v).trim() : ""))
      .filter(Boolean);
    if (targets.length === 0) return;

    const token = process.env.TG_MOD_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const text = `${mention ? `${mention} ` : ""}${message}`;
    for (const chat_id of targets) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      if (!res.ok) console.error("alertAdminGroup failed", res.status, await res.text());
    }
  } catch (e) {
    console.error("alertAdminGroup error", e);
  }
}
