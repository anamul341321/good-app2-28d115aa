// Server-only: built-in FAQ library. These answers are always available to the
// bot even if the admin has not added anything in the panel. Admin-added FAQ
// rows (tg_faq) always take priority over these.

export type BuiltinFaq = {
  topic: string;
  /** Text the screenshot usually contains — helps the AI match a photo. */
  screenshot: string[];
  keywords: string[];
  answer: string;
};

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Bonus amounts must never be hardcoded in an answer — the admin changes them
 * from the panel. Answers use {{FIRST_BONUS}} / {{REVERIFY_BONUS}} /
 * {{REFERRER_BONUS}} and these get replaced with the live database values.
 */
export function fillRates(
  text: string,
  r: { firstVerify: number; reVerify: number; referrer: number; promoFirst?: number | null; promoRe?: number | null; promoRef?: number | null },
): string {
  const tk = (n: number) => `${Math.round(n)}৳`;
  const first = r.promoFirst ?? r.firstVerify;
  const re = r.promoRe ?? r.reVerify;
  const ref = r.promoRef ?? r.referrer;
  return text
    .replace(/\{\{FIRST_BONUS\}\}/g, first > 0 ? tk(first) : "কোনো বোনাস নেই")
    .replace(/\{\{REVERIFY_BONUS\}\}/g, tk(re))
    .replace(/\{\{REFERRER_BONUS\}\}/g, tk(ref));
}

/** Same as fillRates but loads the live rates itself. */
export async function fillLiveRates(text: string): Promise<string> {
  if (!/\{\{[A-Z_]+\}\}/.test(text)) return text;
  try {
    const { loadRates } = await import("./telegram-knowledge.server");
    return fillRates(text, await loadRates());
  } catch {
    return text.replace(/\{\{[A-Z_]+\}\}/g, "অ্যাপের অফার পেজে দেখানো বোনাস");
  }
}


