import { createFileRoute, Link } from "@tanstack/react-router";
import { litePolicySections, liteText } from "@/lib/lite-policy";
import { useLang } from "@/lib/i18n";
import { RegionBadge } from "@/components/RegionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FileText, ShieldCheck, Coins, UserCheck, Wallet, Gift, AlertTriangle, Scale, Mail, ArrowLeft, ScanFace, Clock, Database } from "lucide-react";

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
      "Good-App শুধু ১৮ বছর বা তার বেশি বয়সীদের জন্য। সাইন আপ করে ব্যবহারকারী নিজের বয়স ১৮+ বলে নিশ্চিত করেন।",
      "একজন ব্যক্তি শুধুমাত্র একটি একাউন্ট ব্যবহার করতে পারবেন। একই মোবাইল নম্বর বা পরিচয় দিয়ে একাধিক একাউন্ট করা যাবে না।",
      "নিজের আসল নাম ও নিজের নম্বর ব্যবহার করতে হবে; ভুল বা অন্যের তথ্য দিলে একাউন্ট বাতিল হবে।",
      "একই পরিচয়-যাচাই বা Telegram একাউন্ট একাধিক Good-App একাউন্টে ব্যবহার করা যাবে না।",
      "একাউন্টের পাসওয়ার্ড ও কোড (OTP) কাউকে শেয়ার করা যাবে না; শেয়ার করলে দায় ব্যবহারকারীর।",
    ],
  },
  {
    icon: ShieldCheck,
    title: "২. ফেস ভেরিফিকেশন",
    points: [
      "ব্যবহারকারী প্রকৃত মানুষ কি না — শুধু সেটি নিশ্চিত করতেই ফেস ভেরিফিকেশন নেওয়া হয়।",
      "NID বা ব্যাংক PIN কখনোই চাওয়া হয় না। লগইন পাসওয়ার্ড ও একবার-ব্যবহারযোগ্য নিরাপত্তা কোড শুধু নিরাপদ লগইন ব্যবস্থায় ব্যবহার হয়; নতুন একাউন্ট ও যাচাইযোগ্য স্লট সুবিধার জন্য ফেস ভেরিফিকেশন প্রয়োজন।",
      "অন্যের ছবি, ভিডিও বা নকল ফেস ব্যবহার করলে যাচাই বাতিল, একাউন্ট সীমিত বা বন্ধ হতে পারে; সিদ্ধান্তের বিরুদ্ধে সাপোর্টে পুনর্বিবেচনার অনুরোধ করা যাবে।",
      "Good-App ভেরিফাই বাতিল হলেই রি-ভেরিফাই চাওয়া হবে; ভেরিফাই ঠিক থাকলে কিছু করতে হবে না।",
    ],
  },
  {
    icon: ScanFace,
    title: "৩. লগইন পদ্ধতি ও ফেস বাইন্ডিং",
    points: [
      "নতুন সিস্টেমে রেজিস্ট্রেশন ধাপে ধাপে হয়: নাম ও নম্বর → পাসওয়ার্ড → লাইভ ক্যামেরায় ফেস ছবি → বাহ্যিক ফেস ভেরিফিকেশন। প্রয়োজনীয় যাচাই সফল না হলে একাউন্ট তৈরি হবে না।",
      "ফেস লগইন ব্যবহার করলে লাইভ ফেস স্ক্যান করতে হবে; ফেস মিললেও পাসওয়ার্ড ছাড়া লগইন সম্পন্ন হবে না।",
      "ফেস লগইন চালু করতে সেটিংস থেকে নিজের যাচাইকৃত পরিচয়ের সাথে ফেস বাইন্ড করতে হয়।",
      "যাদের স্লটের বাহ্যিক ফেস ভেরিফিকেশন আগেই করা আছে, তাদের একই যাচাই নতুন করে লাগে না — অ্যাপের লাইভ ফেস স্ক্যান বিদ্যমান একাউন্ট ও স্লটের সাথে সংযুক্ত হয়।",
      "একই ফেস দিয়ে একাধিক একাউন্ট বাইন্ড করা যাবে না; চেষ্টা করলে একাউন্ট স্থগিত হতে পারে।",
      "ফোন হারানো বা ফেস স্ক্যান কাজ না করলে সাপোর্টে UID সহ যোগাযোগ করলে যাচাই করে ফেস রিসেট করে দেওয়া হবে।",
      "নিরাপত্তার প্রয়োজনে অতিরিক্ত যাচাই চাওয়া হতে পারে। গুরুত্বপূর্ণ পরিবর্তন অ্যাপ-নোটিশ বা উপলভ্য যোগাযোগ মাধ্যমে জানানো হবে।",
    ],
  },
  {
    icon: Coins,
    title: "৪. টাস্ক ও রিওয়ার্ড",
    points: [
      "যোগ্য স্লট ভেরিফাই হলে অ্যাপে দেখানো নিয়ম অনুযায়ী রিওয়ার্ড সুবিধা চালু হয়।",
      "প্রতিটি স্লটের রিওয়ার্ড আলাদাভাবে হিসাব হয়; স্লটের যাচাই বাতিল হলে ওই স্লটের রিওয়ার্ড বন্ধ, লক বা সমন্বয় হতে পারে।",
      "ভুলবশত অতিরিক্ত ব্যালান্স বা পেমেন্ট যোগ হলে প্রমাণ যাচাই করে শুধু অতিরিক্ত অংশ সমন্বয় করা হতে পারে।",
      "Good-App কোনো বিনিয়োগ, চাকরি বা গ্যারান্টিড আয়ের প্রতিশ্রুতি দেয় না। প্রদর্শিত হার আনুমানিক এবং অ্যাপের নিয়ম ও তহবিলের উপর নির্ভরশীল।",
      "বোনাস/রিওয়ার্ড পেতে হলে প্রতিটি নিয়ম মেনে চলতে হবে; প্রতারণা বা মাল্টি-একাউন্টে সব রিওয়ার্ড বাতিল হবে।",
    ],
  },
  {
    icon: Gift,
    title: "৫. বোনাস ও রেফারেল",
    points: [
      "এককালীন First verify / Re-verify বোনাস অফার চালু থাকা অবস্থায় প্রযোজ্য; অফার বন্ধ থাকলে কোনো এককালীন বোনাস দেওয়া হবে না। চালু-থাকা রেট সবসময় অ্যাপের অফার/ব্যানারে দেখা যাবে।",
      "বোনাস ও রেফার সুবিধার যোগ্যতা, সীমা ও বর্তমান হার সংশ্লিষ্ট স্ক্রিনে দেখানো নিয়ম অনুযায়ী হবে।",
      "রেফার প্রোগ্রামের রিওয়ার্ড অ্যাপের নিয়ম অনুযায়ী দেওয়া হয় এবং যেকোনো সময় পরিবর্তন হতে পারে।",
      "নিজের একাধিক একাউন্ট দিয়ে রেফার (self-referral) সম্পূর্ণ নিষিদ্ধ — ধরা পড়লে সব বোনাস বাতিল।",
    ],
  },
  {
    icon: Wallet,
    title: "৬. উইথড্র নিয়ম",
    points: [
      "বিকাশ / নগদে উইথড্র নেওয়া যাবে; ন্যূনতম উইথড্র সীমা অ্যাপে দেখানো হয়।",
      "মেইন/বোনাস ব্যালান্স থেকে যেকোনো দিন উইথড্র অনুরোধ করা যায়। পেন্ডিং রিওয়ার্ড সরাসরি তোলা যায় না; যোগ্য স্লটের অর্থ ঢাকা সময় অনুযায়ী মাসের ১–৩ তারিখ রাত ১০টার মধ্যে মেইন ব্যালান্সে এলে তোলা যায়।",
      "উইথড্রের আগে পরিচয় যাচাই সম্পন্ন থাকতে হবে; নিরাপত্তা সেটিং চালু থাকলে যাচাইকৃত Gmail-ও লাগতে পারে।",
      "প্রযোজ্য ফি, হাতে পাওয়া অর্থ এবং দৈনিক অনুরোধসীমা নিশ্চিত করার আগেই স্ক্রিনে দেখানো হয়।",
      "ভুল ওয়ালেট নম্বর দিলে টাকা ফেরত পাওয়ার নিশ্চয়তা নেই; নম্বর পরিবর্তন করতে সাপোর্টে জানাতে হবে।",
      "উইথড্র সাময়িকভাবে বন্ধ থাকলে বা পর্যালোচনা লাগলে অ্যাপে কারণ বা বর্তমান অবস্থা দেখানো হয়; নির্দিষ্ট সময়ে পেমেন্টের নিশ্চয়তা দেওয়া হয় না।",
    ],
  },
  {
    icon: AlertTriangle,
    title: "৭. নিষিদ্ধ কাজ",
    points: [
      "একাধিক একাউন্ট, ফেক ফেস, বট বা অটোমেশন ব্যবহার করা যাবে না।",
      "প্রতারণা, ভুয়া নথি/ছবি, নিরাপত্তা এড়ানোর চেষ্টা বা সেবার অপব্যবহার নিষিদ্ধ।",
      "অন্যের UID দিয়ে স্লট রিসেট বা তথ্য চাওয়া নিষিদ্ধ — স্লট রিসেটে মালিকের অনুমোদন লাগবে।",
    ],
  },
  {
    icon: ShieldCheck,
    title: "৮. নিরাপত্তা ও গোপনীয়তা",
    points: [
      "লগইনের জন্য পাসওয়ার্ড ব্যবহার হয়; ইমেইল ভেরিফিকেশন ও পাসওয়ার্ড রিসেটে শুধু ৬ ডিজিটের কোড যায় — কোনো লিংক পাঠানো হয় না।",
      "সন্দেহজনক লগইন বা নিরাপত্তা ঝুঁকিতে সেশন শেষ করা বা পুনরায় যাচাই চাওয়া হতে পারে।",
      "আপনার তথ্য কোনো তৃতীয় পক্ষের কাছে বিক্রি করা হয় না।",
      "তথ্য সংগ্রহ, বাহ্যিক পরিচয়-যাচাই, সংরক্ষণ ও ডিলিটের বিস্তারিত গোপনীয়তা নীতি ও ডেটা সেফটি পাতায় দেওয়া আছে।",
    ],
  },
  {
    icon: Clock,
    title: "৯. সেবা, ফি ও পরিবর্তন",
    points: [
      "ইন্টারনেট, রক্ষণাবেক্ষণ, নিরাপত্তা পরীক্ষা বা তৃতীয় পক্ষের সেবা সমস্যায় কোনো সুবিধা সাময়িকভাবে ধীর বা বন্ধ হতে পারে।",
      "যেকোনো ফি, হার বা অফার কার্যকর করার আগে অ্যাপে দেখানো হবে; আইন বা নীতির প্রয়োজনে এগুলো পরিবর্তন হতে পারে।",
      "কোনো নির্দিষ্ট রিওয়ার্ড, লাভ, আয়, পেমেন্টের সময় বা সেবার নিরবচ্ছিন্ন প্রাপ্যতার নিশ্চয়তা দেওয়া হয় না।",
    ],
  },
  {
    icon: Database,
    title: "১০. একাউন্ট ও ডেটা ডিলিট",
    points: [
      "সেটিংস থেকে একাউন্ট ডিলিটের অনুরোধ করা যায়; পেন্ডিং উইথড্র থাকলে আগে সেটি শেষ বা বাতিল করতে হবে।",
      "আইনগত ও হিসাবরক্ষণ বাধ্যবাধকতায় সীমিত লেনদেনের রেকর্ড নির্ধারিত সময় রাখা হতে পারে; অন্য একাউন্ট-সংযুক্ত তথ্য মুছে দেওয়া হয়।",
      "লগইন করতে না পারলে support@goodapp2.live-এ UID বা নিবন্ধিত নম্বর দিয়ে ডিলিটের অনুরোধ করা যায়।",
    ],
  },
  {
    icon: Scale,
    title: "১১. সাধারণ শর্ত ও অভিযোগ",
    points: [
      "বিতর্কিত বিষয়ে প্রমাণ ও প্রকাশিত নিয়ম অনুযায়ী পর্যালোচনা করা হয়; ব্যবহারকারী সাপোর্টে পুনর্বিবেচনার অনুরোধ করতে পারেন।",
      "গুরুত্বপূর্ণ শর্ত বদলালে এই পেজের তারিখ হালনাগাদ করা হবে এবং প্রযোজ্য ক্ষেত্রে অ্যাপে জানানো হবে। পরিবর্তনের পর ব্যবহার চালালে নতুন শর্ত প্রযোজ্য হবে।",
      "কোনো শর্ত আইনত অকার্যকর হলেও বাকি শর্ত কার্যকর থাকবে। প্রশ্ন বা অভিযোগে support@goodapp2.live-এ যোগাযোগ করুন।",
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
          <p className="text-[10px] text-muted-foreground mt-2">সর্বশেষ হালনাগাদ: অক্টোবর ২০২৬</p>
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
            কোনো প্রশ্ন থাকলে support@goodapp2.live-এ যোগাযোগ করুন।
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
              "সহজ কথায়: একাউন্ট ও নিরাপত্তার জন্য প্রোফাইল, ফেস যাচাই, ডিভাইস ও লেনদেনের প্রয়োজনীয় তথ্য রাখা হয়। NID বা ব্যাংক PIN চাওয়া হয় না এবং তথ্য বিক্রি করা হয় না।",
              "In short: we keep necessary profile, face-verification, device and transaction data for accounts and security. We do not ask for national ID or bank PIN, and we do not sell data."
            )
          : t(
              liteText(
                "সহজ কথায়: এক ব্যক্তি এক একাউন্ট, রিওয়ার্ড প্রতিদিন ক্লেইম করতে হবে, উইথড্র মাসের ১–৩ তারিখে এবং সব লেনদেন Main Balance থেকে হয়।",
                "সহজ কথায়: এক ব্যক্তি এক একাউন্ট, নিজের আসল তথ্য দিন, ফেস ভেরিফিকেশন শুধু আপনি প্রকৃত মানুষ কি না বোঝার জন্য, আর অন্যকে হ্যারাস করা বা ফেক কনটেন্ট দেওয়া নিষিদ্ধ।",
              ),
              liteText(
                "In short: one person one account, claim rewards daily, withdraw on the 1st-3rd of the month, and all payouts come from Main Balance.",
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
