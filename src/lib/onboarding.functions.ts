import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * অ্যাপে ঢোকার আগে একবার "শুরু করুন" চাপতে হবে। ওই এক ক্লিকেই
 * টেলিগ্রাম বট Start হয় ও ইউজারের telegram + UID লিংক হয়ে যায়।
 * টেলিগ্রাম না থাকলে "টেলিগ্রাম নেই" চেপে ইউজার এমনিতেই ঢুকতে পারবে।
 */
export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: prof } = await supabase
      .from("profiles")
      .select("uid_seq, onboarded_at, telegram_user_id, tg_link_skipped, display_name")
      .eq("id", userId)
      .maybeSingle();

    const p = (prof ?? {}) as {
      uid_seq?: number | null;
      onboarded_at?: string | null;
      telegram_user_id?: number | null;
      tg_link_skipped?: boolean | null;
      display_name?: string | null;
    };

    const { data: ann } = await supabase
      .from("announcements")
      .select("message")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // বট username নিয়ে ডিপ-লিংক বানাই — লিংকে UID থাকায় বট নিজেই চিনে নেবে।
    let botUrl: string | null = null;
    try {
      const { getMe } = await import("@/lib/telegram-bot.server");
      const me = await getMe();
      if (me?.username) {
        botUrl = `https://t.me/${me.username}?start=${p.uid_seq ? `uid_${p.uid_seq}` : "app"}`;
      }
    } catch {
      botUrl = null;
    }

    return {
      needsStart: !p.onboarded_at,
      linked: !!p.telegram_user_id,
      name: p.display_name ?? null,
      uid: p.uid_seq != null ? String(p.uid_seq) : null,
      notice: ((ann as { message?: string } | null)?.message ?? null) as string | null,
      botUrl,
    };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ mode: z.literal("telegram") }).parse(i),
  )
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("profiles")
      .update({
        onboarded_at: new Date().toISOString(),
        tg_link_skipped: false,
      })
      .eq("id", userId);
    return { ok: true as const };
  });
