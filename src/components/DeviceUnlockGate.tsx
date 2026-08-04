import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone, KeyRound, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceId, deviceLabel } from "@/hooks/useDeviceGuard";
import {
  requestDeviceApproval,
  getDeviceApprovalState,
  sendDeviceUnlockCode,
  confirmDeviceUnlockCode,
} from "@/lib/sessions.functions";

/**
 * এই ফোনটি অন্য ডিভাইস থেকে লগআউট করা হয়েছে — এখন আবার ঢুকতে হলে:
 *  - Gmail যুক্ত থাকলে: Gmail-এ কোড → কোড বসালেই চালু।
 *  - Gmail না থাকলে: মেইন ফোনে অনুমতি চাইবে (মেইন ফোনের নামও দেখাবে)।
 */
export function DeviceUnlockGate() {
  const requestFn = useServerFn(requestDeviceApproval);
  const stateFn = useServerFn(getDeviceApprovalState);
  const sendCode = useServerFn(sendDeviceUnlockCode);
  const confirmCode = useServerFn(confirmDeviceUnlockCode);

  const [info, setInfo] = useState<{
    mainDeviceLabel: string | null;
    emailAvailable: boolean;
    emailMasked: string | null;
  } | null>(null);
  const [mode, setMode] = useState<"wait" | "code">("wait");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState(false);

  const deviceId = getDeviceId();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res: any = await requestFn({
          data: { deviceId, label: deviceLabel(), userAgent: navigator.userAgent },
        });
        if (!active) return;
        if (res?.autoUnlocked) {
          toast.success("আপনার ফোনটি আবার চালু হয়েছে 💙");
          window.location.href = "/home";
          return;
        }
        setInfo(res);
      } catch {
        /* ignore */
      }
    })();

    // দ্রুত ঢোকার জন্য প্রতি ১.২ সেকেন্ডে চেক — অনুমতি দেওয়ার সাথে সাথেই ঢুকে যাবে
    const timer = setInterval(async () => {
      try {
        const res: any = await stateFn({ data: { deviceId } });
        if (!active) return;
        if (!res?.revoked) {
          active = false;
          clearInterval(timer);
          toast.success("অনুমতি পাওয়া গেছে — স্বাগতম 💙");
          window.location.href = "/home";
          return;
        }
        setRejected(res?.approvalState === "rejected");
      } catch {
        /* ignore */
      }
    }, 1200);

    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOutNow() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl text-white"
        style={{ background: "linear-gradient(160deg,#0ea5e9,#6366f1,#8b5cf6)" }}
      >
        <div className="p-5 space-y-3">
          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
            <ShieldCheck className="w-9 h-9" />
          </div>
          <h2 className="text-center text-lg font-black drop-shadow">এই ফোনটি লগআউট করা হয়েছে</h2>

          {mode === "wait" ? (
            <>
              <p className="text-center text-[12.5px] font-bold leading-relaxed">
                নিরাপত্তার জন্য এই ফোনে আবার ঢুকতে অনুমতি লাগবে। নিচের যেকোনো একটি করলেই সাথে সাথে
                ঢুকে যাবেন 💙
              </p>

              <div className="rounded-2xl bg-white/15 p-3 space-y-1">
                <p className="text-[12px] font-black flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> মেইন ফোনে অনুমতি দিন
                </p>
                <p className="text-[11.5px] font-bold leading-relaxed">
                  {info?.mainDeviceLabel ? (
                    <>
                      আপনার মেইন ফোন: <b translate="no">{info.mainDeviceLabel}</b> — সেই ফোনে অ্যাপ খুললেই
                      "নতুন ফোন থেকে লগইন" বার্তা আসবে, শুধু <b>অনুমতি দিন</b> চাপলেই এই ফোনে ঢুকে যাবে।
                    </>
                  ) : (
                    <>আপনার আগের (মেইন) ফোনে অ্যাপ খুলুন — সেখানে অনুমতির বার্তা আসবে।</>
                  )}
                </p>
                <p className="text-[11px] font-bold text-white/85 flex items-center gap-2 pt-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> অনুমতির অপেক্ষায়…
                </p>
                {rejected && (
                  <p className="text-[11.5px] font-black bg-black/25 rounded-xl px-3 py-2">
                    মেইন ফোন থেকে অনুমতি দেওয়া হয়নি। আবার চেষ্টা করতে মেইন ফোনে অনুমতি দিন।
                  </p>
                )}
              </div>

              {info?.emailAvailable && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await sendCode({});
                      setMode("code");
                      toast.success("Gmail-এ ৬ ডিজিটের কোড পাঠানো হয়েছে");
                    } catch (e: any) {
                      toast.error(e?.message ?? "কোড পাঠানো যায়নি");
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Gmail-এ কোড পাঠান {info.emailMasked ? `(${info.emailMasked})` : ""}
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[12px] font-bold bg-white/15 rounded-xl py-2">
                কোড পাঠানো হয়েছে: <b translate="no">{info?.emailMasked}</b>
              </p>
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="৬ ডিজিটের কোড"
                className="w-full rounded-2xl px-4 py-3 text-center text-[18px] font-black tracking-[8px] text-slate-900 bg-white/95 outline-none mono-num"
              />
              <button
                disabled={busy || code.length !== 6}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await confirmCode({ data: { deviceId, code } });
                    toast.success("ফোনটি আবার চালু হয়েছে 💙");
                    window.location.href = "/home";
                  } catch (e: any) {
                    toast.error(e?.message ?? "কোড মেলেনি");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="w-full rounded-2xl py-3 font-black text-[14px] bg-white text-indigo-700 btn-press disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                ভেরিফাই করে ঢুকুন
              </button>
              <button
                onClick={() => setMode("wait")}
                className="w-full text-[11.5px] font-bold text-white/85 underline"
              >
                মেইন ফোনে অনুমতি নিয়ে ঢুকব
              </button>
            </div>
          )}

          <button
            onClick={signOutNow}
            className="w-full text-[11.5px] font-bold text-white/85 underline flex items-center justify-center gap-1"
          >
            <LogOut className="w-3.5 h-3.5" /> লগইন পেজে ফিরে যান
          </button>
        </div>
      </div>
    </div>
  );
}
