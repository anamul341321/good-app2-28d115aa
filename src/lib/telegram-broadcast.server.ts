// ব্রডকাস্ট সার্ভারেই চলতে থাকে — অ্যাডমিন প্যানেল বন্ধ করলেও পাঠানো থামে না।
import { createHmac, timingSafeEqual } from "crypto";

const BATCH_SIZE = 20;
const TIME_BUDGET_MS = 40_000;

export function campaignToken(campaignId: string) {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "";
  return createHmac("sha256", `broadcast:${key}`).update(campaignId).digest("base64url");
}

export function verifyCampaignToken(campaignId: string, token: string) {
  const a = Buffer.from(token);
  const b = Buffer.from(campaignToken(campaignId));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** নিজেকেই আবার ট্রিগার করে, যাতে বড় ব্রডকাস্ট background-এ শেষ পর্যন্ত চলে। */
export function kickBroadcast(campaignId: string, origin: string) {
  const url = `${origin.replace(/\/$/, "")}/api/public/broadcast/run`;
  void fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignId, token: campaignToken(campaignId) }),
  }).catch(() => {});
}

/**
 * এক রানে যতগুলো ব্যাচ সম্ভব পাঠায়। সময় শেষ হলে নিজেকেই আবার কল করে,
 * তাই অ্যাডমিন প্যানেল থেকে বেরিয়ে গেলেও কাজ চলতে থাকে।
 */
export async function runCampaign(campaignId: string, origin: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendMessage } = await import("@/lib/telegram-bot.server");
  const startedAt = Date.now();

  for (;;) {
    const { data: campaign } = await supabaseAdmin
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", campaignId)
      .maybeSingle();
    if (!campaign) return { status: "error" };
    const status = (campaign as any).status as string;
    if (status !== "pending" && status !== "sending") return { status };

    if (status === "pending") {
      await supabaseAdmin
        .from("broadcast_campaigns")
        .update({ status: "sending" })
        .eq("id", campaignId);
    }

    if ((campaign as any).target === "group") {
      const { data: s } = await supabaseAdmin
        .from("tg_bot_settings")
        .select("group_chat_id")
        .eq("id", "default")
        .maybeSingle();
      const chat = (s as any)?.group_chat_id;
      const res = chat ? await sendMessage(chat, (campaign as any).text) : null;
      await supabaseAdmin
        .from("broadcast_campaigns")
        .update({ status: "completed", sent_count: res ? 1 : 0, failed_count: res ? 0 : 1 })
        .eq("id", campaignId);
      return { status: "completed" };
    }

    let query = supabaseAdmin
      .from("profiles")
      .select("id, telegram_user_id")
      .not("telegram_user_id", "is", null)
      .order("id", { ascending: true });

    const uids = (campaign as any).target_uids as string[] | null;
    if ((campaign as any).target === "uid" && uids?.length) {
      query = query.in("uid_seq", uids.map((u) => Number(u)).filter((n) => Number.isFinite(n)));
    }
    if ((campaign as any).last_processed_id) {
      query = query.gt("id", (campaign as any).last_processed_id);
    }

    const { data: users } = await query.limit(BATCH_SIZE);
    if (!users || users.length === 0) {
      await supabaseAdmin
        .from("broadcast_campaigns")
        .update({ status: "completed" })
        .eq("id", campaignId);
      return { status: "completed" };
    }

    let sent = 0;
    let failed = 0;
    let lastId = (campaign as any).last_processed_id as string | null;
    for (const user of users as any[]) {
      try {
        const res = await sendMessage(user.telegram_user_id, (campaign as any).text);
        if (res) sent++;
        else failed++;
      } catch {
        failed++;
      }
      lastId = user.id;
      await new Promise((r) => setTimeout(r, 120));
    }

    await supabaseAdmin
      .from("broadcast_campaigns")
      .update({
        sent_count: ((campaign as any).sent_count || 0) + sent,
        failed_count: ((campaign as any).failed_count || 0) + failed,
        last_processed_id: lastId,
      })
      .eq("id", campaignId);

    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      kickBroadcast(campaignId, origin);
      return { status: "sending" };
    }
  }
}
