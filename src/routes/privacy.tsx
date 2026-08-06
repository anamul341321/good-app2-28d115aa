import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Database, Eye, Trash2, Lock, Mail, ArrowLeft, Baby } from "lucide-react";

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
    icon: Database,
    title: "১. আমরা কী তথ্য সংগ্রহ করি",
    points: [
      "নাম, মোবাইল নম্বর এবং (ঐচ্ছিকভাবে) Gmail ঠিকানা — একাউন্ট তৈরি ও লগইন নিরাপত্তার জন্য।",
      "ফেস ভেরিফিকেশনের ছবি — শুধুমাত্র ব্যবহারকারী প্রকৃত মানুষ কি না তা যাচাই করতে।",
      "পেমেন্ট নম্বর (বিকাশ/নগদ) বা ওয়ালেট অ্যাড্রেস — উইথড্র পরিশোধ করার জন্য।",
      "প্রযুক্তিগত তথ্য: ডিভাইস/ব্রাউজার ধরন ও লগইন সময় — একাউন্ট নিরাপত্তা ও প্রতারণা রোধে।",
    ],
  },
  {
    icon: Eye,
    title: "২. তথ্য কীভাবে ব্যবহার করা হয়",
    points: [
      "একাউন্ট পরিচালনা, ভেরিফিকেশন, বোনাস ও উইথড্র হিসাব রাখা।",
      "প্রতারণা, মাল্টি-একাউন্ট ও ফেক ভেরিফিকেশন শনাক্ত করা।",
      "গুরুত্বপূর্ণ নোটিশ, লগইন কোড ও সাপোর্ট মেসেজ পাঠানো।",
      "আমরা কখনোই আপনার তথ্য বিজ্ঞাপনদাতা বা তৃতীয় পক্ষের কাছে বিক্রি করি না।",
    ],
  },
  {
    icon: Lock,
    title: "৩. ফেস ছবির নিরাপত্তা",
    points: [
      "ফেস যাচাই সম্পূর্ণ স্বয়ংক্রিয়ভাবে সার্ভার নিজেই করে — আমাদের কোনো টিম মেম্বার, অ্যাডমিন বা তৃতীয় পক্ষ কেউই আপনার ফেস ছবি দেখতে পারে না।",
      "ছবিটি এনক্রিপ্টেড অবস্থায় শুধুমাত্র আপনার নিজের অ্যাকাউন্টের সাথেই সংরক্ষিত থাকে, যাতে পরবর্তীতে রি-ভেরিফিকেশনের সময় আপনি নিজেই চিনতে পারেন কোন ফেস দিয়ে কোন স্লট ভেরিফাই করেছিলেন।",
      "ফেস ছবি কখনোই কোথাও বিক্রি, শেয়ার, প্রকাশ বা বিজ্ঞাপনে ব্যবহার করা হয় না এবং কোনো অনৈতিক কাজে ব্যবহার করা হয় না।",
      "এটি শুধুমাত্র একটি ভেরিফিকেশন পদ্ধতি — প্রকৃত মানুষ কি না তা যাচাই করা ছাড়া অন্য কোনো উদ্দেশ্যে ব্যবহার হয় না।",
      "সব তথ্য এনক্রিপ্টেড সংযোগ (HTTPS) দিয়ে আদান-প্রদান হয় এবং সুরক্ষিত সার্ভারে সংরক্ষিত থাকে।",
      "NID, ব্যাংক PIN, কার্ড নম্বর বা পাসওয়ার্ড আমরা কখনোই চাই না।",
    ],
  },

  {
    icon: Trash2,
    title: "৪. ডেটা মুছে ফেলা",
    points: [
      "আপনি চাইলে একাউন্ট ও সংরক্ষিত ছবি মুছে ফেলার অনুরোধ করতে পারেন।",
      "অনুরোধ পাওয়ার ৩০ দিনের মধ্যে ডেটা মুছে ফেলা হয় (আইনগত/হিসাবরক্ষণ বাধ্যবাধকতা ছাড়া)।",
      "মুছে ফেলার অনুরোধ করতে সাপোর্টে আপনার UID সহ মেসেজ দিন।",
    ],
  },
  {
    icon: Baby,
    title: "৫. বয়স সীমা",
    points: [
      "এই অ্যাপ প্রাপ্তবয়স্ক ব্যবহারকারীদের জন্য তৈরি; আমরা জেনেশুনে শিশুদের তথ্য সংগ্রহ করি না।",
    ],
  },
  {
    icon: Mail,
    title: "৬. যোগাযোগ",
    points: [
      "গোপনীয়তা সংক্রান্ত যেকোনো প্রশ্ন বা ডেটা মুছে ফেলার অনুরোধে অ্যাপের সাপোর্টে যোগাযোগ করুন।",
      "যোগাযোগ ইমেইল: support@goodapp2.live",
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
        {SECTIONS.map((s) => (
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
        সর্বশেষ হালনাগাদ: আগস্ট ২০২৬ ·{" "}
        <Link to="/terms" className="underline">
          নিয়ম ও শর্তাবলি
        </Link>
      </p>
    </main>
  );
}
