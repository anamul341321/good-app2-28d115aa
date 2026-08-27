import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Phone, UserRound, KeyRound, ShieldCheck, LogIn } from "lucide-react";
import {
  getGoogleProfileStatus,
  completeGoogleProfile,
  startGoogleAccountLink,
  completeGoogleAccountLink,
} from "@/lib/google-profile.functions";
import { getAuthMode } from "@/lib/auth-mode.functions";
import { supabase } from "@/integrations/supabase/client";

/**
 * Google দিয়ে ঢোকার পর:
 *  - নতুন Gmail → নাম + পাসওয়ার্ড (+ referral optional) নেওয়া হয়, তারপর Gmail-এ কোড।
 *  - আগের একাউন্টের Gmail → কোড দিয়ে যাচাই করে পুরোনো একাউন্টেই ঢোকানো হয়।
 *  - "লগইন" চেপে নতুন Gmail দিলে → একাউন্ট নেই বলে সাইন-আপ করতে বলা হয়।
 */
export function ProfileCompleteGate() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getGoogleProfileStatus);
  const saveFn = useServerFn(completeGoogleProfile);
  const linkStart = useServerFn(startGoogleAccountLink);
  const linkConfirm = useServerFn(completeGoogleAccountLink);

  const { data: mode, isLoading: modeLoading } = useQuery({
    queryKey: ["auth-mode"],
    queryFn: () => getAuthMode(),
    staleTime: 60_000,
  });

  const { data } = useQuery({
    queryKey: ["google-profile-status"],
    queryFn: () => statusFn(),
    staleTime: 60_000,
    enabled: !modeLoading && mode?.emailOtpEnabled !== false,
  });

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [forceSignup, setForceSignup] = useState(false);

  // পুরোনো একাউন্টে লিংক করার OTP ধাপ
  const [linkStep, setLinkStep] = useState<"intro" | "code">("intro");
  const [linkCode, setLinkCode] = useState("");
  const [linkDest, setLinkDest] = useState<string | null>(null);

  useEffect(() => {
    if (data?.suggestedName && !name) setName(data.suggestedName);
    if (typeof window !== "undefined" && !ref) {
      const saved = localStorage.getItem("good-app-ref-code");
      if (saved) setRef(saved.toUpperCase());
    }
  }, [data?.suggestedName]);

  useEffect(() => {
    if (!data?.conflict && data?.existingAccount) {
      try {
        localStorage.removeItem("good-app-google-intent");
      } catch {}
    }
  }, [data?.conflict, data?.existingAccount]);

  // All hooks above must run on every render. Returning before them when the
  // auth-mode query changed from loading to ready caused React error #310.
  if (modeLoading || mode?.emailOtpEnabled === false) return null;

  const intent =
    typeof window !== "undefined" ? localStorage.getItem("good-app-google-intent") : null;

  async function bailOut() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (!data || !data.isGoogle) return null;

  // Google provider নিজেই পরিচয় যাচাই করেছে এবং এই identity বর্তমান পুরোনো
  // account-এর সঙ্গে linked থাকলে আর দ্বিতীয় OTP gate দেখাব না। শুধু Google
  // callback ভুল/duplicate account বানিয়ে একই Gmail অন্য profile-এ পেলে link
  // verification দরকার।
  const needsGoogleLoginCode = data.conflict;

  // ---------- একই Gmail-এর পুরোনো/বর্তমান একাউন্টে code দিয়ে login ----------
  if (needsGoogleLoginCode) {
    return (
      <Shell gradient="linear-gradient(160deg,#0ea5e9,#6366f1,#8b5cf6)">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <ShieldCheck className="w-9 h-9" />
        </div>
        <h2 className="text-center text-lg font-black drop-shadow">আপনার পুরোনো একাউন্টে ঢুকছেন</h2>
        <p className="text-center text-[12.5px] font-bold leading-relaxed">
          এই Gmail আপনার আগের একাউন্টে যুক্ত আছে। নিরাপত্তার জন্য Gmail-এ পাঠানো ৬ ডিজিটের কোড
          বসালেই সেই একাউন্টেই ঢুকে যাবেন 💙
        </p>

        {linkStep === "intro" ? (
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res: any = await linkStart({});
                if (res?.skipOtp) {
                  const done: any = await linkConfirm({ data: { code: "" } });
                  if (done?.session) await supabase.auth.setSession(done.session);
                  try { localStorage.removeItem("good-app-google-intent"); } catch {}
                  toast.success("স্বাগতম! আপনার পুরোনো একাউন্টে ঢুকেছেন 💙");
                  window.location.href = "/home";
                  return;
                }
                setLinkDest(res?.destination ?? data.conflictEmail);
                setLinkStep("code");
                toast.success(
                  res?.resent === false
                    ? "কোড আগেই পাঠানো হয়েছে — মেইলবক্স দেখুন"
                    : "Gmail-এ কোড পাঠানো হয়েছে",
                );
              } catch (e: any) {
                toast.error(e?.message ?? "কোড পাঠানো যায়নি");
              } finally {
                setBusy(false);
              }
            }}
            className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            {data.otpRequired === false ? "পুরোনো একাউন্টে ঢুকুন" : "Gmail-এ কোড পাঠান"}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-center text-[12px] font-bold bg-white/15 rounded-xl py-2">
              কোড পাঠানো হয়েছে: <b translate="no">{linkDest}</b>
            </p>
            <input
              inputMode="numeric"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="৬ ডিজিটের কোড"
              className="w-full rounded-2xl px-4 py-3 text-center text-[18px] font-black tracking-[8px] text-slate-900 bg-white/95 outline-none mono-num"
            />
            <button
              disabled={busy || linkCode.length !== 6}
              onClick={async () => {
                setBusy(true);
                try {
                  const res: any = await linkConfirm({ data: { code: linkCode } });
                  if (res.session) await supabase.auth.setSession(res.session);
                  try { localStorage.removeItem("good-app-google-intent"); } catch {}
                  toast.success("স্বাগতম! আপনার পুরোনো একাউন্টে ঢুকেছেন 💙");
                  window.location.href = "/home";
                } catch (e: any) {
                  toast.error(e?.message ?? "কোড মেলেনি");
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              ভেরিফাই করে ঢুকুন
            </button>
            <button
              onClick={() => setLinkStep("intro")}
              className="w-full text-[11.5px] font-bold text-white/85 underline"
            >
              আবার কোড পাঠান
            </button>
          </div>
        )}
        <button onClick={bailOut} className="w-full text-[11.5px] font-bold text-white/80 underline">
          অন্য উপায়ে লগইন করব
        </button>
      </Shell>
    );
  }

  if (!data.needsProfile) return null;

  // ---------- লগইন চেপে নতুন Gmail দিলে: একাউন্ট নেই ----------
  if (intent === "login" && !forceSignup) {
    return (
      <Shell gradient="linear-gradient(160deg,#f59e0b,#f43f5e,#e11d48)">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <UserRound className="w-9 h-9" />
        </div>
        <h2 className="text-center text-lg font-black drop-shadow">এই Gmail-এ কোনো একাউন্ট নেই</h2>
        <p className="text-center text-[12.5px] font-bold leading-relaxed">
          এই Gmail দিয়ে আগে কোনো একাউন্ট খোলা হয়নি। চাইলে এখনই নতুন একাউন্ট খুলে নিতে পারেন —
          মাত্র ১ মিনিটের কাজ।
        </p>
        <button
          onClick={() => {
            localStorage.setItem("good-app-google-intent", "signup");
            setForceSignup(true);
          }}
          className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-rose-600 btn-press"
        >
          নতুন একাউন্ট খুলি
        </button>
        <button onClick={bailOut} className="w-full text-[11.5px] font-bold text-white/85 underline">
          লগইন পেজে ফিরে যান
        </button>
      </Shell>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveFn({
        data: { name, password, phone, referralCode: ref || null },
      });
      try {
        localStorage.removeItem("good-app-google-intent");
        localStorage.removeItem("good-app-ref-code");
      } catch {}
      toast.success("প্রোফাইল সেভ হয়েছে — এখন Gmail-এ কোড দিয়ে ভেরিফাই করুন");
      await qc.invalidateQueries({ queryKey: ["google-profile-status"] });
      await qc.invalidateQueries({ queryKey: ["email-verify-status"] });
    } catch (err: any) {
      toast.error(err?.message ?? "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  // ---------- Google সাইন-আপ: নাম + পাসওয়ার্ড + referral ----------
  return (
    <Shell gradient="linear-gradient(160deg,#10b981,#0ea5e9,#6366f1)">
      <form onSubmit={submit} className="space-y-3">
        <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
          <UserRound className="w-9 h-9" />
        </div>
        <h2 className="text-center text-lg font-black drop-shadow">একাউন্ট সম্পূর্ণ করুন</h2>
        <p className="text-center text-[12.5px] font-bold leading-relaxed">
          Google দিয়ে ঢুকেছেন 🎉 এখন আপনার নাম, মোবাইল নম্বর ও একটি পাসওয়ার্ড দিন — এরপর Gmail-এ
          কোড গিয়ে ভেরিফিকেশন শেষ হবে।
        </p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="আপনার নাম"
          autoComplete="name"
          className="w-full rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none"
        />
        <div className="relative">
          <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
            className="w-full rounded-2xl pl-9 pr-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none"
          />
        </div>
        <div className="relative">
          <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="মোবাইল নম্বর (আবশ্যক)"
            className="w-full rounded-2xl pl-9 pr-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none mono-num"
          />
        </div>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value.toUpperCase())}
          placeholder="Referral code (থাকলে দিন — ঐচ্ছিক)"
          className="w-full rounded-2xl px-4 py-3 text-[13px] font-bold text-slate-900 bg-white/95 outline-none"
        />
        <button
          type="submit"
          disabled={busy || name.trim().length < 2 || password.length < 6 || !/^01\d{9}$/.test(phone)}
          className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-emerald-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          সেভ করুন
        </button>
      </form>
    </Shell>
  );
}

function Shell({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain p-4 bg-black/80 backdrop-blur-sm flex items-start justify-center">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500"
        style={{ background: gradient }}
      >
        <div className="p-5 text-white space-y-3">{children}</div>
      </div>
    </div>
  );
}
