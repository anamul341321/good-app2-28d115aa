import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * অ্যাপ থেকে এক ক্লিকে বট চালু (start) করার ডিপ-লিংক তৈরি করে।
 * লিংকে UID পাঠানো হয়, তাই বট নিজেই ইউজারকে চিনে নেবে।
 */
export const getBotStartLink = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { getMe } = await import("@/lib/telegram-bot.server");
    const me = await getMe().catch(() => null);
    if (!me?.username) return { url: null as string | null };

    const { data: prof } = await supabase
      .from("profiles").select("uid_seq").eq("id", userId).maybeSingle();
    const uid = (prof as { uid_seq?: number | null } | null)?.uid_seq;
    const payload = uid ? `?start=uid_${uid}` : "?start=app";
    return { url: `https://t.me/${me.username}${payload}` };
  });
