import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Phone, UserRound } from "lucide-react";
import { getGoogleProfileStatus, completeGoogleProfile } from "@/lib/google-profile.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Google দিয়ে ঢোকা নতুন ইউজারের নাম + মোবাইল নম্বর নেওয়া হয়।
 * এরপর Gmail ভেরিফিকেশন গেট কোড চাইবে।
 */
export function ProfileCompleteGate() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getGoogleProfileStatus);
  const saveFn = useServerFn(completeGoogleProfile);

  const { data } = useQuery({
    queryKey: ["google-profile-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data || !data.needsProfile) return null;

  if (data.conflict) {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl bg-surface-2 border border-border p-5 space-y-3 text-center">
          <h2 className="text-base font-black text-rose">এই Gmail আগেই ব্যবহার হয়েছে</h2>
          <p className="text-[12.5px] font-bold text-muted-foreground leading-relaxed">
            এই Gmail দিয়ে আগে একাউন্ট খোলা হয়েছে। অনুগ্রহ করে আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে
            লগইন করুন।
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/auth";
            }}
            className="w-full rounded-2xl py-3 font-black text-[14px] gradient-cta btn-press"
          >
            লগইন পেজে যান
          </button>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveFn({ data: { name, phone, referralCode: ref || null } });
      toast.success("প্রোফাইল সেভ হয়েছে — এখন Gmail ভেরিফাই করুন");
      await qc.invalidateQueries({ queryKey: ["google-profile-status"] });
      await qc.invalidateQueries({ queryKey: ["email-verify-status"] });
    } catch (err: any) {
      toast.error(err?.message ?? "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500"
        style={{ background: "linear-gradient(160deg,#10b981,#0ea5e9,#6366f1)" }}
      >
        <form onSubmit={submit} className="p-5 text-white space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <UserRound className="w-9 h-9" />
          </div>
          <h2 className="text-center text-lg font-black drop-shadow">প্রোফাইল সম্পূর্ণ করুন</h2>
          <p className="text-center text-[12.5px] font-bold leading-relaxed">
            Google দিয়ে ঢুকেছেন 🎉 এখন নাম ও মোবাইল নম্বর দিন, তারপর Gmail-এ কোড পাঠিয়ে
            ভেরিফিকেশন শেষ হবে।
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="আপনার নাম"
            autoComplete="name"
            className="w-full rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none"
          />
          <div className="relative">
            <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-2xl pl-9 pr-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none mono-num"
            />
          </div>
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            placeholder="Referral code (না থাকলে খালি রাখুন)"
            className="w-full rounded-2xl px-4 py-3 text-[13px] font-bold text-slate-900 bg-white/95 outline-none"
          />
          <button
            type="submit"
            disabled={busy || name.trim().length < 2 || phone.length !== 11}
            className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-emerald-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            সেভ করুন
          </button>
        </form>
      </div>
    </div>
  );
}
