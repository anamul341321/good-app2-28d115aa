import { createFileRoute, Link } from "@tanstack/react-router";
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
  Megaphone,
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
      "নাম ও মোবাইল নম্বর — একাউন্ট তৈরি ও যোগাযোগের জন্য।",
      "Gmail ঠিকানা (ঐচ্ছিক) — ২-স্টেপ লগইন নিরাপত্তার জন্য।",
      "ফেস ভেরিফিকেশন ছবি — শুধু প্রকৃত মানুষ কি না তা যাচাই করতে।",
      "লাইভ ফেস স্ক্যান (ক্যামেরা) — ফেস লগইনে আপনার সংরক্ষিত ছবির সাথে মিল যাচাই করে একাউন্ট চেনার জন্য; গ্যালারির ছবি গ্রহণ করা হয় না।",
      "পেমেন্ট নম্বর / ওয়ালেট অ্যাড্রেস — উইথড্র পরিশোধের জন্য।",
      "ডিভাইস/ব্রাউজার ধরন ও লগইন সময় — প্রতারণা রোধে।",
    ],
  },
  {
    icon: Eye,
    title: "ব্যবহারের উদ্দেশ্য",
    points: [
      "একাউন্ট পরিচালনা, ভেরিফিকেশন ও রিওয়ার্ড হিসাব রাখা।",
      "মাল্টি-একাউন্ট, ফেক ফেস ও প্রতারণা শনাক্ত করা।",
      "গুরুত্বপূর্ণ নোটিশ, OTP ও সাপোর্ট মেসেজ পাঠানো।",
      "বিজ্ঞাপনের জন্য কোনো তথ্য ব্যবহার বা বিক্রি করা হয় না।",
    ],
  },
  {
    icon: Lock,
    title: "নিরাপত্তা",
    points: [
      "সব তথ্য HTTPS এনক্রিপশন দিয়ে আদান-প্রদান হয়।",
      "ফেস ছবি এনক্রিপ্টেড সংরক্ষিত; কোনো অ্যাডমিন বা তৃতীয় পক্ষ দেখতে পারে না।",
      "ছবি কখনো বিক্রি, শেয়ার বা বিজ্ঞাপনে ব্যবহার করা হয় না।",
      "NID, ব্যাংক PIN বা কার্ড নম্বর কখনোই চাওয়া হয় না।",
    ],
  },
  {
    icon: Share2,
    title: "তৃতীয় পক্ষের সেবা",
    points: [
      "Lovable Cloud (Supabase) — ডাটাবেজ, লগইন ও ফাইল সংরক্ষণ।",
      "notify.goodapp2.live — লগইন কোড ও নোটিশ ইমেইল পাঠাতে।",
      "Google Sign-In — ঐচ্ছিক দ্রুত লগইন।",
      "টেলিগ্রাম সাপোর্ট বট — ব্যবহারকারীর UID ও স্ট্যাটাস দেখানো।",
    ],
  },
  {
    icon: Megaphone,
    title: "বিজ্ঞাপন (Google AdMob)",
    points: [
      "Google AdMob-এর ব্যানার, ইন্টারস্টিশিয়াল ও রিওয়ার্ডেড ভিডিও বিজ্ঞাপন দেখানো হতে পারে।",
      "বিজ্ঞাপনের জন্য ডিভাইসের Advertising ID (AAID) ও মোটামুটি অঞ্চল Google ব্যবহার করতে পারে।",
      "নাম, ফোন নম্বর, ফেস ছবি বা ব্যালেন্স কোনো বিজ্ঞাপন নেটওয়ার্কে যায় না।",
      "Android সেটিংস → Google → Ads থেকে ব্যক্তিগতকৃত বিজ্ঞাপন বন্ধ করা যায়।",
    ],
  },
  {
    icon: Clock,
    title: "ডেটা কতদিন রাখা হয়",
    points: [
      "একাউন্ট তথ্য: একাউন্ট চালু থাকা পর্যন্ত।",
      "ফেস ছবি: সংশ্লিষ্ট স্লট সক্রিয় থাকা পর্যন্ত।",
      "উইথড্র ও পেমেন্ট হিসাব: সর্বোচ্চ ১২ মাস।",
      "লগইন/ডিভাইস লগ: সর্বোচ্চ ৯০ দিন।",
    ],
  },
  {
    icon: UserX,
    title: "অ্যাকাউন্ট ডিলিট",
    points: [
      "সেটিংস → 'একাউন্ট ডিলিট করুন' → DELETE লিখে নিশ্চিত করুন।",
      "ডিলিটের সাথে সাথে প্রোফাইল, ফেস ছবি, স্লট, ব্যালেন্স ও হিসাব স্থায়ীভাবে মুছে যায়।",
      "অ্যাপে ঢুকতে না পারলে support@goodapp2.live-এ UID সহ মেইল করুন।",
    ],
  },
  {
    icon: Baby,
    title: "বয়স সীমা",
    points: [
      "এই অ্যাপ শুধু প্রাপ্তবয়স্ক (১৮+) ব্যবহারকারীদের জন্য।",
      "জেনেশুনে শিশুদের তথ্য সংগ্রহ করা হয় না।",
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
        বিস্তারিত পড়ুন:{" "}
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
