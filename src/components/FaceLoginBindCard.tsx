import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScanFace, Loader2, Check, Link2Off } from "lucide-react";
import { FaceCapture } from "./FaceCapture";
import {
  listFaceBindSlots,
  bindFaceLoginByScan,
  bindFaceLoginBySlot,
  unbindFaceLogin,
} from "@/lib/face-bind.functions";

/**
 * পুরনো ইউজারদের জন্য ফেস লগইন bind:
 *  • লাইভ স্ক্যান → যে স্লটের ছবির সাথে মিলবে সেটাই লগইন ফেস হবে
 *  • অথবা নিজে স্লট বেছে নিয়ে bind (ইউজার জানে কোন স্লটে তার নিজের ফেস)
 */
export function FaceLoginBindCard() {
  const qc = useQueryClient();
  const load = useServerFn(listFaceBindSlots);
  const byScan = useServerFn(bindFaceLoginByScan);
  const bySlot = useServerFn(bindFaceLoginBySlot);
  const unbind = useServerFn(unbindFaceLogin);

  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["face-bind-slots"],
    queryFn: () => load({}),
  });

  const slots = data?.slots ?? [];
  const boundSlot = slots.find((s: any) => s.bound) ?? null;

  function refresh() {
    qc.invalidateQueries({ queryKey: ["face-bind-slots"] });
  }

  async function onCapture(photoBase64: string) {
    setBusy(true);
    try {
      const res = await byScan({ data: { photoBase64 } });
      if (!res.matched) {
        toast.error("আপনার কোনো স্লটের ছবির সাথে ফেস মিলেনি — নিচ থেকে নিজে স্লট বেছে নিন");
      } else {
        toast.success(`স্লট #${res.slot} এখন আপনার ফেস লগইন`);
        setScanning(false);
        refresh();
      }
    } catch (e: any) {
      toast.error(e?.message ?? "ফেস মেলাতে সমস্যা হয়েছে");
    } finally {
      setBusy(false);
    }
  }

  async function pick(slot: number) {
    setBusy(true);
    try {
      const res = await bySlot({ data: { slot } });
      toast.success(
        res.whitelisted
          ? `স্লট #${res.slot} ফেস লগইন হিসেবে সেট হয়েছে`
          : `স্লট #${res.slot} সেট হয়েছে — তবে এই key এখন whitelist নেই, লগইনে আবার ভেরিফাই চাইতে পারে`,
      );
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "সেট করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  async function removeBind() {
    setBusy(true);
    try {
      await unbind({});
      toast.success("ফেস লগইন সরানো হয়েছে");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "সরানো যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="premium-panel rounded-2xl p-4 space-y-3 scroll-mt-20" id="face-login-bind">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center shrink-0">
          <ScanFace className="w-4 h-4 text-cyan" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-navy">ফেস লগইন বাইন্ড</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ভবিষ্যতে শুধু ফেস দিয়েই লগইন হবে। আপনার স্লটে তোলা ফেস ছবিই লগইন পরিচয় হিসেবে সেট করুন —
            ফোন হারালেও অন্য ফোনে ফেস স্ক্যান করলেই একাউন্টে ঢোকা যাবে।
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-cyan" />
        </div>
      )}

      {!isLoading && boundSlot && (
        <div className="flex items-center justify-between gap-2 bg-emerald/10 border-2 border-emerald/40 rounded-xl px-3 py-2.5">
          <p className="text-xs font-black text-navy">
            <Check className="w-3.5 h-3.5 inline text-emerald mr-1" />
            স্লট #{boundSlot.slot} এখন আপনার ফেস লগইন
          </p>
          <button
            onClick={removeBind}
            disabled={busy}
            className="text-[11px] font-black text-red-500 flex items-center gap-1 disabled:opacity-60"
          >
            <Link2Off className="w-3.5 h-3.5" /> সরান
          </button>
        </div>
      )}

      {!isLoading && slots.length === 0 && (
        <p className="text-[12px] font-bold text-muted-foreground">
          আপনার কোনো স্লটে ফেস ছবি নেই। আগে যেকোনো স্লটে GoodDollar ফেস ভেরিফিকেশন করুন।
        </p>
      )}

      {!isLoading && slots.length > 0 && (
        <>
          <button
            onClick={() => setScanning(true)}
            disabled={busy}
            className="w-full py-3 rounded-xl gradient-cta font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 btn-press"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
            লাইভ ফেস স্ক্যান করে অটো বাইন্ড
          </button>

          <div className="space-y-2">
            <p className="text-[11px] font-black text-cyan uppercase tracking-wider">
                অথবা নিজে স্লট বেছে নিন
            </p>
            {slots.map((s: any) => (
              <div
                key={s.taskId}
                className="flex items-center gap-3 bg-white border-2 border-border rounded-xl px-3 py-2.5"
              >
                {s.signedUrl ? (
                  <img
                    src={s.signedUrl}
                    alt={`স্লট ${s.slot} এর ফেস ছবি`}
                    loading="lazy"
                    className="w-11 h-11 rounded-lg object-cover shrink-0 border border-border"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-muted shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-navy truncate">
                    স্লট #{s.slot}
                    {s.label ? ` • ${s.label}` : ""}
                  </p>
                  <p className="text-[11px] font-bold text-muted-foreground">
                    {s.whitelistOk ? "✅ whitelist আছে" : "⚠️ whitelist নেই"} • re-verify {s.reverifyCount}
                  </p>
                </div>
                {s.bound ? (
                  <span className="text-[11px] font-black text-emerald shrink-0">সেট আছে</span>
                ) : (
                  <button
                    onClick={() => pick(s.slot)}
                    disabled={busy}
                    className="shrink-0 px-3 py-1.5 rounded-lg gradient-navy text-[11px] font-black text-cyan disabled:opacity-60 btn-press"
                  >
                    এটাই আমার ফেস
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {scanning && (
        <div className="fixed inset-0 z-[100] bg-black/90">
          <FaceCapture
            cameraOnly
            skipConsent
            title="ফেস লগইন বাইন্ড — লাইভ স্ক্যান"
            submitLabel="মিলিয়ে দেখুন"
            isUploading={busy}
            onCapture={onCapture}
            onCancel={() => setScanning(false)}
          />
        </div>
      )}
    </section>
  );
}
