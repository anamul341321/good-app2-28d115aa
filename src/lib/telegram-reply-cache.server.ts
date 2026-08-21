// Server-only: the bot's answer memory. The same question asked again in the
// group is answered from this cache instead of calling the AI — so credits are
// only spent once per unique question.

function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Questions with UID/slot numbers or personal data must never be cached. */
export function isCacheableQuestion(text: string): boolean {
  const n = normalizeQuestion(text);
  if (n.length < 8 || n.length > 240) return false;
  if (/\d/.test(n)) return false; // UID, slot number, amount → user-specific
  if (
    /(bonus|বোনাস|offer|অফার|verify|ভেরিফাই|reverify|রি ভেরিফাই|রিভেরিফাই|refer|রেফার|commission|কমিশন|rate|রেট)/i.test(
      n,
    )
  )
    return false;
  return true;
}

export async function getCachedReply(text: string): Promise<string | null> {
  if (!isCacheableQuestion(text)) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key = normalizeQuestion(text);
    const { data } = await supabaseAdmin
      .from("tg_reply_cache")
      .select("id, reply, hits")
      .eq("question_key", key)
      .maybeSingle();
    if (!data?.reply) return null;
    await supabaseAdmin
      .from("tg_reply_cache")
      .update({ hits: ((data as any).hits ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", (data as any).id);
    return (data as any).reply as string;
  } catch (e) {
    console.error("[tg] reply cache read failed", e);
    return null;
  }
}

export async function saveCachedReply(text: string, reply: string): Promise<void> {
  if (!isCacheableQuestion(text)) return;
  if (!reply || reply.trim().length < 20) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("tg_reply_cache").upsert(
      {
        question_key: normalizeQuestion(text),
        question: text.slice(0, 500),
        reply,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "question_key" },
    );
  } catch (e) {
    console.error("[tg] reply cache write failed", e);
  }
}
