"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn, withdrawnIds } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { useAuth } from "@/context/AuthContext";
import type { Course } from "@/lib/courses";
import { useLanguage } from "@/context/LanguageContext";
import SearchInput from "@/components/SearchInput";
import Pagination from "@/components/Pagination";
import CourseBanner from "@/components/CourseBanner";

import Icon from "@/components/Icon";
export default function CoursesPage() {
  const { t } = useLanguage();
  const { courses: allCourses, updateCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { effectiveRole } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // Only courses this teacher is assigned to (the admin-managed list or a per-section role); for a TA, only the courses they assist (useMyCourseIds).
  // No matching account (e.g. an unlinked dev-bypass session) → empty list, not "show everything".
  const myCourseIds = useMyCourseIds();
  const isTa = effectiveRole === "ta";
  const courses = allCourses.filter((c) => myCourseIds.has(c.id));

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
      // Withdrawn students are out of the card's numbers (24/9/2569).
      const roster = getStudentsByCourse(c.id);
      const withdrawn = withdrawnIds(roster);
      const liveSubs = (assignmentId: string) => getSubmissionsByAssignment(assignmentId).filter((s) => !withdrawn.has(s.studentId));
      acc[c.id] = {
        studentCount: roster.filter((s) => !isWithdrawn(s)).length,
        allGraded: assignments.length > 0 && assignments.every((a) => {
          const subs = liveSubs(a.id);
          return subs.length > 0 && subs.every((s) => s.status === "graded");
        }),
        activeAssignments: assignments.filter((a) =>
          liveSubs(a.id).some((s) => s.status !== "graded")
        ).length,
      };
      return acc;
    }, {});
  }, [courses, getStudentsByCourse, getAssignmentsByCourse, getSubmissionsByAssignment]);

  return (
      <main className="w-full px-8 py-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("รายวิชาของฉัน", "My Courses")}</h1>
            {isTa && (
              <p data-testid="ta-note" className="mt-1 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span className="inline-flex h-6 items-center rounded-md border border-[var(--role-ta-border)] bg-[var(--role-ta-bg)] px-2 text-xs font-semibold text-[var(--role-ta-text)]">TA</span>
                {t("วิชาที่คุณเป็นผู้ช่วยสอน — ตรวจงานและดูคะแนนได้", "Courses you assist as a TA — you can grade work and see the scores")}
              </p>
            )}
            {!isTa && <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t("จัดการรายวิชา งาน และความคืบหน้าของนักศึกษาจากที่นี่", "Manage your classes, assignments, and student progress from here.")}
            </p>}
          </div>

          {active.length > 0 && (
            <div className="flex items-center gap-3">
              {/* Search */}
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={t("ค้นหารายวิชา", "Search courses...")}
                ariaLabel={t("ค้นหารายวิชา", "Search courses")}
                suggestions={active.map((c) => c.name)}
                className="w-56"
              />
            </div>
          )}
        </div>

        {/* Tab filter — only show when there are archived */}
        {archived.length > 0 && (
          <div className="flex gap-1 mb-6">
            {(["active", "archived"] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setTab(tabKey)}
                className={[
                  "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  tab === tabKey ? "bg-[var(--bg-nav)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]",
                ].join(" ")}
              >
                {tabKey === "active" ? t("ใช้งานอยู่", "Active") : t("เก็บถาวร", "Archived")}
                <span className={["ml-1.5 text-xs px-1.5 py-0.5 rounded-full", tab === tabKey ? "bg-white/20" : "bg-[var(--border)]"].join(" ")}>
                  {tabKey === "active" ? active.length : archived.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {visible.length === 0 ? (
          search ? (
            <p className="text-center text-[var(--text-secondary)] text-sm py-20">{t("ไม่พบรายวิชาที่ตรงกับ", "No courses matching")} &ldquo;{search}&rdquo;</p>
          ) : tab === "active" ? (
            <EmptyState />
          ) : (
            <p className="text-center text-[var(--text-secondary)] text-sm py-20">{t("ไม่มีรายวิชาที่ถูก archive", "No archived courses")}</p>
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
                  />
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        )}
      </main>
  );
}

function EmptyState() {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-center py-16">
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-subtle)] px-16 py-14 flex flex-col items-center text-center max-w-md w-full">
        {/* Illustration */}
        <div className="relative mb-8">
          <div className="w-28 h-28 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <path d="M10 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V14z" stroke="var(--accent-bright)" strokeWidth="2"/>
              <path d="M18 20h16M18 27h10" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round"/>
              <path d="M18 34h6" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="absolute top-1 right-0 w-3 h-3 rounded-full bg-[var(--accent-bright)] opacity-60"/>
          <div className="absolute bottom-2 left-0 w-2 h-2 rounded-full bg-[var(--border)]"/>
          <div className="absolute top-8 -left-3 w-2 h-2 rounded-full bg-[var(--accent-bright)] opacity-40"/>
        </div>

        <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">{t("ยังไม่มีรายวิชาที่ได้รับมอบหมาย", "No courses assigned yet")}</h2>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {t("ติดต่อแอดมินเพื่อให้เพิ่มคุณเข้ารายวิชา", "Contact your admin to be assigned to a course.")}
        </p>
      </div>
    </div>
  );
}

