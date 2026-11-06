"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, LANGUAGE_TOGGLE_DISABLED } from "@/context/LanguageContext";
import { INITIAL_NOTIFS } from "@/lib/notifications";
import { NOTIFICATIONS_DISABLED } from "@/lib/featureFlags";
import RoleSwitcher from "./RoleSwitcher";

import Icon from "@/components/Icon";
import BrandLogo from "@/components/BrandLogo";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";
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
        <BrandLogo size="sm" />
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
            <Icon name="bell" size="lg" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--danger-solid)]" />
            )}
          </Link>
        )}

        <div className="flex items-center gap-2">
          <Avatar initials={initials} tone="brand" />
          <span className="text-sm font-medium text-white/90">{user?.name ?? "—"}</span>
          <IconButton icon="log-out" label="Sign out" tone="onDark" onClick={handleLogout} className="ml-1" />
        </div>
      </div>
    </nav>
  );
}
