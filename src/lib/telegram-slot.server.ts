// Server-only: slot reset performed on behalf of a Telegram support request.
// Mirrors adminResetTask so the bot and the admin panel behave identically.

export type SlotResetResult =
  | { ok: true; slot: number; name: string; hadWallet: boolean }
  | { ok: false; error: string };

/** Words like "৪ নম্বর স্লট" must never be read as a UID. */
/** স্লট শব্দের সব ভুল বানান (সোলট, স্লোট, solt, slt …) একসাথে ধরার প্যাটার্ন। */
export const SLOT_WORD = "(?:slot+s?|slt|solt|salt|স্লট|স্লোট|সোলট|সলট|স্লাট|স্লট্ট)";
/** "নম্বর" শব্দের ভুল বানানগুলো (নাম্ষার, নাম্বর …)। */
export const NUM_WORD = "(?:no|nombor|nomber|number|নম্বর|নাম্বার|নাম্ষার|নাম্বর|নম্বার|নং)";

export function stripSlotMentions(s: string): string {
  return s
    .replace(new RegExp(`(\\d{1,3})\\s*${NUM_WORD}?\\s*(?:er|এর)?\\s*${SLOT_WORD}`, "gi"), " ")
    .replace(new RegExp(`${SLOT_WORD}\\s*${NUM_WORD}?\\s*[:#-]?\\s*(\\d{1,3})`, "gi"), " ")
    // "৬ নাম্বারটা মুছে দে" — স্লট শব্দ না থাকলেও এটা স্লট নম্বরই।
    .replace(new RegExp(`(\\d{1,3})\\s*${NUM_WORD}\\s*(?:টা|টি|ta|ti)?`, "gi"), " ");
}



export async function findProfileByUid(uid: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const clean = uid.trim();
  if (!clean) return null;

  if (/^\d+$/.test(clean)) {
    const { data } = await supabaseAdmin
      .from("profiles").select("id, display_name, uid_seq")
      .eq("uid_seq", Number(clean)).maybeSingle();
    if (data) return data;
  }
  const { data: byCode } = await supabaseAdmin
    .from("profiles").select("id, display_name, uid_seq")
    .eq("referral_code", clean.toUpperCase()).maybeSingle();
  return byCode ?? null;
}

export async function resetSlotForUid(uid: string, slot: number): Promise<SlotResetResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!Number.isInteger(slot) || slot < 1 || slot > 500) {
    return { ok: false, error: "স্লট নম্বরটি সঠিক নয়।" };
  }


  const profile = await findProfileByUid(uid);
  if (!profile) return { ok: false, error: "এই UID দিয়ে কোনো একাউন্ট পাওয়া যায়নি।" };

  const { data: task } = await supabaseAdmin
    .from("tasks")
    .select("id, wallet_address, face_photo_url")
    .eq("user_id", profile.id).eq("slot", slot).maybeSingle();
  if (!task) return { ok: false, error: `স্লট ${slot} পাওয়া যায়নি।` };

  // Keep a restorable snapshot (key + photo + timestamps) before clearing.
  const { backupTask } = await import("@/lib/slot-backup.server");
  await backupTask(task.id, `telegram:${uid}`);

  // Clear any pending backup first, otherwise the whitelist job can re-promote
  // the old face/key back into the slot after the reset.
  await supabaseAdmin.from("unverified_attempts")
    .delete().eq("user_id", profile.id).eq("slot", slot);
  if (task.wallet_address) {
    await supabaseAdmin.from("unverified_attempts")
      .delete().eq("user_id", profile.id).eq("wallet_address", task.wallet_address);
  }
  // The face photo file is intentionally kept in storage so the slot can be
  // fully restored if the reset was a mistake.


  const { error } = await supabaseAdmin.from("tasks").update({
    status: "empty",
    face_photo_url: null,
    face_label: null,
    wallet_address: null,
    wallet_private_key: null,
    initial_verify_at: null,
    reverify_due_at: null,
    done_at: null,
    whitelist_ok: true,
    last_whitelist_check_at: null,
    last_reverified_at: null,
    reverify_count: 0,
    created_at: new Date().toISOString(),
  }).eq("id", task.id);
  if (error) return { ok: false, error: "রিসেট করা যায়নি, একটু পরে আবার চেষ্টা করুন।" };

  // A pending attempt can be re-created by the whitelist job between the
  // delete above and this update — clear again after the slot is emptied.
  await supabaseAdmin.from("unverified_attempts")
    .delete().eq("user_id", profile.id).eq("slot", slot);

  // Verify the row is genuinely empty now; never report success on a no-op.
  const { data: after } = await supabaseAdmin
    .from("tasks")
    .select("status, wallet_address, face_photo_url")
    .eq("id", task.id)
    .maybeSingle();
  if (!after || after.status !== "empty" || after.wallet_address || after.face_photo_url) {
    return { ok: false, error: "স্লটটি খালি হয়নি — অ্যাডমিন প্যানেল থেকে চেষ্টা করুন।" };
  }

  return {
    ok: true,
    slot,
    name: profile.display_name || `UID ${profile.uid_seq}`,
    hadWallet: !!task.wallet_address,
  };
}

export type BatchResetResult = {
  found: boolean;
  name: string;
  /** UID the bot actually resolved — shown back so a wrong UID is obvious. */
  uid?: string;
  done: number[];
  failed: { slot: number; error: string }[];
};


/** Reset any number of slots at once for one account. */
export async function resetSlotsForUid(uid: string, slots: number[]): Promise<BatchResetResult> {
  const profile = await findProfileByUid(uid);
  if (!profile) return { found: false, name: "", done: [], failed: [] };

  const unique = Array.from(new Set(slots)).sort((a, b) => a - b);
  const done: number[] = [];
  const failed: { slot: number; error: string }[] = [];

  for (const slot of unique) {
    const res = await resetSlotForUid(uid, slot);
    if (res.ok) done.push(slot);
    else failed.push({ slot, error: res.error });
  }

  return {
    found: true,
    name: profile.display_name || `UID ${profile.uid_seq}`,
    uid: String(profile.uid_seq ?? uid),
    done,
    failed,
  };

}

/** Slot numbers that actually exist for an account (used for "সব স্লট" requests). */
export async function listSlotNumbers(uid: string): Promise<number[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const profile = await findProfileByUid(uid);
  if (!profile) return [];
  const { data } = await supabaseAdmin
    .from("tasks").select("slot").eq("user_id", profile.id).order("slot");
  return (data ?? []).map((r) => r.slot as number);
}
