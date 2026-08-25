"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "./ThemeProvider";
import AdminSidebar from "./AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
  const { effectiveTheme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role !== "admin") {
      router.replace(user.role === "student" ? "/student" : "/dashboard");
    }
  }, [user, router]);

  if (!user || user.role !== "admin") return null;

  const initials = user.name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      {/* Skip link */}
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-50 bg-[#2DD4BF] text-[#1B2A4A] text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {t("ข้ามไปเนื้อหาหลัก", "Skip to main content")}
      </a>

      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <span className="text-sm font-medium text-[var(--text-muted)]">{t("ระบบจัดการ HWAI", "HWAI Management System")}</span>

        <div className="flex items-center gap-3">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={effectiveTheme === "dark" ? t("เปลี่ยนเป็นโหมดสว่าง", "Switch to light mode") : t("เปลี่ยนเป็นโหมดมืด", "Switch to dark mode")}
            className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
          >
            {effectiveTheme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Language toggle */}
          <button
            onClick={() => toggleLang()}
            aria-label={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
          >
            {lang === "th" ? "EN" : "TH"}
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#2DD4BF] flex items-center justify-center text-[#1B2A4A] text-xs font-bold select-none" aria-hidden="true">
              {initials}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] hidden sm:block">{user.name}</span>
          </div>

          {/* Logout */}
          <button
            onClick={() => { logout(); router.replace("/login"); }}
            className="text-sm text-[var(--text-muted)] hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            {t("ออกจากระบบ", "Sign out")}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main id="admin-main" className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
