import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { getDashboard } from "@/lib/dashboard.functions";
import { BadgeCheck, Bot, CheckCircle2, Copy, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { isLiteBuild } from "@/lib/lite-build";

export const Route = createFileRoute("/_authenticated/kyc")({ component: KycPage });

function KycPage() {
  const router = useRouter();
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => getOnboardingState(),
    staleTime: 30_000,
  });

  const uid = (dash?.profile as any)?.uid_seq ? String((dash?.profile as any).uid_seq) : (data?.uid ?? null);
  const verified = !!(dash?.profile as any)?.kyc_verified || !!data?.linked;

  if (isLoading) {
    return (
      <div className="pt-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan" />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="pt-6 space-y-4 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald/15 border-2 border-emerald text-emerald">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-2xl font-black flex items-center justify-center gap-2">
          KYC ভেরিফাইড <BadgeCheck className="w-6 h-6" style={{ color: "#1d9bf0" }} />
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLiteBuild()
            ? "আপনার অ্যাকাউন্ট ভেরিফাইড ✅ প্রোফাইলে নীল ✔ ব্যাজ যোগ হয়েছে।"
            : "আপনার অ্যাকাউন্ট ভেরিফাইড ✅ প্রোফাইলে নীল ✔ ব্যাজ যোগ হয়েছে এবং উইথড্র চালু আছে।"}
        </p>
        {!isLiteBuild() && (
        <button
          onClick={() => router.navigate({ to: "/withdraw" })}
          className="rounded-2xl px-6 py-3 gradient-cta font-black btn-press"
        >
          উইথড্র পেজে যান
        </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="text-center">
        <ShieldCheck className="w-8 h-8 text-emerald mx-auto" />
        <h1 className="text-2xl font-black mt-1">KYC ভেরিফিকেশন</h1>
        <p className="text-[11px] text-muted-foreground mt-1">মাত্র ১ ধাপ — নীল ✔ ব্যাজ ও উইথড্র চালু হবে</p>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2 text-[12px] font-bold text-navy">
        <p>✔ নিচের বাটনে চাপ দিলে আমাদের <b>টেলিগ্রাম বট</b> খুলবে</p>
        <p>✔ বটে <b>শুরু করুন (Start)</b> চাপলেই KYC সম্পন্ন — আর কিছু লাগবে না</p>
        <p>✔ বট UID চাইলে নিচের <b>UID</b> টি কপি করে পাঠিয়ে দিন</p>
        <p>✔ KYC হলে প্রোফাইলে <b>নীল ✔ ব্যাজ</b> এবং <b>উইথড্র চালু</b> হবে</p>
        <p className="text-rose-600">⚠ KYC ছাড়া অ্যাপের সব কাজ চলবে, কিন্তু <b>টাকা তোলা যাবে না</b></p>
      </div>

      {uid && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(uid);
            toast.success("UID কপি হয়েছে — বটে পেস্ট করুন");
          }}
          className="w-full rounded-2xl py-3 bg-surface-2 border border-border font-black btn-press flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" /> আপনার UID: <span className="mono-num" translate="no">{uid}</span>
        </button>
      )}

      <button
        onClick={() => {
          if (!data?.botUrl) {
            toast.error("বট লিংক পাওয়া যায়নি — একটু পরে চেষ্টা করুন");
            return;
          }
          window.open(data.botUrl, "_blank", "noopener,noreferrer");
        }}
        className="gradient-cta w-full rounded-2xl py-4 text-base font-black btn-press flex items-center justify-center gap-2"
      >
        <Bot className="w-5 h-5" /> KYC শুরু করুন (টেলিগ্রাম)
      </button>

      <button
        onClick={() => refetch()}
        className="w-full rounded-2xl py-3 text-xs font-black bg-surface-2 border border-border text-muted-foreground btn-press flex items-center justify-center gap-2"
      >
        {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
        বট Start করেছি — স্ট্যাটাস চেক করুন
      </button>

      <a
        href="https://play.google.com/store/apps/details?id=org.telegram.messenger"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full rounded-2xl py-3 text-xs font-black bg-surface-2 border border-border text-muted-foreground btn-press text-center"
      >
        টেলিগ্রাম নেই? Play Store থেকে ডাউনলোড করুন
      </a>

      <p className="text-center text-[10px] text-muted-foreground leading-relaxed">
        টেলিগ্রামে নতুন? সমস্যা নেই — শুধু অ্যাপটি ডাউনলোড করে ফোন নম্বর দিয়ে অ্যাকাউন্ট খুলুন, তারপর উপরের
        “KYC শুরু করুন” বাটনে চাপ দিন। বটের চ্যাটে নিচে <b>START</b> লেখা বাটনে একবার চাপ দিলেই কাজ শেষ 💙
      </p>
    </div>
  );
}