export const BUILTIN_FAQS: BuiltinFaq[] = [
  {
    topic: "নির্দিষ্ট নাম্বারের স্লট ভেরিফাই হচ্ছে না",
    screenshot: [],
    keywords: [
      "number verify hocche na", "nomber verify hocche na", "nambar verify hocche na",
      "number ta verify hoi na", "slot verify hocche na", "slot verify hoi na",
      "slot verify hocche na keno", "ei slot verify hocche na", "verify hocche na",
      "নাম্বার ভেরিফাই হচ্ছে না", "নাম্বারের ভেরিফাই হচ্ছে না", "নম্বর ভেরিফাই হচ্ছে না",
      "স্লট ভেরিফাই হচ্ছে না", "ভেরিফাই হচ্ছে না কেন", "স্লট ভেরিফাই হয় না",
      "verify hocche na kn", "verify hoi na kn",
    ],
    answer:
      `🙂 চিন্তার কিছু নেই ভাইয়া — কোনো একটি স্লট ভেরিফাই না হওয়ার কারণ সাধারণত এই ৩টি 👇\n\n` +
      `<b>১️⃣ সময় হয়নি:</b> ফার্স্ট ভেরিফাইয়ের পর ঐ স্লটে <b>রি-ভেরিফাই</b> বাটন আসতে <b>৩–৪ দিন</b> লাগে। সময় হলে বাটন নিজে থেকেই চলে আসে, জোর করে আনা যায় না ⏳\n` +
      `<b>২️⃣ Whitelist অপেক্ষায়:</b> ফেস ঠিক আছে কিন্তু GoodDollar whitelist হতে কিছু সময় লাগে — আমাদের সিস্টেম <b>প্রতি ৫ মিনিটে অটো চেক</b> করে, হয়ে গেলেই স্লটে ✅ বসে যাবে।\n` +
      `<b>৩️⃣ ফেস/আলো সমস্যা:</b> ক্যামেরা পরিষ্কার করে, ভালো আলোতে, চশমা-টুপি খুলে সোজা তাকিয়ে আবার চেষ্টা করুন 📸\n\n` +
      `👉 তবুও না হলে ঐ <b>স্লট নাম্বার</b> সহ লিখুন (যেমন: “৬ নাম্বার স্লট”) — আমি একাউন্ট চেক করে ঠিক কী আটকে আছে বলে দেব 💙`,
  },

  {
    topic: "বোনাস ক্যাম্পেইন শেষ হলে কী হবে (১১ তারিখের পর)",
    screenshot: [],
    keywords: [
      "11 tarikher por bonus", "11 tarikh er por", "11 tarikh por bonus",
      "campaign ses", "campaign shesh", "offer ses", "offer shesh",
      "bonus ki ar pabo", "bonus ar pabo na", "bonus bondho", "bonus off hobe",
      "১১ তারিখের পর", "১১ তারিখ এর পর", "ক্যাম্পেইন শেষ", "অফার শেষ",
      "বোনাস কি আর পাবো", "বোনাস আর পাবো না", "বোনাস বন্ধ",
    ],
    answer:
      `😊 <b>জি, অবশ্যই পাবেন!</b>\n\n` +
      `🎁 এখন যে <b>৩০০৳ বোনাস ক্যাম্পেইন</b> চলছে সেটি <b>১১ তারিখ পর্যন্ত</b>।\n` +
      `📅 ১১ তারিখের পর <b>অ্যাডমিন সিদ্ধান্ত নেবেন</b> বোনাস চালু থাকবে কি না — যদি চালু রাখেন, তাহলে আপনি অবশ্যই বোনাসটি পাবেন ✅\n\n` +
      `⛏️ তবে একটা কথা নিশ্চিত — <b>মাইনিং কখনোই বন্ধ হবে না</b>। ১০টি স্লট ফার্স্ট ভেরিফাই + রি-ভেরিফাই শেষ করলে আপনার মাইনিং <b>স্থায়ীভাবে</b> চালু থাকবে এবং প্রতি মাসেই ইনকাম পেতে থাকবেন 💙\n\n` +
      `👉 তাই দেরি না করে এখনই কাজটা শেষ করে ফেলুন — ক্যাম্পেইনের ভেতরে শেষ করলে বোনাসটাও নিশ্চিত 🎉`,
  },

  {
    topic: "অ্যাপের অফিসিয়াল লিংক",
    screenshot: [],
    keywords: [
      "apps link", "app link", "apper link", "apps er link", "app er link",
      "link den", "link dan", "link dio", "link ta den", "website link",
      "official link", "site link", "link kothay", "link please", "link plz",
      "অ্যাপের লিংক", "অ্যাপ লিংক", "লিংক দেন", "লিংক দিন", "লিংক টা দেন",
      "ওয়েবসাইট লিংক", "অফিসিয়াল লিংক", "লিংক কোথায়",
    ],
    answer:
      `🔗 <b>আমাদের অফিসিয়াল লিংক</b> 👇\n\n` +
      `👉 <b>https://goodapp2.live</b>\n\n` +
      `📲 Chrome দিয়ে লিংকটি ওপেন করে <b>⋮ মেনু → Add to Home Screen → Install</b> চাপলেই অ্যাপটি ফোনে ইনস্টল হয়ে যাবে ✅\n` +
      `⚠️ শুধু এই একটাই অফিসিয়াল লিংক — অন্য কোনো লিংক ব্যবহার করবেন না।`,
  },

  {

    topic: "অ্যাপ ডাউনলোড / ইনস্টল করার নিয়ম",
    screenshot: [],
    keywords: [
      "apps download", "app download", "download korbo", "download kivabe",
      "apps kivabe download", "install korbo", "install kivabe", "apps install",
      "app install", "apk", "play store", "playstore", "home screen",
      "অ্যাপ ডাউনলোড", "অ্যাপস ডাউনলোড", "ডাউনলোড করবো", "ডাউনলোড কিভাবে",
      "ইনস্টল করবো", "ইনস্টল কিভাবে", "অ্যাপ ইনস্টল", "এপস ডাউনলোড",
    ],
    answer:
      `📲 <b>অ্যাপটি ইনস্টল করার নিয়ম</b> (খুব সহজ, ১ মিনিটের কাজ) 👇\n\n` +
      `<b>১️⃣</b> <b>Chrome</b> ব্রাউজার দিয়ে আমাদের অফিসিয়াল ওয়েবসাইট <b>https://goodapp2.live</b> ওপেন করুন।\n` +
      `<b>২️⃣</b> উপরের ডান পাশে থাকা তিনটি ডট <b>(⋮)</b> মেনুতে ক্লিক করুন।\n` +
      `<b>৩️⃣</b> নিচের দিকে স্ক্রল করলে <b>"Add to Home Screen"</b> অপশনটি পাবেন — সেটিতে ক্লিক করুন।\n` +
      `<b>৪️⃣</b> এরপর উপরে থাকা <b>"Install"</b> বাটনে চাপ দিলেই অ্যাপটি আপনার ফোনে ইনস্টল হয়ে যাবে ✅\n\n` +
      `📌 অ্যাপের ভেতরে উপরে <b>"অ্যাপ ইনস্টল করুন"</b> ব্যানারেও এই নিয়মটি ছবি আকারে দেখতে পাবেন।`,
  },

  {
    topic: "Gmail যুক্ত / Gmail ভেরিফিকেশন কিভাবে করবো",
    // শুধু Gmail-নির্দিষ্ট লেখা — "verify/ভেরিফাই" রাখা যাবে না, নইলে অন্য
    // সমস্যার স্ক্রিনশটেও Gmail-এর উত্তর চলে যায়।
    screenshot: ["Gmail যোগ করুন", "Gmail সিকিউরিটি", "কোড পাঠান", "gmail verification", "gmail verify"],

    keywords: [
      "gmail add", "gmail add korbo", "gmail add kemne", "gmail add kivabe",
      "gmail jukto", "gmail verify", "gmail verification", "gmail kivabe",
      "gmail dibo", "gmail kothay", "email add", "email verify", "email verification",
      "gmail code", "gmail otp", "gmail suraksha", "gmail security",
      "জিমেইল যোগ", "জিমেইল কিভাবে", "জিমেইল দিব", "জিমেইল ভেরিফাই",
      "জিমেইল ভেরিফিকেশন", "ইমেইল যোগ", "ইমেইল ভেরিফাই", "জিমেইল যুক্ত",
    ],
    answer:
      `📧 <b>Gmail যুক্ত করার নিয়ম</b> — ১ মিনিটের কাজ, একদম সহজ 😊👇\n\n` +
      `<b>১️⃣</b> অ্যাপে লগইন করুন — <b>https://goodapp2.live</b>\n` +
      `<b>২️⃣</b> <b>হোম পেজেই</b> উপরে নীল-বেগুনি রঙের <b>“📧 Gmail যোগ করুন”</b> কার্ডটিতে চাপ দিন (অথবা নিচের মেনু → <b>সেটিংস</b> → <b>Gmail সিকিউরিটি</b>)।\n` +
      `<b>৩️⃣</b> বক্সে আপনার Gmail ঠিকানা লিখে <b>“কোড পাঠান”</b> চাপুন।\n` +
      `<b>৪️⃣</b> ঐ Gmail-এর ইনবক্সে <b>৬ ডিজিটের কোড</b> যাবে (না পেলে <b>Spam</b> ফোল্ডার দেখুন)।\n` +
      `<b>৫️⃣</b> কোডটি অ্যাপের বক্সে বসিয়ে <b>ভেরিফাই</b> চাপুন — ব্যাস, হয়ে গেল ✅ 🎉\n\n` +
      `🔒 লাভ: পাসওয়ার্ড ভুলে গেলে নিজেই রিসেট করতে পারবেন, নতুন ফোনে সহজে লগইন, আর একাউন্ট অন্য কেউ নিতে পারবে না। সম্পূর্ণ <b>ফ্রি</b> 👍`,
  },


  {
    topic: "পেমেন্ট করতে কত সময় লাগে?",
    screenshot: [],
    keywords: [
      "payment korte koto somoy", "payment koto somoy", "koto somoy lage",
      "kotokkhon por taka", "kotokkhon lage", "taka koto somoy", "taka kokhon asbe",
      "withdraw koto somoy", "payment kokhon", "koto somoy pore taka",
      "পেমেন্ট করতে কতো সময়", "পেমেন্ট করতে কত সময়", "কত সময় লাগে", "কতো সময় লাগে",
      "কতক্ষণ পর টাকা", "টাকা কখন আসবে", "কতক্ষণ লাগে", "পেমেন্ট কখন",
    ],
    answer:
      `⏱️ উইথড্র রিকোয়েস্ট দেওয়ার পর সাধারণত <b>৫ থেকে ১০ মিনিটের</b> মধ্যেই টাকা আপনার bKash/Nagad নম্বরে চলে আসে ✅\n\n` +
      `• রিকোয়েস্টটি "paid" হয়ে গেলে ড্যাশবোর্ডেই দেখতে পাবেন\n` +
      `• মাঝে মাঝে চাপ বেশি থাকলে একটু বেশি সময় লাগতে পারে — চিন্তার কিছু নেই, টাকা আসবেই 💙\n\n` +
      `১০–১৫ মিনিট পরেও না পেলে শুধু আপনার UID টা দিন, আমি সাথে সাথে দেখে জানাচ্ছি 🙂`,
  },

  {
    topic: "১০টার পর আরও স্লট যোগ করলে কি আবার বোনাস পাওয়া যাবে?",
    screenshot: [],
    keywords: [
      "aro slot add korle bonus", "aro 10 ta korle bonus", "notun slot bonus",
      "second 10 bonus", "20 ta slot bonus", "extra slot bonus", "slot barale bonus",
      "আরও স্লট বোনাস", "আরো ১০ টা", "নতুন স্লট বোনাস", "২০ টা স্লট বোনাস",
      "porer 10 ta bonus", "পরের ১০ টা বোনাস", "slot barale ki hobe",
    ],
    answer:
      `খুব ভালো প্রশ্ন ভাইয়া 👏 পরিষ্কার করে বলি —\n\n` +
      `🎁 <b>বোনাস শুধু প্রথম ১০টি স্লটের জন্যই</b>\n` +
      `• প্রথম ১০টি স্লট <b>ফার্স্ট ভেরিফাই</b> সম্পন্ন হলে → <b>{{FIRST_BONUS}}</b>\n` +
      `• সেই ১০টি স্লট <b>রি-ভেরিফাই</b> সম্পন্ন হলে → <b>{{REVERIFY_BONUS}} বোনাস</b> + আপনার <b>মাসিক মাইনিং চালু</b> ✅\n\n` +

      `➕ <b>এরপর আরও ১০টি স্লট যোগ করলে?</b>\n` +
      `• সেগুলোও ফার্স্ট ভেরিফাই + রি-ভেরিফাই করতেই হবে (নিয়ম একই)\n` +
      `• কিন্তু বাকি স্লটগুলোর জন্য <b>আলাদা কোনো বোনাস পাবেন না</b>\n` +
      `• তবে আপনার <b>মাসিক মাইনিং দ্বিগুণ</b> হয়ে যাবে — ১০ স্লটে ৫০০৳ হলে ২০ স্লটে <b>১০০০৳ (2X)</b> 🚀\n\n` +
      `📈 হিসাবটা সহজ: <b>১ স্লট = মাসে ৫০৳</b>। ৩০ স্লট = ১৫০০৳, ৫০ স্লট = ২৫০০৳ — যত বেশি স্লট, তত বেশি মাসিক ইনকাম, সারাজীবনের জন্য।\n\n` +
      `⏰ <b>মনে রাখবেন:</b> চলমান অফারের সঠিক শেষ তারিখ অ্যাপের live অফার ব্যানারে দেখুন—bot পুরোনো/অনুমান করা তারিখ বলবে না। অফার শেষ হলেও <b>মাসিক মাইনিং চলতেই থাকবে</b> 💙\n\n` +
      `👉 তাই দেরি না করে বেশি বেশি স্লট বাড়ান, বেশি বেশি ইনকাম করুন!`,
  },

  {
    topic: "এই অ্যাপ/ইনকাম কতদিন থাকবে? কখন বন্ধ হবে?",
    screenshot: [],
    keywords: [
      "kotodin thakbe", "koto din cholbe", "kobe bondho hobe", "eta bondho hobe ki",
      "apps kotodin", "কতদিন থাকবে", "কতদিন চলবে", "কবে বন্ধ হবে", "বন্ধ হয়ে যাবে",
      "offer kotodin", "permanent ki na", "সাইট কতদিন", "site kotodin",
    ],
    answer:
      `ভাইয়া, এটা কোনো অফার সাইট বা প্রমোশন ওয়েবসাইট <b>নয়</b> 🙂\n\n` +
      `🌍 এটি একটি <b>Universal Basic Income (UBI)</b> সিস্টেম — অর্থাৎ মানুষ যেন প্রতি মাসে নিয়মিত একটা আয় পায়, সেই উদ্দেশ্যেই এটি <b>স্থায়ীভাবে (permanently)</b> ডিজাইন করা হয়েছে।\n\n` +
      `✅ তাই এটি কোনোদিন বন্ধ হবে না — আপনার স্লটগুলো সচল থাকলে <b>মাসিক মাইনিং সারাজীবন</b> চলতে থাকবে।\n` +
      `🔁 শুধু মাঝে মাঝে (৩–৪ মাস পর) রি-ভেরিফাই চাওয়া হতে পারে, যাতে টাকা আসল মালিকের হাতেই যায়।\n\n` +
      `⏰ শুধু <b>বোনাস অফারটি</b> সময়সীমা-নির্ভর—সঠিক শেষ তারিখ app-এর live অফার ব্যানারে দেখুন। কিন্তু <b>মাসিক ইনকাম চিরস্থায়ী</b> 💙`,
  },

  {
    topic: "রি-ভেরিফাই একবার করলে পরে আবার লাগবে কি না",
    screenshot: [],
    keywords: [
      "porobortite abar re verify", "abar re verify korte hobe", "abar reverify lagbe",
      "re verify korle abar lagbe", "reverify abar lagbe", "আবার রি-ভেরিফাই লাগবে",
      "আবার রি ভেরিফাই করতে হবে", "পরবর্তীতে আবার রি-ভেরিফাই", "বারবার রি-ভেরিফাই",
      "kotodin por re verify", "কতদিন পর রি-ভেরিফাই", "koto din por abar",
      "re verify keno chai", "রি-ভেরিফাই কেন চায়", "reverify kn lage", "বার বার কেন",
    ],
    answer:
      `জি ভাইয়া, <b>পরবর্তীতে আবার রি-ভেরিফাই চাওয়া হতে পারে</b> — এটা কোনো সমস্যা নয়, এটা আমাদের নিয়মিত নিরাপত্তা যাচাই 🙂\n\n` +
      `📌 <b>রি-ভেরিফাই কেন চাওয়া হয়?</b>\n` +
      `আমরা যে টাকাটা প্রতি মাসে দিয়ে যাচ্ছি, সেটা যেন <b>একাউন্টের প্রকৃত মালিকের হাতেই</b> পৌঁছায় — এটাই নিশ্চিত করার জন্য।\n` +
      `১️⃣ একাউন্টটি এখনো আসল মালিক নিজে ব্যবহার করছেন কি না\n` +
      `২️⃣ ফেসটি জীবিত ও প্রকৃত ব্যক্তির কি না (নকল/ডুপ্লিকেট নয়)\n` +
      `৩️⃣ একাউন্টটি অন্য কারো হাতে বিক্রি বা হাতবদল হয়ে যায়নি\n\n` +
      `⏳ তাই প্রথমবারের রি-ভেরিফাইয়ের পর সাধারণত <b>৩–৪ মাস পর</b> আবার একবার রি-ভেরিফাই চাওয়া হতে পারে।\n` +
      `✅ চিন্তার কিছু নেই — রি-ভেরিফাই শুধু <b>একটি লাইভ ফেস স্ক্যান</b>, ১০ সেকেন্ডের কাজ। করলেই স্লট আবার সচল থাকবে এবং মাসিক ইনকাম চলতেই থাকবে 💙\n\n` +
      `🔔 কখন লাগবে সেটা অ্যাপেই দেখতে পাবেন — সময় হলে স্লটে নিজে থেকেই রি-ভেরিফাই বাটন চলে আসবে, তার আগে করতে হবে না।`,
  },

  {
    topic: "We found your twin — এই ফেস আগেই ভেরিফাই করা",
    screenshot: [
      "We found your twin",
      "You can verify ONLY ONE wallet address per person",
      "The existing identity will expire on",
      "If this is your only active account - please contact support",
    ],
    keywords: [
      "twin", "found your twin", "only one wallet", "same face", "একই ফেস", "টুইন",
      "duplicate face", "already verified face", "identity will expire", "ফেস আগে করা",
    ],
    answer:
      `ভাইয়া, আপনি যে ফেস দিয়ে ভেরিফিকেশন করার চেষ্টা করছেন, সেই ফেস দিয়ে আমাদের অ্যাপে <b>আগে থেকেই একটি ফেস ভেরিফিকেশন করা আছে</b> ✅\n\n` +
      `একজন মানুষের ফেস দিয়ে একসাথে একটির বেশি ওয়ালেট ভেরিফাই করা যায় না। তাই <b>৬ মাস পূর্ণ না হওয়া পর্যন্ত</b> একই ফেস দিয়ে আবার ভেরিফিকেশন করতে পারবেন না।\n` +
      `⏳ ৬ মাস পূর্ণ হলে ঐ ফেস আবার ফ্রি হয়ে যাবে, তখন এই ফেস দিয়েই আবার ভেরিফিকেশন করতে পারবেন।\n\n` +
      `👉 এখন <b>অন্য একটি ফেস</b> দিয়ে চেষ্টা করুন — আশা করি সাথে সাথেই হয়ে যাবে 🙂`,
  },
  {
    topic: "Something went wrong — ভেরিফিকেশন এরর",
    screenshot: ["Something went wrong", "Oops", "Please try again later"],
    keywords: ["something went wrong", "somthing wrong", "error ashe", "ভেরিফাই হচ্ছে না", "এরর"],
    answer:
      `এই এররটা সাধারণত <b>ব্রাউজার/IP</b> এর কারণে হয় — চিন্তার কিছু নেই 🙂\n\n` +
      `১️⃣ এক ব্রাউজারে ২টির বেশি একাউন্ট করবেন না\n` +
      `২️⃣ Play Store থেকে নতুন ব্রাউজার নামান (Firefox, Opera, Mises, Brave)\n` +
      `৩️⃣ ফোন একবার বন্ধ করে চালু করুন, তারপর Airplane mode অন করে অফ করুন\n` +
      `৪️⃣ WiFi নয় — মোবাইল ডেটা দিয়ে চেষ্টা করুন\n\n` +
      `এভাবে করলে বেশিরভাগ সময়েই হয়ে যায় 💙`,
  },
  {
    topic: "বয়স ১৮/২০+ তবুও ফেস ভেরিফিকেশন হচ্ছে না (দেখতে কম বয়সী লাগে)",
    screenshot: [],
    keywords: [
      "boyos beshi", "boyos besi", "বয়স বেশি", "বয়স ২০", "বয়স 20", "বয়স ২১", "বয়স ২২",
      "বয়স ১৯", "বয়স 19", "boyos 20", "boyos 21", "boyos 22", "boyos 19", "boyos 18",
      "বয়স ১৮ থেকে বেশি", "boyos 18 theke beshi", "age 20", "age 21", "age 22", "age 19",
      "বয়স ২৫", "বয়স 25", "boyos 25", "age 25", "25 bochor", "২৫ বছর", "তার বয়স ২৫",
      "20 bochor", "২০ বছর", "২১ বছর", "২২ বছর", "20 years", "tar boyos 20",
      "তবুও এই সমস্যা", "tao hocche na", "tao hoy na", "tao hocche na", "boyos beshi tao",
      "প্রাপ্তবয়স্ক তবুও", "বড় মানুষের ফেস দিয়েও", "boro manusher face diyeo",
    ],
    answer:
      `আসলে ফেস ভেরিফিকেশন <b>জন্মতারিখ দেখে হয় না</b> 🙂 সিস্টেম মুখের গঠন দেখে আনুমানিক বয়স বোঝার চেষ্টা করে।\n\n` +
      `তাই কারো আসল বয়স ২৫ হলেও মুখের গঠন কম বয়সী মনে হলে ১৮+ সমস্যাটি দেখাতে পারে।\n\n` +
      `👉 তাই দেখতে একটু বয়স্ক/পরিণত চেহারার (২৫+) কারো ফেস দিয়ে চেষ্টা করুন। ফেস নেওয়ার সময় মুখে ভালো আলো রাখুন এবং চশমা বা টুপি খুলে ফেলুন 💙`,
  },
  {
    topic: "18+ / বয়স কম — ফেস গ্রহণ হচ্ছে না",
    screenshot: ["18", "age", "You must be 18", "under age", "18 years or older"],
    keywords: [
      "18+", "18 plus", "boyos", "বয়স", "age problem", "kid face", "ছোট ফেস",
      "kom boyos", "under 18", "choto chele", "বাচ্চার ফেস",
      "১৮ বছর", "18 bochor", "18 bosor", "বছরের নিচে", "bochorer niche",
      "18 years", "১৮ বছরের নিচে", "niche boyos", "কম বয়স",
    ],

    answer:
      `এখানে <b>১৮ বছরের বেশি বয়সের ফেস</b> লাগে 🙂 কম বয়সী ফেস দিলে Good-App সেটা গ্রহণ করে না।\n\n` +
      `⚠️ খুব গুরুত্বপূর্ণ কথা — <b>কম বয়সী ফেস দিয়ে প্রথমবার ভেরিফিকেশন হয়ে গেলেও পরে সমস্যা হয়</b>। ` +
      `প্রথমবার হয়ে যাওয়া মানেই ফেসটি স্থায়ীভাবে অনুমোদিত নয়; সিস্টেম সন্দেহ করলে <b>যাচাইয়ের জন্য আবার ফেস (রি-ভেরিফাই) চাইতে পারে</b> এবং তখন কম বয়সী ফেস আটকে যায়।\n\n` +
      `✅ আর <b>প্রাপ্তবয়স্ক (১৮+) ফেস</b> দিয়ে করলে পরবর্তীতে সাধারণত কোনো সমস্যা হয় না — একবার হয়ে গেলে নিশ্চিন্ত।\n\n` +
      `👉 তাই এখনই বড় কারো (১৮+) ফেস দিয়ে স্লটটি করে নিন, মুখে ভালো আলো রাখুন এবং চশমা/টুপি খুলে নিন 💙`,

  },

  {
    topic: "ক্যামেরা পারমিশন / We can't access your camera",
    screenshot: ["camera", "permission", "allow camera", "can't access your camera", "enable camera permission", "device settings"],
    keywords: ["camera", "ক্যামেরা", "permission", "পারমিশন", "cam kaj kore na", "camera access"],
    answer:
      `ভাইয়া, আগে একবার ক্যামেরার পারমিশন <b>Allow</b> না দেওয়ায় ব্রাউজারটি ক্যামেরা ব্লক করে রেখেছে 📷\n\n` +
      `👉 এই ব্রাউজার দিয়ে আর হবে না — অন্য একটি ব্রাউজার (Chrome / Opera / Firefox) ডাউনলোড করে সেখান থেকে লগইন করে আবার চেষ্টা করুন।\n` +
      `⚠️ মনে রাখবেন — নতুন ব্রাউজারে ক্যামেরা চাইলে অবশ্যই <b>Allow</b> দিবেন, তাহলেই ফেস ভেরিফিকেশন হয়ে যাবে 🙂`,
  },

  {
    topic: "লিংক এক্সপায়ার / সেশন শেষ",
    screenshot: ["expired", "session", "link is no longer valid"],
    keywords: ["expire", "expired", "লিংক", "link kaj kore na", "session shesh"],
    answer:
      `ভেরিফিকেশন লিংক অল্প সময় পর নিজে থেকেই বাতিল হয়ে যায় ⏳\n\n` +
      `👉 অ্যাপে ফিরে গিয়ে ঐ স্লট থেকে <b>নতুন করে ভেরিফিকেশন শুরু</b> করুন, নতুন লিংক তৈরি হবে এবং কাজ করবে 🙂`,
  },
  {
    topic: "KYC কী / কিভাবে করবো",
    screenshot: [],
    keywords: [
      "kyc", "kyc ki", "kyc কি", "kyc কী", "কেওয়াইসি", "kyc korbo", "kyc kivabe",
      "kyc kore", "kyc lagbe", "kyc verified", "kyc verify", "kyc mane",
      "kyc কিভাবে", "কেওয়াইসি কি", "কেওয়াইসি কিভাবে",
    ],
    answer:
      `📌 <b>KYC মানে আপনার একাউন্টটি আপনারই — এই নিশ্চয়তা</b> 🙂\n` +
      `KYC করলে প্রোফাইলে <b>নীল ✔ ব্যাজ</b> যোগ হয় এবং <b>উইথড্র চালু</b> হয়।\n\n` +
      `<b>কিভাবে করবেন (১ মিনিটের কাজ):</b>\n` +
      `<b>১️⃣</b> অ্যাপে ঢুকে <b>KYC</b> পেজে যান\n` +
      `<b>২️⃣</b> <b>“KYC শুরু করুন (টেলিগ্রাম)”</b> বাটনে চাপ দিন — এই বটটিই খুলে যাবে\n` +
      `<b>৩️⃣</b> নিচে <b>START</b> বাটনে একবার চাপ দিন — ব্যাস, KYC সম্পন্ন ✅\n\n` +
      `⚠️ একটি টেলিগ্রাম দিয়ে <b>একটিই UID</b> KYC করা যাবে।\n` +
      `ℹ️ KYC ছাড়া অ্যাপের সব কাজ চলবে, শুধু <b>টাকা তোলা যাবে না</b> 💙`,
  },
  {
    topic: "রি-ভেরিফাই করা যাচ্ছে না / “এখনো সময় হয়নি”",
    screenshot: [],
    keywords: [
      "re verify hocche na", "re verify hoi na", "reverify hocche na", "reverify hoi na",
      "re verify kora jai na", "reverify kora jai na", "re verify korte parchi na",
      "reverify korte parchi na", "re verify button asche na", "reverify button nai",
      "re verify ene dao", "reverify ene dao", "re verify dao", "somoy hoy nai",
      "somoy hoyni", "ekhono somoy", "রি ভেরিফাই হচ্ছে না", "রি-ভেরিফাই হচ্ছে না",
      "রি ভেরিফাই করা যায় না", "রি-ভেরিফাই করা যায় না", "রি ভেরিফাই করতে পারছি না",
      "রি ভেরিফাই এনে দাও", "রি-ভেরিফাই এনে দাও", "রি ভেরিফাই বাটন",
      "এখনো সময় হয়নি", "সময় হয় নাই", "রি ভেরিফাই কখন", "রি-ভেরিফাই কখন",
      "kokhon re verify", "re verify kokhon", "kobe re verify", "re verify kobe",
    ],
    answer:
      `চিন্তার কিছু নেই ভাইয়া 🙂 রি-ভেরিফাই <b>জোর করে আনা যায় না</b> — সময় হলে নিজে থেকেই চলে আসে।\n\n` +
      `⏳ <b>নিয়মটা এমন:</b>\n` +
      `<b>১️⃣</b> ফার্স্ট ভেরিফাই করার পর ওই স্লটের জন্য <b>৩–৪ দিন</b> অপেক্ষা করতে হয়।\n` +
      `<b>২️⃣</b> সময় হওয়ার আগে চাপ দিলে অ্যাপ বলবে <b>“এখনো সময় হয়নি”</b> — এটা কোনো সমস্যা বা এরর নয় ✅\n` +
      `<b>৩️⃣</b> সময় হলে ঐ স্লট কার্ডেই <b>“🔁 রি-ভেরিফাই”</b> বাটন নিজে থেকেই দেখা যাবে — তখন এক ক্লিকে লাইভ ফেস স্ক্যান, ১০ সেকেন্ডের কাজ।\n\n` +
      `🔔 তাই কালকে ভেরিফাই করলে আজই রি-ভেরিফাই হবে না — <b>৩–৪ দিন পর</b> আবার অ্যাপে ঢুকে স্লটটি দেখুন, বাটন চলে আসবে।\n` +
      `📌 মনে রাখবেন: Good-App নিজে থেকে ফেস না চাইলে আমাদের অ্যাপও চাইবে না — এতে আপনার স্লট বা ইনকামের কোনো ক্ষতি হয় না, মাসিক মাইনিং ঠিকঠাক চলতেই থাকবে 💙`,
  },
  {

    topic: "Whitelist হচ্ছে না / pending দেখাচ্ছে",
    screenshot: ["not whitelisted", "pending", "whitelist"],
    keywords: ["whitelist", "হোয়াইটলিস্ট", "pending", "check hoy na"],
    answer:
      `ফেস ভেরিফিকেশন সফল হওয়ার পর whitelist হতে কিছুটা সময় লাগে ⏳ আমাদের সিস্টেম <b>প্রতি কয়েক মিনিট পরপর অটো চেক</b> করে, whitelist হলেই স্লটে ✅ দেখাবে।\n\n` +
      `একটু অপেক্ষা করুন — নিজে থেকেই আপডেট হয়ে যাবে 💙`,
  },
];


