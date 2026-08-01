import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ArrowRight, X } from "lucide-react";
import { getDashboard } from "@/lib/dashboard.functions";

/**
 * KYC না করা ইউজার অ্যাপে ঢুকলেই ৫ সেকেন্ডের জন্য চোখে পড়ার মতো লাল
 * অ্যানিমেটেড ব্যানার দেখাবে — কীভাবে KYC করবে সেটাও বাংলায় লেখা থাকবে।
 */
export function KycAlertBanner() {
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const verified = !!(data?.profile as any)?.kyc_verified;
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!data || verified) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("kyc-alert-shown") === "1") return;
    sessionStorage.setItem("kyc-alert-shown", "1");
    setShow(true);
    const t1 = setTimeout(() => setClosing(true), 4600);
    const t2 = setTimeout(() => setShow(false), 5000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data, verified]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity duration-400 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onClick={() => setShow(false)}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-500"
        style={{ background: "linear-gradient(160deg,#e11d48,#f43f5e,#dc2626)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 text-white text-center space-y-3">
          <button
            onClick={() => setShow(false)}
            className="absolute right-6 top-6 text-white/70"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="mx-auto w-16 h-16 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <h2 className="text-xl font-black drop-shadow animate-bounce">
            ⚠️ এখনো KYC সম্পূর্ণ করেননি
          </h2>

          <p className="text-[12.5px] font-bold leading-relaxed">
            দ্রুত <b>KYC</b> সম্পূর্ণ করে নিন — তাহলে কোনো সমস্যা হলে আমরা সাথে সাথেই
            আপনাকে চিনে নিয়ে সাপোর্ট দিতে পারব 💙
          </p>

          <div className="rounded-2xl bg-white/15 p-3 text-left text-[12px] font-bold space-y-1">
            <p>১) নিচের <b>“KYC করুন”</b> বাটনে চাপ দিন</p>
            <p>২) টেলিগ্রাম খুলে যাবে — <b>START</b> বাটনে একবার চাপ দিন</p>
            <p>৩) ব্যাস! নীল ✔ ব্যাজ ও উইথড্র চালু হয়ে যাবে</p>
          </div>

          <p className="text-[11px] text-white/90">
            KYC ছাড়া অ্যাপের সব কাজ চলবে, শুধু <b>টাকা তোলা যাবে না</b>।
          </p>

          <Link
            to="/kyc"
            onClick={() => setShow(false)}
            className="w-full rounded-2xl py-3 bg-white text-rose-600 font-black flex items-center justify-center gap-2 btn-press shadow-lg"
          >
            এখনই KYC করুন <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
