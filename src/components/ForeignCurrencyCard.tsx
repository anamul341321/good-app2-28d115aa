import { Coins, Info } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { money, USDT_BDT_RATE } from "@/lib/money";

/**
 * বাংলাদেশের বাইরের ইউজারদের জন্য — ব্যালেন্স USDT + নিজের দেশের মুদ্রায়।
 * ভিতরের হিসাব সবসময় একই থাকে, শুধু দেখানো হয় ইউজারের মুদ্রায়।
 * বাংলাদেশ হলে কিছুই দেখায় না।
 */
export function ForeignCurrencyCard({ main, mining }: { main: number; mining: number }) {
  const { countryCode, region } = useLang();
  if (countryCode === "BD") return null;

  const mainView = money(main, countryCode);
  const miningView = money(mining, countryCode);

  return (
    <div className="rounded-3xl border border-cyan/30 bg-gradient-to-br from-cyan/15 to-violet/10 p-4">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-cyan" />
        <p className="text-[12px] font-black text-cyan">
          Your balance in {region.flag} {region.currency} / USDT
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-surface-2 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Main balance</p>
          <p className="mono-num mt-0.5 text-base font-black text-cyan">{mainView.main}</p>
          {mainView.local && <p className="mono-num text-[10px] font-bold text-muted-foreground">{mainView.local}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-surface-2 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mining balance</p>
          <p className="mono-num mt-0.5 text-base font-black text-emerald-400">{miningView.main}</p>
          {miningView.local && (
            <p className="mono-num text-[10px] font-bold text-muted-foreground">{miningView.local}</p>
          )}
        </div>
      </div>

      <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        Outside Bangladesh every payout is sent as USDT (Celo). The local amount is an approximate guide only —
        1 USDT ≈ ৳{USDT_BDT_RATE}, and the exact USDT amount is confirmed when the withdrawal is processed.
      </p>
    </div>
  );
}
