import { useEffect, useState } from "react";
import { liteText } from "@/lib/lite-policy";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Loader2, ShieldCheck, KeyRound, AlertTriangle } from "lucide-react";
import { getEmailVerifyStatus, requestEmailVerifyOtp, confirmEmailVerifyOtp } from "@/lib/email-verify.functions";
import { getAuthMode } from "@/lib/auth-mode.functions";

/**
 * Gmail ভেরিফিকেশন গেট।
 *  - Google দিয়ে ঢোকা ইউজার: Gmail আগেই জানা, কোড বসানো বাধ্যতামূলক।
 *  - নম্বর+পাসওয়ার্ড একাউন্ট: এখনই বা পরে করতে পারবে — না করা পর্যন্ত উপরে
 *    লাল "Gmail ভেরিফিকেশন প্রয়োজন" বার দেখাবে এবং উইথড্র চালু হবে না।
 */
export function EmailVerifyGate() {
  const qc = useQueryClient();
  const status = useServerFn(getEmailVerifyStatus);
  const sendOtp = useServerFn(requestEmailVerifyOtp);
  const confirmOtp = useServerFn(confirmEmailVerifyOtp);

  const { data: mode } = useQuery({
    queryKey: ["auth-mode"],
    queryFn: () => getAuthMode(),
    staleTime: 60_000,
  });

  const { data } = useQuery({
    queryKey: ["email-verify-status"],
    queryFn: () => status(),
    staleTime: 60_000,
    enabled: mode?.emailOtpEnabled !== false,
  });

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [dest, setDest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [emailUnavailable, setEmailUnavailable] = useState(false);
  const [expiresIn, setExpiresIn] = useState(0);
  const [resendIn, setResendIn] = useState(0);

  const required = !!data?.required;
  const oauthEmail = data?.oauthEmail ?? null;

  useEffect(() => {
    if (expiresIn <= 0 && resendIn <= 0) return;
    const id = setInterval(() => {
      setExpiresIn((v) => (v > 0 ? v - 1 : 0));
      setResendIn((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresIn, resendIn]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  useEffect(() => {
    if (!data) return;
    if (data.verified) {
      setOpen(false);
      return;
    }
    if (oauthEmail && !email) setEmail(oauthEmail);
    const dismissed =
      typeof window !== "undefined" && sessionStorage.getItem("gmail-verify-later") === "1";
    if (data.required || !dismissed) setOpen(true);
    else setDeferred(true);
  }, [data, oauthEmail]);

  if (!mode || mode.emailOtpEnabled === false) return null;
  if (!data || data.verified) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const val = (oauthEmail ?? email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
      toast.error("সঠিক Gmail ঠিকানা দিন");
      return;
    }
    setBusy(true);
    try {
      const res: any = await sendOtp({ data: { email: val } });
      if (res?.alreadyVerified) {
        toast.success("এই ইমেইল আগেই ভেরিফাইড");
        await qc.invalidateQueries({ queryKey: ["email-verify-status"] });
        setOpen(false);
        return;
      }
      setDest(res?.destination ?? val);
      setStep("code");
      setExpiresIn(10 * 60);
      setResendIn(60);
      toast.success("কোড পাঠানো হয়েছে — মেইলবক্স দেখুন (১০ মিনিটের মধ্যে বসান)");
    } catch (err: any) {
      setEmailUnavailable(true);
      toast.error(err?.message ?? "কোড পাঠানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await confirmOtp({ data: { code } });
      toast.success("Gmail ভেরিফাইড হয়েছে 💙");
      await qc.invalidateQueries({ queryKey: ["email-verify-status"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      setOpen(false);
      setDeferred(false);
    } catch (err: any) {
      toast.error(err?.message ?? "কোড মেলেনি");
    } finally {
      setBusy(false);
    }
  }

  function later() {
    try {
      sessionStorage.setItem("gmail-verify-later", "1");
    } catch {}
    setOpen(false);
    setDeferred(true);
  }

  if (!open) {
    if (!deferred) return null;
    return (
      <div className="fixed top-[124px] inset-x-0 z-[70] px-3 pointer-events-none">
        <div className="max-w-md mx-auto pointer-events-auto">
          <div
            className="rounded-2xl px-3 py-2 flex items-center gap-2 shadow-lg border border-white/20"
            style={{ background: "linear-gradient(90deg,#dc2626,#e11d48)" }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
            <p className="flex-1 min-w-0 text-white font-black text-[11.5px] leading-tight">
              Gmail ভেরিফিকেশন প্রয়োজন
            </p>
            <button
              onClick={() => setOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-xl bg-white text-rose-700 font-black text-[11px] btn-press"
            >
              Verify now
            </button>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain p-4 bg-black/75 backdrop-blur-sm flex items-start justify-center">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        style={{ background: "linear-gradient(160deg,#0ea5e9,#6366f1,#8b5cf6)" }}
      >
        <div className="p-5 text-white space-y-3">
          {step === "email" && (
            <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
              <Mail className="w-9 h-9" />
            </div>
          )}
          <h2 className="text-center text-lg font-black drop-shadow">📧 Gmail ভেরিফিকেশন</h2>
          {step === "email" && (
            <p className="text-center text-[12.5px] font-bold leading-relaxed">
              {liteText(
                "একাউন্টের নিরাপত্তা ও উইথড্র চালু রাখতে একটি Gmail ভেরিফাই করে রাখুন।",
                "একাউন্টের নিরাপত্তা ঠিক রাখতে একটি Gmail ভেরিফাই করে রাখুন।",
              )}{" "}
              পাসওয়ার্ড ভুলে গেলেও এই Gmail-এ কোড পাঠিয়ে নিজেই ঠিক করতে পারবেন।
            </p>
          )}


          {step === "email" ? (
            <form onSubmit={handleSend} className="space-y-3">
              {oauthEmail ? (
                <p className="text-center text-[13px] font-black bg-white/20 rounded-2xl py-3" translate="no">
                  {oauthEmail}
                </p>
              ) : (
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none"
                />
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                কোড পাঠান
              </button>
            </form>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-3">
              <input
                autoFocus
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="৬ ডিজিটের কোড"
                className="w-full rounded-2xl px-4 py-3 text-center text-[18px] font-black tracking-[8px] text-slate-900 bg-white/95 outline-none mono-num"
              />
              <p className="text-center text-[12px] font-bold bg-white/15 rounded-xl py-2">
                কোড পাঠানো হয়েছে: <b translate="no">{dest}</b>
              </p>
              <p className="text-center text-[12px] font-black bg-white/20 rounded-xl py-2 mono-num">
                {expiresIn > 0
                  ? `⏳ কোডের মেয়াদ শেষ হবে ${fmt(expiresIn)} মিনিটে`
                  : "⌛ কোডের সময় শেষ — আবার কোড পাঠান"}
              </p>

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                ভেরিফাই করুন
              </button>
              <button
                type="button"
                disabled={resendIn > 0}
                onClick={() => { setStep("email"); setCode(""); }}
                className="w-full text-[11.5px] font-bold text-white/85 underline disabled:opacity-60 disabled:no-underline"
              >
                {resendIn > 0
                  ? `আবার কোড পাঠানো যাবে ${fmt(resendIn)} পরে`
                  : oauthEmail
                    ? "আবার কোড পাঠান"
                    : "ইমেইল বদলাতে চাই / আবার কোড পাঠান"}
              </button>
            </form>
          )}

          {!required && (
            <button
              type="button"
              onClick={later}
              className="w-full text-[11.5px] font-black text-white/90 underline"
            >
              এখন নয়, পরে করব
            </button>
          )}

          <p className="text-center text-[10.5px] text-white/80 font-bold">
            🔒 একটি Gmail শুধু একটি একাউন্টে ব্যবহার করা যাবে
          </p>
          {emailUnavailable && (
            <div className="rounded-2xl bg-white/15 p-3 text-center">
              <p className="text-[11.5px] font-bold leading-relaxed">
                কোড পাঠাতে সমস্যা হয়েছে। ইন্টারনেট চেক করে আবার “কোড পাঠান”-এ চাপ দিন।
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
