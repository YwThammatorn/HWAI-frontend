"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import AdminSidebar from "./AdminSidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();

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
