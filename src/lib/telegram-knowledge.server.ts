// Server-only: the bot's built-in knowledge about how Good-App actually works.
// Fed into the AI prompt so the bot can answer earning/withdraw/verify questions
// itself instead of saying "admin will reply".

import { miningWindowInfo, nextOpenLabelBn } from "./mining-window";
import { builtinFaqKnowledge } from "./telegram-builtin-faq.server";
import { appRulebook } from "./telegram-app-rules.server";

export type AppRates = {
  firstVerify: number;
  reVerify: number;
  referrer: number;
  promo: boolean;
  promoTitle: string | null;
  promoFirst: number | null;
  promoRe: number | null;
  promoRef: number | null;
  usdtRate: number;
  rechargeOn: boolean;
};

export async function loadRates(): Promise<AppRates> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("bonus_settings").select("*").eq("id", "default").maybeSingle();
  const b: any = data ?? {};
  const now = Date.now();
  const promo =
    !!b.promo_active &&
    (!b.promo_start_at || new Date(b.promo_start_at).getTime() <= now) &&
    (!b.promo_end_at || new Date(b.promo_end_at).getTime() >= now);

  return {
    firstVerify: Number(b.first_verify_bonus ?? 50),
    reVerify: Number(b.reverify_bonus ?? 200),
    referrer: Number(b.referrer_bonus ?? 100),
    promo,
    promoTitle: promo ? (b.promo_title ?? null) : null,
    promoFirst: promo ? Number(b.promo_first_verify_bonus ?? 0) || null : null,
    promoRe: promo ? Number(b.promo_reverify_bonus ?? 0) || null : null,
    promoRef: promo ? Number(b.promo_referrer_bonus ?? 0) || null : null,
    usdtRate: Number(b.usdt_rate_bdt ?? 130),
    rechargeOn: b.recharge_enabled !== false,
  };
}

const tk = (n: number) => `${Math.round(n)}৳`;

