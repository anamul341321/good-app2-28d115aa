import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getMyHistory } from "@/lib/history.functions";
import { useLang } from "@/lib/i18n";
import { isLiteBuild } from "@/lib/lite-build";
import { LiteFeatureBlock } from "@/components/LiteFeatureBlock";
import {
  ArrowLeft, Smartphone, Ticket, ArrowDownToLine, Send, ArrowDownLeft,
  CheckCircle2, XCircle, Loader2, History as HistoryIcon, Copy,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "লেনদেনের ইতিহাস · good-app" },
      { name: "description", content: "মোবাইল রিচার্জ, মিনিট/এমবি কার্ড, উইথড্র এবং সেন্ড মানি — সব লেনদেনের সম্পূর্ণ ইতিহাস এক জায়গায়।" },
      { property: "og:title", content: "লেনদেনের ইতিহাস · good-app" },
      { property: "og:description", content: "রিচার্জ, কার্ড, উইথড্র ও সেন্ড মানির সব হিসাব এক জায়গায়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KIND_META: Record<string, { icon: any; color: string; bn: string; en: string; sign: "-" | "+" }> = {
  recharge: { icon: Smartphone, color: "#06b6d4", bn: "মোবাইল রিচার্জ", en: "Mobile Recharge", sign: "-" },
  card: { icon: Ticket, color: "#7c3aed", bn: "মিনিট/এমবি কার্ড", en: "Minute/MB Card", sign: "-" },
  withdraw: { icon: ArrowDownToLine, color: "#f43f5e", bn: "উইথড্র", en: "Withdraw", sign: "-" },
  transfer_out: { icon: Send, color: "#f59e0b", bn: "সেন্ড মানি", en: "Send Money", sign: "-" },
  transfer_in: { icon: ArrowDownLeft, color: "#10b981", bn: "টাকা পেয়েছেন", en: "Received", sign: "+" },
};

const TABS = [
  { id: "all", bn: "সব", en: "All" },
  { id: "recharge", bn: "রিচার্জ", en: "Recharge" },
  { id: "card", bn: "কার্ড", en: "Cards" },
  { id: "withdraw", bn: "উইথড্র", en: "Withdraw" },
  { id: "transfer", bn: "সেন্ড/রিসিভ", en: "Transfers" },
];

function HistoryPage() {
  if (isLiteBuild()) return <LiteFeatureBlock title="লেনদেনের ইতিহাস" />;
  const { t } = useLang();
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const { data, isLoading } = useQuery({ queryKey: ["my-history"], queryFn: () => getMyHistory() });

  const list = (data ?? []).filter((i) =>
    tab === "all" ? true : tab === "transfer" ? i.kind.startsWith("transfer") : i.kind === tab
  );

  const spent = (data ?? []).filter((i) => i.kind !== "transfer_in" && i.status !== "failed")
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-4 pt-2 pb-6">
      <div className="flex items-center justify-between -mt-1">
        <button
          onClick={() => (window.history.length > 1 ? router.history.back() : router.navigate({ to: "/home" }))}
          className="btn-press inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs font-black text-navy"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t("পিছনে", "Back")}
        </button>
        <Link to="/home" className="text-[11px] font-black text-cyan-600">🏠 {t("হোম", "Home")}</Link>
      </div>

      <div className="relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl"
           style={{ background: "linear-gradient(135deg,#0f172a 0%,#1e293b 45%,#7c3aed 100%)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-black leading-none">{t("সব লেনদেনের ইতিহাস", "All Transaction History")}</h1>
              <p className="text-[10px] opacity-80 mt-1">{t("রিচার্জ · কার্ড · উইথড্র · সেন্ড মানি", "Recharge · Cards · Withdraw · Transfers")}</p>
            </div>
          </div>
          <p className="text-[10px] uppercase tracking-widest opacity-80 font-black mt-4">{t("মোট খরচ", "Total spent")}</p>
          <p className="mono-num text-4xl font-black leading-none mt-1" translate="no">{spent}<span className="text-xl ml-0.5">৳</span></p>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {TABS.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border-2 whitespace-nowrap btn-press transition ${tab === x.id ? "bg-violet-600 text-white border-transparent shadow-md" : "bg-surface-2 border-border text-navy"}`}>
            {t(x.bn, x.en)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <HistoryIcon className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">{t("কোনো লেনদেন নেই", "No transactions yet")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((i) => {
            const meta = KIND_META[i.kind]!;
            const Icon = meta.icon;
            return (
              <div key={i.id} className="glass rounded-2xl p-3 flex items-center gap-3 border border-border/50">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: `${meta.color}22`, color: meta.color }}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] font-black uppercase tracking-wide" style={{ color: meta.color }}>
                      {t(meta.bn, meta.en)}
                    </p>
                    {i.status === "success" ? <CheckCircle2 className="w-3 h-3 text-emerald" />
                      : i.status === "failed" ? <XCircle className="w-3 h-3 text-rose" />
                      : <Loader2 className="w-3 h-3 animate-spin text-amber" />}
                  </div>
                  <p className="font-black text-sm mono-num truncate" translate="no">{i.title}</p>
                  {i.subtitle && <p className="text-[10px] text-muted-foreground truncate">{i.subtitle}</p>}
                  <p className="text-[10px] text-muted-foreground" translate="no">{new Date(i.created_at).toLocaleString()}</p>
                  {i.ref && (
                    <button onClick={() => { navigator.clipboard.writeText(i.ref!); toast.success(t("কপি হয়েছে", "Copied")); }}
                      className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-emerald mono-num max-w-full truncate" translate="no">
                      <Copy className="w-3 h-3 shrink-0" /> {i.ref}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`mono-num font-black ${meta.sign === "+" ? "text-emerald" : "text-navy"}`} translate="no">
                    {meta.sign}{i.total}৳
                  </p>
                  {i.fee > 0 && <p className="text-[9px] text-muted-foreground font-bold" translate="no">Fee: {i.fee}৳</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
