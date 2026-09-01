// Telegram bot webhook — receives group messages, moderates + auto-replies.
import { createFileRoute } from "@tanstack/react-router";

// একই ইউজারের জন্য service-message আর chat_member দুইবার welcome ঠেকাতে ছোট ক্যাশ।
const recentWelcomes = new Map<string, number>();
function alreadyWelcomed(key: string) {
  const now = Date.now();
  for (const [k, t] of recentWelcomes) if (now - t > 5 * 60_000) recentWelcomes.delete(k);
  if (recentWelcomes.has(key)) return true;
  recentWelcomes.set(key, now);
  return false;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          getBotToken,
          webhookSecretFor,
          sendMessage,
          deleteMessage,
          restrictUser,
          getPhotoBase64,
          decide,
          faqImageBase64,
          isChatAdmin,
          getMe,
          adminCompose,
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

        // ⚡ Fast-pay: অ্যাডমিন টেলিগ্রাম থেকেই withdraw paid/বাতিল করতে পারে।
        if (update?.callback_query) {
          const { handleFastPayCallback } = await import("@/lib/withdraw-fastpay.server");
          if (await handleFastPayCallback(update))
            return Response.json({ ok: true, fastpay: true });
        }

        // নতুন মেম্বার join হলে Telegram কখনো service message পাঠায়, কখনো শুধু
        // chat_member update পাঠায় (invite link / approval দিয়ে join করলে)।
        const cm = update?.chat_member;
        const cmJoined =
          cm &&
          ["left", "kicked"].includes(cm.old_chat_member?.status) &&
          ["member", "restricted"].includes(cm.new_chat_member?.status) &&
          !cm.new_chat_member?.user?.is_bot
            ? cm.new_chat_member.user
            : null;
        const msg =
          update?.message ??
          update?.edited_message ??
          (cmJoined ? { chat: cm.chat, from: cm.from, new_chat_members: [cmJoined] } : null);
        if (!msg?.chat?.id || typeof update?.update_id !== "number") {
          return Response.json({ ok: true, ignored: true });
        }
        if (!cmJoined && msg.from?.is_bot) return Response.json({ ok: true, ignored: "bot" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: settings } = await supabaseAdmin
          .from("tg_bot_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle();
        if (!settings) return Response.json({ ok: true, disabled: true });
        // "KYC চালু" টগলটি অন থাকলে বটের বাকি সব বন্ধ থাকলেও প্রাইভেট চ্যাটের KYC
        // (/start uid_xxx বা শুধু UID লেখা) সবসময় কাজ করবে। KYC-তে কোনো AI/ক্রেডিট
        // লাগে না — শুধু ডাটাবেসে টেলিগ্রাম ↔ UID লিংক হয়, তাই ক্রেডিট শেষ হলেও চলবে।
        const kycAllowed = (settings as any).kyc_enabled !== false;
        const isKycStart = kycAllowed && msg.chat?.type === "private";
        // বট বন্ধ থাকলেও গ্রুপের নিরাপত্তা গার্ড সবসময় চালু থাকবে — গালি/লিংক/খারাপ
        // ছবি সাথে সাথে ডিলিট + ৩০ মিনিট ফ্রিজ, আর Good-App নিয়ে বাজে মন্তব্য হলে
        // UID জানা থাকলে অ্যাপ অ্যাকাউন্টও ব্লক।
        const botOff = !settings.enabled && !isKycStart;


        const chatId = String(msg.chat.id);
        // group_chat_id এ কমা দিয়ে একাধিক গ্রুপ আইডি রাখা যায়; ফাঁকা থাকলে সব গ্রুপে কাজ করবে।
        const allowedChats = String(settings.group_chat_id ?? "")
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        // প্রাইভেট চ্যাট (KYC/সাপোর্ট DM) সবসময় অনুমোদিত — গ্রুপ হোয়াইটলিস্ট শুধু গ্রুপের জন্য
        const isPrivateChat = msg.chat?.type === "private";
        const { isOwnerIdentity } = await import("@/lib/telegram-owner.server");
        const senderIsOwnerIdentity = isOwnerIdentity(
          msg.from?.username,
          msg.from?.id,
          (settings as any).support_username,
          (settings as any).admin_chat_id,
        );
        const chatAllowed =
          isPrivateChat || allowedChats.length === 0 || allowedChats.includes(chatId);

        // Claim the Telegram update before voice transcription / screenshot OCR.
        // Telegram may retry slow webhook deliveries; the update_id primary key
        // makes this insert an atomic lock so two handlers can never reply twice.
        const initialText = String(msg.text ?? msg.caption ?? "");
        const { error: claimError } = await supabaseAdmin.from("tg_messages").insert({
          update_id: update.update_id,
          chat_id: msg.chat.id,
          message_id: msg.message_id ?? null,
          tg_user_id: msg.from?.id ?? null,
          username: msg.from?.username ?? null,
          full_name:
            [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
            msg.from?.username ||
            "User",
          text: initialText.slice(0, 2000),
          has_photo: !!msg.photo?.length,
          verdict: "processing",
          action: "processing",
          bot_reply: null,
          matched_uid: null,
        });
        if (claimError?.code === "23505") return Response.json({ ok: true, duplicate: true });
        if (claimError) {
          console.error("[tg] update claim failed", claimError.message);
          return Response.json({ ok: false, error: "update-claim-failed" }, { status: 500 });
        }

        // ---- সবসময় চালু নিরাপত্তা গার্ড (গ্রুপে, বট বন্ধ থাকলেও) ----------------
        if (msg.chat?.type === "group" || msg.chat?.type === "supergroup") {
          const guardAdmin =
            senderIsOwnerIdentity || (await isChatAdmin(chatId, msg.from?.id).catch(() => false));
          let guardVoiceText: string | null = null;
          const guardAudio = msg.voice ?? msg.audio ?? msg.video_note ?? null;
          if (!guardAdmin && guardAudio?.file_id) {
            try {
              const { getFileBase64, transcribeAudio } = await import(
                "@/lib/telegram-bot.server"
              );
              const file = await getFileBase64(guardAudio.file_id).catch(() => null);
              if (file) {
                const ext = (file.path.split(".").pop() || "ogg").toLowerCase();
                const fmt = ["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"].includes(ext)
                  ? ext
                  : msg.video_note
                    ? "mp4"
                    : "ogg";
                guardVoiceText = await Promise.race([
                  transcribeAudio(file.base64, fmt).catch(() => null),
                  new Promise<null>((r) => setTimeout(() => r(null), 12_000)),
                ]);
              }
            } catch {
              /* transcription failure must not skip moderation of the text part */
            }
          }
          const { groupSafetyGuard } = await import("@/lib/telegram-safety.server");
          const guarded = await groupSafetyGuard({
            chatId,
            msg,
            settings,
            senderIsAdmin: guardAdmin,
            voiceText: guardVoiceText,
            updateId: update.update_id,
          }).catch((e) => {
            console.error("[tg] safety guard failed", (e as Error)?.message);
            return { handled: false } as const;
          });
          if (guarded.handled) return Response.json({ ok: true, flow: "safety-guard", ...guarded });
        }

        if (botOff) {
          await supabaseAdmin
            .from("tg_messages")
            .update({ verdict: "ignored", action: "bot-off" })
            .eq("update_id", update.update_id);
          return Response.json({ ok: true, disabled: true });
        }



        /**
         * অ্যাডমিন প্যানেলের লগে যেন কোনো মেসেজ চিরকাল "processing" হয়ে পড়ে
         * না থাকে — যেকোনো পথ থেকে বেরোনোর আগে এটি ডেকে ফাইনাল অবস্থা লিখে দেয়।
         */
        const finalizeLog = async (
          verdict: string,
          action: string,
          reply: string | null,
          uid?: string | null,
        ) => {
          await supabaseAdmin
            .from("tg_messages")
            .update({
              verdict,
              action,
              bot_reply: reply,
              matched_uid: uid ?? null,
            })
            .eq("update_id", update.update_id);
        };

        // পুরোনো আটকে থাকা "processing" লগ (webhook timeout/crash) পরিষ্কার করা।
        void supabaseAdmin
          .from("tg_messages")
          .update({ verdict: "done", action: "timed-out" })
          .eq("verdict", "processing")
          .lt("created_at", new Date(Date.now() - 3 * 60_000).toISOString());

        const addChatToAllowList = async () => {
          if (allowedChats.includes(chatId)) return;
          await supabaseAdmin
            .from("tg_bot_settings")
            .update({ group_chat_id: [...allowedChats, chatId].join(",") })
            .eq("id", "default");
        };

        // ---- new members joined → warm welcome -------------------------------
        const joined = (msg.new_chat_members ?? []) as any[];
        if (joined.length) {
          // বটকে নতুন গ্রুপে অ্যাড করা হলে সেই গ্রুপটি নিজে থেকেই অনুমোদিত তালিকায় যোগ হবে।
          const me = await getMe().catch(() => null);
          if (
            me &&
            joined.some((m: any) => m?.is_bot && (m.id === me.id || m.username === me.username))
          ) {
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
              if (alreadyWelcomed(`${chatId}:${m.id}`)) continue;
              const nm =
                [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username || "বন্ধু";
              await sendMessage(
                chatId,
                welcomeReply(
                  nm,
                  (settings as any).welcome_message ?? null,
                  (settings as any).default_video_url ?? null,
                  {
                    websiteUrl: (settings as any).website_url ?? null,
                    downloadUrl: (settings as any).download_url ?? null,
                  },
                ),
              );
            }
          }
          return Response.json({ ok: true, flow: "welcome" });
        }
        // ---- /start → টেলিগ্রাম অ্যাকাউন্ট লিংক (এটাই আমাদের KYC) ----------
        // নিয়ম: একটি টেলিগ্রাম অ্যাকাউন্ট দিয়ে শুধু একটি UID-ই KYC হবে।
        const startTextRaw: string = String(msg.text ?? "").trim();
        if (msg.chat?.type === "private" && /^\/start\b/i.test(startTextRaw)) {
          const payload = startTextRaw.split(/\s+/)[1] ?? "";
          const uidMatch = /^uid[_-]?(\d+)$/i.exec(payload);
          const who = msg.from?.first_name || "বন্ধু";

          // এই টেলিগ্রামটি আগে কোনো UID-তে ব্যবহার হয়েছে কি না
          let existing: { uid_seq: number | null; display_name: string | null } | null = null;
          if (msg.from?.id) {
            const { data } = await supabaseAdmin
              .from("profiles")
              .select("uid_seq, display_name")
              .eq("telegram_user_id", msg.from.id)
              .maybeSingle();
            existing = (data as any) ?? null;
          }

          if (existing) {
            const sameUid =
              uidMatch && String(existing.uid_seq ?? "") === String(Number(uidMatch[1]));
            await sendMessage(
              chatId,
              `🤖 <b>স্বাগতম ${who}!</b>\n\n` +
                (sameUid
                  ? `✅ <b>আপনার KYC আগেই সম্পন্ন আছে</b>\nUID <b>${existing.uid_seq}</b> — ${existing.display_name || "ইউজার"}\nপ্রোফাইলে নীল ✔ ব্যাজ ও উইথড্র চালু আছে 💙`
                  : `⚠️ <b>এই টেলিগ্রাম অ্যাকাউন্টটি দিয়ে আগেই KYC করা হয়েছে</b>\n\n` +
                    `🔗 যুক্ত আছে: UID <b>${existing.uid_seq}</b> — ${existing.display_name || "ইউজার"}\n\n` +
                    `📌 নিয়ম: <b>একটি টেলিগ্রাম = একটি অ্যাকাউন্টের KYC</b>। তাই নতুন অ্যাকাউন্টের KYC এই টেলিগ্রাম দিয়ে হবে না।\n` +
                    `👉 নতুন অ্যাকাউন্টটির KYC করতে <b>অন্য একটি টেলিগ্রাম নম্বর</b> ব্যবহার করুন।\n` +
                    `🙏 ভুল হলে বা এটি আপনার নিজের পুরোনো আইডি হলে সাপোর্টে জানান — আমরা দেখে ঠিক করে দেব।`) +
                `\n\nযেকোনো প্রশ্ন লিখে বা ভয়েস পাঠিয়ে জিজ্ঞেস করুন — আমি সাথে সাথেই সাহায্য করব 💙`,
            );
            return Response.json({ ok: true, flow: "start-already-linked" });
          }

          let linkedUid: string | null = null;
          let uidTakenBy: string | null = null;
          if (uidMatch && msg.from?.id) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("id, uid_seq, telegram_user_id")
              .eq("uid_seq", Number(uidMatch[1]))
              .maybeSingle();
            if (prof && (prof as any).telegram_user_id) {
              uidTakenBy = String((prof as any).uid_seq ?? "");
            } else if (prof) {
              await supabaseAdmin
                .from("profiles")
                .update({
                  telegram_user_id: msg.from.id,
                  kyc_verified: true,
                  kyc_verified_at: new Date().toISOString(),
                })
                .eq("id", prof.id);
              linkedUid = String(prof.uid_seq ?? "");
            }
          }
          await sendMessage(
            chatId,
            `🤖 <b>স্বাগতম ${who}!</b>\n\n` +
              (linkedUid
                ? `✅ <b>KYC সম্পন্ন হয়েছে!</b>\nআপনার অ্যাকাউন্ট (UID <b>${linkedUid}</b>) ভেরিফাই হয়ে গেছে — প্রোফাইলে নীল ✔ ব্যাজ পেয়ে যাবেন এবং এখন উইথড্র করতে পারবেন।\nআর কখনো UID লিখতে হবে না 💙`
                : uidTakenBy
                  ? `⚠️ <b>UID ${uidTakenBy} এর KYC আগেই অন্য একটি টেলিগ্রাম দিয়ে করা আছে</b>\n\n📌 নিয়ম: একটি অ্যাকাউন্টের KYC একবারই হয়। এটি আপনার নিজের আইডি হলে সাপোর্টে জানান 🙏`
                  : `🔐 <b>KYC ভেরিফিকেশন (মাত্র ১ ধাপ)</b>\n\nআপনার Good-App এর <b>UID নম্বরটি</b> এখানে লিখে পাঠান — ব্যাস, KYC হয়ে যাবে।\n\n👉 UID কোথায়? অ্যাপের হোম পেজে নামের নিচে <b>UID</b> লেখা বাটনেই আছে।\n\n📌 মনে রাখবেন: <b>একটি টেলিগ্রাম দিয়ে একটি অ্যাকাউন্টেরই KYC</b> হবে।\n\n✅ KYC করলে: প্রোফাইলে <b>নীল ✔ ব্যাজ</b>, অ্যাকাউন্ট ভেরিফাইড, এবং <b>উইথড্র চালু</b>।\n❌ KYC না করলে টাকা তোলা যাবে না (বাকি সব কাজ চলবে)।`) +
              `\n\nযেকোনো প্রশ্ন লিখে বা ভয়েস পাঠিয়ে জিজ্ঞেস করুন — আমি সাথে সাথেই সাহায্য করব 💙`,
          );
          return Response.json({ ok: true, flow: "start" });
        }

        if (!chatAllowed) return Response.json({ ok: true, ignored: "other-chat" });
        if (msg.left_chat_member) return Response.json({ ok: true, ignored: "left" });

        let text: string = msg.text ?? msg.caption ?? "";
        const photos = msg.photo as { file_id: string }[] | undefined;
        const senderName =
          [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
          msg.from?.username ||
          "User";

        // ---- voice note / audio clip → transcribe BEFORE admin/mention logic ----
        // Admin voice replies were previously ignored because the admin-silence
        // guard ran before transcription, so text was still empty. From here on,
        // every path (admin mention, normal support, fallback agent) sees the
        // current voice message as normal text.
        const audioMsg = msg.voice ?? msg.audio ?? msg.video_note ?? null;
        let voiceHeard: string | null = null;
        const captionText = text.trim();
        // KYC (প্রাইভেট চ্যাট) কখনোই AI/ক্রেডিটের উপর নির্ভর করবে না — DM-এ ভয়েস এলে
        // ট্রান্সক্রিপশন না করে সরাসরি UID লিখে পাঠাতে বলা হবে।
        if (audioMsg?.file_id && isPrivateChat && !captionText && !senderIsOwnerIdentity) {
          const kycVoiceReply = `🔐 এখানে শুধু <b>KYC</b> হয়।\nআপনার <b>UID নম্বরটি লিখে</b> পাঠান — সাথে সাথে KYC হয়ে যাবে 💙`;
          await sendMessage(chatId, kycVoiceReply, msg.message_id);
          await supabaseAdmin
            .from("tg_messages")
            .update({
              verdict: "question",
              action: "dm-voice-kyc-hint",
              bot_reply: kycVoiceReply,
            })
            .eq("update_id", update.update_id);
          return Response.json({ ok: true, flow: "dm-voice-kyc-hint" });
        }
        if (audioMsg?.file_id && (!isPrivateChat || senderIsOwnerIdentity)) {
          const { getFileBase64, transcribeAudio } = await import("@/lib/telegram-bot.server");
          const file = await getFileBase64(audioMsg.file_id).catch(() => null);
          if (file) {
            const ext = (file.path.split(".").pop() || "ogg").toLowerCase();
            const fmt = ["wav", "mp3", "webm", "m4a", "ogg", "aac", "flac"].includes(ext)
              ? ext
              : msg.video_note
                ? "mp4"
                : "ogg";
            // ভয়েস যদি কোনো মেসেজের রিপ্লাই হয়, ওই লেখাটা হিন্ট হিসেবে দিলে
            // অস্পষ্ট/দ্রুত বলা কথাও অনেক ভালো বোঝে।
            const sttHint = String(
              msg.reply_to_message?.text ?? msg.reply_to_message?.caption ?? "",
            ).trim();
            const hear = async () => {
              try {
                return await transcribeAudio(file.base64, fmt, sttHint || undefined);
              } catch (e) {
                console.error("[tg] transcribe failed", (e as Error)?.message);
                return null;
              }
            };
            // A Telegram webhook has a strict response budget. Retrying the
            // full model/key matrix kept updates in "processing" and Telegram
            // retried them every minute. One bounded pass is enough; the user
            // receives a clear fallback when transcription is unavailable.
            voiceHeard = await Promise.race([
              hear(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 16_000)),
            ]);

            if (voiceHeard) voiceHeard = voiceHeard.trim();
            if (voiceHeard)
              text = captionText ? `${captionText}\n${voiceHeard}`.trim() : voiceHeard;
          }
          // Couldn't understand the voice → politely ask again instead of
          // guessing and sending an unrelated answer.
          if (
            (!voiceHeard || voiceHeard.replace(/[^\p{L}\p{N}]/gu, "").length < 3) &&
            !captionText
          ) {
            const who = msg.from?.first_name ? `${msg.from.first_name}, ` : "";
            const fallbackReply = `${who}দুঃখিত 🙏 আপনার ভয়েসটা ঠিকমতো বুঝতে পারিনি।\nএকটু আস্তে করে আবার বলবেন, অথবা লিখে পাঠান — আমি সাথে সাথে সাহায্য করছি 💙`;
            await sendMessage(chatId, fallbackReply, msg.message_id);
            await supabaseAdmin
              .from("tg_messages")
              .update({
                verdict: "question",
                action: "voice-unclear",
                bot_reply: fallbackReply,
              })
              .eq("update_id", update.update_id);
            return Response.json({ ok: true, flow: "voice-unclear" });
          }
        }

        // ---- প্রাইভেট চ্যাটে UID পাঠালেই KYC লিংক হয়ে যাবে ----------------
        if (msg.chat?.type === "private" && msg.from?.id) {
          // ---- মালিক (support_username) ইনবক্সে লিখলে পূর্ণ অ্যাডমিন ক্ষমতা --
          // স্লট/ওয়ালেট রিসেট, সেটিংস পরিবর্তন, UID/হিসাব — সব এখানেই করা যাবে।
          const { runOwnerCommand } = await import("@/lib/telegram-owner.server");
          if (senderIsOwnerIdentity) {
            const res = await runOwnerCommand(text);
            if (res.handled && res.reply) {
              await sendMessage(chatId, res.reply, msg.message_id);
              await finalizeLog("question", res.flow, res.reply);
              return Response.json({ ok: true, flow: res.flow });
            }
            // কমান্ড নয় → AI অ্যাডমিন-মোডে উত্তর দেবে (অন্য ইউজারের ডেটাও দেখতে পারবে)
            const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
            const { appRulebook } = await import("@/lib/telegram-app-rules.server");
            const { agentAnswer } = await import("@/lib/telegram-agent.server");
            const rates = await loadRates();
            const answer = await agentAnswer({
              name: msg.from?.first_name || "স্যার",
              question: text,
              knowledge: knowledgeText(rates),
              rulebook: appRulebook(rates),
              isAdmin: true,
            });
            const reply =
              answer ??
              `🙏 জি স্যার — এখন উত্তর তৈরি করা যাচ্ছে না। একটু পরে আবার বলুন, অথবা সরাসরি কমান্ড দিন (যেমন: <code>uid 4100 এর ৪ নম্বর স্লট রিসেট করো</code>) 💙`;
            await sendMessage(chatId, reply, msg.message_id);
            const flow =
              res.flow === "owner-unhandled" ? "owner-unhandled-ai-fallback" : "owner-dm-answer";
            await finalizeLog("question", flow, reply);
            return Response.json({ ok: true, flow });
          }

          const bare = /^\s*(?:uid|আইডি)?\s*[:#-]?\s*(\d{2,9})\s*$/i.exec(text.trim());
          if (bare) {
            const { data: alreadyLinked } = await supabaseAdmin
              .from("profiles")
              .select("uid_seq, display_name")
              .eq("telegram_user_id", msg.from.id)
              .maybeSingle();
            // একটি টেলিগ্রাম = একটি UID: আগে লিংক থাকলে নতুন UID নেওয়া হবে না
            if (
              alreadyLinked &&
              bare[1].length >= 3 &&
              String((alreadyLinked as any).uid_seq ?? "") !== bare[1]
            ) {
              await sendMessage(
                chatId,
                `⚠️ <b>এই টেলিগ্রাম অ্যাকাউন্টটি দিয়ে আগেই KYC করা হয়েছে</b>\n\n` +
                  `🔗 যুক্ত আছে: UID <b>${(alreadyLinked as any).uid_seq}</b> — ${(alreadyLinked as any).display_name || "ইউজার"}\n\n` +
                  `📌 নিয়ম: <b>একটি টেলিগ্রাম = একটি অ্যাকাউন্টের KYC</b>। নতুন অ্যাকাউন্টের KYC করতে <b>অন্য একটি টেলিগ্রাম</b> ব্যবহার করুন।\n` +
                  `🙏 কোনো ভুল হলে সাপোর্টে জানান — আমরা দেখে ঠিক করে দেব 💙`,
                msg.message_id,
              );
              return Response.json({ ok: true, flow: "kyc-tg-already-used" });
            }
            if (alreadyLinked) {
              await sendMessage(
                chatId,
                `✅ <b>আপনার KYC আগেই সম্পন্ন আছে</b>\nUID <b>${(alreadyLinked as any).uid_seq}</b> — ${(alreadyLinked as any).display_name || "ইউজার"} 💙`,
                msg.message_id,
              );
              return Response.json({ ok: true, flow: "kyc-already" });
            }
            if (!alreadyLinked) {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("id, uid_seq, telegram_user_id, display_name")
                .eq("uid_seq", Number(bare[1]))
                .maybeSingle();
              if (!prof) {
                await sendMessage(
                  chatId,
                  `❌ এই UID (<b>${bare[1]}</b>) আমাদের সিস্টেমে পাওয়া যায়নি।\nঅ্যাপের হোম পেজে নামের নিচে <b>UID</b> বাটনে চাপ দিলে সঠিক নম্বরটি কপি হবে — সেটি পাঠান 💙`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "kyc-uid-notfound" });
              }
              if (prof.telegram_user_id && prof.telegram_user_id !== msg.from.id) {
                await sendMessage(
                  chatId,
                  `⚠️ এই UID টি আগেই অন্য একটি টেলিগ্রাম অ্যাকাউন্টের সাথে যুক্ত করা আছে।\nএটি আপনার নিজের আইডি হলে সাপোর্টে জানান 🙏`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "kyc-uid-taken" });
              }
              await supabaseAdmin
                .from("profiles")
                .update({
                  telegram_user_id: msg.from.id,
                  kyc_verified: true,
                  kyc_verified_at: new Date().toISOString(),
                })
                .eq("id", prof.id);
              await sendMessage(
                chatId,
                `✅ <b>KYC সম্পন্ন! অ্যাকাউন্ট ভেরিফাইড 🎉</b>\n\n` +
                  `UID <b>${prof.uid_seq}</b> — ${prof.display_name || "ইউজার"}\n\n` +
                  `🔵 প্রোফাইলে <b>নীল ✔ ব্যাজ</b> চলে এসেছে\n💸 <b>উইথড্র চালু</b> হয়ে গেছে 💙`,
                msg.message_id,
              );
              return Response.json({ ok: true, flow: "kyc-linked" });
            }
          }

          // DM-এ বট শুধু KYC-ই করবে — বাকি কোনো কথা বলবে না।
          await sendMessage(
            chatId,
            `🔐 এখানে শুধু <b>KYC</b> হয়।\nআপনার <b>UID নম্বরটি</b> লিখে পাঠান — KYC হয়ে যাবে।\n\nঅন্য যেকোনো প্রশ্ন আমাদের <b>গ্রুপে</b> করুন 💙`,
            msg.message_id,
          );
          return Response.json({ ok: true, flow: "dm-kyc-only" });
        }

        // Do not jump into conversations already being handled by a human admin.
        // If an admin writes, or the user replies to an admin's message, stay silent.
        const isBotCommand = /^\/(?:start|help|admin|reset)\b/i.test(text.trim());
        // গ্রুপের মালিক (support_username) সবসময় অ্যাডমিন হিসেবেই গণ্য হবে
        const ownerUsername = String((settings as any).support_username || "@anamulmunni")
          .replace(/^@/, "")
          .toLowerCase();
        const senderIsOwner = (msg.from?.username ?? "").toLowerCase() === ownerUsername;
        const [chatAdminFlag, repliedToAdmin] = await Promise.all([
          isChatAdmin(chatId, msg.from?.id).catch(() => false),
          msg.reply_to_message?.from?.id && !msg.reply_to_message?.from?.is_bot
            ? isChatAdmin(chatId, msg.reply_to_message.from.id).catch(() => false)
            : Promise.resolve(false),
        ]);
        const senderIsAdmin = chatAdminFlag || senderIsOwner;
        // অ্যাডমিনের মেসেজে বট তখনই সাড়া দেবে যখন তাকে সরাসরি মেনশন করা হয়
        // অথবা বটের মেসেজে রিপ্লাই দেওয়া হয়। নাহলে বট চুপ থাকবে (ইউজারের
        // মেসেজে আগের মতোই উত্তর দেবে)।
        const meInfo = await getMe().catch(() => null);
        const mentionsBot = !!meInfo && new RegExp(`@${meInfo.username}\\b`, "i").test(text);
        const repliedToBot = msg.reply_to_message?.from?.id === meInfo?.id;
        const adminAddressedBot = mentionsBot || repliedToBot;
        // Exception: when an admin announces that a password was changed, the bot
        // confirms it to the user instead of staying silent.
        const passwordChanged =
          senderIsAdmin &&
          adminAddressedBot &&
          !isBotCommand &&
          text.trim().length > 0 &&
          /(password|পাসওয়ার্ড|pass ?word)/i.test(text) &&
          /(change|changed|change kora|change kore|পরিবর্তন|চেঞ্জ|বদলে|reset|রিসেট|new password|নতুন পাসওয়ার্ড)/i.test(
            text,
          );
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
        if (senderIsAdmin && !isBotCommand && adminAddressedBot && text.trim()) {
          const order = text.replace(new RegExp(`@${meInfo?.username ?? "___"}`, "ig"), "").trim();
          const targetName =
            msg.reply_to_message && !msg.reply_to_message.from?.is_bot
              ? [msg.reply_to_message.from?.first_name, msg.reply_to_message.from?.last_name]
                  .filter(Boolean)
                  .join(" ")
              : null;
          const replyTo = msg.reply_to_message?.message_id ?? msg.message_id;
          const replyContextText = String(
            msg.reply_to_message?.text ?? msg.reply_to_message?.caption ?? "",
          );

          // ---- অ্যাডমিন মেনশন দিয়ে "এই UID এর ৪ নম্বর স্লট রিসেট করে দাও" বা
          // "ওয়ালেট নম্বর রিসেট করো" বললে বট সাথে সাথেই কাজটা করবে। এটা UID
          // লুকআপের আগেই চলে, নইলে শুধু হিসাব কার্ড দিয়ে থেমে যেত।
          {
            const bnNum = (s: string) =>
              s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
            const cmd = bnNum(`${order} ${replyContextText}`);
            const resetIntent =
              /(reset|রিসেট|রিসেট|muche|মুছে|মুছ|delete|ডিলিট|khali|খালি|clear|ক্লিয়ার|বাদ\s*দা|সরিয়ে|off\s*kore)/i.test(
                cmd,
              );
            if (resetIntent) {
              const slotMod = await import("@/lib/telegram-slot.server");
              const { SLOT_WORD, NUM_WORD, stripSlotMentions } = slotMod;
              const hasSlotWord = new RegExp(SLOT_WORD, "i").test(cmd);
              const walletIntent =
                !hasSlotWord &&
                /(wallet|ওয়ালেট|payment|পেমেন্ট|bkash|বিকাশ|nagad|নগদ|number|নম্বর|নাম্বার)/i.test(
                  cmd,
                );
              const uid =
                cmd.match(/(?:uid|ইউআইডি|আইডি|\bid\b)\s*[:#-]?\s*(\d{2,9})/i)?.[1] ??
                stripSlotMentions(cmd).match(/(?<![\d@])(\d{3,9})(?![\d])/)?.[1] ??
                null;

              if (!uid) {
                await sendMessage(
                  chatId,
                  `🙏 জি স্যার — কাজটি করতে <b>UID</b> লাগবে।\n` +
                    `যেমন লিখুন: <code>@${meInfo?.username ?? "bot"} uid 4100 এর ৪ নম্বর স্লট রিসেট করে দাও</code>`,
                  replyTo,
                );
                return Response.json({ ok: true, flow: "admin-reset-need-uid" });
              }

              if (walletIntent) {
                const { resetPaymentNumbersForUid, walletResetReply } =
                  await import("@/lib/telegram-wallet.server");
                const provider = /(bkash|বিকাশ)/i.test(cmd)
                  ? "bkash"
                  : /(nagad|নগদ)/i.test(cmd)
                    ? "nagad"
                    : /(usdt|ইউএসডিটি)/i.test(cmd)
                      ? "usdt"
                      : null;
                const res = await resetPaymentNumbersForUid(uid, provider);
                await sendMessage(chatId, walletResetReply(res), replyTo);
                return Response.json({ ok: true, flow: "admin-wallet-reset" });
              }

              const found: number[] = [];
              for (const m of cmd.matchAll(
                new RegExp(`(\\d{1,3})\\s*${NUM_WORD}?\\s*(?:er|এর)?\\s*${SLOT_WORD}`, "gi"),
              ))
                found.push(Number(m[1]));
              for (const m of cmd.matchAll(
                new RegExp(`${SLOT_WORD}\\s*${NUM_WORD}?\\s*[:#-]?\\s*(\\d{1,3})`, "gi"),
              ))
                found.push(Number(m[1]));
              const uniq = Array.from(new Set(found.filter((n) => n >= 1 && n <= 500)));
              const wantsAllSlots = /(সব|সবগুলো|সবগুলা|all|full)/i.test(cmd);
              const target =
                uniq.length > 0 ? uniq : wantsAllSlots ? await slotMod.listSlotNumbers(uid) : [];

              if (!target.length) {
                await sendMessage(
                  chatId,
                  `🙏 জি স্যার — UID <code>${uid}</code> এর <b>কোন স্লট</b> রিসেট করব সেটি লিখে দিন ` +
                    `(যেমন: <code>৪ নম্বর স্লট</code> বা <code>সব স্লট</code>)।`,
                  replyTo,
                );
                return Response.json({ ok: true, flow: "admin-reset-need-slot" });
              }

              const res = await slotMod.resetSlotsForUid(uid, target);
              const reply = !res.found
                ? `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি স্যার।`
                : `✅ <b>${res.name}</b> (UID <code>${res.uid ?? uid}</code>) —\n` +
                  (res.done.length ? `🔄 রিসেট হয়েছে: <b>স্লট ${res.done.join(", ")}</b>\n` : "") +
                  (res.failed.length
                    ? res.failed.map((f) => `⚠️ স্লট ${f.slot}: ${f.error}`).join("\n") + "\n"
                    : "") +
                  `এখন নতুন ফেস দিয়ে আবার ভেরিফাই করা যাবে 💙`;
              await sendMessage(chatId, reply, replyTo);
              return Response.json({ ok: true, flow: "admin-slot-reset", done: res.done });
            }
          }

          // ---- মালিক (@anamulmunni) কাউকে mention/reply করে "এই user এর UID কত?"
          // বা তার তথ্য জিজ্ঞেস করলে — সরাসরি UID + হিসাব কার্ড দেবে, ভদ্রভাবে।
          // শুধু owner-ই এই তথ্য পাবে; অন্য কেউ নয়।
          if (senderIsOwner) {
            const ents: any[] = [
              ...((msg as any).entities ?? []),
              ...((msg as any).caption_entities ?? []),
            ];
            const textMention = ents.find((e) => e?.type === "text_mention" && e?.user?.id);
            const repliedUser =
              msg.reply_to_message?.from?.id && !msg.reply_to_message.from?.is_bot
                ? msg.reply_to_message.from
                : null;
            const handle = order.match(/@([A-Za-z0-9_]{4,32})/)?.[1] ?? null;
            const handleIsOther =
              !!handle && handle.toLowerCase() !== (meInfo?.username ?? "").toLowerCase();
            const explicitUid = order.match(/(?:uid|ইউআইডি)\s*[:#-]?\s*(\d{2,9})/i)?.[1] ?? null;

            // মালিক মেনশন/রিপ্লাই করে যেকোনোভাবে তথ্য চাইলেই বট দেবে —
            // শব্দ মিলানোর কড়াকড়ি নেই, শুধু তথ্য-জাতীয় ইঙ্গিত থাকলেই হবে।
            const asksUidOrInfo =
              /(uid|ইউআইডি|আইডি|আই\s*ডি|info|information|details|detail|তথ্য|ডিটেইলস|ডিটেইল|হিসাব|hisab|balance|ব্যালেন্স|earn|আয়|slot|স্লট|withdraw|উইথড্র|mining|মাইনিং|kyc|কেওয়াইসি|profile|প্রোফাইল|number|নম্বর|ke|কে|who)/i.test(
                order,
              ) ||
              /(koto|kt|kx|কত|কতো|\?|ber|বের|dekha|দেখা|dekhao|dao|দাও|daw|janao|জানাও|what|show|check|চেক)/i.test(
                order,
              );

            if (asksUidOrInfo && (explicitUid || textMention || repliedUser || handleIsOther)) {
              const targetLabel =
                (textMention
                  ? [textMention.user.first_name, textMention.user.last_name]
                      .filter(Boolean)
                      .join(" ")
                  : repliedUser
                    ? [repliedUser.first_name, repliedUser.last_name].filter(Boolean).join(" ")
                    : handleIsOther
                      ? `@${handle}`
                      : "") || "ইউজার";

              let uidSeq: number | null = explicitUid ? Number(explicitUid) : null;
              let name: string | null = null;

              if (uidSeq == null) {
                let tgId: number | null = textMention
                  ? Number(textMention.user.id)
                  : repliedUser
                    ? Number(repliedUser.id)
                    : null;
                if (!tgId && handleIsOther) {
                  const { data: seen } = await supabaseAdmin
                    .from("tg_messages")
                    .select("tg_user_id")
                    .ilike("username", handle!)
                    .not("tg_user_id", "is", null)
                    .order("created_at", { ascending: false })
                    .limit(1);
                  const found = (seen ?? [])[0] as { tg_user_id?: number | null } | undefined;
                  if (found?.tg_user_id) tgId = Number(found.tg_user_id);
                }
                if (tgId) {
                  const { data: prof } = await supabaseAdmin
                    .from("profiles")
                    .select("uid_seq, display_name")
                    .eq("telegram_user_id", tgId)
                    .maybeSingle();
                  uidSeq = (prof as any)?.uid_seq ?? null;
                  name = (prof as any)?.display_name ?? null;
                }
              }

              if (uidSeq != null) {
                // মালিক শুধু UID চাইলে পুরো হিসাব দেখাবে না — শুধু UID দেবে।
                const wantsDetails =
                  /(হিসাব|hisab|details?|ডিটেইল|তথ্য|balance|ব্যালেন্স|slot|স্লট|withdraw|উইথড্র|mining|মাইনিং|earn|আয়|পুরো|full|info|information)/i.test(
                    order,
                  );
                if (!wantsDetails) {
                  const reply = `🆔 <b>${name || targetLabel}</b> এর UID: <code>${uidSeq}</code>`;
                  await sendMessage(chatId, reply, replyTo);
                  await finalizeLog("question", "owner-uid-only", reply, String(uidSeq));
                  return Response.json({ ok: true, flow: "owner-uid-only" });
                }
                const { buildUserCard } = await import("@/lib/telegram-lookup.server");
                const res = await buildUserCard(String(uidSeq));
                const reply = res.found
                  ? `🙏 জি স্যার, নিচে বিস্তারিত দিলাম 💙\n\n` +
                    `🆔 <b>${name || targetLabel}</b> এর UID: <code>${uidSeq}</code>\n\n${res.card}`
                  : `🙏 জি স্যার — <b>${name || targetLabel}</b> এর UID: <code>${uidSeq}</code>\n` +
                    `তবে এই UID দিয়ে অ্যাপে কোনো একাউন্ট পাওয়া যায়নি।`;
                await sendMessage(chatId, reply, replyTo);
                await finalizeLog("question", "owner-uid-lookup", reply, String(uidSeq));
                return Response.json({ ok: true, flow: "owner-uid-lookup" });
              }

              await sendMessage(
                chatId,
                `🙏 জি স্যার, দুঃখিত — <b>${targetLabel}</b> এর টেলিগ্রাম একাউন্টটি এখনো Good-App এর সাথে ` +
                  `<b>লিংক করা নেই</b>, তাই তার UID বের করা যাচ্ছে না।\n` +
                  `তার <b>UID / ফোন নম্বর / রেফার কোড</b> দিলে সাথে সাথে পুরো হিসাব দেখিয়ে দেব 💙`,
                replyTo,
              );
              return Response.json({ ok: true, flow: "owner-uid-unlinked" });
            }
          }

          // ---- আনফ্রিজ: "@bot unfreeze" (reply দিয়ে) / "ফ্রিজ খুলে দাও" / "unfreeze @user" / "unfreeze 4238"
          if (
            /(unfreeze|un\s*freeze|unmute|unblock|আনফ্রিজ|আনব্লক|ফ্রিজ\s*(খুলে|তুলে|বাতিল|off)|freeze\s*(khule|tule|off))/i.test(
              order,
            )
          ) {
            const { unrestrictUser } = await import("@/lib/telegram-bot.server");
            let targetId: number | null =
              msg.reply_to_message && !msg.reply_to_message.from?.is_bot
                ? (msg.reply_to_message.from?.id ?? null)
                : null;
            let shownName = targetName;

            if (!targetId) {
              const uname = order.match(/@([A-Za-z0-9_]{4,32})/)?.[1];
              if (uname && uname.toLowerCase() !== (meInfo?.username ?? "").toLowerCase()) {
                const { data: off } = await supabaseAdmin
                  .from("tg_offenders")
                  .select("tg_user_id, full_name")
                  .ilike("username", uname)
                  .maybeSingle();
                if (off) {
                  targetId = Number(off.tg_user_id);
                  shownName = off.full_name ?? `@${uname}`;
                }
              }
            }
            if (!targetId) {
              const uidTxt = order.match(/(?:uid|ইউআইডি|আইডি|id)?\s*[:#-]?\s*(\d{2,9})/i)?.[1];
              if (uidTxt) {
                const { data: prof } = await supabaseAdmin
                  .from("profiles")
                  .select("telegram_user_id, display_name")
                  .eq("uid_seq", Number(uidTxt))
                  .maybeSingle();
                if (prof?.telegram_user_id) {
                  targetId = Number(prof.telegram_user_id);
                  shownName = prof.display_name ?? `UID ${uidTxt}`;
                }
                if (!targetId) {
                  const { data: off2 } = await supabaseAdmin
                    .from("tg_offenders")
                    .select("tg_user_id, full_name")
                    .eq("known_uid", uidTxt)
                    .maybeSingle();
                  if (off2) {
                    targetId = Number(off2.tg_user_id);
                    shownName = off2.full_name ?? `UID ${uidTxt}`;
                  }
                }
              }
            }

            if (!targetId) {
              await sendMessage(
                chatId,
                `ℹ️ কাকে আনফ্রিজ করব বুঝতে পারিনি।\n\n` +
                  `👉 তার মেসেজে <b>reply</b> দিয়ে লিখুন: <code>@${meInfo?.username ?? "bot"} unfreeze</code>\n` +
                  `অথবা লিখুন: <code>unfreeze @username</code> / <code>unfreeze uid 4238</code>`,
                replyTo,
              );
              return Response.json({ ok: true, flow: "unfreeze-no-target" });
            }

            await unrestrictUser(chatId, targetId);
            await supabaseAdmin
              .from("tg_offenders")
              .update({
                warn_count: 0,
                blocked: false,
                unblocked_at: new Date().toISOString(),
                last_reason: "admin unfreeze",
              })
              .eq("tg_user_id", targetId);

            await sendMessage(
              chatId,
              `✅ <b>${shownName || "ইউজার"}</b> এর ফ্রিজ খুলে দেওয়া হয়েছে 💙\n` +
                `এখনই আবার গ্রুপে লিখতে পারবেন — কোনো অপেক্ষা লাগবে না।`,
              replyTo,
            );
            return Response.json({ ok: true, flow: "unfreeze" });
          }

          // "uid 4100 er details" / "01720095454 ei account ta check koro" → একাউন্ট কার্ড
          const refFrom = (s: string): string | null => {
            const t = String(s || "");
            const labeled = t.match(/(?:uid|ইউআইডি|আইডি|id)\s*[:#-]?\s*(\d{1,9})/i);
            if (labeled) return labeled[1];
            const phone = t.match(/(?:\+?88)?0?1[3-9]\d{8}\b/);
            if (phone) return phone[0];
            const bare = t.match(/(?<![\d@])(\d{2,7})(?![\d])/);
            return bare ? bare[1] : null;
          };
          const accountRef = refFrom(order) || refFrom(replyContextText);
          const cardCmd = accountRef
            ? ([accountRef, accountRef] as unknown as RegExpMatchArray)
            : null;
          if (
            cardCmd &&
            /(details|ডিটেইলস|card|কার্ড|hisab|হিসাব|check|চেক|chek|dekho|dekh|দেখো|dekha|দেখা|info|তথ্য|account|একাউন্ট|অ্যাকাউন্ট|somossa|সমস্যা|problem)/i.test(
              order,
            ) &&
            !/(verify|verification|ভেরিফাই|ভেরিফিকেশন|face|ফেস|date|time|তারিখ|সময়|কবে|status|স্ট্যাটাস|রি\s*-?ভেরিফাই|re\s*-?verify|first|1st|প্রথম|১ম)/i.test(
              order,
            )
          ) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            const res = await buildUserCard(cardCmd[1]);
            await sendMessage(
              chatId,
              res.found
                ? res.card
                : `❌ UID <code>${cardCmd[1]}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি।`,
              replyTo,
            );
            return Response.json({ ok: true, flow: "admin-card" });
          }

          // Owner/admin: "UID 4100 er sob slot er first verify date time dekhao"
          // or "ei UID e 3 din hoise re-verify chay na keno" → show real app data,
          // never repeat the admin's sentence back.
          if (
            cardCmd &&
            /(verify|verification|ভেরিফাই|ভেরিফিকেশন|face|ফেস|date|time|তারিখ|সময়|কবে|status|স্ট্যাটাস|রি\s*-?ভেরিফাই|re\s*-?verify|first|1st|প্রথম|১ম)/i.test(
              order,
            )
          ) {
            const { buildVerificationDateReport, buildReverifyStatusReport } =
              await import("@/lib/telegram-lookup.server");
            const wantsReverifyStatus =
              /(re\s*-?verify|reverify|রি\s*-?ভেরিফাই|রি-ভেরিফাই)[^\n]{0,80}(চায় না|চাই না|চাচ্ছে না|আসে না|আসেনি|ashe na|chay na|chai na|hocche na|hoy na|কেন|keno|kn|status|স্ট্যাটাস)/i.test(
                order,
              ) ||
              /(৩|3|৪|4)\s*(দিন|din|day)[^\n]{0,80}(re\s*-?verify|reverify|রি\s*-?ভেরিফাই|রি-ভেরিফাই)/i.test(
                order,
              );
            const kind = /(re\s*-?verify|reverify|রি\s*-?ভেরিফাই|রি-ভেরিফাই)/i.test(order)
              ? "reverify"
              : /(first|1st|প্রথম|১ম)/i.test(order)
                ? "first"
                : "all";
            const res = wantsReverifyStatus
              ? await buildReverifyStatusReport(cardCmd[1])
              : await buildVerificationDateReport(cardCmd[1], kind as "first" | "reverify" | "all");
            const reply = res.found
              ? res.card
              : `❌ UID <code>${cardCmd[1]}</code> দিয়ে কোনো ইউজার পাওয়া যায়নি।`;
            await sendMessage(chatId, reply, replyTo);
            return Response.json({
              ok: true,
              flow: wantsReverifyStatus ? "admin-reverify-status" : "admin-verification-dates",
            });
          }

          // "video dao / টিউটোরিয়াল দাও"
          if (/(video|ভিডিও|tutorial|টিউটোরিয়াল)/i.test(order)) {
            const { data: vids } = await supabaseAdmin
              .from("tg_videos")
              .select("topic, keywords, note, url")
              .eq("is_active", true);
            const hay = order.toLowerCase();
            const match = (vids ?? []).find(
              (v: any) =>
                (v.keywords ?? []).some(
                  (k: string) => k && hay.includes(String(k).toLowerCase()),
                ) ||
                (v.topic && hay.includes(String(v.topic).toLowerCase())),
            ) as any;
            const { videoReply, DEFAULT_TUTORIAL_VIDEO } =
              await import("@/lib/telegram-bot.server");
            const url = match?.url || (settings as any).default_video_url || DEFAULT_TUTORIAL_VIDEO;
            await sendMessage(
              chatId,
              videoReply(targetName || "বন্ধু", url, match?.topic ?? null, match?.note ?? null),
              replyTo,
            );
            return Response.json({ ok: true, flow: "admin-video" });
          }

          // অ্যাডমিন কোনো সেটিংস বদলাতে বললে (নগদ বন্ধ / বিকাশ চালু / বোনাস
          // পরিবর্তন / নোটিশ দেওয়া) → আগে কাজটা করে ফেলবে, তারপর জানাবে।
          // এটা ব্যাখ্যা/স্মার্ট-উত্তরের আগেই চলে, নইলে নির্দেশ শুধু কথা হয়ে যায়।
          {
            const { interpretAdminOrder, runAdminOps, opsAnnouncement } =
              await import("@/lib/telegram-admin-actions.server");
            const ops = await interpretAdminOrder(order);
            if (ops.length) {
              const { done, failed } = await runAdminOps(ops);
              if (done.length || failed.length) {
                await sendMessage(chatId, opsAnnouncement(done, failed), replyTo);
                return Response.json({ ok: true, flow: "admin-action", done, failed });
              }
            }
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
            if (
              askCtx &&
              (/(refer|reffer|রেফার|referral)/i.test(bnDigits) ||
                /(bondhu|বন্ধু|friend|যাকে|jake|kauke|কাউকে|downline|টিম)/i.test(bnDigits))
            ) {
              const { loadRates, referralEarningReply } =
                await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const reply = referralEarningReply(targetName || "বন্ধুরা", rates);
              await sendMessage(chatId, reply, replyTo);
              return Response.json({ ok: true, flow: "admin-referral-earning" });
            }
            if (slotCtx && askCtx) {
              const m = bnDigits.match(/(\d{1,4})\s*(ta|টা|টি|ti|slot|স্লট)?/);
              const n = m ? Number(m[1]) : null;
              const slots = n && n >= 1 && n <= 500 ? n : null;
              const { loadRates, slotEarningReply } =
                await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const reply = slotEarningReply(targetName || "বন্ধুরা", rates, slots, true);
              await sendMessage(chatId, reply, replyTo);
              return Response.json({ ok: true, flow: "admin-slot-earning" });
            }

            // প্রশ্ন/টপিক বুঝিয়ে বলতে বললে → অ্যাপের রুলবুক থেকে গ্রাউন্ডেড উত্তর
            if (
              askCtx ||
              /(\bki\b|কি\b|\bkivabe\b|কীভাবে|কিভাবে|\bkeno\b|কেন|\bbolo\b|বলো|\bbujhao\b|বুঝিয়ে)/i.test(
                bnDigits,
              )
            ) {
              const { smartAnswer } = await import("@/lib/telegram-bot.server");
              const { knowledgeText, loadRates: lr } =
                await import("@/lib/telegram-knowledge.server");
              const { appRulebook } = await import("@/lib/telegram-app-rules.server");
              const { agentAnswer } = await import("@/lib/telegram-agent.server");
              const rates = await lr();
              const base = {
                name: targetName || "বন্ধুরা",
                question: order,
                knowledge: knowledgeText(rates),
              };
              const ans =
                (await agentAnswer({ ...base, rulebook: appRulebook(rates), isAdmin: true })) ??
                (await smartAnswer(base));
              if (ans && ans !== "NO_ANSWER") {
                await sendMessage(chatId, ans, replyTo);
                return Response.json({ ok: true, flow: "admin-smart" });
              }
            }
          }

          // বাকি সব: অ্যাডমিনের নির্দেশমতো সুন্দর মেসেজ সাজিয়ে গ্রুপে পাঠাবে।
          // কখনোই অ্যাডমিনের নির্দেশটাই হুবহু ফেরত পাঠাবে না।
          const composed = (await adminCompose(order, targetName))?.trim();
          const echoed =
            !composed ||
            composed.toLowerCase().replace(/\s+/g, " ") ===
              order.toLowerCase().replace(/\s+/g, " ");
          if (!echoed) {
            await sendMessage(chatId, composed, replyTo);
            return Response.json({ ok: true, flow: "admin-instruction" });
          }
          await sendMessage(
            chatId,
            "✅ ভাইয়া, নির্দেশটি পেয়েছি। একটু স্পষ্ট করে বলুন কী করতে হবে — আমি সাথে সাথেই করে দিচ্ছি।",
            replyTo,
          );
          return Response.json({ ok: true, flow: "admin-instruction-unclear" });
        }

        if ((senderIsAdmin && !isBotCommand) || repliedToAdmin) {
          // Save human admin replies as learning examples. Later, recallSimilar()
          // can use the exact question → admin answer pair instead of guessing.
          if (
            senderIsAdmin &&
            text.trim() &&
            msg.reply_to_message &&
            !msg.reply_to_message.from?.is_bot
          ) {
            const original = String(
              msg.reply_to_message.text ?? msg.reply_to_message.caption ?? "",
            ).trim();
            if (original) {
              await supabaseAdmin.from("tg_messages").upsert(
                {
                  update_id: update.update_id,
                  chat_id: msg.chat.id,
                  message_id: msg.message_id,
                  tg_user_id: msg.reply_to_message.from?.id ?? null,
                  username: msg.reply_to_message.from?.username ?? null,
                  full_name:
                    [msg.reply_to_message.from?.first_name, msg.reply_to_message.from?.last_name]
                      .filter(Boolean)
                      .join(" ") || "User",
                  text: original.slice(0, 2000),
                  has_photo: !!msg.reply_to_message.photo?.length,
                  verdict: "question",
                  action: "admin-reply-learning",
                  bot_reply: text.slice(0, 2000),
                  matched_uid: null,
                },
                { onConflict: "update_id" },
              );
            }
          }
          return Response.json({
            ok: true,
            ignored: senderIsAdmin ? "admin-message" : "reply-to-admin",
          });
        }

        // ---- security guard: non-admins can't extract secrets or order edits ----
        if (!senderIsAdmin && text.trim()) {
          const { detectSensitive, sensitiveReply } = await import("@/lib/telegram-guard.server");
          const kind = detectSensitive(text);
          if (kind) {
            await sendMessage(chatId, sensitiveReply(kind, msg.from?.first_name), msg.message_id);
            return Response.json({ ok: true, flow: `guard-${kind}` });
          }
        }

        // ---- offender record (warnings / block state) -------------------------
        const { data: offender } = msg.from?.id
          ? await supabaseAdmin
              .from("tg_offenders")
              .select("*")
              .eq("tg_user_id", msg.from.id)
              .maybeSingle()
          : { data: null as any };

        // Already blocked → delete anything they manage to post and stop.
        if ((offender as any)?.blocked) {
          if (settings.delete_bad_messages) await deleteMessage(chatId, msg.message_id);
          return Response.json({ ok: true, blocked: true });
        }

        // ---- বাইরের লিংক/রেফার লিংক সাথে সাথে ডিলিট (স্প্যাম বন্ধ) ------------
        // AI-র সিদ্ধান্তের অপেক্ষা করলে অনেক সময় লিংক থেকেই যেত — তাই এখানেই
        // নিশ্চিতভাবে মুছে দিই। আমাদের নিজের লিংক ও সাপোর্ট আইডি ছাড় পায়।
        if (settings.moderation_enabled && !senderIsAdmin) {
          const linkSrc = `${text} ${msg.caption ?? ""}`;
          const urls = linkSrc.match(/(?:https?:\/\/|www\.|t\.me\/|telegram\.me\/)[^\s]+/gi) ?? [];
          const ownHost = /(goodapp2\.live|good-app2\.lovable\.app|youtu\.be|youtube\.com)/i;
          const supportUser = String((settings as any).support_username || "@anamulmunni").replace(
            /^@/,
            "",
          );
          const badUrl = urls.find(
            (u) =>
              !ownHost.test(u) && !new RegExp(`t(?:elegram)?\\.me/${supportUser}`, "i").test(u),
          );
          const invite = /(t\.me\/(?:joinchat|\+)|chat\.whatsapp\.com|wa\.me\/)/i.test(linkSrc);

          if (badUrl || invite) {
            await deleteMessage(chatId, msg.message_id);
            const warn =
              `🔗 <b>${senderName}</b>, গ্রুপে বাইরের কোনো লিংক শেয়ার করা যাবে না — তাই মেসেজটি মুছে দেওয়া হলো 🙏\n` +
              `আমাদের একটাই অফিসিয়াল লিংক: <b>https://goodapp2.live</b>\n` +
              `কোনো প্রশ্ন থাকলে এখানেই লিখুন, আমি সাহায্য করছি 💙`;
            await sendMessage(chatId, warn);
            await supabaseAdmin.from("tg_messages").upsert(
              {
                update_id: update.update_id,
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                tg_user_id: msg.from?.id ?? null,
                username: msg.from?.username ?? null,
                full_name: senderName,
                text: linkSrc.slice(0, 2000),
                has_photo: !!photos?.length,
                verdict: "spam",
                action: "link-deleted",
                bot_reply: warn,
                matched_uid: null,
              },
              { onConflict: "update_id" },
            );
            return Response.json({ ok: true, flow: "link-deleted" });
          }
        }

        // ---- helpers for the guided slot-reset conversation -------------------
        const bnDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
        const norm = bnDigits(text).trim();
        // ইউজার "ভয়েসে বলো" বললে এই উত্তরটা শুধু ভয়েসে যাবে, নইলে শুধু লেখায়।
        {
          const { setReplyMode, asksForVoiceReply } = await import("@/lib/telegram-bot.server");
          setReplyMode(asksForVoiceReply(norm) ? "voice" : "text");
        }

        const replyNorm = bnDigits(
          String(msg.reply_to_message?.text ?? msg.reply_to_message?.caption ?? ""),
        ).trim();
        // কেউ কোনো মেসেজ "মার্ক"/রিপ্লাই করে প্রশ্ন করলে ওই মেসেজটাই আসল প্রসঙ্গ —
        // সেটা AI-কে না দিলে বট এলোমেলো উত্তর দেয়।
        const quotedRaw = String(
          msg.reply_to_message?.text ?? msg.reply_to_message?.caption ?? "",
        ).trim();
        const quotedIsBot = !!msg.reply_to_message?.from?.is_bot;
        const quotedContext = quotedRaw
          ? `\n\n[ইউজার নিচের মেসেজটি মার্ক/রিপ্লাই করে এই প্রশ্নটি করেছে — ${
              quotedIsBot ? "এটি বটের আগের উত্তর" : "এটি অন্য একজনের মেসেজ"
            }; এই প্রসঙ্গ ধরে সরাসরি উত্তর দাও]\n${quotedRaw.slice(0, 700)}`
          : "";

        // "yes", "ok", "ji", "ধন্যবাদ" — এগুলো কখনোই UID নয়।
        const isAffirmation = (s: string) =>
          /^(yes|yeah|yep|ya|ha|haa|hae|hmm|hm|ok|okay|k|ji|jee|acha|accha|thik|thik ache|right|sure|thanks|thank you|tnx|ty|done|nice|good|👍|✅|হ্যাঁ|হা|হুম|জি|জ্বি|আচ্ছা|ঠিক|ঠিক আছে|ধন্যবাদ|ওকে)[\s.!।]*$/i.test(
            s.trim(),
          );
        const isThanksOnly = (s: string) =>
          /^(thanks|thank you|tnx|ty|ধন্যবাদ|থ্যাংকস|শুকরিয়া|jazakallah|জাযাকাল্লাহ)[\s.!।🙏😊🙂]*$/i.test(
            s.trim(),
          );
        const { stripSlotMentions, SLOT_WORD, NUM_WORD } =
          await import("@/lib/telegram-slot.server");
        // "মুছে দে / কেটে দাও / রিসেট করে দেন" — স্লট মোছার কথা।
        const removalIntent =
          /(reset|রিসেট|muche|মুছ|mucche|delete|ডিলিট|clear|ক্লিয়ার|khali|খালি|kete|কেটে|kata|কাটা|kaita|কাইটা|bad de|বাদ দ|remove|রিমুভ|off kore|বন্ধ কর)/i;
        const pickUid = (s: string): string | null => {
          const raw = bnDigits(s).trim();
          if (isAffirmation(raw)) return null;
          const explicit = raw.match(
            /(?:uid|ইউআইডি|আইডি|আই ডি|id\s*no|আইডি নাম্বার)\s*[:#-]?\s*([A-Za-z0-9]{2,10})/i,
          );
          if (explicit) return explicit[1].trim().toUpperCase();
          // "৪ নম্বর স্লট" এর ৪ কখনোই UID নয় — তাই স্লটের কথা বাদ দিয়ে খুঁজি।
          const source = stripSlotMentions(raw);
          const num = source.match(/\b(\d{1,9})\b/);
          if (num) {
            // "আমার ৬ নাম্বার সোলট মুছে দে" — মোছার কথা থাকলে ছোট নম্বরটা
            // স্লট নম্বর, কখনোই UID নয়। UID লিখলে সে "uid" শব্দটা লিখবে।
            if (removalIntent.test(raw) && Number(num[1]) <= 500) return null;
            return num[1];
          }
          const code = source.match(/\b([A-Za-z0-9]{7})\b/);
          return code && /\d/.test(code[1]) ? code[1].toUpperCase() : null;
        };

        const pickUidFromCurrentOrReply = (): string | null =>
          pickUid(norm) || (replyNorm ? pickUid(replyNorm) : null);

        // Accepts: "3", "5 ta", "2,3,4", "২-৫", "3 4 7", "সব"/"all"
        const wantsAll = /(সব|সবগুলো|সবগুলা|all|full)/i.test(norm);
        const pickSlots = (s: string): number[] => {
          const out: number[] = [];
          let rest = s;
          // "2number slot", "3no slot", "৫ নম্বর স্লট", "৬ নাম্ষার সোলট" — ভুল
          // বানান/শব্দ লেগে থাকলেও স্লট নম্বর ধরতে হবে।
          for (const m of s.matchAll(
            new RegExp(`(\\d{1,3})\\s*${NUM_WORD}?\\s*(?:er|এর)?\\s*${SLOT_WORD}`, "gi"),
          )) {
            const n = Number(m[1]);
            if (n >= 1 && n <= 500) out.push(n);
            rest = rest.replace(m[0], " ");
          }
          for (const m of s.matchAll(
            new RegExp(`(\\d{1,3})\\s*${NUM_WORD}\\s*(?:টা|টি|ta|ti)?`, "gi"),
          )) {
            const n = Number(m[1]);
            if (n >= 1 && n <= 500) out.push(n);
            rest = rest.replace(m[0], " ");
          }
          const range = rest.matchAll(/\b(\d{1,3})\s*(?:-|–|to|থেকে)\s*(\d{1,3})\b/g);
          for (const r of range) {
            const a = Number(r[1]),
              b = Number(r[2]);
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
        // "৩ নম্বর স্লটটা কেটে দাও" — এটাও স্লটের উত্তরই, শুধু "৩" লেখা জরুরি নয়।
        const mentionsSlotWord = new RegExp(
          `(${SLOT_WORD}|${NUM_WORD}|reset|রিসেট|কেটে|kete|kate|মুছ|muche|delete|clear|খালি|khali|বাদ)`,
          "i",
        ).test(norm);

        const looksLikeSlotAnswer =
          (wantsAll || pickSlots(norm).length > 0) && (stripped.length <= 10 || mentionsSlotWord);
        const looksLikeUidAnswer =
          !!pickUid(norm) && (stripped.length <= 10 || /\b(uid|আইডি)\b/i.test(norm));
        const questionish =
          /(\?|কেন|কন\b|\bkn\b|keno|kivabe|kibhabe|কিভাবে|koita|কয়টা|কতটা|কত|koto|kobe|কবে|kokhon|withdraw|উইথড্র|balance|ব্যালেন্স|refer|রেফার|verify|ভেরিফাই|mining|মাইনিং|bonus|বোনাস|problem|somossa|সমস্যা|help|সাহায্য|\bki\b|কি\b|admin|অ্যাডমিন|এডমিন)/i.test(
            norm,
          ) ||
          (photos?.length ?? 0) > 0 ||
          !!voiceHeard;
        const hasExplicitUid = /(\buid\b|\bid\s*no\b|ইউআইডি|আইডি|আই ডি|আইডি নাম্বার)/i.test(norm);
        const pendingWithdrawQuestion =
          /(withdraw|উইথড্র|payment|পেমেন্ট|টাকা|tk|taka|টিকে|পাই নাই|পাইনাই)/i.test(norm) &&
          /(দিছি|দিয়েছি|দিসি|দিছে|দিয়াছি|dichi|dise|disi|diyechi|pending|পেন্ডিং|কখন পাব|কবে পাব|kokhon|kobe|pabo|pamu|pai nai|painai|paini|ashe nai|ashe na|asheni|আসে নাই|আসে না|আসেনি|এখনো পাই নাই|এখনো আসেনি|status|স্ট্যাটাস|history|হিস্টরি)/i.test(
            norm,
          );
        const withdrawEligibilityQuestion =
          !pendingWithdrawQuestion &&
          /(withdraw|উইথড্র|উঠাব|উঠাতে|তুলতে|claim|ক্লেইম|টাকা)/i.test(norm) &&
          /(পারব|parbo|পারবো|যাবে|jabe|হবে|hobe|দিতে পারব|নিতে পারব|উঠবে|unblock|আনলক|লক|lock)/i.test(
            norm,
          );

        // ইউজার কোনো সমভাইয়া কথা বললে (যেমন "রি-ভেরিফাই করতে গেলে বলতেছে ১৮
        // বছরের নিচে") সেটা একাউন্ট-হিসাব চাওয়া নয় — তখন UID না চেয়ে সরাসরি
        // সমভাইয়া সমাধান বলতে হবে।
        const reportsProblem =
          /(bolteche|bolteche|বলতেছে|বলছে|বলতেসে|বলে|dekhacche|দেখাচ্ছে|দেখায়|show korche|hocche na|হচ্ছে না|hoi na|হয় না|হয়না|hocche nah|hoy nai|হয় নাই|হচ্ছে নাহ|parchi na|পারছি না|পারতেছি না|partesi na|somossa|সমস্যা|problem|error|এরর|failed|ফেইল|fail|আটকে|atke|18|১৮|under ?age|বয়স)/i.test(
            norm,
          );

        // "আমার কয়টা রেফার হয়েছে?", "আমার ব্যালেন্স কত?", "কয়টা ভেরিফাই হয়েছে?"
        // → এগুলোর উত্তর একাউন্ট ডেটা থেকেই দিতে হবে, তাই UID চেয়ে কার্ড দেখাই।
        const { detectHowTo, howToReply } = await import("@/lib/telegram-knowledge.server");
        const howToTopic = detectHowTo(norm);

        const asksOwnAccount =
          !pendingWithdrawQuestion &&
          !reportsProblem &&
          !howToTopic &&
          ((/(আমার|amar|amr|my|আমি|ami|nijer|নিজের|acount|account|একাউন্ট|অ্যাকাউন্ট)/i.test(
            norm,
          ) &&
            /(refer|reffer|রেফার|ব্যালেন্স|balance|verify|ভেরিফাই|verification|ভেরিফিকেশন|face|ফেস|slot|স্লট|mining|মাইনিং|bonus|বোনাস|টাকা|taka|tk|income|ইনকাম|status|স্ট্যাটাস|details|ডিটেইলস|koto|কত|koita|কয়টা|kota|hoyeche|hoyche|hoise|আছে|ache|list|লিস্ট|তালিকা)/i.test(
              norm,
            )) ||
            /(refer|reffer|referral|রেফার|রেফারেল)[^\n]{0,30}(list|লিস্ট|তালিকা|koita|কয়টা|koyta|koto|কত|hisab|হিসাব)/i.test(
              norm,
            ));

        const asksReverifyStatus =
          /(re\s*-?verify|reverify|রি\s*-?ভেরিফাই|রি ভেরিফাই|রি-ভেরিফাই)[^\n]{0,90}(চায় না|চাই না|চাচ্ছে না|আসে না|আসেনি|ashe na|chay na|chai na|hocche na|hoy na|হয় না|কেন|keno|kn|কবে|kokhon|কখন|status|স্ট্যাটাস)/i.test(
            norm,
          ) ||
          /(3|৩|4|৪)\s*(din|দিন|day)[^\n]{0,120}(first|1st|প্রথম|১ম|verify|ভেরিফাই)[^\n]{0,120}(re\s*-?verify|reverify|রি\s*-?ভেরিফাই|রি-ভেরিফাই)/i.test(
            norm,
          );

        const asksFacePrivacy =
          /(face|ফেস|mukh|মুখ|scan|স্ক্যান|ছবি|photo|ফটো|pic|পিক)[^\n]{0,120}(ki koren|ki koro|কী করেন|কি করেন|কি করো|কি করেন|নিয়ে.*করেন|নিয়া.*করেন|use|ব্যবহার|sell|বিক্রি|share|শেয়ার|data|ডাটা|তথ্য)/i.test(
            norm,
          ) ||
          /(fau fau|ফাউ ফাউ|free|ফ্রি|tk|টাকা|payment|পেমেন্ট)[^\n]{0,120}(dicche|দিচ্ছে|dei|দেয়|দেন|দেয়)[^\n]{0,160}(face|ফেস|mukh|মুখ|ছবি|photo|ফটো)/i.test(
            norm,
          );

        // "কত টাকা পাব / বোনাস কত" — এটা হিসাব/নিয়মের প্রশ্ন, কারো রেফারার খোঁজা নয়।
        // ভয়েস ট্রান্সক্রিপ্ট এলোমেলো হলে আগে ভুল করে UID চেয়ে বসত।
        const asksReferralAmount =
          /(koto|কত|kto|how much|kotota|কতটা)[^\n]{0,40}(tk|taka|টাকা|৳|bonus|বোনাস|pabo|paabo|পাব|পাবো|income|ইনকাম|commission|কমিশন)/i.test(
            norm,
          ) ||
          /(bonus|বোনাস)[^\n]{0,40}(koto|কত|pabo|পাব|পাবো|kemne|কিভাবে|kivabe)/i.test(norm) ||
          /(pabo|paabo|পাব|পাবো|pai|পাই)\s*\??$/i.test(norm.trim());

        const asksReferralJoin =
          !asksReferralAmount &&
          (/(kar|কার|kaar|jar|যার|kon|কোন|which|who|ke|কে|kader|কাদের)[^\n]{0,90}(refer|reffer|refar|refr|রেফার|referral|রেফারে|রেফারার|under|আন্ডার)/i.test(
            norm,
          ) ||
            /(refer|reffer|refar|refr|রেফার|referral|রেফারে|রেফারার|under|আন্ডার)[^\n]{0,90}(join|জয়েন|joined|asche|আসছে|ashche|aishe|hoise|হইছে|hoyeche|হয়েছে|ache|আছে|kar|কার|কে|ke|korche|করছে|kore|করে|account|একাউন্ট|অ্যাকাউন্ট|id|আইডি)/i.test(
              norm,
            ) ||
            /(ke|কে|কার)[^\n]{0,60}(eneche|এনেছে|anse|আনছে|niye asche|নিয়ে আসছে)/i.test(norm));

        // "রেফার করেছি কিন্তু রেফার বাড়ে না / কমে গেছে" → রেফার হিস্টরি + কারণ
        const complainsReferralCount =
          /(refer|reffer|refar|রেফার|referral|রেফারেল)/i.test(norm) &&
          /(bare na|বাড়ে না|barche na|বাড়ছে না|bad?he na|kome|কমে|kome gese|কমে গেছে|komeche|কমেছে|jog hoi na|যোগ হয় না|jog hoy nai|যোগ হয় নাই|add hoi na|অ্যাড হয় না|add hocche na|dekhachhe na|দেখাচ্ছে না|dekhai na|দেখায় না|count hoi na|কাউন্ট হয় না|kmi|কমি)/i.test(
            norm,
          );

        // "যেগুলো রি-ভেরিফাই হয় না ওগুলো রিমুভ/ডিলিট করা যাবে?" → হিসাব নয়,
        // সরাসরি স্লট রিসেটের অফার (UID + স্লট নম্বর নিয়ে)।
        const wantsSlotRemoval =
          /(remove|রিমুভ|delete|ডিলিট|muche|মুছ|bad de|বাদ দ|clear|ক্লিয়ার|reset|রিসেট|খালি|khali|katte|kete|kate|kata|kaita|কাটতে|কেটে|কাটা|কাটাই|কাইটা)/i.test(
            norm,
          ) &&
          /(slot|স্লট|face|ফেস|verify|ভেরিফাই|verification|ভেরিফিকেশন|oigula|ওইগুলো|ওগুলো|ogulo|eigula|এইগুলো|egula|account|একাউন্ট)/i.test(
            norm,
          );

        const walletResetProvider = /(?:nagad|নগদ)/i.test(norm)
          ? "nagad"
          : /(?:bkash|b\s*kash|বিকাশ)/i.test(norm)
            ? "bkash"
            : null;
        const wantsWalletReset =
          /(nagad|নগদ|bkash|b\s*kash|বিকাশ|payment|পেমেন্ট|wallet|ওয়ালেট)/i.test(norm) &&
          /(number|নম্বর|নাম্বার|নং)/i.test(norm) &&
          /(change|চেঞ্জ|bodla|বদলা|বদল|poriborton|পরিবর্তন|reset|রিসেট|remove|রিমুভ|delete|ডিলিট|muche|মুছ|ভুল|wrong)/i.test(
            norm,
          );

        // "আমার রেফার হয় না / রেফার লিংক কাজ করে না" → নিজের ৫টি স্লট ভেরিফাই লাগবে
        const asksReferralUnlock =
          /(refer|reffer|refar|রেফার|referral|রেফারেল)/i.test(norm) &&
          /(hoi na|hoy na|হয় না|হয়না|hocche na|হচ্ছে না|kaj kore na|কাজ করে না|lock|লক|block|ব্লক|link|লিংক|korte parchi na|করতে পারছি না|parchi na|পারছি না|open hoi na|খোলে না|unlock|আনলক)/i.test(
            norm,
          ) &&
          !/(kome|কমে|bare na|বাড়ে না)/i.test(norm);

        // "৫টা স্লট কি প্রথমবার ভেরিফাই করলেই হবে?" → হ্যাঁ
        const asksFiveSlotFirstVerify =
          /(5|৫|পাঁচ|panch)\s*(ta|টা|টি|ti)?\s*(slot|স্লট)/i.test(norm) &&
          /(prothom|প্রথম|১ম|1st|first)/i.test(norm);

        // "আমি তো প্রথম ১০টার বোনাস নিয়েছি, এখন আরও ১০টা করলে কি আবার বোনাস পাবো?"
        const asksExtraSlotBonus =
          /(bonus|বোনাস)/i.test(norm) &&
          /(aro|আরও|আরো|abar|আবার|extra|এক্সট্রা|notun|নতুন|porer|পরের|second|dwitiyo|দ্বিতীয়|20|২০|30|৩০|50|৫০|barale|বাড়ালে|barai|বাড়াই|add kori|যোগ কর)/i.test(
            norm,
          ) &&
          /(slot|স্লট)/i.test(norm);

        const verificationDateKind = (s: string): "first" | "reverify" | "all" | null => {
          if (
            /(kotodin|koto\s*din|কতদিন|কত\s*দিন)[^\n]{0,30}(por|pore|পর|পরে)[^\n]{0,30}(re\s*-?\s*verify|reverify|রি\s*-?\s*ভেরিফাই)/i.test(
              s,
            )
          ) {
            return null;
          }
          const asksDate =
            /(তারিখ|কবে|কতদিন|kotodin|kobe|kokhon|koto\s*(?:tarikh|ratikh|date|din)|tarikh|ratikh|date|when|hoise|hoyche|hoyeche|korche|kora\s*hoyche)/i.test(
              s,
            );
          const asksVerify = /(verify|verification|ভেরিফাই|ভেরিফিকেশন|face|ফেস)/i.test(s);
          if (!asksDate || !asksVerify) return null;
          if (/(re\s*-?\s*verify|reverify|রি\s*-?\s*ভেরিফাই|রি-ভেরিফাই)/i.test(s))
            return "reverify";
          if (/(1st|first|১ম|প্রথম|prothom)/i.test(s)) return "first";
          return "all";
        };
        const pickVerificationQuery = (s: string): string | null => {
          if (isAffirmation(s)) return null;
          const explicitUid = s.match(/(?:uid|ইউআইডি|আইডি|id)\s*[:#-]?\s*([A-Za-z0-9]{2,10})/i);

          if (explicitUid) return explicitUid[1].trim();
          const namedUser = s.match(
            /(?:user\s*\d+\s+)?([A-Za-z][A-Za-z .]{1,35})\s*(?:er|এর|র)\s+(?:face|ফেস|1st|first|verify|verification|ভেরিফাই)/i,
          );
          if (namedUser) return namedUser[1].trim();
          const banglaName = s.match(
            /([\u0980-\u09FF]{2,}(?:\s+[\u0980-\u09FF]{2,})?)\s*(?:এর|র)\s+(?:ফেস|ভেরিফাই|ভেরিফিকেশন)/i,
          );
          if (banglaName) return banglaName[1].trim();
          const only = s.trim().match(/^[#\s]*(\d{2,10}|[A-Za-z0-9]{6,10})[\s.]*$/);
          if (only) return only[1].trim();
          return null;
        };

        const logMessage = async (
          verdict: string,
          action: string,
          reply: string | null,
          uid: string | null,
        ) => {
          await supabaseAdmin
            .from("tg_messages")
            .update({
              text: text.slice(0, 2000),
              has_photo: !!photos?.length,
              verdict,
              action,
              bot_reply: reply,
              matched_uid: uid,
            })
            .eq("update_id", update.update_id);
        };

        const clearSession = async () => {
          if (!msg.from?.id) return;
          await supabaseAdmin
            .from("tg_sessions")
            .delete()
            .eq("tg_user_id", msg.from.id)
            .eq("chat_id", msg.chat.id);
        };
        const saveSession = async (row: Record<string, unknown>) => {
          if (!msg.from?.id) return;
          await supabaseAdmin.from("tg_sessions").upsert(
            {
              tg_user_id: msg.from.id,
              chat_id: msg.chat.id,
              intent: "slot_reset",
              expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
              ...row,
            } as any,
            { onConflict: "tg_user_id,chat_id" },
          );
        };

        // অ্যাপ থেকে "শুরু করুন" চাপলে টেলিগ্রাম + UID লিংক হয়ে যায় — তাই
        // চেনা ইউজারের কাছে আর কখনো UID চাইব না (গোপনে চিনে নেব, বলব না)।
        let _linkedUid: string | null | undefined;
        const linkedUid = async (): Promise<string | null> => {
          if (_linkedUid !== undefined) return _linkedUid;
          if (!msg.from?.id) return (_linkedUid = null);
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("uid_seq")
            .eq("telegram_user_id", msg.from.id)
            .maybeSingle();
          const uid = (data as { uid_seq?: number | null } | null)?.uid_seq;
          return (_linkedUid = uid != null ? String(uid) : null);
        };

        // ---- "এই user এর UID কত?" — কাউকে mention/reply করে জিজ্ঞেস করলে -----
        // আগে বট @handle-টাকে "নাম" ধরে ডেটাবেজে খুঁজত, তাই কিছুই পেত না।
        // এখন mention/reply করা ইউজারের Telegram ID থেকেই আসল UID বের করি।
        {
          const ents: any[] = [
            ...((msg as any).entities ?? []),
            ...((msg as any).caption_entities ?? []),
          ];
          const textMention = ents.find((e) => e?.type === "text_mention" && e?.user?.id);
          const repliedUser =
            msg.reply_to_message?.from?.id && !msg.reply_to_message.from?.is_bot
              ? msg.reply_to_message.from
              : null;
          const handle = text.match(/@([A-Za-z0-9_]{4,32})/)?.[1] ?? null;
          const handleIsOther =
            !!handle && handle.toLowerCase() !== (meInfo?.username ?? "").toLowerCase();

          const targetTgId: number | null = textMention
            ? Number(textMention.user.id)
            : repliedUser
              ? Number(repliedUser.id)
              : null;
          const targetLabel =
            (textMention
              ? [textMention.user.first_name, textMention.user.last_name].filter(Boolean).join(" ")
              : repliedUser
                ? [repliedUser.first_name, repliedUser.last_name].filter(Boolean).join(" ")
                : handleIsOther
                  ? `@${handle}`
                  : "") || (handleIsOther ? `@${handle}` : "ইউজার");

          const asksUid =
            /(uid|ইউআইডি|আইডি|আই\s*ডি)/i.test(norm) &&
            /(koto|kot|kt|kx|ki|কত|কতো|কী|কি|ber|বের|dekha|দেখা|janao|জানাও|what)/i.test(norm);

          if (
            settings.auto_reply_enabled &&
            asksUid &&
            !pickUid(norm) &&
            (targetTgId || handleIsOther)
          ) {
            let uidSeq: number | null = null;
            let name: string | null = null;
            let tgId = targetTgId;

            if (!tgId && handleIsOther) {
              const { data: seen } = await supabaseAdmin
                .from("tg_messages")
                .select("tg_user_id")
                .ilike("username", handle!)
                .not("tg_user_id", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);
              const found = (seen ?? [])[0] as { tg_user_id?: number | null } | undefined;
              if (found?.tg_user_id) tgId = Number(found.tg_user_id);
            }

            if (tgId) {
              const { data: prof } = await supabaseAdmin
                .from("profiles")
                .select("uid_seq, display_name")
                .eq("telegram_user_id", tgId)
                .maybeSingle();
              uidSeq = (prof as any)?.uid_seq ?? null;
              name = (prof as any)?.display_name ?? null;
            }

            if (uidSeq != null) {
              const { buildUserCard } = await import("@/lib/telegram-lookup.server");
              const res = await buildUserCard(String(uidSeq));
              const reply = res.found
                ? `🆔 <b>${name || targetLabel}</b> এর UID: <code>${uidSeq}</code>\n\n${res.card}`
                : `🆔 <b>${name || targetLabel}</b> এর UID: <code>${uidSeq}</code>`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "mention-uid", reply, String(uidSeq));
              return Response.json({ ok: true, flow: "mention-uid" });
            }

            const reply =
              `🆔 <b>${targetLabel}</b> এর টেলিগ্রাম একাউন্টটি এখনো Good-App এর সাথে <b>লিংক করা নেই</b>, ` +
              `তাই আমি তার UID বের করতে পারছি না 🙂\n\n` +
              `👉 তাকে বলুন অ্যাপের হোম পেজে লাল <b>“KYC করুন”</b> বাটনে চাপ দিয়ে টেলিগ্রামে <b>START</b> চাপতে — ` +
              `তখন থেকেই তার UID আমি সাথে সাথে বলে দিতে পারবো।\n` +
              `অথবা তার <b>ফোন নম্বর / রেফার কোড / UID</b> লিখে দিন, আমি সাথে সাথে হিসাব দেখিয়ে দেব 💙`;
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage("question", "mention-uid-unlinked", reply, null);
            return Response.json({ ok: true, flow: "mention-uid-unlinked" });
          }
        }

        if (settings.auto_reply_enabled && isThanksOnly(norm)) {
          await clearSession();
          const reply = `স্বাগতম ${senderName} 🙂\nআর কোনো সাহায্য লাগলে এখানেই লিখবেন।`;
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("ok", "thanks", reply, null);
          return Response.json({ ok: true, flow: "thanks" });
        }

        // স্লট রিসেট সরাসরি হয় না — একজন আরেকজনের স্লট রিসেট করাতে না পারে
        // সেজন্য অ্যাপে ইউজারের নিজের অনুমোদন লাগে।
        const doReset = async (uid: string, slots: number[]) => {
          const { createSlotResetRequest } = await import("@/lib/slot-reset-requests.server");
          const res = await createSlotResetRequest({
            uid,
            slots,
            requestedBy: `telegram:${msg.from?.id ?? ""}`,
            chatId,
            tgUserId: msg.from?.id ?? null,
            tgMessageId: msg.message_id ?? null,
          });

          if (!res.ok) {
            await sendMessage(chatId, `❌ ${res.error}`, msg.message_id);
            await logMessage("question", "slot-reset-failed", res.error, uid);
            return false;
          }

          await clearSession();
          await sendMessage(
            chatId,
            `🔄 <b>স্লট রিসেটের অনুরোধ পাঠানো হয়েছে</b>\n\n` +
              `👤 একাউন্ট: <b>${res.name}</b>\n🆔 UID: <code>${res.uid}</code>\n` +
              `📦 স্লট: <b>${res.slots.map((s) => `${s} নম্বর`).join(", ")}</b>\n\n` +
              `🔐 নিরাপত্তার জন্য অন্য কেউ যেন আপনার স্লট রিসেট করাতে না পারে, তাই <b>আপনার নিজের অনুমোদন</b> লাগবে।\n\n` +
              `👉 এভাবে অনুমোদন করবেন:\n` +
              `১️⃣ অ্যাপে লগইন করুন (একবার রিফ্রেশ দিন)\n` +
              `২️⃣ স্ক্রিনে আসা <b>“স্লট রিসেটের অনুমোদন দরকার”</b> বক্সটি দেখবেন\n` +
              `৩️⃣ <b>“হ্যাঁ, রিসেট করুন”</b> চাপুন\n\n` +
              `✅ অনুমোদন দেওয়ার সাথে সাথেই স্লটটি রিসেট হবে এবং আমি এখানে রিপোর্ট দিয়ে জানিয়ে দেব 💙`,
            msg.message_id,
          );
          await logMessage(
            "question",
            `slot-reset-request:${res.slots.join("|")}`,
            "reset approval requested",
            uid,
          );
          return true;
        };

        // একই ইউজারের একটা রিসেট অনুরোধ pending থাকলে আবার UID চাইব না —
        // মনে করিয়ে দেব কোন কোন স্লটের অনুরোধ পাঠানো আছে ও কীভাবে অনুমোদন করবে।
        const pendingResetInfo = async () => {
          if (!msg.from?.id) return null;
          const { data } = await supabaseAdmin
            .from("slot_reset_requests")
            .select("id, slots, user_id, created_at")
            .eq("tg_user_id", msg.from.id)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!data) return null;
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("uid_seq, display_name")
            .eq("id", data.user_id)
            .maybeSingle();
          return {
            slots: (data.slots as number[]) ?? [],
            uid: prof?.uid_seq != null ? String(prof.uid_seq) : "",
            name: prof?.display_name || "ইউজার",
          };
        };

        const sendPendingResetNotice = async (p: {
          slots: number[];
          uid: string;
          name: string;
        }) => {
          await clearSession();
          const slotText = p.slots.length ? p.slots.map((s) => `${s} নম্বর`).join(", ") : "সব";
          await sendMessage(
            chatId,
            `✅ <b>আপনার স্লট রিসেটের অনুরোধ আগেই পাঠানো হয়েছে</b> — নতুন করে UID দেওয়ার দরকার নেই 🙂\n\n` +
              `👤 একাউন্ট: <b>${p.name}</b>${p.uid ? `\n🆔 UID: <code>${p.uid}</code>` : ""}\n` +
              `📦 অনুরোধ করা স্লট: <b>${slotText}</b>\n\n` +
              `⏳ এখন শুধু <b>আপনার নিজের অনুমোদন</b> বাকি:\n` +
              `১️⃣ অ্যাপে লগইন করে একবার রিফ্রেশ দিন\n` +
              `২️⃣ স্ক্রিনে আসা <b>“স্লট রিসেটের অনুমোদন দরকার”</b> বক্সটি দেখুন\n` +
              `৩️⃣ <b>“হ্যাঁ, রিসেট করুন”</b> চাপুন\n\n` +
              `✅ অনুমোদন দিলেই স্লটটি রিসেট হবে এবং আমি এখানেই রিপোর্ট দিয়ে জানাব 💙`,
            msg.message_id,
          );
          await logMessage(
            "question",
            `slot-reset-pending:${p.slots.join("|")}`,
            "pending reset reminder",
            p.uid || null,
          );
        };

        // ইউজার কোনো নির্দিষ্ট স্লট নিয়ে সমভাইয়া কথা বললে ("৩ নম্বর স্লটে
        // রি-ভেরিফাই হচ্ছে না") — উত্তরের সাথে জিজ্ঞেস করব স্লটটি রিসেট করে
        // দেব কি না। রাজি হলে UID চেয়ে সাথে সাথেই রিসেট করে দেব।
        const mentionedSlot: number | null = (() => {
          const m =
            norm.match(
              /(\d{1,3})\s*(?:no|nombor|number|নম্বর|নাম্বার|নং)?\s*(?:er|এর)?\s*(?:slot|স্লট)/i,
            ) ||
            norm.match(/(?:slot|স্লট)\s*(?:no|number|নম্বর|নাম্বার|নং)?\s*[:#-]?\s*(\d{1,3})/i);
          const n = m ? Number(m[1]) : NaN;
          return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
        })();

        /**
         * স্ক্রিনশটটি অন্য কোনো সমভাইয়া (ক্যামেরা পারমিশন, লিংক এক্সপায়ার,
         * টুইন/ডুপ্লিকেট ফেস, নেটওয়ার্ক) হলে বয়সের কথা তোলা যাবে না — ইউজার
         * যেই স্ক্রিনশট দিয়েছে, উত্তরটাও ঠিক সেটারই হবে।
         */
        const otherErrorHit = (): boolean =>
          /(camera|ক্যামেরা|permission|পারমিশন|access your camera|device settings|expired|no longer valid|লিংক এক্সপায়ার|twin|already verified|network|internet|something went wrong)/i.test(
            `${norm} ${shotText || ""}`,
          );

        /** স্ক্রিনশটে/লেখায় "১৮ বছরের নিচে" ধরনের বার্তা আছে কি না। */
        const underAgeHit = (): boolean =>
          !otherErrorHit() &&
          /(18|১৮)\s*(\+|বছর|bochor|years?)?[^\n]{0,40}(niche|নিচে|under|kom|কম|below)|under\s*-?\s*age|আপনার বয়স|too young|minimum age/i.test(
            `${norm} ${shotText || ""}`,
          );

        const offerSlotResetSuffix = async (): Promise<string> => {
          if (!msg.from?.id) return "";
          if ((settings as any).slot_reset_enabled === false) return "";
          const forced = !mentionedSlot && (underAgeHit() || wantsSlotRemoval);
          if (!forced && (!mentionedSlot || !reportsProblem)) return "";
          const known = await linkedUid();
          try {
            await saveSession({
              step: mentionedSlot ? "offer_reset" : known ? "await_slot" : "await_uid",
              uid: known,
              app_user_id: null,
              data: { slots: mentionedSlot ? [mentionedSlot] : [] },
            });
          } catch {
            return "";
          }
          if (!mentionedSlot) {
            return (
              `\n\n———\n🔄 জি অবশ্যই ভাইয়া, আমরা আপনার স্লটটি রিসেট করে দিতে পারি।\n` +
              `রিসেট করলে ওই স্লটটি একদম খালি হয়ে যাবে, তারপর নতুন করে (১৮+ ফেস দিয়ে) আবার ভেরিফাই করতে পারবেন।\n\n` +
              (known
                ? `👉 শুধু বলুন <b>কত নম্বর স্লটটি</b> রিসেট করতে চান (যেমন: 3, বা 2,5,7) 💙`
                : `👉 দয়া করে আপনার <b>UID</b> নম্বরটি দিন এবং বলুন <b>কত নম্বর স্লটটি</b> রিসেট করতে চান 💙`)
            );
          }
          return (
            `\n\n———\n🔄 আপনি কি <b>${mentionedSlot} নম্বর স্লটটি</b> রিসেট করে নিতে চান?\n` +
            `রিসেট করলে ওই স্লটটি একদম খালি হয়ে যাবে, তারপর নতুন করে (১৮+ ফেস দিয়ে) আবার ভেরিফাই করতে পারবেন।\n\n` +
            (known
              ? `👉 চাইলে শুধু লিখুন <b>হ্যাঁ</b> — সাথে সাথেই স্লটটি রিসেটের অনুরোধ পাঠিয়ে দেব 💙`
              : `👉 চাইলে লিখুন <b>হ্যাঁ</b> — এরপর শুধু আপনার <b>UID</b> নম্বরটি দিলেই আমি সাথে সাথে স্লটটি রিসেট করে জানিয়ে দেব 💙`)
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
            .from("tg_sessions")
            .select("*")
            .eq("tg_user_id", msg.from.id)
            .eq("chat_id", msg.chat.id)
            .maybeSingle();

          const aliveRaw = sess && new Date(sess.expires_at).getTime() > Date.now();
          if (sess && !aliveRaw) await clearSession();

          // The user changed the subject → forget the pending question and
          // answer what they actually asked now.
          const answering =
            sess?.step === "offer_reset"
              ? isAffirmation(norm) ||
                looksLikeUidAnswer ||
                /(রিসেট|reset|হ্যাঁ|হা|জি|করে দিন|kore din|kore den|chai|চাই)/i.test(norm)
              : sess?.intent === "slot_restore"
                ? looksLikeSlotAnswer || looksLikeUidAnswer || wantsAll
                : sess?.intent === "withdraw_status" ||
                    sess?.intent === "verification_dates" ||
                    sess?.intent === "account_info" ||
                    sess?.intent === "referral_join" ||
                    sess?.intent === "referral_history" ||
                    sess?.intent === "wallet_reset"
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
              await sendMessage(
                chatId,
                "ঠিক আছে, রিসেটের অনুরোধটি বাতিল করা হলো। 🙂",
                msg.message_id,
              );
              await logMessage("question", "slot-reset-cancel", null, sess.uid);
              return Response.json({ ok: true, flow: "cancelled" });
            }

            // ---- স্লট ফিরিয়ে আনার কথাবার্তা চলছে ----------------------------
            if (sess.intent === "slot_restore") {
              const uid =
                (sess.uid as string | null) || pickUidFromCurrentOrReply() || (await linkedUid());
              if (!uid) {
                await sendMessage(
                  chatId,
                  "🆔 শুধু আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন) — তারপরই কোন কোন স্লট ফিরিয়ে আনা যাবে দেখিয়ে দিচ্ছি 💙",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "slot-restore-await-uid" });
              }

              const { listRestorableForUid, restoreSlotsForUid } =
                await import("@/lib/telegram-slot-restore.server");
              const wanted = wantsAll ? [] : pickSlots(norm.replace(uid, " "));

              if (!wanted.length && !wantsAll) {
                const list = await listRestorableForUid(uid);
                const reply =
                  list.found && list.slots.length
                    ? `🗂️ <b>${list.name}</b> (UID <code>${list.uid}</code>) — যেসব স্লট রিসেট করা হয়েছিল 👇\n\n` +
                      list.slots
                        .map(
                          (s) =>
                            `• <b>স্লট ${s.slot}</b> — ${new Date(s.created_at).toLocaleDateString("bn-BD")}`,
                        )
                        .join("\n") +
                      `\n\n🔢 কোন কোন স্লট ফিরিয়ে আনবো? নম্বর লিখুন (যেমন: 4 অথবা 2,5) — সবগুলোর জন্য লিখুন <b>সব</b>।`
                    : `🙂 এই একাউন্টে ফিরিয়ে আনার মতো কোনো রিসেট করা স্লট পাওয়া যায়নি।`;
                await saveSession({ intent: "slot_restore", step: "await_slot", uid } as any);
                await sendMessage(chatId, reply, msg.message_id);
                await logMessage("question", "slot-restore-list", reply, uid);
                return Response.json({ ok: true, flow: "slot-restore-list" });
              }

              const res = await restoreSlotsForUid(uid, wanted);
              await clearSession();
              const reply = !res.found
                ? `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি।`
                : res.done.length
                  ? `✅ <b>ফিরিয়ে আনা হয়েছে!</b>\n\n` +
                    `📦 স্লট: <b>${res.done.join(", ")}</b>\n` +
                    `🔑 আগের key, ফেস ফটো ও ভেরিফিকেশনের তারিখ হুবহু আগের মতোই ফিরে এসেছে।\n` +
                    (res.failed.length ? `⚠️ পারা যায়নি: ${res.failed.join(", ")}\n` : "") +
                    `\n👉 অ্যাপটি একবার রিফ্রেশ দিলেই স্লটগুলো দেখতে পাবেন 💙`
                  : `⚠️ ঐ স্লটগুলো ফিরিয়ে আনা যায়নি।${res.available.length ? ` ফিরিয়ে আনা যাবে: <b>${res.available.join(", ")}</b>` : ""}`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", `slot-restore:${res.done.join("|")}`, reply, uid);
              return Response.json({ ok: true, flow: "slot-restore" });
            }

            if (sess.intent === "wallet_reset") {
              const rememberedProvider = (sess.data as any)?.provider as
                | "bkash"
                | "nagad"
                | undefined;
              const provider = rememberedProvider || walletResetProvider;
              if (sess.step === "await_provider" && !provider) {
                await sendMessage(
                  chatId,
                  "কোন নম্বরটি বদলাতে চান—<b>বিকাশ</b> নাকি <b>নগদ</b>?",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "wallet-reset-await-provider" });
              }

              const uid = pickUidFromCurrentOrReply();
              if (!uid) {
                await saveSession({
                  intent: "wallet_reset",
                  step: "await_uid",
                  data: { provider },
                });
                await sendMessage(
                  chatId,
                  `${provider === "nagad" ? "নগদ" : "বিকাশ"} নম্বরটি রিসেট করে দিচ্ছি। শুধু আপনার <b>UID</b> লিখুন।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "wallet-reset-await-uid" });
              }

              const { resetPaymentNumbersForUid, walletResetReply } =
                await import("@/lib/telegram-wallet.server");
              const result = await resetPaymentNumbersForUid(uid, provider);
              const reply = walletResetReply(result);
              if (result.ok) await clearSession();
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage(
                "question",
                `wallet-reset:${provider ?? "all"}`,
                reply,
                result.ok ? uid : null,
              );
              return Response.json({ ok: true, flow: "wallet-reset-complete" });
            }

            if (sess.intent === "withdraw_status" && sess.step === "await_uid") {
              const uid = pickUidFromCurrentOrReply() || (await linkedUid());
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
              const uid = pickUidFromCurrentOrReply() || (await linkedUid());
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

            if (sess.intent === "referral_join" && sess.step === "await_uid") {
              const uid = pickUidFromCurrentOrReply() || (await linkedUid());
              if (!uid) {
                await sendMessage(
                  chatId,
                  `🔗 কোন একাউন্ট কার রেফারে join করেছে সেটা দেখতে তার <b>UID</b> নম্বরটি লিখুন (যেমন: 72)।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "referral-join-await-uid" });
              }
              const { buildReferralJoinReport } = await import("@/lib/telegram-lookup.server");
              const res = await buildReferralJoinReport(uid);
              if (res.found) await clearSession();
              const reply = res.found
                ? res.card
                : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "referral-join", reply, res.found ? res.uid : null);
              return Response.json({ ok: true, flow: "referral-join-session" });
            }

            if (sess.intent === "referral_history" && sess.step === "await_uid") {
              const uid = pickUidFromCurrentOrReply() || (await linkedUid());
              if (!uid) {
                await sendMessage(
                  chatId,
                  `🆔 আপনার <b>UID</b> নম্বরটি লিখুন — তাহলে আপনার পুরো রেফার হিস্টরি দেখে জানিয়ে দিচ্ছি।`,
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "referral-history-await-uid" });
              }
              const { buildReferralHistoryReport } = await import("@/lib/telegram-lookup.server");
              const res = await buildReferralHistoryReport(uid);
              if (res.found) await clearSession();
              const reply = res.found
                ? res.card
                : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "referral-history", reply, res.found ? res.uid : null);
              return Response.json({ ok: true, flow: "referral-history-session" });
            }

            if (sess.intent === "verification_dates" && sess.step === "await_uid") {
              const query = pickVerificationQuery(norm) || pickUidFromCurrentOrReply();
              if (!query) {
                await sendMessage(
                  chatId,
                  "🆔 যার ভেরিফিকেশনের তারিখ জানতে চান, তার <b>UID</b> লিখুন। নাম দিয়েও লিখতে পারেন, তবে UID দিলে সবচেয়ে ঠিক রিপোর্ট পাবেন।",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "verification-date-await-uid" });
              }

              const { buildVerificationDateReport, buildReverifyStatusReport } =
                await import("@/lib/telegram-lookup.server");
              const kind = ((sess.data as any)?.kind || "first") as
                | "first"
                | "reverify"
                | "all"
                | "reverify_status";
              const res =
                kind === "reverify_status"
                  ? await buildReverifyStatusReport(query)
                  : await buildVerificationDateReport(query, kind);
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

            // বট নিজে থেকে "স্লটটি রিসেট করে দেব?" জিজ্ঞেস করেছিল — এখানে
            // হ্যাঁ/না এর উত্তর নেওয়া হয়।
            if (sess.step === "offer_reset") {
              const pending = (((sess.data as any)?.slots ?? []) as number[]).filter(
                (n) => Number(n) > 0,
              );
              const slotLabel = pending.length ? `${pending.join(", ")} নম্বর স্লট` : "স্লটটি";
              const said = norm;
              const saidNo = /(না|na\b|no\b|lagbe na|লাগবে না|চাই না|chai na|থাক)/i.test(said);
              const saidYes =
                isAffirmation(said) ||
                /(হ্যাঁ|হা\b|জি|রিসেট|reset|করে দিন|kore din|kore den|chai|চাই|dao|দাও)/i.test(
                  said,
                );

              if (saidNo && !saidYes) {
                await clearSession();
                await sendMessage(
                  chatId,
                  "ঠিক আছে, রিসেট করা হলো না 🙂 অন্য কোনো সাহায্য লাগলে নির্দ্বিধায় বলবেন 💙",
                  msg.message_id,
                );
                return Response.json({ ok: true, flow: "offer-reset-declined" });
              }

              const uidNow =
                pickUid(said) || (replyNorm ? pickUid(replyNorm) : null) || (await linkedUid());
              if (uidNow) {
                const { findProfileByUid } = await import("@/lib/telegram-slot.server");
                const prof = await findProfileByUid(uidNow);
                if (prof) {
                  await saveSession({
                    step: "await_slot",
                    uid: uidNow,
                    app_user_id: prof.id,
                    data: { slots: pending },
                  });
                  await doReset(uidNow, pending);
                  return Response.json({ ok: true, flow: "offer-reset-done" });
                }
              }

              if (saidYes || uidNow) {
                await saveSession({ step: "await_uid", data: { slots: pending } });
                await sendMessage(
                  chatId,
                  `দারুণ! 😊 <b>${slotLabel}</b> রিসেট করে দিচ্ছি।\n\n` +
                    `🆔 শুধু আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন, যেমন: 4100)।\n` +
                    `UID পেলেই সাথে সাথে রিসেট করে জানিয়ে দেব 💙`,
                  msg.message_id,
                );
                await logMessage("question", "offer-reset-accepted", null, null);
                return Response.json({ ok: true, flow: "offer-reset-await-uid" });
              }
            }

            if (sess.step === "await_uid") {
              const already = await pendingResetInfo();
              if (already) {
                await sendPendingResetNotice(already);
                return Response.json({ ok: true, flow: "slot-reset-pending" });
              }
              const uid = pickUidFromCurrentOrReply() || (await linkedUid());
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
              const remembered = (((sess.data as any)?.slots ?? []) as number[]).filter(
                (n) => Number(n) > 0,
              );
              if (remembered.length) {
                await saveSession({
                  step: "await_slot",
                  uid,
                  app_user_id: prof.id,
                  data: { slots: remembered },
                });
                await doReset(uid, remembered);
                return Response.json({ ok: true, flow: "reset" });
              }
              const slotsNow = (() => {
                const f = pickSlots(norm.replace(uid, " "));
                return f.length ? f : mentionedSlot ? [mentionedSlot] : [];
              })();

              if (slotsNow.length || wantsAll) {
                await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
                await doReset(uid, wantsAll ? [] : slotsNow);
                return Response.json({ ok: true, flow: "reset" });
              }
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              await sendMessage(
                chatId,
                `✅ একাউন্ট পাওয়া গেছে: <b>${prof.display_name || "ইউজার"}</b> (UID <code>${uid}</code>)\n\n` +
                  `🔢 ${settings.ask_slot_message || 'কোন কোন স্লট রিসেট করতে চান? এক বা একাধিক নম্বর লিখুন (যেমন: 3 অথবা 2,5,7 অথবা 2-6, সবগুলোর জন্য লিখুন "সব")'}`,
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

        // ---- "রিসেট করা স্লটগুলো ফিরিয়ে দিন" → কোনগুলো ফেরানো যাবে দেখাই ------
        if (
          settings.auto_reply_enabled &&
          msg.from?.id &&
          /(slot|স্লট)/i.test(norm) &&
          /(back|ব্যাক|ফিরি|ফিরে|ফেরত|ফিরায়|firay|ferot|firiye|restore|রিস্টোর|আগের অবস্থা|ফেরান|ফিরিয়ে)/i.test(
            norm,
          )
        ) {
          const uid = pickUidFromCurrentOrReply() || (await linkedUid());
          const { listRestorableForUid } = await import("@/lib/telegram-slot-restore.server");
          if (!uid) {
            await saveSession({ intent: "slot_restore", step: "await_uid" } as any);
            const reply =
              `🔄 <b>রিসেট করা স্লট ফিরিয়ে আনা যায়</b> — key, ফেস ফটো সব আগের মতোই ফিরে আসবে ✅\n\n` +
              `🆔 শুধু আপনার <b>UID</b> নম্বরটি লিখুন — তারপর কোন কোন স্লট রিসেট হয়েছিল দেখিয়ে দেব 💙`;
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage("question", "slot-restore-ask-uid", reply, null);
            return Response.json({ ok: true, flow: "slot-restore-ask-uid" });
          }

          const list = await listRestorableForUid(uid);
          if (list.found && list.slots.length) {
            await saveSession({ intent: "slot_restore", step: "await_slot", uid } as any);
            const reply =
              `🗂️ <b>${list.name}</b> (UID <code>${list.uid}</code>) — যেসব স্লট রিসেট করা হয়েছিল 👇\n\n` +
              list.slots
                .map(
                  (s) =>
                    `• <b>স্লট ${s.slot}</b> — ${new Date(s.created_at).toLocaleDateString("bn-BD")}`,
                )
                .join("\n") +
              `\n\n🔢 কোন কোন স্লট ফিরিয়ে আনবো? নম্বর লিখুন (যেমন: 4 অথবা 2,5) — সবগুলোর জন্য লিখুন <b>সব</b>।`;
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage("question", "slot-restore-list", reply, uid);
            return Response.json({ ok: true, flow: "slot-restore-list" });
          }

          const reply = list.found
            ? `🙂 আপনার একাউন্টে (UID <code>${list.uid}</code>) ফিরিয়ে আনার মতো কোনো রিসেট করা স্লট পাওয়া যায়নি।\nনতুন করে ফেস ভেরিফিকেশন করে স্লটটি চালু করে নিতে পারেন 💙`
            : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি — সঠিক UID টি লিখুন।`;
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("question", "slot-restore-none", reply, uid);
          return Response.json({ ok: true, flow: "slot-restore-none" });
        }

        // ---- ইউজার শুধু UID লিখলে (আগেই যা চেয়েছিল সেটাই) সাথে সাথে হিসাব -----
        // আগে আবার "কী চেক করে দেব?" জিজ্ঞেস করা হতো — সেটা বিরক্তিকর, তাই
        // খালি নম্বর পেলেই সরাসরি পুরো একাউন্টের হিসাব পাঠিয়ে দিই।
        if (
          settings.auto_reply_enabled &&
          !(photos?.length ?? 0) &&
          /^(?:uid|ইউআইডি|আইডি)?\s*[:#-]?\s*\d{1,9}\s*$/i.test(norm)
        ) {
          const bareUid = (norm.match(/\d{1,9}/) || [""])[0];
          if (bareUid) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            const res = await buildUserCard(bareUid);
            if (res.found) {
              await clearSession();
              await sendMessage(chatId, res.card, msg.message_id);
              await logMessage("question", "account-info-bare-uid", res.card, bareUid);
              return Response.json({ ok: true, flow: "account-info-bare-uid" });
            }
          }
        }

        // ---- "অ্যাডমিন কোথায়?" → funny reply that mentions the real admin ----
        if (
          settings.auto_reply_enabled &&
          /(admin|অ্যাডমিন|এডমিন|এ্যাডমিন)/i.test(norm) &&
          /(kothai|kothay|কোথায়|kotha|নাই|nai|ase na|আসেন না|কে\b|ke\b|koi|কই|dakun|ডাকুন|call)/i.test(
            norm,
          )
        ) {
          const { adminWhereReply } = await import("@/lib/telegram-bot.server");
          const reply = adminWhereReply(
            senderName,
            (settings as any).support_username || "@anamulmunni",
          );
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("question", "admin-where", reply, null);
          return Response.json({ ok: true, flow: "admin-where" });
        }

        const bannedWords: string[] = settings.banned_words ?? [];
        const lower = text.toLowerCase();
        const hardHit = bannedWords.find((w) => w && lower.includes(w.toLowerCase()));

        const [{ data: faqRows }, { data: videoRows }, { data: voiceRows }] = await Promise.all([
          supabaseAdmin
            .from("tg_faq")
            .select("topic, answer, keywords, image_path, updated_at")
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .order("updated_at", { ascending: false })
            .order("id"),
          (supabaseAdmin as any)
            .from("tg_videos")
            .select("topic, url, keywords, note")
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .order("id"),
          (supabaseAdmin as any)
            .from("tg_voices")
            .select("topic, keywords, note, audio_path")
            .eq("is_active", true)
            .order("priority", { ascending: false })
            .order("id"),
        ]);

        // Problem replies get the matching tutorial video link appended (if the
        // admin saved one for that topic) so users can watch instead of asking again.
        /**
         * অ্যাডমিন কিওয়ার্ড না দিলেও যেন ঠিক ভিডিওটি যায় — তাই বিষয় অনুযায়ী
         * (কিভাবে কাজ করবেন / ভেরিফাই হয় না / দূরে থাকা বন্ধু) ম্যাপিং করা আছে।
         */
        const pickVideo = (extra?: string): any | null => {
          const list = (videoRows ?? []) as any[];
          if (!list.length) return null;
          const hay = `${norm} ${(extra || "").toLowerCase()}`;
          const byKeyword = list.find(
            (v: any) =>
              (v.keywords ?? []).some((k: string) => k && hay.includes(String(k).toLowerCase())) ||
              (v.topic && hay.includes(String(v.topic).toLowerCase())),
          );
          if (byKeyword) return byKeyword;

          const topicOf = (re: RegExp) => list.find((v: any) => re.test(String(v.topic || "")));
          // ১) দূরে থাকা বন্ধুকে দিয়ে রি-ভেরিফাই
          if (
            /(dure|দূরে|dur|far|onno jaygay|অন্য জায়গায়|bideshe|বিদেশ|chole gese|চলে গেছে|kache nei|কাছে নেই)/i.test(
              hay,
            )
          ) {
            const v = topicOf(/(dure|দূরে|friend|বন্ধু|re ?-?verify)/i);
            if (v) return v;
          }
          // ২) ভেরিফাই হচ্ছে না / something went wrong / ব্রাউজার সমস্যা
          if (
            /(hocche na|হচ্ছে না|hoi na|হয় না|something went wrong|error|এরর|somossa|সমস্যা|browser|ব্রাউজার|camera|ক্যামেরা|fail|ফেইল)/i.test(
              hay,
            )
          ) {
            const v = topicOf(/(hoi na|হয় না|verification|verify|ভেরিফা|wrong|problem|সমস্যা)/i);
            if (v) return v;
          }
          // ৩) কিভাবে কাজ করবেন
          if (
            /(kivabe|কিভাবে|কীভাবে|kemne|কেমনে|kaj|কাজ|shuru|শুরু|new|নতুন|tutorial|টিউটোরিয়াল|video|ভিডিও)/i.test(
              hay,
            )
          ) {
            const v = topicOf(/(kivabe|কিভাবে|কাজ|kaj|tutorial|শুরু)/i);
            if (v) return v;
          }
          return null;
        };

        const videoSuffix = (extra?: string): string => {
          const match = pickVideo(extra);
          if (!match?.url) return "";
          return `\n\n📺 <b>${match.topic}</b> — ভিডিওতে দেখে নিন: ${match.url}`;
        };

        const withdrawHowToReply = (name: string) =>
          `${name}, উইথড্র করার আলাদা ভিডিও এখনো যোগ করা হয়নি। তবে খুব সহজ 👇\n\n` +
          `১️⃣ Wallet পেজে bKash/Nagad নম্বর সেভ করুন\n` +
          `২️⃣ Withdraw পেজে মাধ্যম ও টাকার পরিমাণ দিন\n` +
          `৩️⃣ রিকোয়েস্ট Submit করুন — সাধারণত ৫–১০ মিনিটে পেমেন্ট পাবেন ✅`;

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
          faq.push({
            topic: f.topic,
            answer: f.answer,
            keywords: (f as any).keywords,
            imageBase64,
          });
        }

        // Built-in answers (always available) — admin rows above take priority.
        {
          const { BUILTIN_FAQS } = await import("@/lib/telegram-builtin-faq.server");
          for (const b of BUILTIN_FAQS) {
            if (
              faq.some((f) => String(f.topic).trim().toLowerCase() === b.topic.trim().toLowerCase())
            )
              continue;
            faq.push({
              topic: b.topic,
              answer: b.answer,
              // স্ক্রিনশটের সাধারণ শব্দ (যেমন "ভেরিফাই") লেখা মেলানোর কাজে
              // ব্যবহার করা যাবে না — এতে ভুল উত্তর চলে যেত। ছবি পাঠালেই
              // ঐ শব্দগুলো যোগ হবে।
              keywords: photoBase64 ? [...b.keywords, ...b.screenshot] : b.keywords,

              imageBase64: null,
            });
          }
        }

        // অ্যাডমিন শুধু প্রশ্ন/ছবি সেভ করলে (উত্তর লেখা না থাকলে) বট নিজেই
        // অ্যাপের নিয়ম ও ডেটাবেজ দেখে উত্তরটা লিখে দেবে।
        const faqAnswerFor = async (f: any, userText?: string): Promise<string | null> => {
          const saved = String(f?.answer ?? "").trim();
          if (saved) {
            const { fillRates } = await import("@/lib/telegram-builtin-faq.server");
            const { loadRates } = await import("@/lib/telegram-knowledge.server");
            return fillRates(saved, await loadRates());
          }
          try {
            const { composeFaqAnswer } = await import("@/lib/telegram-agent.server");
            const { knowledgeText, loadRates } = await import("@/lib/telegram-knowledge.server");
            const { appRulebook } = await import("@/lib/telegram-app-rules.server");
            const rates = await loadRates();
            return await composeFaqAnswer({
              name: senderName,
              topic: String(f?.topic ?? ""),
              keywords: Array.isArray(f?.keywords) ? f.keywords : [],
              userText,
              knowledge: knowledgeText(rates),
              rulebook: appRulebook(rates),
            });
          } catch (e) {
            console.error("[tg] faq compose failed", e);
            return null;
          }
        };

        if (photoBase64 && settings.auto_reply_enabled) {
          // স্ক্রিনশটে ঠিক ঐ সমভাইয়া লেখা থাকলেই সেভ করা ভয়েস যাবে।
          // "try again" / "face verification" এর মতো সাধারণ শব্দ সব এররেই থাকে,
          // তাই ওগুলো দিয়ে ম্যাচ করা হয় না — শুধু নির্দিষ্ট বাক্যাংশ দিয়ে।
          try {
            const { readScreenshotText, voiceBytes, sendVoice } =
              await import("@/lib/telegram-bot.server");
            shotText = shotText || (await readScreenshotText(photoBase64)) || "";
            const shotLower = shotText.toLowerCase();
            // Twin / duplicate-face errors must never trigger another topic's voice.
            const isDuplicateShot =
              /(already|duplicate|twin|someone else|another account|onno account|ডুপ্লিকেট|আগে.*ভেরিফাই)/i.test(
                shotLower,
              );
            const GENERIC = [
              "try again",
              "face verification",
              "face verification error",
              "ভেরিফিকেশন এরর",
              "verification error",
              "verify",
              "camera",
              "error",
              "সমস্যা",
            ];
            const vMatch =
              shotLower && !isDuplicateShot
                ? ((voiceRows as any[]) ?? []).find((v: any) =>
                    [...(Array.isArray(v.keywords) ? v.keywords : []), String(v.topic ?? "")]
                      .map((k: any) => String(k).trim().toLowerCase())
                      // distinctive phrases only: long, multi-word, not generic
                      .filter(
                        (k: string) => k.length >= 14 && k.includes(" ") && !GENERIC.includes(k),
                      )
                      .some((k: string) => shotLower.includes(k)),
                  )
                : null;
            if (vMatch?.audio_path) {
              const bytes = await voiceBytes(vMatch.audio_path);
              if (bytes) {
                await sendVoice(
                  chatId,
                  bytes,
                  String(vMatch.audio_path).split("/").pop() || "voice.mp3",
                  undefined,
                  msg.message_id,
                );
              }
            }
          } catch (e) {
            console.error("[tg] screenshot voice match failed", e);
          }

          try {
            const { matchFaqImage, humanizeReply } = await import("@/lib/telegram-bot.server");
            const imageMatch = await matchFaqImage({ photoBase64, faq });
            if (imageMatch) {
              const matchedFaq = faq.find(
                (f) =>
                  String(f.topic).trim().toLowerCase() === imageMatch.topic.trim().toLowerCase(),
              );
              const answerText = matchedFaq
                ? await faqAnswerFor(matchedFaq, text || shotText)
                : null;
              if (answerText) {
                let recent: string[] = [];
                if (msg.from?.id) {
                  const { data: prev } = await supabaseAdmin
                    .from("tg_messages")
                    .select("bot_reply")
                    .eq("tg_user_id", msg.from.id)
                    .order("created_at", { ascending: false })
                    .limit(3);
                  recent = (prev ?? []).map((p: any) => p.bot_reply).filter(Boolean);
                }
                const reply = await humanizeReply(answerText.trim(), text, recent);
                await sendMessage(chatId, reply, msg.message_id);
                await logMessage(
                  "question",
                  `faq-image:${imageMatch.topic}:${imageMatch.confidence.toFixed(2)}`,
                  reply,
                  null,
                );
                return Response.json({
                  ok: true,
                  flow: "faq-image-match",
                  topic: imageMatch.topic,
                });
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
            shotText = shotText || (await readScreenshotText(photoBase64)) || "";
            if (shotText) {
              const hay = shotText.toLowerCase();
              const scored = faq
                .map((f) => {
                  const keys: string[] = [
                    ...(Array.isArray(f.keywords)
                      ? f.keywords
                      : String(f.keywords ?? "").split(/[,\n]/)),
                    String(f.topic ?? ""),
                  ]
                    .map((k) => String(k).trim().toLowerCase())
                    .filter((k) => k.length > 3);
                  const score = keys.filter((k) => hay.includes(k)).length;
                  return { f, score };
                })
                .sort((a, b) => b.score - a.score)[0];
              const ocrAnswer =
                scored && scored.score > 0 ? await faqAnswerFor(scored.f, text || shotText) : null;
              if (ocrAnswer) {
                const base = ocrAnswer.trim();
                const reply = (await humanizeReply(base, text || shotText, [])) || base;
                await sendMessage(chatId, reply, msg.message_id);
                await logMessage("question", `faq-ocr:${scored.f.topic}`, reply, null);
                return Response.json({ ok: true, flow: "faq-ocr", topic: scored.f.topic });
              }
            }
          } catch (e) {
            console.error("[tg] screenshot ocr match failed", e);
          }

          // ---- deterministic built-in match straight from the OCR text -------
          // "You must be 18 years or older", "Something went wrong", "We found
          // your twin" ইত্যাদি এররে বট যেন কখনোই চুপ না থাকে।
          try {
            const { readScreenshotText, humanizeReply } = await import("@/lib/telegram-bot.server");
            const { BUILTIN_FAQS } = await import("@/lib/telegram-builtin-faq.server");
            shotText = shotText || (await readScreenshotText(photoBase64)) || "";
            const hay = shotText.toLowerCase();
            const rules: { re: RegExp; topic: string }[] = [
              {
                re: /(found your twin|your twin|duplicate|already (been )?verified|same face)/i,
                topic: "twin",
              },
              {
                re: /(18 years or older|must be 18|under 18|under age|underage|years of age)/i,
                topic: "18+",
              },
              {
                re: /(something went wrong|oops|try again later|unexpected error)/i,
                topic: "something went wrong",
              },
              { re: /(access your camera|camera permission|allow camera)/i, topic: "ক্যামেরা" },
              { re: /(no longer valid|link is|expired|session)/i, topic: "এক্সপায়ার" },
            ];
            let hit: { topic: string; answer: string } | null = null;
            if (hay) {
              for (const r of rules) {
                if (!r.re.test(hay)) continue;
                const f = BUILTIN_FAQS.find((b) =>
                  b.topic.toLowerCase().includes(r.topic.toLowerCase()),
                );
                if (f) {
                  hit = { topic: f.topic, answer: f.answer };
                  break;
                }
              }
            }
            if (hit) {
              const { fillLiveRates } = await import("@/lib/telegram-builtin-faq.server");
              const grounded = await fillLiveRates(hit.answer);
              const reply = (await humanizeReply(grounded, text || shotText, [])) || grounded;
              await sendMessage(chatId, reply + (await offerSlotResetSuffix()), msg.message_id);
              await logMessage("question", `faq-builtin-ocr:${hit.topic}`, reply, null);
              return Response.json({ ok: true, flow: "faq-builtin-ocr", topic: hit.topic });
            }
          } catch (e) {
            console.error("[tg] builtin ocr match failed", e);
          }

          // No admin screenshot matched → try the built-in problem library
          // (e.g. GoodDollar "We found your twin" duplicate-face page).
          try {
            const { matchBuiltinFaqPhoto, humanizeReply } =
              await import("@/lib/telegram-bot.server");
            const answer = await matchBuiltinFaqPhoto(photoBase64);
            if (answer) {
              const reply = (await humanizeReply(answer, text, [])) || answer;
              await sendMessage(chatId, reply + (await offerSlotResetSuffix()), msg.message_id);
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
            /(\bkn\b|\bken\b|\bkno\b|keno|কেন|\bকন\b|\bwhy\b|eta ki|eita ki|এটা কি|এইটা কি|ki problem|ki hoise|কি সমস্যা|কি হইছে|somadhan|সমাধান|solution|ki korbo|কি করবো)/i.test(
              t,
            );
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
                // The screenshot itself has already received the full answer.
                // A separate “এটা কী সমস্যা?” immediately afterwards is the
                // same question, so do not send the same explanation twice.
                await logMessage("question", "screenshot-followup-already-answered", null, null);
                return Response.json({ ok: true, flow: "screenshot-followup-already-answered" });
              }
            } catch (e) {
              console.error("[tg] screenshot follow-up failed", e);
            }
          }
        }

        // ---- "এই UID কার রেফারে join করেছে?" → আগেই হ্যান্ডেল (FAQ/how-to এর আগে)
        if (asksReferralJoin && !photoBase64 && settings.auto_reply_enabled) {
          const uid = pickUidFromCurrentOrReply();
          if (uid) {
            const { buildReferralJoinReport } = await import("@/lib/telegram-lookup.server");
            const res = await buildReferralJoinReport(uid);
            const reply = res.found
              ? res.card
              : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage("question", "referral-join", reply, res.found ? res.uid : null);
            return Response.json({ ok: true, flow: "referral_join_early" });
          }
          if (msg.from?.id) {
            await saveSession({
              intent: "referral_join",
              step: "await_uid",
              uid: null,
              app_user_id: null,
            });
          }
          const askReply =
            `🔗 কোন একাউন্ট কার রেফারে join করেছে সেটা দেখে দিচ্ছি।\n` +
            `শুধু ওই ইউজারের <b>UID</b> নম্বরটি লিখুন 💙`;
          await sendMessage(chatId, askReply, msg.message_id);
          await logMessage("question", "referral-join-ask-uid", askReply, null);
          return Response.json({ ok: true, flow: "referral_join_ask_uid_early" });
        }

        // Recent bot replies for this user — used to avoid repeating the same
        // wording and to detect "I already did that, still not working".
        let recentReplies: string[] = [];
        let lastTopic = "";
        let lastBase = "";
        if (msg.from?.id) {
          try {
            const { data: prevN } = await supabaseAdmin
              .from("tg_messages")
              .select("action, bot_reply, created_at")
              .eq("tg_user_id", msg.from.id)
              .order("created_at", { ascending: false })
              .limit(4);
            recentReplies = (prevN ?? []).map((p: any) => p.bot_reply).filter(Boolean);
            const last: any = (prevN ?? []).find((p: any) => p.bot_reply);
            if (last && Date.now() - new Date(last.created_at).getTime() < 6 * 60 * 60 * 1000) {
              lastTopic = String(last.action ?? "")
                .split(":")
                .slice(1)
                .join(":")
                .trim();
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
            /(koto taka|koto tk|কত টাকা|কতো টাকা|income|ইনকাম|আয়|earn|kototaka|koto pabo|কত পাবো|কত পাব|kt taka|কত দিবে|koto dibe|hisab|হিসাব|bujiye|বুঝিয়ে|bujhiye|calculation|হিসেব)/i.test(
              bnDigits,
            );
          // "আমার বন্ধু/যাকে রেফার করেছি সে ১০টা করলে আমি কত পাবো?" — এটাও রেফারেল প্রশ্ন
          const thirdParty =
            /(bondhu|bondu|বন্ধু|friend|jake|যাকে|jaka|kauke|কাউকে|jodi she|যদি সে|se jodi|সে যদি|amar under|আমার আন্ডার|আমার নিচে|downline|team|টিম|amar lok|আমার লোক|amar member|নতুন কেউ|keu jodi|কেউ যদি)/i.test(
              bnDigits,
            );
          const selfGain =
            /(ami koto|আমি কত|amake koto|আমাকে কত|ami ki pabo|আমি কি পাবো|amar ki|আমার কত)/i.test(
              bnDigits,
            );
          const referCtx =
            /(refer|reffer|refar|রেফার|রেফারেল|referral|রেফারে|আমাকে কত|amake koto)/i.test(
              bnDigits,
            ) ||
            (thirdParty && selfGain);

          // ---- "টাকা কেটে নিলো কেন" → উইথড্র ফি (ছোট, নিশ্চিত উত্তর) ----
          // ⚠️ স্লট/ভেরিফাই/বোনাস প্রসঙ্গ থাকলে এটা কখনোই চলবে না — "১০টা ভেরিফাই
          // করলে কত টাকা পাবো" প্রশ্নে আগে ভুল করে ফি-র উত্তর যেত।
          const earnAskCtx =
            /(slot|স্লট|verify|ভেরিফ|verification|ভেরিফিকেশন|bonus|বোনাস|mining|মাইনিং|refer|রেফার|pabo|পাবো|পাব|dibe|দিবে|income|ইনকাম|আয়)/i.test(
              bnDigits,
            );
          const feeCtx =
            !earnAskCtx &&
            /(fee|ফি|charge|চার্জ|kete|কেটে|কাটে|kate|katse|কাটল|কেটেছে|kom pelam|কম পেলাম|kom paisi|কম পাইছি|deduct)/i.test(
              bnDigits,
            ) &&
            /(withdraw|উইথড্র|tk|টাকা|taka|৳|bkash|বিকাশ|nagad|নগদ)/i.test(bnDigits);
          if (feeCtx) {
            const m = bnDigits.match(/(\d{2,6})\s*(tk|টাকা|taka|৳)?/);

            const amt = m ? Number(m[1]) : null;
            const { withdrawFee } = await import("@/lib/constants");
            const line =
              amt && amt >= 10 && amt <= 100000
                ? `আপনি <b>${amt}৳</b> চেয়েছেন → ফি <b>${withdrawFee(amt)}৳</b> (${amt < 100 ? "২০" : "১০"}%) → হাতে <b>${amt - withdrawFee(amt)}৳</b>।`
                : `উইথড্র ফি: ১০০৳ এর কম হলে ২০%, ১০০৳ বা তার বেশি হলে ১০%। সর্বনিম্ন ৬৩৳ (হাতে ৫০৳)।`;

            const reply =
              `${senderName} ভাই, এটা কোনো ভুল নয় 🙂\n` +
              `প্রতিটি উইথড্রে অ্যাপের সার্ভিস ফি কাটা হয়।\n` +
              `${line}\n` +
              `একসাথে বেশি টাকা তুললে ফি তুলনামূলক কম পড়ে 💙`;
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage("question", "withdraw-fee", reply, null);
            return Response.json({ ok: true, flow: "withdraw-fee" });
          }

          if (money && referCtx) {
            try {
              const { loadRates, referralEarningReply } =
                await import("@/lib/telegram-knowledge.server");
              const rates = await loadRates();
              const reply = referralEarningReply(senderName, rates);
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "referral-earning", reply, null);
              return Response.json({ ok: true, flow: "referral-earning" });
            } catch (e) {
              console.error("[tg] referral earning reply failed", e);
            }
          }
          const slotCtx =
            miningCtx ||
            /(slot|স্লট|re verify|re-verify|reverify|রি ভেরিফ|রি-ভেরিফ|verification|ভেরিফিকেশন|face)/i.test(
              bnDigits,
            );
          if (money && slotCtx) {
            try {
              const m = bnDigits.match(/(\d{1,4})\s*(ta|টা|টি|ti|slot|স্লট)?/);
              const n = m ? Number(m[1]) : null;
              const slots = n && n >= 1 && n <= 500 ? n : null;
              const monthly =
                miningCtx ||
                /(mase|মাসে|monthly|মাসিক|per month|প্রতি মাস|mas e|প্রতিমাসে)/i.test(bnDigits);

              const { loadRates, slotEarningReply } =
                await import("@/lib/telegram-knowledge.server");
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

        // ---- "কিভাবে withdraw/password reset করব?" → সরাসরি নিয়ম, UID নয়
        if (howToTopic && settings.auto_reply_enabled && !photoBase64) {
          const reply = howToReply(senderName, howToTopic);
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("question", `how-to:${howToTopic}`, reply, null);
          return Response.json({ ok: true, flow: "how-to" });
        }

        // ---- "ফেস নিয়ে আপনারা কী করেন?" → privacy/security answer, not account lookup
        if (asksFacePrivacy && settings.auto_reply_enabled) {
          const { facePrivacyReply } = await import("@/lib/telegram-knowledge.server");
          const reply = facePrivacyReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          await logMessage("question", "face-privacy", reply, null);
          return Response.json({ ok: true, flow: "face-privacy" });
        }

        // Gmail setup is a critical, deterministic help flow. It MUST run before
        // admin FAQs, cached replies, and AI so a broad "app/link" FAQ can never
        // reduce this answer to only the website URL.
        if (!photoBase64 && settings.auto_reply_enabled && text.trim()) {
          const gmailHelpQuery =
            /\b(gmail|g-mail|email|e-mail)\b/i.test(text) &&
            /(add|ad |যোগ|যুক্ত|connect|conn?act|ভেরিফ|verify|dib|দিব|kivabe|kemne|কিভাবে|কেমনে|কোথায়|kothay)/i.test(
              text,
            );
          if (gmailHelpQuery) {
            const { builtinFaqByTopic, builtinFaqReply, fillLiveRates } =
              await import("@/lib/telegram-builtin-faq.server");
            const gmailFaq = builtinFaqByTopic("Gmail যুক্ত");
            if (gmailFaq) {
              const reply = await fillLiveRates(builtinFaqReply(senderName, gmailFaq));
              await sendMessage(chatId, reply, msg.message_id);
              await logMessage("question", "priority:gmail-setup", reply, null);
              return Response.json({ ok: true, flow: "priority-gmail-setup" });
            }
          }
        }

        // ---- "already tried, still not working" → think, don't repeat --------
        if (!photoBase64 && settings.auto_reply_enabled && text.trim() && lastBase) {
          const t = text.trim();
          const stillFailing =
            t.length <= 160 &&
            /(tao hoi na|tao hoy na|tao hocche na|tao hoche na|তবুও হয় না|তবু হয় না|তাও হয় না|তাও হচ্ছে না|তবুও হচ্ছে না|korchi tao|korlam tao|kore o hoy na|kore dekhsi|করেছি তবুও|করলাম তবুও|same problem|ekhono hoy na|এখনো হয় না|এখনও হচ্ছে না|abaro same|আবারও একই|hocche na vai|hoy nai)/i.test(
              t,
            );
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
            // Generic words that appear in almost every Bengali/Banglish question.
            // Matching one of these alone must NEVER pick an FAQ row (that is how
            // "Gmail add korbo kemne" used to get the "apps link" answer).
            const STOP = new Set([
              "korbo",
              "korbo?",
              "kivabe",
              "kemne",
              "kore",
              "korte",
              "koro",
              "den",
              "dan",
              "dio",
              "dibo",
              "ki",
              "kib",
              "koi",
              "kothay",
              "please",
              "plz",
              "vai",
              "bhai",
              "apps",
              "app",
              "amar",
              "ami",
              "eta",
              "eita",
              "hoi",
              "hoy",
              "na",
              "the",
              "and",
              "for",
              "করবো",
              "কিভাবে",
              "কেমনে",
              "করতে",
              "দেন",
              "দিন",
              "কোথায়",
              "আমার",
              "আমি",
              "কি",
            ]);
            const scoredAdmin = (faqRows ?? [])
              .map((f: any) => {
                const raw: string[] = Array.isArray(f.keywords)
                  ? f.keywords
                  : String(f.keywords ?? "").split(/[,\n]/);
                const phrases = raw
                  .map((k) => String(k).trim().toLowerCase())
                  .filter((k) => k.length > 2);
                const topicTokens = String(f.topic ?? "")
                  .split(/[\s,/|—-]+/)
                  .map((k) => k.trim().toLowerCase())
                  .filter((k) => k.length > 2 && !STOP.has(k));
                let score = 0;
                for (const p of phrases) {
                  if (!hay.includes(p)) continue;
                  // Full multi-word phrase = strong signal; single word = medium,
                  // but a generic single word counts for nothing.
                  score += p.includes(" ") ? 3 : STOP.has(p) ? 0 : 2;
                }
                for (const t of new Set(topicTokens)) if (hay.includes(t)) score += 1;
                return { f, score };
              })
              .sort((a, b) => b.score - a.score)[0];
            // Need at least a real phrase hit or two distinct meaningful words.
            const adminAnswer =
              scoredAdmin && scoredAdmin.score >= 2
                ? await faqAnswerFor(scoredAdmin.f, text)
                : null;

            if (adminAnswer) {
              const { humanizeReply } = await import("@/lib/telegram-bot.server");
              const base = adminAnswer.trim();
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
        // No AI rewrite here — the fixed answer is already correct and this
        // keeps credit usage at zero for common questions.
        if (!photoBase64 && settings.auto_reply_enabled && text.trim()) {
          try {
            const { matchBuiltinFaqText, builtinFaqReply, fillLiveRates } =
              await import("@/lib/telegram-builtin-faq.server");
            const hit = matchBuiltinFaqText(text);
            if (hit) {
              const reply = await fillLiveRates(builtinFaqReply(senderName, hit));
              await sendMessage(
                chatId,
                reply + videoSuffix(text) + (await offerSlotResetSuffix()),
                msg.message_id,
              );
              await logMessage("question", `faq-builtin:${hit.topic}`, reply, null);
              return Response.json({ ok: true, flow: "faq-builtin-text" });
            }
          } catch (e) {
            console.error("[tg] builtin faq text match failed", e);
          }
        }

        // ---- Answer memory: same question asked again → reuse the saved reply --
        if (!photoBase64 && settings.auto_reply_enabled && text.trim()) {
          try {
            const { getCachedReply } = await import("@/lib/telegram-reply-cache.server");
            const cached = await getCachedReply(text);
            if (cached) {
              await sendMessage(chatId, cached, msg.message_id);
              await logMessage("question", "cached-reply", cached, null);
              return Response.json({ ok: true, flow: "cached-reply" });
            }
          } catch (e) {
            console.error("[tg] reply cache lookup failed", e);
          }
        }

        let decision = {
          verdict: "ok" as const,
          reply: null as string | null,
          should_delete: false,
          should_warn: false,
          uid: null as string | null,
          needs_uid: false,
          intent: null,
          slot: null,
        } as Awaited<ReturnType<typeof decide>>;

        // Conversation context reused by every later answer path (smartAnswer,
        // escalation, final fallback) so follow-up questions keep their thread.
        let convoHistory: string[] = [];
        let convoReplies: string[] = [];
        let recallText = "";

        if (hardHit) {
          decision = {
            verdict: "abuse",
            reply: null,
            should_delete: !!settings.delete_bad_messages,
            should_warn: true,
            uid: null,
            needs_uid: false,
            intent: null,
            slot: null,
          };
        } else if (text.trim() || photoBase64) {
          // Everything this user said before — used both for smarter answers and
          // for finding the UID they gave earlier when they start misbehaving.
          let history: string[] = [];
          let pastReplies: string[] = [];
          // ⚠️ সবার আগে KYC-লিংক করা UID — এটাই এই টেলিগ্রাম একাউন্টের আসল
          // পরিচয়। আগে অন্য কারো UID দেখা হয়েছিল বলে সেটাই মনে রেখে "আমার
          // হিসাব" চাইলে অন্যের হিসাব দেখিয়ে দিত — তাই লিংক করা UID-ই আগে।
          let knownUid: string | null = msg.from?.id ? await linkedUid() : null;
          if (msg.from?.id) {
            const { data: past } = await supabaseAdmin
              .from("tg_messages")
              .select("text, bot_reply, matched_uid, created_at")
              .eq("tg_user_id", msg.from.id)
              .order("created_at", { ascending: false })
              .limit(12);
            history = (past ?? [])
              .map((p: any) => p.text)
              .filter(Boolean)
              .reverse()
              .slice(-8);
            pastReplies = (past ?? [])
              .map((p: any) => p.bot_reply)
              .filter(Boolean)
              .slice(0, 4);
            if (!knownUid) knownUid = (offender as any)?.known_uid ?? null;
            if (!knownUid)
              knownUid = (past ?? []).find((p: any) => p.matched_uid)?.matched_uid ?? null;
          }

          // A full unrelated history makes the model answer the previous topic
          // instead of the user's current question. Only carry context for an
          // explicit reply/follow-up; standalone questions are self-contained.
          const isShortFollowUp =
            norm.length <= 90 &&
            /^(তাহলে|তাইলে|তারপর|এরপর|এটা|ওটা|ঐটা|সেটা|আর|কিন্তু|হ্যাঁ|না|কেন|কিভাবে|কীভাবে|কেমনে|then|so|but|why|how|eta|oita|seta|tarpor|erpor|taile|tahole)\b/i.test(
              norm,
            );
          const keepContext = repliedToBot || isShortFollowUp || !!quotedRaw;
          convoHistory = keepContext ? history : [];
          convoReplies = pastReplies;

          // Group memory: what was asked & answered before for the same topic.
          try {
            const { recallSimilar } = await import("@/lib/telegram-bot.server");
            recallText = keepContext ? await recallSimilar(text || shotText) : "";
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
                topic: v.topic,
                keywords: v.keywords,
                note: v.note,
              })),
              bannedWords,
              text,
              photoBase64,
              senderName,
              smart: (settings as any).smart_mode !== false,
              history: keepContext ? history : [],
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

        // অ্যাপ-সংক্রান্ত স্ক্রিনশট/ছবি কখনোই অটো-ডিলিট হবে না — গালিগালাজ
        // (hardHit) ছাড়া ছবিসহ মেসেজ সবসময় সাপোর্ট প্রশ্ন হিসেবে ধরা হবে।
        const photoProtected = (photos?.length ?? 0) > 0 && !hardHit;
        if (
          settings.moderation_enabled &&
          decision.should_delete &&
          settings.delete_bad_messages &&
          !photoProtected
        ) {
          await deleteMessage(chatId, msg.message_id);
          actions.push("deleted");
        }

        let banRequested = false;
        let matchedUid: string | null = decision.uid;
        let appUserId: string | null = null;
        const previousKnownUid =
          typeof (decision as any)._knownUid === "string"
            ? String((decision as any)._knownUid)
            : null;
        const isUidLikeValue = (v: string | null) =>
          !!v && (/^\d{2,9}$/.test(v) || (/\d/.test(v) && /^[A-Za-z0-9]{6,9}$/.test(v)));
        const bareUidFrom = (s: string): string | null => {
          if (isAffirmation(s)) return null;
          const only = s.trim().match(/^[#\s]*([A-Za-z0-9]{2,9})[\s.!।]*$/)?.[1] ?? null;
          return only && isUidLikeValue(only) ? only.toUpperCase() : null;
        };
        const explicitOrBareUid = (): string | null => {
          if (hasExplicitUid) return pickUid(norm);
          const bare = bareUidFrom(norm);
          if (bare) return bare;
          if (
            replyNorm &&
            /(\buid\b|\bid\s*no\b|ইউআইডি|আইডি|আই ডি|আইডি নাম্বার)/i.test(replyNorm)
          ) {
            return pickUid(replyNorm);
          }
          return null;
        };

        // ❄️ ফ্রিজ (mute) সম্পূর্ণ বন্ধ করা হয়েছে। ইউজার পেমেন্ট পেয়ে খুশি হয়ে
        // গ্রুপে স্ক্রিনশট/মন্তব্য দিলে সেটা কখনোই মুছবে না বা ফ্রিজ হবে না।
        // এখন শুধু বাইরের লিংক ও ১৮+ ছবি ডিলিট হয় — আর কিছুই না।


        // ---- someone asked for a stored photo / key: never share, always deny -
        if (
          decision.intent === "photo_request" &&
          !decision.should_delete &&
          (settings as any).photo_privacy_enabled !== false
        ) {
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
          const reply =
            decision.reply &&
            !photoBase64 &&
            !decision.needs_uid &&
            decision.intent !== "withdraw_status"
              ? decision.reply
              : withdrawEligibilityReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("withdraw-eligibility");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "withdraw_eligibility", actions });
        }

        // ---- "UID 72 কার রেফারে join হয়েছে?" → exact referred_by lookup ----
        if (asksReferralJoin && !decision.should_delete && settings.auto_reply_enabled) {
          const uid = explicitOrBareUid() || pickUid(norm) || (await linkedUid());
          if (uid) {
            const { buildReferralJoinReport } = await import("@/lib/telegram-lookup.server");
            const res = await buildReferralJoinReport(uid);
            const reply = res.found
              ? res.card
              : `❌ UID <code>${uid}</code> দিয়ে কোনো একাউন্ট পাওয়া যায়নি। সঠিক UID টি লিখুন।`;
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("referral-join");
            await logMessage(
              decision.verdict,
              actions.join(","),
              reply,
              res.found ? res.uid : null,
            );
            return Response.json({ ok: true, flow: "referral_join", actions });
          }
          if (msg.from?.id) {
            await saveSession({
              intent: "referral_join",
              step: "await_uid",
              uid: null,
              app_user_id: null,
            });
          }
          const reply = `🔗 কোন ইউজার কার রেফারে join করেছে সেটা দেখে দিচ্ছি।\nতার <b>UID</b> নম্বরটি লিখুন — যেমন <code>72</code>।`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("referral-join-ask-uid");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "referral_join_ask_uid", actions });
        }

        // ---- মালিক জিজ্ঞেস করলে: এই withdraw-এর টাকা কিভাবে earn করেছে? ----
        if (
          senderIsOwner &&
          /(withdraw|উইথড্র|balance|ব্যালেন্স|taka|টাকা)/i.test(text) &&
          /(kivabe|kivbe|kibhabe|কিভাবে|কীভাবে|kotha theke|kothe theke|kothay theke|কোথা\s*থেকে|কোথায়\s*থেকে|source|উৎস|earn|ইনকাম|income)/i.test(
            text,
          )
        ) {
          const uid = explicitOrBareUid() || previousKnownUid;
          if (uid) {
            const { buildWithdrawSourceCard } = await import("@/lib/withdraw-source.server");
            const card = await buildWithdrawSourceCard({ uid: String(uid) });
            await sendMessage(chatId, card, msg.message_id);
            actions.push("withdraw-source");
            await logMessage(decision.verdict, actions.join(","), card, String(uid));
            return Response.json({ ok: true, flow: "withdraw_source", actions });
          }
          const ask = `জি স্যার 🙂 কোন ইউজারের হিসাব দেখব? তার <b>UID</b> নম্বরটি দিন।`;
          await sendMessage(chatId, ask, msg.message_id);
          actions.push("withdraw-source-ask-uid");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "withdraw_source_ask_uid", actions });
        }

        // ---- "উইথড্র দিয়েছি টাকা আসে নাই" → show pending requests with time ---
        if (
          (decision.intent === "withdraw_status" || pendingWithdrawQuestion) &&
          !decision.should_delete &&
          settings.auto_reply_enabled
        ) {
          const uid = explicitOrBareUid() || (await linkedUid()) || previousKnownUid;
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
            await saveSession({
              intent: "withdraw_status",
              step: "await_uid",
              uid: null,
              app_user_id: null,
            });
          }
          await sendMessage(chatId, ask, msg.message_id);
          actions.push(pendingWithdrawQuestion ? "withdraw-ask-uid" : "withdraw-rule");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "withdraw_status", actions });
        }

        // ---- "কিভাবে টাকা পাবো" → full earning guide -------------------------
        if (
          decision.intent === "earning_info" &&
          !decision.should_delete &&
          settings.auto_reply_enabled
        ) {
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
        if (asksReverifyStatus && !decision.should_delete && settings.auto_reply_enabled) {
          const query =
            pickVerificationQuery(norm) ||
            explicitOrBareUid() ||
            (await linkedUid()) ||
            previousKnownUid;
          if (query) {
            const { buildReverifyStatusReport } = await import("@/lib/telegram-lookup.server");
            const res = await buildReverifyStatusReport(query);
            const reply = res.found
              ? res.card
              : (res as any).ambiguous?.length
                ? `একই নামে একাধিক ইউজার পাওয়া গেছে। সঠিক UID লিখুন:\n${(res as any).ambiguous.map((p: any) => `• ${p.display_name || "ইউজার"} — UID <code>${p.uid_seq ?? "—"}</code>`).join("\n")}`
                : `❌ <code>${query}</code> দিয়ে কোনো ইউজার পাওয়া যায়নি। সঠিক UID লিখুন।`;
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("reverify-status");
            await logMessage(
              decision.verdict,
              actions.join(","),
              reply,
              res.found ? res.uid : null,
            );
            return Response.json({ ok: true, flow: "reverify-status", actions });
          }

          await saveSession({
            intent: "verification_dates",
            step: "await_uid",
            data: { kind: "reverify_status" },
            uid: null,
            app_user_id: null,
          });
          const reply =
            `🆔 কোন ইউজারের রি-ভেরিফাই কেন আসছে না সেটা দেখে দিচ্ছি।\n` +
            `তার <b>UID</b> নম্বরটি লিখুন — আমি সব স্লটের ১ম ভেরিফাই সময়, কাউন্টডাউন ও রি-ভেরিফাই স্ট্যাটাস দেখিয়ে দেব।`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("reverify-status-ask-uid");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "reverify-status-ask-uid", actions });
        }

        const dateKind = verificationDateKind(norm);
        if (dateKind && !decision.should_delete && settings.auto_reply_enabled) {
          const query =
            pickVerificationQuery(norm) ||
            explicitOrBareUid() ||
            (await linkedUid()) ||
            previousKnownUid;
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
            await logMessage(
              decision.verdict,
              actions.join(","),
              reply,
              res.found ? res.uid : null,
            );
            return Response.json({ ok: true, flow: "verification-date", actions });
          }

          await saveSession({
            intent: "verification_dates",
            step: "await_uid",
            data: { kind: dateKind },
            uid: null,
            app_user_id: null,
          });
          const label =
            dateKind === "reverify"
              ? "রি-ভেরিফাই"
              : dateKind === "all"
                ? "ভেরিফিকেশন"
                : "১ম ভেরিফাই";
          const reply = `🗓️ ${label} তারিখ দেখে দিচ্ছি।\nযার রিপোর্ট চান, তার <b>UID</b> লিখুন (যেমন: 4100)।`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push(`verification-date-ask-uid:${dateKind}`);
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "verification-date-ask-uid", actions });
        }

        // ---- "আরও ১০টা স্লট করলে কি আবার বোনাস পাবো?" → না, বোনাস শুধু ১ম ১০টায় --
        if (asksExtraSlotBonus && !decision.should_delete && settings.auto_reply_enabled) {
          const { builtinFaqByTopic, BUILTIN_FAQS, fillLiveRates } =
            await import("@/lib/telegram-builtin-faq.server");
          const reply = await fillLiveRates(
            (builtinFaqByTopic("আরও স্লট") ?? builtinFaqByTopic("বোনাস") ?? BUILTIN_FAQS[0]).answer,
          );

          await sendMessage(chatId, reply, msg.message_id);
          actions.push("extra-slot-bonus");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "extra-slot-bonus", actions });
        }

        // ---- বিকাশ/নগদ নম্বর বদলানো → provider মনে রেখে UID নিয়ে reset --------
        if (
          wantsWalletReset &&
          !decision.should_delete &&
          settings.auto_reply_enabled &&
          msg.from?.id
        ) {
          if (!walletResetProvider) {
            await saveSession({
              intent: "wallet_reset",
              step: "await_provider",
              uid: null,
              app_user_id: null,
              data: {},
            });
            const ask = "অবশ্যই—কোন নম্বরটি বদলাতে চান, <b>বিকাশ</b> নাকি <b>নগদ</b>?";
            await sendMessage(chatId, ask, msg.message_id);
            await logMessage("question", "wallet-reset-ask-provider", ask, null);
            return Response.json({ ok: true, flow: "wallet-reset-ask-provider" });
          }

          const uid = pickUidFromCurrentOrReply();
          if (uid) {
            const { resetPaymentNumbersForUid, walletResetReply } =
              await import("@/lib/telegram-wallet.server");
            const result = await resetPaymentNumbersForUid(uid, walletResetProvider);
            const reply = walletResetReply(result);
            await sendMessage(chatId, reply, msg.message_id);
            await logMessage(
              "question",
              `wallet-reset:${walletResetProvider}`,
              reply,
              result.ok ? uid : null,
            );
            return Response.json({ ok: true, flow: "wallet-reset-complete" });
          }

          await saveSession({
            intent: "wallet_reset",
            step: "await_uid",
            uid: null,
            app_user_id: null,
            data: { provider: walletResetProvider },
          });
          const providerLabel = walletResetProvider === "nagad" ? "নগদ" : "বিকাশ";
          const ask = `${providerLabel} নম্বরটি বদলানোর ব্যবস্থা করছি 🙂\nশুধু আপনার <b>UID</b> লিখুন—পেলেই পুরোনো ${providerLabel} নম্বরটি রিসেট করে দেব।`;
          await sendMessage(chatId, ask, msg.message_id);
          await logMessage("question", `wallet-reset-ask-uid:${walletResetProvider}`, ask, null);
          return Response.json({ ok: true, flow: "wallet-reset-ask-uid" });
        }

        // ---- "যেগুলো হয় না ওগুলো রিমুভ করা যাবে?" → UID + স্লট নিয়ে রিসেট -----

        if (
          wantsSlotRemoval &&
          !decision.should_delete &&
          settings.auto_reply_enabled &&
          (settings as any).slot_reset_enabled !== false &&
          msg.from?.id
        ) {
          const uid = explicitOrBareUid() || pickUid(norm) || (await linkedUid());
          if (!uid) {
            const already = await pendingResetInfo();
            if (already) {
              await sendPendingResetNotice(already);
              return Response.json({ ok: true, flow: "slot-reset-pending" });
            }
          }
          const slots = (() => {
            const f = uid ? pickSlots(norm.replace(uid, " ")) : [];
            return f.length ? f : mentionedSlot ? [mentionedSlot] : [];
          })();
          if (uid) {
            const { findProfileByUid } = await import("@/lib/telegram-slot.server");
            const prof = await findProfileByUid(uid);
            if (prof && (slots.length || wantsAll)) {
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              await doReset(uid, wantsAll ? [] : slots);
              return Response.json({ ok: true, flow: "removal-reset", actions });
            }
            if (prof) {
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              const ask =
                `জি অবশ্যই ভাইয়া 🙂 আপনার UID <code>${uid}</code> পেয়েছি।\n` +
                `এবার বলুন <b>কত নম্বর স্লটটি</b> রিসেট করতে চান (যেমন: 3, অথবা 2,5,7, অথবা সবগুলোর জন্য লিখুন "সব")।`;
              await sendMessage(chatId, ask, msg.message_id);
              actions.push("removal-ask-slot");
              await logMessage(decision.verdict, actions.join(","), ask, uid);
              return Response.json({ ok: true, flow: "removal-ask-slot", actions });
            }
          }
          await saveSession({ step: "await_uid", uid: null, app_user_id: null, data: { slots } });
          const ask =
            `জি অবশ্যই ভাইয়া, আমরা আপনার স্লটটি রিসেট করে দিতে পারি 🙂\n` +
            `রিসেট করলে ওই স্লটটি একদম খালি হয়ে যাবে, তারপর নতুন ফেস দিয়ে আবার ভেরিফাই করতে পারবেন।\n\n` +
            `👉 দয়া করে আপনার <b>UID</b> নম্বরটি দিন এবং বলুন <b>কত নম্বর স্লটটি</b> রিসেট করতে চান 💙`;
          await sendMessage(chatId, ask, msg.message_id);
          actions.push("removal-ask-uid");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "removal-ask-uid", actions });
        }

        // ---- "আমার রেফার হয় না কেন?" → রেফার লিংক আনলকের নিয়ম ----------------
        if (
          (asksReferralUnlock || asksFiveSlotFirstVerify) &&
          !decision.should_delete &&
          settings.auto_reply_enabled
        ) {
          const reply =
            asksFiveSlotFirstVerify && !asksReferralUnlock
              ? `হ্যাঁ ভাইয়া ✅ প্রথমবারের ফেস ভেরিফিকেশন দিয়েই হবে — নিজের <b>৫টি স্লটে ১ম ভেরিফাই</b> সম্পন্ন হলেই আপনার রেফার লিংক আনলক হয়ে যাবে 💙`
              : `${senderName}, রেফার লিংক আনলক করার নিয়মটি হলো —\n\n` +
                `👉 আপনি অন্য বন্ধুদের রেফার করতে চাইলে আগে <b>নিজের ৫টি স্লট ভেরিফাই</b> করতে হবে।\n` +
                `৫টি স্লট হয়ে গেলেই আপনার রেফার লিংকটি সাথে সাথে আনলক হয়ে যাবে, তখন যত খুশি রেফার করতে পারবেন 💙\n\n` +
                `(৫টি স্লট প্রথমবারের ফেস ভেরিফিকেশন করলেই হবে।)`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("referral-unlock");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "referral-unlock", actions });
        }

        // ---- "আগে ভেরিফাই করেছিলাম, এখন রি-ভেরিফাই নিচ্ছে না" → স্ক্রিনশট চাই --
        if (
          !photos?.length &&
          !decision.should_delete &&
          settings.auto_reply_enabled &&
          /(age|আগে|প্রথমে|prothome)/i.test(norm) &&
          /(verify|ভেরিফাই|verification|ভেরিফিকেশন)/i.test(norm) &&
          /(re\s*-?verify|reverify|রি\s*-?ভেরিফাই)/i.test(norm) &&
          /(nicche na|নিচ্ছে না|hocche na|হচ্ছে না|hoi na|হয় না|nei|নেই|ashe na|আসে না)/i.test(
            norm,
          )
        ) {
          const reply =
            `${senderName}, বিষয়টি দেখে দিচ্ছি 🙂\n` +
            `দয়া করে রি-ভেরিফাই করতে গেলে যে লেখা/এরর আসছে তার একটি <b>স্ক্রিনশট</b> পাঠান।\n` +
            `স্ক্রিনশট দেখেই বলে দিতে পারব সমস্যা কোথায় এবং দরকার হলে স্লটটি রিসেট করে দেব 💙`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("ask-screenshot");
          await logMessage(decision.verdict, actions.join(","), reply, null);
          return Response.json({ ok: true, flow: "ask-screenshot", actions });
        }

        // ---- "রেফার করেছি কিন্তু রেফার বাড়ে না" → রেফার হিস্টরি + কারণ --------

        if (complainsReferralCount && !decision.should_delete && settings.auto_reply_enabled) {
          let uid: string | null = explicitOrBareUid() || (await linkedUid()) || previousKnownUid;
          if (!uid && msg.from?.id) {
            const { data: linked } = await supabaseAdmin
              .from("profiles")
              .select("uid_seq")
              .eq("telegram_user_id", msg.from.id)
              .maybeSingle();
            if (linked?.uid_seq != null) uid = String(linked.uid_seq);
          }
          if (uid) {
            const { buildReferralHistoryReport } = await import("@/lib/telegram-lookup.server");
            const res = await buildReferralHistoryReport(String(uid));
            if (res.found) {
              await sendMessage(chatId, res.card, msg.message_id);
              actions.push("referral-history");
              await logMessage(decision.verdict, actions.join(","), res.card, res.uid);
              return Response.json({ ok: true, flow: "referral_history", actions });
            }
          }
          if (msg.from?.id) {
            await saveSession({
              intent: "referral_history",
              step: "await_uid",
              uid: null,
              app_user_id: null,
            });
          }
          const ask =
            `👥 ${senderName}, আপনার রেফার হিসাবটা দেখে দিচ্ছি।\n\n` +
            `দয়া করে আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন)।\n` +
            `UID পেলেই কে কে আপনার রেফারে আছে, কার কয়টা ফেস ঠিক আছে — সব দেখিয়ে দেব 💙`;
          await sendMessage(chatId, ask, msg.message_id);
          actions.push("referral-history-ask-uid");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "referral_history_ask_uid", actions });
        }

        // ---- "আমার কয়টা রেফার/ভেরিফাই/ব্যালেন্স?" → UID নিয়ে একাউন্ট কার্ড -----
        if (asksOwnAccount && !decision.should_delete && settings.auto_reply_enabled) {
          // ⚠️ কখনোই অনুমান করে অন্য কারো UID দেখানো যাবে না।
          // শুধু (ক) এই টেলিগ্রাম একাউন্টের KYC-লিংক করা UID, অথবা
          // (খ) এই মেসেজেই স্পষ্ট UID লেখা থাকলে।
          // আগের মেসেজে দেখা UID (previousKnownUid) এখানে ব্যবহার করা হয় না —
          // ওটার কারণেই একজন অন্যজনের হিসাব দেখে ফেলছিল।
          const myUid = msg.from?.id ? await linkedUid() : null;
          const uid: string | null = myUid || explicitOrBareUid();

          if (uid) {
            const { buildUserCard } = await import("@/lib/telegram-lookup.server");
            const res = await buildUserCard(String(uid));
            if (res.found) {
              await sendMessage(chatId, res.card, msg.message_id);
              actions.push("account-info");
              // "মোট হিসাব / full details / ধাপে ধাপে" চাইলে পুরো হিসাব + হিসাবের ছবি
              try {
                const { wantsFullHisab, fullHisabText, hisabImageUrl } =
                  await import("@/lib/telegram-hisab.server");
                if (wantsFullHisab(norm)) {
                  const hisab = await fullHisabText(String(uid));
                  if (hisab) {
                    await sendMessage(chatId, hisab, msg.message_id);
                    actions.push("full-hisab");
                  }
                  const { sendPhotoUrl } = await import("@/lib/telegram-bot.server");
                  const ok = await sendPhotoUrl(
                    chatId,
                    hisabImageUrl(String(uid)),
                    `🧾 UID ${uid} — আপনার সম্পূর্ণ হিসাবের ছবি`,
                    msg.message_id,
                  );
                  if (ok) actions.push("hisab-image");
                }
              } catch (e) {
                console.error("[tg] full hisab failed", e);
              }

              await logMessage(decision.verdict, actions.join(","), res.card, String(uid));
              return Response.json({ ok: true, flow: "account_info", actions });
            }
          }

          if (msg.from?.id) {
            await saveSession({
              intent: "account_info",
              step: "await_uid",
              uid: null,
              app_user_id: null,
            });
          }
          const ask =
            `🆔 ${senderName}, আপনার হিসাবটা এখনই দেখে দিচ্ছি।\n\n` +
            `আপনার এই টেলিগ্রাম একাউন্টের সাথে কোনো UID <b>KYC দিয়ে লিংক করা নেই</b>, তাই অনুমান করে কারো হিসাব দেখাতে পারছি না 🙏\n\n` +
            `👉 একবার <b>KYC</b> করে নিন (অ্যাপের হোম পেজে “KYC করুন” → টেলিগ্রাম → START) — তারপর শুধু “আমার হিসাব” লিখলেই আপনার UID মনে রেখে সব হিসাব দিয়ে দেব 💙\n\n` +
            `এখনই দেখতে চাইলে আপনার <b>UID</b> নম্বরটি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন, যেমন: 4100)।`;

          await sendMessage(chatId, ask, msg.message_id);
          actions.push("account-info-ask-uid");
          await logMessage(decision.verdict, actions.join(","), ask, null);
          return Response.json({ ok: true, flow: "account_info_ask_uid", actions });
        }

        // ---- "কী কী লাগে / কোনো ডকুমেন্ট লাগে?" → requirements answer --------
        const asksRequirements =
          /(ki ki lage|কি কি লাগে|কী কী লাগে|ki lage|কি লাগে|কী লাগে|ki dorkar|কি দরকার|কী দরকার|what.*(need|require)|requirement|nid|এনআইডি|জাতীয় পরিচয়|birth certificate|জন্ম নিবন্ধন|passport|পাসপোর্ট|document|ডকুমেন্ট|কাগজ)/i.test(
            norm,
          );
        if (asksRequirements && !decision.should_delete && settings.auto_reply_enabled) {
          const { verifyRequirementsReply } = await import("@/lib/telegram-knowledge.server");
          const reply = verifyRequirementsReply(senderName);
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("verify-requirements");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "verify_requirements", actions });
        }

        // ---- "ভিডিও দিন / কিভাবে করবো" → tutorial video link -----------------
        const howToWork =
          /(kivabe|kivbe|kibhabe|কিভাবে|কীভাবে|kmne|kemne|কেমনে)[^\n]{0,30}(kaj|কাজ|use|চালাব|করব|করবো|করতে হয়|start|শুরু|verify|ভেরিফাই|verification|ভেরিফিকেশন|face|ফেস|refer|রেফার)/i.test(
            norm,
          ) || /(video|ভিডিও|টিউটোরিয়াল|tutorial|dekhiye|দেখিয়ে)/i.test(norm);
        if (
          (decision.intent === "video_request" || howToWork) &&
          !decision.should_delete &&
          settings.auto_reply_enabled
        ) {
          const list = (videoRows ?? []) as any[];
          const topic = (decision as any).media_topic as string | null;
          const asksWithdrawVideo = /(withdraw|উইথড্র|টাকা তোলা|টাকা তুলব|টাকা তুলবো)/i.test(norm);
          const withdrawVideo = asksWithdrawVideo
            ? list.find((v) => {
                const labels = `${String(v.topic ?? "")} ${(v.keywords ?? []).join(" ")}`;
                return /(withdraw|উইথড্র|টাকা তোলা)/i.test(labels);
              })
            : null;
          const match =
            withdrawVideo ||
            (!asksWithdrawVideo &&
              topic &&
              list.find(
                (v) => String(v.topic).trim().toLowerCase() === topic.trim().toLowerCase(),
              )) ||
            (!asksWithdrawVideo ? pickVideo(shotText) : null) ||
            null;

          if (asksWithdrawVideo && !match?.url) {
            const reply = withdrawHowToReply(senderName);
            await sendMessage(chatId, reply, msg.message_id);
            actions.push("withdraw-video-fallback");
            await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
            return Response.json({ ok: true, flow: "withdraw-video-fallback", actions });
          }

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
          /(হয় না|hoy na|hoi na|হচ্ছে না|hocche na|পারছি না|parchi na|parteci na|error|এরর|fail|ফেইল|problem|somossa|সমস্যা|আসে না|ashe na|নিচ্ছে না|niche na|আটকে|atke|wrong|ভুল)/i.test(
            norm,
          );
        if (
          decision.intent === "verify_help" &&
          reportsVerifyFailure &&
          !decision.should_delete &&
          settings.auto_reply_enabled
        ) {
          const { verifyTipsReply, loadRates } = await import("@/lib/telegram-knowledge.server");
          const vRates = await loadRates();
          const reply =
            verifyTipsReply(senderName, vRates) + (vRates.faceVerifyOn ? videoSuffix(text) : "");
          await sendMessage(chatId, reply, msg.message_id);
          actions.push("verify-help");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "verify_help", actions });
        }

        // ---- screenshot fallback before normal text reply ---------------------
        // If the AI gives a vague greeting or tries to ask UID for a screenshot,
        // read the screenshot directly and answer from app rules instead.
        const vaguePhotoReply =
          !!decision.reply &&
          /(কীভাবে সাহায্য|কিভাবে সাহায্য|সহায়তা করতে পারি|help করতে পারি|বলুন|জানাতে পারেন|কি সমস্যা)/i.test(
            decision.reply,
          );
        if (
          settings.auto_reply_enabled &&
          photoBase64 &&
          !decision.should_delete &&
          decision.intent === null &&
          (!decision.reply || decision.needs_uid || vaguePhotoReply)
        ) {
          const { analyzeScreenshotReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const reply = await analyzeScreenshotReply({
            photoBase64,
            name: senderName,
            text: shotText ? `${text}\n\n[স্ক্রিনশটের লেখা]\n${shotText}` : text,
            knowledge: knowledgeText(await loadRates()),
          });
          if (reply) {
            await sendMessage(
              chatId,
              reply + videoSuffix(shotText) + (await offerSlotResetSuffix()),
              msg.message_id,
            );
            actions.push("photo-analysis");
            await logMessage("question", actions.join(","), reply, null);
            return Response.json({ ok: true, flow: "photo-analysis", actions });
          }
        }

        // ---- pick a saved voice note for this topic, if the admin recorded one -
        const voiceMatch = (() => {
          const list = (voiceRows ?? []) as any[];
          if (!list.length || decision.should_delete || decision.intent === "slot_reset")
            return null;
          const topic = (decision as any).media_topic as string | null;
          if (topic) {
            const byTopic = list.find(
              (v) => String(v.topic).trim().toLowerCase() === topic.trim().toLowerCase(),
            );
            if (byTopic) return byTopic;
          }
          const hay = norm;
          return (
            list.find((v: any) =>
              (v.keywords ?? []).some((k: string) => k && hay.includes(String(k).toLowerCase())),
            ) ?? null
          );
        })();

        // Tiny follow-ups like "?" after a voice/message should not get a
        // generic greeting. Use the agent with recent history instead.
        const tinyFollowup =
          /^[?？!！.।\s]+$/.test(norm) ||
          /^(ki|কি|keno|কেন|kn|mane|মানে|bujhi nai|বুঝি নাই)[\s.!?।]*$/i.test(norm);
        const genericSupportReply =
          !!decision.reply &&
          /(কীভাবে সাহায্য|কিভাবে সাহায্য|সহায়তা করতে পারি|help করতে পারি|বলুন|জানাবেন|কি সমস্যা|কোনো প্রশ্ন|স্বাগতম)/i.test(
            decision.reply,
          );
        const bypassDecisionReply = genericSupportReply && (tinyFollowup || !!voiceHeard);

        if (
          settings.auto_reply_enabled &&
          decision.reply &&
          !decision.should_delete &&
          decision.intent !== "slot_reset" &&
          !bypassDecisionReply
        ) {
          await sendMessage(
            chatId,
            decision.reply + videoSuffix(text) + (await offerSlotResetSuffix()),
            msg.message_id,
          );
          actions.push("replied");
        }

        if (settings.auto_reply_enabled && voiceMatch) {
          const { voiceBytes, sendVoice } = await import("@/lib/telegram-bot.server");
          const bytes = await voiceBytes(voiceMatch.audio_path);
          if (bytes) {
            await sendVoice(
              chatId,
              bytes,
              voiceMatch.audio_path.split("/").pop() || "voice.ogg",
              undefined,
              msg.message_id,
            );

            actions.push("voice");
          }
        }

        // ---- screenshot with no FAQ match → read the screenshot and explain ----
        if (
          settings.auto_reply_enabled &&
          photoBase64 &&
          !decision.reply &&
          !voiceMatch &&
          !decision.should_delete &&
          decision.intent === null
        ) {
          const { analyzeScreenshotReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const reply = await analyzeScreenshotReply({
            photoBase64,
            name: senderName,
            text: shotText ? `${text}\n\n[স্ক্রিনশটের লেখা]\n${shotText}` : text,
            knowledge: knowledgeText(await loadRates()),
          });
          if (reply) {
            await sendMessage(
              chatId,
              reply + videoSuffix(shotText) + (await offerSlotResetSuffix()),
              msg.message_id,
            );
            actions.push("photo-analysis");
            await logMessage("question", actions.join(","), reply, matchedUid);
            return Response.json({ ok: true, flow: "photo-analysis", actions });
          }
        }

        // ---- nothing matched → let the AI analyse the app and answer ---------
        if (
          settings.auto_reply_enabled &&
          (!decision.reply || bypassDecisionReply) &&
          !voiceMatch &&
          !decision.should_delete &&
          !decision.needs_uid &&
          !matchedUid &&
          decision.intent === null &&
          !decision.escalate &&
          (decision.verdict === "question" || !!photoBase64 || !!voiceHeard)
        ) {
          const { smartAnswer, escalateReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const { appRulebook } = await import("@/lib/telegram-app-rules.server");
          const { agentAnswer } = await import("@/lib/telegram-agent.server");
          const faqText = (faqRows ?? [])
            .slice(0, 40)
            .map((f: any) => `• ${f.topic}: ${String(f.answer ?? "").slice(0, 400)}`)
            .join("\n");
          const rates = await loadRates();
          const base = {
            name: senderName,
            question:
              (bypassDecisionReply
                ? `${text}\n\nএটা আগের কথার/ভয়েসের ফলোআপ। history দেখে আগের প্রশ্ন বা ভয়েসের বিষয়টা বুঝে সরাসরি উত্তর দাও; generic greeting দেবে না।`
                : text) + quotedContext,

            knowledge: knowledgeText(rates),
            faqs: faqText,
            history: convoHistory,
            pastReplies: convoReplies,
            recall: recallText,
          };
          const smart =
            (await agentAnswer({
              ...base,
              rulebook: appRulebook(rates),
              isAdmin: senderIsAdmin,
            })) ?? (await smartAnswer(base));
          const mention =
            (settings as any).admin_mention || (settings as any).support_username || "@anamulmunni";
          // কোটা শেষ/কী নেই → অজানা প্রশ্নে চুপ থাকবে, কাউকে মেনশনও করবে না।
          if (!smart) {
            const { aiOutOfQuota } = await import("@/lib/ai-free.server");
            if (aiOutOfQuota()) {
              await logMessage(decision.verdict, "silent-no-ai", null, matchedUid);
              return Response.json({ ok: true, flow: "silent-no-ai" });
            }
          }
          const reply = smart
            ? smart + videoSuffix(text)
            : `${escalateReply(senderName, mention)}\n${mention}`;
          await sendMessage(chatId, reply, msg.message_id);
          actions.push(smart ? "smart-answer" : "escalated");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: smart ? "smart-answer" : "escalated", actions });
        }

        // ---- স্ক্রিনশট এলো কিন্তু কিছুই ম্যাচ করলো না → AI নিজে দেখে উত্তর দেবে --
        // প্রথমে AI স্ক্রিনশটটা পড়ে নিজের ভাষায় সমাধান বলবে; AI ফেল/কোটা শেষ হলেই
        // শুধু তখন সংক্ষিপ্ত গাইড যাবে, যাতে বট কখনো চুপ না থাকে।
        if (settings.auto_reply_enabled && photoBase64 && !decision.should_delete) {
          let reply: string | null = null;
          try {
            const { analyzeScreenshotReply } = await import("@/lib/telegram-bot.server");
            const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
            reply = await analyzeScreenshotReply({
              photoBase64,
              name: senderName,
              text: shotText ? `${text}\n\n[স্ক্রিনশটের লেখা]\n${shotText}` : text,
              knowledge: knowledgeText(await loadRates()),
            });
            if (reply) actions.push("photo-analysis");
          } catch (e) {
            console.error("[tg] photo fallback analysis failed", e);
          }
          if (!reply) {
            reply =
              `ভাইয়া, স্ক্রিনশটটা দেখলাম 🙂 GoodDollar-এ সাধারণত এই ৩টা এররই আসে — যেটা আপনার স্ক্রিনে আছে সেটা মিলিয়ে নিন:\n\n` +
              `1️⃣ <b>You must be 18 years or older</b> — সিস্টেম মুখ দেখে বয়স আন্দাজ করে; দেখতে কম বয়সী লাগলে ২০+ হলেও আটকায়। ভালো আলোতে, চশমা/ক্যাপ ছাড়া আবার ট্রাই করুন; না হলে আরও পরিণত (২৫+) ফেস দিয়ে করুন।\n` +
              `2️⃣ <b>Something went wrong / Oops, try again later</b> — সার্ভারের সাময়িক সমস্যা। ব্রাউজার ক্যাশ ক্লিয়ার করে বা Chrome-এ নতুন করে লিংকে ঢুকে ১০–১৫ মিনিট পর আবার ট্রাই করুন, সাধারণত হয়ে যায়।\n` +
              `3️⃣ <b>We found your twin</b> — ঐ ফেস দিয়ে আগেই ভেরিফিকেশন হয়েছে। একই ফেস ৬ মাসের আগে আর চলবে না, নতুন ফেস দিয়ে করুন।\n\n` +
              `কোনটা আসছে বললে আমি ঐটার সমাধান বিস্তারিত বলে দিচ্ছি ভাইয়া 💙`;
            actions.push("photo-fallback");
          }
          await sendMessage(chatId, reply + (await offerSlotResetSuffix()), msg.message_id);

          actions.push("photo-fallback");
          await logMessage("question", actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "photo-fallback", actions });
        }

        // ---- bot genuinely doesn't know → hand off to the human admin --------
        if (
          (!decision.reply || bypassDecisionReply) &&
          decision.escalate &&
          !decision.should_delete &&
          !decision.needs_uid &&
          decision.intent === null &&
          settings.auto_reply_enabled &&
          (settings as any).escalate_enabled !== false
        ) {
          const { escalateReply, smartAnswer } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const { appRulebook } = await import("@/lib/telegram-app-rules.server");
          const { agentAnswer } = await import("@/lib/telegram-agent.server");
          const rates2 = await loadRates();
          const base2 = {
            name: senderName,
            question:
              (bypassDecisionReply
                ? `${text}\n\nএটা আগের কথার/ভয়েসের ফলোআপ। history দেখে আগের প্রশ্ন বা ভয়েসের বিষয়টা বুঝে সরাসরি উত্তর দাও; generic greeting দেবে না।`
                : text) + quotedContext,

            knowledge: knowledgeText(rates2),
            history: convoHistory,
            pastReplies: convoReplies,
            recall: recallText,
          };
          const smart =
            (await agentAnswer({
              ...base2,
              rulebook: appRulebook(rates2),
              isAdmin: senderIsAdmin,
            })) ?? (await smartAnswer(base2));
          const mention =
            (settings as any).admin_mention || (settings as any).support_username || "@anamulmunni";
          if (!smart) {
            const { aiOutOfQuota } = await import("@/lib/ai-free.server");
            if (aiOutOfQuota()) {
              await logMessage(decision.verdict, "silent-no-ai", null, matchedUid);
              return Response.json({ ok: true, flow: "silent-no-ai" });
            }
          }
          const reply = smart
            ? smart + videoSuffix(text)
            : `${escalateReply(senderName, mention)}\n${mention}`;

          await sendMessage(chatId, reply, msg.message_id);
          actions.push("escalated");
          await logMessage(decision.verdict, actions.join(","), reply, matchedUid);
          return Response.json({ ok: true, flow: "escalated", actions });
        }

        // ---- guided slot reset: ask UID → ask slot → reset --------------------
        if (
          decision.intent === "slot_reset" &&
          (settings as any).slot_reset_enabled !== false &&
          !decision.should_delete &&
          msg.from?.id
        ) {
          // AI মাঝে মাঝে স্লট নম্বরটাকেই UID ভেবে বসে ("৬ নাম্বার সোলট মুছে দে" →
          // uid 6)। তাই স্লট হিসেবে বলা নম্বরটি কখনোই UID হিসেবে নেওয়া হবে না;
          // চেনা ইউজারের KYC-লিংক করা UID-ই আগে ব্যবহার হবে।
          const slotNumbers = pickSlots(norm);
          const wroteUidWord = /(uid|ইউআইডি|আইডি|আই ডি)/i.test(norm);
          const aiUid =
            decision.uid && !(!wroteUidWord && slotNumbers.includes(Number(decision.uid)))
              ? decision.uid
              : null;
          const uid = aiUid || pickUid(norm) || (await linkedUid());

          if (!uid) {
            const already = await pendingResetInfo();
            if (already) {
              await sendPendingResetNotice(already);
              return Response.json({ ok: true, flow: "slot-reset-pending" });
            }
          }
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
              const slots = (() => {
                const f = pickSlots(norm.replace(uid, " "));
                return f.length ? f : mentionedSlot ? [mentionedSlot] : [];
              })();
              await saveSession({ step: "await_slot", uid, app_user_id: prof.id });
              if (slots.length || wantsAll) {
                await doReset(uid, wantsAll ? [] : slots);
                actions.push("slot-reset:done");
              } else {
                await sendMessage(
                  chatId,
                  `✅ একাউন্ট পাওয়া গেছে: <b>${prof.display_name || "ইউজার"}</b> (UID <code>${uid}</code>)\n\n` +
                    `🔢 ${settings.ask_slot_message || 'কোন কোন স্লট রিসেট করতে চান? এক বা একাধিক নম্বর লিখুন (যেমন: 3 অথবা 2,5,7 অথবা 2-6, সবগুলোর জন্য লিখুন "সব")'}`,
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

          await logMessage(
            decision.verdict,
            actions.join(",") || "none",
            decision.reply,
            matchedUid,
          );
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
          const explicitUidValue =
            norm.match(
              /(?:uid|ইউআইডি|আইডি|আই ডি|id\s*no|আইডি নাম্বার)\s*[:#-]?\s*([A-Za-z0-9]{2,10})/i,
            )?.[1] ?? null;
          const rawCandidate = explicitUid
            ? explicitUidValue || decision.uid || pickUid(norm)
            : onlyValue;
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
        if (
          settings.auto_reply_enabled &&
          !repliedSomething &&
          !decision.should_delete &&
          (text.trim() || photoBase64)
        ) {
          const { smartAnswer, escalateReply } = await import("@/lib/telegram-bot.server");
          const { loadRates, knowledgeText } = await import("@/lib/telegram-knowledge.server");
          const mention =
            (settings as any).admin_mention || (settings as any).support_username || "@anamulmunni";
          let reply: string | null = null;
          if (decision.needs_uid) {
            if (msg.from?.id) {
              await saveSession({
                intent: "account_info",
                step: "await_uid",
                uid: null,
                app_user_id: null,
              });
            }
            reply =
              `🆔 ${senderName}, আপনার একাউন্টের তথ্য দেখে জানাতে আপনার <b>UID</b> নম্বরটি দরকার।\n` +
              `দয়া করে UID টি লিখুন (অ্যাপের প্রোফাইল পেজে পাবেন) — সাথে সাথেই সব হিসাব জানিয়ে দেব 💙`;
          } else {
            const { appRulebook } = await import("@/lib/telegram-app-rules.server");
            const { agentAnswer } = await import("@/lib/telegram-agent.server");
            const rates3 = await loadRates();
            const base3 = {
              name: senderName,
              question:
                (bypassDecisionReply
                  ? `${text}\n\nএটা আগের কথার/ভয়েসের ফলোআপ। history দেখে আগের প্রশ্ন বা ভয়েসের বিষয়টা বুঝে সরাসরি উত্তর দাও; generic greeting দেবে না।`
                  : text) + quotedContext,

              knowledge: knowledgeText(rates3),
              history: convoHistory,
              pastReplies: convoReplies,
              recall: recallText,
            };
            reply =
              (await agentAnswer({
                ...base3,
                rulebook: appRulebook(rates3),
                isAdmin: senderIsAdmin,
              })) ?? (await smartAnswer(base3));
          }
          const escalated = !reply;
          if (!reply) {
            const { aiOutOfQuota } = await import("@/lib/ai-free.server");
            // কোটা শেষ → অজানা প্রশ্নে চুপ, কোনো মেনশন নয়।
            if (aiOutOfQuota()) {
              await logMessage(decision.verdict, "silent-no-ai", null, matchedUid);

              return Response.json({ ok: true, flow: "silent-no-ai" });
            }
            reply = `${escalateReply(senderName, mention)}\n${mention}`;
          }

          await sendMessage(chatId, reply, msg.message_id);
          actions.push("fallback-answer");
          decision.reply = reply;
          // Remember this answer so the same question never costs credits again.
          if (!escalated && !decision.needs_uid) {
            try {
              const { saveCachedReply } = await import("@/lib/telegram-reply-cache.server");
              await saveCachedReply(text, reply);
            } catch (e) {
              console.error("[tg] reply cache save failed", e);
            }
          }
        }

        await supabaseAdmin
          .from("tg_messages")
          .update({
            text: text.slice(0, 2000),
            has_photo: !!photos?.length,
            verdict: decision.verdict,
            action: actions.join(",") || "none",
            bot_reply: decision.reply,
            matched_uid: matchedUid,
          })
          .eq("update_id", update.update_id);

        return Response.json({ ok: true, verdict: decision.verdict, actions, banRequested });
      },
    },
  },
});
