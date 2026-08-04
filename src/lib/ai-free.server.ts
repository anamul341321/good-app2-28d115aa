/**
 * Free AI routing for the Telegram support bot.
 *
 * If GEMINI_API_KEY is set (Google AI Studio free tier) every bot AI call goes
 * there — no Lovable credits are used. Google's OpenAI-compatible endpoint
 * accepts the exact same chat-completions body (text + image_url data URLs),
 * so call sites stay unchanged: `fetch(AI_URL, init)` → `aiFetch(AI_URL, init)`.
 *
 * Without the key it falls back to the Lovable AI Gateway (paid), so nothing
 * breaks if the key is removed.
 */

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

/** Free-tier friendly Gemini model; override with GEMINI_MODEL. */
const GEMINI_DEFAULT_MODEL = "gemini-3.6-flash";
const GEMINI_FALLBACK_MODEL = "gemini-3.1-flash-lite";

export function hasFreeAi(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function freeAiProvider(): "gemini" | "lovable" | "none" {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.LOVABLE_API_KEY) return "lovable";
  return "none";
}

/**
 * Drop-in replacement for `fetch(AI_URL, init)` on chat-completions calls.
 */
export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    // Paid fallback — keep the original request as-is.
    return fetch(url, init);
  }

  let body: any = {};
  try {
    body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  } catch {
    body = {};
  }

  const primary = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;

  const send = async (model: string) => {
    const payload: any = { ...body, model };
    // Gemini 3.x (thinking models) reject these OpenAI-only knobs with a 400.
    delete payload.service_tier;
    delete payload.reasoning_effort;
    delete payload.temperature;
    delete payload.top_p;
    delete payload.presence_penalty;
    delete payload.frequency_penalty;
    return fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${geminiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  let res = await send(primary);

  // Free-tier per-model rate limit → try the lighter free model before paying.
  if (res.status === 429 && primary !== GEMINI_FALLBACK_MODEL) {
    console.warn("[ai-free] gemini rate limited, trying", GEMINI_FALLBACK_MODEL);
    res = await send(GEMINI_FALLBACK_MODEL);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[ai-free] gemini failed", res.status, text.slice(0, 300));
    // Free quota exhausted / transient error → fall back to the paid gateway so
    // the bot still answers instead of going silent.
    if (process.env.LOVABLE_API_KEY) return fetch(url, init);
    return new Response(text || "gemini error", { status: res.status });
  }

  return res;
}

