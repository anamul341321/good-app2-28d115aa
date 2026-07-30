// Server-only: Lovable-style reasoning agent for the Telegram bot.
// Unlike smartAnswer (text-only), this agent can CALL TOOLS to actually look
// into the app's database before answering — account cards, verify dates,
// re-verify status, withdraw history, slot list and live app stats.

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string };

const TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_user",
      description:
        "অ্যাপের ডেটাবেজ থেকে একজন ইউজারের পূর্ণ কার্ড (নাম, UID, ব্যালেন্স, স্লট, রেফারেল, মাইনিং, বকেয়া) আনে। query হিসেবে UID, ফোন নম্বর, রেফারেল কোড বা নাম দেওয়া যায়।",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "UID / phone / referral code / name" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "referral_join_report",
      description:
        "কোন UID/ইউজার কার রেফারে join করেছে তা ডেটাবেজ থেকে আনে — রেফারারের নাম, UID ও রেফার কোডসহ।",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "UID / phone / referral code" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verification_dates",
      description: "ইউজারের প্রতিটি স্লটের ১ম ভেরিফাই ও রি-ভেরিফাই তারিখ-সময় দেখায়।",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          kind: { type: "string", enum: ["first", "reverify", "all"] },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reverify_status",
      description: "কোন স্লটে রি-ভেরিফাই চাওয়া হয়েছে/বাকি আছে, whitelist অবস্থা কী — সেই রিপোর্ট।",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "withdraw_status",
      description: "ইউজারের উইথড্র রিকোয়েস্ট, পেইড/পেন্ডিং/রিজেক্ট ও সময় দেখায়।",
      parameters: { type: "object", properties: { uid: { type: "string" } }, required: ["uid"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_slots",
      description: "ইউজারের কোন কোন স্লট নম্বর আছে তার তালিকা।",
      parameters: { type: "object", properties: { uid: { type: "string" } }, required: ["uid"] },
    },
  },
  {
    type: "function",
    function: {
      name: "app_status",
      description:
        "অ্যাপের বর্তমান সেটিংস ও লাইভ অবস্থা — কোন পেমেন্ট মেথড চালু/বন্ধ, উইথড্র উইন্ডো, রেট, মোট ইউজার/ভেরিফাই সংখ্যা।",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

async function runTool(name: string, args: any): Promise<string> {
  try {
    if (name === "lookup_user") {
      const { buildUserCard } = await import("./telegram-lookup.server");
      const r: any = await buildUserCard(String(args?.query ?? ""));
      if (!r?.found) return "এই আইডেন্টিফায়ারে কোনো একাউন্ট পাওয়া যায়নি।";
      return r.card;
    }
    if (name === "referral_join_report") {
      const { buildReferralJoinReport } = await import("./telegram-lookup.server");
      const r: any = await buildReferralJoinReport(String(args?.query ?? ""));
      if (!r?.found) return "এই UID/আইডেন্টিফায়ারে কোনো একাউন্ট পাওয়া যায়নি।";
      return r.card;
    }
    if (name === "verification_dates") {
      const { buildVerificationDateReport } = await import("./telegram-lookup.server");
      const r: any = await buildVerificationDateReport(String(args?.query ?? ""), args?.kind ?? "all");
      return r?.found ? r.card : "একাউন্ট পাওয়া যায়নি বা একাধিক মিল পাওয়া গেছে।";
    }
    if (name === "reverify_status") {
      const { buildReverifyStatusReport } = await import("./telegram-lookup.server");
      const r: any = await buildReverifyStatusReport(String(args?.query ?? ""));
      return r?.found ? r.card : "একাউন্ট পাওয়া যায়নি বা একাধিক মিল পাওয়া গেছে।";
    }
    if (name === "withdraw_status") {
      const { buildWithdrawStatusCard } = await import("./telegram-withdraw.server");
      const r: any = await buildWithdrawStatusCard(String(args?.uid ?? ""));
      return r?.found ? r.card : "এই UID তে কোনো উইথড্র তথ্য পাওয়া যায়নি।";
    }
    if (name === "list_slots") {
      const { listSlotNumbers } = await import("./telegram-slot.server");
      const slots = await listSlotNumbers(String(args?.uid ?? ""));
      return slots.length ? `স্লট: ${slots.join(", ")}` : "কোনো স্লট পাওয়া যায়নি।";
    }
    if (name === "app_status") {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { loadRates, knowledgeText } = await import("./telegram-knowledge.server");
      const rates = await loadRates();
      const [{ data: settings }, users, verified] = await Promise.all([
        db.from("admin_settings").select("*").limit(1).maybeSingle(),
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("tasks").select("id", { count: "exact", head: true }).not("initial_verify_at", "is", null),
      ]);
      const s: any = settings ?? {};
      const pay = Object.entries(s)
        .filter(([k]) => /enabled|_on$|window|mode/i.test(k))
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(", ");
      return (
        knowledgeText(rates) +
        `\n\nলাইভ অবস্থা: মোট ইউজার ${users.count ?? 0}, মোট ভেরিফাইড স্লট ${verified.count ?? 0}` +
        (pay ? `\nসেটিংস: ${pay}` : "")
      );
    }
  } catch (e) {
    console.error("[tg-agent] tool error", name, e);
    return "টুল চালাতে সমস্যা হয়েছে।";
  }
  return "অজানা টুল।";
}

/**
 * Reasoning agent: reads the question, decides which app data it needs,
 * fetches it via tools, then answers in short Bengali. Returns null when it
 * genuinely can't answer (caller escalates to the human admin).
 */
export async function agentAnswer(opts: {
  name: string;
  question: string;
  knowledge: string;
  rulebook?: string;
  faqs?: string;
  history?: string[];
  pastReplies?: string[];
  recall?: string;
  /** অ্যাডমিন হলে অন্য ইউজারের ডেটাও দেখানো যাবে। */
  isAdmin?: boolean;
}): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  const q = (opts.question || "").trim();
  if (!key || !q) return null;

  const system =
    `তুমি Good-App এর সাপোর্ট এজেন্ট — তোমার হাতে অ্যাপের ডেটাবেজ দেখার টুল আছে।\n` +
    `• প্রশ্নে কোনো UID/ফোন/নাম/রেফারেল কোড থাকলে বা কারো একাউন্ট/স্লট/ভেরিফাই/উইথড্রর অবস্থা জানতে চাইলে ` +
    `আন্দাজে উত্তর দেবে না — আগে উপযুক্ত টুল কল করে আসল ডেটা দেখে তারপর উত্তর দেবে।\n` +
    `• কেউ যদি জিজ্ঞেস করে "এই UID কার রেফারে join হয়েছে / kar refer a / referred by / কার আন্ডারে" — অবশ্যই referral_join_report টুল কল করবে; lookup_user কার্ড দেখিয়ে এড়িয়ে যাবে না।\n` +
    `• অ্যাপের কোনো সেটিং/রেট/চালু-বন্ধ জানতে চাইলে app_status টুল ব্যবহার করবে।\n` +
    `• কোনো আইডেন্টিফায়ার না থাকলে ভদ্রভাবে UID চাইবে।\n` +
    (opts.isAdmin ? `• এই ব্যক্তি অ্যাডমিন — যেকোনো একাউন্টের রিপোর্ট দেখাতে পারো।\n`
                  : `• অন্য কারো ব্যক্তিগত ডেটা দেখাবে না; ইউজার নিজের UID দিলে তবেই দেখাবে।\n`) +
    `• কখনোই private key, wallet key বা ফেসের ছবি দেখাবে না; ছবি/কী কোথায় বা কীভাবে সংরক্ষণ হয় সেটাও কখনো বলবে না — শুধু বলবে তথ্য সুরক্ষিত ও নিরাপত্তা যাচাইয়ের কাজে ব্যবহৃত হয়।\n` +
    (opts.isAdmin ? "" :
      `• সাধারণ ইউজার ব্যালেন্স বাড়াতে/কমাতে, সেটিং বদলাতে, ভেরিফাই/হোয়াইটলিস্ট করে দিতে বা কোনো এডিট করতে বললে ভদ্রভাবে না বলবে — এসব শুধু অ্যাডমিন করতে পারেন।\n`) +

    `• সবসময় বাংলায়, ছোট ও কাজের উত্তর (৪-৬ লাইন)। Telegram HTML <b> ব্যবহার করতে পারো, Markdown নয়।\n` +
    `• GoodDollar/GD নাম কখনো লিখবে না — শুধু Good-App।\n` +
    `\n💰 আয়ের নিয়ম (এটাই একমাত্র সঠিক হিসাব, নিজে বানাবে না):\n` +
    `  ১) নিজের মাইনিং: ১০ স্লট রি-ভেরিফাই = মাসে ৫০০৳ → ১ স্লট = ৫০৳/মাস। যত স্লট, তত গুণ (২০ স্লট=১০০০৳/মাস)।\n` +
    `  ২) রেফারেল কমিশন: আপনি যাকে রেফার করেছেন তার মাসিক মাইনিংয়ের ১০% আপনি প্রতি মাসে পাবেন। ` +
    `যেমন সে ১০টি স্লট রি-ভেরিফাই করলে তার ৫০০৳/মাস → আপনি ১০% = ৫০৳ প্রতি মাসে (চলতেই থাকবে)।\n` +
    `  ৩) এককালীন বোনাস (শুধু একবার): রেফারি ১০টি ১ম ভেরিফাই করলে রেফারার পায় ১০০৳, আর ১০টি রি-ভেরিফাই করলে ঐ ইউজার নিজে পায় ২০০৳ ও তার মাইনিং চালু হয়।\n` +
    `  ⚠️ প্রশ্নটি "আমার বন্ধু/আমি যাকে রেফার করেছি সে ১০টা রি-ভেরিফাই করলে আমি কত পাবো?" হলে উত্তর হবে — ` +
    `প্রতি মাসে ১০% কমিশন (৫০৳/মাস), এককালীন ৫০০৳ নয়। নিজের স্লটের হিসাব আর রেফারেলের হিসাব কখনো মিলিয়ে ফেলবে না।\n` +
    `• টুল দিয়েও উত্তর বের করা অসম্ভব হলে শুধু লিখবে: NO_ANSWER\n\n` +

    `${opts.knowledge}\n${opts.rulebook ?? ""}\n${opts.recall ?? ""}\n` +
    (opts.faqs ? `\nসেভ করা প্রশ্নোত্তর:\n${opts.faqs}` : "");

  const messages: Msg[] = [{ role: "system", content: system }];
  if (opts.history?.length) {
    messages.push({
      role: "user",
      content:
        `আগের কথোপকথন (পুরোনো → নতুন):\n` +
        opts.history.slice(-6).map((h) => `- ${String(h).slice(0, 300)}`).join("\n") +
        (opts.pastReplies?.length
          ? `\nবট আগে বলেছিল:\n${opts.pastReplies.slice(0, 2).map((r) => `- ${String(r).replace(/<[^>]+>/g, "").slice(0, 200)}`).join("\n")}`
          : ""),
    });
  }
  messages.push({ role: "user", content: `${opts.name} এখন লিখেছে: ${q}` });

  try {
    for (let step = 0; step < 4; step++) {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, temperature: 0.6, max_tokens: 700, tools: TOOLS, messages }),
      });
      if (!res.ok) {
        console.error("[tg-agent] gateway", res.status, await res.text());
        return null;
      }
      const data: any = await res.json();
      const m = data.choices?.[0]?.message;
      if (!m) return null;

      const calls = m.tool_calls;
      if (calls?.length) {
        messages.push({ role: "assistant", content: m.content ?? "", tool_calls: calls });
        for (const c of calls) {
          let args: any = {};
          try { args = JSON.parse(c.function?.arguments || "{}"); } catch { /* ignore */ }
          const out = await runTool(c.function?.name, args);
          messages.push({ role: "tool", tool_call_id: c.id, content: out.slice(0, 4000) });
        }
        continue;
      }

      const out = String(m.content ?? "").trim();
      if (!out || /NO[_\s-]?ANSWER/i.test(out)) return null;
      const { stripAdminFiller, stripBrandName } = await import("./telegram-bot.server");
      return stripAdminFiller(stripBrandName(out));
    }
  } catch (e) {
    console.error("[tg-agent] error", e);
  }
  return null;
}