/** Big Bengali knowledge block used as the bot's source of truth. */
export function knowledgeText(r: AppRates): string {
  const first = r.promoFirst ?? r.firstVerify;
  const re = r.promoRe ?? r.reVerify;
  const ref = r.promoRef ?? r.referrer;
  return `📚 Good-App এর আসল নিয়ম (এই তথ্যগুলোই সত্য, এগুলো থেকেই উত্তর দেবে):

💰 আয়ের ধাপ:
1) একাউন্ট খুলে ১০টি স্লটে ফেস ভেরিফিকেশন (১ম ভেরিফাই) সম্পন্ন করতে হয়।
2) ১০টি স্লট সম্পন্ন করলে ইউজার নিজে পায় ${tk(first)} বোনাস${r.promo ? " (এখন 2X অফার চলছে)" : ""}।
3) এরপর ৩–৪ দিন পর প্রতিটি স্লট আবার রি-ভেরিফাই করতে হয়। ১০টি স্লট রি-ভেরিফাই সম্পন্ন হলে ইউজার পায় ${tk(re)} এবং তার মাইনিং চালু হয়ে যায়।
4) যিনি রেফার করেছেন তিনি পান: রেফারির ১০টি ১ম ভেরিফাই সম্পন্ন হলে ${tk(ref)}, আর ঐ রেফারি ১০টি রি-ভেরিফাই সম্পন্ন করলে আরও ${tk(re)} — অর্থাৎ একজন রেফার থেকে মোট ${tk(ref + re)} পর্যন্ত।
5) রি-ভেরিফাই চালু থাকলে প্রতি মাসে মাইনিং থেকেও আয় হয়।
${r.promo && r.promoTitle ? `🎊 চলমান অফার: ${r.promoTitle}\n` : ""}
🏦 উইথড্র নিয়ম:
- বোনাসের টাকা যেকোনো সময় উইথড্র করা যায়।
- মাইনিংয়ের টাকা প্রতি মাসের ১ তারিখ থেকে ৩ তারিখ পর্যন্ত (৩ দিন) উইথড্র করা যায়; এই সময়ে না নিলে পরের মাসের ১ তারিখ পর্যন্ত লক থাকে।
- bKash/Nagad এ উইথড্র হয়। USDT (Celo) রেট ${r.usdtRate}৳।
- দিনে সর্বোচ্চ ৩টি উইথড্র রিকোয়েস্ট দেওয়া যায়।

💸 প্ল্যাটফর্ম ফি (টাকা কম আসার কারণ — খুব গুরুত্বপূর্ণ):
- ১০০৳ এর কম রিকোয়েস্টে ফি ২০%, ১০০৳ বা তার বেশি রিকোয়েস্টে ফি ১০%।
- অর্থাৎ ৪০০৳ রিকোয়েস্ট দিলে ১০% = ৪০৳ ফি কেটে হাতে আসে ৩৬০৳। ২০০৳ দিলে ২০৳ কেটে ১৮০৳, ৫০৳ দিলে ১০৳ কেটে ৪০৳।
- কেউ "কম টাকা পেয়েছি" বললে এই হিসাবটাই সুন্দর করে দেখিয়ে বুঝিয়ে দেবে — এটা কোনো ভুল নয়, সার্ভিস/প্ল্যাটফর্ম ফি।
${r.rechargeOn ? "- মোবাইল রিচার্জ চালু আছে, ন্যূনতম ২০৳ থেকে রিচার্জ নেওয়া যায়।\n" : ""}
✅ ভেরিফিকেশন টিপস (কেউ বললে "একাউন্ট হয় না"/"ভেরিফাই হয় না"/"re-verify হয় না" — এগুলো বলবে):
- একটি ব্রাউজার দিয়ে ২টির বেশি একাউন্ট করবেন না; প্রতি ব্রাউজারে সর্বোচ্চ ২টি।
- Play Store থেকে নতুন নতুন ব্রাউজার নামিয়ে (Firefox, Opera, Mises, Brave) সেগুলো দিয়ে করুন।
- ফোনটি একবার বন্ধ করে চালু করুন, এরপর Airplane mode একবার অন করে অফ করুন (IP বদলে যায়)।
- WiFi নয়, মোবাইল ডেটা দিয়ে চেষ্টা করুন।
- ১৮ বছরের বেশি বয়সের ফেস দিয়ে ভেরিফাই করুন; কম বয়সী ফেসে অনেক সময় হয় না এবং পরে রি-ভেরিফাইয়ে সমস্যা হয়।
- মুখে পর্যাপ্ত আলো রাখুন, চশমা/টুপি খুলে নিন।

🔢 স্লট: ইউজারের স্লট সংখ্যা ১০ এর বেশিও হতে পারে (যেমন ২৩, ২৫ নম্বর স্লট)। কখনো বলবে না "১ থেকে ১০ এর মধ্যে"; যেকোনো স্লট নম্বর রিসেট করা যায়।

🔑 একাউন্ট ও পাসওয়ার্ড (খুব গুরুত্বপূর্ণ — এর বাইরে কিছু বানিয়ে বলবে না):
- আমাদের অ্যাপে কোনো <b>OTP</b>, কোনো <b>"Forgot Password"</b> বা নিজে থেকে পাসওয়ার্ড রিসেট করার সিস্টেম <b>নেই</b>।
- পাসওয়ার্ড ভুলে গেলে ইউজার নিজে বদলাতে পারবেন না — <b>অ্যাডমিনের মাধ্যমে</b> পাসওয়ার্ড পরিবর্তন করিয়ে নিতে হয়। তাই অ্যাডমিনকে মেনশন/ইনবক্স করতে বলবে।
- কোনো ইমেইল/লিংক/কোড পাঠানোর কথা কখনো বলবে না — এমন কোনো ব্যবস্থা নেই।${appRulebook(r)}${builtinFaqKnowledge()}`;
}

