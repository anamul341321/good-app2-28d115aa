/**
 * নিরাপত্তা গার্ড: সাধারণ ইউজার যেন বটকে দিয়ে গোপন তথ্য (ছবি/কী সংরক্ষণ),
 * ছবি চাওয়া, ব্যালেন্স বাড়ানো বা অ্যাপের কোনো সেটিং বদলানোর কাজ করাতে না পারে।
 */

const PHOTO_ASK =
  /(ছবি|পিক|পিকচার|ফটো|photo|pic|image|selfie|সেলফি|face\s*pic|ফেসের\s*ছবি)/i;
const STORAGE_ASK =
  /(সেভ|সংরক্ষ|জমা|store|saved|save|রাখা\s*হয়|রাখেন|কোথায়\s*(থাকে|রাখ)|database|ডেটাবেজ|সার্ভার)/i;
const KEY_ASK =
  /(private\s*key|প্রাইভেট\s*কী|প্রাইভেট\s*কি|wallet\s*key|ওয়ালেট\s*কী|seed|সিড|পাসফ্রেজ|mnemonic|key\s*(দেন|দাও|দিবেন|চাই))/i;
const BALANCE_EDIT =
  /(ব্যালেন্স|balance|টাকা|তক|টাকাটা|amount|এমাউন্ট)\s*[^\n]{0,20}(বাড়া|বারা|বাড়িয়ে|এড|add|যোগ|increase|বসিয়ে|সেট|set|কমিয়ে|edit|এডিট|চেঞ্জ|change)/i;
const BALANCE_EDIT2 =
  /(বাড়িয়ে|বারিয়ে|এড\s*কর|যোগ\s*কর|সেট\s*কর|এডিট\s*কর|change|increase)[^\n]{0,20}(ব্যালেন্স|balance|টাকা|amount)/i;
const ADMIN_ACTION =
  /(তুমি|তুই|বট|bot)?[^\n]{0,20}(এডিট|edit|পরিবর্তন|change|সেটিং|setting|অন\s*কর|অফ\s*কর|চালু\s*কর|বন্ধ\s*কর|approve|অ্যাপ্রুভ|ভেরিফাই\s*করে\s*দ|whitelist\s*করে\s*দ|রিসেট\s*করে\s*দ)[^\n]{0,20}(দাও|দিবা|দিবেন|করো|কর|করে\s*দাও|করা\s*যাবে|পারবা|পারবে)/i;

export type GuardKind = "photo" | "key" | "storage" | "balance" | "action";

export function detectSensitive(raw: string): GuardKind | null {
  const t = (raw || "").trim();
  if (!t) return null;
  if (KEY_ASK.test(t)) return "key";
  if (PHOTO_ASK.test(t) && /(দেন|দাও|দিবেন|চাই|পাঠা|send|দেখা|show|আছে|থাকে)/i.test(t)) {
    return STORAGE_ASK.test(t) ? "storage" : "photo";
  }
  if (STORAGE_ASK.test(t) && (PHOTO_ASK.test(t) || KEY_ASK.test(t))) return "storage";
  if (BALANCE_EDIT.test(t) || BALANCE_EDIT2.test(t)) return "balance";
  if (ADMIN_ACTION.test(t)) return "action";
  return null;
}

export function sensitiveReply(kind: GuardKind, name?: string): string {
  const who = name ? `${name}, ` : "";
  switch (kind) {
    case "key":
      return `${who}দুঃখিত 🙏 কোনো key সংক্রান্ত তথ্য আমরা কাউকে দিই না — এটা সম্পূর্ণ নিষিদ্ধ ও নিরাপত্তার নিয়ম।\nএ ধরনের তথ্য কেউ চাইলে সাবধান থাকবেন 💙`;
    case "photo":
    case "storage":
      return `${who}দুঃখিত 🙏 ভেরিফিকেশনের কোনো ছবি বা ব্যক্তিগত তথ্য কাউকে দেখানো বা পাঠানো হয় না।\nআপনার তথ্য সম্পূর্ণ সুরক্ষিত এবং শুধু নিরাপত্তা যাচাইয়ের কাজে ব্যবহৃত হয় 💙`;
    case "balance":
      return `${who}দুঃখিত 🙏 ব্যালেন্স বা টাকার পরিমাণ আমি বদলাতে পারি না — এটা সম্পূর্ণ অটোমেটিক সিস্টেমে হিসাব হয়।\nকাজ করলেই ব্যালেন্স নিজে থেকেই বাড়বে ✅`;
    default:
      return `${who}দুঃখিত 🙏 অ্যাপের কোনো সেটিং বা একাউন্টে পরিবর্তন আমি ইউজারের অনুরোধে করতে পারি না — এটা শুধু অ্যাডমিন করতে পারেন।\nকোনো সমস্যা থাকলে বলুন, আমি সাহায্য করছি 💙`;
  }
}

/**
 * সাহায্য করার প্রস্তাব / ভদ্র কথা — এগুলো কখনোই warning বা ফ্রিজের কারণ নয়।
 * যেমন: "যারা কাজ বুঝতেছেন না, আমাকে ইনবক্স করেন" — এটা helpful, spam নয়।
 */
const HELPFUL =
  /(সাহায্য|help|হেল্প|বুঝ|bujh|bujte|বুঝতে|শিখ|shikh|জিজ্ঞ|জানতে চান|inbox|ইনবক্স|ইনবক্স করেন|nock|নক|knock|message|মেসেজ|বলবেন|জানাবেন|dekhiye|দেখিয়ে|শেখা|guide|গাইড)/i;
const ABUSIVE =
  /(চুদ|চোদ|মাদার|বাল|খানকি|শালা|কুত্তা|শুয়ে?র|হারাম\s*জাদা|বেশ্যা|fuck|f\*ck|bitch|bastard|madar|chud|khanki|kutta|suar)/i;
const SCAMMY =
  /(dm\s*me\s*for\s*(money|earn)|invest\s*kore\s*double|টাকা\s*ডাবল|hack|হ্যাক|otp\s*(দেন|দিন|share)|account\s*(kine|বিক্রি|sell|kinbo))/i;

export function looksHelpful(raw: string): boolean {
  const t = (raw || "").trim();
  if (!t) return false;
  if (ABUSIVE.test(t) || SCAMMY.test(t)) return false;
  return HELPFUL.test(t);
}

/** স্পষ্ট গালি/স্ক্যাম — শুধু এগুলোতেই ফ্রিজ হবে। */
export function isHardAbuse(raw: string): boolean {
  const t = (raw || "").trim();
  return !!t && (ABUSIVE.test(t) || SCAMMY.test(t));
}
