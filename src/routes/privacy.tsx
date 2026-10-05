import { createFileRoute, Link } from "@tanstack/react-router";
import { litePolicySections, liteText } from "@/lib/lite-policy";
import { useLang } from "@/lib/i18n";
import { RegionBadge } from "@/components/RegionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ShieldCheck, Database, Eye, Trash2, Lock, Mail, ArrowLeft, Baby, Share2, Clock, UserCheck, ScanFace, Coins, Megaphone } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "গোপনীয়তা নীতি | Good-App" },
      {
        name: "description",
        content:
          "Good-App কী তথ্য নেয়, কেন নেয়, কতদিন রাখে এবং কীভাবে ডেটা মুছে ফেলার অনুরোধ করবেন — সম্পূর্ণ গোপনীয়তা নীতি।",
      },
      { property: "og:title", content: "গোপনীয়তা নীতি | Good-App" },
      {
        property: "og:description",
        content: "Good-App-এর ডেটা সংগ্রহ, ব্যবহার, সংরক্ষণ ও মুছে ফেলার নীতি বিস্তারিত পড়ুন।",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const SECTIONS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: ShieldCheck,
    title: "সংক্ষেপে (এক নজরে)",
    points: [
      "Good-App একটি স্লট ভেরিফিকেশন, রিওয়ার্ড ও একাউন্ট ব্যবস্থাপনা অ্যাপ। এতে কোনো সোশ্যাল ফিড, চ্যাট বা কলিং ফিচার নেই।",
      "আমরা কখনোই NID, OTP, ব্যাংক PIN বা পাসওয়ার্ড চাই না।",
      "আপনার কোনো ব্যক্তিগত তথ্য বিক্রি বা বিজ্ঞাপনদাতার কাছে হস্তান্তর করা হয় না।",
      "ফেস ভেরিফিকেশন সম্পূর্ণ ঐচ্ছিক এবং যেকোনো সময় ছবি মুছে ফেলা যায়।",
      "অ্যাপের ভেতর থেকেই এক ট্যাপে একাউন্ট ও সব ডেটা স্থায়ীভাবে ডিলিট করা যায়।",
    ],
  },
  {
    icon: UserCheck,
    title: "আমরা কারা",
    points: [
      "সেবার নাম: Good-App (ওয়েব ও Android অ্যাপ)।",
      "যোগাযোগ ইমেইল: support@goodapp2.live",
      "এই নীতিটি অ্যাপ ও ওয়েবসাইট — দুই জায়গাতেই প্রযোজ্য।",
    ],
  },
  {
    icon: Database,
    title: "আমরা কী তথ্য সংগ্রহ করি",
    points: [
      "নাম, মোবাইল নম্বর এবং (ঐচ্ছিকভাবে) Gmail ঠিকানা — একাউন্ট তৈরি ও লগইন নিরাপত্তার জন্য।",
      "প্রোফাইল ছবি, লিঙ্গ ও দেশ — আপনার প্রোফাইল দেখানোর জন্য (আপনি নিজে দেন)।",
      "লেনদেনের হিসাব: উইথড্র, সেন্ড, রিচার্জ ও বোনাসের রেকর্ড।",
      "ফেস ভেরিফিকেশনের ছবি (ঐচ্ছিক) — শুধুমাত্র ব্যবহারকারী প্রকৃত মানুষ কি না তা যাচাই করতে।",
      "পেমেন্ট নম্বর (বিকাশ/নগদ) বা ওয়ালেট অ্যাড্রেস — উইথড্র পরিশোধ করার জন্য।",
      "প্রযুক্তিগত তথ্য: ডিভাইস/ব্রাউজার ধরন, আনুমানিক দেশ, অ্যাপ ভার্সন ও লগইন সময় — নিরাপত্তা ও প্রতারণা রোধে।",
      "যা আমরা কখনোই সংগ্রহ করি না: NID/জাতীয় পরিচয়পত্র, ব্যাংক বা কার্ডের PIN, OTP, কন্টাক্ট লিস্ট, SMS ও সঠিক GPS লোকেশন।",
    ],
  },
  {
    icon: Eye,
    title: "তথ্য কীভাবে ব্যবহার করা হয়",
    points: [
      "একাউন্ট তৈরি, লগইন ও প্রোফাইল পরিচালনা করা।",
      "স্লট ভেরিফাই, রি-ভেরিফাই, উইথড্র, সেন্ড ও রিচার্জ ফিচার চালানো।",
      "প্রতারণা, স্প্যাম, বট ও মাল্টি-একাউন্ট শনাক্ত করা।",
      "একাউন্ট পরিচালনা, ভেরিফিকেশন, বোনাস ও উইথড্র হিসাব রাখা।",
      "গুরুত্বপূর্ণ নোটিশ, লগইন কোড ও সাপোর্ট মেসেজ পাঠানো।",
      "আমরা কখনোই আপনার তথ্য বিজ্ঞাপনদাতা বা তৃতীয় পক্ষের কাছে বিক্রি করি না।",
    ],
  },
  {
    icon: Lock,
    title: "অ্যাপ যেসব অনুমতি (permission) চায়",
    points: [
      "ক্যামেরা — শুধু ঐচ্ছিক ফেস ভেরিফিকেশন ও QR স্ক্যানের জন্য।",
      "মাইক্রোফোন — শুধু আপনি নিজে কাস্টমার সাপোর্টে কল দিলে; ব্যাকগ্রাউন্ডে কখনো রেকর্ড হয় না।",
      "ফটো — শুধু আপনি নিজে প্রোফাইল ছবি দিতে চাইলে সেটি পড়া হয়।",
      "নোটিফিকেশন — উইথড্র স্ট্যাটাস ও অ্যাপ নোটিশ জানাতে; সেটিংস থেকে বন্ধ করা যায়।",
      "ইন্টারনেট ও নেটওয়ার্ক স্ট্যাটাস — সার্ভারের সাথে সংযোগের জন্য।",
      "প্রতিটি অনুমতি ব্যবহারের ঠিক আগে চাওয়া হয় এবং ফোনের সেটিংস থেকে যেকোনো সময় বাতিল করা যায়।",
    ],
  },
  {
    icon: Lock,
    title: "ফেস ছবির নিরাপত্তা",
    points: [
      "ফেস ভেরিফিকেশন দেওয়া বা না দেওয়া সম্পূর্ণ আপনার সিদ্ধান্ত — না দিলেও একাউন্ট, সেটিংস ও সাপোর্ট ব্যবহার করা যায়।",
      "ফেস যাচাই সম্পূর্ণ স্বয়ংক্রিয়ভাবে সার্ভার নিজেই করে — আমাদের কোনো টিম মেম্বার, অ্যাডমিন বা তৃতীয় পক্ষ কেউই আপনার ফেস ছবি দেখতে পারে না।",
      "ছবিটি এনক্রিপ্টেড অবস্থায় শুধুমাত্র আপনার নিজের অ্যাকাউন্টের সাথেই সংরক্ষিত থাকে।",
      "ফেস ছবি কখনোই বিক্রি, শেয়ার, প্রকাশ বা বিজ্ঞাপনে ব্যবহার করা হয় না।",
      "সব তথ্য এনক্রিপ্টেড সংযোগ (HTTPS) দিয়ে আদান-প্রদান হয় এবং সুরক্ষিত সার্ভারে সংরক্ষিত থাকে।",
      "সেটিংস থেকে যেকোনো সময় ফেস ছবি মুছে ফেলা যায়।",
    ],
  },
  {
    icon: ScanFace,
    title: "ফেস লগইন",
    points: [
      "ফেস লগইন একটি ঐচ্ছিক বাড়তি নিরাপত্তা ধাপ — চালু করা বা না করা আপনার ইচ্ছা।",
      "লগইনের সময় লাইভ ফেস স্ক্যান শুধু আপনার সংরক্ষিত ছবির সাথে মিল যাচাই করে; গ্যালারির ছবি গ্রহণ করা হয় না।",
      "ফেস মিলে গেলেও পাসওয়ার্ড দেওয়া বাধ্যতামূলক — শুধু ফেস দিয়ে কখনোই লগইন সম্পন্ন হয় না।",
      "ফেস স্ক্যানের ছবি বিজ্ঞাপন, প্রোফাইলিং বা তৃতীয় পক্ষের কাছে দেওয়া হয় না।",
    ],
  },
  {
    icon: Share2,
    title: "নিরাপদ ব্যবহার",
    points: [
      "অ্যাপে অন্য ব্যবহারকারীর সাথে পোস্ট বা চ্যাট শেয়ারের কোনো ব্যবস্থা নেই।",
      "সন্দেহজনক কার্যকলাপ সাপোর্টে জানালে পর্যালোচনা করা হয়।",
      "প্রতারণা প্রমাণিত হলে একাউন্ট সীমিত/বন্ধ করা হতে পারে।",
      "নগ্নতা, শিশু নিরাপত্তা লঙ্ঘন, হয়রানি, ঘৃণা-বক্তব্য ও স্প্যাম কঠোরভাবে নিষিদ্ধ।",
    ],
  },
  {
    icon: Share2,
    title: "তৃতীয় পক্ষের সেবা",
    points: [
      "ডাটাবেস, লগইন ও ফাইল সংরক্ষণ: Supabase (Lovable Cloud) — সুরক্ষিত ক্লাউড সার্ভার।",
      "লগইন কোড ও নোটিশ ইমেইল পাঠানোর জন্য ইমেইল সেবা (notify.goodapp2.live)।",
      "Google Sign-In — আপনি চাইলে Gmail দিয়ে লগইন করতে পারেন।",
      "বিজ্ঞাপন নেটওয়ার্ক — বিজ্ঞাপন দেখানোর জন্য (নিচের বিজ্ঞাপন অংশ দেখুন)।",
      "টেলিগ্রাম সাপোর্ট বট — আপনি নিজে মেসেজ দিলে শুধু আপনার UID ও একাউন্ট স্ট্যাটাস দেখানো হয়।",
      "এই সেবাগুলো শুধু কাজ সম্পন্ন করার জন্য প্রয়োজনীয় তথ্যই পায় — আমরা কোনো ডেটা বিক্রি করি না।",
    ],
  },
  {
    icon: Clock,
    title: "ডেটা কতদিন রাখা হয়",
    points: [
      "একাউন্ট তথ্য: একাউন্ট চালু থাকা পর্যন্ত।",
      "লেনদেনের রেকর্ড: আইনগত প্রয়োজন অনুযায়ী।",
      "ফেস ভেরিফিকেশনের ছবি: সংশ্লিষ্ট স্লট সক্রিয় থাকা পর্যন্ত; ডিলিট করলে সাথে সাথে মুছে যায়।",
      "উইথড্র ও পেমেন্ট হিসাব: হিসাবরক্ষণের প্রয়োজনে সর্বোচ্চ ১২ মাস।",
      "লগইন/ডিভাইস লগ: সর্বোচ্চ ৯০ দিন।",
      "OTP কোড: কয়েক মিনিট পরেই স্বয়ংক্রিয়ভাবে মেয়াদ শেষ হয়ে যায়।",
    ],
  },
  {
    icon: Trash2,
    title: "একাউন্ট ও ডেটা ডিলিট",
    points: [
      "অ্যাপের ভেতরেই ডিলিট করতে পারবেন: সেটিংস → “একাউন্ট ডিলিট করুন” → DELETE লিখে নিশ্চিত করুন।",
      "ডিলিট করলে প্রোফাইল, ফেস ছবি ও সব হিসাব স্থায়ীভাবে মুছে যায় — এটি ফেরানো যায় না।",
      "অ্যাপে ঢুকতে না পারলে support@goodapp2.live-এ আপনার UID সহ মেসেজ দিন — ৩০ দিনের মধ্যে মুছে ফেলা হয়।",
      "বিস্তারিত ধাপ: goodapp2.live/account-deletion",
    ],
  },
  {
    icon: UserCheck,
    title: "আপনার অধিকার",
    points: [
      "আপনার সংরক্ষিত তথ্য দেখা ও ভুল থাকলে সংশোধন করার অধিকার।",
      "যেকোনো সময় একাউন্ট ও ডেটা মুছে ফেলার অধিকার।",
      "ঐচ্ছিক তথ্য (Gmail, ফেস ছবি) না দেওয়ার অধিকার।",
      "কোনো অনুরোধে আমরা ৩০ দিনের মধ্যে উত্তর দিই।",
    ],
  },
  {
    icon: Baby,
    title: "বয়স সীমা ও শিশু নিরাপত্তা",
    points: [
      "এই অ্যাপ শুধু ১৮ বছর বা তার বেশি বয়সীদের জন্য; আমরা জেনেশুনে শিশুদের তথ্য সংগ্রহ করি না।",
      "শিশুর তথ্য পাওয়া গেলে একাউন্টসহ তা সাথে সাথে মুছে ফেলা হয়।",
      "শিশু নিরাপত্তা সংক্রান্ত নীতি: goodapp2.live/child-safety",
    ],
  },
  {
    icon: Coins,
    title: "Good Coin (ইন-অ্যাপ পয়েন্ট)",
    points: [
      "Good Coin একটি সম্পূর্ণ ইন-অ্যাপ ভার্চুয়াল পয়েন্ট — এটি কোনো ক্রিপ্টোকারেন্সি, সিকিউরিটি, লটারি বা বাস্তব মুদ্রা নয়।",
      "কয়েন কেনা যায় না; শুধু অ্যাপে স্বাভাবিক ব্যবহারে পাওয়া যায় এবং কয়েন পেতে কোনো টাকা দিতে হয় না।",
      "ভিডিও দেখার সময় শুধু সময়টুকু গণনা করা হয়; কোনো ভিডিও বা স্ক্রিন রেকর্ড করা হয় না।",
      "কয়েন হস্তান্তরযোগ্য নয় এবং একাউন্ট বন্ধ হলে জমা কয়েনও বাতিল হয়ে যায়।",
    ],
  },
  {
    icon: Megaphone,
    title: "বিজ্ঞাপন",
    points: [
      "অ্যাপে তৃতীয় পক্ষের বিজ্ঞাপন (ব্যানার, ইন্টারস্টিশিয়াল ও ঐচ্ছিক ভিডিও) দেখানো হতে পারে।",
      "বিজ্ঞাপন দেখানোর জন্য নেটওয়ার্ক আপনার ডিভাইসের Advertising ID (AAID), আনুমানিক অঞ্চল ও ডিভাইস তথ্য ব্যবহার করতে পারে — বিস্তারিত: https://policies.google.com/technologies/ads",
      "আমরা আপনার নাম, ফোন নম্বর, ফেস ছবি বা চ্যাট কোনো বিজ্ঞাপন নেটওয়ার্কের সাথে শেয়ার করি না।",
      "Android সেটিংস → Google → Ads থেকে ‘Delete advertising ID’ দিয়ে ব্যক্তিগতকৃত বিজ্ঞাপন বন্ধ করা যায়।",
      "১৮ বছরের কম বয়সীদের জন্য এই অ্যাপ নয়, তাই শিশু-লক্ষ্যিত বিজ্ঞাপন পরিবেশন করা হয় না।",
    ],
  },
  {
    icon: Mail,
    title: "নীতির পরিবর্তন ও যোগাযোগ",
    points: [
      "নীতিতে পরিবর্তন হলে এই পেজ হালনাগাদ করা হয় এবং গুরুত্বপূর্ণ পরিবর্তন অ্যাপ-নোটিশে জানানো হয়।",
      "গোপনীয়তা সংক্রান্ত যেকোনো প্রশ্ন বা ডেটা মুছে ফেলার অনুরোধ: support@goodapp2.live",
      "চিঠি/অনুরোধের উত্তর সাধারণত ৭ কর্মদিবসের মধ্যে দেওয়া হয়।",
    ],
  },
];