/** Ready-made, well formatted answer for "কিভাবে টাকা পাবো" type questions. */
export function earningGuideReply(name: string, r: AppRates): string {
  const first = r.promoFirst ?? r.firstVerify;
  const re = r.promoRe ?? r.reVerify;
  const ref = r.promoRef ?? r.referrer;
  const openers = [
    `${name}, খুব সহজ 🙂 নিচের ধাপগুলো মানলেই টাকা আসবে 👇`,
    `আচ্ছা ${name}, দেখুন — আয়ের নিয়মটা একদম সোজা 👇`,
    `${name} ভাই, বুঝিয়ে বলছি 😊 এইভাবেই টাকা পাবেন 👇`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `<b>১️⃣ প্রথম ধাপ:</b> ১০টি স্লটে ফেস ভেরিফিকেশন করুন → আপনি পাবেন <b>${tk(first)}</b>\n` +
    `<b>২️⃣ দ্বিতীয় ধাপ:</b> ৩–৪ দিন পর সেই ১০টি স্লট আবার <b>রি-ভেরিফাই</b> করুন → পাবেন <b>${tk(re)}</b> এবং আপনার <b>মাইনিং চালু</b> হয়ে যাবে ⛏️\n` +
    `<b>৩️⃣ রেফার:</b> আপনার রেফারে কেউ ১০টি ১ম ভেরিফাই করলে <b>${tk(ref)}</b>, সেই একই ইউজার ১০টি রি-ভেরিফাই করলে আরও <b>${tk(re)}</b> — একজন থেকেই <b>${tk(ref + re)}</b> পর্যন্ত 💵\n\n` +
    `🏦 <b>উইথড্র:</b> বোনাসের টাকা যেকোনো সময় তোলা যায়। মাইনিংয়ের টাকা প্রতি মাসের <b>১–৩ তারিখ</b> এর মধ্যে তুলতে হয়।\n` +
    (r.promo && r.promoTitle ? `\n🎊 ${r.promoTitle}\n` : "") +
    `\nকোনো ধাপে আটকে গেলে বলুন, আমি সাথে সাথে দেখে দিচ্ছি 💙`
  );
}

/** Direct answer for "উইথড্র দিতে পারব?" without requiring UID. */
export function withdrawEligibilityReply(name: string): string {
  const win = miningWindowInfo();
  const openLine = win.isOpen
    ? `✅ এখন মাইনিং উইথড্র উইন্ডো খোলা আছে — আজই রিকোয়েস্ট দিতে পারবেন।`
    : `🔒 মাইনিং ব্যালেন্স এখন লক — <b>${nextOpenLabelBn()}</b> থেকে আবার উইথড্র দিতে পারবেন (আর ${win.daysUntilOpen.toLocaleString("bn-BD")} দিন)।`;

  return (
    `${name}, স্ক্রিনশটে যদি <b>বোনাস ০৳</b> দেখায় আর টাকা <b>মাইনিং ব্যালেন্সে</b> থাকে, তাহলে এখনই withdraw হবে না।\n\n` +
    `${openLine}\n\n` +
    `🎁 <b>বোনাস</b> থাকলে সেটা যেকোনো সময় withdraw করা যায়।\n` +
    `⛏️ <b>মাইনিং</b> টাকা শুধু প্রতি মাসের <b>১, ২, ৩ তারিখ</b> withdraw করা যায়।\n\n` +
    `তাই আপনার টাকাটা যদি mining-এর হয়, ওই তারিখে unblock হলে withdraw দিন 🙂`
  );
}

/** Rules answer for "account/verify hoy na" questions. */
export function verifyTipsReply(name: string): string {
  const openers = [
    `${name}, এটা খুব common 🙂 নিচের নিয়মে করলেই হয়ে যাবে 👇`,
    `আচ্ছা ${name}, এভাবে চেষ্টা করুন — বেশিরভাগ সময় কাজ হয়ে যায় 👇`,
    `${name} ভাই, চিন্তা করবেন না 😊 নিচের ধাপগুলো ফলো করুন 👇`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `<b>১️⃣</b> একটি ব্রাউজার দিয়ে <b>২টির বেশি একাউন্ট করবেন না</b> — প্রতি ব্রাউজারে সর্বোচ্চ ২টি।\n` +
    `<b>২️⃣</b> Play Store থেকে <b>নতুন ব্রাউজার</b> নামান (Firefox, Opera, Mises, Brave) এবং সেটা দিয়ে করুন।\n` +
    `<b>৩️⃣</b> ফোনটা <b>বন্ধ করে চালু</b> করুন, তারপর <b>Airplane mode</b> একবার অন করে অফ করুন।\n` +
    `<b>৪️⃣</b> <b>WiFi নয়, মোবাইল ডেটা</b> দিয়ে চেষ্টা করুন।\n` +
    `<b>৫️⃣</b> অবশ্যই <b>১৮ বছরের বেশি বয়সের ফেস</b> দিয়ে ভেরিফাই করুন — কম বয়সী ফেসে ভেরিফাই না-ও হতে পারে, আর পরে রি-ভেরিফাইয়ে সমস্যা হয়।\n` +
    `<b>৬️⃣</b> মুখে ভালো আলো রাখুন, চশমা/টুপি খুলে নিন।\n\n` +
    `এরপরও না হলে জানাবেন — আমরা পাশে আছি 💙`
  );
}


