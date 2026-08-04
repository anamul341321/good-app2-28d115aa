/**
 * Free Bengali voice for the Telegram bot.
 *
 * Uses Gemini TTS (Google AI Studio free tier) with the same rotating key pool
 * as the text AI, so voice replies cost no Lovable credits. The model returns
 * raw 24kHz mono PCM; we wrap it in a WAV header and hand it to Telegram's
 * sendVoice (Telegram transcodes it into a normal voice bubble).
 *
 * Generated clips are cached in the `tg-voice` storage bucket keyed by the text
 * hash, so the same sentence is never generated (or billed against the free
 * quota) twice.
 */

const TTS_MODELS = [
  "gemini-2.5-flash-preview-tts",
  "gemini-3.1-flash-tts-preview",
  "gemini-2.5-pro-preview-tts",
];

/**
 * সবচেয়ে মিষ্টি ও হাসিখুশি বাংলা মেয়ে-কণ্ঠ। Achernar সবচেয়ে কোমল/মিষ্টি,
 * Leda তরুণ ও চঞ্চল, Aoede হালকা-হাওয়ার মতো, Sulafat উষ্ণ।
 */
const FEMALE_VOICES = ["Achernar", "Leda", "Sulafat", "Aoede", "Kore"];

function pickVoice(): string {
  const forced = process.env.GEMINI_TTS_VOICE?.trim();
  if (forced) return forced;
  return FEMALE_VOICES[0];
}


/** Strip HTML/markdown/links so the voice reads clean Bengali sentences. */
export function voiceScript(html: string): string {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "and")
    .replace(/&lt;|&gt;/g, " ")
    .replace(/https?:\/\/\S+/g, " লিংকটি নিচে লেখা আছে ")
    .replace(/[*_`#>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function wavFromPcm(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function cacheGet(key: string): Promise<Uint8Array | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage.from("tg-voice").download(`tts/${key}.wav`);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  } catch {
    return null;
  }
}

async function cachePut(key: string, bytes: Uint8Array): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from("tg-voice")
      .upload(`tts/${key}.wav`, new Blob([bytes as unknown as BlobPart], { type: "audio/wav" }), {
        upsert: true,
        contentType: "audio/wav",
      });
  } catch {
    /* caching is best-effort */
  }
}

/**
 * Speak a Bengali reply. Returns WAV bytes, or null when no free key is
 * available / every key is out of quota (the bot then just sends text).
 */
export async function speakBengali(rawText: string): Promise<Uint8Array | null> {
  const script = voiceScript(rawText);
  if (script.length < 4) return null;
  // Keep clips short so generation stays fast and quota-friendly.
  const text = script.length > 700 ? `${script.slice(0, 700)}…` : script;

  const voice = pickVoice();
  const cacheKey = await sha(`${voice}|${text}`);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { freeKeyPool } = await import("./ai-free.server");
  const keys = await freeKeyPool();
  if (!keys.length) return null;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            // The directive must be in English; a Bengali instruction makes the
            // TTS model try to answer instead of read ("should only be used for TTS").
            text:
              "Read this out loud as a sweet, cheerful, smiling young Bangladeshi girl talking to a friend: " +
              "warm and affectionate tone, gentle sing-song Bengali intonation, a soft happy smile in the voice, " +
              "clear pronunciation, natural relaxed pace, never robotic or flat. " +
              `Text: ${text}`,
          },

        ],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
    },
  };

  for (const model of TTS_MODELS) {
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
            const { markKeyExhausted } = await import("./ai-keys.server");
            void markKeyExhausted(k.id, `tts ${res.status}: ${txt.slice(0, 160)}`);
          }
          continue; // quota → next key
        }
        console.error("[tts] failed", model, res.status, txt.slice(0, 200));
        break; // model/request problem → try next model
      }
      const json: any = await res.json().catch(() => null);
      const b64 = json?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data)
        ?.inlineData?.data;
      if (!b64) break;
      const wav = wavFromPcm(b64ToBytes(b64));
      void cachePut(cacheKey, wav);
      return wav;
    }
  }
  return null;
}
