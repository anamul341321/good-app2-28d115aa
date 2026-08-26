/**
 * Face Login Bind — সার্ভার হেল্পার।
 *
 * পুরনো ইউজাররা (যারা নম্বর/পাসওয়ার্ড দিয়ে একাউন্ট খুলেছে) তাদের স্লটে
 * GoodDollar ভেরিফিকেশনের সময় তোলা ফেস ছবি ইতিমধ্যেই ডাটাবেজে আছে।
 * সেই স্লটের ছবিকেই "ফেস লগইন" পরিচয় হিসেবে bind করা যাবে —
 *   • লাইভ স্ক্যান করলে অটো ম্যাচ হয়ে যে স্লটে নিজের ফেস আছে সেটাই bind হবে
 *   • অথবা ইউজার নিজেই জানে কোন স্লটে তার ফেস — সেটা হাতে বেছে bind করতে পারবে
 *
 * bind হলে face_signups টেবিলে রেকর্ড তৈরি হয়, ফলে যেকোনো ফোন থেকে
 * ফেস স্ক্যান করলেই সেই একাউন্টে লগইন করা যাবে।
 */

type SlotFace = {
  slot: number;
  taskId: string;
  label: string | null;
  photoPath: string;
  signedUrl: string | null;
  walletAddress: string | null;
  whitelistOk: boolean;
  reverifyCount: number;
  bound: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** ইউজারের প্রোফাইল (নাম + নম্বর) — bind করতে দরকার */
export async function getBindProfile(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("profiles")
    .select("display_name, phone_number")
    .eq("id", userId)
    .maybeSingle();
  const phone = (data as any)?.phone_number as string | null;
  if (!phone) throw new Error("আপনার একাউন্টে মোবাইল নম্বর নেই — আগে নম্বর যোগ করুন");
  return {
    phone,
    name: ((data as any)?.display_name as string | null) || `User ${phone.slice(-4)}`,
  };
}

/** কোন ফেস ছবি এখন লগইনের জন্য bind আছে */
export async function getBoundPhotoPath(userId: string) {
  const db = await admin();
  const { data } = await db
    .from("face_signups")
    .select("face_photo_url, wallet_address, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    photoPath: ((data as any)?.face_photo_url as string | null) ?? null,
    walletAddress: ((data as any)?.wallet_address as string | null) ?? null,
    status: ((data as any)?.status as string | null) ?? null,
  };
}

/** ইউজারের সব স্লট যেগুলোতে ফেস ছবি আছে (signed url সহ) */
export async function listSlotFaces(userId: string): Promise<SlotFace[]> {
  const db = await admin();
  const bound = await getBoundPhotoPath(userId);

  const { data } = await db
    .from("tasks")
    .select("id, slot, face_label, face_photo_url, wallet_address, whitelist_ok, reverify_count")
    .eq("user_id", userId)
    .not("face_photo_url", "is", null)
    .order("slot", { ascending: true });

  const rows = (data ?? []) as any[];
  const out: SlotFace[] = [];
  for (const r of rows) {
    let signedUrl: string | null = null;
    try {
      const { data: s } = await db.storage
        .from("face-photos")
        .createSignedUrl(r.face_photo_url as string, 60 * 20);
      signedUrl = s?.signedUrl ?? null;
    } catch {
      signedUrl = null;
    }
    out.push({
      slot: r.slot as number,
      taskId: r.id as string,
      label: (r.face_label as string | null) ?? null,
      photoPath: r.face_photo_url as string,
      signedUrl,
      walletAddress: (r.wallet_address as string | null) ?? null,
      whitelistOk: !!r.whitelist_ok,
      reverifyCount: Number(r.reverify_count ?? 0),
      bound: bound.photoPath === r.face_photo_url,
    });
  }
  return out;
}

/** স্টোরেজ থেকে ছবি নামিয়ে base64 */
export async function photoToBase64(path: string): Promise<string | null> {
  const db = await admin();
  try {
    const { data: file } = await db.storage.from("face-photos").download(path);
    if (!file) return null;
    const buf = new Uint8Array(await file.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]!);
    return btoa(bin);
  } catch {
    return null;
  }
}

/** লাইভ স্ক্যানকে ইউজারের নিজের স্লট ছবিগুলোর সাথে মিলিয়ে দেখা */
export async function findMatchingSlot(userId: string, capturedBase64: string) {
  const { verifyIdentityStrict } = await import("./face-match.server");
  const slots = await listSlotFaces(userId);
  if (slots.length === 0) return null;

  for (const s of slots) {
    const ref = await photoToBase64(s.photoPath);
    if (!ref) continue;
    try {
      const one = await verifyIdentityStrict(capturedBase64, { id: s.taskId, base64: ref });
      if (one.matches) return s;
    } catch {
      // এই স্লট বাদ দিয়ে পরেরটা দেখা হবে
    }
  }
  return null;
}

/** নির্দিষ্ট স্লটের ফেসকে লগইন পরিচয় হিসেবে সেট করা */
export async function bindSlot(userId: string, slot: number) {
  const db = await admin();
  const { phone, name } = await getBindProfile(userId);

  const { data: task } = await db
    .from("tasks")
    .select("slot, face_photo_url, wallet_address, wallet_private_key, whitelist_ok")
    .eq("user_id", userId)
    .eq("slot", slot)
    .maybeSingle();

  const t = task as any;
  if (!t || !t.face_photo_url) throw new Error("এই স্লটে কোনো ফেস ছবি পাওয়া যায়নি");
  if (!t.wallet_address || !t.wallet_private_key) {
    throw new Error("এই স্লটের ভেরিফিকেশন key পাওয়া যায়নি — অন্য স্লট বেছে নিন");
  }

  // একই ইউজারের আগের bind সরিয়ে নতুনটি রাখা হয় (এক ইউজার = এক ফেস লগইন)
  await db.from("face_signups").delete().eq("user_id", userId);

  const { error } = await db.from("face_signups").upsert(
    {
      display_name: name,
      phone_number: phone,
      wallet_address: t.wallet_address,
      wallet_private_key: t.wallet_private_key,
      face_photo_url: t.face_photo_url,
      user_id: userId,
      status: t.whitelist_ok ? "verified" : "pending",
      verified_at: t.whitelist_ok ? new Date().toISOString() : null,
    } as never,
    { onConflict: "wallet_address" },
  );
  if (error) throw new Error(error.message);

  return { slot: t.slot as number, whitelisted: !!t.whitelist_ok };
}
