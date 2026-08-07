// Server-only: টেলিগ্রাম থেকে চাওয়া স্লট রিসেট সরাসরি হবে না — ইউজার অ্যাপে
// ঢুকে নিজে অনুমোদন দিলে তবেই রিসেট হবে (একজন আরেকজনের স্লট রিসেট করাতে
// না পারে সেজন্য)।

export type ResetRequestResult =
  | { ok: true; requestId: string; name: string; uid: string; slots: number[] }
  | { ok: false; error: string };

export async function createSlotResetRequest(opts: {
  uid: string;
  slots: number[];
  requestedBy?: string | null;
  chatId?: string | number | null;
  tgUserId?: number | null;
  tgMessageId?: number | null;
}): Promise<ResetRequestResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { findProfileByUid, listSlotNumbers } = await import("@/lib/telegram-slot.server");

  const profile = await findProfileByUid(opts.uid);
  if (!profile) return { ok: false, error: "এই UID দিয়ে কোনো একাউন্ট পাওয়া যায়নি।" };

  const slots = (opts.slots.length ? opts.slots : await listSlotNumbers(opts.uid)).filter(
    (n) => Number.isInteger(n) && n >= 1 && n <= 500,
  );
  if (!slots.length) return { ok: false, error: "কোন স্লটটি রিসেট করতে হবে সেটা বুঝতে পারিনি।" };

  // একই স্লটের পুরোনো pending অনুরোধ থাকলে সেটাই বাতিল করে নতুনটা রাখব।
  const { error: cancelError } = await supabaseAdmin
    .from("slot_reset_requests")
    .update({ status: "cancelled", resolved_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("status", "pending");
  if (cancelError) {
    console.error("Previous slot reset request could not be closed", {
      userId: profile.id,
      code: cancelError.code,
      message: cancelError.message,
    });
    return {
      ok: false,
      error: "আগের অনুরোধটি বন্ধ করা যায়নি, একটু পরে চেষ্টা করুন।",
    };
  }

  const { data, error } = await supabaseAdmin
    .from("slot_reset_requests")
    .insert({
      user_id: profile.id,
      slots,
      requested_by: opts.requestedBy ?? null,
      tg_chat_id: opts.chatId != null ? String(opts.chatId) : null,
      tg_user_id: opts.tgUserId ?? null,
      tg_message_id: opts.tgMessageId ?? null,
    })
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "অনুরোধটি তৈরি করা যায়নি, একটু পরে চেষ্টা করুন।" };

  return {
    ok: true,
    requestId: data.id as string,
    name: profile.display_name || `UID ${profile.uid_seq}`,
    uid: String(profile.uid_seq ?? opts.uid),
    slots,
  };
}

/** ইউজার অ্যাপে অনুমোদন দিলে আসল রিসেট এখানেই হয় + টেলিগ্রামে রিপোর্ট যায়। */
export async function applyApprovedReset(requestId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: req } = await supabaseAdmin
    .from("slot_reset_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) throw new Error("অনুরোধটি পাওয়া যায়নি");
  if (req.user_id !== userId) throw new Error("এটি আপনার অনুরোধ নয়");
  if (req.status !== "pending") throw new Error("এই অনুরোধটি আগেই সম্পন্ন হয়েছে");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("uid_seq, display_name")
    .eq("id", userId)
    .maybeSingle();
  const uid = String(profile?.uid_seq ?? "");

  const { resetSlotsForUid } = await import("@/lib/telegram-slot.server");
  const res = await resetSlotsForUid(uid, (req.slots as number[]) ?? []);

  const { data: completedRequest, error: completionError } = await supabaseAdmin
    .from("slot_reset_requests")
    .update({ status: "approved", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (completionError || !completedRequest) {
    console.error("Slot reset completed but request could not be closed", {
      requestId,
      code: completionError?.code,
      message: completionError?.message,
    });
    throw new Error("স্লট রিসেট হয়েছে, কিন্তু অনুরোধটি বন্ধ করা যায়নি। আবার চেষ্টা করুন।");
  }

  if (req.tg_chat_id) {
    const { sendMessage } = await import("@/lib/telegram-bot.server");
    const ok = res.done.length
      ? `✅ রিসেট সম্পন্ন: <b>${res.done.map((s) => `স্লট ${s}`).join(", ")}</b>`
      : "⚠️ কোনো স্লট রিসেট করা যায়নি।";
    const fail = res.failed.length
      ? `\n❌ পারা যায়নি: ${res.failed.map((f) => `স্লট ${f.slot}`).join(", ")}`
      : "";
    await sendMessage(
      req.tg_chat_id as string,
      `🔄 <b>ইউজার অনুমোদন দিয়েছেন — স্লট রিসেট হয়েছে</b>\n\n` +
        `👤 ${profile?.display_name || "ইউজার"} • 🆔 UID <code>${uid}</code>\n${ok}${fail}\n\n` +
        `👉 অ্যাপ রিফ্রেশ দিয়ে নতুন করে ফেস ভেরিফিকেশন করুন 💙`,
    ).catch(() => {});
  }

  return { done: res.done, failed: res.failed.map((f) => f.slot) };
}

export async function declineResetRequest(requestId: string, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: req } = await supabaseAdmin
    .from("slot_reset_requests")
    .select("id, user_id, status, tg_chat_id, slots")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) throw new Error("অনুরোধটি পাওয়া যায়নি");
  if (req.user_id !== userId) throw new Error("এটি আপনার অনুরোধ নয়");
  if (req.status !== "pending") throw new Error("এই অনুরোধটি আগেই সম্পন্ন হয়েছে");

  const { data: declinedRequest, error: declineError } = await supabaseAdmin
    .from("slot_reset_requests")
    .update({ status: "declined", resolved_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (declineError || !declinedRequest) {
    console.error("Slot reset request could not be declined", {
      requestId,
      code: declineError?.code,
      message: declineError?.message,
    });
    throw new Error("অনুরোধটি বাতিল করা যায়নি। আবার চেষ্টা করুন।");
  }

  if (req.tg_chat_id) {
    const { sendMessage } = await import("@/lib/telegram-bot.server");
    await sendMessage(
      req.tg_chat_id as string,
      `🚫 ইউজার স্লট রিসেটের অনুরোধটি <b>বাতিল</b> করেছেন — কোনো স্লট রিসেট হয়নি।`,
    ).catch(() => {});
  }
  return { ok: true };
}
