import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, Coins, Wallet, Users, AlertTriangle, Globe, FileText } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { RegionBadge } from "@/components/RegionBadge";
import { LanguageToggle } from "@/components/LanguageToggle";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "App Rules & How It Works | Good-App" },
      { name: "description", content: "Simple rules of Good-App: face verification, mining, referral, withdraw window and account safety — in your own language." },
      { property: "og:title", content: "App Rules & How It Works | Good-App" },
      { property: "og:description", content: "Read Good-App rules in simple words: verification, mining, withdraw and safety." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  const { t, region } = useLang();

  const sections = [
    {
      icon: ShieldCheck,
      title: t("১. একাউন্ট ও ফেস ভেরিফাই", "1. Account & face verification"),
      points: [
        t("এক ব্যক্তি = এক একাউন্ট। নিজের আসল নাম ও নিজের নম্বর ব্যবহার করুন।", "One person = one account. Use your real name and your own number."),
        t("আপনি সত্যিকারের মানুষ কি না — শুধু সেটা বুঝতেই ফেস ভেরিফাই নেওয়া হয়।", "Face verification only proves that you are a real person."),
        t("NID, OTP, ব্যাংক PIN বা পাসওয়ার্ড কখনো চাওয়া হয় না।", "We never ask for national ID, OTP, bank PIN or your password."),
        t("অন্যের ছবি বা ফেক ফেস দিলে একাউন্ট স্থায়ীভাবে বন্ধ হবে।", "Using someone else's photo or a fake face closes the account permanently."),
      ],
    },
    {
      icon: Coins,
      title: t("২. মাইনিং", "2. Mining"),
      points: [
        t("১০টি স্লট ভেরিফাই হলে মাইনিং চালু হয়।", "Mining starts once your 10 slots are verified."),
        t("মাইনিং ব্যালান্স প্রতিদিন ক্লেইম করতে হবে, নাহলে ব্যালান্স হারাতে পারেন।", "Claim your mining balance daily, otherwise you may lose it."),
        t("স্লটের whitelist বাতিল হলে ওই স্লটের রিওয়ার্ড ফিরে যেতে পারে।", "If a slot loses whitelist, its reward can be reversed."),
      ],
    },
    {
      icon: Wallet,
      title: t("৩. ব্যালান্স ও উইথড্র", "3. Balance & withdraw"),
      points: [
        t("সেন্ড মানি, রিচার্জ, কার্ড কেনা ও উইথড্র — সব শুধু Main Balance থেকে হয়। আগে মাইনিং ক্লেইম করুন।", "Send money, recharge, card purchase and withdraw all come from Main Balance only. Claim mining first."),
        t("প্রতি মাসের ১–৩ তারিখে উইথড্র উইন্ডো খোলা থাকে।", "The withdraw window is open on the 1st–3rd of every month."),
        t("রিচার্জ ও সেন্ড মানিতে সার্ভিস ফি কাটা হয় — কনফার্ম করার আগেই স্ক্রিনে দেখানো হয়।", "Recharge and send money have a service fee — it is shown on screen before you confirm."),
        t(
          `আপনার দেশ ${region.nameEn} — লোকাল পেমেন্ট না থাকলে USDT (Celo) ওয়ালেটে পেমেন্ট নেওয়া যায়।`,
          `Your country is ${region.nameEn} — where local payment is unavailable, you can be paid in USDT (Celo) to your wallet.`
        ),
      ],
    },
    {
      icon: Users,
      title: t("৪. রেফার ও কমিশন", "4. Referral & commission"),
      points: [
        t("আপনার রেফার কোডে কেউ একাউন্ট খুলে ভেরিফাই করলে কমিশন পাবেন।", "You earn commission when someone signs up with your code and verifies."),
        t("নিজে নিজের একাধিক একাউন্ট খুলে রেফার করা যাবে না — ধরা পড়লে সব রিওয়ার্ড বাতিল।", "Referring your own duplicate accounts is not allowed — all rewards are cancelled if detected."),
      ],
    },
    {
      icon: AlertTriangle,
      title: t("৫. নিষিদ্ধ কাজ", "5. Not allowed"),
      points: [
        t("অটো-ক্লিকার, বট বা এমুলেটর দিয়ে সময়/ক্লিক বাড়ানো নিষিদ্ধ।", "Auto-clickers, bots or emulators to fake time/clicks are banned."),
        t("একই ফোন বা একই ফেস দিয়ে একাধিক একাউন্ট চালানো নিষিদ্ধ।", "Running multiple accounts from one phone or one face is banned."),
        t("Good-App কোনো ইনভেস্টমেন্ট বা গ্যারান্টিড আয়ের প্রতিশ্রুতি দেয় না।", "Good-App is not an investment and does not promise guaranteed income."),
      ],
    },
  ];

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center justify-between gap-2">
          <Link to="/" className="btn-press inline-flex items-center gap-1 rounded-xl bg-muted/60 px-3 py-2 text-xs font-black">
            <ArrowLeft className="h-4 w-4" /> {t("পিছনে", "Back")}
          </Link>
          <div className="flex items-center gap-2">
            <RegionBadge />
            <LanguageToggle />
          </div>
        </div>

        <div className="glass mt-4 rounded-3xl p-5">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-gold">
            <Globe className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-xl font-black">{t("অ্যাপের নিয়ম — সহজ ভাষায়", "App rules — in simple words")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "উপরে দেশ বদলালেই আপনার দেশের ভাষায় সব লেখা দেখাবে। চাইলে English-ও রাখতে পারবেন।",
              "Change your country above and the app speaks your language. You can also keep English."
            )}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          {sections.map((s) => (
            <section key={s.title} className="glass rounded-3xl p-4">
              <h2 className="flex items-center gap-2 text-sm font-black text-cyan">
                <s.icon className="h-4 w-4" /> {s.title}
              </h2>
              <ul className="mt-2 space-y-1.5">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2 text-[12px] leading-relaxed text-foreground/90">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to="/privacy" className="glass btn-press flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> {t("গোপনীয়তা নীতি", "Privacy policy")}
          </Link>
          <Link to="/terms" className="glass btn-press flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black">
            <FileText className="h-4 w-4 text-violet-400" /> {t("শর্তাবলি", "Terms of service")}
          </Link>
        </div>
      </div>
    </div>
  );
}