/** Compact text block so the AI (and screenshot analyzer) knows these answers. */
export function builtinFaqKnowledge(
  rates?: { firstVerify: number; reVerify: number; referrer: number; promoFirst?: number | null; promoRe?: number | null; promoRef?: number | null },
): string {
  const body =
    `\n\n🧠 সাধারণ সমভাইয়া নির্ধারিত উত্তর (স্ক্রিনশট বা প্রশ্ন মিললে হুবহু এই তথ্য দিয়ে উত্তর দেবে):\n` +
    BUILTIN_FAQS.map(
      (f) =>
        `• [${f.topic}] স্ক্রিনশটে থাকতে পারে: ${f.screenshot.join(" / ")}\n  উত্তর: ${f.answer.replace(/<[^>]+>/g, "")}`,
    ).join("\n");
  return rates ? fillRates(body, rates) : body;
}


/**
 * ইনটেন্ট লেয়ার — হুবহু শব্দ না মিললেও প্রশ্নের "মানে" ধরে ফেলে।
 * আগে শুধু হুবহু substring মেলানো হতো, তাই "withdraw korsi kotokkhon lagbe"
 * টাইপ স্বাভাবিক প্রশ্নে বট "বুঝতে পারিনি" বলত। এখন দুই দল শব্দের (বিষয় + প্রশ্ন)
 * যেকোনো একটা করে মিললেই সঠিক উত্তর যায়।
 */
