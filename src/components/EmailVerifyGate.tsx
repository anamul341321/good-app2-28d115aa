import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { getEmailVerifyStatus, requestEmailVerifyOtp, confirmEmailVerifyOtp } from "@/lib/email-verify.functions";

/**
 * যাদের একাউন্টে ভেরিফাইড Gmail নেই (আগে শুধু নম্বর দিয়ে খোলা), অ্যাপে ঢুকলেই
 * এই স্ক্রিনটি Gmail ভেরিফিকেশন চাইবে — কোড বসালেই ইমেইল একাউন্টে লিংক হবে।
 */
export function EmailVerifyGate() {
  const qc = useQueryClient();
  const status = useServerFn(getEmailVerifyStatus);
  const sendOtp = useServerFn(requestEmailVerifyOtp);
  const confirmOtp = useServerFn(confirmEmailVerifyOtp);

  const { data } = useQuery({
    queryKey: ["email-verify-status"],
    queryFn: () => status(),
    staleTime: 60_000,
  });

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [dest, setDest] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (data && !data.verified) setVisible(true);
    if (data?.verified) setVisible(false);
  }, [data]);

  if (!visible) return null;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const val = email.trim().toLowerCase();
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
        setVisible(false);
        return;
      }
      setDest(res?.destination ?? val);
      setStep("code");
      toast.success("কোড পাঠানো হয়েছে — মেইলবক্স দেখুন");
    } catch (err: any) {
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
      setVisible(false);
    } catch (err: any) {
      toast.error(err?.message ?? "কোড মেলেনি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        style={{ background: "linear-gradient(160deg,#0ea5e9,#6366f1,#8b5cf6)" }}
      >
        <div className="p-5 text-white space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <Mail className="w-9 h-9" />
          </div>
          <h2 className="text-center text-lg font-black drop-shadow">
            📧 Gmail ভেরিফিকেশন বাধ্যতামূলক
          </h2>
          <p className="text-center text-[12.5px] font-bold leading-relaxed">
            আপনার একাউন্টের নিরাপত্তার জন্য একটি Gmail লিংক করতে হবে। পরে পাসওয়ার্ড ভুলে
            গেলে এই Gmail-এ কোড পাঠিয়ে নিজেই পাসওয়ার্ড বদলাতে পারবেন।
          </p>

          {step === "email" ? (
            <form onSubmit={handleSend} className="space-y-3">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="w-full rounded-2xl px-4 py-3 text-[14px] font-bold text-slate-900 bg-white/95 outline-none"
              />
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
              <p className="text-center text-[12px] font-bold bg-white/15 rounded-xl py-2">
                কোড পাঠানো হয়েছে: <b translate="no">{dest}</b>
              </p>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="৬ ডিজিটের কোড"
                className="w-full rounded-2xl px-4 py-3 text-center text-[18px] font-black tracking-[8px] text-slate-900 bg-white/95 outline-none mono-num"
              />
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
                onClick={() => { setStep("email"); setCode(""); }}
                className="w-full text-[11.5px] font-bold text-white/85 underline"
              >
                ইমেইল বদলাতে চাই / আবার কোড পাঠান
              </button>
            </form>
          )}

          <p className="text-center text-[10.5px] text-white/80 font-bold">
            🔒 একটি Gmail শুধু একটি একাউন্টে ব্যবহার করা যাবে
          </p>
        </div>
      </div>
    </div>
  );
}
