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

/**
 * All free Gemini keys: GEMINI_API_KEY plus GEMINI_API_KEY_2..GEMINI_API_KEY_9,
 * or a comma-separated GEMINI_API_KEYS. More keys = more free quota per day;
 * when one key hits its limit the next one is used automatically.
 */
function geminiKeys(): string[] {
  const out: string[] = [];
  const push = (v?: string | null) => {
    for (const part of String(v ?? "").split(",")) {
      const k = part.trim();
      if (k && !out.includes(k)) out.push(k);
    }
  };
  push(process.env.GEMINI_API_KEY);
  push(process.env.GEMINI_API_KEYS);
  for (let i = 2; i <= 9; i++) push(process.env[`GEMINI_API_KEY_${i}`]);
  return out;
}

export function freeAiKeyCount(): number {
  return geminiKeys().length;
}

export function hasFreeAi(): boolean {
  return geminiKeys().length > 0;
}

export function freeAiProvider(): "gemini" | "lovable" | "none" {
  if (geminiKeys().length) return "gemini";
  if (process.env.LOVABLE_API_KEY) return "lovable";
  return "none";
}

/**
 * Drop-in replacement for `fetch(AI_URL, init)` on chat-completions calls.
 * Tries every free key × free model before ever touching the paid gateway.
 */
export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  const keys = geminiKeys();
  if (!keys.length) {
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
  const models = primary === GEMINI_FALLBACK_MODEL ? [primary] : [primary, GEMINI_FALLBACK_MODEL];

  const send = async (key: string, model: string) => {
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
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  };

  let lastStatus = 0;
  let lastText = "";

  // Rotate: for each free model, walk through every key. A 429/403 means that
  // key's free quota is used up right now, so we simply move to the next one.
  for (const model of models) {
    for (const key of keys) {
      let res: Response;
      try {
        res = await send(key, model);
      } catch (e) {
        lastStatus = 0;
        lastText = String(e);
        continue;
      }
      if (res.ok) return res;
      lastStatus = res.status;
      lastText = await res.text().catch(() => "");
      if (res.status === 429 || res.status === 403) continue; // quota → next key
      break; // real request error — another key won't help
    }
  }

  console.error("[ai-free] all free keys failed", lastStatus, lastText.slice(0, 300));
  // Every free key is exhausted → paid gateway so the bot still answers.
  if (process.env.LOVABLE_API_KEY) return fetch(url, init);
  return new Response(lastText || "gemini error", { status: lastStatus || 502 });
}


