"use client";
import { createContext, useContext, useLayoutEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
type EffectiveTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  applyPreference: (p: ThemePreference) => void;
  savePreference: (p: ThemePreference) => void;
  revertPreference: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "light",
  effectiveTheme: "light",
  applyPreference: () => {},
  savePreference: () => {},
  revertPreference: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function resolveEffective(pref: ThemePreference): EffectiveTheme {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

function applyToDom(effective: EffectiveTheme) {
  document.documentElement.setAttribute("data-theme", effective);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("light");
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>("light");

  useLayoutEffect(() => {
    // Dark mode is switched off (15/10/2569): its button was removed from the top bars, so a "dark" or "system" choice stored by an earlier
    // visit must not keep anyone in a mode they can no longer leave. Always light; the stored value is cleared. The dark colour tokens stay in
    // globals.css, and the rest of this provider is untouched, so bringing the button back is one component per shell.
    try { localStorage.removeItem("hwai-theme"); } catch { /* storage blocked */ }
    setPreference("light");
    setEffectiveTheme("light");
    applyToDom("light");
  }, []);

  function applyPreference(p: ThemePreference) {
    const effective = resolveEffective(p);
    setPreference(p);
    setEffectiveTheme(effective);
    applyToDom(effective);
  }

  function savePreference(p: ThemePreference) {
    applyPreference(p);
    localStorage.setItem("hwai-theme", p);
  }

  function revertPreference() {
    const stored = (localStorage.getItem("hwai-theme") as ThemePreference | null) ?? "light";
    applyPreference(stored);
  }

  function toggleTheme() {
    const next: EffectiveTheme = effectiveTheme === "light" ? "dark" : "light";
    savePreference(next);
  }

  return (
    <ThemeContext.Provider
      value={{ preference, effectiveTheme, applyPreference, savePreference, revertPreference, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
