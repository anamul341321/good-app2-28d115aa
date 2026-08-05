// Server-only: যে স্লটগুলো রিসেট করা হয়েছিল সেগুলো আবার আগের অবস্থায় ফিরিয়ে
// আনা (key + ফেস ফটো + ভেরিফিকেশনের সময় হুবহু আগের মতো)।

export type RestorableSlot = {
  backupId: string;
  slot: number;
  created_at: string;
  wallet_address: string | null;
};

/** এখনো ফিরিয়ে আনা হয়নি এমন রিসেট-ব্যাকআপগুলো (স্লট অনুযায়ী সর্বশেষটি)। */
export async function listRestorableForUid(uid: string): Promise<{
  found: boolean;
  name: string;
  uid: string;
  slots: RestorableSlot[];
}> {
  const { findProfileByUid } = await import("@/lib/telegram-slot.server");
  const profile = await findProfileByUid(uid);
  if (!profile) return { found: false, name: "", uid: "", slots: [] };

  const { listTaskBackups } = await import("@/lib/slot-backup.server");
  const all = await listTaskBackups(profile.id);

  const bySlot = new Map<number, RestorableSlot>();
  for (const b of all) {
    if (b.restored_at) continue;
    if (bySlot.has(b.slot)) continue; // listTaskBackups already newest-first
    bySlot.set(b.slot, {
      backupId: b.id,
      slot: b.slot,
      created_at: b.created_at,
      wallet_address: b.wallet_address,
    });
  }

  return {
    found: true,
    name: profile.display_name || `UID ${profile.uid_seq}`,
    uid: String(profile.uid_seq ?? uid),
    slots: Array.from(bySlot.values()).sort((a, b) => a.slot - b.slot),
  };
}

/** নির্দিষ্ট স্লটগুলো ফিরিয়ে আনে। slots খালি দিলে সবগুলোই ফিরিয়ে আনে। */
export async function restoreSlotsForUid(
  uid: string,
  slots: number[],
): Promise<{ found: boolean; name: string; uid: string; done: number[]; failed: number[]; available: number[] }> {
  const list = await listRestorableForUid(uid);
  if (!list.found) return { found: false, name: "", uid: "", done: [], failed: [], available: [] };

  const wanted = slots.length ? new Set(slots) : new Set(list.slots.map((s) => s.slot));
  const { restoreTaskBackup } = await import("@/lib/slot-backup.server");

  const done: number[] = [];
  const failed: number[] = [];
  for (const item of list.slots) {
    if (!wanted.has(item.slot)) continue;
    const res = await restoreTaskBackup(item.backupId);
    if (res.ok) done.push(item.slot);
    else failed.push(item.slot);
  }

  return {
    found: true,
    name: list.name,
    uid: list.uid,
    done,
    failed,
    available: list.slots.map((s) => s.slot),
  };
}
