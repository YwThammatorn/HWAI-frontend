"use client";

import { useTheme } from "./ThemeProvider";

/** Navy ↔ teal switch for the top bar + sidebar colours. Sits in every role's top bar next to the light/dark button. */
export default function NavThemeToggle() {
  const { navTheme, toggleNavTheme } = useTheme();
  const label = navTheme === "teal" ? "Switch to navy theme" : "Switch to teal theme";
  return (
    <button
      type="button"
      onClick={toggleNavTheme}
      aria-label={label}
      title={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2C8 6 5 9.5 5 14a7 7 0 0 0 14 0c0-4.5-3-8-7-12z"/>
        {navTheme === "teal" && <circle cx="12" cy="15" r="2.5" fill="currentColor" stroke="none" />}
      </svg>
    </button>
  );
}
