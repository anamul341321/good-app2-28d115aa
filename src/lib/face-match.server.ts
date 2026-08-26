// Server-only: call Lovable AI Gateway (Gemini) to compare a captured selfie
// against one or more reference photos. Ported from the Good-App reference
// face-match edge function — same prompts, same thresholds.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

export const DUPLICATE_THRESHOLD = 0.92;
export const REVERIFY_THRESHOLD = 0.85;

type RefPhoto = { id: string; base64: string };

function extractJsonObject(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function callAi(content: any[], model: string = MODEL): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("AI rate limited — kichukhon por chesta korun");
    if (resp.status === 402) throw new Error("AI credit shesh — admin er sathe jogajog korun");
    throw new Error(`AI gateway error: ${resp.status} ${text.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function checkDuplicate(
  capturedBase64: string,
  references: RefPhoto[],
): Promise<{ isDuplicate: boolean; matchedId: string | null; confidence: number }> {
  if (references.length === 0) return { isDuplicate: false, matchedId: null, confidence: 0 };

  const prompt = `You are a strict biometric face duplicate detection system. I will show you a NEW selfie photo (labeled "NEW_FACE") and ${references.length} existing stored photos (labeled "EXISTING_1", "EXISTING_2", etc.).

Your task: Check if the NEW_FACE matches ANY existing photo by FACE IDENTITY ONLY.

CRITICAL RULES:
- IGNORE clothing, background, lighting, camera quality, pose, hairstyle, beard, glasses, accessories, age difference, image composition.
- Compare ONLY stable facial biometrics: eye spacing/shape, nose bridge/tip, mouth/lip shape, jaw/chin structure, cheekbones, face proportions, ears.
- DEFAULT to "not duplicate". Two different people often look superficially similar — that is NOT a match.
- Only return is_duplicate=true if you can identify multiple distinctive matching biometric features AND you would bet money it is the same human.
- If unsure, return is_duplicate=false. False positives wrongly block new honest users — that is the worst possible outcome.
- Use confidence >= 0.95 only when truly near-certain.

Existing photo IDs:
${references.map((r, i) => `EXISTING_${i + 1}: ID="${r.id}"`).join("\n")}

Respond with ONLY a JSON object:
- If a match is found: {"is_duplicate": true, "matched_id": "the-id-here", "confidence": 0.0 to 1.0}
- If no match: {"is_duplicate": false, "matched_id": null, "confidence": 0}`;

  const content: any[] = [
    { type: "text", text: prompt },
    { type: "text", text: "NEW_FACE photo:" },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${capturedBase64}` } },
  ];
  for (let i = 0; i < references.length; i++) {
    content.push({ type: "text", text: `EXISTING_${i + 1} (ID: ${references[i].id}):` });
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${references[i].base64}` } });
  }

  const text = await callAi(content);
  const parsed = extractJsonObject(text);
  let isDuplicate = !!parsed?.is_duplicate;
  const matchedId = parsed?.matched_id ?? null;
  const confidence = Number(parsed?.confidence) || 0;

  // Apply strict threshold to avoid blocking honest users
  if (isDuplicate && confidence < DUPLICATE_THRESHOLD) {
    isDuplicate = false;
  }
  return { isDuplicate, matchedId: isDuplicate ? matchedId : null, confidence };
}

export async function matchSingleReference(
  capturedBase64: string,
  reference: RefPhoto,
): Promise<{ matches: boolean; confidence: number }> {
  const prompt = `You are a strict biometric face matching system. I will show you a captured selfie (labeled "SELFIE") and one reference photo (labeled "REF").

Your task: Decide whether the SELFIE and the REF show the SAME human.

CRITICAL RULES:
- IGNORE clothing, background, lighting, camera angle, pose, hairstyle, beard growth/trim, glasses on/off, accessories, mild weight change, mild aging.
- Compare stable facial biometrics: eye spacing/shape, nose bridge/tip, mouth/lip shape, jaw/chin structure, cheekbones, face proportions, ears.
- Only return matches=true when you are highly confident from multiple stable facial features.
- If there is any real doubt, return matches=false. A false positive is dangerous.

Respond with ONLY a JSON object like {"matches": true, "confidence": 0.0 to 1.0} or {"matches": false, "confidence": 0.0 to 1.0}. No other text.`;

  const content: any[] = [
    { type: "text", text: prompt },
    { type: "text", text: "SELFIE photo:" },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${capturedBase64}` } },
    { type: "text", text: "REF photo:" },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${reference.base64}` } },
  ];

  const text = await callAi(content);
  const parsed = extractJsonObject(text);
  const matches = !!parsed?.matches;
  const confidence = Number(parsed?.confidence) || 0;
  return { matches: matches && confidence >= REVERIFY_THRESHOLD, confidence };
}
