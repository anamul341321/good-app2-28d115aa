// Telegram bot webhook — receives group messages, moderates + auto-replies.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          getBotToken, webhookSecretFor, sendMessage, deleteMessage,
          restrictUser, getPhotoBase64, decide, faqImageBase64,
        } = await import("@/lib/telegram-bot.server");

        let expected: string;
        try {
          expected = webhookSecretFor(getBotToken());
        } catch {
          return new Response("bot not configured", { status: 503 });
        }
        const supplied = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (supplied !== expected) return new Response("unauthorized", { status: 401 });

        const update: any = await request.json().catch(() => null);
        const msg = update?.message ?? update?.edited_message;
        if (!msg?.chat?.id || typeof update?.update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }
        if (msg.from?.is_bot) return Response.json({ ok: true, ignored: "bot" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: settings } = await supabaseAdmin
          .from("tg_bot_settings").select("*").eq("id", "default").maybeSingle();
        if (!settings?.enabled) return Response.json({ ok: true, disabled: true });

        const chatId = String(msg.chat.id);
        if (settings.group_chat_id && settings.group_chat_id !== chatId) {
          return Response.json({ ok: true, ignored: "other-chat" });
        }

        const text: string = msg.text ?? msg.caption ?? "";
        const photos = msg.photo as { file_id: string }[] | undefined;
        const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ")
          || msg.from?.username || "User";

        // Idempotency: skip if this update was already stored.
        const { data: seen } = await supabaseAdmin
          .from("tg_messages").select("update_id").eq("update_id", update.update_id).maybeSingle();
        if (seen) return Response.json({ ok: true, duplicate: true });

        const bannedWords: string[] = settings.banned_words ?? [];
        const lower = text.toLowerCase();
        const hardHit = bannedWords.find((w) => w && lower.includes(w.toLowerCase()));

        const { data: faqRows } = await supabaseAdmin
          .from("tg_faq").select("topic, answer, keywords, image_path").eq("is_active", true)
          .order("priority", { ascending: false }).order("id");

        let photoBase64: string | null = null;
        if (settings.photo_analysis_enabled && photos?.length) {
          photoBase64 = await getPhotoBase64(photos[photos.length - 1].file_id);
        }

        // Reference screenshots are only loaded when the user actually sent a photo.
        const faq: any[] = [];
        let imgBudget = 6;
        for (const f of faqRows ?? []) {
          let imageBase64: string | null = null;
          if (photoBase64 && (f as any).image_path && imgBudget > 0) {
            imageBase64 = await faqImageBase64((f as any).image_path);
            if (imageBase64) imgBudget--;
          }
          faq.push({ topic: f.topic, answer: f.answer, keywords: (f as any).keywords, imageBase64 });
        }

        let decision = {
          verdict: "ok" as const, reply: null as string | null,
          should_delete: false, should_warn: false, uid: null as string | null,
          needs_uid: false,
        } as Awaited<ReturnType<typeof decide>>;

        if (hardHit) {
          decision = {
            verdict: "abuse", reply: null,
            should_delete: !!settings.delete_bad_messages, should_warn: true, uid: null,
            needs_uid: false,
          };
        } else if (text.trim() || photoBase64) {
          try {
            decision = await decide({
              persona: settings.persona,
              rules: settings.rules,
              faq,
              bannedWords,
              text,
              photoBase64,
              senderName,
            });
          } catch (e) {
            console.error("[tg] decide failed", e);
          }
        }


        const actions: string[] = [];

        if (settings.moderation_enabled && decision.should_delete && settings.delete_bad_messages) {
          await deleteMessage(chatId, msg.message_id);
          actions.push("deleted");
        }

        let banRequested = false;
        let matchedUid: string | null = decision.uid;
        let appUserId: string | null = null;

        if (settings.moderation_enabled && decision.should_warn && msg.from?.id) {
          const { data: off } = await supabaseAdmin
            .from("tg_offenders").select("warn_count").eq("tg_user_id", msg.from.id).maybeSingle();
          const warnCount = (off?.warn_count ?? 0) + 1;
          await supabaseAdmin.from("tg_offenders").upsert({
            tg_user_id: msg.from.id,
            username: msg.from.username ?? null,
            full_name: senderName,
            warn_count: warnCount,
            last_reason: decision.verdict,
            last_offense_at: new Date().toISOString(),
          });
          actions.push(`warn:${warnCount}`);

          await sendMessage(
            chatId,
            `⚠️ <b>${senderName}</b>, আপনার মেসেজটি গ্রুপের নিয়মভঙ্গ করেছে (${decision.verdict}).\nসতর্কতা: <b>${warnCount}/${settings.warn_threshold}</b>`,
            msg.message_id,
          );

          if (warnCount >= settings.warn_threshold) {
            await restrictUser(chatId, msg.from.id, 60 * 60);
            actions.push("muted-1h");

            // Try to match the offender to an app account.
            if (!matchedUid) {
              const { data: linked } = await supabaseAdmin
                .from("profiles").select("id, uid_seq").eq("telegram_user_id", msg.from.id).maybeSingle();
              if (linked) { appUserId = linked.id; matchedUid = String(linked.uid_seq ?? ""); }
            }
            if (!appUserId && matchedUid && /^\d+$/.test(matchedUid)) {
              const { data: byUid } = await supabaseAdmin
                .from("profiles").select("id").eq("uid_seq", Number(matchedUid)).maybeSingle();
              if (byUid) appUserId = byUid.id;
            }

            const { data: existing } = await supabaseAdmin
              .from("tg_ban_requests").select("id")
              .eq("tg_user_id", msg.from.id).eq("status", "pending").maybeSingle();
            if (!existing) {
              await supabaseAdmin.from("tg_ban_requests").insert({
                tg_user_id: msg.from.id,
                username: msg.from.username ?? null,
                full_name: senderName,
                reason: `${decision.verdict} — ${warnCount} বার নিয়মভঙ্গ`,
                evidence: text.slice(0, 500),
                matched_uid: matchedUid,
                app_user_id: appUserId,
              });
              banRequested = true;
              actions.push("ban-requested");
            }

            const adminChat = settings.admin_chat_id || settings.group_chat_id || chatId;
            await sendMessage(
              adminChat,
              `🚨 <b>Ban approval দরকার</b>\n` +
                `${settings.admin_mention ? settings.admin_mention + "\n" : ""}` +
                `ইউজার: <b>${senderName}</b>${msg.from.username ? ` (@${msg.from.username})` : ""}\n` +
                `Telegram ID: <code>${msg.from.id}</code>\n` +
                `App UID: <code>${matchedUid || "পাওয়া যায়নি"}</code>\n` +
                `কারণ: ${decision.verdict} — ${warnCount} বার\n\n` +
                `Admin panel → Telegram Bot → Ban requests থেকে approve করুন।`,
            );
          }
        }

        if (settings.auto_reply_enabled && decision.reply && !decision.should_delete) {
          await sendMessage(chatId, decision.reply, msg.message_id);
          actions.push("replied");
        }

        await supabaseAdmin.from("tg_messages").insert({
          update_id: update.update_id,
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          tg_user_id: msg.from?.id ?? null,
          username: msg.from?.username ?? null,
          full_name: senderName,
          text: text.slice(0, 2000),
          has_photo: !!photos?.length,
          verdict: decision.verdict,
          action: actions.join(",") || "none",
          bot_reply: decision.reply,
          matched_uid: matchedUid,
        });

        return Response.json({ ok: true, verdict: decision.verdict, actions, banRequested });
      },
    },
  },
});
