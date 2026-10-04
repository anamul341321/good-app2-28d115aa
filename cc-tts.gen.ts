import { freeKeyPool } from "./src/lib/ai-free.server";
const keys = await freeKeyPool();
console.log("keys available:", keys.length);
if (keys.length) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent", {
    method: "POST",
    headers: { "x-goog-api-key": keys[0].key, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Say: আসসালামু আলাইকুম" }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Achernar" } } } },
    }),
    signal: AbortSignal.timeout(20000),
  });
  console.log("status:", res.status);
  console.log("body:", (await res.text()).slice(0, 400));
}
