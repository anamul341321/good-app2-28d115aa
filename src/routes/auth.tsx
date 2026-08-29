import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  ShieldCheck,
  Check,
  ArrowRight,
  HandHeart,
  HelpCircle,
  ChevronDown,
  Heart,
  Users,
  Gift,
  Coins,
} from "lucide-react";
import { registerWithPhone, resolveCardUidForLogin } from "@/lib/auth.functions";
import { startLoginOtp, completeLoginOtp } from "@/lib/login-otp.functions";
import { getAuthMode } from "@/lib/auth-mode.functions";
import { useQuery } from "@tanstack/react-query";
import logo from "@/assets/goodapp-logo.png";
import { PageVoice } from "@/components/PageVoice";
import { VideoTutorialButton } from "@/components/VideoTutorialButton";
import { ApkDownloadCard } from "@/components/ApkDownloadCard";
import { QrScanner } from "@/components/QrScanner";
import { FaceAuthFlow } from "@/components/FaceAuthFlow";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { getSharedSession } from "@/lib/auth-session";
import { getDeviceId } from "@/hooks/useDeviceGuard";

import { ScanFace } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login ও Registration | Good-App" },
      {
        name: "description",
        content:
          "Good-App account-এ login করুন অথবা নতুন account খুলে face verification শুরু করুন।",
      },
      { property: "og:title", content: "Login ও Registration | Good-App" },
      {
        property: "og:description",
        content: "Good-App account-এ login করুন অথবা নতুন account খুলুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function phoneToEmail(phone: string) {
  return `u${phone}@facemine.app`;
}

function isAuthBannedError(error: any): boolean {
  const msg = String(error?.message ?? "").toLowerCase();
  const code = String(error?.code ?? "").toLowerCase();
  return (
    code === "user_disabled" ||
    msg.includes("banned") ||
    msg.includes("disabled") ||
    msg.includes("blocked") ||
    msg.includes("ban")
  );
}

const RULES: { title: string; body: string }[] = [
  {
    title: "১ নম্বর = ১ একাউন্ট",
    body: "একটি মোবাইল নম্বর দিয়ে শুধু একটি একাউন্ট খোলা যাবে। ডুপ্লিকেট পেলে ব্যান।",
  },
  {
    title: "আসল মুখ দিয়েই ভেরিফাই",
    body: "নিজের আসল মুখ দিয়ে ফেস ভেরিফিকেশন করতে হবে। অন্যের ছবি বা ফেক ফেস দিলে একাউন্ট স্থায়ীভাবে বাতিল।",
  },
  {
    title: "১০টি টাস্ক = মাসিক রিওয়ার্ড",
    body: "১০টি স্লট সম্পূর্ণ ভেরিফাই হলে মাসিক হারে লাইভ রিওয়ার্ড সুবিধা চালু হবে। প্রদর্শিত হার আনুমানিক এবং অ্যাপের নিয়ম ও তহবিলের উপর নির্ভরশীল।",
  },
  {
    title: "বোনাস শুধু প্রথম ১০টি স্লটে",
    body: "ফার্স্ট ভেরিফাই বোনাস ও রি-ভেরিফাই বোনাস শুধু প্রথম ১০টি স্লট (স্লট ১–১০) সম্পন্ন করলেই পাওয়া যায়। ১১, ১২, ১৩ … বাড়তি স্লট রি-ভেরিফাই করলে বোনাস হিসাবে ধরা হবে না — বাড়তি স্লটে শুধু মাসিক মাইনিং বাড়ে। নিয়ম এড়িয়ে বোনাস নেওয়ার চেষ্টা করলে হিসাব যাচাইয়ের জন্য ব্যালেন্স সাময়িকভাবে freeze করা হবে।",
  },
  {
    title: "Whitelist হারালেই রি-ভেরিফাই",
    body: "সাধারণত ৪–৫ দিনের মধ্যে লাগতে পারে, তবে শুধু Good-App whitelist বাতিল করলেই অ্যাপ রি-ভেরিফাই চাইবে। Whitelist ঠিক থাকলে কিছু করতে হবে না।",
  },
  {
    title: "উইথড্র নিয়ম",
    body: "ন্যূনতম ৫০৳ থেকে বিকাশ / নগদে উইথড্র। ওয়ালেট নম্বর একবার সেট করার পর আর পরিবর্তন করা যাবে না।",
  },
  {
    title: "মিথ্যা তথ্য নিষিদ্ধ",
    body: "ভুল নাম, ভুল নম্বর বা অন্যের পরিচয় দিলে একাউন্ট সাসপেন্ড ও পেমেন্ট আটকে দেওয়া হবে।",
  },
  {
    title: "কোনো গ্যারান্টিড ইনকাম নয়",
    body: "Good-App কোনো বিনিয়োগ, চাকরি বা গ্যারান্টিড আয়ের প্রতিশ্রুতি দেয় না। রিওয়ার্ড পেতে হলে সব নিয়ম মেনে চলতে হবে।",
  },
  {
    title: "অ্যাডমিনের সিদ্ধান্তই চূড়ান্ত",
    body: "যেকোনো বিতর্কিত বিষয়ে অ্যাডমিনের সিদ্ধান্তই চূড়ান্ত বলে গণ্য হবে।",
  },
];

