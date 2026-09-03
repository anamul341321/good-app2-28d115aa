import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_REGION, getRegion, type Lang, type Region } from "./regions";
import { translate } from "./i18n-dict";

export type { Lang } from "./regions";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: <A, B>(bn: A, en: B) => A | B;
  /** ইউজারের দেশ (BD, IN, PK …) */
  countryCode: string;
  region: Region;
  setCountry: (code: string, opts?: { syncLang?: boolean }) => void;
};

const STORAGE_KEY = "good-app-lang";
const COUNTRY_KEY = "good-app-country";

const LANGS: Lang[] = ["bn", "en", "hi", "ur", "ne", "ar", "ms"];

const LangContext = createContext<Ctx>({
  lang: "bn",
  setLang: () => {},
  t: <A, B>(bn: A, _en: B) => bn as A | B,
  countryCode: DEFAULT_REGION,
  region: getRegion(DEFAULT_REGION),
  setCountry: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  const [countryCode, setCountryState] = useState<string>(DEFAULT_REGION);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      const savedCountry = localStorage.getItem(COUNTRY_KEY);
      if (savedCountry) setCountryState(savedCountry.toUpperCase());
      if (saved && LANGS.includes(saved)) {
        setLangState(saved);
      } else if (savedCountry) {
        // ভাষা নিজে বাছাই না করলে দেশ অনুযায়ী ডিফল্ট — বাংলাদেশ ছাড়া সব দেশে English
        setLangState(getRegion(savedCountry).lang);
      }
    } catch {}
    setHydrated(true);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  };

  const setCountry = (code: string, opts?: { syncLang?: boolean }) => {
    const region = getRegion(code);
    setCountryState(region.code);
    try { localStorage.setItem(COUNTRY_KEY, region.code); } catch {}
    if (opts?.syncLang !== false) setLang(region.lang);
  };

  const activeLang: Lang = hydrated ? lang : "bn";

  const t = <A, B>(bn: A, en: B): A | B => {
    if (activeLang === "bn") return bn;
    if (typeof en === "string") return translate(activeLang, en) as unknown as B;
    return en;
  };

  // Avoid SSR/hydration flicker: render bn by default, then swap on client.
  const value: Ctx = {
    lang: activeLang,
    setLang,
    t,
    countryCode: hydrated ? countryCode : DEFAULT_REGION,
    region: getRegion(hydrated ? countryCode : DEFAULT_REGION),
    setCountry,
  };
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
