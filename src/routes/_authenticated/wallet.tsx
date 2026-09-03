import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getDashboard } from "@/lib/dashboard.functions";
import { setWallet } from "@/lib/wallet.functions";
import { useState } from "react";
import { Wallet, ShieldCheck, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PageVoice } from "@/components/PageVoice";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";


export const Route = createFileRoute("/_authenticated/wallet")({ component: WalletPage });

function WalletPage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="ওয়ালেট" />;
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const { t } = useLang();

  if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-cyan" /></div>;

  const walletBkash = (data as any)?.walletBkash ?? null;
  const walletNagad = (data as any)?.walletNagad ?? null;
  const payout = (data as any)?.payoutSettings ?? { bkashEnabled: true, nagadEnabled: true };

  return (
    <div className="space-y-4 pt-2">
      <PageVoice pageId="wallet" steps={["wallet.intro","wallet.provider","wallet.number","wallet.save"]} />

      <div className="text-center">
        <Wallet className="w-8 h-8 text-cyan mx-auto" />
        <h1 className="text-xl font-black mt-1">{t("ওয়ালেট", "Wallet")}</h1>
        <p className="text-[11px] text-muted-foreground">{t("বিকাশ ও নগদ — দুটোই আলাদা আলাদা সেট করা যাবে", "bKash & Nagad — set both separately")}</p>
      </div>

      <ProviderCard provider="bkash" wallet={walletBkash} enabled={payout.bkashEnabled} offMessage={payout.bkashOffMessage} onSaved={refetch} />
      <ProviderCard provider="nagad" wallet={walletNagad} enabled={payout.nagadEnabled} offMessage={payout.nagadOffMessage} onSaved={refetch} />

      <p className="text-[10px] text-muted-foreground text-center leading-snug px-3">
        {t("একবার সেভ করার পর user নিজে নম্বর পরিবর্তন করতে পারবেন না — admin panel থেকে reset করাতে হবে।",
           "Once saved, you cannot change the number yourself — please contact the admin panel to reset it.")}
      </p>
    </div>
  );
}

function ProviderCard({ provider, wallet, enabled, offMessage, onSaved }: {
  provider: "bkash" | "nagad";
  wallet: any;
  enabled: boolean;
  offMessage: string | null;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [number, setNumber] = useState("");
  const label = provider === "bkash" ? t("বিকাশ", "bKash") : t("নগদ", "Nagad");
  const otherLabel = provider === "bkash" ? t("নগদ", "Nagad") : t("বিকাশ", "bKash");
  const tone = provider === "bkash" ? "rose" : "amber";
  const emoji = provider === "bkash" ? "📱" : "💳";

  const mut = useMutation({
    mutationFn: () => setWallet({ data: { provider, number } }),
    onSuccess: () => { toast.success(t(`${label} নম্বর সেভ হয়েছে`, `${label} number saved`)); onSaved(); setNumber(""); },
    onError: (e: any) => toast.error(e.message),
  });

  if (wallet) {
    return (
      <div className={`glass rounded-2xl p-4 space-y-2 border-2 border-${tone}/30`}>
        <div className="flex items-center justify-between">
          <p className={`text-sm font-black text-${tone} flex items-center gap-1.5`}>
            <span className="text-lg">{emoji}</span> {label}
          </p>
          <CheckCircle2 className="w-4 h-4 text-emerald" />
        </div>
        <p className="mono-num font-black text-lg" translate="no">{wallet.number}</p>
        {!enabled && (
          <div className="rounded-lg bg-rose/10 border border-rose/30 p-2 text-[11px] text-rose font-bold">
            ⚠️ {t(`${label} withdraw বর্তমানে বন্ধ।`, `${label} withdraw is temporarily off.`)} {offMessage || t(`${otherLabel}-এ withdraw দিন।`, `Please withdraw via ${otherLabel}.`)}
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}
      className={`glass rounded-2xl p-4 space-y-3 border-2 border-${tone}/20`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-black text-${tone} flex items-center gap-1.5`}>
          <span className="text-lg">{emoji}</span> {t(`${label} নম্বর যোগ করুন`, `Add ${label} number`)}
        </p>
        {!enabled && (
          <span className="text-[9px] font-black uppercase tracking-widest text-rose">{t("অস্থায়ীভাবে বন্ধ", "Temporarily off")}</span>
        )}
      </div>
      <input value={number}
        onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
        inputMode="numeric"
        placeholder={t("০১XXXXXXXXX (১১ ডিজিট)", "01XXXXXXXXX (11 digits)")}
        maxLength={11}
        className={`w-full px-4 py-3 mono-num bg-surface-2 border border-border rounded-xl text-base outline-none focus:border-${tone}`} />
      <p className="text-[10px] text-amber flex items-center gap-1">
        <ShieldCheck className="w-3 h-3" /> {t(`সঠিক ${label} নম্বর দিন — সেভ করার পর নিজে পরিবর্তন করা যাবে না।`, `Enter your correct ${label} number — you can't change it yourself after saving.`)}
      </p>
      <button disabled={mut.isPending || number.length !== 11}
        className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 text-white ${provider === "bkash" ? "bg-rose" : "bg-amber"}`}>
        {mut.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {t(`${label} সেভ করুন`, `Save ${label}`)}
      </button>
    </form>
  );
}
