"use client";

import { Globe } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { patch } from "./api";

export type Lang = "en" | "ur";
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (en: string, ur: string) => string; ur: boolean; applyDefault: (l: Lang) => void };

const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: (en) => en, ur: false, applyDefault: () => {} });

const readCookie = (): Lang | null => {
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )rr_lang=(en|ur)/) : null;
  return (m?.[1] as Lang) ?? null;
};

/** Language for the whole app: cookie `rr_lang`, saved to the profile when logged in. */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [explicit, setExplicit] = useState(false);

  useEffect(() => {
    const c = readCookie();
    if (c) {
      setLangState(c);
      setExplicit(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ur" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setExplicit(true);
    document.cookie = `rr_lang=${l}; path=/; max-age=31536000; samesite=lax`;
    patch("/users/me", { lang: l.toUpperCase() }).catch(() => {});
  }, []);

  // Role default until the user picks one: workers → Urdu, customers/admin → English.
  const applyDefault = useCallback((l: Lang) => {
    if (!explicit && !readCookie()) setLangState(l);
  }, [explicit]);

  const t = useCallback((en: string, ur: string) => (lang === "ur" ? ur : en), [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t, ur: lang === "ur", applyDefault }}>{children}</LangCtx.Provider>;
}

export function useDefaultLang(l: Lang) {
  const { applyDefault } = useLang();
  useEffect(() => applyDefault(l), [l, applyDefault]);
}

export const useLang = () => useContext(LangCtx);

/** Inline bilingual text; Urdu gets Nastaliq + RTL. */
export function T({ en, ur, className }: { en: ReactNode; ur: ReactNode; className?: string }) {
  const { lang } = useLang();
  return lang === "ur" ? <span className={`urdu ${className ?? ""}`}>{ur}</span> : <span className={className}>{en}</span>;
}

export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <div dir="ltr" className={`flex items-center gap-1 rounded-full border border-line bg-white p-1 text-sm ${className}`}>
      <Globe className="ml-2 h-4 w-4 text-ink-2" />
      {(["en", "ur"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`min-h-9 rounded-full px-3 font-bold ${lang === l ? "bg-brand text-white" : "text-ink-2"} ${l === "ur" ? "urdu" : ""}`}
          aria-pressed={lang === l}
        >
          {l === "en" ? "EN" : "اردو"}
        </button>
      ))}
    </div>
  );
}
