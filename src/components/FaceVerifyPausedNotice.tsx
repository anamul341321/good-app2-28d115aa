import { ShieldAlert, Clock, Sparkles } from "lucide-react";
import { isLiteBuild } from "@/lib/lite-build";
import { isFinancialText } from "@/lib/lite-policy";

/**
 * ফেস ভেরিফিকেশন সাময়িকভাবে বন্ধ থাকলে দেখানো সুন্দর বাংলা নোটিশ।
 * variant="card" → পেজের ভেতরে বড় কার্ড, variant="banner" → হোম/অথ পেজের উপরে পাতলা ব্যানার।
 */
export function FaceVerifyPausedNotice({
  message,
  variant = "card",
}: {
  message?: string | null;
  variant?: "card" | "banner";
}) {
  const lite = isLiteBuild();
  const safeMessage = lite && message && isFinancialText(message) ? null : message;
  const text =
    safeMessage ||
    "🔧 আমাদের অ্যাপের সার্ভারে কাজ চলছে, তাই ফেস ভেরিফিকেশন সিস্টেম আপাতত সাময়িকভাবে বন্ধ রাখা হয়েছে। সবকিছু ঠিক হলে আবার স্বাভাবিকভাবে চালু করে দেওয়া হবে ইনশাআল্লাহ।";

  if (variant === "banner") {
    return (
      <div className="relative overflow-hidden rounded-2xl border-2 border-amber/50 bg-gradient-to-br from-amber/15 via-surface-2 to-rose/10 p-4 shadow-lg pop-in">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber/20 blur-2xl animate-pulse" />
        <div className="relative flex items-start gap-2.5">
          <span className="shrink-0 w-9 h-9 rounded-xl bg-amber/25 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-5 h-5 text-amber" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-amber">
              ফেস ভেরিফিকেশন সাময়িকভাবে বন্ধ
            </p>
            <p className="text-[11px] text-muted-foreground font-bold leading-relaxed mt-1">
              {text}
            </p>
            <p className="text-[10px] text-emerald font-black mt-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {lite ? "আগের যাচাই করা পরিচয় নিরাপদ থাকবে" : "আগের ভেরিফাই করা স্লট ও মাইনিং আগের মতোই চলবে"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-amber/50 bg-gradient-to-b from-amber/12 via-surface-2 to-rose/10 p-6 text-center shadow-xl pop-in">
      <div className="absolute -left-8 -top-8 w-28 h-28 rounded-full bg-amber/20 blur-3xl animate-pulse" />
      <div className="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-rose/20 blur-3xl animate-pulse" />
      <div className="relative space-y-3">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber/20 flex items-center justify-center float-anim">
          <ShieldAlert className="w-8 h-8 text-amber" />
        </div>
        <h2 className="text-lg font-black text-amber">
          ফেস ভেরিফিকেশন সিস্টেম সাময়িকভাবে বন্ধ
        </h2>
        <p className="text-[12px] text-muted-foreground font-bold leading-relaxed">{text}</p>
        <div className="rounded-2xl border border-emerald/40 bg-emerald/10 p-3 text-left space-y-1.5">
          <p className="text-[11px] font-black text-emerald">✅ যা ঠিক থাকবে</p>
          <p className="text-[11px] text-muted-foreground font-bold leading-relaxed">
            • আগে যারা ফেস ভেরিফিকেশন করে ফেলেছেন তাদের সব স্লট আগের মতোই থাকবে<br />
            {lite ? (
              <>• তাদের প্রোফাইল ও পরিচয় তথ্য নিরাপদ থাকবে<br />• মেসেঞ্জার, রিলস ও অন্যান্য ফিচার চলবে</>
            ) : (
              <>• তাদের মাইনিং, বোনাস ও রেফার কমিশন স্বাভাবিকভাবে চলবে<br />• ব্যালেন্স ও হিসাব কোথাও পরিবর্তন হবে না</>
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-3 text-left">
          <p className="text-[11px] font-black text-amber flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> আপাতত যা বন্ধ
          </p>
          <p className="text-[11px] text-muted-foreground font-bold leading-relaxed mt-1">
            নতুন করে কোনো স্লটে ফেস ভেরিফাই করা যাবে না। এটি সাময়িক — কাজ শেষ হলে আবার
            স্বাভাবিকভাবে সব চালু হয়ে যাবে ইনশাআল্লাহ।
          </p>
        </div>
      </div>
    </div>
  );
}
