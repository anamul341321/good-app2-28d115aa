// Server-only: verify whether a Telegram user is a member of the Good-App group.
// The bot must be a member/admin of the group for getChatMember to work.

export const GROUP_CHAT = "@goodappbuy";

export async function isTelegramGroupMember(tgUserId: number): Promise<boolean> {
  // গ্রুপে যে বট অ্যাডমিন সেটাই মেম্বারশিপ দেখতে পারে (TG_MOD_BOT_TOKEN)।
  const token = process.env["TG_MOD_BOT_TOKEN"] || process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: GROUP_CHAT, user_id: tgUserId }),
    });
    const json: any = await res.json();
    if (!res.ok || !json?.ok) {
      console.error("getChatMember failed", res.status, JSON.stringify(json));
      return false;
    }
    const status = json.result?.status as string | undefined;
    return status === "member" || status === "administrator" || status === "creator";
  } catch (e) {
    console.error("getChatMember error", e);
    return false;
  }
}
