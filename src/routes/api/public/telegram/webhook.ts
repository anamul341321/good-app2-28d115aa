// Telegram bot webhook — receives group messages, moderates + auto-replies.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          getBotToken, webhookSecretFor, sendMessage, deleteMessage,
          restrictUser, getPhotoBase64, decide, faqImageBase64, banChatMember,

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

        // ---- offender record (warnings / block state) -------------------------
        const { data: offender } = msg.from?.id
          ? await supabaseAdmin.from("tg_offenders").select("*").eq("tg_user_id", msg.from.id).maybeSingle()
          : { data: null as any };

        // Already blocked → delete anything they manage to post and stop.
        if ((offender as any)?.blocked) {
          if (settings.delete_bad_messages) await deleteMessage(chatId, msg.message_id);
          return Response.json({ ok: true, blocked: true });
        }


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
        // Accepts: "3", "5 ta", "2,3,4", "২-৫", "3 4 7", "সব"/"all"
        const wantsAll = /(সব|সবগুলো|সবগুলা|all|full)/i.test(norm);
        const pickSlots = (s: string): number[] => {
          const out: number[] = [];
          const range = s.matchAll(/\b(\d{1,3})\s*(?:-|–|to|থেকে)\s*(\d{1,3})\b/g);
          let rest = s;
          for (const r of range) {
            const a = Number(r[1]), b = Number(r[2]);
            if (a >= 1 && b >= a && b - a < 100) for (let i = a; i <= b; i++) out.push(i);
            rest = rest.replace(r[0], " ");
          }
          for (const m2 of rest.matchAll(/\b(\d{1,3})\b/g)) {
            const n = Number(m2[1]);
            if (n >= 1 && n <= 500) out.push(n);
          }
          return Array.from(new Set(out));
        };
        const pickSlot = (s: string): number | null => pickSlots(s)[0] ?? null;
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

        const doReset = async (uid: string, slots: number[]) => {
          const { resetSlotsForUid, listSlotNumbers } = await import("@/lib/telegram-slot.server");
          const list = slots.length ? slots : await listSlotNumbers(uid);
          const res = await resetSlotsForUid(uid, list);

          if (!res.found) {
            await sendMessage(chatId, `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি।`, msg.message_id);
            await logMessage("question", "slot-reset-failed", "uid not found", uid);
            return false;
          }

          await clearSession();
          const okLine = res.done.length
            ? `✅ রিসেট হয়েছে: <b>${res.done.map((s) => `স্লট ${s}`).join(", ")}</b>`
            : "⚠️ কোনো স্লট রিসেট করা যায়নি।";
          const failLine = res.failed.length
            ? `\n❌ পারা যায়নি: ${res.failed.map((f) => `স্লট ${f.slot} (${f.error})`).join(", ")}`
            : "";

          await sendMessage(
            chatId,
            `🔄 <b>স্লট রিসেট রিপোর্ট</b>\n\n` +
              `👤 একাউন্ট: <b>${res.name}</b>\n🆔 UID: <code>${uid}</code>\n\n` +
              okLine + failLine +
              (res.done.length
                ? `\n\nএই স্লটগুলো এখন সম্পূর্ণ খালি — পুরোনো ফেস ও key মুছে ফেলা হয়েছে।\n` +
                  `👉 অ্যাপে গিয়ে নতুন করে ফেস ভেরিফিকেশন করুন (একবার রিফ্রেশ দিন)।`
                : ""),
            msg.message_id,
          );
          await logMessage("question", `slot-reset:${res.done.join("|") || "none"}`, "slot reset", uid);
          return res.done.length > 0;
        };

        // ---- open commands: no password needed ------------------------------
        if (/^\/(start|help|admin)\b/i.test(norm)) {
          await sendMessage(
            chatId,
            `🤖 <b>কমান্ড</b>\n` +
              `<code>/reset UID স্লট</code> — যেমন <code>/reset 4100 2,5,7</code>, <code>/reset 4100 2-6</code> বা <code>/reset 4100 সব</code>\n` +
              `শুধু "স্লট রিসেট" লিখলেই বট ধাপে ধাপে UID ও স্লট নম্বর জিজ্ঞেস করবে।`,
            msg.message_id,
          );
          return Response.json({ ok: true, flow: "help" });
        }

        const resetCmd = norm.match(/^\/reset(?:@\w+)?\s+(\S+)\s*(.*)$/i);
        if (resetCmd) {
          const uidArg = resetCmd[1].replace(/\D/g, "") || resetCmd[1].toUpperCase();
          const rest = resetCmd[2] ?? "";

          await doReset(uidArg, /(সব|all)/i.test(rest) ? [] : pickSlots(rest));
          return Response.json({ ok: true, flow: "admin-reset" });
        }



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
              const slotsNow = pickSlots(norm.replace(uid, " "));
              if (slotsNow.length || wantsAll) {
                await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
                await doReset(uid, wantsAll ? [] : slotsNow);
                return Response.json({ ok: true, flow: "reset" });
              }
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              await sendMessage(
                chatId,
                `✅ একাউন্ট পাওয়া গেছে: <b>${prof.display_name || "ইউজার"}</b> (UID <code>${uid}</code>)\n\n` +
                  `🔢 ${settings.ask_slot_message || "কোন কোন স্লট রিসেট করতে চান? এক বা একাধিক নম্বর লিখুন (যেমন: 3 অথবা 2,5,7 অথবা 2-6, সবগুলোর জন্য লিখুন \"সব\")"}`,
                msg.message_id,
              );
              await logMessage("question", "asked-slot", null, uid);
              return Response.json({ ok: true, flow: "await_slot" });
            }

            if (sess.step === "await_slot" && sess.uid) {
              const slots = pickSlots(norm);
              if (!slots.length && !wantsAll) {
                await sendMessage(
                  chatId,
                  "🔢 স্লট নম্বর লিখুন — একটি (যেমন: 3), একাধিক (2,5,7), রেঞ্জ (2-6) অথবা সবগুলোর জন্য <b>সব</b>।",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "await_slot" });
              }
              await doReset(sess.uid, wantsAll ? [] : slots);
              return Response.json({ ok: true, flow: "reset" });
            }


          }
        }

        const bannedWords: string[] = settings.banned_words ?? [];
        const lower = text.toLowerCase();
        const hardHit = bannedWords.find((w) => w && lower.includes(w.toLowerCase()));


        const [{ data: faqRows }, { data: videoRows }] = await Promise.all([
          supabaseAdmin
            .from("tg_faq").select("topic, answer, keywords, image_path").eq("is_active", true)
            .order("priority", { ascending: false }).order("id"),
          (supabaseAdmin as any)
            .from("tg_videos").select("topic, url, keywords, note").eq("is_active", true)
            .order("priority", { ascending: false }).order("id"),
        ]);


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
          needs_uid: false, intent: null, slot: null,
        } as Awaited<ReturnType<typeof decide>>;

        if (hardHit) {
          decision = {
            verdict: "abuse", reply: null,
            should_delete: !!settings.delete_bad_messages, should_warn: true, uid: null,
            needs_uid: false, intent: null, slot: null,
          };

        } else if (text.trim() || photoBase64) {
          // Everything this user said before — used both for smarter answers and
          // for finding the UID they gave earlier when they start misbehaving.
          let history: string[] = [];
          let pastReplies: string[] = [];
          let knownUid: string | null = (offender as any)?.known_uid ?? null;
          if (msg.from?.id) {
            const { data: past } = await supabaseAdmin
              .from("tg_messages").select("text, bot_reply, matched_uid, created_at")
              .eq("tg_user_id", msg.from.id)
              .order("created_at", { ascending: false }).limit(12);
            history = (past ?? []).map((p: any) => p.text).filter(Boolean).reverse().slice(-8);
            pastReplies = (past ?? []).map((p: any) => p.bot_reply).filter(Boolean).slice(0, 4);
            if (!knownUid) knownUid = (past ?? []).find((p: any) => p.matched_uid)?.matched_uid ?? null;
          }

          try {
            decision = await decide({
              persona: settings.persona,
              rules: settings.rules,
              faq,
              videos: (videoRows ?? []) as any[],
              bannedWords,
              text,
              photoBase64,
              senderName,
              smart: (settings as any).smart_mode !== false,
              history,
              pastReplies: (settings as any).reply_variety === false ? [] : pastReplies,
              knownUid,
              warnCount: (offender as any)?.warn_count ?? 0,
              supportUsername: (settings as any).support_username || "@anamulmunni",
            });
          } catch (e) {
            console.error("[tg] decide failed", e);
          }

          
          (decision as any)._knownUid = knownUid;
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
          const warnCount = ((offender as any)?.warn_count ?? 0) + 1;
          const blockThreshold = Number((settings as any).block_threshold ?? 5);
          const autoBlock = (settings as any).auto_block_enabled !== false;

          // Which UID does this troublemaker belong to? Check the message, the
          // chat history and the linked app profile.
          let uidForWarn: string | null =
            decision.uid || (decision as any)._knownUid || (offender as any)?.known_uid || null;
          if (!uidForWarn) {
            const { data: past } = await supabaseAdmin
              .from("tg_messages").select("matched_uid")
              .eq("tg_user_id", msg.from.id).not("matched_uid", "is", null)
              .order("created_at", { ascending: false }).limit(1);
            uidForWarn = (past ?? [])[0]?.matched_uid ?? null;
          }
          if (!uidForWarn) {
            const { data: linked } = await supabaseAdmin
              .from("profiles").select("id, uid_seq").eq("telegram_user_id", msg.from.id).maybeSingle();
            if (linked) { appUserId = linked.id; uidForWarn = String(linked.uid_seq ?? "") || null; }
          }
          if (!appUserId && uidForWarn && /^\d+$/.test(uidForWarn)) {
            const { data: byUid } = await supabaseAdmin
              .from("profiles").select("id").eq("uid_seq", Number(uidForWarn)).maybeSingle();
            if (byUid) appUserId = byUid.id;
          }
          matchedUid = matchedUid || uidForWarn;

          const willBlock = autoBlock && warnCount >= blockThreshold;

          await supabaseAdmin.from("tg_offenders").upsert({
            tg_user_id: msg.from.id,
            username: msg.from.username ?? null,
            full_name: senderName,
            warn_count: warnCount,
            last_reason: decision.verdict,
            last_offense_at: new Date().toISOString(),
            known_uid: uidForWarn,
            app_user_id: appUserId,
            chat_id: msg.chat.id,
            ...(willBlock
              ? {
                  blocked: true,
                  blocked_at: new Date().toISOString(),
                  blocked_reason: `${decision.verdict} — ${warnCount} বার নিয়মভঙ্গ`,
                }
              : {}),
          });
          actions.push(`warn:${warnCount}`);

          if (!willBlock) {
            await sendMessage(
              chatId,
              `⚠️ <b>${senderName}</b>, আপনার মেসেজটি গ্রুপের নিয়মভঙ্গ করেছে (${decision.verdict})।\n` +
                `সতর্কতা: <b>${warnCount}/${blockThreshold}</b>\n` +
                (uidForWarn
                  ? `🆔 আপনার Good-App UID <code>${uidForWarn}</code> আমাদের কাছে আছে — বারবার এমন করলে এই একাউন্টটি ব্যান হয়ে যাবে এবং সব ব্যালেন্স বাতিল হবে।\n`
                  : "") +
                `🙏 অনুগ্রহ করে ভদ্রভাবে কথা বলুন।`,
              msg.message_id,
            );
          }

          if (warnCount >= settings.warn_threshold && !willBlock) {
            await restrictUser(chatId, msg.from.id, 60 * 60);
            actions.push("muted-1h");
          }

          if (willBlock) {
            await banChatMember(chatId, msg.from.id);
            actions.push("blocked");
            await sendMessage(
              chatId,
              `🚫 <b>${senderName}</b> কে গ্রুপ থেকে ব্লক করা হয়েছে।\n` +
                (uidForWarn ? `🆔 UID: <code>${uidForWarn}</code>\n` : "") +
                `কারণ: বারবার নিয়মভঙ্গ (${warnCount} বার)।`,
            );
          }

          if (warnCount >= settings.warn_threshold) {
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
              `🚨 <b>${willBlock ? "ইউজার ব্লক করা হয়েছে" : "Ban approval দরকার"}</b>\n` +
                `${settings.admin_mention ? settings.admin_mention + "\n" : ""}` +
                `ইউজার: <b>${senderName}</b>${msg.from.username ? ` (@${msg.from.username})` : ""}\n` +
                `Telegram ID: <code>${msg.from.id}</code>\n` +
                `App UID: <code>${matchedUid || "পাওয়া যায়নি"}</code>\n` +
                `কারণ: ${decision.verdict} — ${warnCount} বার\n\n` +
                `Admin panel → Telegram Bot → ব্লক লিস্ট থেকে দেখুন / আনব্লক করুন।`,
            );
          }
        }


        // ---- someone asked for a stored photo / key: never share, always deny -
        if (decision.intent === "photo_request" && !decision.should_delete
            && (settings as any).photo_privacy_enabled !== false) {
          const { photoRefusalReply } = await import("@/lib/telegram-bot.server");
          const reply = photoRefusalReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("photo-denied");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "photo_request", actions });
        }

        if (settings.auto_reply_enabled && decision.reply && !decision.should_delete
            && decision.intent !== "slot_reset") {
          await sendMessage(chatId, decision.reply, msg.message_id);
          actions.push("replied");
        }

        // ---- bot genuinely doesn't know → hand off to the human admin --------
        if (!decision.reply && decision.escalate && !decision.should_delete
            && !decision.needs_uid && decision.intent === null
            && settings.auto_reply_enabled && (settings as any).escalate_enabled !== false) {
          const { escalateReply } = await import("@/lib/telegram-bot.server");
          const reply = escalateReply(senderName, (settings as any).support_username || "@anamulmunni");
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("escalated");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "escalated", actions });
        }


        // ---- guided slot reset: ask UID → ask slot → reset --------------------
        if (decision.intent === "slot_reset" && (settings as any).slot_reset_enabled !== false
            && !decision.should_delete && msg.from?.id) {
          const uid = decision.uid || pickUid(norm);
          if (uid) {
            const { findProfileByUid } = await import("@/lib/telegram-slot.server");
            const prof = await findProfileByUid(uid);
            if (!prof) {
              await saveSession({ step: "await_uid", uid: null, app_user_id: null });
              await sendMessage(
                chatId,
                `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`,
                msg.message_id,
              );
              actions.push("slot-reset:uid-notfound");
            } else {
              const slots = pickSlots(norm.replace(uid, " "));
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              if (slots.length || wantsAll) {
                await doReset(uid, wantsAll ? [] : slots);
                actions.push("slot-reset:done");
              } else {
                await sendMessage(
                  chatId,
                  `✅ একাউন্ট পাওয়া গেছে: <b>${prof.display_name || "ইউজার"}</b> (UID <code>${uid}</code>)\n\n` +
                    `🔢 ${settings.ask_slot_message || "কোন কোন স্লট রিসেট করতে চান? এক বা একাধিক নম্বর লিখুন (যেমন: 3 অথবা 2,5,7 অথবা 2-6, সবগুলোর জন্য লিখুন \"সব\")"}`,
                  msg.message_id,
                );
                actions.push("slot-reset:asked-slot");
              }

              matchedUid = uid;
            }
          } else {
            await saveSession({ step: "await_uid", uid: null, app_user_id: null });
            await sendMessage(
              chatId,
              `🔄 <b>স্লট রিসেট</b>\n\nঠিক আছে, আমি স্লটটি রিসেট করে দিচ্ছি।\n` +
                `🆔 প্রথমে আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন)।`,
              msg.message_id,
            );
            actions.push("slot-reset:asked-uid");
          }

          await logMessage(decision.verdict, actions.join(",") || "none", decision.reply, matchedUid);
          return Response.json({ ok: true, flow: "slot_reset", actions });
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