function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        হোমে ফিরুন
      </Link>

      <PolicyLangBar kind="privacy" />

      <header className="text-center space-y-2">
        <div
          className="inline-flex w-14 h-14 rounded-2xl items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
        >
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black">গোপনীয়তা নীতি</h1>
        <p className="text-xs text-muted-foreground">
          Good-App কী তথ্য নেয়, কেন নেয় এবং কীভাবে সুরক্ষিত রাখে
        </p>
      </header>

      <div className="space-y-4">
        {litePolicySections(SECTIONS).map((s) => (
          <section key={s.title} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            <div className="flex items-center gap-2">
              <s.icon className="w-4 h-4 text-cyan-500" />
              <h2 className="font-black text-sm">{s.title}</h2>
            </div>
            <ul className="space-y-1.5">
              {s.points.map((p) => (
                <li key={p} className="text-xs leading-relaxed text-muted-foreground flex gap-2">
                  <span className="text-cyan-500">•</span>
                  <span className="flex-1">{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        সর্বশেষ হালনাগাদ: সেপ্টেম্বর ২০২৬ ·{" "}
        <Link to="/terms" className="underline">
          নিয়ম ও শর্তাবলি
        </Link>{" "}
        ·{" "}
        <Link to="/data-safety" className="underline">
          ডেটা সেফটি
        </Link>{" "}
        ·{" "}
        <Link to="/child-safety" className="underline">
          Child Safety
        </Link>{" "}
        ·{" "}
        <Link to="/account-deletion" className="underline">
          একাউন্ট ডিলিট
        </Link>
      </p>
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
              liteText(
                "সহজ কথায়: এক ব্যক্তি এক একাউন্ট, মাইনিং প্রতিদিন ক্লেইম করতে হবে, উইথড্র মাসের ১–৩ তারিখে এবং সব লেনদেন Main Balance থেকে হয়।",
                "সহজ কথায়: এক ব্যক্তি এক একাউন্ট, নিজের আসল তথ্য দিন, ফেস ভেরিফিকেশন শুধু আপনি প্রকৃত মানুষ কি না বোঝার জন্য, আর অন্যকে হ্যারাস করা বা ফেক কনটেন্ট দেওয়া নিষিদ্ধ।",
              ),
              liteText(
                "In short: one person one account, claim mining daily, withdraw on the 1st-3rd of the month, and all payouts come from Main Balance.",
                "In short: one person one account, use your real details, face check only proves you are a real person, and harassment or fake content is not allowed.",
              )
            )}
      </p>
      <Link to="/rules" className="mt-2 inline-flex text-[11px] font-black text-cyan underline">
        {t("সব নিয়ম সহজ ভাষায় দেখুন", "See all rules in simple words")}
      </Link>
    </div>
  );
}
