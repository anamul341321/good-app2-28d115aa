import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

// প্রতিদিন গ্রুপে "দৈনিক ক্লেইম" সতর্কবার্তা পাঠায়। pg_cron থেকে কল হয়।
function warningToken() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_URL"] ?? "";
  return createHmac("sha256", `daily-warning:${key}`).update("claim").digest("base64url");
}

const WARNING_TEXT = `⚠️ <b>দৈনিক মাইনিং ক্লেইমের রিমাইন্ডার</b> ⚠️

প্রিয় সদস্যবৃন্দ,

আজকের মাইনিং ব্যালেন্স <b>আজই ক্লেইম</b> করে নিন। রাত ১২টার (ঢাকা সময়) আগে ক্লেইম না করলে <b>আজকের টাকা হারিয়ে যাবে</b> — পরদিন নতুন করে মাইনিং শুরু হবে।

✅ যে টাকা আগে ক্লেইম করেছেন সেটা নিরাপদ আছে, হারাবে না।
❌ শুধু আজকের অক্লেইম করা টাকা হারাবে।

তাই প্রতিদিন অ্যাপে ঢুকে <b>Claim</b> বাটনে চাপ দিতে ভুলবেন না! 🙏`;

export const Route = createFileRoute("/api/public/daily-claim-warning")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let token = "";
        try {
          const body = await request.json();
          token = typeof body?.token === "string" ? body.token : "";
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const a = Buffer.from(token);
        const b = Buffer.from(warningToken());
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendMessage } = await import("@/lib/telegram-bot.server");

        const { data: s } = await supabaseAdmin
          .from("tg_bot_settings")
          .select("group_chat_id")
          .eq("id", "default")
          .maybeSingle();
        const chat = (s as any)?.group_chat_id;
        if (!chat) return Response.json({ status: "no_group" });

        const res = await sendMessage(chat, WARNING_TEXT);
        return Response.json({ status: res ? "sent" : "failed" });
      },
    },
  },
});
