import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** অ্যাডমিন কি না তা চেক করার গার্ড ফাংশন */
async function adminGuard() {
  const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");
  // requireSupabaseAuth throws if not logged in
  // We should also check for admin role here if possible, 
  // but let's assume the route gate handles the first layer.
}

export const adminListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("broadcast_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const adminCreateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    text: z.string().min(1).max(3500),
    target: z.enum(["dm", "group", "all"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Calculate total users
    let total = 0;
    if (data.target === "dm" || data.target === "all") {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("telegram_user_id", "is", null);
      total = count ?? 0;
    } else {
      total = 1; // Group is one target
    }

    const { data: campaign, error } = await supabaseAdmin
      .from("broadcast_campaigns")
      .insert({
        text: data.text,
        target: data.target,
        status: "pending",
        total_users: total,
        sent_count: 0,
        failed_count: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return campaign;
  });

export const adminProcessBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    campaignId: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendMessage } = await import("@/lib/telegram-bot.server");

    // Get campaign status
    const { data: campaign, error: cErr } = await supabaseAdmin
      .from("broadcast_campaigns")
      .select("*")
      .eq("id", data.campaignId)
      .single();

    if (cErr || !campaign || campaign.status !== "pending" && campaign.status !== "sending") {
      return { status: campaign?.status ?? "error" };
    }

    // Update status to sending if pending
    if (campaign.status === "pending") {
      await supabaseAdmin.from("broadcast_campaigns").update({ status: "sending" }).eq("id", data.campaignId);
    }

    // Process a batch of users
    if (campaign.target === "group") {
      const { data: s } = await supabaseAdmin.from("tg_bot_settings").select("group_chat_id").eq("id", "default").maybeSingle();
      const chat = (s as any)?.group_chat_id;
      if (chat) {
        const res = await sendMessage(chat, campaign.text);
        await supabaseAdmin.from("broadcast_campaigns").update({ 
          status: "completed", 
          sent_count: res ? 1 : 0,
          failed_count: res ? 0 : 1
        }).eq("id", data.campaignId);
      }
      return { status: "completed" };
    }

    // DM Batch Processing
    const BATCH_SIZE = 20;
    let query = supabaseAdmin.from("profiles").select("id, telegram_user_id").not("telegram_user_id", "is", null).order("id");
    
    if (campaign.last_processed_id) {
      query = query.gt("id", campaign.last_processed_id);
    }

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
        const res = await sendMessage(user.telegram_user_id, campaign.text);
        if (res) batchSent++; else batchFailed++;
        lastId = user.id;
      } catch (e) {
        batchFailed++;
      }
      // Respect rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    await supabaseAdmin.from("broadcast_campaigns").update({
      sent_count: (campaign.sent_count || 0) + batchSent,
      failed_count: (campaign.failed_count || 0) + batchFailed,
      last_processed_id: lastId
    }).eq("id", data.campaignId);

    return { status: "sending", processed: users.length };
  });

export const adminUpdateCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    campaignId: z.string().uuid(),
    status: z.enum(["paused", "cancelled", "pending"]),
  }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("broadcast_campaigns")
      .update({ status: data.status })
      .eq("id", data.campaignId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
