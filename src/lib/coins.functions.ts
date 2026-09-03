import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoinSummary = {
  balance: number;
  total_earned: number;
  today: number;
  watch_today: number;
  watch_daily_cap: number;
  telegram_joined: boolean;
};

export const getCoinSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("get_coin_summary", { _user_id: userId });
    if (error) throw new Error(error.message);
    return (data ?? {
      balance: 0,
      total_earned: 0,
      today: 0,
      watch_today: 0,
      watch_daily_cap: 9000,
      telegram_joined: false,
    }) as CoinSummary;
  });

export const awardCoinEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        event: z.enum(["reel", "post", "story", "comment", "message"]),
        referenceId: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await (supabase as any).rpc("award_coin_event", {
      _user_id: userId,
      _event: data.event,
      _reference_id: data.referenceId ?? null,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; awarded: number; capped: boolean; balance: number };
  });

export const claimWatchCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ seconds: z.number().int().min(0).max(600) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: result, error } = await (supabase as any).rpc("claim_watch_coins", {
      _user_id: userId,
      _seconds: data.seconds,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; awarded: number; capped?: boolean; balance?: number; error?: string };
  });

export const claimTelegramJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("claim_telegram_join", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; awarded: number; already: boolean; balance: number };
  });

export type CoinHistoryItem = {
  id: string;
  amount: number;
  reason: string;
  created_at: string;
};

export const getCoinHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("coin_ledger")
      .select("id, amount, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as CoinHistoryItem[];
  });

export type TelegramVerifyResult = {
  linked: boolean;
  member: boolean;
  awarded: number;
  already: boolean;
};

/** Real membership check: uses the linked Telegram account + bot getChatMember. */
export const verifyTelegramJoin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TelegramVerifyResult> => {
    const { supabase, userId } = context;

    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("telegram_user_id")
      .eq("id", userId)
      .maybeSingle();

    let tgId = Number(profile?.telegram_user_id ?? 0);
    if (!tgId) {
      const { data: sess } = await (supabase as any)
        .from("tg_sessions")
        .select("tg_user_id")
        .eq("app_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      tgId = Number(sess?.[0]?.tg_user_id ?? 0);
    }
    if (!tgId) return { linked: false, member: false, awarded: 0, already: false };

    const { isTelegramGroupMember } = await import("@/lib/telegram-membership.server");
    const member = await isTelegramGroupMember(tgId);
    if (!member) return { linked: true, member: false, awarded: 0, already: false };

    const { data, error } = await (supabase as any).rpc("claim_telegram_join", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { linked: true, member: true, awarded: Number(data?.awarded ?? 0), already: !!data?.already };
  });


export type TelegramUsernameClaimResult = {
  ok: boolean;
  awarded: number;
  already: boolean;
  error?: "not_found" | "not_member" | "duplicate" | "already_claimed";
};

/**
 * Username দিয়ে টেলিগ্রাম জয়েন ক্লেইম:
 * 1) username → tg_user_id (বট যে মেসেজগুলো দেখেছে সেখান থেকে)
 * 2) বট দিয়ে getChatMember — গ্রুপে আছে কি না
 * 3) ডুপ্লিকেট চেক — এই username দিয়ে আগে কেউ ক্লেইম করেছে কি না
 */
export const claimTelegramByUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ username: z.string().trim().min(3).max(64) }).parse(i),
  )
  .handler(async ({ data, context }): Promise<TelegramUsernameClaimResult> => {
    const { supabase, userId } = context;
    const uname = data.username.replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "").trim();
    const unameLc = uname.toLowerCase();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ১) ডুপ্লিকেট username চেক
    const { data: dup } = await (supabaseAdmin as any)
      .from("coin_telegram_claims")
      .select("user_id")
      .eq("username_lc", unameLc)
      .maybeSingle();
    if (dup && dup.user_id !== userId) {
      return { ok: false, awarded: 0, already: false, error: "duplicate" };
    }

    // ২) username → tg_user_id
    let tgId = 0;
    const { data: msgs } = await (supabaseAdmin as any)
      .from("tg_messages")
      .select("tg_user_id")
      .ilike("username", uname)
      .not("tg_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    tgId = Number(msgs?.[0]?.tg_user_id ?? 0);
    if (!tgId) {
      const { data: off } = await (supabaseAdmin as any)
        .from("tg_offenders")
        .select("tg_user_id")
        .ilike("username", uname)
        .limit(1);
      tgId = Number(off?.[0]?.tg_user_id ?? 0);
    }
    if (!tgId) {
      const { data: sess } = await (supabaseAdmin as any)
        .from("tg_sessions")
        .select("tg_user_id")
        .eq("app_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);
      tgId = Number(sess?.[0]?.tg_user_id ?? 0);
    }

    const { isTelegramGroupMember, resolveTelegramUsername } = await import(
      "@/lib/telegram-membership.server"
    );

    // গ্রুপে কখনো মেসেজ না করলেও পাবলিক username থেকে সরাসরি আইডি বের করি
    if (!tgId) tgId = await resolveTelegramUsername(uname);
    if (!tgId) return { ok: false, awarded: 0, already: false, error: "not_found" };

    // ৩) গ্রুপ মেম্বারশিপ যাচাই
    const member = await isTelegramGroupMember(tgId);
    if (!member) return { ok: false, awarded: 0, already: false, error: "not_member" };

    const { error: insErr } = await (supabaseAdmin as any)
      .from("coin_telegram_claims")
      .upsert(
        { user_id: userId, username_lc: unameLc, tg_user_id: tgId },
        { onConflict: "user_id" },
      );
    if (insErr && insErr.code === "23505") {
      return { ok: false, awarded: 0, already: false, error: "duplicate" };
    }

    const { data: result, error } = await (supabase as any).rpc("claim_telegram_join", {
      _user_id: userId,
    });
    if (error) throw new Error(error.message);
    return {
      ok: true,
      awarded: Number(result?.awarded ?? 0),
      already: !!result?.already,
    };
  });

export type DailyCheckin = {
  likes: number;
  comments: number;
  messages: number;
  need_likes: number;
  need_comments: number;
  need_messages: number;
  reward: number;
  claimed: boolean;
  eligible: boolean;
};

/** আজকের ডেইলি চেক-ইন প্রগ্রেস (৫ লাইক + ২ কমেন্ট + ৩ মেসেজ) */
export const getDailyCheckin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("get_daily_checkin", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as DailyCheckin;
  });

/** দিনে একবার ১০০০ কয়েন ক্লেইম */
export const claimDailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("claim_daily_checkin", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as { ok: boolean; awarded: number; already?: boolean; reason?: string; balance?: number; progress: DailyCheckin };
  });

export type AdCoinStatus = {
  coins_per_ad: number;
  ads_per_break: number;
  cooldown_seconds: number;
  daily_limit: number;
  today_count: number;
  streak: number;
  wait_seconds: number;
  can_watch: boolean;
};

/** অ্যাড দেখে কয়েন — বর্তমান অবস্থা (কতটি দেখা হয়েছে, কত সেকেন্ড অপেক্ষা) */
export const getAdCoinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("get_ad_coin_status", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as AdCoinStatus;
  });

/** একটি rewarded অ্যাড সম্পূর্ণ দেখা হলে ১০০০ কয়েন (সার্ভারেই লিমিট/কুলডাউন যাচাই) */
export const claimAdCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any).rpc("claim_ad_coins", { _user_id: userId });
    if (error) throw new Error(error.message);
    return data as {
      ok: boolean;
      awarded: number;
      balance?: number;
      error?: "cooldown" | "daily_limit";
      status: AdCoinStatus;
    };
  });
