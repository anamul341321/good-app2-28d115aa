// Telegram bot webhook — receives group messages, moderates + auto-replies.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          getBotToken, webhookSecretFor, sendMessage, deleteMessage,
          restrictUser, getPhotoBase64, decide, faqImageBase64, banChatMember,
          isChatAdmin, getMe, adminCompose,

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
        // group_chat_id এ কমা দিয়ে একাধিক গ্রুপ আইডি রাখা যায়; ফাঁকা থাকলে সব গ্রুপে কাজ করবে।
        const allowedChats = String(settings.group_chat_id ?? "")
          .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
        const chatAllowed = allowedChats.length === 0 || allowedChats.includes(chatId);
        const addChatToAllowList = async () => {
          if (allowedChats.includes(chatId)) return;
          await supabaseAdmin.from("tg_bot_settings")
            .update({ group_chat_id: [...allowedChats, chatId].join(",") })
            .eq("id", "default");
        };


        // ---- new members joined → warm welcome -------------------------------
        const joined = (msg.new_chat_members ?? []) as any[];
        if (joined.length) {
          // বটকে নতুন গ্রুপে অ্যাড করা হলে সেই গ্রুপটি নিজে থেকেই অনুমোদিত তালিকায় যোগ হবে।
          const me = await getMe().catch(() => null);
          if (me && joined.some((m: any) => m?.is_bot && (m.id === me.id || m.username === me.username))) {
            await addChatToAllowList();
            await sendMessage(
              chatId,
              `🤖 <b>Good-App সাপোর্ট বট চালু হয়েছে!</b>\n\n` +
                `এখন থেকে এই গ্রুপে যেকোনো প্রশ্ন লিখে বা ভয়েস পাঠিয়ে জিজ্ঞেস করতে পারেন — আমি সাথে সাথে সাহায্য করব 💙\n` +
                `⚠️ সব ফিচার ঠিকমতো কাজ করতে বটকে গ্রুপের <b>অ্যাডমিন</b> বানিয়ে দিন।`,
            );
            return Response.json({ ok: true, flow: "bot-added" });
          }
          if (!chatAllowed) return Response.json({ ok: true, ignored: "other-chat" });
          if ((settings as any).welcome_enabled !== false) {
            const { welcomeReply } = await import("@/lib/telegram-bot.server");
            for (const m of joined) {
              if (m?.is_bot) continue;
              const nm = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || "বন্ধু";
              await sendMessage(
                chatId,
                welcomeReply(nm, (settings as any).welcome_message ?? null, (settings as any).default_video_url ?? null),
              );
            }
          }
          return Response.json({ ok: true, flow: "welcome" });
        }
        if (!chatAllowed) return Response.json({ ok: true, ignored: "other-chat" });
        if (msg.left_chat_member) return Response.json({ ok: true, ignored: "left" });


        let text: string = msg.text ?? msg.caption ?? "";
        const photos = msg.photo as { file_id: string }[] | undefined;
        const senderName = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ")
          || msg.from?.username || "User";

        // Do not jump into conversations already being handled by a human admin.
        // If an admin writes, or the user replies to an admin's message, stay silent.
        const isBotCommand = /^\/(?:start|help|admin|reset)\b/i.test(text.trim());
        // গ্রুপের মালিক (support_username) সবসময় অ্যাডমিন হিসেবেই গণ্য হবে
        const ownerUsername = String((settings as any).support_username || "@anamulmunni")
          .replace(/^@/, "").toLowerCase();
        const senderIsOwner = (msg.from?.username ?? "").toLowerCase() === ownerUsername;
        const [chatAdminFlag, repliedToAdmin] = await Promise.all([
          isChatAdmin(chatId, msg.from?.id).catch(() => false),
          msg.reply_to_message?.from?.id && !msg.reply_to_message?.from?.is_bot
            ? isChatAdmin(chatId, msg.reply_to_message.from.id).catch(() => false)
            : Promise.resolve(false),
        ]);
        const senderIsAdmin = chatAdminFlag || senderIsOwner;
        // Exception: when an admin announces that a password was changed, the bot
        // confirms it to the user instead of staying silent.
        const passwordChanged = senderIsAdmin && !isBotCommand && text.trim().length > 0
          && /(password|পাসওয়ার্ড|pass ?word)/i.test(text)
          && /(change|changed|change kora|change kore|পরিবর্তন|চেঞ্জ|বদলে|reset|রিসেট|new password|নতুন পাসওয়ার্ড)/i.test(text);
        if (passwordChanged && settings.auto_reply_enabled) {
          const reply =
            `✅ <b>আপনার পাসওয়ার্ডটি সফলভাবে পরিবর্তন করা হয়েছে।</b>\n\n` +
            `📩 অ্যাডমিন আপনার <b>ইনবক্সে</b> ডিফল্ট পাসওয়ার্ডটি পাঠিয়ে দিয়েছেন — সেটি দিয়ে লগইন করুন।\n\n` +
            `⚠️ মনে রাখবেন, লগইন করার পর অবশ্যই আপনার <b>প্রোফাইল পেজে</b> গিয়ে পাসওয়ার্ডটি পরিবর্তন করে ` +
            `নিজের একটি <b>নতুন পাসওয়ার্ড</b> দিয়ে নেবেন 🔐`;
          await sendMessage(chatId, reply, msg.message_id);
          
          return Response.json({ ok: true, flow: "password-changed" });
        }
        // ---- অ্যাডমিন বটকে মেনশন করে কিছু করতে বললে বট সেটা করবে -------------
        const meInfo = await getMe().catch(() => null);
        const mentionsBot = !!meInfo && new RegExp(`@${meInfo.username}\\b`, "i").test(text);
        const repliedToBot = msg.reply_to_message?.from?.id === meInfo?.id;
        if (senderIsAdmin && !isBotCommand && (mentionsBot || repliedToBot) && text.trim()) {
          const order = text.replace(new RegExp(`@${meInfo?.username ?? "___"}`, "ig"), "").trim();
          const targetName = msg.reply_to_message && !msg.reply_to_message.from?.is_bot
            ? [msg.reply_to_message.from?.first_name, msg.reply_to_message.from?.last_name].filter(Boolean).join(" ")
            : null;
          const replyTo = msg.reply_to_message?.message_id ?? msg.message_id;

          // "uid 4100 er details / card" → একাউন্ট কার্ড
          const cardCmd = order.match(/(?:uid|ইউআইডি|আইডি)\s*[:#-]?\s*(\d{1,9})/i);
          if (cardCmd && /(details|ডিটেইলস|card|কার্ড|hisab|হিসাব|check|চেক|dekha|দেখা|info|তথ্য)/i.test(order)) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            const res = await buildUserCard(cardCmd[1]);
            await sendMessage(
              chatId,
              res.found ? res.card : `❌ UID <code>${cardCmd[1]}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি।`,
              replyTo,
            );
            return Response.json({ ok: true, flow: "admin-card" });
          }

          // "video dao / টিউটোরিয়াল দাও"
          if (/(video|ভিডিও|tutorial|টিউটোরিয়াল)/i.test(order)) {
            const { data: vids } = await supabaseAdmin
              .from("tg_videos").select("topic, keywords, note, url").eq("is_active", true);
            const hay = order.toLowerCase();
            const match = (vids ?? []).find((v: any) =>
              (v.keywords ?? []).some((k: string) => k && hay.includes(String(k).toLowerCase()))
              || (v.topic && hay.includes(String(v.topic).toLowerCase()))) as any;
            const { videoReply, DEFAULT_TUTORIAL_VIDEO } = await import("@/lib/telegram-bot.server");
            const url = match?.url || (settings as any).default_video_url || DEFAULT_TUTORIAL_VIDEO;
            await sendMessage(
              chatId,
              videoReply(targetName || "বন্ধু", url, match?.topic ?? null, match?.note ?? null),
              replyTo,
            );
            return Response.json({ ok: true, flow: "admin-video" });
          }

          // "মাইনিং/স্লটের হিসাব বুঝিয়ে দাও" → অ্যাপের আসল হিসাব (বানানো তথ্য নয়)
          {
            const bnDigits = order.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
            const miningCtx = /(mining|মাইনিং|maining)/i.test(bnDigits);
            const slotCtx =
              miningCtx || /(slot|স্লট|re verify|রি-ভেরিফ|রি ভেরিফ|reverify)/i.test(bnDigits);
            const askCtx =
              /(hisab|হিসাব|হিসেব|bujiye|বুঝিয়ে|bujhiye|koto|কত|income|ইনকাম|আয়|calculation)/i.test(
                bnDigits,
              );
            if (slotCtx && askCtx) {
              const m = bnDigits.match(/(\d{1,4})\s*(ta|টা|টি|ti|slot|স্লট)?/);
              const n = m ? Number(m[1]) : null;
              const slots = n && n >= 1 && n <= 500 ? n : null;
              const { loadRates, slotEarningReply } = await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const reply = slotEarningReply(targetName || "বন্ধুরা", rates, slots, true);
              await sendMessage(chatId, reply, replyTo);
              return Response.json({ ok: true, flow: "admin-slot-earning" });
            }

            // প্রশ্ন/টপিক বুঝিয়ে বলতে বললে → অ্যাপের রুলবুক থেকে গ্রাউন্ডেড উত্তর
            if (askCtx || /(ki|কি|kivabe|কীভাবে|কিভাবে|keno|কেন|bolo|বলো|bujhao|বুঝিয়ে)/i.test(bnDigits)) {
              const { smartAnswer } = await import("@/lib/telegram-bot.server");
              const { knowledgeText, loadRates: lr } = await import("@/lib/telegram-knowledge.server");
              const ans = await smartAnswer({
                name: targetName || "বন্ধুরা",
                question: order,
                knowledge: knowledgeText(await lr()),
              });
              if (ans && ans !== "NO_ANSWER") {
                await sendMessage(chatId, ans, replyTo);
                return Response.json({ ok: true, flow: "admin-smart" });
              }
            }
          }

          // অ্যাডমিন কোনো সেটিংস বদলাতে বললে (নগদ বন্ধ / বিকাশ চালু / বোনাস
          // পরিবর্তন / নোটিশ দেওয়া) → বট নিজেই কাজটা করে ফেলবে, তারপর জানাবে।
          {
            const { interpretAdminOrder, runAdminOps, opsAnnouncement } = await import(
              "@/lib/telegram-admin-actions.server"
            );
            const ops = await interpretAdminOrder(order);
            if (ops.length) {
              const { done, failed } = await runAdminOps(ops);
              if (done.length || failed.length) {
                await sendMessage(chatId, opsAnnouncement(done, failed), replyTo);
                return Response.json({ ok: true, flow: "admin-action", done, failed });
              }
            }
          }

          // বাকি সব: অ্যাডমিনের নির্দেশমতো সুন্দর মেসেজ সাজিয়ে গ্রুপে পাঠাবে
          const composed = await adminCompose(order, targetName);
          await sendMessage(chatId, composed || order, replyTo);
          return Response.json({ ok: true, flow: "admin-instruction" });

        }

        if ((senderIsAdmin && !isBotCommand) || repliedToAdmin) {
          return Response.json({ ok: true, ignored: senderIsAdmin ? "admin-message" : "reply-to-admin" });
        }


        // ---- voice note / audio clip → transcribe and treat as normal text ----
        const audioMsg = msg.voice ?? msg.audio ?? msg.video_note ?? null;
        let voiceHeard: string | null = null;
        const captionText = text.trim();
        if (audioMsg?.file_id) {
          const { getFileBase64, transcribeAudio } = await import("@/lib/telegram-bot.server");
          const file = await getFileBase64(audioMsg.file_id);
          if (file) {
            const ext = (file.path.split(".").pop() || "ogg").toLowerCase();
            const fmt = ["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"].includes(ext)
              ? ext
              : msg.video_note ? "mp4" : "ogg";
            voiceHeard = await transcribeAudio(file.base64, fmt);
            // প্রথমবার না বুঝলে আরেকবার চেষ্টা করবে (নেটওয়ার্ক/মডেল হেঁচকি এড়াতে)
            if (!voiceHeard || voiceHeard.replace(/[^\p{L}\p{N}]/gu, "").length < 3) {
              voiceHeard = await transcribeAudio(file.base64, fmt);
            }
            if (voiceHeard) voiceHeard = voiceHeard.trim();
            if (voiceHeard) text = `${text ? text + "\n" : ""}${voiceHeard}`.trim();
          }
          // Couldn't understand the voice → politely ask again instead of
          // guessing and sending an unrelated answer.
          if ((!voiceHeard || voiceHeard.replace(/[^\p{L}\p{N}]/gu, "").length < 3) && !captionText) {
            const who = msg.from?.first_name ? `${msg.from.first_name}, ` : "";
            await sendMessage(
              chatId,
              `${who}দুঃখিত 🙏 আপনার ভয়েসটা ঠিকমতো বুঝতে পারিনি।\nএকটু আস্তে করে আবার বলবেন, অথবা লিখে পাঠান — আমি সাথে সাথে সাহায্য করছি 💙`,
              msg.message_id,
            );
            return Response.json({ ok: true, flow: "voice-unclear" });
          }
        }





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
        // "yes", "ok", "ji", "ধন্যবাদ" — এগুলো কখনোই UID নয়।
        const isAffirmation = (s: string) =>
          /^(yes|yeah|yep|ya|ha|haa|hae|hmm|hm|ok|okay|k|ji|jee|acha|accha|thik|thik ache|right|sure|thanks|thank you|tnx|ty|done|nice|good|👍|✅|হ্যাঁ|হা|হুম|জি|জ্বি|আচ্ছা|ঠিক|ঠিক আছে|ধন্যবাদ|ওকে)[\s.!।]*$/i.test(
            s.trim(),
          );
        const pickUid = (s: string): string | null => {
          if (isAffirmation(s)) return null;
          const num = s.match(/\b(\d{1,9})\b/);
          if (num) return num[1];
          const code = s.match(/\b([A-Za-z0-9]{7})\b/);
          return code && /\d/.test(code[1]) ? code[1].toUpperCase() : null;
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
        // Is this message a plain answer to what the bot just asked, or has the
        // user moved on to a completely new question? (never keep looping)
        const stripped = norm.replace(/[০-৯0-9,\s.\-–#]/g, "").trim();
        const looksLikeSlotAnswer = (wantsAll || pickSlots(norm).length > 0) && stripped.length <= 10;
        const looksLikeUidAnswer =
          !!pickUid(norm) && (stripped.length <= 10 || /\b(uid|আইডি)\b/i.test(norm));
        const questionish =
          /(\?|কেন|কন\b|\bkn\b|keno|kivabe|kibhabe|কিভাবে|koita|কয়টা|কতটা|কত|koto|kobe|কবে|kokhon|withdraw|উইথড্র|balance|ব্যালেন্স|refer|রেফার|verify|ভেরিফাই|mining|মাইনিং|bonus|বোনাস|problem|somossa|সমস্যা|help|সাহায্য|\bki\b|কি\b|admin|অ্যাডমিন|এডমিন)/i.test(
            norm,
          ) || (photos?.length ?? 0) > 0 || !!voiceHeard;
        const hasExplicitUid = /(\buid\b|\bid\s*no\b|ইউআইডি|আইডি|আই ডি|আইডি নাম্বার)/i.test(norm);
        const pendingWithdrawQuestion =
          /(withdraw|উইথড্র|payment|পেমেন্ট|টাকা|tk|taka|টিকে|পাই নাই|পাইনাই)/i.test(norm) &&
          /(দিছি|দিয়েছি|দিসি|দিছে|দিয়াছি|dichi|dise|disi|diyechi|pending|পেন্ডিং|কখন পাব|কবে পাব|kokhon|kobe|pabo|pamu|pai nai|painai|paini|ashe nai|ashe na|asheni|আসে নাই|আসে না|আসেনি|এখনো পাই নাই|এখনো আসেনি|status|স্ট্যাটাস|history|হিস্টরি)/i.test(norm);
        const withdrawEligibilityQuestion =
          !pendingWithdrawQuestion &&
          /(withdraw|উইথড্র|উঠাব|উঠাতে|তুলতে|claim|ক্লেইম|টাকা)/i.test(norm) &&
          /(পারব|parbo|পারবো|যাবে|jabe|হবে|hobe|দিতে পারব|নিতে পারব|উঠবে|unblock|আনলক|লক|lock)/i.test(norm);

        // ইউজার কোনো সমস্যার কথা বললে (যেমন "রি-ভেরিফাই করতে গেলে বলতেছে ১৮
        // বছরের নিচে") সেটা একাউন্ট-হিসাব চাওয়া নয় — তখন UID না চেয়ে সরাসরি
        // সমস্যার সমাধান বলতে হবে।
        const reportsProblem =
          /(bolteche|bolteche|বলতেছে|বলছে|বলতেসে|বলে|dekhacche|দেখাচ্ছে|দেখায়|show korche|hocche na|হচ্ছে না|hoi na|হয় না|হয়না|hocche nah|hoy nai|হয় নাই|হচ্ছে নাহ|parchi na|পারছি না|পারতেছি না|partesi na|somossa|সমস্যা|problem|error|এরর|failed|ফেইল|fail|আটকে|atke|18|১৮|under ?age|বয়স)/i
            .test(norm);

        // "আমার কয়টা রেফার হয়েছে?", "আমার ব্যালেন্স কত?", "কয়টা ভেরিফাই হয়েছে?"
        // → এগুলোর উত্তর একাউন্ট ডেটা থেকেই দিতে হবে, তাই UID চেয়ে কার্ড দেখাই।
        const asksOwnAccount =
          !pendingWithdrawQuestion &&
          !reportsProblem &&
          /(আমার|amar|amr|my|আমি|ami|nijer|নিজের|acount|account|একাউন্ট|অ্যাকাউন্ট)/i.test(norm) &&
          /(refer|reffer|রেফার|ব্যালেন্স|balance|verify|ভেরিফাই|verification|ভেরিফিকেশন|face|ফেস|slot|স্লট|mining|মাইনিং|bonus|বোনাস|টাকা|taka|tk|income|ইনকাম|status|স্ট্যাটাস|details|ডিটেইলস|koto|কত|koita|কয়টা|kota|hoyeche|hoyche|hoise|আছে|ache)/i.test(norm);



        const verificationDateKind = (s: string): "first" | "reverify" | "all" | null => {
          if (/(kotodin|koto\s*din|কতদিন|কত\s*দিন)[^\n]{0,30}(por|pore|পর|পরে)[^\n]{0,30}(re\s*-?\s*verify|reverify|রি\s*-?\s*ভেরিফাই)/i.test(s)) {
            return null;
          }
          const asksDate = /(তারিখ|কবে|কতদিন|kotodin|kobe|kokhon|koto\s*(?:tarikh|ratikh|date|din)|tarikh|ratikh|date|when|hoise|hoyche|hoyeche|korche|kora\s*hoyche)/i.test(s);
          const asksVerify = /(verify|verification|ভেরিফাই|ভেরিফিকেশন|face|ফেস)/i.test(s);
          if (!asksDate || !asksVerify) return null;
          if (/(re\s*-?\s*verify|reverify|রি\s*-?\s*ভেরিফাই|রি-ভেরিফাই)/i.test(s)) return "reverify";
          if (/(1st|first|১ম|প্রথম|prothom)/i.test(s)) return "first";
          return "all";
        };
        const pickVerificationQuery = (s: string): string | null => {
          if (isAffirmation(s)) return null;
          const explicitUid = s.match(/(?:uid|ইউআইডি|আইডি|id)\s*[:#-]?\s*([A-Za-z0-9]{2,10})/i);

          if (explicitUid) return explicitUid[1].trim();
          const namedUser = s.match(/(?:user\s*\d+\s+)?([A-Za-z][A-Za-z .]{1,35})\s*(?:er|এর|র)\s+(?:face|ফেস|1st|first|verify|verification|ভেরিফাই)/i);
          if (namedUser) return namedUser[1].trim();
          const banglaName = s.match(/([\u0980-\u09FF]{2,}(?:\s+[\u0980-\u09FF]{2,})?)\s*(?:এর|র)\s+(?:ফেস|ভেরিফাই|ভেরিফিকেশন)/i);
          if (banglaName) return banglaName[1].trim();
          const only = s.trim().match(/^[#\s]*(\d{2,10}|[A-Za-z0-9]{6,10})[\s.]*$/);
          if (only) return only[1].trim();
          return null;
        };

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

        // ইউজার কোনো নির্দিষ্ট স্লট নিয়ে সমস্যার কথা বললে ("৩ নম্বর স্লটে
        // রি-ভেরিফাই হচ্ছে না") — উত্তরের সাথে জিজ্ঞেস করব স্লটটি রিসেট করে
        // দেব কি না। রাজি হলে UID চেয়ে সাথে সাথেই রিসেট করে দেব।
        const mentionedSlot: number | null = (() => {
          const m =
            norm.match(/(\d{1,3})\s*(?:no|nombor|number|নম্বর|নাম্বার|নং)?\s*(?:er|এর)?\s*(?:slot|স্লট)/i) ||
            norm.match(/(?:slot|স্লট)\s*(?:no|number|নম্বর|নাম্বার|নং)?\s*[:#-]?\s*(\d{1,3})/i);
          const n = m ? Number(m[1]) : NaN;
          return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
        })();

        const offerSlotResetSuffix = async (): Promise<string> => {
          if (!mentionedSlot || !reportsProblem || !msg.from?.id) return "";
          if ((settings as any).slot_reset_enabled === false) return "";
          try {
            await saveSession({ step: "offer_reset", uid: null, app_user_id: null, data: { slots: [mentionedSlot] } });
          } catch {
            return "";
          }
          return (
            `\n\n———\n🔄 আপনি কি <b>${mentionedSlot} নম্বর স্লটটি</b> রিসেট করে নিতে চান?\n` +
            `রিসেট করলে ওই স্লটটি একদম খালি হয়ে যাবে, তারপর নতুন করে (১৮+ ফেস দিয়ে) আবার ভেরিফাই করতে পারবেন।\n\n` +
            `👉 চাইলে লিখুন <b>হ্যাঁ</b> — এরপর শুধু আপনার <b>UID</b> নম্বরটি দিলেই আমি সাথে সাথে স্লটটি রিসেট করে জানিয়ে দেব 💙`
          );
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

          const aliveRaw = sess && new Date(sess.expires_at).getTime() > Date.now();
          if (sess && !aliveRaw) await clearSession();

          // The user changed the subject → forget the pending question and
          // answer what they actually asked now.
          const answering =
            sess?.intent === "withdraw_status" || sess?.intent === "verification_dates" || sess?.intent === "account_info"
              ? looksLikeUidAnswer
              : sess?.step === "await_slot"
                ? looksLikeSlotAnswer
                : looksLikeUidAnswer || looksLikeSlotAnswer;
          if (aliveRaw && sess && !answering && !isCancel && questionish) {
            await clearSession();
          }
          const alive = aliveRaw && (answering || isCancel || !questionish);

          if (alive && sess) {
            if (isCancel) {
              await clearSession();
              await sendMessage(chatId, "ঠিক আছে, রিসেটের অনুরোধটি বাতিল করা হলো। 🙂", msg.message_id);
              await logMessage("question", "slot-reset-cancel", null, sess.uid);
              return Response.json({ ok: true, flow: "cancelled" });
            }

            if (sess.intent === "withdraw_status" && sess.step === "await_uid") {
              const uid = pickUid(norm);
              if (!uid) {
                await sendMessage(
                  chatId,
                  `দুঃখিত ${senderName}, আপনার পেমেন্ট দেরি হওয়ায় আমরা আন্তরিকভাবে দুঃখিত 🙏\n\n` +
                    `দয়া করে আপনার <b>UID</b> নম্বরটি লিখুন।\nUID পেলেই আমি সাথে সাথে আপনার pending/paid withdraw details দেখে জানিয়ে দেব।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "withdraw-await-uid" });
              }

              const { buildWithdrawStatusCard } = await import("@/lib/telegram-withdraw.server");
              const res = await buildWithdrawStatusCard(uid);
              const reply = res.found
                ? res.card
                : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
              if (res.found) await clearSession();
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "withdraw-status", reply, res.found ? uid : null);
              return Response.json({ ok: true, flow: "withdraw-status-session" });
            }

            if (sess.intent === "account_info" && sess.step === "await_uid") {
              const uid = pickUid(norm);
              if (!uid) {
                await sendMessage(
                  chatId,
                  `🆔 আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন, যেমন: 4100)।\nUID পেলেই আপনার রেফার, ভেরিফাই, ব্যালেন্স সব দেখিয়ে দিচ্ছি।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "account-info-await-uid" });
              }
              const { buildUserCard } = await import("@/lib/telegram-lookup.server");
              const res = await buildUserCard(uid);
              if (res.found) await clearSession();
              const reply = res.found
                ? res.card
                : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "account-info", reply, res.found ? uid : null);
              return Response.json({ ok: true, flow: "account-info-session" });
            }


            if (sess.intent === "verification_dates" && sess.step === "await_uid") {
              const query = pickVerificationQuery(norm) || pickUid(norm);
              if (!query) {
                await sendMessage(
                  chatId,
                  "🆔 যার ভেরিফিকেশনের তারিখ জানতে চান, তার <b>UID</b> লিখুন। নাম দিয়েও লিখতে পারেন, তবে UID দিলে সবচেয়ে ঠিক রিপোর্ট পাবেন।",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "verification-date-await-uid" });
              }

              const { buildVerificationDateReport } = await import("@/lib/telegram-lookup.server");
              const kind = ((sess.data as any)?.kind || "first") as "first" | "reverify" | "all";
              const res = await buildVerificationDateReport(query, kind);
              if (res.found) {
                await clearSession();
                await sendMessage(chatId, res.card, msg.message_id);
                await logMessage("question", `verification-date:${kind}`, res.card, res.uid);
                return Response.json({ ok: true, flow: "verification-date-report" });
              }
              const matches = (res as any).ambiguous as any[] | undefined;
              const reply = matches?.length
                ? `একই নামে একাধিক ইউজার পাওয়া গেছে। সঠিক UID লিখুন:\n${matches.map((p) => `• ${p.display_name || "ইউজার"} — UID <code>${p.uid_seq ?? "—"}</code>`).join("\n")}`
                : `❌ <code>${query}</code> দিয়ে কোনো ইউজার পাওয়া যায়নি। সঠিক UID লিখুন।`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "verification-date-notfound", reply, null);
              return Response.json({ ok: true, flow: "verification-date-notfound" });
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

        // ---- "অ্যাডমিন কোথায়?" → funny reply that mentions the real admin ----
        if (
          settings.auto_reply_enabled &&
          /(admin|অ্যাডমিন|এডমিন|এ্যাডমিন)/i.test(norm) &&
          /(kothai|kothay|কোথায়|kotha|নাই|nai|ase na|আসেন না|কে\b|ke\b|koi|কই|dakun|ডাকুন|call)/i.test(norm)
        ) {
          const { adminWhereReply } = await import("@/lib/telegram-bot.server");
          const reply = adminWhereReply(senderName, (settings as any).support_username || "@anamulmunni");
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("question", "admin-where", reply, null);
          return Response.json({ ok: true, flow: "admin-where" });
        }


        const bannedWords: string[] = settings.banned_words ?? [];
        const lower = text.toLowerCase();
        const hardHit = bannedWords.find((w) => w && lower.includes(w.toLowerCase()));


        const [{ data: faqRows }, { data: videoRows }, { data: voiceRows }] = await Promise.all([
          supabaseAdmin
            .from("tg_faq").select("topic, answer, keywords, image_path, updated_at").eq("is_active", true)
            .order("priority", { ascending: false }).order("updated_at", { ascending: false }).order("id"),
          (supabaseAdmin as any)
            .from("tg_videos").select("topic, url, keywords, note").eq("is_active", true)
            .order("priority", { ascending: false }).order("id"),
          (supabaseAdmin as any)
            .from("tg_voices").select("topic, keywords, note, audio_path").eq("is_active", true)
            .order("priority", { ascending: false }).order("id"),
        ]);


        let shotText = "";
        let photoBase64: string | null = null;
        if (settings.photo_analysis_enabled && photos?.length) {
          photoBase64 = await getPhotoBase64(photos[photos.length - 1].file_id);
        }

        // Reference screenshots are only loaded when the user actually sent a photo.
        const faq: any[] = [];
        let imgBudget = 10;
        for (const f of faqRows ?? []) {
          let imageBase64: string | null = null;
          if (photoBase64 && (f as any).image_path && imgBudget > 0) {
            imageBase64 = await faqImageBase64((f as any).image_path);
            if (imageBase64) imgBudget--;
          }
          faq.push({ topic: f.topic, answer: f.answer, keywords: (f as any).keywords, imageBase64 });
        }

        // Built-in answers (always available) — admin rows above take priority.
        {
          const { BUILTIN_FAQS } = await import("@/lib/telegram-builtin-faq.server");
          for (const b of BUILTIN_FAQS) {
            if (faq.some((f) => String(f.topic).trim().toLowerCase() === b.topic.trim().toLowerCase())) continue;
            faq.push({
              topic: b.topic,
              answer: b.answer,
              keywords: [...b.keywords, ...b.screenshot],
              imageBase64: null,
            });
          }
        }


        if (photoBase64 && settings.auto_reply_enabled) {
          try {
            const { matchFaqImage, humanizeReply } = await import("@/lib/telegram-bot.server");
            const imageMatch = await matchFaqImage({ photoBase64, faq });
            if (imageMatch) {
              const matchedFaq = faq.find(
                (f) => String(f.topic).trim().toLowerCase() === imageMatch.topic.trim().toLowerCase(),
              );
              if (matchedFaq?.answer) {
                let recent: string[] = [];
                if (msg.from?.id) {
                  const { data: prev } = await supabaseAdmin
                    .from("tg_messages").select("bot_reply")
                    .eq("tg_user_id", msg.from.id)
                    .order("created_at", { ascending: false }).limit(3);
                  recent = (prev ?? []).map((p: any) => p.bot_reply).filter(Boolean);
                }
                const reply = await humanizeReply(String(matchedFaq.answer).trim(), text, recent);
                await sendMessage(chatId, reply, msg.message_id);
                await logMessage("question", `faq-image:${imageMatch.topic}:${imageMatch.confidence.toFixed(2)}`, reply, null);
                return Response.json({ ok: true, flow: "faq-image-match", topic: imageMatch.topic });
              }
            }
          } catch (e) {
            console.error("[tg] faq image match failed", e);
          }

          // Read the text inside the screenshot and match it against the saved
          // admin answers + built-in library (image-vs-image alone missed the
          // obvious ones like the "You must be 18 years or older" page).
          try {
            const { readScreenshotText, humanizeReply } = await import("@/lib/telegram-bot.server");
            shotText = await readScreenshotText(photoBase64);
            if (shotText) {
              const hay = shotText.toLowerCase();
              const scored = faq
                .map((f) => {
                  const keys: string[] = [
                    ...(Array.isArray(f.keywords) ? f.keywords : String(f.keywords ?? "").split(/[,\n]/)),
                    String(f.topic ?? ""),
                  ]
                    .map((k) => String(k).trim().toLowerCase())
                    .filter((k) => k.length > 3);
                  const score = keys.filter((k) => hay.includes(k)).length;
                  return { f, score };
                })
                .sort((a, b) => b.score - a.score)[0];
              if (scored && scored.score > 0 && scored.f.answer) {
                const base = String(scored.f.answer).trim();
                const reply = (await humanizeReply(base, text || shotText, [])) || base;
                await sendMessage(chatId, reply, msg.message_id);
                await logMessage("question", `faq-ocr:${scored.f.topic}`, reply, null);
                return Response.json({ ok: true, flow: "faq-ocr", topic: scored.f.topic });
              }
            }
          } catch (e) {
            console.error("[tg] screenshot ocr match failed", e);
          }

          // No admin screenshot matched → try the built-in problem library
          // (e.g. GoodDollar "We found your twin" duplicate-face page).
          try {
            const { matchBuiltinFaqPhoto, humanizeReply } = await import("@/lib/telegram-bot.server");
            const answer = await matchBuiltinFaqPhoto(photoBase64);
            if (answer) {
              const reply = (await humanizeReply(answer, text, [])) || answer;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "faq-builtin-image", reply, null);
              return Response.json({ ok: true, flow: "faq-builtin-image" });
            }
          } catch (e) {
            console.error("[tg] builtin faq photo match failed", e);
          }
        }

        // ---- follow-up about the screenshot they JUST sent ---------------------
        // "Eta kn ashe?" right after a screenshot must explain THAT problem,
        // never the generic 3-reason list and never ask for a screenshot again.
        if (!photoBase64 && settings.auto_reply_enabled && text.trim() && msg.from?.id) {
          const t = text.trim();
          const vague =
            t.length <= 80 &&
            /(\bkn\b|\bken\b|\bkno\b|keno|কেন|\bকন\b|\bwhy\b|eta ki|eita ki|এটা কি|এইটা কি|ki problem|ki hoise|কি সমস্যা|কি হইছে|somadhan|সমাধান|solution|ki korbo|কি করবো)/i.test(t);
          if (vague) {
            try {
              const { data: prevShots } = await supabaseAdmin
                .from("tg_messages")
                .select("action, bot_reply, created_at, has_photo")
                .eq("tg_user_id", msg.from.id)
                .eq("chat_id", msg.chat.id)
                .eq("has_photo", true)
                .order("created_at", { ascending: false })
                .limit(1);
              const shot: any = prevShots?.[0];
              const fresh =
                shot?.bot_reply &&
                Date.now() - new Date(shot.created_at).getTime() < 60 * 60 * 1000;
              if (fresh) {
                const topic = String(shot.action ?? "").split(":").slice(1).join(":").trim();
                const matched = topic
                  ? faq.find(
                      (f) =>
                        String(f.topic).trim().toLowerCase() === topic.toLowerCase(),
                    )
                  : null;
                const base = String(matched?.answer ?? shot.bot_reply).trim();
                const { smartAnswer } = await import("@/lib/telegram-bot.server");
                const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
                const rates = await loadRates();
                const ans = await smartAnswer({
                  name: senderName,
                  question:
                    `ইউজার একটু আগে যে স্ক্রিনশট পাঠিয়েছে সেটার ব্যাপারেই জানতে চাইছে: "${t}" — মানে ঐ সমস্যাটা কেন আসে। ` +
                    `নতুন করে স্ক্রিনশট চাইবে না, "কী লেখা উঠছে বলুন" বলবে না, সাধারণ ৩টি কারণের লিস্ট দেবে না। ` +
                    `শুধু ঐ নির্দিষ্ট সমস্যাটি কেন হয় সেটা সহজ বাংলায় বুঝিয়ে বলো এবং করণীয় বলো।`,
                  knowledge:
                    knowledgeText(rates) +
                    `\n\n🖼 ইউজারের আগের স্ক্রিনশটে শনাক্ত হওয়া সমস্যা: ${topic || "(আগের রিপ্লাই দেখো)"}\n` +
                    `ঐ সমস্যার নির্ধারিত উত্তর:\n${base}`,
                  pastReplies: [String(shot.bot_reply)],
                });
                const out = ans && ans.trim() && ans.trim() !== "NO_ANSWER" ? ans : base;
                await sendMessage(chatId, out, msg.message_id);
                await logMessage("question", `shot-followup:${topic || "prev"}`, out, null);
                return Response.json({ ok: true, flow: "screenshot-followup" });
              }
            } catch (e) {
              console.error("[tg] screenshot follow-up failed", e);
            }
          }
        }


        // Recent bot replies for this user — used to avoid repeating the same
        // wording and to detect "I already did that, still not working".
        let recentReplies: string[] = [];
        let lastTopic = "";
        let lastBase = "";
        if (msg.from?.id) {
          try {
            const { data: prevN } = await supabaseAdmin
              .from("tg_messages").select("action, bot_reply, created_at")
              .eq("tg_user_id", msg.from.id)
              .order("created_at", { ascending: false }).limit(4);
            recentReplies = (prevN ?? []).map((p: any) => p.bot_reply).filter(Boolean);
            const last: any = (prevN ?? []).find((p: any) => p.bot_reply);
            if (last && Date.now() - new Date(last.created_at).getTime() < 6 * 60 * 60 * 1000) {
              lastTopic = String(last.action ?? "").split(":").slice(1).join(":").trim();
              lastBase = String(last.bot_reply ?? "");
            }
          } catch (e) {
            console.error("[tg] recent replies load failed", e);
          }
        }

        // ---- "X টা স্লট/রি-ভেরিফাই করলে কত টাকা?" → সঠিক হিসাব ----------------
        if (!photoBase64 && settings.auto_reply_enabled && text.trim()) {
          const t = text.trim();
          const bnDigits = t.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
          const miningCtx = /(mining|মাইনিং|maining|minig)/i.test(bnDigits);
          const money =
            /(koto taka|koto tk|কত টাকা|কতো টাকা|income|ইনকাম|আয়|earn|kototaka|koto pabo|কত পাবো|কত পাব|hisab|হিসাব|bujiye|বুঝিয়ে|bujhiye|calculation|হিসেব)/i.test(
              bnDigits,
            );
          const slotCtx =
            miningCtx ||
            /(slot|স্লট|re verify|re-verify|reverify|রি ভেরিফ|রি-ভেরিফ|verification|ভেরিফিকেশন|face)/i.test(bnDigits);
          if (money && slotCtx) {
            try {
              const m = bnDigits.match(/(\d{1,4})\s*(ta|টা|টি|ti|slot|স্লট)?/);
              const n = m ? Number(m[1]) : null;
              const slots = n && n >= 1 && n <= 500 ? n : null;
              const monthly =
                miningCtx ||
                /(mase|মাসে|monthly|মাসিক|per month|প্রতি মাস|mas e|প্রতিমাসে)/i.test(bnDigits);

              const { loadRates, slotEarningReply } = await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const reply = slotEarningReply(senderName, rates, slots, monthly);
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", `slot-earning:${slots ?? "general"}`, reply, null);
              return Response.json({ ok: true, flow: "slot-earning" });
            } catch (e) {
              console.error("[tg] slot earning reply failed", e);
            }
          }
        }

        // ---- "already tried, still not working" → think, don't repeat --------
        if (!photoBase64 && settings.auto_reply_enabled && text.trim() && lastBase) {
          const t = text.trim();
          const stillFailing =
            t.length <= 160 &&
            /(tao hoi na|tao hoy na|tao hocche na|tao hoche na|তবুও হয় না|তবু হয় না|তাও হয় না|তাও হচ্ছে না|তবুও হচ্ছে না|korchi tao|korlam tao|kore o hoy na|kore dekhsi|করেছি তবুও|করলাম তবুও|same problem|ekhono hoy na|এখনো হয় না|এখনও হচ্ছে না|abaro same|আবারও একই|hocche na vai|hoy nai)/i.test(t);
          if (stillFailing) {
            try {
              const { smartAnswer } = await import("@/lib/telegram-bot.server");
              const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const ans = await smartAnswer({
                name: senderName,
                question:
                  `ইউজার আগের দেওয়া সমাধানের ধাপগুলো করেও সফল হয়নি, বলছে: "${t}". ` +
                  `একই মেসেজ আবার হুবহু দেবে না, আগের ধাপগুলোর লিস্ট আবার লিখবে না। ` +
                  `নিজে চিন্তা করে নতুন করে বলবে — যেমন: ধাপগুলো ঠিকভাবে করলে সাধারণত হয়ে যায়, ` +
                  `কিন্তু তার ফোনে/ব্রাউজারে সমস্যা থাকতে পারে, তাই অন্য একটি ফোনে তার আইডি লগইন করে ঐ ফোন দিয়ে ফেস ভেরিফিকেশনের কাজটি চালিয়ে যেতে বলবে — এভাবে করলে সাধারণত হয়ে যায়। ` +
                  `সাথে ছোট করে ১-২টি ভিন্ন টিপস দিতে পারে (নতুন ব্রাউজার, মোবাইল ডেটা, একটু পরে চেষ্টা)। ` +
                  `ভাষা হবে সহজ, আন্তরিক বাংলা এবং প্রতিবার একটু ভিন্নভাবে গোছানো।`,
                knowledge:
                  knowledgeText(rates) +
                  (lastTopic ? `\n\n🔁 আগের শনাক্ত হওয়া সমস্যা: ${lastTopic}` : "") +
                  `\n\nআগে যে উত্তর দেওয়া হয়েছিল (এটা আর হুবহু বলা যাবে না):\n${lastBase}`,
                pastReplies: recentReplies,
              });
              if (ans && ans.trim() && ans.trim() !== "NO_ANSWER") {
                await sendMessage(chatId, ans, msg.message_id);
                await logMessage("question", `still-failing:${lastTopic || "prev"}`, ans, null);
                return Response.json({ ok: true, flow: "still-failing" });
              }
            } catch (e) {
              console.error("[tg] still-failing follow-up failed", e);
            }
          }
        }

        // ---- Admin panel FAQ: deterministic keyword/topic match --------------
        if (!photoBase64 && settings.auto_reply_enabled && text.trim() && (faqRows ?? []).length) {
          try {
            const hay = ` ${text.toLowerCase()} `;
            const scoredAdmin = (faqRows ?? [])
              .map((f: any) => {
                const raw: string[] = Array.isArray(f.keywords)
                  ? f.keywords
                  : String(f.keywords ?? "").split(/[,\n]/);
                const keys = [...raw, ...String(f.topic ?? "").split(/[\s,/|—-]+/)]
                  .map((k) => String(k).trim().toLowerCase())
                  .filter((k) => k.length > 2);
                const score = keys.filter((k) => hay.includes(k)).length;
                return { f, score };
              })
              .sort((a, b) => b.score - a.score)[0];
            if (scoredAdmin && scoredAdmin.score >= 2 && scoredAdmin.f.answer) {
              const { humanizeReply } = await import("@/lib/telegram-bot.server");
              const base = String(scoredAdmin.f.answer).trim();
              const reply = (await humanizeReply(base, text, recentReplies)) || base;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", `faq-admin:${scoredAdmin.f.topic}`, reply, null);
              return Response.json({ ok: true, flow: "faq-admin-text" });
            }
          } catch (e) {
            console.error("[tg] admin faq text match failed", e);
          }
        }

        // Plain-text match against the built-in problem library.
        if (!photoBase64 && settings.auto_reply_enabled && text.trim()) {
          try {
            const { matchBuiltinFaqText, builtinFaqReply } = await import("@/lib/telegram-builtin-faq.server");
            const hit = matchBuiltinFaqText(text);
            if (hit) {
              const { humanizeReply } = await import("@/lib/telegram-bot.server");
              const base = builtinFaqReply(senderName, hit);
              const reply = (await humanizeReply(base, text, recentReplies)) || base;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", `faq-builtin:${hit.topic}`, reply, null);
              return Response.json({ ok: true, flow: "faq-builtin-text" });
            }
          } catch (e) {
            console.error("[tg] builtin faq text match failed", e);
          }
        }



        let decision = {
          verdict: "ok" as const, reply: null as string | null,
          should_delete: false, should_warn: false, uid: null as string | null,
          needs_uid: false, intent: null, slot: null,
        } as Awaited<ReturnType<typeof decide>>;

        // Conversation context reused by every later answer path (smartAnswer,
        // escalation, final fallback) so follow-up questions keep their thread.
        let convoHistory: string[] = [];
        let convoReplies: string[] = [];
        let recallText = "";

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
          convoHistory = history;
          convoReplies = pastReplies;

          // Group memory: what was asked & answered before for the same topic.
          try {
            const { recallSimilar } = await import("@/lib/telegram-bot.server");
            recallText = await recallSimilar(text || shotText);
          } catch (e) {
            console.error("[tg] recall failed", e);
          }

          try {
            const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
            const rates = await loadRates();
            decision = await decide({
              persona: settings.persona,
              rules: settings.rules,
              knowledge: knowledgeText(rates) + recallText,
              faq,
              videos: (videoRows ?? []) as any[],
              voices: ((voiceRows ?? []) as any[]).map((v: any) => ({
                topic: v.topic, keywords: v.keywords, note: v.note,
              })),
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

        // ---- "উইথড্র দিতে পারব?" → answer rules, never show old UID card -----
        if (withdrawEligibilityQuestion && !decision.should_delete && settings.auto_reply_enabled) {
          const { withdrawEligibilityReply } = await import("@/lib/telegram-knowledge.server");
          const reply = decision.reply && !photoBase64 && !decision.needs_uid && decision.intent !== "withdraw_status"
            ? decision.reply
            : withdrawEligibilityReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("withdraw-eligibility");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "withdraw_eligibility", actions });
        }

        // ---- "উইথড্র দিয়েছি টাকা আসে নাই" → show pending requests with time ---
        if ((decision.intent === "withdraw_status" || pendingWithdrawQuestion) && !decision.should_delete
            && settings.auto_reply_enabled) {
          const uid = hasExplicitUid ? (decision.uid || pickUid(norm)) : null;
          if (uid) {
            const { buildWithdrawStatusCard } = await import("@/lib/telegram-withdraw.server");
            const res = await buildWithdrawStatusCard(uid);
            const reply = res.found
              ? res.card
              : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। প্রোফাইল পেজ থেকে সঠিক UID টি দেখে লিখুন।`;
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("withdraw-status");
            await logMessage(decision.verdict, actions.join(","), reply, res.found ? uid : null);
            return Response.json({ ok: true, flow: "withdraw_status", actions });
          }
          const { withdrawEligibilityReply } = await import("@/lib/telegram-knowledge.server");
          const ask = pendingWithdrawQuestion
            ? `দুঃখিত ${senderName}, আপনার পেমেন্ট দেরি হওয়ায় আমরা আন্তরিকভাবে দুঃখিত 🙏\n\n` +
              `দয়া করে আপনার <b>UID</b> নম্বরটি লিখুন।\nUID পেলেই আমি আপনার pending/paid withdraw request, সময় ও status দেখে জানিয়ে দেব।`
            : withdrawEligibilityReply(senderName);
          if (pendingWithdrawQuestion && msg.from?.id) {
            await saveSession({ intent: "withdraw_status", step: "await_uid", uid: null, app_user_id: null });
          }
          await sendMessage(chatId, ask, msg.message_id);
          actions.push(pendingWithdrawQuestion ? "withdraw-ask-uid" : "withdraw-rule");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "withdraw_status", actions });
        }

        // ---- "কিভাবে টাকা পাবো" → full earning guide -------------------------
        if (decision.intent === "earning_info" && !decision.should_delete
            && settings.auto_reply_enabled) {
          const { loadRates, earningGuideReply } = await import("@/lib/telegram-knowledge.server");
          const reply = decision.reply
            ? `${decision.reply}\n\n${earningGuideReply(senderName, await loadRates())}`
            : earningGuideReply(senderName, await loadRates());
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("earning-info");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "earning_info", actions });
        }

        // ---- "১ম verify কবে/কত তারিখে হয়েছে?" → ask UID, then report dates --
        const dateKind = verificationDateKind(norm);
        if (dateKind && !decision.should_delete && settings.auto_reply_enabled) {
          const query = pickVerificationQuery(norm);
          if (query) {
            const { buildVerificationDateReport } = await import("@/lib/telegram-lookup.server");
            const res = await buildVerificationDateReport(query, dateKind);
            const reply = res.found
              ? res.card
              : (res as any).ambiguous?.length
                ? `একই নামে একাধিক ইউজার পাওয়া গেছে। সঠিক UID লিখুন:\n${(res as any).ambiguous.map((p: any) => `• ${p.display_name || "ইউজার"} — UID <code>${p.uid_seq ?? "—"}</code>`).join("\n")}`
                : `❌ <code>${query}</code> দিয়ে কোনো ইউজার পাওয়া যায়নি। সঠিক UID লিখুন।`;
            await sendMessage(chatId, reply, msg.message_id);
            actions.push(`verification-date:${dateKind}`);
            await logMessage(decision.verdict, actions.join(","), reply, res.found ? res.uid : null);
            return Response.json({ ok: true, flow: "verification-date", actions });
          }

          await saveSession({
            intent: "verification_dates",
            step: "await_uid",
            data: { kind: dateKind },
            uid: null,
            app_user_id: null,
          });
          const label = dateKind === "reverify" ? "রি-ভেরিফাই" : dateKind === "all" ? "ভেরিফিকেশন" : "১ম ভেরিফাই";
          const reply = `🗓️ ${label} তারিখ দেখে দিচ্ছি।\nযার রিপোর্ট চান, তার <b>UID</b> লিখুন (যেমন: 4100)।`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push(`verification-date-ask-uid:${dateKind}`);
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "verification-date-ask-uid", actions });
        }

        // ---- "আমার কয়টা রেফার/ভেরিফাই/ব্যালেন্স?" → UID নিয়ে একাউন্ট কার্ড -----
        if (asksOwnAccount && !decision.should_delete
            && settings.auto_reply_enabled) {
          // ⚠️ কখনোই অনুমান করে অন্য কারো UID দেখানো যাবে না।
          // শুধু (ক) এই মেসেজেই স্পষ্ট UID লেখা থাকলে, অথবা
          // (খ) এই টেলিগ্রাম একাউন্টটি নিজেই কোনো প্রোফাইলের সাথে লিংক করা থাকলে।
          let uid: string | null = hasExplicitUid ? pickUid(norm) : null;
          if (!uid && msg.from?.id) {
            const { data: linked } = await supabaseAdmin
              .from("profiles").select("uid_seq").eq("telegram_user_id", msg.from.id).maybeSingle();
            if (linked?.uid_seq != null) uid = String(linked.uid_seq);
          }
          if (uid) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            const res = await buildUserCard(String(uid));
            if (res.found) {
              await sendMessage(chatId, res.card, msg.message_id);
              actions.push("account-info");
              await logMessage(decision.verdict, actions.join(","), res.card, String(uid));
              return Response.json({ ok: true, flow: "account_info", actions });
            }
          }

          if (msg.from?.id) {
            await saveSession({ intent: "account_info", step: "await_uid", uid: null, app_user_id: null });
          }
          const ask =
            `🆔 ${senderName}, আপনার হিসাবটা এখনই দেখে দিচ্ছি।\n\n` +
            `দয়া করে আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন, যেমন: 4100)।\n` +
            `UID পেলেই আপনার মোট রেফার, ১ম ভেরিফাই, রি-ভেরিফাই, ব্যালেন্স ও উইথড্র — সব একসাথে জানিয়ে দেব 💙`;
          await sendMessage(chatId, ask, msg.message_id);
          actions.push("account-info-ask-uid");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "account_info_ask_uid", actions });
        }



        // ---- "কী কী লাগে / কোনো ডকুমেন্ট লাগে?" → requirements answer --------
        const asksRequirements =
          /(ki ki lage|কি কি লাগে|কী কী লাগে|ki lage|কি লাগে|কী লাগে|ki dorkar|কি দরকার|কী দরকার|what.*(need|require)|requirement|nid|এনআইডি|জাতীয় পরিচয়|birth certificate|জন্ম নিবন্ধন|passport|পাসপোর্ট|document|ডকুমেন্ট|কাগজ)/i
            .test(norm);
        if (asksRequirements && !decision.should_delete && settings.auto_reply_enabled) {
          const { verifyRequirementsReply } = await import("@/lib/telegram-knowledge.server");
          const reply = verifyRequirementsReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("verify-requirements");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "verify_requirements", actions });
        }

        // ---- "ভিডিও দিন / কিভাবে করবো" → tutorial video link -----------------
        const howToWork = /(kivabe|kivbe|kibhabe|কিভাবে|কীভাবে|kmne|kemne|কেমনে)[^\n]{0,30}(kaj|কাজ|use|চালাব|করব|করবো|করতে হয়|start|শুরু|verify|ভেরিফাই|verification|ভেরিফিকেশন|face|ফেস|withdraw|উইথড্র|refer|রেফার)/i.test(norm)
          || /(video|ভিডিও|টিউটোরিয়াল|tutorial|dekhiye|দেখিয়ে)/i.test(norm);
        if ((decision.intent === "video_request" || howToWork) && !decision.should_delete
            && settings.auto_reply_enabled) {
          const list = (videoRows ?? []) as any[];
          const topic = (decision as any).media_topic as string | null;
          const hay = norm.toLowerCase();
          const match =
            (topic && list.find((v) => String(v.topic).trim().toLowerCase() === topic.trim().toLowerCase())) ||
            list.find((v: any) => (v.keywords ?? []).some((k: string) => k && hay.includes(String(k).toLowerCase()))) ||
            null;
          const { videoReply, DEFAULT_TUTORIAL_VIDEO } = await import("@/lib/telegram-bot.server");
          const url = match?.url || (settings as any).default_video_url || DEFAULT_TUTORIAL_VIDEO;
          const reply = videoReply(senderName, url, match?.topic ?? null, match?.note ?? null);
          await sendMessage(chatId, reply);
          actions.push("video");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "video", actions });
        }

        // ---- "একাউন্ট/ভেরিফাই হয় না" → browser + face rules -----------------
        // Only fire the fixed tips list when the user really reports a failure;
        // otherwise the AI answers the actual question below.
        const reportsVerifyFailure =
          /(হয় না|hoy na|hoi na|হচ্ছে না|hocche na|পারছি না|parchi na|parteci na|error|এরর|fail|ফেইল|problem|somossa|সমস্যা|আসে না|ashe na|নিচ্ছে না|niche na|আটকে|atke|wrong|ভুল)/i
            .test(norm);
        if (decision.intent === "verify_help" && reportsVerifyFailure && !decision.should_delete
            && settings.auto_reply_enabled) {
          const { verifyTipsReply } = await import("@/lib/telegram-knowledge.server");
          const reply = verifyTipsReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("verify-help");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "verify_help", actions });
        }





        // ---- screenshot fallback before normal text reply ---------------------
        // If the AI gives a vague greeting or tries to ask UID for a screenshot,
        // read the screenshot directly and answer from app rules instead.
        const vaguePhotoReply = !!decision.reply &&
          /(কীভাবে সাহায্য|কিভাবে সাহায্য|সহায়তা করতে পারি|help করতে পারি|বলুন|জানাতে পারেন|কি সমস্যা)/i.test(decision.reply);
        if (settings.auto_reply_enabled && photoBase64
            && !decision.should_delete && decision.intent === null
            && (!decision.reply || decision.needs_uid || vaguePhotoReply)) {
          const { analyzeScreenshotReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const reply = await analyzeScreenshotReply({
            photoBase64,
            name: senderName,
            text: shotText ? `${text}\n\n[স্ক্রিনশটের লেখা]\n${shotText}` : text,
            knowledge: knowledgeText(await loadRates()),
          });
          if (reply) {
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("photo-analysis");
            await logMessage("question", actions.join(","), reply, null);
            return Response.json({ ok: true, flow: "photo-analysis", actions });
          }
        }

        // ---- pick a saved voice note for this topic, if the admin recorded one -
        const voiceMatch = (() => {
          const list = (voiceRows ?? []) as any[];
          if (!list.length || decision.should_delete || decision.intent === "slot_reset") return null;
          const topic = (decision as any).media_topic as string | null;
          if (topic) {
            const byTopic = list.find(
              (v) => String(v.topic).trim().toLowerCase() === topic.trim().toLowerCase(),
            );
            if (byTopic) return byTopic;
          }
          const hay = norm;
          return list.find((v: any) =>
            (v.keywords ?? []).some((k: string) => k && hay.includes(String(k).toLowerCase())),
          ) ?? null;
        })();

        if (settings.auto_reply_enabled && decision.reply && !decision.should_delete
            && decision.intent !== "slot_reset") {
          await sendMessage(chatId, decision.reply, msg.message_id);
          actions.push("replied");
        }

        if (settings.auto_reply_enabled && voiceMatch) {
          const { voiceBytes, sendVoice } = await import("@/lib/telegram-bot.server");
          const bytes = await voiceBytes(voiceMatch.audio_path);
          if (bytes) {
            await sendVoice(
              chatId, bytes, voiceMatch.audio_path.split("/").pop() || "voice.ogg",
              `🎧 <b>${voiceMatch.topic}</b>${voiceMatch.note ? ` — ${voiceMatch.note}` : ""}`,
              msg.message_id,
            );
            actions.push("voice");
          }
        }

        // ---- screenshot with no FAQ match → read the screenshot and explain ----
        if (settings.auto_reply_enabled && photoBase64 && !decision.reply && !voiceMatch
            && !decision.should_delete && decision.intent === null) {
          const { analyzeScreenshotReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const reply = await analyzeScreenshotReply({
            photoBase64,
            name: senderName,
            text: shotText ? `${text}\n\n[স্ক্রিনশটের লেখা]\n${shotText}` : text,
            knowledge: knowledgeText(await loadRates()),
          });
          if (reply) {
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("photo-analysis");
            await logMessage("question", actions.join(","), reply, matchedUid);
            return Response.json({ ok: true, flow: "photo-analysis", actions });
          }
        }

        // ---- nothing matched → let the AI analyse the app and answer ---------
        if (settings.auto_reply_enabled && !decision.reply && !voiceMatch
            && !decision.should_delete && !decision.needs_uid && !matchedUid
            && decision.intent === null && !decision.escalate
            && (decision.verdict === "question" || !!photoBase64 || !!voiceHeard)) {
          const { smartAnswer, escalateReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const faqText = (faqRows ?? [])
            .slice(0, 40)
            .map((f: any) => `• ${f.topic}: ${String(f.answer ?? "").slice(0, 400)}`)
            .join("\n");
          const smart = await smartAnswer({
            name: senderName,
            question: text,
            knowledge: knowledgeText(await loadRates()),
            faqs: faqText,
            history: convoHistory,
            pastReplies: convoReplies,
            recall: recallText,
          });
          const mention = (settings as any).admin_mention
            || (settings as any).support_username || "@anamulmunni";
          const reply = smart || `${escalateReply(senderName, mention)}\n${mention}`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push(smart ? "smart-answer" : "escalated");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: smart ? "smart-answer" : "escalated", actions });
        }


        // ---- bot genuinely doesn't know → hand off to the human admin --------
        if (!decision.reply && decision.escalate && !decision.should_delete
            && !decision.needs_uid && decision.intent === null
            && settings.auto_reply_enabled && (settings as any).escalate_enabled !== false) {
          const { escalateReply, smartAnswer } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const smart = await smartAnswer({
            name: senderName,
            question: text,
            knowledge: knowledgeText(await loadRates()),
            history: convoHistory,
            pastReplies: convoReplies,
            recall: recallText,
          });
          const mention = (settings as any).admin_mention
            || (settings as any).support_username || "@anamulmunni";
          const reply = smart
            ? smart
            : `${escalateReply(senderName, mention)}\n${mention}`;
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

          // Only look an account up when the user really meant a UID —
          // never because a general question happened to contain a number
          // (e.g. "10 ta verify korar por kotodin por re verify?").
          const explicitUid = hasExplicitUid;
          // A bare word like "yes", "ok", "thanks" is NOT a UID. Only accept a
          // pure number, or a referral-code-like token that contains a digit.
          const bareToken = norm.trim().match(/^[#\s]*([A-Za-z0-9]{2,9})[\s.!]*$/)?.[1] ?? null;
          const isUidLike = (v: string | null) =>
            !!v && (/^\d{2,9}$/.test(v) || (/\d/.test(v) && /^[A-Za-z0-9]{6,9}$/.test(v)));
          const onlyValue = isUidLike(bareToken) ? bareToken : null;
          const explicitUidValue = norm.match(/(?:uid|ইউআইডি|আইডি|আই ডি|id\s*no|আইডি নাম্বার)\s*[:#-]?\s*([A-Za-z0-9]{2,10})/i)?.[1] ?? null;
          const rawCandidate = explicitUid ? (explicitUidValue || decision.uid || pickUid(norm)) : onlyValue;
          const candidate = isUidLike(rawCandidate) ? rawCandidate : null;



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
          } else if (decision.needs_uid && settings.auto_reply_enabled && pendingWithdrawQuestion) {
            await sendMessage(
              chatId,
              `🔎 ${(settings as any).ask_uid_message || "আপনার Good-App UID টি লিখুন।"}`,
              msg.message_id,
            );
            actions.push("asked-uid");
          }
        }

        // ---- শেষ রক্ষা: কোনো উত্তরই পাঠানো হয়নি → চুপ না থেকে উত্তর/UID চাই ----
        const repliedSomething = actions.some((a) =>
          /replied|answer|voice|video|card|escalat|account|withdraw|verify|photo|asked/i.test(a),
        );
        if (settings.auto_reply_enabled && !repliedSomething && !decision.should_delete
            && (text.trim() || photoBase64)) {
          const { smartAnswer, escalateReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const mention = (settings as any).admin_mention
            || (settings as any).support_username || "@anamulmunni";
          let reply: string | null = null;
          if (decision.needs_uid) {
            if (msg.from?.id) {
              await saveSession({ intent: "account_info", step: "await_uid", uid: null, app_user_id: null });
            }
            reply =
              `🆔 ${senderName}, আপনার একাউন্টের তথ্য দেখে জানাতে আপনার <b>UID</b> নম্বরটি দরকার।\n` +
              `দয়া করে UID টি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন) — সাথে সাথেই সব হিসাব জানিয়ে দেব 💙`;
          } else {
            reply = await smartAnswer({
              name: senderName,
              question: text,
              knowledge: knowledgeText(await loadRates()),
              history: convoHistory,
              pastReplies: convoReplies,
              recall: recallText,
            });
          }
          if (!reply) reply = `${escalateReply(senderName, mention)}\n${mention}`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("fallback-answer");
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
