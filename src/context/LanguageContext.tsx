"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "th" | "en";

/** Language-toggle button hidden app-wide at the user's request (15/9/2569,
 *  temporary — plan to bring it back later). Flip to false to restore the
 *  button in Navbar/AdminShell/StudentShell; t() itself is unaffected. */
export const LANGUAGE_TOGGLE_DISABLED = true;

interface LanguageContextValue {
  lang: Lang;
  toggleLang: () => void;
  t: (th: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  toggleLang: () => {},
  t: (_th, en) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Default changed th -> en at the user's request (15/9/2569).
  const [lang, setLang] = useState<Lang>("en");

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
