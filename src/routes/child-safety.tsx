import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Baby, AlertTriangle, MessageSquareWarning, Ban, Eye, Trash2, Mail, ArrowLeft, Users, FileCheck } from "lucide-react";

export const Route = createFileRoute("/child-safety")({
  head: () => ({
    meta: [
      { title: "Child Safety Standards | Good-App" },
      {
        name: "description",
        content:
          "Good-App's published child safety standards and commitments against child sexual abuse and exploitation (CSAE).",
      },
      { property: "og:title", content: "Child Safety Standards | Good-App" },
      {
        property: "og:description",
        content:
          "Good-App's child safety policy, reporting mechanisms, and CSAE prevention practices.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChildSafetyPage,
});

const SECTIONS: { icon: React.ElementType; title: string; points: string[] }[] = [
  {
    icon: ShieldCheck,
    title: "১. আমাদের প্রতিশ্রুতি",
    points: [
      "Good-App শিশুদের নিরাপত্তাকে সর্বোচ্চ অগ্রাধিকার দেয় এবং শিশু যৌন নির্যাতন ও শোষণ (CSAE) এর বিরুদ্ধে শূন্য সহনশীলতা নীতি অনুসরণ করে।",
      "আমাদের প্ল্যাটফর্ম ১৮ বছর বা তার বেশি বয়সী ব্যবহারকারীদের জন্য ডিজাইন করা হয়েছে। আমরা জেনেশুনে শিশুদের কাছ থেকে তথ্য সংগ্রহ করি না।",
      "যেকোনো CSAE-সংক্রান্ত বিষয়বস্তু, আচরণ বা কার্যকলাপের বিরুদ্ধে দ্রুত ও কঠোর ব্যবস্থা নেওয়া হয়।",
    ],
  },
  {
    icon: Users,
    title: "২. কে এই অ্যাপ ব্যবহার করতে পারে",
    points: [
      "Good-App শুধুমাত্র প্রাপ্তবয়স্ক ব্যবহারকারীদের জন্য (১৮+)। রেজিস্ট্রেশনের সময় ব্যবহারকারীকে নিজের বয়স ১৮ বছর বা তার বেশি হিসেবে ঘোষণা করতে হয়।",
      "অভিভাবকদের পরামর্শ দেওয়া হয় যে শিশুদের এই অ্যাপ ব্যবহার করতে না দিতে।",
      "যদি কোনো শিশুর একাউন্ট শনাক্ত করা যায়, সেটি অবিলম্বে বন্ধ করে দেওয়া হয় এবং সম্পর্কিত তথ্য মুছে ফেলা হয়।",
    ],
  },
  {
    icon: Eye,
    title: "৩. CSAE-সংক্রান্ত বিষয়বস্তু চিহ্নিতকরণ",
    points: [
      "আমরা স্বয়ংক্রিয় ও ম্যানুয়াল উভয় পদ্ধতিতে CSAE-সংক্রান্ত বিষয়বস্তু, মেসেজ, মিডিয়া এবং প্রোফাইল পর্যালোচনা করি।",
      "ইউজার-জেনারেটেড কনটেন্ট (পোস্ট, রিলস, স্টোরি, মেসেজ, কমেন্ট) এর উপর নজরদারি রাখা হয়।",
      "যেকোনো শিশু-ঝুঁকিপূর্ণ (child-endangering) বিষয়বস্তু, grooming, বা শিশুদের যৌহিকীকরণ আচরণ শূন্য সহনশীলতায় দেখা হয়।",
    ],
  },
  {
    icon: MessageSquareWarning,
    title: "৪. ইন-অ্যাপ রিপোর্টিং",
    points: [
      "প্রতিটি মেসেজ, পোস্ট, কমেন্ট, প্রোফাইল এবং কল-স্ক্রিনে রিপোর্ট বাটন থাকে।",
      "রিপোর্ট করা কনটেন্ট দ্রুত পর্যালোচনা করা হয় এবং প্রয়োজনে সরাসরি অ্যাকাউন্ট স্থগিত বা মুছে ফেলা হয়।",
      "রিপোর্টকারীর পরিচয় গোপন রাখা হয় এবং রিপোর্ট করার কারণে কাউকে হয়রানি করা হয় না।",
    ],
  },
  {
    icon: Ban,
    title: "৫. অ্যাকাউন্ট ও কনটেন্ট ব্যবস্থা",
    points: [
      "CSAE-সংক্রান্ত কনটেন্ট আপলোড করলে সঙ্গে সঙ্গে সেই কনটেন্ট মুছে ফেলা হয়।",
      "সংশ্লিষ্ট ব্যবহারকারীর একাউন্ট স্থায়ীভাবে বন্ধ (permanent ban) করা হয়।",
      "প্রয়োজনে আইন প্রয়োগকারী সংস্থা (LEA) এবং NCMEC / ইলেকট্রনিক ক্রাইম বিভাগে রিপোর্ট করা হয়।",
    ],
  },
  {
    icon: Trash2,
    title: "৬. ডেটা সংরক্ষণ ও মুছে ফেলা",
    points: [
      "CSAE-সংক্রান্ত কনটেন্ট সংরক্ষণ করা হয় না; শনাক্ত হওয়ার সাথে সাথে মুছে ফেলা হয়।",
      "তদন্তের প্রয়োজনে সীমিত মেটাডেটা আইনি বাধ্যবাধকতা অনুযায়ী সংরক্ষণ করা হতে পারে।",
      "একাউন্ট ডিলিট করলে সম্পর্কিত সব তথ্য স্থায়ীভাবে মুছে ফেলা হয়।",
    ],
  },
  {
    icon: FileCheck,
    title: "৭. আইনি সহযোগিতা",
    points: [
      "আমরা বৈধ আইনি অনুরোধ অনুযায়ী আইন প্রয়োগকারী সংস্থার সাথে সহযোগিতা করি।",
      "CSAE-সংক্রান্ত গুরুতর ঘটনা NCMEC CyberTipline (cybertipline.org) এবং স্থানীয় কর্তৃপক্ষে রিপোর্ট করা হয়।",
      "আমাদের দ্রুত প্রতিক্রিয়া টিম ২৪/৭ সতর্ক থাকে।",
    ],
  },
  {
    icon: Baby,
    title: "৮. শিশুদের জন্য নিরাপত্তা শিক্ষা",
    points: [
      "আমরা ব্যবহারকারীদের অজানা ব্যক্তির সাথে ব্যক্তিগত তথ্য শেয়ার না করতে পরামর্শ দিই।",
      "অ্যাপের ভেতরে এবং ওয়েবসাইটে নিরাপত্তা টিপস প্রদর্শন করা হয়।",
      "অভিভাবকদের উদ্দেশ্যে নির্দেশনা প্রদান করা হয় যে কীভাবে শিশুদের অনলাইনে নিরাপদ রাখা যায়।",
    ],
  },
  {
    icon: AlertTriangle,
    title: "৯. লঙ্ঘনের ফলাফল",
    points: [
      "CSAE-সংক্রান্ত কোনো আচরণের জন্য সতর্কতা ছাড়াই স্থায়ী ব্যান দেওয়া হয়।",
      "প্রতারণামূলক প্রোফাইল, বয়স গোপন করা, বা শিশুদের প্রতি আকর্ষণ করার চেষ্টা কঠোরভাবে নিষিদ্ধ।",
      "লঙ্ঘনকারীর ডিভাইস/IP প্যাটার্ন চিহ্নিত করে ভবিষ্যতে একাউন্ট তৈরি বাধা দেওয়া হয়।",
    ],
  },
  {
    icon: Mail,
    title: "১০. যোগাযোগ",
    points: [
      "CSAE বা শিশু নিরাপত্তা সংক্রান্ত যেকোনো প্রশ্ন বা রিপোর্টের জন্য: safety@goodapp2.live",
      "সাধারণ সাপোর্ট: support@goodapp2.live",
      "জরুরি ক্ষেত্রে স্থানীয় পুলিশ বা NCMEC CyberTipline-এ রিপোর্ট করুন।",
    ],
  },
];

function ChildSafetyPage() {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-[11px] font-black text-muted-foreground btn-press">
          <ArrowLeft className="w-3.5 h-3.5" /> হোমে ফিরুন
        </Link>

        <header className="premium-panel rounded-2xl p-5 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-navy mb-3">
            <ShieldCheck className="w-7 h-7 text-gold" />
          </div>
          <h1 className="text-xl font-black text-navy">Child Safety Standards</h1>
          <p className="text-[11px] text-muted-foreground mt-1">
            Good-App-এর শিশু নিরাপত্তা নীতি ও CSAE প্রতিরোধ প্রতিশ্রুতি
          </p>
          <p className="text-[10px] text-muted-foreground mt-2">সর্বশেষ হালনাগাদ: আগস্ট ২০২৬</p>
        </header>

        {SECTIONS.map((s) => (
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
            কোনো CSAE বা শিশু নিরাপত্তা সংক্রান্ত রিপোর্ট থাকলে দ্রুত আমাদের সাথে যোগাযোগ করুন।
          </p>
        </section>
      </div>
    </main>
  );
}
