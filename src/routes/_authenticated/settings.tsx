import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings as SettingsIcon, ShieldCheck, KeyRound, Smartphone, Phone,
  Loader2, LogOut, MonitorSmartphone, FileText, Send, Check, Trash2,
  Shield,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAccountSettings, changePhoneNumber, deleteMyAccount, setMyGender } from "@/lib/account.functions";
import { listMyDevices, revokeDevice, revokeOtherDevices } from "@/lib/sessions.functions";
import { requestEmailVerifyOtp, confirmEmailVerifyOtp } from "@/lib/email-verify.functions";
import { requestPasswordChangeOtp, changePasswordWithOtp } from "@/lib/password-change.functions";
import { getDeviceId } from "@/hooks/useDeviceGuard";
import { FaceLoginBindCard } from "@/components/FaceLoginBindCard";

export const Route = createFileRoute("/_authenticated/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "সেটিংস ও সিকিউরিটি | Good-App" },
      { name: "description", content: "পাসওয়ার্ড পরিবর্তন, ডিভাইস লগআউট, ইমেইল ও মোবাইল নম্বর পরিবর্তন — Good-App সিকিউরিটি সেটিংস।" },
      { property: "og:title", content: "সেটিংস ও সিকিউরিটি | Good-App" },
      { property: "og:description", content: "Good-App একাউন্টের নিরাপত্তা সেটিংস ম্যানেজ করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Card({ id, icon, title, desc, children }: { id?: string; icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="premium-panel rounded-2xl p-4 space-y-3 scroll-mt-20">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0">{icon}</div>
        <div>
          <h2 className="text-sm font-black text-navy">{title}</h2>
          {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const inputCls =
  "w-full mt-1 px-3 py-2.5 bg-white border-2 border-border rounded-xl text-sm outline-none focus:border-cyan text-navy";

function SettingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const deviceId = typeof window !== "undefined" ? getDeviceId() : "";

  // /settings#gmail-security থেকে এলে ওই কার্ডে স্ক্রল করে হাইলাইট করবে
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#gmail-security") return;
    const t = setTimeout(() => {
      document.getElementById("gmail-security")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
    return () => clearTimeout(t);
  }, []);

  const account = useServerFn(getAccountSettings);
  const devicesFn = useServerFn(listMyDevices);
  const killDevice = useServerFn(revokeDevice);
  const killOthers = useServerFn(revokeOtherDevices);
  const sendEmailOtp = useServerFn(requestEmailVerifyOtp);
  const confirmEmailOtp = useServerFn(confirmEmailVerifyOtp);
  const setPhoneFn = useServerFn(changePhoneNumber);
  const setGenderFn = useServerFn(setMyGender);
  const [genderBusy, setGenderBusy] = useState(false);
  const saveGender = async (g: "male" | "female") => {
    setGenderBusy(true);
    try {
      await setGenderFn({ data: { gender: g } });
      await qc.invalidateQueries({ queryKey: ["account-settings"] });
      toast.success(g === "male" ? "সেভ হয়েছে — ছেলে" : "সেভ হয়েছে — মেয়ে");
    } catch (e: any) {
      toast.error(e?.message ?? "সেভ করা যায়নি");
    } finally {
      setGenderBusy(false);
    }
  };

  const { data: acc } = useQuery({ queryKey: ["account-settings"], queryFn: () => account() });
  const { data: devices, isLoading: devLoading } = useQuery({
    queryKey: ["my-devices", deviceId],
    queryFn: () => devicesFn({ data: { deviceId } }),
    refetchInterval: 60_000,
  });

  // password (Gmail কোড দিয়ে নিশ্চিত করা হয়)
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStep, setPwStep] = useState<"form" | "code">("form");
  const [pwCode, setPwCode] = useState("");
  const [pwDest, setPwDest] = useState<string | null>(null);
  const sendPwOtp = useServerFn(requestPasswordChangeOtp);
  const confirmPwOtp = useServerFn(changePasswordWithOtp);


  // email change
  const [newEmail, setNewEmail] = useState("");
  const [emailStep, setEmailStep] = useState<"email" | "code">("email");
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(true);


  // phone change
  const [newPhone, setNewPhone] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  // account delete
  const delAccountFn = useServerFn(deleteMyAccount);
  const [showDelete, setShowDelete] = useState(false);
  const [delWord, setDelWord] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  useEffect(() => {
    if (acc?.phone) setNewPhone(acc.phone);
  }, [acc?.phone]);

  // Gmail আগেই যোগ থাকলে নতুন Gmail-এর বক্স লুকানো থাকবে
  useEffect(() => {
    if (acc?.emailVerified) setShowEmailForm(false);
  }, [acc?.emailVerified]);


  async function sendPwCode() {
    if (newPw.length < 6) return toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    setPwBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const email = u.user?.email;
      if (!email) throw new Error("সেশন পাওয়া যায়নি — আবার লগইন করুন");
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: curPw });
      if (signErr) throw new Error("বর্তমান পাসওয়ার্ড ভুল");
      const res: any = await sendPwOtp();
      if (res?.skipOtp) {
        await confirmPwOtp({ data: { code: "000000", newPassword: newPw } });
        setCurPw(""); setNewPw(""); setPwCode(""); setPwStep("form");
        toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
        return;
      }
      setPwDest(res?.destination ?? null);
      setPwStep("code");
      toast.success("Gmail-এ ৬ ডিজিটের কোড পাঠানো হয়েছে");
    } catch (e: any) {
      toast.error(e?.message ?? "সমস্যা হয়েছে");
    } finally { setPwBusy(false); }
  }

  async function changePassword() {
    setPwBusy(true);
    try {
      await confirmPwOtp({ data: { code: pwCode, newPassword: newPw } });
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে");
      setCurPw(""); setNewPw(""); setPwCode(""); setPwStep("form");
    } catch (e: any) {
      toast.error(e?.message ?? "সমস্যা হয়েছে");
    } finally { setPwBusy(false); }
  }


  async function emailSendCode() {
    setEmailBusy(true);
    try {
      const res: any = await sendEmailOtp({ data: { email: newEmail.trim().toLowerCase() } });
      toast.success(`${res?.destination ?? "নতুন ইমেইলে"} — ৬ ডিজিটের কোড পাঠানো হয়েছে`);
      setEmailStep("code");
    } catch (e: any) {
      toast.error(e?.message ?? "কোড পাঠানো যায়নি");
    } finally { setEmailBusy(false); }
  }

  async function emailConfirm() {
    setEmailBusy(true);
    try {
      await confirmEmailOtp({ data: { code: emailCode } });
      toast.success("ইমেইল পরিবর্তন হয়েছে");
      setEmailStep("email"); setEmailCode(""); setNewEmail("");
      qc.invalidateQueries({ queryKey: ["account-settings"] });
      qc.invalidateQueries({ queryKey: ["email-verify-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "কোড মেলেনি");
    } finally { setEmailBusy(false); }
  }

  async function savePhone() {
    setPhoneBusy(true);
    try {
      await setPhoneFn({ data: { phone: newPhone } });
      toast.success("মোবাইল নম্বর পরিবর্তন হয়েছে — পরের বার এই নম্বরে লগইন করুন");
      qc.invalidateQueries({ queryKey: ["account-settings"] });
    } catch (e: any) {
      toast.error(e?.message ?? "নম্বর পরিবর্তন হয়নি");
    } finally { setPhoneBusy(false); }
  }

  async function logoutThis() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-5 h-5 text-cyan" />
        <h1 className="text-lg font-black text-navy">সেটিংস</h1>
      </div>

      <FaceLoginBindCard />

      <Card
        icon={<SettingsIcon className="w-4 h-4 text-violet" />}
        title="ছেলে / মেয়ে (লিঙ্গ)"
        desc="প্রোফাইল ছবি না থাকলে এই অনুযায়ী ডিফল্ট অবতার দেখানো হবে।"
      >
        <div className="grid grid-cols-2 gap-2">
          {([
            { key: "male", label: "ছেলে", icon: "/avatar-male.png" },
            { key: "female", label: "মেয়ে", icon: "/avatar-female.png" },
          ] as const).map((g) => (
            <button
              key={g.key}
              type="button"
              disabled={genderBusy}
              onClick={() => saveGender(g.key)}
              className={`btn-press flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-black transition disabled:opacity-60 ${
                (acc as any)?.gender === g.key
                  ? "border-violet bg-violet/10 text-violet"
                  : "border-border bg-white text-navy"
              }`}
            >
              <img src={g.icon} alt="" width={24} height={24} loading="lazy" className="h-6 w-6 rounded-full" />
              {g.label}
            </button>
          ))}
        </div>
      </Card>

      <Card
        icon={<KeyRound className="w-4 h-4 text-gold" />}
        title="পাসওয়ার্ড পরিবর্তন"
        desc="নিরাপত্তার জন্য Gmail-এ পাঠানো ৬ ডিজিটের কোড দিয়ে নিশ্চিত করতে হবে।"
      >
        {pwStep === "form" ? (
          <div className="space-y-2">
            <div>
              <label className="text-[11px] font-black text-cyan uppercase tracking-wider">বর্তমান পাসওয়ার্ড</label>
              <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-[11px] font-black text-emerald uppercase tracking-wider">নতুন পাসওয়ার্ড</label>
              <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className={inputCls} />
            </div>
            <button onClick={sendPwCode} disabled={pwBusy || !curPw || newPw.length < 6}
              className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
              {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gmail-এ কোড পাঠান
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-muted-foreground">
              কোড পাঠানো হয়েছে: <b translate="no">{pwDest}</b>
            </p>
            <input inputMode="numeric" value={pwCode}
              onChange={(e) => setPwCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="৬ ডিজিটের কোড"
              className={`${inputCls} text-center tracking-[8px] font-black mono-num`} />
            <button onClick={changePassword} disabled={pwBusy || pwCode.length !== 6}
              className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
              {pwBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              কোড দিয়ে পাসওয়ার্ড সেভ করুন
            </button>
            <button onClick={() => { setPwStep("form"); setPwCode(""); }}
              className="w-full py-2 text-[11.5px] font-black text-cyan underline underline-offset-4">
              পিছনে
            </button>
          </div>
        )}

      </Card>

      <Card
        icon={<MonitorSmartphone className="w-4 h-4 text-gold" />}
        title="লগইন করা ডিভাইস (সেশন)"
        desc="আপনার একাউন্ট যে ফোন/ব্রাউজারে লগইন আছে। চাইলে এখান থেকেই অন্য ফোন লগআউট করে দিন।"
      >
        <div className="space-y-2">
          {devLoading && <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-cyan" /></div>}
          {(devices ?? []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between gap-2 bg-white border-2 border-border rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-black text-navy truncate">
                  {d.label} {d.isCurrent && <span className="text-emerald">• এই ডিভাইস</span>}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  শেষ সক্রিয়: {new Date(d.lastSeenAt).toLocaleString("bn-BD")}
                </p>
              </div>
              <button
                onClick={async () => {
                  try {
                    await killDevice({ data: { id: d.id } });
                    if (d.isCurrent) return logoutThis();
                    toast.success("ওই ডিভাইসটি লগআউট হবে");
                    qc.invalidateQueries({ queryKey: ["my-devices"] });
                  } catch (e: any) { toast.error(e?.message ?? "সমস্যা হয়েছে"); }
                }}
                className="shrink-0 px-3 py-2 rounded-lg bg-rose/10 text-rose text-[11px] font-black btn-press flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" /> লগআউট
              </button>
            </div>
          ))}
          {!devLoading && (devices ?? []).length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-2">কোনো ডিভাইস পাওয়া যায়নি</p>
          )}
          <button
            onClick={async () => {
              try {
                await killOthers({ data: { deviceId } });
                toast.success("অন্য সব ডিভাইস লগআউট হবে");
                qc.invalidateQueries({ queryKey: ["my-devices"] });
              } catch (e: any) { toast.error(e?.message ?? "সমস্যা হয়েছে"); }
            }}
            className="w-full py-3 rounded-xl gradient-navy text-gold font-black text-sm flex items-center justify-center gap-2 btn-press"
          >
            <Smartphone className="w-4 h-4" /> এই ফোন ছাড়া সব ডিভাইস লগআউট
          </button>
          <p className="text-[10px] text-muted-foreground">
            নিজে লগআউট না করলে আপনাকে কখনোই জোর করে লগআউট করা হবে না।
          </p>
        </div>
      </Card>

      <Card
        id="gmail-security"
        icon={<ShieldCheck className="w-4 h-4 text-gold" />}
        title={acc?.emailVerified ? "Gmail সিকিউরিটি (2-Step) ✅ চালু" : "Gmail যোগ করে একাউন্ট সুরক্ষিত করুন (2-Step)"}
        desc={
          acc?.emailVerified
            ? `আপনার Gmail: ${acc.email} — লগইনের সময় এই Gmail-এ ৬ ডিজিটের কোড যাবে।`
            : "Gmail যোগ করা বাধ্যতামূলক নয় — তবে যোগ করলে নিচের সুবিধাগুলো পাবেন।"
        }
      >
        {acc?.emailVerified ? (
          <div className="rounded-xl bg-emerald/10 border-2 border-emerald/30 p-3 space-y-2">
            <p className="text-[12px] font-black text-navy">
              ✅ আপনার Gmail যোগ করা আছে: <b translate="no">{acc.email}</b>
            </p>
            <p className="text-[10.5px] font-bold text-muted-foreground">
              নতুন করে কিছু করার দরকার নেই। শুধু Gmail বদলাতে চাইলে নিচের বাটনে চাপ দিন।
            </p>
            {!showEmailForm ? (
              <button onClick={() => setShowEmailForm(true)}
                className="w-full py-2.5 rounded-xl bg-white border-2 border-border font-black text-[12.5px] text-navy btn-press">
                ✏️ Gmail পরিবর্তন করতে চাই
              </button>
            ) : (
              <button onClick={() => { setShowEmailForm(false); setEmailStep("email"); }}
                className="w-full py-2.5 rounded-xl bg-white border-2 border-border font-black text-[12.5px] text-muted-foreground btn-press">
                ✖ বাতিল — Gmail বদলাব না
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-surface-2 border-2 border-border p-3 space-y-1.5">
            <p className="text-[11.5px] font-black text-navy">Gmail যোগ করলে যা পাবেন:</p>
            <ul className="text-[11px] font-bold text-muted-foreground space-y-1">
              <li>✅ 2-Step লগইন — লগইনের সময় আপনার Gmail-এ ৬ ডিজিটের কোড যাবে।</li>
              <li>✅ পাসওয়ার্ড ভুলে গেলে নিজেই রিসেট — অ্যাডমিনের দরকার নেই।</li>
              <li>✅ নতুন ফোনে লগইন করতে সহজেই কোড দিয়ে ঢুকতে পারবেন।</li>
              <li>✅ Google দিয়েও লগইন করতে পারবেন — একই একাউন্টে ঢুকবে।</li>
            </ul>
            <p className="text-[11px] font-black text-cyan pt-1">
              👇 নিচের বক্সে আপনার Gmail লিখে "কোড পাঠান" চাপুন
            </p>
          </div>
        )}

        {showEmailForm && (emailStep === "email" ? (
          <div className="space-y-2">
            <label className="text-[11px] font-black text-cyan uppercase tracking-wider">এখানে আপনার Gmail লিখুন</label>
            <input
              type="email" value={newEmail} placeholder="আপনার Gmail — যেমন: name@gmail.com"
              onChange={(e) => setNewEmail(e.target.value.trim().toLowerCase())}
              className={inputCls}
            />
            <button onClick={emailSendCode}
              disabled={emailBusy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)}
              className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
              {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              কোড পাঠান
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              inputMode="numeric" maxLength={6} value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="৬ ডিজিট"
              className="w-full mt-1 px-3 py-2.5 bg-white border-2 border-border rounded-xl text-center text-lg tracking-[0.4em] outline-none focus:border-violet mono-num text-navy"
            />
            <button onClick={emailConfirm} disabled={emailBusy || emailCode.length !== 6}
              className="w-full py-3 rounded-xl gradient-emerald font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
              {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              কোড দিয়ে ইমেইল সেট করুন
            </button>
            <button onClick={() => setEmailStep("email")} className="w-full py-2 text-[11px] font-bold text-muted-foreground">
              ← ইমেইল বদলাতে চাই
            </button>
          </div>
        ))}

      </Card>

      <Card
        icon={<Phone className="w-4 h-4 text-gold" />}
        title="মোবাইল নম্বর পরিবর্তন"
        desc="নম্বর পরিবর্তনে কোনো কোড লাগবে না — সরাসরি সেভ হবে।"
      >
        <div className="space-y-2">
          <input
            inputMode="numeric" value={newPhone} placeholder="01XXXXXXXXX" maxLength={11}
            onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            className={inputCls}
          />
          <button onClick={savePhone} disabled={phoneBusy || !/^01\d{9}$/.test(newPhone) || newPhone === acc?.phone}
            className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
            {phoneBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            নম্বর সেভ করুন
          </button>
        </div>
      </Card>

      <Card icon={<FileText className="w-4 h-4 text-gold" />} title="নিয়ম ও শর্তাবলি" desc="Good-App ব্যবহারের সব নিয়ম বিস্তারিত পড়ুন।">
        <Link to="/terms" className="w-full py-3 rounded-xl bg-surface-2 border-2 border-border font-black text-sm flex items-center justify-center gap-2 btn-press text-navy">
          <FileText className="w-4 h-4" /> Terms & Conditions দেখুন
        </Link>
      </Card>

      <Card icon={<Shield className="w-4 h-4 text-cyan-500" />} title="ডেটা সেফটি ও অনুমতি" desc="আমরা কী কী ডেটা সংগ্রহ করি, কেন করি এবং কতদিন রাখি — Play Store-এর জন্য সারসংক্ষেপ।">
        <Link to="/data-safety" className="w-full py-3 rounded-xl bg-surface-2 border-2 border-border font-black text-sm flex items-center justify-center gap-2 btn-press text-navy">
          <Shield className="w-4 h-4" /> ডেটা সেফটি দেখুন
        </Link>
      </Card>

      <button onClick={logoutThis}
        className="w-full py-3 rounded-xl bg-rose/10 text-rose font-black text-sm flex items-center justify-center gap-2 btn-press">
        <LogOut className="w-4 h-4" /> এই ডিভাইস থেকে লগআউট
      </button>

      <Card
        icon={<Trash2 className="w-4 h-4 text-rose" />}
        title="একাউন্ট ডিলিট করুন"
        desc="একাউন্ট ডিলিট করলে আপনার সব তথ্য — প্রোফাইল, ফেস ছবি, স্লট, ব্যালেন্স ও হিসাব — স্থায়ীভাবে মুছে যাবে। এটি আর ফেরানো যাবে না।"
      >
        {!showDelete ? (
          <button onClick={() => setShowDelete(true)}
            className="w-full py-3 rounded-xl bg-rose/10 border-2 border-rose/30 text-rose font-black text-sm flex items-center justify-center gap-2 btn-press">
            <Trash2 className="w-4 h-4" /> আমি একাউন্ট ডিলিট করতে চাই
          </button>
        ) : (
          <div className="space-y-2">
            <ul className="text-[11px] font-bold text-muted-foreground space-y-1">
              <li>⚠️ ব্যালেন্স থাকলে আগে উইথড্র করে নিন — ডিলিটের পর টাকা ফেরত পাওয়া যাবে না।</li>
              <li>⚠️ পেন্ডিং উইথড্র থাকলে ডিলিট হবে না।</li>
              <li>⚠️ ফেস ছবি ও সব ডেটা সাথে সাথেই মুছে যাবে।</li>
            </ul>
            <label className="text-[11px] font-black text-rose uppercase tracking-wider block">
              নিশ্চিত করতে বড় হাতের DELETE লিখুন
            </label>
            <input
              value={delWord}
              onChange={(e) => setDelWord(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className={inputCls}
            />
            <button
              disabled={delBusy || delWord.trim() !== "DELETE"}
              onClick={async () => {
                setDelBusy(true);
                try {
                  await delAccountFn({ data: { confirm: delWord.trim() } });
                  toast.success("আপনার একাউন্ট স্থায়ীভাবে ডিলিট হয়েছে");
                  await qc.cancelQueries();
                  qc.clear();
                  await supabase.auth.signOut();
                  router.navigate({ to: "/auth", replace: true });
                } catch (e: any) {
                  toast.error(e?.message ?? "ডিলিট করা যায়নি");
                } finally {
                  setDelBusy(false);
                }
              }}
              className="w-full py-3 rounded-xl bg-rose text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press">
              {delBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              স্থায়ীভাবে ডিলিট করুন
            </button>
            <button onClick={() => { setShowDelete(false); setDelWord(""); }}
              className="w-full py-2 text-[11px] font-bold text-muted-foreground">
              ✖ বাতিল — ডিলিট করব না
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
