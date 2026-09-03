import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { isLiteBuild } from "@/lib/lite-build";
import { useEffect, useState } from "react";
import {
  Download,
  ShieldCheck,
  Smartphone,
  Wallet,
  MessageCircle,
  Coins,
  Users,
  ScanFace,
  Film,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Globe,
} from "lucide-react";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Good-App ডাউনলোড করুন | Android APK" },
      {
        name: "description",
        content:
          "Good-App Android অ্যাপ (APK) ডাউনলোড করুন — মেসেঞ্জার, ফেস ভেরিফিকেশন, মাইনিং, কয়েন, রিলস, রিচার্জ ও উইথড্র সব এক অ্যাপে। ইনস্টল নিয়ম ও নিরাপত্তা তথ্য দেখুন।",
      },
      { property: "og:title", content: "Good-App ডাউনলোড করুন | Android APK" },
      {
        property: "og:description",
        content:
          "Good-App-এর অফিসিয়াল Android APK ডাউনলোড পেজ — ফিচার, স্ক্রিনশট, ইনস্টল গাইড ও নিরাপত্তা নীতি।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => {
    if (isLiteBuild()) throw redirect({ to: "/home" });
  },
  component: DownloadPage,
});

const FEATURES = [
  {
    icon: MessageCircle,
    title: "মেসেঞ্জার ও কলিং",
    text: "রিয়েল-টাইম চ্যাট, গ্রুপ, ভয়েস/ভিডিও কল, স্টোরি রিপ্লাই ও স্ক্রিন শেয়ার।",
  },
  {
    icon: ScanFace,
    title: "ফেস ভেরিফিকেশন",
    text: "স্বয়ংক্রিয় ফেস যাচাই — কোনো অ্যাডমিন আপনার ছবি দেখে না, সম্পূর্ণ এনক্রিপ্টেড।",
  },
  {
    icon: Wallet,
    title: "ওয়ালেট ও উইথড্র",
    text: "মেইন ও মাইনিং ব্যালেন্স আলাদা, প্রতি মাসের ১–৩ তারিখে মাইনিং উইথড্র।",
  },
  {
    icon: Coins,
    title: "কয়েন ও অ্যাড রিওয়ার্ড",
    text: "ডেইলি চেক-ইন, টাস্ক এবং বিজ্ঞাপন দেখে কয়েন আয়ের সুযোগ।",
  },
  {
    icon: Film,
    title: "রিলস ও ভিডিও",
    text: "ছোট ভিডিও দেখা, আপলোড ও শেয়ার — সাথে লাইক-কমেন্ট।",
  },
  {
    icon: Users,
    title: "রেফার সিস্টেম",
    text: "বন্ধুকে ইনভাইট করে কমিশন — সম্পূর্ণ স্বচ্ছ হিসাব হিস্ট্রিতে।",
  },
];

const STEPS = [
  "নিচের ডাউনলোড বাটনে ট্যাপ করুন — APK ফাইল নামা শুরু হবে।",
  "ডাউনলোড শেষে ফাইলটিতে ট্যাপ করুন।",
  "ফোন যদি “Unknown sources / অজানা উৎস” অনুমতি চায়, তাহলে অনুমতি দিন (এটি Play Store-এর বাইরের অ্যাপের জন্য স্বাভাবিক)।",
  "Install চাপুন, ইনস্টল শেষ হলে অ্যাপ খুলে মোবাইল নম্বর দিয়ে রেজিস্টার/লগইন করুন।",
  "পরবর্তী আপডেট এলে অ্যাপের ভেতরেই নোটিফিকেশন পাবেন — একই লিংক থেকে আপডেট হবে।",
];

const FAQ = [
  {
    q: "অ্যাপটি কি Play Store-এ আছে?",
    a: "এখন অ্যাপটি সরাসরি এই ওয়েবসাইট থেকে APK আকারে বিতরণ করা হচ্ছে। লিংকটি সবসময় সর্বশেষ ভার্সন দেয়।",
  },
  {
    q: "APK ইনস্টল করা কি নিরাপদ?",
    a: "হ্যাঁ, যদি শুধু এই অফিসিয়াল পেজ (goodapp2.live) থেকে ডাউনলোড করেন। অন্য কোথাও থেকে পাওয়া ফাইল ইনস্টল করবেন না।",
  },
  {
    q: "কী কী অনুমতি লাগে?",
    a: "ক্যামেরা (ফেস ভেরিফিকেশন ও ছবি), মাইক্রোফোন (কল), নোটিফিকেশন এবং স্টোরেজ। প্রতিটি অনুমতি শুধু সংশ্লিষ্ট ফিচারেই ব্যবহার হয়।",
  },
  {
    q: "ডেটা কীভাবে সুরক্ষিত?",
    a: "সব যোগাযোগ HTTPS এনক্রিপ্টেড। ফেস ছবি কখনো বিক্রি বা শেয়ার করা হয় না। বিস্তারিত গোপনীয়তা নীতিতে দেখুন।",
  },
  {
    q: "অ্যাকাউন্ট ডিলিট করতে চাই?",
    a: "অ্যাকাউন্ট ডিলিশন পেজ থেকে অনুরোধ করলে আপনার সব তথ্য মুছে ফেলা হবে।",
  },
];

function DownloadPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/public/app/download?resolve=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.version && setVersion(String(d.version)))
      .catch(() => {});
  }, []);

  const handleDownload = () => {
    setBusy(true);
    window.location.href = "/api/public/app/download";
    setTimeout(() => setBusy(false), 4000);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Hero */}
      <section className="px-5 pt-12 pb-10 max-w-3xl mx-auto text-center">
        <img
          src="/icon-512.png"
          alt="Good-App অ্যাপ আইকন"
          className="w-24 h-24 rounded-3xl mx-auto shadow-xl"
          width={96}
          height={96}
        />
        <h1 className="mt-5 text-3xl font-black">Good-App ডাউনলোড করুন</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          মেসেঞ্জার, ফেস ভেরিফিকেশন, মাইনিং, কয়েন, রিলস, মোবাইল রিচার্জ ও উইথড্র — সবকিছু একটি
          অ্যাপে। Android ফোনের জন্য অফিসিয়াল APK।
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold">
          <span className="px-3 py-1 rounded-full bg-surface-2 border border-border">
            ভার্সন {version ?? "…"}
          </span>
          <span className="px-3 py-1 rounded-full bg-surface-2 border border-border">Android 7.0+</span>
          <span className="px-3 py-1 rounded-full bg-surface-2 border border-border">বাংলা ভাষা</span>
          <span className="px-3 py-1 rounded-full bg-surface-2 border border-border">ফ্রি</span>
        </div>

        <button
          onClick={handleDownload}
          disabled={busy}
          className="mt-7 w-full sm:w-auto sm:px-10 py-4 rounded-2xl gradient-emerald font-black text-base btn-press inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Download className="w-5 h-5" />
          {busy ? "ডাউনলোড শুরু হচ্ছে…" : "APK ডাউনলোড করুন"}
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          শুধুমাত্র এই অফিসিয়াল পেজ থেকেই অ্যাপ ডাউনলোড করুন।
        </p>
      </section>

      {/* Features */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <h2 className="text-lg font-black mb-4">অ্যাপে যা যা আছে</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-surface-2 p-4">
              <f.icon className="w-5 h-5 text-cyan" />
              <p className="mt-2 font-black text-sm">{f.title}</p>
              <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Install steps */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-cyan" /> কীভাবে ইনস্টল করবেন
        </h2>
        <ol className="space-y-3">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-6 h-6 rounded-full bg-cyan/15 text-cyan text-[11px] font-black flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-[13px] leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-[12px] leading-relaxed">
            পুরোনো ভার্সন ইনস্টল থাকলে সেটি মুছবেন না — নতুন APK ইনস্টল করলেই আপডেট হয়ে যাবে এবং
            আপনার অ্যাকাউন্ট/ব্যালেন্স অক্ষত থাকবে।
          </p>
        </div>
      </section>

      {/* Safety */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" /> নিরাপত্তা ও গোপনীয়তা
        </h2>
        <ul className="space-y-2">
          {[
            "সব ডেটা HTTPS এনক্রিপশনে আদান-প্রদান হয়।",
            "ফেস ছবি স্বয়ংক্রিয়ভাবে যাচাই হয় — কোনো ব্যক্তি দেখে না, বিক্রি বা শেয়ার হয় না।",
            "NID, ব্যাংক PIN, কার্ড নম্বর বা পাসওয়ার্ড আমরা কখনো চাই না।",
            "ইউজার চাইলে যেকোনো সময় অ্যাকাউন্ট ও ডেটা মুছে ফেলার অনুরোধ করতে পারেন।",
          ].map((t) => (
            <li key={t} className="flex gap-2 items-start text-[13px] leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* FAQ */}
      <section className="px-5 py-8 max-w-3xl mx-auto">
        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-cyan" /> সাধারণ প্রশ্ন
        </h2>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-2xl border border-border bg-surface-2 p-4">
              <summary className="font-black text-sm cursor-pointer">{f.q}</summary>
              <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Bottom CTA + links */}
      <section className="px-5 pb-16 max-w-3xl mx-auto text-center">
        <button
          onClick={handleDownload}
          className="w-full sm:w-auto sm:px-10 py-4 rounded-2xl gradient-cyan font-black text-base btn-press inline-flex items-center justify-center gap-2"
        >
          <Download className="w-5 h-5" /> এখনই ডাউনলোড করুন
        </button>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-[12px] font-bold text-muted-foreground">
          <Link to="/privacy" className="underline">
            গোপনীয়তা নীতি
          </Link>
          <Link to="/terms" className="underline">
            শর্তাবলী
          </Link>
          <Link to="/child-safety" className="underline">
            শিশু নিরাপত্তা
          </Link>
          <Link to="/data-safety" className="underline">
            ডেটা সেফটি
          </Link>
          <Link to="/account-deletion" className="underline">
            অ্যাকাউন্ট ডিলিট
          </Link>
        </div>
        <p className="mt-6 text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Globe className="w-3.5 h-3.5" /> www.goodapp2.live — অফিসিয়াল ওয়েবসাইট
        </p>
      </section>
    </main>
  );
}
