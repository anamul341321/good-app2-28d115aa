import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { REGIONS } from "@/lib/regions";
import { LANG_LABELS } from "@/lib/i18n-dict";
import { Check, Globe } from "lucide-react";
import type { Lang } from "@/lib/regions";

/**
 * উপরে ছোট্ট রিজিয়ন ব্যাজ — ইউজার কোন দেশের সেটা দেখায় (🇧🇩 BD),
 * ট্যাপ করলে দেশ + ভাষা বদলানোর শীট খোলে।
 */
export function RegionBadge({ className = "" }: { className?: string }) {
  const { region, countryCode, setCountry, lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("দেশ ও ভাষা", "Country & language")}
        className={`btn-press inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[10px] font-black tracking-wide ${className}`}
        translate="no"
      >
        <span className="text-sm leading-none">{region.flag}</span>
        <span className="mono-num">{countryCode}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
             onClick={() => setOpen(false)}>
          <div className="glass max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-3xl border-2 border-gold/30 p-4"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10 text-cyan">
                <Globe className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-black">{t("আপনার দেশ ও ভাষা", "Your country & language")}</p>
                <p className="text-[11px] text-muted-foreground">
                  {t("দেশ বদলালে সেই দেশের ভাষা ও মুদ্রা দেখাবে।", "Changing country switches language and currency.")}
                </p>
              </div>
            </div>

            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-gold">{t("দেশ", "Country")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {REGIONS.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setCountry(r.code)}
                  className={`btn-press flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-[12px] font-black ${
                    countryCode === r.code ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg leading-none">{r.flag}</span>
                    <span className="leading-tight">
                      <span className="block">{r.nameLocal}</span>
                      <span className="block text-[9px] font-bold opacity-60">{r.nameEn}</span>
                    </span>
                  </span>
                  {countryCode === r.code && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>

            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-gold">{t("ভাষা", "Language")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`btn-press flex items-center justify-between gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-[12px] font-black ${
                    lang === l ? "border-violet bg-violet/10 text-violet" : "border-border bg-surface-2"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-lg leading-none">{LANG_LABELS[l].flag}</span>
                    <span>{LANG_LABELS[l].native}</span>
                  </span>
                  {lang === l && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="gradient-cta btn-press mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black"
            >
              {t("ঠিক আছে", "Done")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
