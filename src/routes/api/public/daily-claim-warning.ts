import { createFileRoute } from "@tanstack/react-router";

// প্রতিদিন গ্রুপে "দৈনিক ক্লেইম" সতর্কবার্তা পাঠায়। pg_cron থেকে কল হয়।

const WARNING_TEXT = `⚠️ <b>দৈনিক মাইনিং ক্লেইমের রিমাইন্ডার</b> ⚠️

প্রিয় সদস্যবৃন্দ,

দিনে একবার ক্লেইম করলেই পুরো দিনের মাইনিং টাকা পেন্ডিং ব্যালেন্সে যোগ হয়। <b>সন্ধ্যা ৬টার (ঢাকা সময়) আগে ক্লেইম</b> না করলে <b>ওই দিনের টাকা হারিয়ে যাবে</b>। প্রতি মাসের ১ তারিখে whitelist থাকা ঘরের পেন্ডিং টাকা মেইন ব্যালেন্সে যায় — whitelist না থাকলে Re-verify করলে যাবে।

✅ যে টাকা আগে ক্লেইম করেছেন সেটা নিরাপদ আছে, হারাবে না।
❌ শুধু আজকের অক্লেইম করা টাকা হারাবে।

তাই প্রতিদিন অ্যাপে ঢুকে <b>Claim</b> বাটনে চাপ দিতে ভুলবেন না! 🙏`;

export const Route = createFileRoute("/api/public/daily-claim-warning")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const suppliedSecret = request.headers.get("x-cron-secret");
        const { data: expectedSecret, error: secretError } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (secretError || !expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
          return new Response("forbidden", { status: 401 });
        }
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
