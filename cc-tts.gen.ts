import { freeKeyPool } from "./src/lib/ai-free.server";
const keys = await freeKeyPool();
for (let i = 0; i < keys.length; i++) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": keys[i].key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Read aloud: আসসালামু আলাইকুম" }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Achernar" } } } },
    }),
    signal: AbortSignal.timeout(25000),
  });
  const body = await res.text();
  console.log(`key[${i}] status:`, res.status, res.ok ? "OK audio" : body.slice(0, 150));
}
