import { createFileRoute, Link } from "@tanstack/react-router";
import { litePolicySections, liteText } from "@/lib/lite-policy";
import { useLang } from "@/lib/i18n";
import { RegionBadge } from "@/components/RegionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FileText, ShieldCheck, Coins, UserCheck, Wallet, Gift, AlertTriangle, Scale, Mail, ArrowLeft, ScanFace } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "নিয়ম ও শর্তাবলি | Good-App" },
      { name: "description", content: liteText("Good-App ব্যবহারের নিয়ম, ফেস ভেরিফিকেশন, বোনাস, উইথড্র, রেফারেল ও একাউন্ট নিরাপত্তার সব শর্তাবলি এক জায়গায়।", "Good-App ব্যবহারের নিয়ম: একাউন্ট, ফেস ভেরিফিকেশন, মেসেঞ্জার, কনটেন্ট ও একাউন্ট নিরাপত্তার শর্তাবলি।") },
      { property: "og:title", content: "নিয়ম ও শর্তাবলি | Good-App" },
      { property: "og:description", content: liteText("Good-App-এর ব্যবহারবিধি, উইথড্র নিয়ম ও গোপনীয়তা নীতি বিস্তারিত পড়ুন।", "Good-App-এর ব্যবহারবিধি, কনটেন্ট নিয়ম ও গোপনীয়তা নীতি বিস্তারিত পড়ুন।") },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

