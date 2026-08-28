import { sendTemplateEmail } from "@/lib/email-templates/send-email";

/**
 * সিস্টেম (নন-লগইন) ইমেইল পাঠানোর হেল্পার — যেমন পাসওয়ার্ড রিসেট কোড।
 * মেইল সরাসরি Lovable-এর ম্যানেজড ইমেইল সার্ভিস দিয়ে পাঠানো হয়।
 */
export async function sendSystemEmail(opts: {
  templateName: string;
  to: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
}) {
  const to = opts.to.trim().toLowerCase();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const logRow = async (
    status: "sent" | "suppressed" | "failed",
    errorMessage?: string,
  ) => {
    const { error } = await supabaseAdmin.from("email_send_log").insert({
      message_id: null,
      template_name: opts.templateName,
      recipient_email: to,
      status,
      error_message: errorMessage ?? null,
    });
    if (error) {
      console.error("email_send_log insert failed", {
        code: error.code,
        message: error.message,
      });
    }
  };

  let result: Awaited<ReturnType<typeof sendTemplateEmail>>;
  try {
    result = await sendTemplateEmail(opts.templateName, to, {
      templateData: (opts.templateData ?? {}) as Record<string, any>,
      ...(opts.idempotencyKey ? { idempotencyKey: opts.idempotencyKey } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logRow("failed", message.slice(0, 1000));
    console.error("system email send failed", message);
    throw new Error("মেইল পাঠানো যায়নি");
  }

  if (!result.sent) {
    await logRow("suppressed");
    throw new Error("এই ইমেইল ঠিকানায় মেইল পাঠানো সম্ভব নয়");
  }

  await logRow("sent");

  return { ok: true as const };
}
