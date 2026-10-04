import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const SYSTEM = `তুমি "গুড অ্যাপ" কাস্টমার কেয়ারের ভদ্র, পেশাদার এ আই সহকারী। ফোন কলে কথা বলছ, তাই উত্তর হবে সহজ শুদ্ধ বাংলায়, সর্বোচ্চ ৩-৪ ছোট বাক্যে, কোনো ইমোজি/লিংক/চিহ্ন ছাড়া। গ্রাহককে "স্যার" বা "ম্যাডাম" না জেনে "আপনি" বলে সম্বোধন করো।
নিয়ম:
- মাইনিং: প্রতিদিন সন্ধ্যা ৬টা থেকে পরের দিন সন্ধ্যা ৬টা পর্যন্ত একবার ক্লেইম; ক্লেইম না করলে সেদিনের টাকা যোগ হয় না। শুধু ভেরিফাই করা স্লট থেকে মাইনিং হয়।
- ক্লেইম করা টাকা পেন্ডিং ব্যালেন্সে যায়; মাসের ১ তারিখে ভেরিফাই করা স্লটের টাকা মেইন ব্যালেন্সে যায়।
- মাইনিংয়ের টাকা উইথড্র: প্রতি মাসের ১ থেকে ৩ তারিখ রাত ১০টা পর্যন্ত, শুধু মেইন ব্যালেন্স থেকে, বিকাশ বা নগদে।
- রি-ভেরিফাই না করলে সেই স্লটের টাকা পেন্ডিংয়ে থাকে; টাস্ক সেকশন থেকে রি-ভেরিফাই করতে হয়।
- সেন্ড মানি, রিচার্জ, কার্ড কেনা শুধু মেইন ব্যালেন্স থেকে।
- অ্যাপের নাম সবসময় "গুড অ্যাপ" বলবে।
- নির্দিষ্ট অ্যাকাউন্টের তথ্য তুমি দেখতে পাও না; সেক্ষেত্রে বলো মেনুতে ফিরে ০ চেপে প্রতিনিধির সাথে কথা বলতে।
- না জানলে বানিয়ে বলবে না।`;

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
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: SYSTEM,
        input: [...data.history, { role: "user", content: data.question }],
      }),
    });
    if (!res.ok) {
      console.error("callcenter ai failed", res.status, await res.text());
      throw new Error("দুঃখিত, এই মুহূর্তে উত্তর দেওয়া যাচ্ছে না");
    }
    const j = (await res.json()) as any;
    const text: string = ((j.output ?? []).flatMap((o: any) => o.content ?? []).filter((c: any) => c.type === "output_text").map((c: any) => c.text).join(" ")).replace(/[*#_`>]/g, "").trim() ||
      "দুঃখিত, বিষয়টি বুঝতে পারিনি। অনুগ্রহ করে আবার বলুন।";
    let audio: string | null = null;
    try {
      const t = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts", voice: "nova", input: text, response_format: "mp3",
          instructions: "Polite, warm, professional Bangladeshi telecom customer care operator speaking clear Bangla.",
        }),
      });
      if (t.ok) audio = Buffer.from(await t.arrayBuffer()).toString("base64");
    } catch { /* লেখা দেখানো হবে */ }
    return { text, audio };
  });
