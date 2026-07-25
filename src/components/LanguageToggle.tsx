import { useLang } from "@/lib/i18n";
import { Languages } from "lucide-react";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      onClick={() => setLang(lang === "bn" ? "en" : "bn")}
      className={`btn-press inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-[10px] font-black tracking-wide ${className}`}
      title={lang === "bn" ? "Switch to English" : "বাংলায় দেখুন"}
      translate="no"
    >
      <Languages className="h-3.5 w-3.5" />
      <span className="mono-num">{lang === "bn" ? "বাং" : "EN"}</span>
      <span className="opacity-40">/</span>
      <span className="mono-num opacity-60">{lang === "bn" ? "EN" : "বাং"}</span>
    </button>
  );
}
