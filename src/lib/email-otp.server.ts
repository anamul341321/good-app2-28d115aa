import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Good-App";
const SENDER_DOMAIN = "notify.goodapp2.live";
const FROM_DOMAIN = "notify.goodapp2.live";

/**
 * সিস্টেম (নন-লগইন) ইমেইল পাঠানোর হেল্পার — যেমন পাসওয়ার্ড রিসেট কোড।
 * ডোমেইন ভেরিফাই শেষ হলে কিউ নিজে নিজেই মেইল পাঠাতে শুরু করে।
 */
export async function sendSystemEmail(opts: {
  templateName: string;
  to: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const template = TEMPLATES[opts.templateName];
  if (!template) throw new Error(`Unknown email template: ${opts.templateName}`);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const to = opts.to.trim().toLowerCase();

  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", to)
    .maybeSingle();
  if (suppressed) throw new Error("এই ইমেইল ঠিকানায় মেইল পাঠানো সম্ভব নয়");

  const data = opts.templateData ?? {};
  const element = React.createElement(template.component, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof template.subject === "function" ? template.subject(data) : template.subject;

  const messageId = crypto.randomUUID();

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: opts.templateName,
    recipient_email: to,
    status: "pending",
  });

  const { error } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: opts.templateName,
      idempotency_key: opts.idempotencyKey ?? messageId,
      queued_at: new Date().toISOString(),
    },
  });

  if (error) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: opts.templateName,
      recipient_email: to,
      status: "failed",
      error_message: error.message,
    });
    throw new Error("মেইল পাঠানো যায়নি");
  }

  return { ok: true as const };
}