/** Answer for "এখানে face verification করতে কী কী লাগে?" */
export function verifyRequirementsReply(name: string): string {
  const openers = [
    `${name}, খুব সহজ 🙂 আমাদের অ্যাপে শুধু <b>ফেস ভেরিফিকেশন</b> করলেই হয়ে যায় 👇`,
    `আচ্ছা ${name}, ঝামেলা একদমই নেই 😊 যা যা লাগবে 👇`,
    `${name} ভাই, এখানে কাজ করতে বেশি কিছুই লাগে না 👇`,
  ];
  const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return (
    `${pick(openers)}\n\n` +
    `✅ <b>যা যা লাগবে:</b>\n` +
    `<b>১️⃣</b> একটি <b>স্মার্টফোন</b> ও ইন্টারনেট (WiFi এর চেয়ে মোবাইল ডেটা ভালো কাজ করে)।\n` +
    `<b>২️⃣</b> একটি <b>ভালো ব্রাউজার</b> — Firefox / Opera / Mises / Brave (এক ব্রাউজারে সর্বোচ্চ ২টি একাউন্ট)।\n` +
    `<b>৩️⃣</b> <b>১৮+ বয়সের একটি আসল ফেস</b> — ক্যামেরার সামনে মুখ দেখালেই হবে।\n` +
    `<b>৪️⃣</b> মুখে ভালো আলো, চশমা/টুপি/মাস্ক খোলা।\n` +
    `<b>৫️⃣</b> ক্যামেরার <b>permission</b> Allow করা।\n\n` +
    `🚫 <b>যা লাগবে না:</b>\n` +
    `• কোনো <b>NID / জাতীয় পরিচয়পত্র</b> লাগে না\n` +
    `• কোনো <b>জন্ম নিবন্ধন, পাসপোর্ট বা ডকুমেন্ট</b> লাগে না\n` +
    `• কোনো <b>ইনভেস্ট বা টাকা</b> লাগে না\n` +
    `• সেলফি ছবি আপলোড করা লাগে না — শুধু লাইভ ফেস স্ক্যান\n\n` +
    `🔐 আমরা কারো ছবি সংরক্ষণ করি না — ভেরিফিকেশন সরাসরি Good-App এর সিস্টেমে হয়।\n\n` +
    `এরপর ১০টি স্লট ফেস ভেরিফাই করলেই বোনাস শুরু, আর ৩–৪ দিন পর রি-ভেরিফাই করলে মাইনিং চালু হয়ে যায় 💙`
  );
}

const bn = (n: number) =>
  Math.round(n).toLocaleString("en-US").replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

/** পূর্ণ ১০ স্লটে মাসিক মাইনিং ≈ ৫০০৳ → প্রতি স্লটে ৫০৳/মাস। */
export const MONTHLY_PER_SLOT = 50;

/**
 * "৫০টা রি-ভেরিফাই থাকলে মাসে কত?" — দুইটা আলাদা হিসাব:
 *  • বোনাস = একবারই পাওয়া যায় (one-time)
 *  • মাইনিং = প্রতি মাসে (স্লট × ৫০৳)
 * monthly=true হলে মাসিক মাইনিংকেই মূল উত্তর বানানো হয়।
 */
