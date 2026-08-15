import { useLang } from "@/lib/i18n";

export interface MiningCounterProps {
  accrued: number;
  withdrawn: number;
  isActive: boolean;
  lastCreditedAt: string | null;
  effectiveTaskCount: number;
  qualifyingReferees: number;
  selfSlots: number;
  referralUnits: number;
  selfQualified: boolean;
  bonusTotal?: number;
  miningWithdrawn?: number;
  debt?: number;
  balanceBreakdown?: {
    total_accrued: number;
    bonus_part: number;
    mining_part: number;
    withdrawn_total: number;
    current_balance: number;
  };
}

export function MiningCounter({ balanceBreakdown }: MiningCounterProps) {
  const { t } = useLang();

  // Use audited breakdown if available, otherwise fallback to 0
  const totalAccrued = Math.floor(balanceBreakdown?.total_accrued ?? 0);
  const bonusPart = Math.floor(balanceBreakdown?.bonus_part ?? 0);
  const miningPart = Math.floor(balanceBreakdown?.mining_part ?? 0);
  const currentBalance = Math.floor(balanceBreakdown?.current_balance ?? 0);

  return (
    <div className="glass rounded-3xl p-5 border border-cyan-500/20 shadow-xl relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-cyan-500/10 blur-3xl rounded-full" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
              {t("মোট অর্জিত ব্যালেন্স", "Total Accrued Balance")}
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-4xl font-black text-navy mono-num" translate="no">
                {totalAccrued}
              </span>
              <span className="text-xl font-bold text-navy/60">৳</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">
              {t("বর্তমান ব্যালেন্স", "Current Balance")}
            </p>
            <div className="flex items-baseline justify-end gap-1 mt-0.5">
              <span className="text-2xl font-black text-cyan-600 mono-num" translate="no">
                {currentBalance}
              </span>
              <span className="text-lg font-bold text-cyan-600/60">৳</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
              {t("মেইন বোনাস", "Main Bonus")}
            </p>
            <p className="text-lg font-black text-emerald mono-num" translate="no">
              {bonusPart}৳
            </p>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">
              {t("মাইনিং প্রফিট", "Mining Profit")}
            </p>
            <p className="text-lg font-black text-cyan-600 mono-num" translate="no">
              {miningPart}৳
            </p>
          </div>
        </div>

        <div className="mt-1">
          <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden flex">
            {totalAccrued > 0 ? (
              <>
                <div 
                  className="h-full bg-emerald transition-all duration-500" 
                  style={{ width: `${(bonusPart / totalAccrued) * 100}%` }}
                />
                <div 
                  className="h-full bg-cyan-500 transition-all duration-500" 
                  style={{ width: `${(miningPart / totalAccrued) * 100}%` }}
                />
              </>
            ) : (
              <div className="h-full w-0 bg-muted" />
            )}
          </div>
          <div className="flex justify-between mt-1.5 px-0.5">
             <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald" />
                <span className="text-[8px] font-black text-muted-foreground uppercase">{t("বোনাস", "Bonus")}</span>
             </div>
             <div className="flex items-center gap-1">
                <span className="text-[8px] font-black text-muted-foreground uppercase">{t("মাইনিং", "Mining")}</span>
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
