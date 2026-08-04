import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, ShieldCheck, ArrowRight } from "lucide-react";
import { getDashboard } from "@/lib/dashboard.functions";

/**
 * হোম পেজে সামনে দেখানোর জন্য Gmail ভেরিফিকেশন কার্ড।
 * অনেকেই সেটিংসে খুঁজে পায় না — তাই এখান থেকেই এক ট্যাপে যাওয়া যাবে।
 */
export function GmailSecurityBanner() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const profile = data?.profile as any;
  if (!profile) return null;

  const verified = !!profile.email_verified;

  if (verified) {
    return (
      <div className="flex items-center justify-center">
        <Link
          to="/settings"
          hash="gmail-security"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald/15 border border-emerald/40 text-emerald text-[11px] font-black btn-press"
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Gmail ভেরিফাইড (2-Step চালু)
        </Link>
      </div>
    );
  }

  return (
    <Link
      to="/settings"
      hash="gmail-security"
      className="block rounded-2xl p-3 shadow-lg btn-press ring-2 ring-cyan-300/70 relative overflow-hidden"
      style={{ background: "linear-gradient(120deg,#0ea5e9,#6366f1,#8b5cf6)" }}
    >
      <span
        className="absolute inset-0 opacity-30 animate-pulse"
        style={{ background: "radial-gradient(circle at 20% 30%, #ffffff55, transparent 60%)" }}
      />
      <div className="relative flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-white animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">📧 Gmail ভেরিফাই করুন — একাউন্ট সুরক্ষিত রাখুন</p>
          <p className="text-[11px] text-white/90 mt-0.5 leading-snug">
            Gmail যোগ করলে ২-স্টেপ লগইন, পাসওয়ার্ড ভুলে গেলে নিজেই রিসেট ও নতুন ফোনে সহজে লগইন করতে পারবেন।
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-white shrink-0" />
      </div>
    </Link>
  );
}
