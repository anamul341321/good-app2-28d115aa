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
      className="block rounded-3xl p-4 shadow-2xl btn-press ring-4 ring-cyan-300/60 relative overflow-hidden"
      style={{ background: "linear-gradient(120deg,#0ea5e9,#6366f1,#8b5cf6)" }}
    >
      <span
        className="absolute inset-0 opacity-40 animate-pulse"
        style={{ background: "radial-gradient(circle at 20% 30%, #ffffff66, transparent 60%)" }}
      />
      <div className="relative space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/25 flex items-center justify-center shrink-0">
            <Mail className="w-6 h-6 text-white animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-white leading-tight">📧 Gmail যোগ করুন — একাউন্ট সুরক্ষিত করুন</p>
            <p className="text-[11.5px] text-white/90 mt-0.5 leading-snug">
              ২-স্টেপ লগইন, পাসওয়ার্ড ভুলে গেলে নিজেই রিসেট, নতুন ফোনে সহজে লগইন।
            </p>
          </div>
        </div>
        <div className="w-full rounded-2xl bg-white py-3 text-center text-[14px] font-black text-indigo-700 flex items-center justify-center gap-2 shadow-lg">
          <Mail className="w-4 h-4" /> এখানে চাপ দিন — Gmail যোগ করুন <ArrowRight className="w-4 h-4" />
        </div>
        <p className="text-[10.5px] text-white/90 text-center font-bold">
          চাপ দিলেই Gmail লেখার বক্স খুলে যাবে — Gmail দিন, কোড বসান, শেষ ✅
        </p>
      </div>
    </Link>
  );
}

