"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import SearchInput from "@/components/SearchInput";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
function fmtDate(dateStr: string, lang: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(dateLocale(lang), {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Planning page: what the work is, when it is due, how it is scored. Everything about
// checking submissions (stats, progress, Start Grading) lives on the Grading page.
export default function AssignmentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getRubricsByAssignment, removeAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const course = getCourse(id);
  const students = getStudentsByCourse(id).filter((s) => !isWithdrawn(s));
  const assignments = getAssignmentsByCourse(id);
  const categories = getCategoriesByCourse(id);
  const today = new Date().toISOString().split("T")[0];

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
        <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับหน้าหลัก", "Back")}</Link>
      </main>
    );
  }

  const visible = search
    ? assignments.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : assignments;

  return (
    <main className="w-full px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("ชิ้นงาน", "Assignments")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("งาน/การบ้าน", "Assignments")}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {course.name} · {students.length} {t("นักศึกษา", "students")}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={`/teacher/courses/${id}/assignments/new`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] font-medium rounded-xl text-sm active:scale-[.97] transition-colors"
          >
            <Icon name="plus" />
            {t("สร้างชิ้นงาน", "Create Assignment")}
          </Link>
        </div>
      </div>

      {/* Course description */}
      {course.description && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-5 mb-6">
          <p className="text-xs text-[var(--text-secondary)] mb-1.5">{t("คำอธิบายรายวิชา", "Course Description")}</p>
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-[var(--text-primary)] leading-relaxed">{course.description}</p>
            <Link href={`/teacher/courses/${id}/settings`} className="text-[var(--accent)] text-sm hover:underline shrink-0">{t("แก้ไข", "Edit")}</Link>
          </div>
        </div>
      )}

      {/* Assignments list */}
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("ชิ้นงานที่ใช้งานอยู่", "Active Assignments")}</h2>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("ค้นหาชิ้นงาน...", "Search tasks...")}
            ariaLabel={t("ค้นหาชิ้นงาน", "Search assignments")}
            suggestions={assignments.map((a) => a.name)}
            className="w-48"
          />
        </div>

        {visible.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            {search ? (
              <p className="text-[var(--text-secondary)] text-sm">{t(`ไม่พบชิ้นงานที่ตรงกับ "${search}"`, `No results for "${search}"`)}</p>
            ) : (
              <>
                <IconTile icon="file-text" size="lg" tone="accent" className="mb-3" />
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีชิ้นงาน", "No assignments yet")}</p>
                <p className="text-xs text-[var(--text-muted)] mb-4">{t("กด Create Assignment เพื่อเพิ่มชิ้นงานแรก", "Click Create Assignment to add your first one")}</p>
                <Link
                  href={`/teacher/courses/${id}/assignments/new`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium rounded-xl active:scale-[.97] transition-colors"
                >
                  <Icon name="plus" />
                  {t("สร้างชิ้นงาน", "Create Assignment")}
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {visible.map((a) => {
              const isPastDue = !!a.dueDate && a.dueDate < today;
              const category = a.categoryId ? categories.find((c) => c.id === a.categoryId) : undefined;
              const rubric = getRubricsByAssignment(a.id)[0];
              const criteriaCount = rubric?.criteria.length ?? 0;
              return (
                <div key={a.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                  {/* Whole row opens the detail page (22/9/2569 — was title-text-only before). The
                      title keeps its own real <Link> (keyboard tab target, ctrl/middle-click new tab);
                      this onClick is a mouse convenience on top of that, same destination either way.
                      The action cluster on the right stops propagation so its own links/menu still work. */}
                  <div
                    onClick={() => router.push(`/teacher/courses/${id}/assignments/${a.id}`)}
                    className="flex items-center px-5 py-4 hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/teacher/courses/${id}/assignments/${a.id}`}
                        className="text-[var(--accent)] font-medium hover:underline text-sm"
                      >
                        {a.name}
                      </Link>
                      {a.description && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{a.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <Icon name="calendar" size="xs" className={isPastDue ? "text-[var(--s-err-text)]" : "text-[var(--text-muted)]"} />
                        <span className={`text-xs ${isPastDue ? "text-[var(--s-err-text)]" : "text-[var(--text-secondary)]"}`}>
                          {a.dueDate
                            ? <>{isPastDue ? `${t("เลยกำหนด", "Past due")} — ` : ""}{t("กำหนดส่ง", "Due")} {fmtDate(a.dueDate, lang)}</>
                            : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}
                          <span className="text-[var(--text-muted)]"> · {a.maxPoints} {t("คะแนน", "pts")}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <AssignmentTypeBadge type={a.submissionType} />
                        {a.submissionType === "group" && a.maxGroupSize && (
                          <span className="text-xs text-[var(--text-muted)]">≤ {a.maxGroupSize} {t("คน", "members")}</span>
                        )}
                        {(a.fileTypes ?? []).map((ft) => (
                          <span key={ft} className="px-2 py-0.5 rounded-full bg-[var(--bg-app)] text-[var(--text-secondary)] text-xs font-mono">
                            {ft === "figma" ? "Figma" : ft === "pdf" ? "PDF" : t("รูปภาพ", "Image")}
                          </span>
                        ))}
                        {!(a.acceptsFiles ?? true) && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-app)] text-[var(--text-secondary)] text-xs">{t("ไม่รับไฟล์", "No files")}</span>
                        )}
                        {category && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-medium tabular-nums">
                            {category.name} ({category.weight}%)
                          </span>
                        )}
                        {rubric ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--s-info-bg)] text-[var(--s-info-text)] text-xs font-medium tabular-nums">
                            {t("เกณฑ์การให้คะแนน", "Rubric")} · {criteriaCount} {t("เกณฑ์", "criteria")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] text-xs font-medium">
                            {t("ยังไม่มี Rubric", "No rubric")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* stopPropagation: this cluster's own links/menu shouldn't also trigger the row's
                        click-through to the detail page above. "Grade →" removed 22/9/2569 — it was a
                        plain text link, not a prominent action, and is now redundant with the row
                        itself being clickable through to detail (which has its own "Go to grading"). */}
                    <div className="flex items-center gap-3 shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                      {/* ▼ dropdown menu */}
                      <div className="relative" ref={openMenu === a.id ? menuRef : undefined}>
                        <IconButton icon="more-vertical" label={t(`เมนูของ ${a.name}`, `Actions for ${a.name}`)} onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === a.id ? null : a.id); }} aria-haspopup="menu" aria-expanded={openMenu === a.id} />
                        {openMenu === a.id && (
                          <div role="menu" className="absolute right-0 top-9 z-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-lg py-1 w-36 text-sm">
                            <Link
                              role="menuitem"
                              href={`/teacher/courses/${id}/assignments/${a.id}/edit`}
                              className="flex items-center gap-2 px-3 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                              onClick={() => setOpenMenu(null)}
                            >
                              <Icon name="edit" size="xs" />
                              {t("แก้ไข", "Edit")}
                            </Link>
                            <button
                              role="menuitem"
                              onClick={() => {
                                setOpenMenu(null);
                                if (window.confirm(t(`ลบ "${a.name}" ถาวร?`, `Permanently delete "${a.name}"?`))) {
                                  removeAssignment(a.id);
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-2 text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] w-full text-left"
                            >
                              <Icon name="trash" size="xs" />
                              {t("ลบ", "Delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="px-5 py-3 text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
              {t("แสดง", "Showing")} <span className="font-medium text-[var(--text-primary)]">1–{visible.length}</span> {t("จาก", "of")} <span className="font-medium text-[var(--text-primary)]">{visible.length}</span> {t("งาน", "assignments")}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
