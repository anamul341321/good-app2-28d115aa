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
 * ভদ্র, স্পষ্ট ও হাসিমুখে বলা বাংলা মেয়ে-কণ্ঠ (অতিরিক্ত আদুরে নয়)।
 * Sulafat উষ্ণ ও স্পষ্ট, Kore শান্ত-পরিষ্কার, Aoede হালকা।
 */
const FEMALE_VOICES = ["Achernar", "Sulafat", "Leda", "Aoede", "Kore"];

function pickVoice(): string {
  const forced = process.env.GEMINI_TTS_VOICE?.trim();
  if (forced) return forced;
  return FEMALE_VOICES[0]; // Achernar — উজ্জ্বল, হাসিখুশি ও জীবন্ত কণ্ঠ
}


/** সংক্ষেপ/ইংরেজি শব্দ ভয়েসের জন্য পুরো উচ্চারণে লিখে দেয়। */
function expandForSpeech(s: string): string {
  return s
    .replace(/\bM(?:d|D)\.?\b/g, "মোহাম্মদ")
    .replace(/\bমোঃ|\bমো\./g, "মোহাম্মদ")
    .replace(/\bMohd\.?\b/gi, "মোহাম্মদ")
    .replace(/\bUID\b/gi, "ইউ আই ডি")
    .replace(/\bKYC\b/gi, "কে ওয়াই সি")
    .replace(/\bOTP\b/gi, "ও টি পি")
    .replace(/\bUSDT\b/gi, "ইউ এস ডি টি")
    .replace(/\bID\b/g, "আইডি")
    .replace(/\bTk\.?\b/gi, "টাকা")
    .replace(/\bBDT\b/gi, "টাকা")
    .replace(/৳/g, " টাকা ")
    .replace(/\bAI\b/g, "এ আই")
    .replace(/স্যার/g, "ভাইয়া");
}

/** Strip HTML/markdown/links/emoji so the voice reads clean Bengali sentences. */
export function voiceScript(html: string): string {
  return expandForSpeech(
    String(html || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "and")
      .replace(/&lt;|&gt;/g, " ")
      .replace(/https?:\/\/\S+/g, " লিংকটি নিচে লেখা আছে ")
      // Emoji/pictographs make the TTS model say their names out loud
      // ("💙" → "ভালোবাসা"), so remove them before speaking.
      .replace(
        /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{1F1E6}-\u{1F1FF}\u2190-\u21FF\u2022\u25A0-\u25FF]/gu,
        " ",
      )
      .replace(/[*_`#>]+/g, " "),
  )
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

/** Split a long Bengali script into speakable chunks at sentence boundaries. */
function chunkScript(text: string, max = 550): string[] {
  const parts = text.match(/[^।!?\n]+[।!?\n]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  const flush = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = "";
  };
  for (const p of parts) {
    if (p.length > max) {
      flush();
      for (let i = 0; i < p.length; i += max) out.push(p.slice(i, i + max).trim());
      continue;
    }
    if (cur.length + p.length > max) flush();
    cur += p;
  }
  flush();
  return out.filter(Boolean);
}

const TTS_DIRECTIVE =
  // The directive must be in English; a Bengali instruction makes the
  // TTS model try to answer instead of read ("should only be used for TTS").
  "Read the following Bengali text aloud as a warm, cheerful, friendly young Bangladeshi woman " +
  "helping an elder brother. Speak naturally and expressively with a clear smile in your voice — " +
  "lively, sweet and caring, with natural ups and downs, small pauses and real emotion, like a " +
  "helpful sister chatting happily, NOT like someone reading a script or a robot. Keep it clear " +
  "and easy to follow at a normal comfortable pace, never flat, never monotone, never dull. " +
  "Read the WHOLE text to the very end, never stop early, never summarise, never skip anything. " +
  "Pronounce every Bengali word, name and number fully and distinctly. " +
  "Do not read out symbols or emoji names. ";

/** Generate raw PCM for one chunk. Returns null when every key/model failed. */
async function pcmForChunk(
  text: string,
  voice: string,
  keys: { id?: string; key: string }[],
): Promise<Uint8Array | null> {
  const body = {
    contents: [{ role: "user", parts: [{ text: `${TTS_DIRECTIVE}Text: ${text}` }] }],
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
      return b64ToBytes(b64);
    }
  }
  return null;
}

/**
 * Speak a Bengali reply. The script is split into sentence-sized chunks and the
 * returned PCM is stitched together, so long replies are spoken in full instead
 * of cutting off mid-sentence. Returns WAV bytes, or null when no free key is
 * available / every key is out of quota (the bot then just sends text).
 */
export async function speakBengali(rawText: string): Promise<Uint8Array | null> {
  const script = voiceScript(rawText);
  if (script.length < 4) return null;
  // Hard safety cap so one reply can never burn the whole free quota.
  const text = script.length > 3000 ? `${script.slice(0, 3000)}…` : script;

  const voice = pickVoice();
  const cacheKey = await sha(`v2|${voice}|${text}`);
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { freeKeyPool } = await import("./ai-free.server");
  const keys = await freeKeyPool();
  if (!keys.length) return null;

  const chunks = chunkScript(text);
  const pcms: Uint8Array[] = [];
  for (const chunk of chunks) {
    const pcm = await pcmForChunk(chunk, voice, keys);
    if (!pcm) break; // quota/model gave up — send what we already have
    pcms.push(pcm);
  }
  if (!pcms.length) return null;

  const total = pcms.reduce((n, p) => n + p.length, 0);
  const joined = new Uint8Array(total);
  let off = 0;
  for (const p of pcms) {
    joined.set(p, off);
    off += p.length;
  }
  const wav = wavFromPcm(joined);
  void cachePut(cacheKey, wav);
  return wav;
}

