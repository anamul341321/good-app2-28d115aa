import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Rocket, Bot, Megaphone } from "lucide-react";
import { completeOnboarding, getOnboardingState } from "@/lib/onboarding.functions";
import { useLang } from "@/lib/i18n";

/**
 * অ্যাপে ঢোকার আগে একবারের "শুরু করুন" স্ক্রিন। একবার চাপলেই আর আসবে না।
 */
export function StartGate({ children }: { children: React.ReactNode }) {
  const { t } = useLang();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => getOnboardingState(),
    staleTime: 5 * 60_000,
  });

  const done = useMutation({
    mutationFn: (mode: "telegram" | "skip") => completeOnboarding({ data: { mode } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-cyan" />
      </div>
    );
  }

  if (!data?.needsStart) return <>{children}</>;

  const start = () => {
    if (data.botUrl) window.open(data.botUrl, "_blank", "noopener,noreferrer");
    done.mutate("telegram");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-4">
        <div
          className="rounded-3xl p-5 text-center shadow-xl animate-in fade-in zoom-in duration-500"
          style={{ background: "linear-gradient(135deg,#7c3aed,#0088cc)" }}
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center animate-bounce">
            <Rocket className="w-7 h-7 text-white" />
          </div>
          <h1 className="mt-3 text-xl font-black text-white">
            {t("স্বাগতম!", "Welcome!")} {data.name ? `${data.name} 💙` : "💙"}
          </h1>
          <p className="mt-1 text-[12px] text-white/90 leading-relaxed">
            {t(
              "শুরু করতে নিচের বাটনে একবার চাপুন — এতেই আপনার সাপোর্ট বট চালু হয়ে যাবে, পরে আর UID লিখতে হবে না।",
              "Tap the button once to get started — this also activates your support bot, so you never need to type your UID again.",
            )}
          </p>
        </div>

        {data.notice && (
          <div className="glass rounded-2xl p-3.5 flex gap-2 items-start">
            <Megaphone className="w-4 h-4 text-amber shrink-0 mt-0.5" />
            <p className="text-[12px] font-bold leading-relaxed">{data.notice}</p>
          </div>
        )}

        <button
          onClick={start}
          disabled={done.isPending}
          className="gradient-cta w-full rounded-2xl py-3.5 text-sm font-black btn-press flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {done.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
          {t("শুরু করুন", "Get started")}
        </button>

        <button
          onClick={() => done.mutate("skip")}
          disabled={done.isPending}
          className="w-full rounded-2xl py-3 text-xs font-black bg-surface-2 border border-border text-muted-foreground btn-press disabled:opacity-60"
        >
          {t("আমার টেলিগ্রাম নেই — এমনিতেই ঢুকব", "I don't have Telegram — continue anyway")}
        </button>

        <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
          {t(
            "টেলিগ্রাম না থাকলেও অ্যাপের সব কাজ করতে পারবেন, শুধু সাপোর্টে UID লিখতে হবে।",
            "Without Telegram everything still works — you'll just need to share your UID with support.",
          )}
        </p>
      </div>
    </div>
  );
}
