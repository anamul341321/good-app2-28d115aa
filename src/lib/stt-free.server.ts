/**
 * Free Bengali speech understanding for the Telegram bot.
 *
 * Telegram voice notes are OGG/Opus, which the OpenAI-compatible endpoints
 * reject — that's why voice messages often came back as "বুঝতে পারিনি". Gemini's
 * native generateContent accepts OGG inline audio directly, so we send the clip
 * to the same free rotating key pool used by the text/voice layers.
 */

const MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

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
  "You are an expert Bengali (Bangladeshi) listener for a support bot. " +
  "Listen to this voice note very carefully and write, in Bengali, exactly what the speaker is saying or asking. " +
  "The speaker may mumble, speak fast, use dialect (Noakhali/Sylheti/Chittagong), mix Bangla with Roman Bangla and English words, " +
  "and there may be background noise — still do your best to reconstruct the most likely meaning instead of giving up. " +
  "Domain words to expect: Good-App, UID, slot, face verify, re-verify, whitelist, withdraw, bKash, Nagad, recharge, mining, refer, bonus, fee, reset, password, Gmail, KYC. " +
  "Only report what is in THIS audio — never guess from older chat. " +
  "Output just the sentence(s)/question, no explanation, no quotes. " +
  "If the audio is truly empty or has no speech at all, output exactly: EMPTY";

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


  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT + hintBlock },
          { inline_data: { mime_type: mimeFor(ext), data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
  };

  for (const model of MODELS) {
    for (const k of keys) {
      let res: Response;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "x-goog-api-key": k.key, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      } catch {
        continue;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        if (res.status === 429 || res.status === 403) {
          if (k.id) {
            const mod = await import("./ai-keys.server");
            void mod.markKeyError(
              k.id,
              res.status === 429
                ? "ভয়েস শোনার লিমিট শেষ (লেখা ঠিকই চলবে)"
                : "এই কী-তে ভয়েস মডেল চালু নেই (লেখা ঠিকই চলবে)",
            );
          }
          continue;
        }
        console.error("[stt] failed", model, res.status, txt.slice(0, 200));
        break;
      }
      const json: any = await res.json().catch(() => null);
      const text = String(
        (json?.candidates?.[0]?.content?.parts ?? [])
          .map((p: any) => p?.text ?? "")
          .join(" ") ?? "",
      ).trim();
      if (!text || /^EMPTY$/i.test(text)) return null;
      return text.replace(/^["'“”]+|["'“”]+$/g, "").trim();
    }
  }
  return null;
}
