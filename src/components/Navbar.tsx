"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { INITIAL_NOTIFS } from "@/lib/notifications";
import RoleSwitcher from "./RoleSwitcher";

export default function Navbar() {
  const { effectiveTheme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { lang, toggleLang } = useLanguage();
  const router = useRouter();
  const hasUnread = INITIAL_NOTIFS.some((n) => !n.read);
  const initials = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-50 bg-[var(--bg-nav)] text-white h-14 flex items-center px-6 shrink-0">
      {/* Logo */}
      <Link href="/teacher/dashboard" className="flex items-center gap-2 mr-8">
        <div className="w-8 h-8 rounded-lg bg-[#2DD4BF] flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
            <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
          </svg>
        </div>
        <span className="font-bold text-[15px] tracking-tight">HWAI Agent</span>
      </Link>

      <div className="flex-1" />

      {/* Right side: role switcher + theme toggle + bell + avatar */}
      <div className="flex items-center gap-3">
        <RoleSwitcher />
        {/* Language toggle */}
        <button
          type="button"
          onClick={toggleLang}
          aria-label="Toggle language"
          className="h-7 px-2.5 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold tracking-wide border border-white/20 hover:border-white/40"
        >
          {lang === "th" ? "TH" : "EN"}
        </button>

        {/* Theme toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          {effectiveTheme === "dark" ? (
            /* Sun icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          ) : (
            /* Moon icon */
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>

        <Link href="/teacher/notifications" aria-label="Notifications" className="relative text-white/60 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
          )}
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center shrink-0">
            <span className="text-[#1B2A4A] text-xs font-bold leading-none">{initials}</span>
          </div>
          <span className="text-sm font-medium text-white/90">{user?.name ?? "—"}</span>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