const SECTIONS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: UserCheck,
    title: "১. একাউন্ট ও পরিচয়",
    points: [
      "একটি মোবাইল নম্বর ও একটি Gmail দিয়ে শুধুমাত্র একটি একাউন্ট খোলা যাবে।",
      "নিজের আসল নাম ও নিজের নম্বর ব্যবহার করতে হবে; ভুল বা অন্যের তথ্য দিলে একাউন্ট বাতিল হবে।",
      "একই টেলিগ্রাম দিয়ে একাধিক একাউন্টের KYC করা যাবে না — এক টেলিগ্রাম = এক UID।",
      "একাউন্টের পাসওয়ার্ড ও কোড (OTP) কাউকে শেয়ার করা যাবে না; শেয়ার করলে দায় ব্যবহারকারীর।",
    ],
  },
  {
    icon: ShieldCheck,
    title: "২. ফেস ভেরিফিকেশন",
    points: [
      "ব্যবহারকারী প্রকৃত মানুষ কি না — শুধু সেটি নিশ্চিত করতেই ফেস ভেরিফিকেশন নেওয়া হয়।",
      "NID, OTP, ব্যাংক PIN বা পাসওয়ার্ড কখনোই চাওয়া হয় না। ভেরিফিকেশন সম্পূর্ণ ঐচ্ছিক।",
      "অন্যের ছবি, ভিডিও বা ফেক ফেস ব্যবহার করলে একাউন্ট স্থায়ীভাবে বন্ধ ও পেমেন্ট বাতিল হবে।",
      "Good-App whitelist বাতিল হলেই রি-ভেরিফাই চাওয়া হবে; whitelist ঠিক থাকলে কিছু করতে হবে না।",
    ],
  },
  {
    icon: ScanFace,
    title: "৩. লগইন পদ্ধতি ও ফেস বাইন্ডিং",
    points: [
      "নতুন সিস্টেমে রেজিস্ট্রেশন ধাপে ধাপে হয়: নাম ও নম্বর → পাসওয়ার্ড → লাইভ ক্যামেরায় ফেস ছবি → GoodDollar ফেস ভেরিফিকেশন। whitelist সফল না হলে একাউন্ট তৈরি হবে না।",
      "লগইনে লাইভ ফেস স্ক্যান করতে হবে (গ্যালারির ছবি গ্রহণযোগ্য নয়); ফেস মিললে একাউন্ট চিহ্নিত হবে এবং পাসওয়ার্ড দিয়ে প্রবেশ সম্পন্ন হবে।",
      "ভবিষ্যতে ফেস লগইনই একমাত্র লগইন পদ্ধতি হতে পারে। তাই পুরোনো (নম্বর/পাসওয়ার্ড বা Google) ব্যবহারকারীদের সেটিংস → “ফেস লগইন বাইন্ড করুন” থেকে একবার ফেস বাইন্ড করে নিতে অনুরোধ করা হচ্ছে — এটি ২-ধাপ নিরাপত্তা (2FA) হিসেবেও কাজ করবে।",
      "যাদের স্লট/GoodDollar ভেরিফিকেশন আগেই করা আছে, তাদের নতুন করে GoodDollar ভেরিফিকেশন লাগবে না — শুধু অ্যাপের ভেতরে একবার লাইভ ফেস স্ক্যান দিলে সেটি বিদ্যমান একাউন্ট ও স্লটের সাথেই সংযুক্ত হবে।",
      "একই ফেস দিয়ে একাধিক একাউন্ট বাইন্ড করা যাবে না; চেষ্টা করলে একাউন্ট স্থগিত হতে পারে।",
      "ফোন হারানো বা ফেস স্ক্যান কাজ না করলে সাপোর্টে UID সহ যোগাযোগ করলে যাচাই করে ফেস রিসেট করে দেওয়া হবে।",
      "লগইন পদ্ধতি বন্ধ বা পরিবর্তনের আগে অ্যাপ-নোটিশ/ইমেইলে আগাম জানানো হবে।",
    ],
  },
  {
    icon: Coins,
    title: "৪. মাইনিং ও আয়",
    points: [
      "১০টি স্লট সম্পূর্ণ ভেরিফাই হলে মাসিক হারে লাইভ রিওয়ার্ড সুবিধা চালু হয়।",
      "রিওয়ার্ড ব্যালান্স প্রতি সেকেন্ডে হিসাব হয়; স্লট বাতিল হলে রিওয়ার্ড বন্ধ হতে পারে।",
      "ভুলবশত অতিরিক্ত পেমেন্ট গেলে সেই পরিমাণ একাউন্টে ঋণ (warning) হিসেবে যোগ হবে এবং তা সমন্বয় করতে হবে।",
      "Good-App কোনো বিনিয়োগ, চাকরি বা গ্যারান্টিড আয়ের প্রতিশ্রুতি দেয় না। প্রদর্শিত হার আনুমানিক এবং অ্যাপের নিয়ম ও তহবিলের উপর নির্ভরশীল।",
      "বোনাস/রিওয়ার্ড পেতে হলে প্রতিটি নিয়ম মেনে চলতে হবে; প্রতারণা বা মাল্টি-একাউন্টে সব রিওয়ার্ড বাতিল হবে।",
    ],
  },
  {
    icon: Gift,
    title: "৫. বোনাস ও রেফারেল",
    points: [
      "এককালীন First verify / Re-verify বোনাস অফার চালু থাকা অবস্থায় প্রযোজ্য; অফার বন্ধ থাকলে কোনো এককালীন বোনাস দেওয়া হবে না। চালু-থাকা রেট সবসময় অ্যাপের অফার/ব্যানারে দেখা যাবে।",
      "বোনাস (চালু থাকলে) শুধু প্রথম ১০টি স্লটের জন্য একবারই প্রযোজ্য; পরে নতুন স্লট করলে আর বোনাস নেই।",
      "রেফার লিংক আনলক হবে ৫টি স্লট first verify সম্পূর্ণ হলে।",
      "রেফারকৃত ব্যবহারকারীর মাইনিং চালু থাকলে রেফারার মাসিক ১০% কমিশন পাবেন।",
      "নিজের একাধিক একাউন্ট দিয়ে রেফার (self-referral) সম্পূর্ণ নিষিদ্ধ — ধরা পড়লে সব বোনাস বাতিল।",
    ],
  },
  {
    icon: Wallet,
    title: "৬. উইথড্র নিয়ম",
    points: [
      "বিকাশ / নগদ / USDT-তে উইথড্র নেওয়া যাবে; ন্যূনতম উইথড্র সীমা অ্যাপে দেখানো হয়।",
      "প্রতি মাসের নির্দিষ্ট উইথড্র উইন্ডোতে অনুরোধ করতে হবে; শুক্রবার দুপুর ১:০০টা থেকে শনিবার সকাল ১০:০০টা পর্যন্ত উইথড্র বন্ধ থাকে।",
      "উইথড্রের আগে KYC (টেলিগ্রাম লিংক) সম্পূর্ণ থাকা বাধ্যতামূলক।",
      "ভুল ওয়ালেট নম্বর দিলে টাকা ফেরত পাওয়ার নিশ্চয়তা নেই; নম্বর পরিবর্তন করতে সাপোর্টে জানাতে হবে।",
      "সাধারণত পেমেন্ট ৫–১০ মিনিটের মধ্যে দেওয়া হয়, তবে সর্বোচ্চ ২৪ ঘণ্টা সময় লাগতে পারে।",
    ],
  },
  {
    icon: AlertTriangle,
    title: "৭. নিষিদ্ধ কাজ",
    points: [
      "একাধিক একাউন্ট, ফেক ফেস, বট বা অটোমেশন ব্যবহার করা যাবে না।",
      "টেলিগ্রাম গ্রুপে অশালীন বা স্প্যাম মেসেজ দিলে ৩০ মিনিটের জন্য ফ্রিজ করা হবে; বারবার করলে ব্যান।",
      "অন্যের UID দিয়ে স্লট রিসেট বা তথ্য চাওয়া নিষিদ্ধ — স্লট রিসেটে মালিকের অনুমোদন লাগবে।",
    ],
  },
  {
    icon: ShieldCheck,
    title: "৮. নিরাপত্তা ও গোপনীয়তা",
    points: [
      "লগইনের জন্য পাসওয়ার্ড ব্যবহার হয়; ইমেইল ভেরিফিকেশন ও পাসওয়ার্ড রিসেটে শুধু ৬ ডিজিটের কোড যায় — কোনো লিংক পাঠানো হয় না।",
      "নিজে লগআউট না করলে অ্যাপ আপনাকে লগআউট করবে না; সেটিংস থেকে অন্য ফোনের সেশন লগআউট করা যায়।",
      "আপনার তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।",
    ],
  },
  {
    icon: Scale,
    title: "৯. সাধারণ শর্ত",
    points: [
      "যেকোনো বিতর্কিত বিষয়ে অ্যাডমিনের সিদ্ধান্তই চূড়ান্ত।",
      "নিয়ম ও হার সময়ে সময়ে পরিবর্তন হতে পারে; পরিবর্তন অ্যাপে জানানো হবে।",
      "অ্যাপ ব্যবহার করা মানেই আপনি এই সব শর্তে সম্মত আছেন।",
    ],
  },
];

