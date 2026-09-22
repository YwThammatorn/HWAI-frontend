"use client";
import { createContext, useContext, useLayoutEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
type EffectiveTheme = "light" | "dark";
// Chrome (Navbar + the 3 portal sidebars) colour — independent of light/dark. "navy" is today's
// look; "teal" is the advisor-suggested variant (22/9/2569, matches --accent-solid / the Sign-in
// button). See globals.css's "Chrome theme toggle" block for what it actually repaints.
export type NavTheme = "navy" | "teal";

interface ThemeContextValue {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  applyPreference: (p: ThemePreference) => void;
  savePreference: (p: ThemePreference) => void;
  revertPreference: () => void;
  toggleTheme: () => void;
  navTheme: NavTheme;
  toggleNavTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "light",
  effectiveTheme: "light",
  applyPreference: () => {},
  savePreference: () => {},
  revertPreference: () => {},
  toggleTheme: () => {},
  navTheme: "navy",
  toggleNavTheme: () => {},
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

function applyNavThemeToDom(navTheme: NavTheme) {
  document.documentElement.setAttribute("data-nav-theme", navTheme);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>("light");
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>("light");
  const [navTheme, setNavTheme] = useState<NavTheme>("navy");

  useLayoutEffect(() => {
    // Default = "light" (not OS) if nothing stored yet
    const stored = (localStorage.getItem("hwai-theme") as ThemePreference | null) ?? "light";
    const effective = resolveEffective(stored);
    setPreference(stored);
    setEffectiveTheme(effective);
    applyToDom(effective);

    // Chrome colour — separate preference, separate key. Default "navy" (unchanged look) if nothing
    // stored, so nobody sees a different site unless they opt in.
    const storedNav = (localStorage.getItem("hwai-nav-theme") as NavTheme | null) ?? "navy";
    setNavTheme(storedNav);
    applyNavThemeToDom(storedNav);
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

  function toggleNavTheme() {
    const next: NavTheme = navTheme === "navy" ? "teal" : "navy";
    setNavTheme(next);
    applyNavThemeToDom(next);
    localStorage.setItem("hwai-nav-theme", next);
  }

  return (
    <ThemeContext.Provider
      value={{ preference, effectiveTheme, applyPreference, savePreference, revertPreference, toggleTheme, navTheme, toggleNavTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
