"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTheme } from "./ThemeProvider";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import StudentSidebar from "./StudentSidebar";

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
  const { effectiveTheme, toggleTheme } = useTheme();
  const { students } = useStudents();
  const { getCourse } = useCourses();

  const enrolledCourses = useMemo(() => {
    if (!user?.studentId) return [];
    return students
      .filter((s) => s.studentId === user.studentId)
      .map((s) => {
        const course = getCourse(s.courseId);
        return course ? { secId: course.id, name: course.name } : null;
      })
      .filter((c): c is { secId: string; name: string } => c !== null);
  }, [students, user?.studentId, getCourse]);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (user.role === "teacher" || user.role === "ta") router.replace("/dashboard");
    else if (user.role === "admin") router.replace("/admin");
    else if (user.role !== "student") router.replace("/login");
  }, [user, router]);

  if (!user || user.role !== "student") return null;

  const firstName = user.name.split(" ")[0] ?? user.name;
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
        href="#student-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-50 bg-[#F97316] text-white text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {t("ข้ามไปเนื้อหาหลัก", "Skip to main content")}
      </a>

      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center px-6 bg-[var(--bg-nav)] text-white">
        {/* Logo */}
        <Link href="/student" className="flex items-center gap-2 mr-8">
          <div className="w-8 h-8 rounded-lg bg-[#F97316] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="2" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="2" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.9"/>
              <rect x="10" y="10" width="6" height="6" rx="1" fill="white" fillOpacity="0.6"/>
            </svg>
          </div>
          <span className="font-bold text-[15px] tracking-tight">HWAI Agent</span>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* Avatar + name + logout */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold leading-none">{initials}</span>
            </div>
            <span className="text-sm font-medium text-white/90">{user.name}</span>
            <button
              type="button"
              onClick={() => { logout(); router.replace("/login"); }}
              aria-label="Sign out"
              title="Sign out"
              className="ml-1 w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <StudentSidebar courses={enrolledCourses} />
        <main id="student-main" className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
