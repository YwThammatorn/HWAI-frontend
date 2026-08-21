"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "th" | "en";

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (th: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "th",
  toggleLang: () => {},
  t: (th) => th,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("th");

  useEffect(() => {
    const saved = localStorage.getItem("hwai_lang") as Lang | null;
    if (saved === "th" || saved === "en") setLang(saved);
  }, []);

  function toggleLang() {
    setLang((prev) => {
      const next: Lang = prev === "th" ? "en" : "th";
      localStorage.setItem("hwai_lang", next);
      return next;
    });
  }

  function t(th: string, en: string) {
    return lang === "th" ? th : en;
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
