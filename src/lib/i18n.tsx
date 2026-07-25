import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (bn: string, en: string) => string;
};

const LangContext = createContext<Ctx>({
  lang: "bn",
  setLang: () => {},
  t: (bn) => bn,
});

const STORAGE_KEY = "good-app-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "bn" || saved === "en") setLangState(saved);
    } catch {}
    setHydrated(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const t = (bn: string, en: string) => (lang === "en" ? en : bn);

  // Avoid SSR/hydration flicker: render bn by default, then swap on client.
  const value: Ctx = { lang: hydrated ? lang : "bn", setLang, t };
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

/** Convenience: <T bn="..." en="..." /> */
export function T({ bn, en }: { bn: string; en: string }) {
  const { t } = useLang();
  return <>{t(bn, en)}</>;
}

/** Has the user picked a language yet? Used to trigger first-time popup. */
export function useHasChosenLang(): boolean | null {
  const [chosen, setChosen] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      setChosen(!!localStorage.getItem(STORAGE_KEY));
    } catch {
      setChosen(true);
    }
  }, []);
  return chosen;
}

export function markLangChosen() {
  try { localStorage.setItem(STORAGE_KEY + "-picked", "1"); } catch {}
}
