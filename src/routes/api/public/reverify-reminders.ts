// Resumable re-verify reminder worker. Scans verified tasks whose reverify_due_at
// is in a configurable window and sends a push + in-app notice once per window.
import { createFileRoute } from "@tanstack/react-router";
import { notifyUser } from "@/lib/notify.server";

const BATCH_SIZE = 200;
const MAX_BATCHES_PER_REQUEST = 1;

const WINDOWS = [
  { label: "3day", hours: 72, title: "🔄 রি-ভেরিফাই শীঘ্রই", body: "আপনার #{slot} নং ঘরের রি-ভেরিফাই ৩ দিন পর। অ্যাপস খুলে সম্পন্ন করুন।" },
  { label: "1day", hours: 24, title: "🔄 আর ১ দিন বাকি", body: "#{slot} নং ঘরের রি-ভেরিফাই আগামীকাল। ভুলে গেলে মাইনিং বন্ধ হয়ে যেতে পারে!" },
  { label: "6hour", hours: 6, title: "⏰ রি-ভেরিফাই আজ", body: "#{slot} নং ঘরের রি-ভেরিফাই আর মাত্র কয়েক ঘণ্টা বাকি। এখনই করে নিন।" },
  { label: "due", hours: 0, title: "⚠️ রি-ভেরিফাই সময় হয়ে গেছে", body: "#{slot} নং ঘরের রি-ভেরিফাই এখন করা প্রয়োজন। না করলে মাইনিং থামতে পারে।" },
];

export const Route = createFileRoute("/api/public/reverify-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const suppliedSecret = request.headers.get("x-cron-secret");
        const { data: expectedSecret } = await supabaseAdmin.rpc("get_whitelist_cron_secret");
        if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
          return new Response("forbidden", { status: 401 });
        }

        let totalSent = 0;
        const now = new Date();
        const processed = new Set<string>();

        for (const window of WINDOWS) {
          // Find tasks whose due date falls within this window's hour range but reminder
          // has not been sent yet. Window upper bound is exclusive, lower bound inclusive.
          const lower = new Date(now.getTime() + (window.hours - 3) * 60 * 60 * 1000);
          const upper = new Date(now.getTime() + window.hours * 60 * 60 * 1000);
          const { data: rows, error } = await supabaseAdmin
            .from("tasks")
            .select("id, user_id, slot, reverify_due_at")
            .eq("status", "verified")
            .gte("reverify_due_at", lower.toISOString())
            .lte("reverify_due_at", upper.toISOString())
            .order("id")
            .limit(BATCH_SIZE);

          if (error) {
            console.error("[reverify-reminders] query error", error);
            return Response.json({ error: error.message }, { status: 500 });
          }

          for (const task of rows ?? []) {
            if (processed.has(task.id)) continue;
            processed.add(task.id);

            const { data: already } = await supabaseAdmin
              .from("reverify_reminders")
              .select("id")
              .eq("task_id", task.id)
              .eq("window_label", window.label)
              .maybeSingle();
            if (already) continue;

            const title = window.title;
            const body = window.body.replace("#{slot}", String(task.slot));
            await notifyUser(task.user_id, title, body, { url: "/home" });
            await supabaseAdmin.from("reverify_reminders").insert({
              task_id: task.id,
              user_id: task.user_id,
              slot: task.slot,
              due_at: task.reverify_due_at,
              window_label: window.label,
              sent_at: new Date().toISOString(),
            } as any);
            totalSent++;
          }

          if (processed.size >= BATCH_SIZE * MAX_BATCHES_PER_REQUEST) break;
        }

        return Response.json({ ok: true, sent: totalSent, windows: WINDOWS.length });
      },
    },
  },
});