export function slotEarningReply(
  name: string,
  r: AppRates,
  slots?: number | null,
  monthly?: boolean,
): string {
  const first = r.promoFirst ?? r.firstVerify;
  const re = r.promoRe ?? r.reVerify;
  const perSlotFirst = first / 10;
  const perSlotRe = re / 10;
  const perSlotTotal = perSlotFirst + perSlotRe;

  const base = 10 * MONTHLY_PER_SLOT; // ১০ স্লট = ৫০০৳
  const monthlyLine = (n: number) =>
    `• <b>${bn(n)} স্লট</b>  →  মাসে <b>${bn(n * MONTHLY_PER_SLOT)}৳</b>`;

  const others = [10, 20, 50].filter((n) => !slots || n !== slots).slice(0, 3);

  if (monthly || !slots) {
    if (slots) {
      return (
        `${name}, ১০ স্লট = ${bn(base)}৳/মাস, তাই ১ স্লট = ${bn(MONTHLY_PER_SLOT)}৳।\n\n` +
        `✅ <b>${bn(slots)} স্লট = মাসে ${bn(slots * MONTHLY_PER_SLOT)}৳</b> (প্রতি মাসেই) ⛏️\n\n` +
        `🎁 সাথে এককালীন বোনাস <b>${bn(slots * perSlotTotal)}৳</b> (একবারই) 💙`
      );
    }
    return (
      `${name}, ১০ স্লট = ${bn(base)}৳/মাস → ১ স্লট = <b>${bn(MONTHLY_PER_SLOT)}৳</b>/মাস।\n\n` +
      `${others.map(monthlyLine).join("\n")}\n\n` +
      `📈 স্লটের লিমিট নেই 💙`
    );
  }

  return (
    `${name}, ${bn(slots)} স্লট 👇\n\n` +
    `⛏️ মাসে <b>${bn(slots * MONTHLY_PER_SLOT)}৳</b> (১ স্লট = ${bn(MONTHLY_PER_SLOT)}৳)\n\n` +
    `🎁 এককালীন বোনাস <b>${bn(slots * perSlotTotal)}৳</b> (একবারই) 💙`
  );
}


/**
 * "আমি যাকে রেফার করবো সে ১০টি রি-ভেরিফাই করলে আমি কত পাবো?" —
 * রেফারারের আয়: এককালীন বোনাস + প্রতি মাসে ১০% মাইনিং কমিশন।
 */
export function referralEarningReply(name: string, r: AppRates): string {
  const ref = r.promoRef ?? r.referrer;
  const re = r.promoRe ?? r.reVerify;
  const monthlyFull = 10 * MONTHLY_PER_SLOT; // ১০ স্লট = ৫০০৳/মাস
  const commission = Math.round(monthlyFull * 0.10); // ১০% = ৫০৳/মাস
  return (
    `${name}, রেফার থেকে আপনার আয়টা এভাবে হয় 👇\n\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `🎁 <b>এককালীন বোনাস (একবারই)</b>\n\n` +
    `১) আপনার রেফারে আসা ইউজার <b>১০টি স্লট ১ম ভেরিফাই</b> সম্পন্ন করলে → আপনি পাবেন <b>${tk(ref)}</b>\n\n` +
    `২) ঐ একই ইউজার <b>১০টি স্লট রি-ভেরিফাই</b> সম্পন্ন করলে → আপনি পাবেন আরও <b>${tk(re)}</b>\n\n` +
    `✅ অর্থাৎ একজন রেফার থেকেই মোট <b>${tk(ref + re)}</b> 💵\n\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `⛏️ <b>প্রতি মাসের কমিশন (চলতেই থাকবে)</b>\n\n` +
    `ঐ ইউজারের রি-ভেরিফাই সম্পন্ন হয়ে <b>মাইনিং চালু</b> হলে, তার মাইনিং থেকে আপনি প্রতি মাসে <b>১০%</b> কমিশন পাবেন।\n\n` +
    `হিসাব: ১০টি স্লটে মাসে ${bn(monthlyFull)}৳ → তার ১০% = <b>${bn(commission)}৳ প্রতি মাসে</b>\n\n` +
    `📈 এভাবে ৫ জন রেফার করলে = মাসে <b>${bn(commission * 5)}৳</b>, ১০ জন হলে = মাসে <b>${bn(commission * 10)}৳</b> — রেফার যত বেশি, মাসিক আয়ও তত বেশি।\n\n` +
    `━━━━━━━━━━━━━━\n\n` +
    `🔓 মনে রাখবেন: রেফার লিংক চালু হতে আপনার নিজের <b>১০টি স্লট ১ম ভেরিফাই</b> সম্পন্ন থাকতে হবে।\n\n` +
    `🏦 বোনাসের টাকা যেকোনো সময় তোলা যায়, মাইনিংয়ের টাকা প্রতি মাসের <b>১–৩ তারিখে</b> 💙`
  );
}
