import { useEffect, useRef, useState } from "react";
import { Loader2, ScanFace, X, ExternalLink, ShieldCheck, RefreshCw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { FaceCapture } from "@/components/FaceCapture";
import {
  checkFaceSignup,
  completeFaceSignup,
  faceLoginMatch,
  reverifyFaceLogin,
  skipFaceSignup,
  startFaceSignup,
} from "@/lib/face-login.functions";

type Props = {
  mode: "signup" | "login";
  /** signup-এর জন্য দরকার */
  name?: string;
  phone?: string;
  password?: string;
  gmail?: string | null;
  referralCode?: string | null;
  onClose: () => void;
  /** signup সফল হলে (nothing to do — parent sign-in করবে) */
  onSignedUp?: () => void;
  /** ভেরিফিকেশন ছাড়াই একাউন্ট তৈরি হলে (পরে প্রোফাইল থেকে করতে হবে) */
  onSkipped?: () => void;
  /** login mode: ফেস চেনা গেলে নম্বর ফেরত */
  onResolved?: (phone: string) => void;
};

/**
 * ফেস দিয়ে রেজিস্ট্রেশন/লগইন — ইউজারকে শুধু "লোড হচ্ছে" দেখানো হয় (key/technical
 * ডিটেইল লুকানো)। প্রথমে ছবি তোলা হয় (পরে re-verify-এর সময় চেনার জন্য), তারপর
 * ফেস ভেরিফিকেশন অ্যাপের ভেতরেই full screen-এ খোলে → সিস্টেম নিজেই auto check করে।
 * ভেরিফিকেশন পেজ থেকে ব্যাক করলে সাথে সাথেই whitelist চেক হয় — না হলে "আবার চেষ্টা
 * করুন" আসে; সেখানে চাপলে আগের key আবার চেক করে, তাও না হলে নতুন key দিয়ে আবার
 * ভেরিফিকেশন লিংক খোলে।
 */
export function FaceAuthFlow(props: Props) {
  const { mode, onClose } = props;
  const start = useServerFn(startFaceSignup);
  const check = useServerFn(checkFaceSignup);
  const complete = useServerFn(completeFaceSignup);
  const skip = useServerFn(skipFaceSignup);
  const faceMatch = useServerFn(faceLoginMatch);
  const reverify = useServerFn(reverifyFaceLogin);

  const [phase, setPhase] = useState<
    "info" | "secure" | "photo" | "confirm" | "prepare" | "verify" | "recheck" | "retry" | "done" | "failed"
  >(mode === "signup" ? "info" : "photo");
  const [fName, setFName] = useState(props.name ?? "");
  const [fPhone, setFPhone] = useState(props.phone ?? "");
  const [fPass, setFPass] = useState(props.password ?? "");
  const [fPass2, setFPass2] = useState(props.password ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [note, setNote] = useState("লোড হচ্ছে…");
  const [ticks, setTicks] = useState(0);
  const [frameOk, setFrameOk] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [needRegister, setNeedRegister] = useState(false);
  const busyRef = useRef(false);
  const retriesRef = useRef(0);
  const pkRef = useRef<string | null>(null);
  const loginPhoneRef = useRef<string | null>(null);


  const finishSignup = async (addr: string) => {
    setNote("✅ ভেরিফিকেশন সফল — একাউন্ট তৈরি হচ্ছে…");
    await complete({
      data: {
        name: fName.trim(),
        phone: fPhone.trim(),
        password: fPass,
        walletAddress: addr,
        gmail: props.gmail ?? null,
        referralCode: props.referralCode ?? null,
      },
    });
    setPhase("done");
    toast.success("ফেস ভেরিফিকেশন সফল — একাউন্ট তৈরি হয়েছে");
    props.onSignedUp?.();
  };

  const begin = async (photoB64?: string | null) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase("prepare");
    setFrameOk(false);
    setNote("লোড হচ্ছে…");
    try {
      const { generateNewIdentity } = await import("@/lib/gooddollar");
      const identity = await generateNewIdentity(fName.trim() || "good-app");
      if (mode === "signup") {
        await start({
          data: {
            name: fName.trim(),
            phone: fPhone.trim(),
            walletAddress: identity.address,
            privateKey: identity.privateKey,
            photoBase64: photoB64 ?? photo ?? null,
          },
        });
      }
      pkRef.current = identity.privateKey;
      setAddress(identity.address);
      setUrl(identity.verifyUrl);
      setTicks(0);
      setPhase("verify");
      setNote("ফেস ভেরিফিকেশন খুলছে — ক্যামেরার সামনে মুখ ধরুন");
    } catch (e: any) {
      setPhase("failed");
      setNote(e?.message ?? "শুরু করা যায়নি — আবার চেষ্টা করুন");
    } finally {
      busyRef.current = false;
    }
  };

  /** লগইন: আমাদের অ্যাপেই ফেস স্ক্যান → স্টোর করা ছবির সাথে ম্যাচ */
  const doFaceLogin = async (b64: string) => {
    setPhase("recheck");
    setNeedRegister(false);
    setNote("ফেস মিলিয়ে দেখা হচ্ছে…");
    try {
      const res = await faceMatch({ data: { photoBase64: b64 } });
      if (!res.found || !res.phone) {
        setNeedRegister(true);
        setPhase("failed");
        setNote("এই ফেস দিয়ে কোনো একাউন্ট পাওয়া যায়নি — আগে রেজিস্ট্রেশন করুন");
        return;
      }
      loginPhoneRef.current = res.phone;
      if (res.whitelisted) {
        setPhase("done");
        props.onResolved?.(res.phone);
        return;
      }
      toast.info("ভেরিফিকেশন মেয়াদ শেষ — আবার ফেস ভেরিফিকেশন করতে হবে");
      await begin(b64);
    } catch (e: any) {
      setPhase("retry");
      setNote(e?.message ?? "ফেস মেলানো যায়নি — আবার চেষ্টা করুন");
    }
  };

  /** লগইন ভেরিফিকেশনের পর: নতুন key সেভ করে লগইন করায় */
  const finishLoginVerify = async (addr: string) => {
    const phone = loginPhoneRef.current;
    if (!phone || !pkRef.current) return false;
    const res = await reverify({
      data: { phone, walletAddress: addr, privateKey: pkRef.current },
    });
    if (!res.verified) return false;
    setPhase("done");
    props.onResolved?.(phone);
    return true;
  };


  // ফেস ভেরিফিকেশন পেজ iframe-এ না খুললে (blank/white) নিজে থেকেই বাইরে খুলে দেবে
  useEffect(() => {
    if (phase !== "verify" || !url) return;
    const t = setTimeout(() => {
      if (!frameOk) openExternal();
    }, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, url, frameOk]);

  // auto check — ইউজারকে কিছু submit করতে হয় না
  useEffect(() => {
    if (phase !== "verify" || !address) return;
    let stopped = false;
    const loop = async () => {
      while (!stopped) {
        await new Promise((r) => setTimeout(r, 6000));
        if (stopped) return;
        setTicks((t) => t + 1);
        try {
          if (mode === "login") {
            if (await finishLoginVerify(address)) {
              stopped = true;
              return;
            }
            continue;
          }
          const res = await check({ data: { walletAddress: address } });
          if (!res.verified) continue;
          stopped = true;
          await finishSignup(address);
          return;

        } catch {
          // চেক ব্যর্থ হলে চুপচাপ আবার চেষ্টা করবে
        }
      }
    };
    void loop();
    return () => {
      stopped = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, address, mode]);

  /** ব্যাক/ক্লোজ চাপলে — বন্ধ না করে আগে whitelist চেক করে */
  const recheck = async () => {
    if (!address) {
      onClose();
      return;
    }
    setPhase("recheck");
    setNote("লোড হচ্ছে…");
    try {
      if (mode === "login") {
        if (await finishLoginVerify(address)) return;
        setPhase("retry");
        setNote("ভেরিফিকেশন এখনো সম্পন্ন হয়নি — আবার চেষ্টা করুন");
        return;
      }
      const res = await check({ data: { walletAddress: address } });
      if (res.verified) {
        await finishSignup(address);
        return;
      }
      setPhase("retry");
      setNote("ভেরিফিকেশন এখনো সম্পন্ন হয়নি — আবার চেষ্টা করুন");
    } catch {
      setPhase("retry");
      setNote("চেক করা যায়নি — আবার চেষ্টা করুন");
    }
  };

  /** "আবার চেষ্টা করুন": আগের key আবার চেক → না হলে নতুন key দিয়ে লিংক খোলে */
  const retryFlow = async () => {
    if (mode === "login" && !loginPhoneRef.current) {
      // ফেস মেলেনি — আবার স্ক্যান করতে দিন
      setNeedRegister(false);
      setPhase("photo");
      return;
    }
    setPhase("recheck");
    setNote("লোড হচ্ছে…");
    try {
      if (address) {
        if (mode === "login") {
          if (await finishLoginVerify(address)) return;
        } else {
          const res = await check({ data: { walletAddress: address } });
          if (res.verified) {
            await finishSignup(address);
            return;
          }
        }
      }
    } catch {

      // ignore — নিচে আবার চেষ্টা হবে
    }
    // প্রথম রিট্রাই: আগের key/লিংক দিয়েই আবার চেষ্টা (নতুন key লাগে না)
    if (url && address && retriesRef.current === 0) {
      retriesRef.current = 1;
      setTicks(0);
      setFrameOk(false);
      setPhase("verify");
      setNote("ফেস ভেরিফিকেশন খুলছে — ক্যামেরার সামনে মুখ ধরুন");
      return;
    }
    retriesRef.current = 0;
    setAddress(null);
    setUrl(null);
    await begin();
  };


  const openExternal = () => {
    if (!url) return;
    try {
      const opener = (window as any).GoodAppDownloader?.openExternal;
      if (opener) opener(url);
      else window.open(url, "_blank", "noopener");
    } catch {
      window.location.href = url;
    }
  };

  const doSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      if (mode === "login") {
        toast.info("ফেস চেনা যায়নি — নম্বর ও পাসওয়ার্ড দিয়ে লগইন করুন");
        onClose();
        return;
      }
      await skip({
        data: {
          name: fName.trim(),
          phone: fPhone.trim(),
          password: fPass,
          walletAddress: address || "",
          gmail: props.gmail ?? null,
          referralCode: props.referralCode ?? null,
        },
      });
      toast.success("একাউন্ট তৈরি হয়েছে — পরে প্রোফাইল থেকে ফেস ভেরিফিকেশন করে নিন");
      props.onSkipped?.();
    } catch (e: any) {
      toast.error(e?.message ?? "স্কিপ করা যায়নি");
    } finally {
      setSkipping(false);
    }
  };

  // whitelist না হলে একাউন্ট হবে না — সাইনআপে স্কিপ অপশন নেই
  const canSkip = mode === "login" && ((phase === "verify" && ticks >= 3) || phase === "retry");

  const stepIndex = phase === "info" ? 1 : phase === "secure" ? 2 : phase === "photo" ? 3 : 4;

  const nextFromInfo = () => {
    if (fName.trim().length < 2) return toast.error("আপনার পুরো নাম লিখুন");
    if (!/^01\d{9}$/.test(fPhone.trim())) return toast.error("১১ ডিজিটের সঠিক মোবাইল নম্বর দিন (০১ দিয়ে শুরু)");
    setPhase("secure");
  };

  const nextFromSecure = () => {
    if (fPass.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
    if (fPass !== fPass2) return toast.error("দুইবার একই পাসওয়ার্ড দিন");
    setPhase("photo");
  };

  const wizard = phase === "info" || phase === "secure" || phase === "photo" || phase === "confirm";

  if (wizard) {
    return (
      <div className="fixed inset-0 z-[120] overflow-y-auto overscroll-contain bg-gradient-to-b from-[#0b1220] via-[#101a2e] to-black px-4 py-6">
        <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl">
          <div
            className="flex items-center gap-2 px-4 py-3 text-white"
            style={{ background: "linear-gradient(120deg,#10b981,#06b6d4,#8b5cf6)" }}
          >
            <ScanFace className="h-5 w-5" />
            <div className="leading-tight">
              <p className="text-[13px] font-black">
                ফেস {mode === "signup" ? "রেজিস্ট্রেশন" : "লগইন"}
                {mode === "signup" ? ` — ধাপ ${stepIndex}/৪`.replace("1", "১").replace("2", "২").replace("3", "৩").replace("4", "৪") : ""}
              </p>
              <p className="text-[10.5px] font-bold opacity-90">
                {mode === "signup"
                  ? phase === "info"
                    ? "নাম ও মোবাইল নম্বর দিন"
                    : phase === "secure"
                    ? "পাসওয়ার্ড সেট করুন"
                    : phase === "photo"
                    ? "লাইভ ক্যামেরায় নিজের ছবি তুলুন"
                    : "সব ঠিক থাকলে রেজিস্ট্রেশন করুন"
                  : "লাইভ ক্যামেরায় মুখ স্ক্যান করলেই একাউন্ট চিনে নেবে"}
              </p>
            </div>
          </div>

          {mode === "signup" && (
            <div className="flex gap-1 px-4 pt-3">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={`h-1.5 flex-1 rounded-full ${n <= stepIndex ? "bg-emerald" : "bg-white/10"}`}
                />
              ))}
            </div>
          )}

          <div className="space-y-3 p-4">
            {phase === "info" && (
              <>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-emerald">নাম</label>
                  <input
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="আপনার পুরো নাম"
                    className="mt-1 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-navy outline-none focus:border-emerald"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-cyan">মোবাইল নম্বর</label>
                  <input
                    inputMode="numeric"
                    maxLength={11}
                    value={fPhone}
                    onChange={(e) => setFPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="০১XXXXXXXXX (১১ ডিজিট)"
                    className="mono-num mt-1 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-navy outline-none focus:border-cyan"
                  />
                </div>
                <button
                  type="button"
                  onClick={nextFromInfo}
                  className="w-full rounded-xl gradient-cta py-3 text-sm font-black text-white btn-press"
                >
                  পরবর্তী ধাপ →
                </button>
              </>
            )}

            {phase === "secure" && (
              <>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-violet">পাসওয়ার্ড</label>
                  <input
                    type="password"
                    value={fPass}
                    onChange={(e) => setFPass(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষর"
                    className="mt-1 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-navy outline-none focus:border-violet"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-violet">
                    আবার পাসওয়ার্ড
                  </label>
                  <input
                    type="password"
                    value={fPass2}
                    onChange={(e) => setFPass2(e.target.value)}
                    placeholder="একই পাসওয়ার্ড আবার লিখুন"
                    className="mt-1 w-full rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-navy outline-none focus:border-violet"
                  />
                </div>
                <p className="text-[10.5px] leading-snug text-muted-foreground">
                  লগইনের সময় ফেস স্ক্যানের পর এই পাসওয়ার্ডটিই লাগবে — মনে রাখুন।
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase("info")}
                    className="flex-1 rounded-xl border border-border py-3 text-xs font-black text-muted-foreground"
                  >
                    ← পিছনে
                  </button>
                  <button
                    type="button"
                    onClick={nextFromSecure}
                    className="flex-1 rounded-xl gradient-cta py-3 text-sm font-black text-white btn-press"
                  >
                    পরবর্তী ধাপ →
                  </button>
                </div>
              </>
            )}

            {phase === "photo" && (
              <FaceCapture
                cameraOnly
                title={
                  mode === "signup"
                    ? "লাইভ ক্যামেরায় নিজের ছবি তুলুন (গ্যালারি চলবে না)"
                    : "লগইনের জন্য লাইভ ফেস স্ক্যান করুন"
                }
                submitLabel={mode === "signup" ? "ছবি ঠিক আছে →" : "ফেস দিয়ে লগইন"}
                onCancel={() => (mode === "signup" ? setPhase("secure") : onClose())}
                onCapture={(b64) => {
                  setPhoto(b64);
                  if (mode === "login") void doFaceLogin(b64);
                  else setPhase("confirm");
                }}
              />
            )}

            {phase === "confirm" && (
              <>
                <div className="space-y-1 rounded-2xl bg-black/20 p-3 text-[11.5px] font-bold">
                  <p>নাম: <span className="text-emerald">{fName.trim()}</span></p>
                  <p className="mono-num">মোবাইল: <span className="text-cyan">{fPhone}</span></p>
                  {photo && (
                    <img
                      src={`data:image/jpeg;base64,${photo}`}
                      alt=""
                      className="mt-2 w-full rounded-xl border border-cyan/30"
                    />
                  )}
                </div>
                <p className="text-[10.5px] leading-snug text-muted-foreground">
                  রেজিস্ট্রেশন করুন চাপলে ফেস ভেরিফিকেশন খুলবে। ভেরিফিকেশন সফল (whitelist) হলেই
                  একাউন্ট তৈরি হবে — না হলে একাউন্ট হবে না।
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPhase("photo")}
                    className="flex-1 rounded-xl border border-border py-3 text-xs font-black text-muted-foreground"
                  >
                    ← ছবি বদলান
                  </button>
                  <button
                    type="button"
                    onClick={() => void begin(photo)}
                    className="flex-1 rounded-xl py-3 text-sm font-black text-white btn-press"
                    style={{ background: "linear-gradient(120deg,#10b981,#06b6d4,#8b5cf6)" }}
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl border border-border py-2 text-[11px] font-bold text-muted-foreground"
            >
              বাতিল
            </button>
          </div>
        </div>
      </div>
    );
  }




  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-black">
      <div className="flex shrink-0 items-center justify-between px-3 py-2 text-white">
        <span className="flex items-center gap-2 text-[13px] font-black">
          <ScanFace className="h-4 w-4 text-cyan-300" />
          ফেস {mode === "signup" ? "রেজিস্ট্রেশন" : "লগইন"}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="নতুন ট্যাবে"
            onClick={openExternal}
            className="grid h-8 w-8 place-items-center rounded-full text-white/80 active:bg-white/15"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="ফিরে যান"
            onClick={() => (phase === "verify" ? void recheck() : onClose())}
            className="grid h-8 w-8 place-items-center rounded-full text-white active:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-stretch justify-center overflow-hidden bg-black">
        {phase === "verify" && url ? (
          <div className="relative h-full w-full overflow-hidden bg-white">
            <div className="h-full w-full overflow-y-auto bg-white">
              <iframe
                src={url}
                title="Good-App face verification"
                allow="camera; microphone; fullscreen"
                onLoad={() => setFrameOk(true)}
                className="h-full min-h-full w-full border-0"
              />
            </div>

            {!frameOk && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                <p className="text-sm font-black text-gray-700">লোড হচ্ছে…</p>
                <button
                  type="button"
                  onClick={openExternal}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-black text-white"
                >
                  <ExternalLink className="h-4 w-4" /> ফেস ভেরিফিকেশন খুলুন
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-white px-6 text-center">
            {phase === "failed" || phase === "retry" ? (
              <>
                <p className="text-sm font-black text-rose-600">{note}</p>
                <button
                  type="button"
                  onClick={() => void retryFlow()}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-black text-white"
                >
                  <RefreshCw className="h-4 w-4" /> আবার চেষ্টা করুন
                </button>
                {needRegister && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border-2 border-emerald-500 px-4 py-2 text-xs font-black text-emerald-700"
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                )}
              </>
            ) : phase === "done" ? (
              <>
                <ShieldCheck className="h-10 w-10 text-emerald-600" />
                <p className="text-sm font-black text-emerald-700">ভেরিফিকেশন সফল</p>
              </>
            ) : (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
                <p className="text-sm font-black text-gray-700">লোড হচ্ছে…</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 bg-black px-4 py-3 text-center">
        <p className="text-[11.5px] font-bold leading-snug text-white/80">
          {phase === "verify"
            ? "ফেস স্ক্যান শেষ হলে সিস্টেম নিজেই চেক করবে — কিছু চাপতে হবে না"
            : note}
        </p>
        {canSkip && (
          <button
            type="button"
            onClick={() => void doSkip()}
            disabled={skipping}
            className="mx-auto flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-[12px] font-black text-white disabled:opacity-60"
          >
            {skipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
            স্কিপ করে ঢুকুন (পরে প্রোফাইল থেকে করবেন)
          </button>
        )}
      </div>
    </div>
  );
}
