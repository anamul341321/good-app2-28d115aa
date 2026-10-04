import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const BASE_RULES = `তুমি "গুড অ্যাপ" কাস্টমার কেয়ারের একজন আসল মানুষের মতো ভদ্র, হাসিখুশি মহিলা প্রতিনিধি। ফোনে কথা বলছ, তাই একদম স্বাভাবিক কথ্য শুদ্ধ বাংলায়, ছোট ২-৩ বাক্যে উত্তর দেবে — যেন মানুষ কথা বলছে, রোবট নয়। কোনো ইমোজি, লিংক, তালিকা, চিহ্ন ব্যবহার করবে না। "আপনি" বলে সম্বোধন করবে।
কঠোর নিয়ম:
- শুধু নিচের নিয়মবই আর গ্রাহকের অ্যাকাউন্ট তথ্য থেকে উত্তর দেবে। এর বাইরে কিছু বানিয়ে বলবে না, অনুমান করবে না।
- উত্তর জানা না থাকলে সোজা বলবে "এই বিষয়টি আমি নিশ্চিত নই, মেনুতে ফিরে শূন্য চাপলে আমাদের প্রতিনিধি আপনাকে সাহায্য করবেন।"
- অ্যাপের নাম সবসময় "গুড অ্যাপ"। "হোয়াইটলিস্ট" না বলে "ভেরিফাই" বলবে।
- গ্রাহক যা জিজ্ঞেস করেছেন ঠিক সেটারই উত্তর দেবে, অপ্রাসঙ্গিক কথা বলবে না।
- উত্তর শেষে প্রয়োজন হলে ছোট করে জিজ্ঞেস করবে "আর কিছু জানতে চান?"`;

function clean(s: string) {
  return s.replace(/<[^>]+>/g, " ").replace(/[*#_`>•]/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/\s+/g, " ").trim();
}

async function callerContext(): Promise<string> {
  try {
    const auth = getRequestHeader("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return "গ্রাহক লগইন করা নেই, তাই তার অ্যাকাউন্টের তথ্য নেই।";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u } = await supabaseAdmin.auth.getUser(token);
    if (!u?.user) return "গ্রাহক লগইন করা নেই।";
    const { data: p } = await supabaseAdmin.from("profiles").select("uid_seq").eq("id", u.user.id).maybeSingle();
    const uid = (p as any)?.uid_seq;
    if (!uid) return "গ্রাহকের অ্যাকাউন্ট পাওয়া যায়নি।";
    const { buildUserCard } = await import("./telegram-lookup.server");
    const card = await buildUserCard(String(uid));
    return card.found ? `এই গ্রাহকের (নিজের) অ্যাকাউন্টের বর্তমান তথ্য:\n${clean(card.card)}` : "অ্যাকাউন্ট তথ্য পাওয়া যায়নি।";
  } catch (e) {
    console.error("callcenter ctx", e);
    return "অ্যাকাউন্ট তথ্য এই মুহূর্তে আনা যায়নি।";
  }
}

async function rulebook(): Promise<string> {
  try {
    const { loadRates } = await import("./telegram-knowledge.server");
    const { appRulebook } = await import("./telegram-app-rules.server");
    return clean(appRulebook(await loadRates()));
  } catch {
    return "";
  }
}

async function speak(key: string, text: string): Promise<string | null> {
  try {
    const t = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-tts-preview",
        stream_format: "audio",
        contents: [{ parts: [{ text: `একজন হাসিখুশি, উষ্ণ বাংলাদেশি কাস্টমার কেয়ার প্রতিনিধির মতো স্বাভাবিক গতিতে, আন্তরিকভাবে বলুন: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Achernar" } } },
        },
      }),
    });
    if (!t.ok) { console.error("cc tts", t.status, (await t.text()).slice(0, 200)); return null; }
    return Buffer.from(await t.arrayBuffer()).toString("base64");
  } catch { return null; }
}

/** কল ধরার সাথে সাথে সালাম দিয়ে শুভেচ্ছা (ভয়েস সহ)। */
export const greetCallCenterAi = createServerFn({ method: "POST" }).handler(async () => {
  const key = process.env["LOVABLE_API_KEY"];
  const text = "আসসালামু আলাইকুম! গুড অ্যাপ কাস্টমার কেয়ারে আপনাকে স্বাগতম। বলুন, আমি আপনাকে কীভাবে সাহায্য করতে পারি?";
  return { text, audio: key ? await speak(key, text) : null, mime: "audio/wav" };
});

export const askCallCenterAi = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      question: z.string().trim().min(1).max(400),
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(800) })).max(8).default([]),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("এ আই এখন চালু নেই");
    const [ctx, rules] = await Promise.all([callerContext(), rulebook()]);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: `${BASE_RULES}\n\nগুড অ্যাপের নিয়মবই:\n${rules}\n\n${ctx}`,
        input: [...data.history, { role: "user", content: data.question }],
      }),
    });
    if (!res.ok || !res.body) {
      console.error("callcenter ai failed", res.status, await res.text().catch(() => ""));
      throw new Error(res.status === 402 ? "এ আই সেবা সাময়িক বন্ধ" : "দুঃখিত, এই মুহূর্তে উত্তর দেওয়া যাচ্ছে না");
    }
    let out = "";
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(l.slice(5).trim());
          if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        } catch { /* partial */ }
      }
    }
    const text = clean(out) || "দুঃখিত, বিষয়টি বুঝতে পারিনি। অনুগ্রহ করে আরেকবার বলুন।";
    return { text, audio: await speak(key, text), mime: "audio/wav" };
  });
