import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function adminGate() {
  const { requireAdminSession } = await import("@/lib/admin-session.server");
  await requireAdminSession();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const adminListCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseAdmin = await adminGate();
  const { data, error } = await supabaseAdmin
    .from("broadcast_campaigns")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminCreateCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        text: z.string().min(1).max(3500),
        target: z.enum(["dm", "group", "uid"]),
        uids: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminGate();

    let total = 0;
    let targetUids: string[] | null = null;

    if (data.target === "uid") {
      const list = (data.uids ?? "")
        .split(/[\s,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (list.length === 0) throw new Error("কমপক্ষে একটি UID দিন");
      targetUids = list;
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("telegram_user_id", "is", null)
        .in("uid_seq", list.map((u) => Number(u)).filter((n) => Number.isFinite(n)));
      total = count ?? 0;
      if (total === 0) throw new Error("এই UID গুলোর কেউ Telegram লিংক করা নেই");
    } else if (data.target === "dm") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("telegram_user_id", "is", null);
      total = count ?? 0;
    } else {
      total = 1;
    }

    const { data: campaign, error } = await supabaseAdmin
      .from("broadcast_campaigns")
      .insert({
        text: data.text,
        target: data.target,
        target_uids: targetUids,
        status: "pending",
        total_users: total,
        sent_count: 0,
        failed_count: 0,
      } as any)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return campaign;
  });

export const adminProcessBroadcast = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ campaignId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminGate();
    const { sendMessage } = await import("@/lib/telegram-bot.server");

    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();

    if (cErr || !campaign || (campaign.status !== "pending" && campaign.status !== "sending")) {
      return { status: (campaign as any)?.status ?? "error" };
    }

    if (campaign.status === "pending") {
      await supabaseAdmin.from("broadcast_campaigns").update({ status: "sending" }).eq("id", data.campaignId);
    }

    if (campaign.target === "group") {
      const { data: s } = await supabaseAdmin
        .from("tg_bot_settings")
        .select("group_chat_id")
        .eq("id", "default")
        .maybeSingle();
      const chat = (s as any)?.group_chat_id;
      const res = chat ? await sendMessage(chat, campaign.text) : null;
      await supabaseAdmin
        .from("broadcast_campaigns")
        .update({ status: "completed", sent_count: res ? 1 : 0, failed_count: res ? 0 : 1 })
        .eq("id", data.campaignId);
      return { status: "completed" };
    }

    const BATCH_SIZE = 20;
    let query = supabaseAdmin
      .from("profiles")
      .select("id, telegram_user_id")
      .not("telegram_user_id", "is", null)
      .order("id", { ascending: true });

    const uids = (campaign as any).target_uids as string[] | null;
    if (campaign.target === "uid" && uids?.length) {
      query = query.in("uid_seq", uids.map((u) => Number(u)).filter((n) => Number.isFinite(n)));
    }

    if (campaign.last_processed_id) query = query.gt("id", campaign.last_processed_id);

    const { data: users } = await query.limit(BATCH_SIZE);

    if (!users || users.length === 0) {
      await supabaseAdmin.from("broadcast_campaigns").update({ status: "completed" }).eq("id", data.campaignId);
      return { status: "completed" };
    }

    let batchSent = 0;
    let batchFailed = 0;
    let lastId = campaign.last_processed_id;

    for (const user of users) {
      try {
        const res = await sendMessage((user as any).telegram_user_id, campaign.text);
        if (res) batchSent++;
        else batchFailed++;
      } catch {
        batchFailed++;
      }
      lastId = user.id;
      await new Promise((r) => setTimeout(r, 100));
    }

    await supabaseAdmin
      .from("broadcast_campaigns")
      .update({
        sent_count: (campaign.sent_count || 0) + batchSent,
        failed_count: (campaign.failed_count || 0) + batchFailed,
        last_processed_id: lastId,
      })
      .eq("id", data.campaignId);

    return { status: "sending", processed: users.length };
  });

export const adminUpdateCampaignStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ campaignId: z.string().uuid(), status: z.enum(["paused", "cancelled", "pending"]) }).parse(i),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await adminGate();
    const { error } = await supabaseAdmin
      .from("broadcast_campaigns")
      .update({ status: data.status })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
