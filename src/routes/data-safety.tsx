import { createFileRoute, Link } from "@tanstack/react-router";
import { litePolicySections } from "@/lib/lite-policy";
import {
  ShieldCheck,
  Database,
  Eye,
  Lock,
  UserX,
  Clock,
  ArrowLeft,
  Share2,
  Baby,
} from "lucide-react";

export const Route = createFileRoute("/data-safety")({
  head: () => ({
    meta: [
      { title: "ডেটা সেফটি ও অনুমতি | Good-App" },
      {
        name: "description",
        content:
          "Good-App কী কী ডেটা সংগ্রহ করে, কেন করে, কতদিন রাখে এবং কীভাবে মুছতে হয় — Play Store ডেটা সেফটি সারসংক্ষেপ।",
      },
      { property: "og:title", content: "ডেটা সেফটি ও অনুমতি | Good-App" },
      {
        property: "og:description",
        content: "Good-App-এর সংগৃহীত ডেটা, ব্যবহারের উদ্দেশ্য, সংরক্ষণ ও মুছে ফেলার সারসংক্ষেপ।",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DataSafetyPage,
});

const SECTIONS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: Database,
    title: "সংগৃহীত ডেটা",
    points: [
      "নাম ও মোবাইল নম্বর — একাউন্ট তৈরি ও যোগাযোগের জন্য (বাধ্যতামূলক)।",
      "Gmail ঠিকানা (ঐচ্ছিক) — ২-স্টেপ লগইন নিরাপত্তার জন্য।",
      "প্রোফাইল ছবি, লিঙ্গ ও দেশ — প্রোফাইল দেখানোর জন্য (ঐচ্ছিক)।",
      "লেনদেনের হিসাব (উইথড্র, সেন্ড, রিচার্জ) — অ্যাপের ফিচার চালাতে।",
      "ফেস ভেরিফিকেশন ছবি — পরিচয়-যাচাই বা যোগ্য স্লট সুবিধা ব্যবহার করলে প্রয়োজন।",
      "লাইভ ফেস স্ক্যান (ক্যামেরা) — সংরক্ষিত ছবির সাথে মিল যাচাই করতে; গ্যালারির ছবি গ্রহণ করা হয় না।",
      "পেমেন্ট নম্বর (বিকাশ/নগদ) — উইথড্র পরিশোধের জন্য।",
      "বাহ্যিক পরিচয়-যাচাই সেবার ছদ্মনামযুক্ত ওয়ালেট পরিচয় — ডুপ্লিকেট একাউন্ট প্রতিরোধ ও স্লট যাচাইয়ের জন্য।",
      "ডিভাইস/ব্রাউজার ধরন, অ্যাপ ভার্সন ও লগইন সময় — প্রতারণা রোধে।",
    ],
  },
  {
    icon: Eye,
    title: "যা কখনো সংগ্রহ করা হয় না",
    points: [
      "NID / জাতীয় পরিচয়পত্র, ব্যাংক বা কার্ডের PIN, OTP বা পাসওয়ার্ড।",
      "ফোনের কন্টাক্ট লিস্ট, SMS বা কল লগ।",
      "সঠিক GPS লোকেশন বা ব্যাকগ্রাউন্ড লোকেশন।",
      "ইনস্টল করা অন্য অ্যাপের তালিকা।",
    ],
  },
  {
    icon: Lock,
    title: "অ্যাপ যেসব অনুমতি চায়",
    points: [
      "ক্যামেরা — একাউন্ট/স্লটের ফেস যাচাই ও QR স্ক্যান।",
      "মাইক্রোফোন — মূল Play Store অ্যাপ এই অনুমতি ব্যবহার করে না।",
      "ফটো — শুধু নিজে প্রোফাইল ছবি দিলে।",
      "নোটিফিকেশন — উইথড্র স্ট্যাটাস ও নোটিশ জানাতে; বন্ধ করা যায়।",
      "প্রতিটি অনুমতি ব্যবহারের আগে চাওয়া হয় এবং ফোনের সেটিংস থেকে বাতিল করা যায়।",
    ],
  },
  {
    icon: Eye,
    title: "ব্যবহারের উদ্দেশ্য",
    points: [
      "একাউন্ট পরিচালনা, লগইন ও প্রোফাইল দেখানো।",
      "স্লট ভেরিফাই, উইথড্র, সেন্ড ও রিচার্জ ফিচার চালানো।",
      "মাল্টি-একাউন্ট, ফেক ফেস, বট ও প্রতারণা শনাক্ত করা।",
      "গুরুত্বপূর্ণ নোটিশ, OTP ও সাপোর্ট মেসেজ পাঠানো।",
      "ব্যক্তিগত তথ্য বিজ্ঞাপন বা প্রোফাইলিংয়ের জন্য ব্যবহার বা বিক্রি করা হয় না।",
    ],
  },
  {
    icon: Share2,
    title: "ডেটা শেয়ারিং",
    points: [
      "কোনো ব্যক্তিগত তথ্য বিক্রি করা হয় না।",
      "শুধু সেবা চালানোর জন্য প্রয়োজনীয় প্রসেসরদের সাথে শেয়ার হয়: Lovable Cloud (Supabase) — ডাটাবেজ ও ফাইল; notify.goodapp2.live — ইমেইল; Google Sign-In — ঐচ্ছিক লগইন।",
      "স্লট পরিচয় যাচাইয়ের সময় GoodDollar/GoodID ছদ্মনামযুক্ত ওয়ালেট পরিচয় ও যাচাইয়ের ফল প্রক্রিয়া করে; Good-App ক্রিপ্টো কেনাবেচা বা কাস্টডিয়াল ওয়ালেট দেয় না।",
      "আইনগত বাধ্যবাধকতা ছাড়া অন্য কারও সাথে ডেটা দেওয়া হয় না।",
    ],
  },
  {
    icon: Lock,
    title: "নিরাপত্তা",
    points: [
      "সব তথ্য HTTPS এনক্রিপশন দিয়ে আদান-প্রদান হয়।",
      "ফেস ছবি সুরক্ষিতভাবে সংরক্ষিত; অনুমোদিত নিরাপত্তা পর্যালোচনা ছাড়া প্রবেশ সীমাবদ্ধ।",
      "ডাটাবেজে row-level security দিয়ে প্রতিটি ইউজার শুধু নিজের ডেটাই পড়তে পারে।",
      "NID, ব্যাংক PIN বা কার্ড নম্বর কখনোই চাওয়া হয় না।",
    ],
  },
  {
    icon: Share2,
    title: "রিপোর্ট, ব্লক ও মডারেশন",
    points: [
      "সন্দেহজনক কার্যকলাপ সাপোর্টে রিপোর্ট করা যায়।",
      "রিপোর্ট করা কনটেন্ট পর্যালোচনা করে সরানো হয় ও একাউন্টে ব্যবস্থা নেওয়া হয়।",
      "নগ্নতা, হয়রানি, ঘৃণা-বক্তব্য, স্প্যাম ও শিশু নিরাপত্তা লঙ্ঘন কঠোরভাবে নিষিদ্ধ।",
    ],
  },
  {
    icon: Clock,
    title: "ডেটা কতদিন রাখা হয়",
    points: [
      "একাউন্ট তথ্য: একাউন্ট চালু থাকা পর্যন্ত।",
      "লেনদেনের রেকর্ড: আইনগত প্রয়োজন অনুযায়ী।",
      "ফেস ছবি: সংশ্লিষ্ট স্লট সক্রিয় থাকা পর্যন্ত।",
      "উইথড্র ও পেমেন্ট হিসাব: সর্বোচ্চ ১২ মাস।",
      "লগইন/ডিভাইস লগ: সর্বোচ্চ ৯০ দিন।",
    ],
  },
  {
    icon: UserX,
    title: "অ্যাকাউন্ট ও ডেটা ডিলিট",
    points: [
      "সেটিংস → 'একাউন্ট ডিলিট করুন' → DELETE লিখে নিশ্চিত করুন।",
      "পেন্ডিং উইথড্র না থাকলে প্রোফাইল, ফেস ছবি ও একাউন্ট-সংযুক্ত তথ্য স্থায়ীভাবে মুছে যায়।",
      "পেন্ডিং উইথড্র থাকলে সেটি শেষ বা বাতিল হওয়ার পর ডিলিট করা যায়।",
      "অ্যাপে ঢুকতে না পারলে support@goodapp2.live-এ UID সহ মেইল করুন — ৩০ দিনের মধ্যে মুছে ফেলা হয়।",
      "বিস্তারিত: goodapp2.live/account-deletion",
    ],
  },
  {
    icon: Baby,
    title: "বয়স সীমা",
    points: [
      "এই অ্যাপ শুধু প্রাপ্তবয়স্ক (১৮+) ব্যবহারকারীদের জন্য।",
      "জেনেশুনে শিশুদের তথ্য সংগ্রহ করা হয় না; পাওয়া গেলে একাউন্টসহ মুছে ফেলা হয়।",
      "শিশু নিরাপত্তা নীতি: goodapp2.live/child-safety",
    ],
  },
];


function DataSafetyPage() {
  return (
    <main className="min-h-screen px-4 py-6 max-w-md mx-auto space-y-5">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        সেটিংসে ফিরুন
      </Link>

      <header className="text-center space-y-2">
        <div
          className="inline-flex w-14 h-14 rounded-2xl items-center justify-center"
          style={{ background: "linear-gradient(135deg,#7c3aed,#06b6d4)" }}
        >
          <ShieldCheck className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black">ডেটা সেফটি ও অনুমতি</h1>
        <p className="text-xs text-muted-foreground">
          Play Store-এর জন্য সংক্ষিপ্ত ডেটা সেফটি সারসংক্ষেপ
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
        সর্বশেষ হালনাগাদ: অক্টোবর ২০২৬ · বিস্তারিত পড়ুন:{" "}

        <Link to="/privacy" className="underline">
          গোপনীয়তা নীতি
        </Link>{" "}
        ·{" "}
        <Link to="/terms" className="underline">
          নিয়ম ও শর্তাবলি
        </Link>{" "}
        ·{" "}
        <Link to="/child-safety" className="underline">
          Child Safety
        </Link>
      </p>
    </main>
  );
}
