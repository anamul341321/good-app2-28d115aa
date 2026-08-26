import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { Languages, Check } from "lucide-react";

const PICKED_KEY = "good-app-lang-picked";

/** First-time language chooser modal. Shows once, then remembers the choice. */
export function LanguagePicker() {
  const { setLang } = useLang();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(PICKED_KEY)) setOpen(true);
    } catch {}
  }, []);

  const choose = (l: "bn" | "en") => {
    setLang(l);
    try { localStorage.setItem(PICKED_KEY, "1"); } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-sm rounded-3xl border border-white/20 p-6 text-white shadow-2xl"
           style={{ background: "linear-gradient(135deg,#7c3aed 0%,#06b6d4 55%,#10b981 100%)" }}>
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur flex items-center justify-center">
            <Languages className="w-7 h-7" />
          </div>
        </div>
        <h2 className="text-center text-xl font-black mt-3">Choose your language</h2>
        <p className="text-center text-[13px] font-black mt-1 opacity-95">আপনার ভাষা নির্বাচন করুন</p>
        <p className="text-center text-[11px] mt-2 opacity-85 leading-snug">
          You can change this anytime from the top of every page.
          <br />যেকোনো সময় উপরে থেকে পরিবর্তন করা যাবে।
        </p>

        <div className="mt-5 space-y-2.5">
          <button onClick={() => choose("bn")}
            className="btn-press w-full rounded-2xl bg-white text-navy px-4 py-3.5 flex items-center justify-between font-black shadow-lg">
            <span className="flex items-center gap-2">
              <span className="text-2xl">🇧🇩</span>
              <span>
                <span className="block text-base">বাংলা</span>
                <span className="block text-[10px] font-bold opacity-70">Bangla</span>
              </span>
            </span>
            <Check className="w-4 h-4 opacity-40" />
          </button>
          <button onClick={() => choose("en")}
            className="btn-press w-full rounded-2xl bg-white/15 border border-white/30 backdrop-blur px-4 py-3.5 flex items-center justify-between font-black">
            <span className="flex items-center gap-2">
              <span className="text-2xl">🌐</span>
              <span>
                <span className="block text-base">English</span>
                <span className="block text-[10px] font-bold opacity-80">ইংরেজি</span>
              </span>
            </span>
            <Check className="w-4 h-4 opacity-40" />
          </button>
        </div>
      </div>
    </div>
  );
}
