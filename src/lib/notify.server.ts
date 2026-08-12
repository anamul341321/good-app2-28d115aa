// একই জায়গা থেকে ইউজারকে in-app নোটিশ + ফোনের push দুটোই পাঠানো হয়।
export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  opts?: { url?: string; skipNotice?: boolean },
) {
  try {
    if (!opts?.skipNotice) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("user_notices").insert({ user_id: userId, title, body } as any);
    }
  } catch (e) {
    console.error("[notify] notice insert failed", e);
  }
  try {
    const { sendPushToUser } = await import("@/lib/push.server");
    await sendPushToUser(userId, { title, body, url: opts?.url });
  } catch (e) {
    console.error("[notify] push failed", e);
  }
}
