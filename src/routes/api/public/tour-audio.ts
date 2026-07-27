// Public endpoint — no auth needed so the signup/login page can use it too.
// Safe because we only generate TTS for keys in the NARRATIONS whitelist;
// attackers cannot spend credits by sending arbitrary text.
// Result MP3 is stored in Supabase (bucket: tour-audio), so first call for
// any given key spends TTS credits; every subsequent call on any browser/device
// just returns a signed URL to the cached file (0 credits).
import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "crypto";
import { NARRATIONS, isNarrationKey } from "@/lib/narrations";

const BUCKET = "tour-audio";
const VOICE = "ash";
const FALLBACK_VOICE = "onyx";
const MODEL = "openai/gpt-4o-mini-tts";
const SPEED = 1.15;
const CACHE_VERSION = "v12-good-app-rename";
const SIGN_TTL = 60 * 60 * 24 * 365;
const TTS_INSTRUCTIONS =
  "Speak ONLY in natural Dhakai/Bangladeshi Bangla (bn-BD). Persona: a real, warm, smiling, joyful young Bangladeshi bhaiya guiding a close friend — like a helpful older brother, not a news anchor, not a robot. Always smile audibly, keep pitch lively with natural rise-and-fall, sound excited and encouraging. Voice must be clearly loud and confident, never soft, ghostly, sleepy, flat, or monotone. When the text names a specific button/label, say that exact wording — never replace with generic 'এই বাটন' / 'ওই বাটন'. Keep it short, conversational, human. Pronounce: স্বাগতম = shago-tom, সাক্ষী = shakkhi, গুড-অ্যাপ = good-app, ভেরিফাই = ve-ri-fai, জমা দিন = joma din, UID = ইউ-আই-ডি.";

export const Route = createFileRoute("/api/public/tour-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
        const key = String(body?.key ?? "");
        if (!isNarrationKey(key)) return json({ error: "unknown key" }, 400);
        const text = NARRATIONS[key];
        // Include voice + speed + persona version in hash so any tweak to
        // voice / speed / instructions automatically invalidates the cache.
        const hash = createHash("sha256")
          .update(`${VOICE}|${SPEED}|${CACHE_VERSION}|${TTS_INSTRUCTIONS}|${text}`)
          .digest("hex");
        const path = `cache/${hash}.mp3`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: list } = await supabaseAdmin.storage
          .from(BUCKET)
          .list("cache", { search: `${hash}.mp3`, limit: 1 });
        if (!list || list.length === 0) {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return json({ error: "missing LOVABLE_API_KEY" }, 500);
          const requestBody = {
            model: MODEL, input: text, voice: VOICE, response_format: "mp3",
            stream_format: "audio",
            speed: SPEED,
            instructions: TTS_INSTRUCTIONS,
          };
          let res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          });
          if (res.status === 400) {
            res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ ...requestBody, voice: FALLBACK_VOICE }),
            });
          }
          if (!res.ok) {
            const errTxt = await res.text().catch(() => "");
            if (res.status === 402) return json({ error: "credits শেষ" }, 402);
            if (res.status === 429) return json({ error: "rate limited" }, 429);
            return json({ error: `tts ${res.status} ${errTxt.slice(0, 200)}` }, 500);
          }
          const audioBuf = new Uint8Array(await res.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from(BUCKET).upload(path, audioBuf, { contentType: "audio/mpeg", upsert: true });
          if (upErr) return json({ error: `upload ${upErr.message}` }, 500);
        }
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(BUCKET).createSignedUrl(path, SIGN_TTL);
        if (signErr || !signed?.signedUrl) return json({ error: signErr?.message || "sign failed" }, 500);
        return json({ url: signed.signedUrl, cached: !!(list && list.length > 0) });
      },
      OPTIONS: async () => new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }),
    },
  },
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
