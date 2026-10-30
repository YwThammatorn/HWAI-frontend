"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, LANGUAGE_TOGGLE_DISABLED } from "@/context/LanguageContext";
import { INITIAL_NOTIFS } from "@/lib/notifications";
import { NOTIFICATIONS_DISABLED } from "@/lib/featureFlags";
import RoleSwitcher from "./RoleSwitcher";

export default function Navbar() {
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
    <nav className="sticky top-0 z-50 bg-[var(--navbar-bg)] text-white h-14 flex items-center px-6 shrink-0">
      {/* Logo */}
      <Link href="/teacher/courses" className="flex items-center gap-2 mr-8">
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

      {/* Right side: role switcher + language toggle + bell + avatar */}
      <div className="flex items-center gap-3">
        <RoleSwitcher />
        {/* Language toggle — hidden temporarily, see LANGUAGE_TOGGLE_DISABLED */}
        {!LANGUAGE_TOGGLE_DISABLED && (
          <button
            type="button"
            onClick={toggleLang}
            aria-label="Toggle language"
            className="h-7 px-2.5 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors text-xs font-semibold tracking-wide border border-white/20 hover:border-white/40"
          >
            {lang === "th" ? "TH" : "EN"}
          </button>
        )}

        {!NOTIFICATIONS_DISABLED && (
          <Link href="/teacher/notifications" aria-label="Notifications" className="relative text-white/60 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--danger-solid)]" />
            )}
          </Link>
        )}

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
