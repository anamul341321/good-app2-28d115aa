import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, Loader2, ShieldCheck, Check, ArrowRight,
  HandHeart, HelpCircle, ChevronDown, Heart, Users, Gift, Coins,
} from "lucide-react";
import { registerWithPhone, resolveCardUidForLogin } from "@/lib/auth.functions";
import logo from "@/assets/logo.png";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { QrScanner } from "@/components/QrScanner";
import { QrCode as QrCodeIcon } from "lucide-react";


export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login ও Registration | Good-App" },
      { name: "description", content: "Good-App account-এ login করুন অথবা নতুন account খুলে face verification শুরু করুন।" },
      { property: "og:title", content: "Login ও Registration | Good-App" },
      { property: "og:description", content: "Good-App account-এ login করুন অথবা নতুন account খুলুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

const RULES: { title: string; body: string }[] = [
  { title: "১ নম্বর = ১ একাউন্ট", body: "একটি মোবাইল নম্বর দিয়ে শুধু একটি একাউন্ট খোলা যাবে। ডুপ্লিকেট পেলে ব্যান।" },
  { title: "আসল মুখ দিয়েই ভেরিফাই", body: "নিজের আসল মুখ দিয়ে ফেস ভেরিফিকেশন করতে হবে। অন্যের ছবি বা ফেক ফেস দিলে একাউন্ট স্থায়ীভাবে বাতিল।" },
  { title: "১০টি টাস্ক = ৫০০৳/মাস", body: "১০টি স্লট সম্পূর্ণ ভেরিফাই হলেই মাসিক ৫০০৳ হারে লাইভ মাইনিং শুরু হবে।" },
  { title: "Whitelist হারালেই রি-ভেরিফাই", body: "সাধারণত ৪–৫ দিনের মধ্যে লাগতে পারে, তবে শুধু GoodDollar whitelist বাতিল করলেই অ্যাপ রি-ভেরিফাই চাইবে। Whitelist ঠিক থাকলে কিছু করতে হবে না।" },
  { title: "উইথড্র নিয়ম", body: "ন্যূনতম ৫০৳ থেকে বিকাশ / নগদে উইথড্র। ওয়ালেট নম্বর একবার সেট করার পর আর পরিবর্তন করা যাবে না।" },
  { title: "মিথ্যা তথ্য নিষিদ্ধ", body: "ভুল নাম, ভুল নম্বর বা অন্যের পরিচয় দিলে একাউন্ট সাসপেন্ড ও পেমেন্ট আটকে দেওয়া হবে।" },
  { title: "অ্যাডমিনের সিদ্ধান্তই চূড়ান্ত", body: "যেকোনো বিতর্কিত বিষয়ে অ্যাডমিনের সিদ্ধান্তই চূড়ান্ত বলে গণ্য হবে।" },
];

const FAQS: { q: string; a: string; icon: React.ElementType; tone: "cyan" | "emerald" | "amber" | "violet" | "rose" }[] = [
  {
    q: "Face Verification করলে কোনো সমস্যা হবে কি?",
    a: "Good-App এমন একটি প্ল্যাটফর্ম, যেখানে একজন ব্যবহারকারী প্রকৃত (Real) মানুষ কি না তা নিশ্চিত করতে Face Verification করা হয়। সফল যাচাইয়ের পর প্ল্যাটফর্ম থেকে ফ্রি reward/bonus দেওয়া হয়। এর উদ্দেশ্য একজন ব্যক্তি যেন একাধিক account খুলে অন্যায় সুবিধা নিতে না পারেন। এখানে NID, OTP, bank PIN বা কোনো password নেওয়া হয় না। এটি সম্পূর্ণ ঐচ্ছিক—আপনি চাইলে করবেন, না চাইলে করবেন না; কাউকে বাধ্য করা হয় না।",
    icon: ShieldCheck, tone: "emerald",
  },
  {
    q: "Re-verify কেন চাওয়া হয়?",
    a: "আপনার Face key বা account অন্য কেউ ব্যবহার করছে কি না এবং account নিরাপদ আছে কি না নিশ্চিত করার জন্য Re-verify চাওয়া হয়। GoodDollar whitelist বাতিল না করা পর্যন্ত Good-App Re-verify চাইবে না। Whitelist হারালে app আপনাকে জানাবে; সফল Re-verify-এর পর key আবার whitelist হলে সেটি Re-verify হিসেবে গণনা হবে। ভবিষ্যতে আবার whitelist হারালে নিরাপত্তার জন্য আবারও Re-verify করতে পারবেন।",
    icon: ShieldCheck, tone: "violet",
  },
  {
    q: "এই টাকা আসলে কোথা থেকে আসে?",
    a: "গুড-অ্যাপ একটি আর্থিক সহায়ক প্রতিষ্ঠান। আমাদের প্রধান লক্ষ্য সমাজের সুবিধাবঞ্চিত, অসহায় ও বেকার মানুষদের পাশে দাঁড়ানো। বিশ্বের বিভিন্ন দাতব্য সংস্থা, আন্তর্জাতিক অনুদান (গুডডলার প্রোটোকল সহ) এবং আমাদের নিজস্ব তহবিল থেকে এই অর্থ আসে। আপনার ফেস ভেরিফাই করার মাধ্যমে প্রমাণ হয় আপনি একজন বাস্তব মানুষ — এর বিনিময়ে আমরা মাসিক সহায়তা প্রদান করি।",
    icon: Heart, tone: "rose",
  },
  {
    q: "আমাদের লক্ষ্য কী?",
    a: "দেশের প্রতিটি সুবিধাবঞ্চিত মানুষের হাতে অন্তত একটু সম্মানজনক উপার্জনের সুযোগ পৌঁছে দেওয়া। বেকার ছাত্র, গৃহিণী, কৃষক, রিকশাচালক — যারা ছোট একটি বাড়তি আয়ের আশা রাখেন, তাদের জন্যই এই প্ল্যাটফর্ম।",
    icon: HandHeart, tone: "emerald",
  },
  {
    q: "এটা কি স্থায়ীভাবে চলবে?",
    a: "যতদিন আপনার পরিচয় ও GoodDollar whitelist ঠিক থাকবে, ততদিন মাইনিং চলবে। Whitelist হারালেই শুধু পরিচয় ও account-এর নিরাপত্তা নিশ্চিত করতে Re-verify চাওয়া হবে।",
    icon: Coins, tone: "amber",
  },
  {
    q: "কতজন মানুষ ইতিমধ্যে যুক্ত হয়েছেন?",
    a: "প্রতিদিন হাজারো মানুষ আমাদের সাথে যুক্ত হচ্ছেন। আপনি একা নন — আপনি একটি বিশাল মানবিক পরিবারের অংশ হতে যাচ্ছেন।",
    icon: Users, tone: "cyan",
  },
  {
    q: "শুরু করতে কত খরচ?",
    a: "সম্পূর্ণ বিনামূল্যে। কোনো রেজিস্ট্রেশন ফি, কোনো ডিপোজিট নেই। শুধু আপনার আসল মুখ দিয়ে ফেস ভেরিফাই করুন — ব্যস।",
    icon: Gift, tone: "violet",
  },
];

const toneClass: Record<string, { bg: string; chip: string; ring: string }> = {
  cyan:    { bg: "from-cyan/15 to-cyan/5",       chip: "bg-cyan",    ring: "ring-cyan/40" },
  emerald: { bg: "from-emerald/15 to-emerald/5", chip: "bg-emerald", ring: "ring-emerald/40" },
  amber:   { bg: "from-amber/15 to-amber/5",     chip: "bg-amber",   ring: "ring-amber/40" },
  violet:  { bg: "from-violet/15 to-violet/5",   chip: "bg-violet",  ring: "ring-violet/40" },
  rose:    { bg: "from-rose/15 to-rose/5",       chip: "bg-rose",    ring: "ring-rose/40" },
};

export function AuthPage() {
  const nav = useNavigate();
  const register = useServerFn(registerWithPhone);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"form" | "agreement">("form");
  const [agreed, setAgreed] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scanOpen, setScanOpen] = useState(false);
  const resolveUid = useServerFn(resolveCardUidForLogin);

  const handleScan = async (raw: string) => {
    setScanOpen(false);
    try {
      // Extract UID from QR — could be full URL or plain uid
      const m = raw.match(/card\/([0-9a-f-]{8,})/i);
      const candidate = m?.[1] ?? raw.trim();
      const res = await resolveUid({ data: { uid: candidate } });
      setPhone(res.phone);
      setMode("login");
      toast.success("UID পাওয়া গেছে — এবার পাসওয়ার্ড দিন");
    } catch (e: any) {
      toast.error(e?.message ?? "QR পড়া যায়নি");
    }
  };

  useEffect(() => {
    // Pre-fill referral code from ?ref=XYZ
    if (typeof window !== "undefined") {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref) {
        setReferralCode(ref.toUpperCase());
        setMode("signup");
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/home" });
    });
  }, [nav]);

  const validateForm = () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 11);
    if (!/^01\d{9}$/.test(cleanPhone)) {
      toast.error("১১ ডিজিটের সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু)");
      return null;
    }
    if (mode === "signup" && name.trim().length < 2) {
      toast.error("আপনার নাম লিখুন");
      return null;
    }
    if (password.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
      return null;
    }
    return cleanPhone;
  };

  const onFormNext = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = validateForm();
    if (!ok) return;
    if (mode === "signup") setStep("agreement");
    else doLogin(ok);
  };

  async function doLogin(cleanPhone: string) {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(cleanPhone), password,
      });
      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("invalid") || msg.includes("credentials")) {
          throw new Error("ভুল নম্বর বা পাসওয়ার্ড — এই নম্বরে account না থাকলে Sign Up করুন");
        }
        throw error;
      }
      toast.success("স্বাগতম!");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "কিছু সমস্যা হয়েছে");
    } finally { setLoading(false); }
  }

  async function doSignup() {
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 11);
    setLoading(true);
    try {
      await register({ data: { name, phone: cleanPhone, password, referralCode: referralCode || null } });
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(cleanPhone), password,
      });
      if (error) throw error;
      try {
        localStorage.removeItem("good-app-tour-v2");
        localStorage.setItem("good-app-tour-force", "1");
      } catch {}
      toast.success("একাউন্ট তৈরি হয়েছে!");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e.message ?? "কিছু সমস্যা হয়েছে");
    } finally { setLoading(false); }
  }

  if (step === "agreement") {
    return (
      <div className="min-h-screen gradient-aurora flex items-center justify-center px-4 py-8">
        <PageVoice pageId="auth-agreement" steps={["auth.agreement","auth.rule.1","auth.rule.2","auth.rule.3","auth.rule.4","auth.rule.5","auth.rule.6","auth.rule.7","auth.submit"]} />
        <div className="w-full max-w-md premium-panel rounded-3xl p-6 pop-in">

          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-navy mb-3 float-anim">
              <ShieldCheck className="w-7 h-7 text-gold" />
            </div>
            <h1 className="text-xl font-black text-navy">নিয়মাবলি ও শর্তাবলি</h1>
            <p className="text-[11px] text-muted-foreground mt-1">একাউন্ট তৈরি করার আগে অনুগ্রহ করে পড়ুন</p>
            <div className="gold-divider mt-3" />
          </div>

          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {RULES.map((r, i) => {
              const tones = ["cyan","emerald","amber","violet","rose","cyan","emerald"] as const;
              const t = toneClass[tones[i]];
              return (
                <div key={i} className={`rounded-2xl p-3 flex gap-3 bg-linear-to-br ${t.bg} border border-border`}>
                  <div className={`shrink-0 w-7 h-7 rounded-full ${t.chip} text-white flex items-center justify-center font-black text-xs`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-black text-sm text-navy">{r.title}</p>
                    <p className="text-[12px] leading-relaxed text-muted-foreground mt-0.5">{r.body}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <label className="mt-4 flex items-start gap-2.5 cursor-pointer select-none">
            <span
              className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${agreed ? "bg-gold border-gold" : "border-border bg-white"}`}
              onClick={() => setAgreed((v) => !v)}
            >
              {agreed && <Check className="w-3.5 h-3.5 text-navy" strokeWidth={3} />}
            </span>
            <span className="text-[12px] text-navy font-bold leading-snug" onClick={() => setAgreed((v) => !v)}>
              আমি উপরের সকল নিয়মাবলি পড়েছি এবং মেনে চলতে রাজি আছি।
            </span>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep("form")}
              className="py-3 rounded-xl bg-surface-2 border border-border font-bold text-sm text-navy btn-press"
              disabled={loading}
            >পিছনে</button>
            <button
              onClick={doSignup}
              disabled={!agreed || loading}
              className="py-3 rounded-xl gradient-emerald font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 btn-press pulse-glow"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              রাজি, একাউন্ট তৈরি করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-aurora">
      <PageVoice pageId={`auth-${mode}`} steps={mode === "signup"
        ? ["auth.welcome","auth.mode.signup","auth.name","auth.phone","auth.password","auth.referral","auth.agreement"]
        : ["auth.welcome","auth.mode.login","auth.phone","auth.password","auth.login.submit"]} />
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">


        {/* Hero / Auth card */}
        <div className="premium-panel rounded-3xl p-7 pop-in shimmer-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-18 h-18 rounded-2xl mb-3 float-anim shadow-lg glow-gold">
              <img src={logo} alt="good-app logo" className="w-16 h-16 rounded-xl" />
            </div>
            <h1 className="text-3xl font-black text-navy tracking-tight">গুড অ্যাপ</h1>
            <p className="text-xs text-muted-foreground mt-1.5 font-bold">
              <span className="text-cyan">১০টি টাস্ক</span>
              <span className="mx-1.5 text-muted-foreground">→</span>
              <span className="text-violet">মাসে ৫০০৳ মাইনিং</span>
            </p>
            <div className="gold-divider mt-3" />
            <div className="mt-4">
              <VideoTutorialButton />
            </div>
          </div>

          <div className="flex bg-surface-2 rounded-xl p-1 mb-5 border border-border">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                data-voice={m === "login" ? "auth.mode.login" : "auth.mode.signup"}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition btn-press ${
                  mode === m
                    ? (m === "login" ? "gradient-cta" : "gradient-emerald")
                    : "text-muted-foreground"
                }`}
              >{m === "login" ? "লগইন" : "সাইন আপ"}</button>
            ))}
          </div>

          <form onSubmit={onFormNext} className="space-y-3">
            {mode === "signup" && (
              <div data-voice="auth.name">
                <label className="text-[11px] font-black text-emerald uppercase tracking-wider">নাম</label>
                <input
                  required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-emerald text-navy transition"
                />
              </div>
            )}
            <div data-voice="auth.phone">
              <label className="text-[11px] font-black text-cyan uppercase tracking-wider">মোবাইল নম্বর</label>
              <input
                inputMode="numeric" required value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="০১XXXXXXXXX (১১ ডিজিট)" maxLength={11}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-cyan mono-num text-navy transition"
              />
            </div>
            <div data-voice="auth.password">
              <label className="text-[11px] font-black text-violet uppercase tracking-wider">পাসওয়ার্ড</label>
              <input
                type="password" required minLength={6} value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-violet text-navy transition"
              />
            </div>
            {mode === "signup" && (
              <div data-voice="auth.referral">
                <label className="text-[11px] font-black text-emerald uppercase tracking-wider flex items-center gap-1">
                  🎁 রেফারেল কোড <span className="text-muted-foreground normal-case font-bold">(ঐচ্ছিক)</span>
                </label>
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="উদাহরণ: ABC1234"
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-emerald mono-num tracking-widest text-navy transition"
                />
                <p className="text-[10px] text-muted-foreground mt-1">কেউ আপনাকে রেফার করলে তাঁর কোড লিখুন।</p>
              </div>
            )}
            <button
              type="submit" disabled={loading}
              data-voice={mode === "login" ? "auth.login.submit" : "auth.agreement"}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press ${
                mode === "login" ? "gradient-cta" : "gradient-amber"
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "লগইন করুন" : "পরবর্তী ধাপ"}
            </button>

            {mode === "login" && (
              <button
                type="button" onClick={() => setScanOpen(true)}
                data-voice="auth.qr.scan"
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 text-white btn-press shadow-lg"
                style={{ background: "linear-gradient(120deg,#06b6d4,#8b5cf6,#ef476f)" }}
              >
                <QrCodeIcon className="w-4 h-4" /> QR কার্ড স্ক্যান করে লগইন
              </button>
            )}
          </form>

          <p className="text-[10px] text-center text-muted-foreground mt-5">
            🔒 আপনার সমস্ত তথ্য এনক্রিপ্টেড ও সম্পূর্ণ নিরাপদ
          </p>
        </div>

        {scanOpen && <QrScanner onResult={handleScan} onClose={() => setScanOpen(false)} />}


        {/* Mission banner */}
        <div className="rounded-3xl p-5 bg-linear-to-br from-emerald/15 via-cyan/10 to-violet/15 border border-border pop-in">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-2xl gradient-emerald flex items-center justify-center float-anim">
              <HandHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-navy">আমরা কারা?</h2>
              <p className="text-[12px] leading-relaxed text-navy/80 mt-1">
                <span className="font-black text-emerald">good-app</span> একটি আর্থিক সহায়ক প্রতিষ্ঠান।
                আমাদের লক্ষ্য — <span className="font-bold text-violet">সমাজের সুবিধাবঞ্চিত, বেকার ও অসহায় মানুষদের</span> পাশে দাঁড়ানো এবং তাদের হাতে সম্মানজনক একটি বাড়তি আয়ের সুযোগ পৌঁছে দেওয়া।
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="premium-panel rounded-3xl p-5 pop-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-xl gradient-amber flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-lg font-black text-navy">সাধারণ প্রশ্ন</h2>
          </div>

          <div className="space-y-2.5">
            {FAQS.map((f, i) => {
              const t = toneClass[f.tone];
              const Icon = f.icon;
              const open = openFaq === i;
              return (
                <div
                  key={i}
                  className={`rounded-2xl border border-border overflow-hidden transition bg-linear-to-br ${t.bg} ${open ? `ring-2 ${t.ring}` : ""}`}
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full px-3.5 py-3 flex items-center gap-3 text-left btn-press"
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-xl ${t.chip} text-white flex items-center justify-center shadow-md`}>
                      <Icon className="w-4.5 h-4.5" strokeWidth={2.4} />
                    </div>
                    <span className="flex-1 font-black text-[13px] text-navy leading-snug">{f.q}</span>
                    <ChevronDown className={`w-4 h-4 text-navy/60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="px-3.5 pb-3.5 -mt-1">
                      <p className="text-[12px] leading-relaxed text-navy/85 bg-white/70 rounded-xl p-3 border border-border">
                        {f.a}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-muted-foreground pb-4">
          © {new Date().getFullYear()} good-app · মানবিক সহায়তায় প্রতিশ্রুতিবদ্ধ
        </p>
      </div>
    </div>
  );
}
