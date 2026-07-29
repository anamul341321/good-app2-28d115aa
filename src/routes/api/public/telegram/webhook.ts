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

        // ---- helpers for the guided slot-reset conversation -------------------
        const bnDigits = (s: string) =>
          s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
        const norm = bnDigits(text).trim();
        const pickUid = (s: string): string | null => {
          const num = s.match(/\b(\d{1,9})\b/);
          if (num) return num[1];
          const code = s.match(/\b([A-Za-z0-9]{7})\b/);
          return code ? code[1].toUpperCase() : null;
        };
        const pickSlot = (s: string): number | null => {
          const m2 = s.match(/\b([1-9]|10)\b/);
          return m2 ? Number(m2[1]) : null;
        };
        const isCancel = /(বাতিল|cancel|থাক|লাগবে না)/i.test(norm);

        const logMessage = async (verdict: string, action: string, reply: string | null, uid: string | null) => {
          await supabaseAdmin.from("tg_messages").insert({
            update_id: update.update_id,
            chat_id: msg.chat.id,
            message_id: msg.message_id,
            tg_user_id: msg.from?.id ?? null,
            username: msg.from?.username ?? null,
            full_name: senderName,
            text: text.slice(0, 2000),
            has_photo: !!photos?.length,
            verdict,
            action,
            bot_reply: reply,
            matched_uid: uid,
          });
        };

        const clearSession = async () => {
          if (!msg.from?.id) return;
          await supabaseAdmin.from("tg_sessions").delete()
            .eq("tg_user_id", msg.from.id).eq("chat_id", msg.chat.id);
        };
        const saveSession = async (row: Record<string, unknown>) => {
          await supabaseAdmin.from("tg_sessions").upsert({
            tg_user_id: msg.from!.id,
            chat_id: msg.chat.id,
            intent: "slot_reset",
            expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            ...row,
          } as any, { onConflict: "tg_user_id,chat_id" });
        };

        const doReset = async (uid: string, slot: number) => {
          const { resetSlotForUid } = await import("@/lib/telegram-slot.server");
          const res = await resetSlotForUid(uid, slot);
          if (res.ok) {
            await clearSession();
            await sendMessage(
              chatId,
              `✅ <b>স্লট ${res.slot} রিসেট সম্পন্ন হয়েছে</b>\n\n` +
                `👤 একাউন্ট: <b>${res.name}</b>\n` +
                `🆔 UID: <code>${uid}</code>\n\n` +
                `স্লটটি এখন সম্পূর্ণ খালি — পুরোনো ফেস ও key মুছে ফেলা হয়েছে।\n` +
                `👉 এখন অ্যাপে গিয়ে স্লট ${res.slot} এ নতুন করে ফেস ভেরিফিকেশন করুন।\n` +
                `অ্যাপটি একবার রিফ্রেশ/বন্ধ করে খুললে নতুন অবস্থা দেখতে পাবেন।`,
              msg.message_id,
            );
            await logMessage("question", `slot-reset:${slot}`, "slot reset done", uid);
            return true;
          }
          await sendMessage(chatId, `❌ ${res.error}`, msg.message_id);
          await logMessage("question", "slot-reset-failed", res.error, uid);
          return false;
        };

        // ---- continue an in-progress slot-reset conversation -------------------
        if (msg.from?.id) {
          const { data: sess } = await supabaseAdmin
            .from("tg_sessions").select("*")
            .eq("tg_user_id", msg.from.id).eq("chat_id", msg.chat.id).maybeSingle();

          const alive = sess && new Date(sess.expires_at).getTime() > Date.now();
          if (sess && !alive) await clearSession();

          if (alive && sess) {
            if (isCancel) {
              await clearSession();
              await sendMessage(chatId, "ঠিক আছে, রিসেটের অনুরোধটি বাতিল করা হলো। 🙂", msg.message_id);
              await logMessage("question", "slot-reset-cancel", null, sess.uid);
              return Response.json({ ok: true, flow: "cancelled" });
            }

            if (sess.step === "await_uid") {
              const uid = pickUid(norm);
              if (!uid) {
                await sendMessage(
                  chatId,
                  "🆔 অনুগ্রহ করে শুধু আপনার <b>UID</b> নম্বরটি লিখুন (যেমন: 4100)।\nUID পাবেন অ্যাপের প্রোফাইল পেজে।",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "await_uid" });
              }
              const { findProfileByUid } = await import("@/lib/telegram-slot.server");
              const prof = await findProfileByUid(uid);
              if (!prof) {
                await sendMessage(
                  chatId,
                  `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি আবার লিখুন।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "uid-notfound" });
              }
              const slotNow = pickSlot(norm.replace(uid, " "));
              if (slotNow) {
                await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
                await doReset(uid, slotNow);
                return Response.json({ ok: true, flow: "reset" });
              }
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              await sendMessage(
                chatId,
                `✅ একাউন্ট পাওয়া গেছে: <b>${prof.display_name || "ইউজার"}</b> (UID <code>${uid}</code>)\n\n` +
                  `🔢 ${settings.ask_slot_message || "কোন নম্বর স্লটটি রিসেট করতে চান? (১ থেকে ১০)"}`,
                msg.message_id,
              );
              await logMessage("question", "asked-slot", null, uid);
              return Response.json({ ok: true, flow: "await_slot" });
            }

            if (sess.step === "await_slot" && sess.uid) {
              const slot = pickSlot(norm);
              if (!slot) {
                await sendMessage(
                  chatId,
                  "🔢 অনুগ্রহ করে <b>১ থেকে ১০</b> এর মধ্যে স্লট নম্বরটি লিখুন (যেমন: 3)।",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "await_slot" });
              }
              await doReset(sess.uid, slot);
              return Response.json({ ok: true, flow: "reset" });
            }
          }
        }

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

        // ---- UID lookup: instant account card in the group --------------------
        if ((settings as any).uid_lookup_enabled !== false && !decision.should_delete) {
          const inline = text.match(/\b(\d{2,9})\b/);
          const candidate = decision.uid || (decision.needs_uid ? null : inline?.[1] ?? null);

          if (candidate) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            try {
              const res = await buildUserCard(candidate);
              if (res.found) {
                await sendMessage(chatId, res.card, msg.message_id);
                actions.push("uid-card");
                matchedUid = candidate;
              } else if (decision.verdict === "question") {
                await sendMessage(
                  chatId,
                  `❌ UID <code>${candidate}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। অ্যাপের প্রোফাইল পেজ থেকে সঠিক UID টি দেখে আবার লিখুন।`,
                  msg.message_id,
                );
                actions.push("uid-notfound");
              }
            } catch (e) {
              console.error("[tg] uid lookup failed", e);
            }
          } else if (decision.needs_uid && settings.auto_reply_enabled) {
            await sendMessage(
              chatId,
              `🔎 ${(settings as any).ask_uid_message || "আপনার Good-App UID টি লিখুন।"}`,
              msg.message_id,
            );
            actions.push("asked-uid");
          }
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
