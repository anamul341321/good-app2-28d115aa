/**
 * Free Bengali speech understanding for the Telegram bot.
 *
 * Telegram voice notes are OGG/Opus, which the OpenAI-compatible endpoints
 * reject — that's why voice messages often came back as "বুঝতে পারিনি". Gemini's
 * native generateContent accepts OGG inline audio directly, so we send the clip
 * to the same free rotating key pool used by the text/voice layers.
 */

// Use models that are broadly available to Google AI Studio keys. An
// unavailable preview/model used to return 403 and was incorrectly shown in
// the admin panel as a bad key, even though the same key still handled text.
const MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];
const REQUEST_TIMEOUT_MS = 13_000;

function mimeFor(ext: string): string {
  const f = String(ext || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (f === "mp3" || f === "mpeg" || f === "mpga") return "audio/mp3";
  if (f === "wav") return "audio/wav";
  if (f === "m4a" || f === "mp4") return "audio/mp4";
  if (f === "webm") return "audio/webm";
  if (f === "aac") return "audio/aac";
  if (f === "flac") return "audio/flac";
  return "audio/ogg";
}

const PROMPT =
  "You are an expert Bengali (Bangladeshi) listener for a support bot, trained on noisy low-quality phone voice notes. " +
  "Listen to this voice note VERY carefully, several times if needed, and write in Bengali exactly what the speaker is saying or asking. " +
  "The audio may be muffled, low volume, clipped, fast, slurred or half-whispered; the speaker may mumble, use dialect " +
  "(Noakhali/Sylheti/Chittagong/Barishal), mix Bangla with Roman Bangla and English words, and there may be fan/traffic/TV noise or other voices. " +
  "Never refuse and never say you cannot hear: reconstruct the most likely full sentence from whatever sounds are audible, " +
  "fixing obvious mishearings so the sentence makes sense for a mobile earning app support chat. " +
  "Domain words to expect: Good-App, UID, slot, face verify, re-verify, whitelist, withdraw, payment, bKash, Nagad, recharge, mining, refer, bonus, fee, reset, password, Gmail, KYC. " +
  "Only report what is in THIS audio — never guess from older chat. " +
  "Output just the sentence(s)/question in Bengali, no explanation, no quotes, no timestamps. " +
  "Output EMPTY only if there is absolutely no human voice at all (pure silence or pure noise).";


/** Transcribe a Telegram voice clip using the free Gemini key pool. */
export async function hearBengali(
  base64: string,
  ext: string,
  hint?: string,
): Promise<string | null> {
  if (!base64 || base64.length < 400) return null;
  const { freeKeyPool } = await import("./ai-free.server");
  const keys = await freeKeyPool();
  if (!keys.length) return null;

  const hintBlock = hint?.trim()
    ? "\nContext of the conversation (use it ONLY to resolve unclear words, never to invent content):\n" +
      hint.trim().slice(0, 700)
    : "";


  const makeBody = (prompt: string) => ({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt + hintBlock },
          { inline_data: { mime_type: mimeFor(ext), data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
  });

  const attempt = (key: string, model: string, prompt: string) => async () => {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify(makeBody(prompt)),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      throw new Error("stt-network-failed");
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      // Voice/audio availability and quota are separate from text quota.
      // Never write these transient failures into the shared key status.
      if (res.status !== 429 && res.status !== 403) {
        console.error("[stt] failed", model, res.status, txt.slice(0, 200));
      }
      throw new Error(`stt-${res.status}`);
    }
    const json: any = await res.json().catch(() => null);
    const text = String(
      (json?.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => p?.text ?? "")
        .join(" ") ?? "",
    ).trim();
    if (!text || /^EMPTY$/i.test(text)) throw new Error("stt-empty");
    return text.replace(/^["'“”]+|["'“”]+$/g, "").trim();
  };

  // ধাপে ধাপে চেষ্টা — একসাথে সব কী ছুড়লে ফ্রি কোটা দ্রুত শেষ হয়ে যায়।
  const makers = MODELS.flatMap((model) =>
    keys.slice(0, 3).map((k) => attempt(k.key, model, PROMPT)),
  );
  const { staggerAny } = await import("./ai-free.server");
  try {
    return await staggerAny(makers, 3_500);
  } catch {
    /* প্রথম রাউন্ডে কিছু বোঝা যায়নি → নিচে "জোর করে বোঝার" শেষ চেষ্টা */
  }

  // লড়বড়া/খুব আস্তে বলা ভয়েসের জন্য শেষ চেষ্টা: হার মানা নিষেধ।
  const RESCUE =
    PROMPT +
    "\nThis audio is hard to hear. Do NOT output EMPTY unless it is pure silence. " +
    "Boost your attention on the loudest syllables, guess the most plausible Bengali support question " +
    "(e.g. about slot verify, re-verify, withdraw timing, bonus, mining, password) and write that single sentence.";
  try {
    return await staggerAny(
      keys.slice(0, 2).map((k) => attempt(k.key, MODELS[0], RESCUE)),
      3_000,
    );
  } catch {
    return null;
  }
}

}

