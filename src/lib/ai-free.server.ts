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

/**
 * Free-tier friendly Gemini models; override the primary with GEMINI_MODEL.
 * The pinned `gemini-2.5-*` ids now 404 ("no longer available to new users"),
 * so we use the always-current aliases instead.
 */
const GEMINI_DEFAULT_MODEL = "gemini-flash-latest";
const GEMINI_FALLBACK_MODEL = "gemini-flash-lite-latest";
const AI_REQUEST_TIMEOUT_MS = 9_000;

/**
 * All free Gemini keys: the ones the admin saved in the admin panel (unlimited
 * many, DB-backed) plus GEMINI_API_KEY / GEMINI_API_KEY_2..9 / GEMINI_API_KEYS
 * from the environment. More keys = more free quota per day; when one key hits
 * its limit the next one is used automatically.
 */
function envKeys(): string[] {
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

type PoolKey = { id: string | null; key: string };

async function allKeys(): Promise<PoolKey[]> {
  const out: PoolKey[] = [];
  try {
    const { usableDbKeys } = await import("./ai-keys.server");
    for (const k of await usableDbKeys()) {
      if (!out.some((o) => o.key === k.key)) out.push({ id: k.id, key: k.key });
    }
  } catch {
    /* DB unavailable → env keys only */
  }
  for (const k of envKeys()) {
    if (!out.some((o) => o.key === k)) out.push({ id: null, key: k });
  }
  return out;
}

/**
 * চেষ্টাগুলো একসাথে না ছুড়ে ধাপে ধাপে (stagger) চালায় — প্রথমটা দেরি করলে
 * পরেরটা যোগ হয়, যেটা আগে সফল হয় সেটাই ফেরে। এতে ফ্রি কোটা অনেক কম খরচ হয়।
 */
export function staggerAny<T>(makers: (() => Promise<T>)[], stepMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!makers.length) return reject(new Error("no-attempts"));
    let launched = 0;
    let pending = 0;
    let done = false;
    let lastErr: unknown = new Error("all-attempts-failed");
    const launch = () => {
      if (done || launched >= makers.length) return;
      const maker = makers[launched++];
      pending++;
      if (launched < makers.length) setTimeout(() => launch(), stepMs);
      maker().then(
        (v) => {
          if (!done) {
            done = true;
            resolve(v);
          }
        },
        (e) => {
          lastErr = e;
          pending--;
          if (done) return;
          if (launched < makers.length) launch();
          else if (pending === 0) reject(lastErr);
        },
      );
    };
    launch();
  });
}

/** Shared key pool (DB keys first, then env keys) — used by the voice layer too. */
export async function freeKeyPool(): Promise<PoolKey[]> {
  return allKeys();
}


export async function freeAiKeyCount(): Promise<number> {
  return (await allKeys()).length;
}

export async function hasFreeAi(): Promise<boolean> {
  return (await allKeys()).length > 0;
}

export async function freeAiProvider(): Promise<"gemini" | "lovable" | "none"> {
  if ((await allKeys()).length) return "gemini";
  if (process.env.LOVABLE_API_KEY) return "lovable";
  return "none";
}

/**
 * Drop-in replacement for `fetch(AI_URL, init)` on chat-completions calls.
 * Tries every free key × free model before ever touching the paid gateway.
 */
export async function aiFetch(url: string, init: RequestInit): Promise<Response> {
  const keys = await allKeys();
  // One deadline for the whole key/model rotation. A fresh timeout per key
  // multiplied latency and could outlive the Telegram webhook request.
  const requestDeadline = AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS);
  const requestSignal = init.signal
    ? AbortSignal.any([init.signal, requestDeadline])
    : requestDeadline;
  if (!keys.length) {
    // Paid fallback — keep the original request as-is.
    return fetch(url, { ...init, signal: requestSignal });
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
      signal: requestSignal,
    });
  };

  let lastStatus = 0;
  let lastText = "";

  // কী-র ফ্রি কোটা বাঁচাতে সব কী একসাথে ছুড়ি না (আগে ১টা প্রশ্নে ৪-৮টা কল
  // যেত, তাই ৭ বার ব্যবহারেই লিমিট শেষ দেখাতো)। প্রথমটা দিয়েই শুরু, দেরি হলে
  // পরেরটা যোগ হয় — যেটা আগে উত্তর দেয় সেটাই যায়।
  const makers: (() => Promise<Response>)[] = [];
  for (const model of models) {
    for (const k of keys.slice(0, 4)) {
      makers.push(async () => {
        let res: Response;
        try {
          res = await send(k.key, model);
        } catch (e) {
          lastStatus = 0;
          lastText = String(e);
          throw e;
        }
        if (res.ok) {
          if (k.id) {
            const { markKeyUsed } = await import("./ai-keys.server");
            void markKeyUsed(k.id);
          }
          return res;
        }
        lastStatus = res.status;
        lastText = await res.text().catch(() => "");
        if (k.id && (res.status === 429 || res.status === 403)) {
          const mod = await import("./ai-keys.server");
          if (res.status === 429)
            void mod.markKeyExhausted(k.id, "আজকের ফ্রি লিমিট শেষ — ১ ঘণ্টা পর আবার চেষ্টা হবে");
          else void mod.markKeyError(k.id, "এই মডেলে এই কী-র অনুমতি নেই");
        }
        throw new Error(`gemini-${res.status}`);
      });
    }
  }

  try {
    return await staggerAny(makers, 2_200);
  } catch {
    /* every free attempt failed → paid gateway below */
  }


  console.error("[ai-free] all free keys failed", lastStatus, lastText.slice(0, 300));
  // ফ্রি কোটা শেষ হলে বট আর পেইড গেটওয়েতে যাবে না (ক্রেডিট খরচ হবে না)।
  // তখন সে শুধু সেট করা প্রশ্নগুলোর উত্তর দেবে, অজানা প্রশ্নে চুপ থাকবে।
  // দরকার হলে BOT_ALLOW_PAID=on দিলে পেইড ফলব্যাক আবার চালু হবে।
  const allowPaid = String(process.env.BOT_ALLOW_PAID ?? "").trim().toLowerCase();
  if ((allowPaid === "on" || allowPaid === "1" || allowPaid === "true") && process.env.LOVABLE_API_KEY) {
    return fetch(url, {
      ...init,
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
    });
  }
  return new Response(lastText || "gemini error", { status: lastStatus || 502 });
}





/**
 * শেষ AI কলে সব ফ্রি কী ব্যর্থ/কোটা-শেষ হয়েছিল কি না। কোটা শেষ থাকলে বট
 * অজানা প্রশ্নে অ্যাডমিনকে মেনশন না করে চুপ থাকে (শুধু সেট করা উত্তরগুলো দেয়)।
 */
let aiOutOfQuotaAt = 0;

export function markAiOutOfQuota() {
  aiOutOfQuotaAt = Date.now();
}

export function aiOutOfQuota(): boolean {
  return Date.now() - aiOutOfQuotaAt < 10 * 60_000;
}
