const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const PROMPT = `You are an OCR engine for Bangladeshi mobile recharge / minute / internet scratch cards.
From the image, extract ONLY the secret recharge code(s) — the long digit sequence (usually 12-16 digits, sometimes grouped or hyphenated) that is scratched off.
Rules:
- Return strict JSON: {"codes":["...","..."]}
- Keep digits only for each code (strip spaces and dashes).
- Ignore serial numbers, phone helpline numbers, amounts, dates and any other text.
- If nothing readable, return {"codes":[]}.`;

export async function extractCardCodes(imageDataUrl: string): Promise<string[]> {
  const key = process.env["GEMINI_API_KEY"] || process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service is not configured");

  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Scan failed (${res.status}): ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as any;
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  let codes: string[] = [];
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed?.codes)) codes = parsed.codes.map((c: unknown) => String(c));
    } catch {
      codes = [];
    }
  }
  if (codes.length === 0) {
    codes = (text.match(/\d[\d\s-]{9,}\d/g) ?? []).map((c) => c);
  }

  return Array.from(
    new Set(
      codes
        .map((c) => c.replace(/[^0-9A-Za-z]/g, ""))
        .filter((c) => c.length >= 10 && c.length <= 24),
    ),
  );
}
