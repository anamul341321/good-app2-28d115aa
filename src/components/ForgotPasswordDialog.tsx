import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, KeyRound, X, Send, ShieldCheck } from "lucide-react";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "@/lib/password-reset.functions";

export function ForgotPasswordDialog({
  initialPhone,
  onClose,
}: {
  initialPhone?: string;
  onClose: () => void;
}) {
  const sendOtp = useServerFn(requestPasswordResetOtp);
  const doReset = useServerFn(resetPasswordWithOtp);

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    setLoading(true);
    try {
      const res: any = await sendOtp({ data: { phone } });
      toast.success(
        `${res?.destination ?? "আপনার ইমেইলে"} — এই ইমেইলে ৬ ডিজিটের কোড পাঠানো হয়েছে`,
      );
      setStep("code");
    } catch (e: any) {
      toast.error(e?.message ?? "কোড পাঠানো যায়নি");
    } finally {
      setLoading(false);
    }
  }


  async function handleReset() {
    setLoading(true);
    try {
      await doReset({ data: { phone, code, newPassword: pw } });
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে — এখন লগইন করুন");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "পাসওয়ার্ড পরিবর্তন হয়নি");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8">
      <div className="w-full max-w-sm premium-panel rounded-3xl p-6 pop-in relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground btn-press"
          aria-label="বন্ধ করুন"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-navy mb-3">
            <KeyRound className="w-7 h-7 text-gold" />
          </div>
          <h2 className="text-lg font-black text-navy">পাসওয়ার্ড ভুলে গেছেন?</h2>
          <p className="text-[11px] text-muted-foreground mt-1">
            আপনার Gmail / মোবাইল নম্বর / UID দিন — একাউন্টে Gmail যোগ করা থাকলে ওই Gmail-এ ৬ ডিজিটের
            কোড যাবে, কোড দিয়েই নতুন পাসওয়ার্ড সেট করুন। Gmail যোগ করা না থাকলে অ্যাডমিনের সাথে
            যোগাযোগ করতে হবে।
          </p>
        </div>

        {step === "phone" ? (
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-black text-cyan uppercase tracking-wider">
                Gmail / মোবাইল নম্বর / UID
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.trim().toLowerCase())}
                placeholder="you@gmail.com অথবা 01XXXXXXXXX অথবা UID"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-cyan text-navy"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={loading || phone.trim().length < 1}
              className="w-full py-3.5 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              কোড পাঠান
            </button>
            <p className="text-[10px] text-center text-muted-foreground">
              Gmail ইনবক্সে না পেলে Spam/Promotions ফোল্ডার দেখুন।
            </p>
          </div>
        ) : (

          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-black text-violet uppercase tracking-wider">ভেরিফিকেশন কোড</label>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="৬ ডিজিট"
                maxLength={6}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-center text-lg tracking-[0.4em] outline-none focus:border-violet mono-num text-navy"
              />
            </div>
            <div>
              <label className="text-[11px] font-black text-emerald uppercase tracking-wider">নতুন পাসওয়ার্ড</label>
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={6}
                className="w-full mt-1 px-4 py-3 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-emerald text-navy"
              />
            </div>
            <button
              onClick={handleReset}
              disabled={loading || code.length !== 6 || pw.length < 6}
              className="w-full py-3.5 rounded-xl gradient-emerald font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              পাসওয়ার্ড সেট করুন
            </button>
            <button
              onClick={() => setStep("phone")}
              className="w-full py-2 text-[11px] font-bold text-muted-foreground"
            >
              ← ইমেইল বদলাতে চাই / আবার কোড নিতে চাই
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
