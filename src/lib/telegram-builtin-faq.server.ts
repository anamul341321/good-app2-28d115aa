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

export const BUILTIN_FAQS: BuiltinFaq[] = [
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
      `খুব ভালো প্রশ্ন স্যার 👏 পরিষ্কার করে বলি —\n\n` +
      `🎁 <b>বোনাস শুধু প্রথম ১০টি স্লটের জন্যই</b>\n` +
      `• প্রথম ১০টি স্লট <b>ফার্স্ট ভেরিফাই</b> সম্পন্ন হলে → <b>১০০৳ বোনাস</b>\n` +
      `• সেই ১০টি স্লট <b>রি-ভেরিফাই</b> সম্পন্ন হলে → <b>৪০০৳ বোনাস</b> + আপনার <b>মাসিক মাইনিং চালু</b> ✅\n\n` +
      `➕ <b>এরপর আরও ১০টি স্লট যোগ করলে?</b>\n` +
      `• সেগুলোও ফার্স্ট ভেরিফাই + রি-ভেরিফাই করতেই হবে (নিয়ম একই)\n` +
      `• কিন্তু বাকি স্লটগুলোর জন্য <b>আলাদা কোনো বোনাস পাবেন না</b>\n` +
      `• তবে আপনার <b>মাসিক মাইনিং দ্বিগুণ</b> হয়ে যাবে — ১০ স্লটে ৫০০৳ হলে ২০ স্লটে <b>১০০০৳ (2X)</b> 🚀\n\n` +
      `📈 হিসাবটা সহজ: <b>১ স্লট = মাসে ৫০৳</b>। ৩০ স্লট = ১৫০০৳, ৫০ স্লট = ২৫০০৳ — যত বেশি স্লট, তত বেশি মাসিক ইনকাম, সারাজীবনের জন্য।\n\n` +
      `⏰ <b>মনে রাখবেন:</b> আমাদের <b>৫০,০০০+ ইউজার</b> পূর্ণ হওয়ার আনন্দে চলমান <b>2X বোনাস অফারটি আগামী ৭ আগস্ট ২০২৬</b> তারিখে শেষ হয়ে যাবে — এরপর আর কোনো বোনাস থাকবে না। তবে <b>মাসিক মাইনিং সারাজীবন চলতেই থাকবে</b> 💙\n\n` +
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
      `স্যার, এটা কোনো অফার সাইট বা প্রমোশন ওয়েবসাইট <b>নয়</b> 🙂\n\n` +
      `🌍 এটি একটি <b>Universal Basic Income (UBI)</b> সিস্টেম — অর্থাৎ মানুষ যেন প্রতি মাসে নিয়মিত একটা আয় পায়, সেই উদ্দেশ্যেই এটি <b>স্থায়ীভাবে (permanently)</b> ডিজাইন করা হয়েছে।\n\n` +
      `✅ তাই এটি কোনোদিন বন্ধ হবে না — আপনার স্লটগুলো সচল থাকলে <b>মাসিক মাইনিং সারাজীবন</b> চলতে থাকবে।\n` +
      `🔁 শুধু মাঝে মাঝে (৩–৪ মাস পর) রি-ভেরিফাই চাওয়া হতে পারে, যাতে টাকা আসল মালিকের হাতেই যায়।\n\n` +
      `⏰ শুধু <b>বোনাস অফারটি</b> সময়সীমা-নির্ভর (৭ আগস্ট ২০২৬-এ শেষ) — কিন্তু <b>মাসিক ইনকাম চিরস্থায়ী</b> 💙`,
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
      `জি স্যার, <b>পরবর্তীতে আবার রি-ভেরিফাই চাওয়া হতে পারে</b> — এটা কোনো সমস্যা নয়, এটা আমাদের নিয়মিত নিরাপত্তা যাচাই 🙂\n\n` +
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
      `স্যার, আপনি যে ফেস দিয়ে ভেরিফিকেশন করার চেষ্টা করছেন, সেই ফেস দিয়ে আমাদের অ্যাপে <b>আগে থেকেই একটি ফেস ভেরিফিকেশন করা আছে</b> ✅\n\n` +
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
      "20 bochor", "২০ বছর", "২১ বছর", "২২ বছর", "20 years", "tar boyos 20",
      "তবুও এই সমস্যা", "tao hocche na", "tao hoy na", "tao hocche na", "boyos beshi tao",
      "প্রাপ্তবয়স্ক তবুও", "বড় মানুষের ফেস দিয়েও", "boro manusher face diyeo",
    ],
    answer:
      `আসলে অনেক মানুষের বয়স ২০ বছরের বেশি হলেও দেখতে বয়সে ছোট মনে হয় 🙂\n\n` +
      `ফেস ভেরিফিকেশন সিস্টেম শুধু জন্মতারিখ দেখে না — <b>মুখের গঠন ও বয়সের আনুমানিক ধারণাও যাচাই করে</b>। ` +
      `তাই বয়স ২০+ হলেও যদি দেখতে কম বয়সী লাগে, তাহলে ভেরিফিকেশন সম্পন্ন নাও হতে পারে।\n\n` +
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
      `স্যার, আগে একবার ক্যামেরার পারমিশন <b>Allow</b> না দেওয়ায় ব্রাউজারটি ক্যামেরা ব্লক করে রেখেছে 📷\n\n` +
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
    topic: "Whitelist হচ্ছে না / pending দেখাচ্ছে",
    screenshot: ["not whitelisted", "pending", "whitelist"],
    keywords: ["whitelist", "হোয়াইটলিস্ট", "pending", "check hoy na"],
    answer:
      `ফেস ভেরিফিকেশন সফল হওয়ার পর whitelist হতে কিছুটা সময় লাগে ⏳ আমাদের সিস্টেম <b>প্রতি কয়েক মিনিট পরপর অটো চেক</b> করে, whitelist হলেই স্লটে ✅ দেখাবে।\n\n` +
      `একটু অপেক্ষা করুন — নিজে থেকেই আপডেট হয়ে যাবে 💙`,
  },
];

/** Compact text block so the AI (and screenshot analyzer) knows these answers. */
export function builtinFaqKnowledge(): string {
  return (
    `\n\n🧠 সাধারণ সমস্যার নির্ধারিত উত্তর (স্ক্রিনশট বা প্রশ্ন মিললে হুবহু এই তথ্য দিয়ে উত্তর দেবে):\n` +
    BUILTIN_FAQS.map(
      (f) =>
        `• [${f.topic}] স্ক্রিনশটে থাকতে পারে: ${f.screenshot.join(" / ")}\n  উত্তর: ${f.answer.replace(/<[^>]+>/g, "")}`,
    ).join("\n")
  );
}

/** Fast deterministic match on plain text (no AI needed). */
export function matchBuiltinFaqText(text: string): BuiltinFaq | null {
  const hay = text.toLowerCase();
  if (!hay.trim()) return null;
  for (const f of BUILTIN_FAQS) {
    const hit = [...f.keywords, ...f.screenshot].some(
      (k) => k.length > 3 && hay.includes(k.toLowerCase()),
    );
    if (hit) return f;
  }
  return null;
}

export function builtinFaqReply(name: string, f: BuiltinFaq): string {
  const openers = [
    `${name}, বুঝিয়ে বলছি 🙂`,
    `আচ্ছা ${name}, ব্যাপারটা এমন 👇`,
    `${name} ভাই, চিন্তা করবেন না 😊`,
  ];
  return `${pick(openers)}\n\n${f.answer}`;
}