type IntentRule = { topic: string; groups: string[][] };

const TIME_WORDS = [
  "koto somoy", "kotosomoy", "kotokkhon", "koto khon", "kotdin", "koto din",
  "kobe", "kokhon", "koto deri", "deri", "late", "somoy lagbe", "lagbe",
  "কত সময়", "কতো সময়", "কতক্ষণ", "কতোক্ষণ", "কত ক্ষণ", "কবে", "কখন", "দেরি", "লাগবে", "কতদিন",
];

const INTENT_RULES: IntentRule[] = [
  {
    topic: "পেমেন্ট করতে কত সময়",
    groups: [
      [
        "withdraw", "withdrow", "withdraw request", "payment", "poyment", "taka tulsi",
        "taka tulechi", "taka nisi", "cash out", "উইথড্র", "উইথড্রো", "পেমেন্ট", "টাকা",
      ],
      TIME_WORDS,
    ],
  },
  {
    topic: "রি-ভেরিফাই করা যাচ্ছে না",
    groups: [
      ["re verify", "re-verify", "reverify", "রি ভেরিফাই", "রি-ভেরিফাই", "রিভেরিফাই"],
      [
        ...TIME_WORDS, "hocche na", "hoi na", "hoy na", "asche na", "ase na", "parchi na",
        "button", "হচ্ছে না", "হয় না", "আসছে না", "পারছি না", "বাটন",
      ],
    ],
  },
  {
    topic: "Whitelist হচ্ছে না",
    groups: [
      ["whitelist", "white list", "হোয়াইটলিস্ট", "হোয়াইট লিস্ট"],
      [
        ...TIME_WORDS, "hocche na", "hoi na", "hoy na", "pending", "atke", "হচ্ছে না",
        "হয় না", "পেন্ডিং", "আটকে", "check", "চেক",
      ],
    ],
  },
  {
    topic: "Gmail যুক্ত",
    groups: [
      ["gmail", "g mail", "email", "e-mail", "জিমেইল", "ইমেইল", "মেইল"],
      [
        "add", "jukto", "kivabe", "kemne", "kemon", "korbo", "dibo", "verify", "verification",
        "যোগ", "যুক্ত", "কিভাবে", "কেমনে", "করবো", "দিব", "দিবো", "ভেরিফাই", "ভেরিফিকেশন",
      ],
    ],
  },
  {
    topic: "অ্যাপ ডাউনলোড",
    groups: [
      ["download", "install", "apk", "ডাউনলোড", "ইনস্টল"],
      ["kivabe", "kemne", "korbo", "kothay", "koro", "কিভাবে", "কেমনে", "করবো", "কোথায়", "কোথা"],
    ],
  },
  {
    topic: "১০টার পর আরও স্লট",
    groups: [
      ["aro slot", "aro 10", "extra slot", "notun slot", "slot barale", "আরও স্লট", "আরো স্লট", "আরো ১০", "নতুন স্লট"],
      ["bonus", "বোনাস", "taka pabo", "টাকা পাবো", "pabo", "পাবো"],
    ],
  },
];

