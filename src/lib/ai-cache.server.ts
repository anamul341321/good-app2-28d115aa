/**
 * Answer memory for the Telegram bot.
 *
 * The same handful of questions get asked in the group over and over. Once the
 * AI has answered one well, we store it and serve later repeats straight from
 * the database — no AI call, so the free quota lasts far longer.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Normalize a question so small wording/emoji differences still hit the cache. */
function normalize(q: string): string {
  return String(q || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cachedAnswer(question: string): Promise<string | null> {
  const norm = normalize(question);
  if (norm.length < 8) return null;
  if (
    /(bonus|বোনাস|offer|অফার|verify|ভেরিফাই|reverify|রি ভেরিফাই|রিভেরিফাই|refer|রেফার|commission|কমিশন|rate|রেট)/i.test(
      norm,
    )
  )
    return null;
  try {
    const qhash = await hash(norm);
    const { data } = await supabaseAdmin
      .from("ai_answer_cache")
      .select("answer, hits")
      .eq("qhash", qhash)
      .maybeSingle();
    if (!data?.answer) return null;
    void supabaseAdmin
      .from("ai_answer_cache")
      .update({ hits: (data.hits ?? 0) + 1, updated_at: new Date().toISOString() })
      .eq("qhash", qhash);
    return data.answer as string;
  } catch {
    return null;
  }
}

export async function rememberAnswer(question: string, answer: string): Promise<void> {
  const norm = normalize(question);
  if (norm.length < 8 || !answer || answer.length < 10) return;
  if (
    /(bonus|বোনাস|offer|অফার|verify|ভেরিফাই|reverify|রি ভেরিফাই|রিভেরিফাই|refer|রেফার|commission|কমিশন|rate|রেট)/i.test(
      norm,
    )
  )
    return;
  try {
    const qhash = await hash(norm);
    await supabaseAdmin.from("ai_answer_cache").upsert(
      {
        qhash,
        question: question.slice(0, 1000),
        answer: answer.slice(0, 4000),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "qhash" },
    );
  } catch {
    // caching is best-effort only
  }
}
