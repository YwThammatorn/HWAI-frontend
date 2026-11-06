"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, LANGUAGE_TOGGLE_DISABLED } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import StudentSidebar from "./StudentSidebar";
import RoleSwitcher from "./RoleSwitcher";
import { getInitials } from "@/lib/utils";

import Icon from "@/components/Icon";
import BrandLogo from "@/components/BrandLogo";
import IconButton from "@/components/IconButton";
import Avatar from "@/components/Avatar";
export default function StudentShell({ children }: { children: React.ReactNode }) {
  const { user, effectiveRole, logout } = useAuth();
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
        return course ? { secId: course.id, name: course.name, code: course.code, sectionNumber: course.sectionNumber, academicYear: course.academicYear, term: course.term } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [students, user?.studentId, getCourse]);

  useEffect(() => {
    if (!user) { router.replace("/login"); return; }
    if (effectiveRole === "teacher" || effectiveRole === "ta") router.replace("/teacher/courses");
    else if (effectiveRole === "admin") router.replace("/admin");
    else if (effectiveRole !== "student") router.replace("/login");
  }, [user, effectiveRole, router]);

  if (!user || effectiveRole !== "student") return null;

  const firstName = user.name.split(" ")[0] ?? user.name;
  const initials = getInitials(user.name);

  return (
    <div className="h-screen flex flex-col bg-[var(--bg-app)]">
      {/* Skip link */}
      <a
        href="#student-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 z-50 bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold px-4 py-2 rounded-lg"
      >
        {t("ข้ามไปเนื้อหาหลัก", "Skip to main content")}
      </a>

      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center px-6 bg-[var(--navbar-bg)] text-white">
        {/* Logo */}
        <Link href="/student" className="flex items-center gap-2 mr-8">
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
        <StudentSidebar courses={enrolledCourses} />
        <main id="student-main" className="flex-1 min-w-0 overflow-y-auto [scrollbar-gutter:stable]">
          {children}
        </main>
      </div>
    </div>
  );
}
