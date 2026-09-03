import { createFileRoute, Link } from "@tanstack/react-router";
import { litePolicySections, liteText } from "@/lib/lite-policy";
import { Trash2, ArrowLeft, Mail, ListOrdered, Database, Clock } from "lucide-react";

export const Route = createFileRoute("/account-deletion")({
  head: () => ({
    meta: [
      { title: "একাউন্ট ও ডেটা ডিলিট | Good-App" },
      {
        name: "description",
        content:
          liteText("Good-App একাউন্ট ও সব ডেটা (প্রোফাইল, ফেস ছবি, স্লট, ব্যালেন্স) কীভাবে স্থায়ীভাবে মুছে ফেলবেন — অ্যাপ থেকে বা ইমেইলে অনুরোধ করে।", "Good-App একাউন্ট ও সব ডেটা (প্রোফাইল, ফেস ছবি, মেসেজ) কীভাবে স্থায়ীভাবে মুছে ফেলবেন — অ্যাপ থেকে বা ইমেইলে অনুরোধ করে।"),
      },
      { property: "og:title", content: "একাউন্ট ও ডেটা ডিলিট | Good-App" },
      {
        property: "og:description",
        content: "Good-App একাউন্ট ডিলিট করার ধাপ, কী কী ডেটা মুছে যায় এবং কতদিন লাগে।",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountDeletionPage,
});

const BLOCKS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: ListOrdered,
    title: "অ্যাপ থেকে নিজেই ডিলিট করুন",
    points: [
      "Good-App খুলে লগইন করুন।",
      "নিচের মেনু → ‘সেটিংস’-এ যান।",
      "একদম নিচে ‘একাউন্ট ডিলিট করুন’ চাপুন।",
      "নিশ্চিত করতে ঘরে DELETE লিখে সাবমিট করুন — একাউন্ট সাথে সাথেই মুছে যাবে।",
    ],
  },
  {
    icon: Mail,
    title: "অ্যাপে ঢুকতে না পারলে",
    points: [
      "support@goodapp2.live ঠিকানায় মেইল করুন।",
      "সাবজেক্ট: Account Deletion Request।",
      "মেইলে আপনার UID / রেজিস্টার করা মোবাইল নম্বর দিন।",
      "যাচাইয়ের পর সর্বোচ্চ ৩০ দিনের মধ্যে ডেটা মুছে ফেলা হয়।",
    ],
  },
  {
    icon: Database,
    title: "কী কী স্থায়ীভাবে মুছে যায়",
    points: [
      "প্রোফাইল তথ্য: নাম, মোবাইল নম্বর, ইমেইল, জেন্ডার, ছবি।",
      "ফেস ভেরিফিকেশন ছবি ও ফেস লগইন তথ্য।",
      "স্লট, মাইনিং হিসাব, Good Coin ব্যালেন্স ও রেফারেল সংযোগ।",
      "মেসেজ, পোস্ট, কমেন্ট, স্টোরি ও রিলস।",
      "ডিভাইস/লগইন লগ।",
    ],
  },
  {
    icon: Clock,
    title: "যা কিছু সময় রাখা হতে পারে",
    points: [
      "সম্পন্ন উইথড্র/পেমেন্ট রেকর্ড — আইনগত ও হিসাবরক্ষণ বাধ্যবাধকতায় সর্বোচ্চ ১২ মাস।",
      "পেন্ডিং উইথড্র থাকলে সেটি নিষ্পত্তি হওয়ার আগে একাউন্ট ডিলিট করা যাবে না — আগে ব্যালেন্স তুলে নিন।",
    ],
  },
];

function AccountDeletionPage() {
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
          style={{ background: "linear-gradient(135deg,#ef4444,#f97316)" }}
        >
          <Trash2 className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-black">একাউন্ট ও ডেটা ডিলিট</h1>
        <p className="text-xs text-muted-foreground">
          Good-App (com.goodapp.mobile) — ডেটা মুছে ফেলার অনুরোধের নিয়ম
        </p>
      </header>

      <div className="space-y-4">
        {litePolicySections(BLOCKS).map((b) => (
          <section key={b.title} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
            <div className="flex items-center gap-2">
              <b.icon className="w-4 h-4 text-rose-500" />
              <h2 className="font-black text-sm">{b.title}</h2>
            </div>
            <ul className="space-y-1.5">
              {b.points.map((p) => (
                <li key={p} className="text-xs leading-relaxed text-muted-foreground flex gap-2">
                  <span className="text-rose-500">•</span>
                  <span className="flex-1">{p}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        বিস্তারিত:{" "}
        <Link to="/privacy" className="underline">
          গোপনীয়তা নীতি
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
        <Link to="/terms" className="underline">
          শর্তাবলি
        </Link>
      </p>
    </main>
  );
}