const FAQS: {
  q: string;
  a: string;
  icon: React.ElementType;
  tone: "cyan" | "emerald" | "amber" | "violet" | "rose";
}[] = [
  {
    q: "Face Verification করলে কোনো সমস্যা হবে কি?",
    a: "Good-App এমন একটি প্ল্যাটফর্ম, যেখানে একজন ব্যবহারকারী প্রকৃত (Real) মানুষ কি না তা নিশ্চিত করতে Face Verification করা হয়। সফল যাচাইয়ের পর প্ল্যাটফর্ম থেকে ফ্রি reward/bonus দেওয়া হয়। এর উদ্দেশ্য একজন ব্যক্তি যেন একাধিক account খুলে অন্যায় সুবিধা নিতে না পারেন। এখানে NID, OTP, bank PIN বা কোনো password নেওয়া হয় না। এটি সম্পূর্ণ ঐচ্ছিক—আপনি চাইলে করবেন, না চাইলে করবেন না; কাউকে বাধ্য করা হয় না।",
    icon: ShieldCheck,
    tone: "emerald",
  },
  {
    q: "Re-verify কেন চাওয়া হয়?",
    a: "আপনার Face key বা account অন্য কেউ ব্যবহার করছে কি না এবং account নিরাপদ আছে কি না নিশ্চিত করার জন্য Re-verify চাওয়া হয়। Good-App whitelist বাতিল না করা পর্যন্ত Good-App Re-verify চাইবে না। Whitelist হারালে app আপনাকে জানাবে; সফল Re-verify-এর পর key আবার whitelist হলে সেটি Re-verify হিসেবে গণনা হবে। ভবিষ্যতে আবার whitelist হারালে নিরাপত্তার জন্য আবারও Re-verify করতে পারবেন।",
    icon: ShieldCheck,
    tone: "violet",
  },
  {
    q: "এই টাকা আসলে কোথা থেকে আসে?",
    a: "গুড-অ্যাপ একটি আর্থিক সহায়ক প্রতিষ্ঠান। আমাদের প্রধান লক্ষ্য সমাজের সুবিধাবঞ্চিত, অসহায় ও বেকার মানুষদের পাশে দাঁড়ানো। বিশ্বের বিভিন্ন দাতব্য সংস্থা, আন্তর্জাতিক অনুদান (গুড-অ্যাপ প্রোটোকল সহ) এবং আমাদের নিজস্ব তহবিল থেকে এই অর্থ আসে। আপনার ফেস ভেরিফাই করার মাধ্যমে প্রমাণ হয় আপনি একজন বাস্তব মানুষ — এর বিনিময়ে আমরা মাসিক সহায়তা প্রদান করি।",
    icon: Heart,
    tone: "rose",
  },
  {
    q: "আমাদের লক্ষ্য কী?",
    a: "দেশের প্রতিটি সুবিধাবঞ্চিত মানুষের হাতে অন্তত একটু সম্মানজনক উপার্জনের সুযোগ পৌঁছে দেওয়া। বেকার ছাত্র, গৃহিণী, কৃষক, রিকশাচালক — যারা ছোট একটি বাড়তি আয়ের আশা রাখেন, তাদের জন্যই এই প্ল্যাটফর্ম।",
    icon: HandHeart,
    tone: "emerald",
  },
  {
    q: "এটা কি স্থায়ীভাবে চলবে?",
    a: "যতদিন আপনার পরিচয় ও Good-App whitelist ঠিক থাকবে, ততদিন মাইনিং চলবে। Whitelist হারালেই শুধু পরিচয় ও account-এর নিরাপত্তা নিশ্চিত করতে Re-verify চাওয়া হবে।",
    icon: Coins,
    tone: "amber",
  },
  {
    q: "কতজন মানুষ ইতিমধ্যে যুক্ত হয়েছেন?",
    a: "প্রতিদিন হাজারো মানুষ আমাদের সাথে যুক্ত হচ্ছেন। আপনি একা নন — আপনি একটি বিশাল মানবিক পরিবারের অংশ হতে যাচ্ছেন।",
    icon: Users,
    tone: "cyan",
  },
  {
    q: "শুরু করতে কত খরচ?",
    a: "সম্পূর্ণ বিনামূল্যে। কোনো রেজিস্ট্রেশন ফি, কোনো ডিপোজিট নেই। শুধু আপনার আসল মুখ দিয়ে ফেস ভেরিফাই করুন — ব্যস।",
    icon: Gift,
    tone: "violet",
  },
];

