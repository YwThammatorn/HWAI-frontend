"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";
import type { Course } from "@/lib/courses";
import { useLanguage } from "@/context/LanguageContext";
import SearchInput from "@/components/SearchInput";

export default function CoursesPage() {
  const { t } = useLanguage();
  const { courses, updateCourse, removeCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  const active = courses.filter((c) => c.status !== "archived");
  const archived = courses.filter((c) => c.status === "archived");

  useEffect(() => {
    if (tab === "archived" && archived.length === 0) {
      setTab("active");
    }
  }, [archived.length, tab]);

  useEffect(() => { setPage(1); }, [search, tab]);

  const pool = tab === "active" ? active : archived;
  const visible = search
    ? pool.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : pool;

  const totalPages = Math.ceil(visible.length / PAGE_SIZE);
  const paginated = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const courseStats = useMemo(() => {
    return courses.reduce<Record<string, { studentCount: number; allGraded: boolean; activeAssignments: number }>>((acc, c) => {
      const assignments = getAssignmentsByCourse(c.id);
      acc[c.id] = {
        studentCount: getStudentsByCourse(c.id).length,
        allGraded: assignments.length > 0 && assignments.every((a) => {
          const subs = getSubmissionsByAssignment(a.id);
          return subs.length > 0 && subs.every((s) => s.status === "graded");
        }),
        activeAssignments: assignments.filter((a) =>
          getSubmissionsByAssignment(a.id).some((s) => s.status !== "graded")
        ).length,
      };
      return acc;
    }, {});
  }, [courses, getStudentsByCourse, getAssignmentsByCourse, getSubmissionsByAssignment]);

  return (
    <AppShell>
      <main className="w-full max-w-[1200px] mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)]">{t("รายวิชาทั้งหมด", "All Courses")}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("จัดการรายวิชา งาน และความคืบหน้าของนักศึกษาจากที่นี่", "Manage your classes, assignments, and student progress from here.")}
            </p>
          </div>

          {active.length > 0 && (
            <div className="flex items-center gap-3">
              {/* Search */}
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("ค้นหารายวิชา", "Search courses...")}
                ariaLabel={t("ค้นหารายวิชา", "Search courses")}
                className="w-56"
              />
              {/* Add Course */}
              <Link
                href="/courses/new"
                className="flex items-center gap-2 px-4 py-2 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] font-medium rounded-xl text-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                {t("เพิ่มรายวิชา", "Add Course")}
              </Link>
            </div>
          )}
        </div>

        {/* Tab filter â€” only show when there are archived */}
        {archived.length > 0 && (
          <div className="flex gap-1 mb-6">
            {(["active", "archived"] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={[
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  tab === tabKey ? "bg-[var(--bg-nav)] text-white" : "text-gray-500 hover:bg-gray-100",
                ].join(" ")}
              >
                {tabKey === "active" ? t("ใช้งานอยู่", "Active") : t("เก็บถาวร", "Archived")}
                <span className={["ml-1.5 text-xs px-1.5 py-0.5 rounded-full", tab === tabKey ? "bg-white/20" : "bg-gray-200"].join(" ")}>
                  {tabKey === "active" ? active.length : archived.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {visible.length === 0 ? (
          search ? (
            <p className="text-center text-gray-500 text-sm py-20">{t("ไม่พบรายวิชาที่ตรงกับ", "No courses matching")} &ldquo;{search}&rdquo;</p>
          ) : tab === "active" ? (
            <EmptyState />
          ) : (
            <p className="text-center text-gray-500 text-sm py-20">{t("ไม่มีรายวิชาที่ถูก archive", "No archived courses")}</p>
          )
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginated.map((course) => {
                const stats = courseStats[course.id] ?? { studentCount: 0, allGraded: false, activeAssignments: 0 };
                return (
                  <CourseCard
                    key={course.id}
                    course={course}
                    studentCount={stats.studentCount}
                    allGraded={stats.allGraded}
                    activeAssignments={stats.activeAssignments}
                    isArchived={tab === "archived"}
                    onRestore={() => updateCourse(course.id, { status: "active" })}
                    onDelete={() => {
                      if (window.confirm(t(`ลบ "${course.name}" ถาวร?\nไม่สามารถกู้คืนได้`, `Permanently delete "${course.name}"?\nCannot be undone.`))) {
                        removeCourse(course.id);
                      }
                    }}
                  />
                );
              })}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-1 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-8 h-8 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={["w-8 h-8 rounded-full text-sm font-medium transition-colors", p === page ? "bg-[#2DD4BF] text-[var(--text-primary)]" : "text-gray-500 hover:bg-gray-100"].join(" ")}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-8 h-8 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
}

function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-16 py-14 flex flex-col items-center text-center max-w-md w-full">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M10 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14z" stroke="#2DD4BF" strokeWidth="2"/>
              <path d="M18 20h16M18 27h10" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18 34h6" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="absolute top-1 right-0 w-3 h-3 rounded-full bg-[#2DD4BF] opacity-60"/>
          <div className="absolute bottom-2 left-0 w-2 h-2 rounded-full bg-gray-300"/>
          <div className="absolute top-8 -left-3 w-2 h-2 rounded-full bg-[#2DD4BF] opacity-40"/>
        </div>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{t("เริ่มสร้างรายวิชาแรกของคุณ", "Let's start your first class")}</h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          {t("สร้างรายวิชาเพื่อเริ่มตรวจงานด้วย HWAI Agent", "Create a course to begin grading assignments with HWAI Agent.")}
        </p>

        <Link
          href="/courses/new"
          className="flex items-center gap-2 px-6 py-2.5 bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] font-medium rounded-full text-sm transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          {t("เพิ่มรายวิชาแรก", "Add Your First Course")}
        </Link>
      </div>
    </div>
  );
}

function CourseCard({ course, studentCount, allGraded, activeAssignments, isArchived, onRestore, onDelete }: {
  course: Course;
  studentCount: number;
  allGraded: boolean;
  activeAssignments: number;
  isArchived: boolean;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const sourceLabel: Record<string, { label: string; dot: string }> = {
    manual: { label: t("เพิ่มเอง", "Manually Added"), dot: "" },
    google: { label: "Google Classroom", dot: "#34D399" },
    teams: { label: "Microsoft Teams", dot: "#60A5FA" },
  };
  const src = sourceLabel[course.source] ?? { label: course.source, dot: "" };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* Colored banner */}
      <Link href={isArchived ? "#" : `/courses/${course.id}`} className="block relative h-28" style={{ background: course.coverColor }}>
        <div className="absolute bottom-3 left-3 w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        {isArchived && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-full">{t("เก็บถาวร", "Archived")}</span>
          </div>
        )}
      </Link>

      {/* Card body */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-1">
          <h3 className="font-bold text-[var(--text-primary)] text-[15px] leading-snug">{course.name}</h3>
          {course.source === "manual" && !isArchived && (
            <div className="flex gap-2 text-xs ml-2 shrink-0">
              <Link href={`/courses/${course.id}/settings`} className="text-[var(--accent)] hover:underline font-medium">{t("แก้ไข", "Edit")}</Link>
              <button onClick={onDelete} className="text-red-400 hover:underline font-medium">{t("ลบ", "Delete")}</button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-3">
          {src.dot && <span className="w-2 h-2 rounded-full inline-block" style={{ background: src.dot }} />}
          <span className="text-xs text-gray-500">{src.label}</span>
        </div>

        {isArchived ? (
          <button
            onClick={onRestore}
            className="w-full text-xs font-medium py-1.5 rounded-lg bg-[var(--accent-subtle)] hover:bg-[#2DD4BF] text-[var(--accent)] hover:text-[#1B2A4A] transition-colors"
          >
            {t("คืนค่า", "Restore")}
          </button>
        ) : (
          <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-50 pt-3">
            <span className="flex items-center gap-1">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              {studentCount} {t("นักศึกษา", "Students")}
            </span>
            {allGraded ? (
              <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                {t("ตรวจแล้วทั้งหมด", "All Graded")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-orange-500">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {activeAssignments} {t("งานรอตรวจ", "Active")}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
