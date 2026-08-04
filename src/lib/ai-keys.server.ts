/**
 * Server-only: the bot's AI key pool.
 *
 * Admin adds free Gemini keys one by one from the admin panel — unlimited many.
 * The bot always uses the first key that is not on cool-down; when a key's free
 * quota runs out (429/403) it is parked for a while and the next key is used
 * automatically, with no restart and no code change.
 */

type KeyRow = {
  id: string;
  api_key: string;
  label: string | null;
  active: boolean;
  exhausted_until: string | null;
  calls: number;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
};

let cache: { at: number; rows: KeyRow[] } | null = null;
const TTL_MS = 30_000;

/** Quota resets daily on Google's side — park an exhausted key for 1 hour. */
const COOLDOWN_MS = 60 * 60 * 1000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export function invalidateKeyCache() {
  cache = null;
}

async function loadRows(): Promise<KeyRow[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  try {
    const db = await admin();
    const { data } = await db
      .from("ai_keys")
      .select("*")
      .order("created_at", { ascending: true });
    const rows = ((data ?? []) as unknown as KeyRow[]).filter((r) => !!r.api_key);
    cache = { at: Date.now(), rows };
    return rows;
  } catch {
    return cache?.rows ?? [];
  }
}

/** Usable keys right now (active + not on cool-down), oldest first. */
export async function usableDbKeys(): Promise<{ id: string; key: string }[]> {
  const rows = await loadRows();
  const now = Date.now();
  return rows
    .filter((r) => r.active)
    .filter((r) => !r.exhausted_until || new Date(r.exhausted_until).getTime() < now)
    .map((r) => ({ id: r.id, key: r.api_key }));
}

export async function markKeyUsed(id: string) {
  try {
    const db = await admin();
    await db.rpc("noop_never").then(() => undefined).catch(() => undefined);
    const rows = await loadRows();
    const row = rows.find((r) => r.id === id);
    await db
      .from("ai_keys")
      .update({
        calls: (row?.calls ?? 0) + 1,
        last_used_at: new Date().toISOString(),
        exhausted_until: null,
        last_error: null,
      } as never)
      .eq("id", id);
  } catch {
    /* usage stats are best-effort */
  }
}

export async function markKeyExhausted(id: string, err: string) {
  try {
    const db = await admin();
    await db
      .from("ai_keys")
      .update({
        exhausted_until: new Date(Date.now() + COOLDOWN_MS).toISOString(),
        last_error: err.slice(0, 300),
      } as never)
      .eq("id", id);
    invalidateKeyCache();
  } catch {
    /* ignore */
  }
}

/** Admin panel listing — the key itself is masked, never returned in full. */
export async function listKeysForAdmin() {
  const db = await admin();
  const { data } = await db
    .from("ai_keys")
    .select("id, label, active, exhausted_until, calls, last_used_at, last_error, created_at, api_key")
    .order("created_at", { ascending: true });
  const now = Date.now();
  return ((data ?? []) as unknown as KeyRow[]).map((r) => ({
    id: r.id,
    label: r.label,
    active: r.active,
    calls: r.calls,
    lastUsedAt: r.last_used_at,
    lastError: r.last_error,
    createdAt: r.created_at,
    cooldownUntil: r.exhausted_until,
    onCooldown: !!r.exhausted_until && new Date(r.exhausted_until).getTime() > now,
    masked: maskKey(r.api_key),
  }));
}

export function maskKey(k: string): string {
  const s = String(k ?? "");
  if (s.length <= 10) return "••••";
  return `${s.slice(0, 6)}••••${s.slice(-4)}`;
}

export async function addKey(rawKey: string, label?: string) {
  const key = String(rawKey ?? "").trim();
  if (key.length < 20) throw new Error("কী টি সঠিক নয় — পুরো কী টি পেস্ট করুন");
  const db = await admin();
  const { error } = await db
    .from("ai_keys")
    .upsert(
      { api_key: key, label: label?.trim() || null, active: true, exhausted_until: null, last_error: null } as never,
      { onConflict: "api_key" },
    );
  if (error) throw new Error("কী সেভ করা যায়নি");
  invalidateKeyCache();
  return { ok: true as const };
}

export async function setKeyActive(id: string, active: boolean) {
  const db = await admin();
  await db.from("ai_keys").update({ active, exhausted_until: null } as never).eq("id", id);
  invalidateKeyCache();
  return { ok: true as const };
}

export async function deleteKey(id: string) {
  const db = await admin();
  await db.from("ai_keys").delete().eq("id", id);
  invalidateKeyCache();
  return { ok: true as const };
}