/** Normalize once: bengali digits → ascii, punctuation → space. */
function normText(text: string): string {
  const bn = "০১২৩৪৫৬৭৮৯";
  return String(text || "")
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[০-৯]/g, (d) => String(bn.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchIntent(text: string): BuiltinFaq | null {
  const hay = normText(text);
  if (!hay) return null;
  for (const rule of INTENT_RULES) {
    const ok = rule.groups.every((group) =>
      group.some((w) => hay.includes(normText(w))),
    );
    if (ok) {
      const f = builtinFaqByTopic(rule.topic);
      if (f) return f;
    }
  }
  return null;
}

/**
 * Fast deterministic match on plain text (no AI needed).
 * শুধু `keywords` দেখে মেলানো হয় — `screenshot` লাইনগুলো ছবির জন্য, লেখার জন্য নয়
 * (আগে "verify/ভেরিফাই" স্ক্রিনশট-শব্দের কারণে রি-ভেরিফাইয়ের প্রশ্নেও Gmail-এর উত্তর যেত)।
 * একাধিক মিললে সবচেয়ে লম্বা (সবচেয়ে নির্দিষ্ট) কিওয়ার্ডটি জেতে।
 */
export function matchBuiltinFaqText(text: string): BuiltinFaq | null {
  const hay = text.toLowerCase();
  if (!hay.trim()) return null;
  const hitLen = (k: string) => {
    const key = k.toLowerCase().trim();
    if (key.length < 3) return 0;
    // 3-letter keys (kyc, apk…) only count as a whole word, never inside another word.
    if (key.length === 3 && /^[a-z]+$/.test(key)) {
      return new RegExp(`(^|[^a-z])${key}([^a-z]|$)`, "i").test(hay) ? key.length : 0;
    }
    return key.length > 3 && hay.includes(key) ? key.length : 0;
  };
  let best: BuiltinFaq | null = null;
  let bestScore = 0;
  for (const f of BUILTIN_FAQS) {
    const score = Math.max(0, ...f.keywords.map(hitLen));
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  // হুবহু কিওয়ার্ড না মিললে মানে ধরে (intent) মেলানোর চেষ্টা।
  return best ?? matchIntent(text);
}



/** Find a built-in answer by its topic label (safer than an array index). */
export function builtinFaqByTopic(fragment: string): BuiltinFaq | null {
  const q = fragment.toLowerCase();
  return BUILTIN_FAQS.find((f) => f.topic.toLowerCase().includes(q)) ?? null;
}


export function builtinFaqReply(name: string, f: BuiltinFaq): string {
  const openers = [
    `${name}, বুঝিয়ে বলছি 🙂`,
    `আচ্ছা ${name}, ব্যাপারটা এমন 👇`,
    `${name} ভাই, চিন্তা করবেন না 😊`,
  ];
  return `${pick(openers)}\n\n${f.answer}`;
}
