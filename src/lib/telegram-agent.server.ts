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
  {
    type: "function",
    function: {
      name: "fee_quote",
      description:
        "উইথড্রতে কত ফি কাটবে ও হাতে কত আসবে — অ্যাপের আসল নিয়ম থেকে হিসাব করে দেয়। টাকার অংক জানা থাকলে দিতে হবে।",
      parameters: {
        type: "object",
        properties: { amount: { type: "number", description: "উইথড্র অ্যামাউন্ট (৳)" } },
        required: ["amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bonus_settings",
      description:
        "ডেটাবেজ থেকে বর্তমান বোনাস/প্রমো রেট ও পেমেন্ট মেথড চালু-বন্ধ অবস্থা আনে (bKash, Nagad, রিচার্জ, USDT)।",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "payment_numbers",
      description:
        "ইউজারের সেভ করা পেমেন্ট নম্বর (বিকাশ/নগদ/USDT) কোনগুলো আছে তা মাস্ক করে দেখায়। UID লাগবে।",
      parameters: { type: "object", properties: { uid: { type: "string" } }, required: ["uid"] },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_payment_numbers",
      description:
        "ভুল নম্বর সেভ হয়ে গেলে ইউজারের সেভ করা পেমেন্ট নম্বর মুছে দেয়, যাতে সে নতুন নম্বর যোগ করতে পারে। UID অবশ্যই লাগবে; provider দিলে শুধু ঐ মেথডের নম্বর মুছবে।",
      parameters: {
        type: "object",
        properties: {
          uid: { type: "string", description: "ইউজারের UID" },
          provider: { type: "string", enum: ["bkash", "nagad", "usdt"], description: "ঐচ্ছিক" },
        },
        required: ["uid"],
      },
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
    if (name === "payment_numbers") {
      const { listPaymentNumbers } = await import("./telegram-wallet.server");
      return await listPaymentNumbers(String(args?.uid ?? ""));
    }
    if (name === "reset_payment_numbers") {
      const { resetPaymentNumbersForUid, walletResetReply } = await import("./telegram-wallet.server");
      const res = await resetPaymentNumbersForUid(String(args?.uid ?? ""), args?.provider ?? null);
      return walletResetReply(res);
    }

    if (name === "fee_quote") {
      const amount = Number(args?.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return "নিয়ম: ১০০৳ বা বেশি হলে ফি ১০%, ১০০৳ এর কম হলে ২০%।";
      }
      // Same rule as withdraw.functions.ts (single source of truth).
      const feeRate = amount < 100 ? 0.2 : 0.1;
      const fee = Math.floor(amount * feeRate);
      return `উইথড্র ${amount}৳ → ফি ${fee}৳ (${Math.round(feeRate * 100)}%) → হাতে আসবে ${amount - fee}৳।`;
    }
    if (name === "bonus_settings" || name === "app_status") {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      const { loadRates, knowledgeText } = await import("./telegram-knowledge.server");
      const rates = await loadRates();
      const [{ data: settings }, users, verified] = await Promise.all([
        db.from("bonus_settings").select("*").eq("id", "default").maybeSingle(),
        db.from("profiles").select("id", { count: "exact", head: true }),
        db.from("tasks").select("id", { count: "exact", head: true }).not("initial_verify_at", "is", null),
      ]);
      const s: any = settings ?? {};
      const onOff = (v: any) => (v === false ? "বন্ধ" : "চালু");
      const live =
        `পেমেন্ট মেথড: বিকাশ ${onOff(s.bkash_enabled)}, নগদ ${onOff(s.nagad_enabled)}, ` +
        `মোবাইল রিচার্জ ${onOff(s.recharge_enabled)}, USDT ${onOff(s.usdt_enabled)}\n` +
        `বোনাস: ১ম ভেরিফাই ${s.first_verify_bonus ?? "-"}৳, রি-ভেরিফাই ${s.reverify_bonus ?? "-"}৳, রেফারার ${s.referrer_bonus ?? "-"}৳` +
        (s.promo_active ? ` | প্রমো চালু: ${s.promo_title ?? ""}` : "");
      if (name === "bonus_settings") return live;
      return (
        knowledgeText(rates) +
        `\n\nলাইভ অবস্থা: মোট ইউজার ${users.count ?? 0}, মোট ভেরিফাইড স্লট ${verified.count ?? 0}\n` +
        live
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
    `• অ্যাপের কোনো সেটিং/রেট/বোনাস/চালু-বন্ধ জানতে চাইলে app_status বা bonus_settings টুল ব্যবহার করবে — মুখস্থ বলবে না।\n` +
    `• উইথড্রে কত ফি কাটবে/কত হাতে আসবে জিজ্ঞেস করলে fee_quote টুল দিয়ে হিসাব করবে, নিজে আন্দাজে অংক বলবে না।\n` +
    `• ⚠️ কখনো আন্দাজ/অনুমান করে উত্তর দেবে না। যে তথ্য ডেটাবেজে আছে (একাউন্ট, স্লট, ভেরিফাই, রেফার, ব্যালেন্স, উইথড্র, সেটিংস, ফি) সেটা সবসময় টুল কল করে দেখে নিয়ে তারপর বলবে।\n` +
    `• কোনো আইডেন্টিফায়ার না থাকলে ভদ্রভাবে UID চাইবে।\n` +

    (opts.isAdmin ? `• এই ব্যক্তি অ্যাডমিন — যেকোনো একাউন্টের রিপোর্ট দেখাতে পারো।\n`
                  : `• অন্য কারো ব্যক্তিগত ডেটা দেখাবে না; ইউজার নিজের UID দিলে তবেই দেখাবে।\n`) +
    `• কখনোই private key, wallet key বা ফেসের ছবি দেখাবে না; ছবি/কী কোথায় বা কীভাবে সংরক্ষণ হয় সেটাও কখনো বলবে না — শুধু বলবে তথ্য সুরক্ষিত ও নিরাপত্তা যাচাইয়ের কাজে ব্যবহৃত হয়।\n` +
    (opts.isAdmin ? "" :
      `• সাধারণ ইউজার ব্যালেন্স বাড়াতে/কমাতে, সেটিং বদলাতে, ভেরিফাই/হোয়াইটলিস্ট করে দিতে বা কোনো এডিট করতে বললে ভদ্রভাবে না বলবে — এসব শুধু অ্যাডমিন করতে পারেন।\n`) +

    `\n💳 ভুল পেমেন্ট নম্বর প্রসঙ্গে:\n` +
    `• কেউ বলে "ভুল বিকাশ/নগদ নম্বর সেভ হয়ে গেছে / নম্বর বদলাতে চাই / নম্বর রিসেট করে দিন" — "পারব না" বলবে না। ` +
    `UID নিয়ে reset_payment_numbers টুল চালিয়ে নম্বর মুছে দেবে, তারপর বলবে অ্যাপে গিয়ে সঠিক নম্বরটি নতুন করে যোগ করতে।\n` +
    `• UID না দিলে ভদ্রভাবে UID (আর চাইলে কোন মেথড — বিকাশ/নগদ/USDT) জিজ্ঞেস করবে।\n` +
    `• টুলের ফলাফলে যা লেখা আছে সেটাই সংক্ষেপে জানাবে; পুরো নম্বর কখনো লিখবে না।\n` +
    `\n🔄 স্লট রিসেট/ডিলিট প্রসঙ্গে (খুব গুরুত্বপূর্ণ):\n` +

    `• "সাপোর্ট বটের স্লট রিসেট করার ক্ষমতা নেই" — এই কথা কখনোই বলবে না। ইউজার UID ও স্লট নম্বর দিলে স্লট রিসেট করে দেওয়া যায়।\n` +
    `• আগে lookup_user/list_slots টুল দিয়ে দেখে নেবে ঐ স্লটটির অবস্থা কী।\n` +
    `• স্লটটি যদি এখনো খালি/ভেরিফিকেশন শুরুই করা হয়নি — তাহলে সরাসরি "পারব না" বলবে না; সুন্দর করে বোঝাবে: ` +
    `"স্যার, আপনার ঐ স্লটটিতে এখনো কোনো ফেস ভেরিফিকেশন শুরু করা হয়নি, স্লটটি একদম খালি আছে — তাই ওখানে ডিলিট বা রিসেট করার মতো কিছুই নেই 🙂 ` +
    `আপনি চাইলে ঐ স্লটে নতুন ফেস দিয়ে ভেরিফিকেশন শুরু করতে পারেন। আর অন্য কোনো নির্দিষ্ট স্লট রিসেট করতে চাইলে শুধু আপনার UID ও স্লট নম্বরটি লিখে জানান, আমি সাথে সাথে রিসেট করে দিচ্ছি 💙"\n` +
    `• স্লটে ভেরিফিকেশন করা থাকলে UID চেয়ে নিয়ে রিসেট করে দেবে; কখনো "শুধু অ্যাডমিন পারেন" বলে ঘুরিয়ে দেবে না।\n\n` +
    `\n✍️ উত্তরের ধরন (কড়াভাবে মানবে):\n` +
    `• <b>সবসময় শুধু বাংলা</b>। এক লাইনও ইংরেজি ব্যাখ্যা/analysis/meta লিখবে না (bKash, Nagad, USDT, UID এর মতো নামের ব্যতিক্রম ছাড়া)।\n` +
    `• সংক্ষেপে — সাধারণ প্রশ্নের উত্তর <b>১–৩ লাইনে</b> শেষ করবে। শুধু হিসাব/ধাপ/একাউন্ট রিপোর্টের মতো জিনিস হলে সর্বোচ্চ ৫-৬ লাইন। গ্রুপে স্প্যাম মনে হয় এমন লম্বা মেসেজ দেবে না।\n` +
    `• অপ্রয়োজনীয় ভূমিকা/উপদেশ/"ধন্যবাদ, আমরা সবসময় পাশে আছি" জাতীয় লাইন বাদ দেবে। সরাসরি কাজের কথা।\n` +
    `• "বট আগে বলেছিল" অংশে যা আছে সেটাই আবার হুবহু পাঠাবে না — নতুন করে, ছোট করে বলবে।\n` +
    `• প্রশ্নটা ভালোভাবে না বুঝলে অনুমান করে ইংরেজিতে/এলোমেলো উত্তর দেবে না — তখন NO_ANSWER দেবে, অ্যাডমিন এসে দেখবেন।\n` +
    `\n💳 ফি সংক্রান্ত: কেউ বলে "১০০৳ তুললাম ১০৳ কেটে নিলো কেন" — উত্তর: এটা অ্যাপের সার্ভিস ফি, ` +
    `১০০৳ বা বেশি হলে ১০%, ১০০৳ এর কম হলে ২০%। তাই ১০০৳ → ফি ১০৳ → হাতে ৯০৳। এটা কোনো ভুল নয়। ২–৩ লাইনেই বোঝাবে।\n` +
    `• Telegram HTML <b> ব্যবহার করতে পারো, Markdown নয়।\n` +
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

  // Questions whose answer lives in the database — force a real lookup on the
  // first turn so the model can never answer them from memory/guesswork.
  const needsData =
    /(\d{1,7})|uid|ইউ ?আই ?ডি|স্লট|slot|ভেরিফা|verif|রেফার|refer|ব্যালেন্স|balance|উইথড্র|withdraw|ফি|fee|চার্জ|charge|বোনাস|bonus|মাইনিং|mining|হোয়াইটলিস্ট|whitelist|বিকাশ|bkash|নগদ|nagad|usdt|রিচার্জ|recharge|পেন্ডিং|pending|একাউন্ট|account/i.test(
      q,
    );

  try {
    for (let step = 0; step < 5; step++) {
      const res = await fetch(AI_URL, {
        method: "POST",
        headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          tools: TOOLS,
          messages,
          ...(step === 0 && needsData ? { tool_choice: "required" as const } : {}),
        }),
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