function CourseCard({ course, studentCount, allGraded, activeAssignments, isArchived, onRestore }: {
  course: Course;
  studentCount: number;
  allGraded: boolean;
  activeAssignments: number;
  isArchived: boolean;
  onRestore: () => void;
}) {
  const { t } = useLanguage();
  const sourceLabel: Record<string, { label: string; dot: string }> = {
    manual: { label: t("เพิ่มเอง", "Manually Added"), dot: "" },
    google: { label: "Google Classroom", dot: "var(--s-ok-text)" },
    teams: { label: "Microsoft Teams", dot: "var(--s-info-text)" },
  };
  const src = sourceLabel[course.source] ?? { label: course.source, dot: "" };

  // Manual courses without a code show nothing; imported ones fall back to their source name
  const codeLabel = course.code || (course.source === "manual" ? "" : src.label);
  const termLabel = course.academicYear && course.term ? `${course.term}/${course.academicYear}` : "—";

  const cardContent = (
    <>
      {/* Cover — colour band carries the icon, course code and name */}
      <CourseBanner
        coverColor={course.coverColor}
        icon={course.icon}
        name={course.name}
        code={codeLabel}
        overlay={isArchived && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-full">{t("เก็บถาวร", "Archived")}</span>
          </div>
        )}
      />

      {/* Card body — flex column so footer pins to bottom */}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex-1">
          {/* DEEP-QA-style meta rows — always shown for a consistent card shape;
              em-dash when a course has no Section / CourseTemplate link */}
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[var(--border-subtle)]">
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("กลุ่ม", "Section")}</p>
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.sectionNumber || "—"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("ภาคเรียนที่", "Term")}</p>
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{termLabel}</p>
            </div>
          </div>

          {(course.schedule || course.room) && (
            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("วันเวลาเรียน", "Schedule")}</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.schedule || "—"}</p>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("ห้องเรียน", "Room")}</p>
                <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.room || "—"}</p>
              </div>
            </div>
          )}
        </div>

        {isArchived ? (
          <button
            onClick={onRestore}
            className="mt-3 w-full text-xs font-medium py-1.5 rounded-lg bg-[var(--accent-subtle)] hover:bg-[var(--accent-solid)] text-[var(--accent)] hover:text-[var(--accent-solid-text)] transition-colors"
          >
            {t("คืนค่า", "Restore")}
          </button>
        ) : (
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)] pt-3 mt-3">
            <span className="flex items-center gap-1">
              <Icon name="users" size="xs" />
              {studentCount} {t("นักศึกษา", "Students")}
            </span>
            {allGraded ? (
              <span className="flex items-center gap-1 text-[var(--accent)] font-medium">
                <Icon name="check" size="xs" />
                {t("ตรวจแล้วทั้งหมด", "All Graded")}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[var(--st-todo-text)]">
                <Icon name="calendar" size="xs" />
                {activeAssignments} {t("งานรอตรวจ", "Active")}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  const cardClassName = "flex flex-col bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-subtle)] overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]";

  if (isArchived) {
    return <div className={cardClassName}>{cardContent}</div>;
  }

  return (
    <Link href={`/teacher/courses/${course.id}`} className={cardClassName}>
      {cardContent}
    </Link>
  );
}
