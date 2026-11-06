"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, LANGUAGE_TOGGLE_DISABLED } from "@/context/LanguageContext";
import AdminSidebar from "./AdminSidebar";
import RoleSwitcher from "./RoleSwitcher";
import { getInitials } from "@/lib/utils";
import { ADMIN_DASHBOARD_DISABLED, NOTIFICATIONS_DISABLED } from "@/lib/featureFlags";

import Icon from "@/components/Icon";
import BrandLogo from "@/components/BrandLogo";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole, logout } = useAuth();
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (effectiveRole !== "admin") {
      router.replace(effectiveRole === "student" ? "/student" : "/teacher/courses");
    }
  }, [user, effectiveRole, router]);

  if (!user || effectiveRole !== "admin") return null;

  const initials = getInitials(user.name);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      {/* Skip link */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-50 bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {t("ข้ามไปเนื้อหาหลัก", "Skip to main content")}
      </a>

      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center px-6 bg-[var(--navbar-bg)] text-white">
        {/* Logo */}
        <Link href={ADMIN_DASHBOARD_DISABLED ? "/admin/users" : "/admin"} className="flex items-center gap-2 mr-8">
          <BrandLogo size="sm" />
        </Link>

        <div className="flex-1" />

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

          {/* Notification bell */}
          {!NOTIFICATIONS_DISABLED && (
            <IconButton icon="bell" label="Notifications" tone="onDark" className="relative" />
          )}

          {/* Avatar + name + logout */}
          <div className="flex items-center gap-2">
            <Avatar initials={initials} tone="brand" />
            <span className="text-sm font-medium text-white/90">{user.name}</span>
            <IconButton icon="log-out" label="Sign out" tone="onDark" onClick={() => { logout(); router.replace("/login"); }} className="ml-1" />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main id="admin-main" className="flex-1 min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </main>
      </div>
    </div>
  );
}
