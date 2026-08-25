"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import StudentSidebar from "./StudentSidebar";

export default function StudentShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { t, lang, toggleLang } = useLanguage();
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
      <header className="h-14 shrink-0 flex items-center justify-between px-4 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
        <span className="text-sm font-medium text-[var(--text-muted)]">
          {t(`สวัสดี, ${firstName}`, `Hi, ${firstName}`)}
        </span>

        <div className="flex items-center gap-3">
          {/* Language toggle */}
          <button
            onClick={() => toggleLang()}
            aria-label={lang === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-2 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
          >
            {lang === "th" ? "EN" : "TH"}
          </button>

          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-white text-xs font-bold select-none" aria-hidden="true">
            {initials}
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
        <StudentSidebar courses={enrolledCourses} />
        <main id="student-main" className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