const toneClass: Record<string, { bg: string; chip: string; ring: string }> = {
  cyan: { bg: "from-cyan/15 to-cyan/5", chip: "bg-cyan", ring: "ring-cyan/40" },
  emerald: { bg: "from-emerald/15 to-emerald/5", chip: "bg-emerald", ring: "ring-emerald/40" },
  amber: { bg: "from-amber/15 to-amber/5", chip: "bg-amber", ring: "ring-amber/40" },
  violet: { bg: "from-violet/15 to-violet/5", chip: "bg-violet", ring: "ring-violet/40" },
  rose: { bg: "from-rose/15 to-rose/5", chip: "bg-rose", ring: "ring-rose/40" },
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
  const [gmail, setGmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [faceMode, setFaceMode] = useState<null | "signup" | "login">(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpId, setOtpId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpDest, setOtpDest] = useState<string | null>(null);
  const startOtp = useServerFn(startLoginOtp);
  const confirmOtp = useServerFn(completeLoginOtp);
  const { data: authMode } = useQuery({
    queryKey: ["auth-mode"],
    queryFn: () => getAuthMode(),
    staleTime: 60_000,
  });
  // Switch OFF হলে আগের মতো শুধু নম্বর/পাসওয়ার্ড UI; query লোড হওয়া পর্যন্ত legacy ধরে নিই।
  const otpEnabled = authMode?.emailOtpEnabled === true;

  const resolveUid = useServerFn(resolveCardUidForLogin);

  const handleScan = async (raw: string) => {
    setScanOpen(false);
    try {
      // Extract UID from QR — could be full URL or plain uid
      const m = raw.match(/card\/([0-9a-f-]{8,})/i);
      const candidate = m?.[1] ?? raw.trim();
      const res = await resolveUid({ data: { uid: candidate } });
      setLoginId(res.phone);
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
        try {
          localStorage.setItem("good-app-ref-code", ref.toUpperCase());
        } catch {}
      }
    }

    // Google full-page redirect থেকে ফিরলে hash token থাকলে session বসাই।
    // Query-এর `code` Lovable OAuth broker/Supabase client নিজেই consume করে;
    // এখানে আবার exchange করলে একই code দুইবার ব্যবহৃত হয়ে login ব্যর্থ হয়।
    async function consumeOAuthTokens() {
      if (typeof window === "undefined") return false;
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const access = hash.get("access_token");
      const refresh = hash.get("refresh_token");
      try {
        if (access && refresh) {
          const { error } = await supabase.auth.setSession({
            access_token: access,
            refresh_token: refresh,
          });
          if (error) return false;
        } else {
          return false;
        }
        window.history.replaceState({}, "", window.location.pathname);
        nav({ to: "/home" });
        return true;
      } catch {
        return false;
      }
    }

    void (async () => {
      if (await consumeOAuthTokens()) return;
      // Client/broker callback একটু পরে session লিখতে পারে, তাই callback URL-এ
      // অল্প সময় অপেক্ষা করি—নিজে authorization code exchange করি না।
      const hasOAuthCallback = new URLSearchParams(window.location.search).has("code");
      const attempts = hasOAuthCallback ? 16 : 1;
      for (let i = 0; i < attempts; i++) {
        const { data } = await getSharedSession();
        if (data.session) {
          window.history.replaceState({}, "", window.location.pathname);
          nav({ to: "/home" });
          return;
        }
        if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    })();
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
    if (mode === "signup" && !gender) {
      toast.error("ছেলে অথবা মেয়ে সিলেক্ট করুন");
      return null;
    }
    if (mode === "signup" && otpEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail.trim())) {
      toast.error("সঠিক Gmail ঠিকানা দিন");
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
    if (mode === "login") {
      const id = loginId.trim();
      const digits = id.replace(/\D/g, "");
      const isPhone = /^01\d{9}$/.test(digits);
      const isMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
      if (!isPhone && !isMail) {
        toast.error("১১ ডিজিটের নম্বর অথবা Gmail দিন");
        return;
      }
      if (password.length < 6) {
        toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
        return;
      }
      doLoginStart(isPhone ? digits : id.toLowerCase());
      return;
    }
    const ok = validateForm();
    if (!ok) return;
    setStep("agreement");
  };

  async function applySession(session: { access_token: string; refresh_token: string }) {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (error) throw new Error("সেশন তৈরি করা যায়নি — আবার চেষ্টা করুন");
  }

  async function doLoginStart(identifier: string) {
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        window.setTimeout(
          () => reject(new Error("লগইন করতে বেশি সময় লাগছে — আবার চেষ্টা করুন")),
          20_000,
        ),
      );
      const res: any = await Promise.race([
        startOtp({ data: { identifier, password, deviceId: getDeviceId() } }),
        timeout,
      ]);
      if (!res.needOtp && res.session) {
        await applySession(res.session);
        toast.success(res.trustedDevice ? "স্বাগতম! এই ডিভাইসে ২৪ ঘণ্টা OTP লাগবে না" : "স্বাগতম!");
        nav({ to: "/home" });
        return;
      }
      setOtpId(identifier);
      setOtpDest(res.destination ?? null);
      setOtpCode("");
      setOtpOpen(true);
      toast.success(
        res.resent === false
          ? "কোড আগেই পাঠানো হয়েছে — মেইলবক্স দেখুন"
          : "Gmail-এ ৬ ডিজিটের কোড পাঠানো হয়েছে",
      );
    } catch (e: any) {
      toast.error(e?.message ?? "লগইন করা যায়নি");
    } finally {
      setLoading(false);
    }
  }

  async function doLoginConfirm() {
    setLoading(true);
    try {
      const res: any = await confirmOtp({
        data: { identifier: otpId, password, code: otpCode, deviceId: getDeviceId() },
      });
      await applySession(res.session);
      setOtpOpen(false);
      toast.success("স্বাগতম! এই ডিভাইসে ২৪ ঘণ্টা OTP লাগবে না");
      nav({ to: "/home" });
    } catch (e: any) {
      toast.error(e?.message ?? "কোড মেলেনি");
    } finally {
      setLoading(false);
    }
  }

  async function doGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    let redirecting = false;
    try {
      // "লগইন" নাকি "সাইন-আপ" — Google থেকে ফেরার পর গেট এটা দেখে সিদ্ধান্ত নেবে
      try {
        localStorage.setItem("good-app-google-intent", mode);
        if (referralCode.trim())
          localStorage.setItem("good-app-ref-code", referralCode.trim().toUpperCase());
      } catch {}

      // ১) নেটিভ অ্যাপে প্রথমে Android Credential Manager — ফোনে যুক্ত Gmail
      // একাউন্টগুলো সরাসরি chooser-এ দেখাবে (নতুন করে Gmail লিখতে হবে না)।
      let pickedEmail: string | undefined;
      try {
        const { nativeGoogleAvailable, signInWithNativeGoogle } = await import(
          "@/lib/native-google"
        );
        if (nativeGoogleAvailable()) {
          const nat = await signInWithNativeGoogle();
          pickedEmail = nat.email;
          if (nat.ok) {
            const { clearSharedSession } = await import("@/lib/auth-session");
            clearSharedSession();
            redirecting = true;
            window.location.href = "/home";
            return;
          }
          console.warn("native google sign-in failed, falling back:", nat.error);
        }
      } catch (nativeErr) {
        console.warn("native google sign-in crashed, falling back", nativeErr);
      }

      // ২) ফলব্যাক: Lovable-managed Google OAuth (web/browser flow)।
      // chooser-এ বেছে নেওয়া Gmail থাকলে সেটাই prefill করি — তখন নতুন করে
      // Gmail যোগ করতে বলবে না, শুধু কনফার্ম করলেই লগইন হবে।
      const { lovable } = await import("@/integrations/lovable/index");

      const res: any = await lovable.auth.signInWithOAuth("google", {
        // Broker-এর canonical public callback ব্যবহার করি। নির্দিষ্ট auth route
        // দিলে preview WebView-তে callback code দুবার process হওয়ার ঝুঁকি থাকে।
        redirect_uri: window.location.origin,
        extraParams: pickedEmail
          ? { login_hint: pickedEmail, prompt: "select_account" }
          : { prompt: "select_account" },
      });


      if (res?.error) throw new Error(res.error.message ?? "Google লগইন করা যায়নি");
      if (res?.redirected) {
        // ব্রাউজার Google-এ যাচ্ছে — স্পিনার চালু রাখি
        redirecting = true;
        return;
      }
      // Popup-এ টোকেন এসেছে; session আসলে বসেছে কি না নিশ্চিত করি — তারপরই যাই।
      const { clearSharedSession } = await import("@/lib/auth-session");
      clearSharedSession();
      let ok = false;
      for (let i = 0; i < 12; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          ok = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!ok) throw new Error("Google লগইন সম্পূর্ণ হয়নি — আবার চেষ্টা করুন");
      redirecting = true;
      window.location.href = "/home";
    } catch (e: any) {
      toast.error(e?.message ?? "Google লগইন করা যায়নি");
    } finally {
      if (!redirecting) setGoogleLoading(false);
    }
  }

  async function doSignup() {
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 11);
    setLoading(true);
    try {
      await register({
        data: {
          name,
          phone: cleanPhone,
          password,
          gender: (gender ?? "male") as "male" | "female",
          gmail: gmail.trim().toLowerCase() || null,
          referralCode: referralCode || null,
        },
      });
      const { error } = await supabase.auth.signInWithPassword({
        email: phoneToEmail(cleanPhone),
        password,
      });
      if (error) throw error;
      try {
        localStorage.removeItem("good-app-tour-v2");
        localStorage.setItem("good-app-tour-force", "1");
      } catch {}
      toast.success("একাউন্ট তৈরি হয়েছে!");
      nav({ to: "/home" });
    } catch (e: any) {
      if (isAuthBannedError(e)) {
        toast.error("আপনার account block করা আছে — admin-এর সাথে যোগাযোগ করুন");
      } else {
        toast.error(e.message ?? "কিছু সমস্যা হয়েছে");
      }
    } finally {
      setLoading(false);
    }
  }

  if (step === "agreement") {
    return (
      <div className="min-h-screen gradient-aurora flex items-center justify-center px-4 py-8">
        <PageVoice
          pageId="auth-agreement"
          steps={[
            "auth.agreement",
            "auth.rule.1",
            "auth.rule.2",
            "auth.rule.3",
            "auth.rule.4",
            "auth.rule.5",
            "auth.rule.6",
            "auth.rule.7",
            "auth.submit",
          ]}
        />
        <div className="w-full max-w-md premium-panel rounded-3xl p-6 pop-in">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-navy mb-3 float-anim">
              <ShieldCheck className="w-7 h-7 text-gold" />
            </div>
            <h1 className="text-xl font-black text-navy">নিয়মাবলি ও শর্তাবলি</h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              একাউন্ট তৈরি করার আগে অনুগ্রহ করে পড়ুন
            </p>
            <div className="gold-divider mt-3" />
          </div>

          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {RULES.map((r, i) => {
              const tones = ["cyan", "emerald", "amber", "violet", "rose"] as const;
              const t = toneClass[tones[i % tones.length]] ?? toneClass.cyan;
              return (
                <div
                  key={i}
                  className={`rounded-2xl p-3 flex gap-3 bg-linear-to-br ${t.bg} border border-border`}
                >
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full ${t.chip} text-white flex items-center justify-center font-black text-xs`}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-black text-sm text-navy">{r.title}</p>
                    <p className="text-[12px] leading-relaxed text-muted-foreground mt-0.5">
                      {r.body}
                    </p>
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
            <span
              className="text-[12px] text-navy font-bold leading-snug"
              onClick={() => setAgreed((v) => !v)}
            >
              আমি উপরের সকল নিয়মাবলি পড়েছি এবং মেনে চলতে রাজি আছি।
            </span>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep("form")}
              className="py-3 rounded-xl bg-surface-2 border border-border font-bold text-sm text-navy btn-press"
              disabled={loading}
            >
              পিছনে
            </button>
            <button
              onClick={doSignup}
              disabled={!agreed || loading}
              className="py-3 rounded-xl gradient-emerald font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 btn-press pulse-glow"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              রাজি, একাউন্ট তৈরি করুন
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-aurora">
      <PageVoice
        pageId={`auth-${mode}`}
        steps={
          mode === "signup"
            ? [
                "auth.welcome",
                "auth.mode.signup",
                "auth.name",
                "auth.phone",
                "auth.password",
                "auth.referral",
                "auth.agreement",
              ]
            : [
                "auth.welcome",
                "auth.mode.login",
                "auth.phone",
                "auth.password",
                "auth.login.submit",
              ]
        }
      />
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
              <span className="text-violet">মাসিক রিওয়ার্ড সুবিধা</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 px-2">
              রিওয়ার্ড অ্যাপের নিয়ম, তহবিল ও সক্রিয় স্লটের উপর নির্ভরশীল — কোনো "গ্যারান্টিড
              ইনকাম" নয়।
            </p>
            <div className="gold-divider mt-3" />
            <div className="mt-4">
              <VideoTutorialButton />
            </div>
            <div className="mt-3 text-left">
              <ApkDownloadCard />
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
                    ? m === "login"
                      ? "gradient-cta"
                      : "gradient-emerald"
                    : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "লগইন" : "সাইন আপ"}
              </button>
            ))}
          </div>

          {/* সুপারিশকৃত পদ্ধতি — সবার উপরে */}
          <div className="mb-4 rounded-2xl border-2 border-emerald/40 bg-emerald/5 p-3">
            <p className="mb-2 text-center text-[11px] font-black uppercase tracking-wider text-emerald">
              ⭐ সুপারিশকৃত — ফেস দিয়ে {mode === "login" ? "লগইন" : "রেজিস্ট্রেশন"}
            </p>
            <button
              type="button"
              onClick={() => setFaceMode(mode === "login" ? "login" : "signup")}
              data-voice={mode === "login" ? "auth.face.login" : undefined}
              className="w-full py-3 rounded-xl font-black text-sm flex flex-col items-center justify-center gap-0.5 text-white btn-press shadow-lg"
              style={{ background: "linear-gradient(120deg,#10b981,#06b6d4,#8b5cf6)" }}
            >
              <span className="flex items-center gap-2">
                <ScanFace className="w-4 h-4" />
                {mode === "login" ? "ফেস দিয়ে লগইন করুন" : "ফেস দিয়ে রেজিস্ট্রেশন করুন"}
              </span>
              <span className="text-[10px] font-bold opacity-90">
                {mode === "login"
                  ? "লাইভ ক্যামেরায় মুখ স্ক্যান করলেই একাউন্ট চিনে নেবে"
                  : "ধাপে ধাপে তথ্য দিন — শেষে ফেস ভেরিফিকেশন খুলবে"}
              </span>

            </button>
          </div>

          <form onSubmit={onFormNext} className="space-y-3">
            {mode === "signup" && (
              <div data-voice="auth.name">
                <label className="text-[11px] font-black text-emerald uppercase tracking-wider">
                  নাম
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-emerald text-navy transition"
                />
              </div>
            )}
            {mode === "login" ? (
              <div data-voice="auth.phone">
                <label className="text-[11px] font-black text-cyan uppercase tracking-wider">
                  মোবাইল নম্বর অথবা Gmail
                </label>
                <input
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.trim())}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="01XXXXXXXXX অথবা yourname@gmail.com"
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-cyan text-navy transition"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {otpEnabled
                    ? "যেটা সহজ সেটাই দিন — লগইনের সময় আপনার Gmail-এ ৬ ডিজিটের কোড যাবে।"
                    : "যেটা সহজ সেটাই দিন — যাদের Gmail যোগ করা আছে, তাদের লগইনে Gmail-এ ৬ ডিজিটের কোড যাবে (2-Step সিকিউরিটি)।"}
                </p>
              </div>
            ) : (
              <div data-voice="auth.phone">
                <label className="text-[11px] font-black text-cyan uppercase tracking-wider">
                  মোবাইল নম্বর
                </label>
                <input
                  inputMode="numeric"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="০১XXXXXXXXX (১১ ডিজিট)"
                  maxLength={11}
                  autoComplete="tel"
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-cyan mono-num text-navy transition"
                />
              </div>
            )}

            {mode === "signup" && otpEnabled && (
              <div data-voice="auth.email">
                <label className="text-[11px] font-black text-rose uppercase tracking-wider">
                  📧 Gmail (ভেরিফিকেশন লাগবে)
                </label>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={gmail}
                  onChange={(e) => setGmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-rose text-navy transition"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  একাউন্ট খোলার পর এই Gmail-এ কোড যাবে — কোড বসালেই Gmail লিংক হবে ও পাসওয়ার্ড ভুলে
                  গেলে নিজেই রিসেট করতে পারবেন।
                </p>
              </div>
            )}
            {mode === "signup" && (
              <div data-voice="auth.gender">
                <label className="text-[11px] font-black text-violet uppercase tracking-wider">
                  আপনি ছেলে না মেয়ে?
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {([
                    { key: "male", label: "ছেলে", icon: "/avatar-male.png" },
                    { key: "female", label: "মেয়ে", icon: "/avatar-female.png" },
                  ] as const).map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGender(g.key)}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-black transition btn-press ${
                        gender === g.key
                          ? "border-violet bg-violet/10 text-violet"
                          : "border-border bg-white text-navy"
                      }`}
                    >
                      <img src={g.icon} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-full" />
                      {g.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  ছবি না দিলে এই অনুযায়ী ডিফল্ট প্রোফাইল ছবি দেখাবে।
                </p>
              </div>
            )}
            <div data-voice="auth.password">
              <label className="text-[11px] font-black text-violet uppercase tracking-wider">
                পাসওয়ার্ড
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-violet text-navy transition"
              />
            </div>
            {mode === "signup" && (
              <div data-voice="auth.referral">
                <label className="text-[11px] font-black text-emerald uppercase tracking-wider flex items-center gap-1">
                  🎁 রেফারেল কোড{" "}
                  <span className="text-muted-foreground normal-case font-bold">(ঐচ্ছিক)</span>
                </label>
                <input
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase().slice(0, 12))}
                  placeholder="উদাহরণ: ABC1234"
                  className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-emerald mono-num tracking-widest text-navy transition"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  কেউ আপনাকে রেফার করলে তাঁর কোড লিখুন।
                </p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              data-voice={mode === "login" ? "auth.login.submit" : "auth.agreement"}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press ${
                mode === "login" ? "gradient-cta" : "gradient-amber"
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "লগইন করুন" : "পরবর্তী ধাপ"}
            </button>

            <div className="flex items-center gap-2 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-black text-muted-foreground">অথবা</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={doGoogle}
              disabled={loading || googleLoading}
              className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 bg-white border-2 border-border text-navy btn-press disabled:opacity-60"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Google-এ নিয়ে যাচ্ছি…
                </>
              ) : (
                <>
                  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden>
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.1 24.5c0-1.6-.1-2.8-.4-4.1H24v8.1h12.5c-.3 2.1-1.6 5.2-4.6 7.3l7.6 5.9c4.5-4.2 6.6-10.3 6.6-17.2z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.4 28.7A14.6 14.6 0 019.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.5 0 11.9-2.1 15.6-5.8l-7.6-5.9c-2 1.4-4.7 2.4-8 2.4-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {mode === "login" && (
              <>
                {/* যাদের Gmail যোগ করা আছে তারা নিজেই রিসেট করতে পারবে;
                    Gmail না থাকলে সার্ভার থেকেই অ্যাডমিনের সাথে যোগাযোগের মেসেজ যাবে। */}
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="w-full py-2 text-[12px] font-black text-cyan underline underline-offset-4"
                >
                  পাসওয়ার্ড ভুলে গেছেন?
                </button>
              </>
            )}
          </form>

          <p className="text-[10px] text-center text-muted-foreground mt-5">
            🔒 আপনার সমস্ত তথ্য এনক্রিপ্টেড ও সম্পূর্ণ নিরাপদ
          </p>
        </div>

        {scanOpen && <QrScanner onResult={handleScan} onClose={() => setScanOpen(false)} />}

        {faceMode && (
          <FaceAuthFlow
            mode={faceMode}
            name={name.trim()}
            phone={phone.replace(/\D/g, "").slice(0, 11)}
            password={password}
            gender={gender}
            gmail={gmail.trim() || null}
            referralCode={referralCode.trim() || null}
            onClose={() => setFaceMode(null)}
            onSkipped={() => {
              setFaceMode(null);
              setMode("login");
              setLoginId(phone.replace(/\D/g, "").slice(0, 11));
              toast.info("লগইন করুন — প্রোফাইলে ফেস ভেরিফিকেশন বাকি আছে দেখাবে");
            }}
            onSignedUp={async (p, pw) => {
              setFaceMode(null);
              const cleanPhone = (p || phone.replace(/\D/g, "").slice(0, 11)).trim();
              const pass = pw || password;
              // ভেরিফিকেশন সফল হলে auto sign-in — ইউজারকে আবার পাসওয়ার্ড দিতে হবে না
              try {
                const { error } = await supabase.auth.signInWithPassword({
                  email: phoneToEmail(cleanPhone),
                  password: pass,
                });
                if (error) throw error;
                try {
                  localStorage.removeItem("good-app-tour-v2");
                  localStorage.setItem("good-app-tour-force", "1");
                } catch {}
                toast.success("একাউন্ট তৈরি হয়েছে — স্বাগতম!");
                nav({ to: "/home" });
                return;
              } catch (e: any) {
                if (isAuthBannedError(e)) {
                  toast.error("আপনার account block করা আছে — admin-এর সাথে যোগাযোগ করুন");
                  return;
                }
                setMode("login");
                setLoginId(cleanPhone);
                toast.success("একাউন্ট তৈরি হয়েছে — এখন পাসওয়ার্ড দিয়ে লগইন করুন");
              }
            }}
            onResolved={async (p, pw) => {
              setMode("login");
              setLoginId(p);
              if (!pw) {
                setFaceMode(null);
                toast.success("ফেস চেনা গেছে — এখন পাসওয়ার্ড দিন");
                return;
              }
              // ফেস ম্যাচ + পাসওয়ার্ড — দুইটাই মিললেই লগইন
              try {
                const { error } = await supabase.auth.signInWithPassword({
                  email: phoneToEmail(p),
                  password: pw,
                });
                if (error) throw error;
                setFaceMode(null);
                toast.success("লগইন সফল — স্বাগতম!");
                nav({ to: "/home" });
              } catch (e: any) {
                if (isAuthBannedError(e)) {
                  toast.error("আপনার account block করা আছে — admin-এর সাথে যোগাযোগ করুন");
                } else {
                  toast.error("পাসওয়ার্ড ভুল — আবার চেষ্টা করুন");
                }
              }
            }}
          />
        )}

        {otpOpen && (
          <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain p-4 bg-black/75 backdrop-blur-sm flex items-start justify-center">
            <div
              className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
              style={{ background: "linear-gradient(160deg,#0ea5e9,#6366f1,#8b5cf6)" }}
            >
              <div className="p-5 text-white space-y-3">
                <h2 className="text-center text-lg font-black drop-shadow">🔐 লগইন ভেরিফিকেশন</h2>
                <input
                  autoFocus
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="৬ ডিজিটের কোড"
                  className="w-full rounded-2xl px-4 py-3 text-center text-[18px] font-black tracking-[8px] text-slate-900 bg-white/95 outline-none mono-num"
                />
                <p className="text-center text-[12.5px] font-bold leading-relaxed">
                  আপনার Gmail <b translate="no">{otpDest}</b>-এ ৬ ডিজিটের কোড পাঠানো হয়েছে। কোডটি
                  বসিয়ে লগইন সম্পূর্ণ করুন।
                </p>

                <button
                  type="button"
                  onClick={doLoginConfirm}
                  disabled={loading || otpCode.length !== 6}
                  className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  ভেরিফাই করে লগইন
                </button>
                <button
                  type="button"
                  onClick={() => doLoginStart(otpId)}
                  disabled={loading}
                  className="w-full text-[11.5px] font-bold text-white/85 underline"
                >
                  আবার কোড পাঠান
                </button>
                <button
                  type="button"
                  onClick={() => setOtpOpen(false)}
                  className="w-full text-[11.5px] font-bold text-white/70"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        )}

        {forgotOpen && <ForgotPasswordDialog onClose={() => setForgotOpen(false)} />}

        {/* Mission banner */}
        <div className="rounded-3xl p-5 bg-linear-to-br from-emerald/15 via-cyan/10 to-violet/15 border border-border pop-in">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-2xl gradient-emerald flex items-center justify-center float-anim">
              <HandHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-navy">আমরা কারা?</h2>
              <p className="text-[12px] leading-relaxed text-navy/80 mt-1">
                <span className="font-black text-emerald">good-app</span> একটি আর্থিক সহায়ক
                প্রতিষ্ঠান। আমাদের লক্ষ্য —{" "}
                <span className="font-bold text-violet">
                  সমাজের সুবিধাবঞ্চিত, বেকার ও অসহায় মানুষদের
                </span>{" "}
                পাশে দাঁড়ানো এবং তাদের হাতে সম্মানজনক একটি বাড়তি আয়ের সুযোগ পৌঁছে দেওয়া।
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
              const t = toneClass[f.tone] ?? toneClass.cyan;
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
                    <div
                      className={`shrink-0 w-9 h-9 rounded-xl ${t.chip} text-white flex items-center justify-center shadow-md`}
                    >
                      <Icon className="w-4.5 h-4.5" strokeWidth={2.4} />
                    </div>
                    <span className="flex-1 font-black text-[13px] text-navy leading-snug">
                      {f.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-navy/60 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
                    />
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