function TermsPage() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <Link to="/home" className="inline-flex items-center gap-1 text-[11px] font-black text-muted-foreground btn-press">
          <ArrowLeft className="w-3.5 h-3.5" /> ফিরে যান
        </Link>

        <PolicyLangBar kind="terms" />

        <header className="premium-panel rounded-2xl p-5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-navy mb-3">
            <FileText className="w-7 h-7 text-gold" />
          </div>
          <h1 className="text-xl font-black text-navy">নিয়ম ও শর্তাবলি</h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Good-App ব্যবহারের আগে নিচের নিয়মগুলো ভালোভাবে পড়ে নিন।
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">সর্বশেষ হালনাগাদ: আগস্ট ২০২৬</p>
        </header>

        {litePolicySections(SECTIONS).map((s) => (
          <section key={s.title} className="premium-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-8 rounded-xl gradient-navy flex items-center justify-center">
                <s.icon className="w-4 h-4 text-gold" />
              </span>
              <h2 className="text-sm font-black text-navy">{s.title}</h2>
            </div>
            <ul className="space-y-2">
              {s.points.map((p) => (
                <li key={p} className="flex gap-2 text-[12px] leading-5 text-navy/80">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="premium-panel rounded-2xl p-4 flex items-start gap-3">
          <Mail className="w-4 h-4 text-cyan mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            কোনো প্রশ্ন থাকলে আমাদের টেলিগ্রাম সাপোর্টে মেসেজ দিন — ২৪/৭ সহায়তা পাবেন।
          </p>
        </section>
      </div>
    </main>
  );
}

/** ভাষা/দেশ বার + সহজ ভাষায় সারমর্ম — বাংলাদেশের বাইরের ইউজারও বুঝবে */
function PolicyLangBar({ kind }: { kind: "privacy" | "terms" }) {
  const { t } = useLang();
  return (
    <div className="glass mb-4 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-black">
          {t("নিজের ভাষায় পড়ুন", "Read in your language")}
        </p>
        <div className="flex items-center gap-2">
          <RegionBadge />
          <LanguageToggle />
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {kind === "privacy"
          ? t(
              "সহজ কথায়: আপনি সত্যিকারের মানুষ কি না বুঝতে আমরা শুধু আপনার ফেস ছবি ও প্রোফাইল তথ্য রাখি। NID, OTP, ব্যাংক PIN বা পাসওয়ার্ড কখনো চাওয়া হয় না, আর আপনার তথ্য বিক্রি করা হয় না।",
              "In short: we only keep your face photo and profile details to confirm you are a real person. We never ask for national ID, OTP, bank PIN or your password, and we never sell your data."
            )
          : t(
              "সহজ কথায়: এক ব্যক্তি এক একাউন্ট, মাইনিং প্রতিদিন ক্লেইম করতে হবে, উইথড্র মাসের ১–৩ তারিখে এবং সব লেনদেন Main Balance থেকে হয়।",
              "In short: one person one account, stay active in the app 1 hour a day, claim mining daily, withdraw on the 1st-3rd of the month, and all payouts come from Main Balance."
            )}
      </p>
      <Link to="/rules" className="mt-2 inline-flex text-[11px] font-black text-cyan underline">
        {t("সব নিয়ম সহজ ভাষায় দেখুন", "See all rules in simple words")}
      </Link>
    </div>
  );
}
