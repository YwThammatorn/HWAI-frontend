"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, isWithdrawn, withdrawnIds } from "@/lib/students";
import { useAssignments, type Assignment, type Submission } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";
import SearchInput from "@/components/SearchInput";
import PillTabBar from "@/components/PillTabBar";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";

type QueueFilter = "all" | "review" | "notgraded" | "done" | "waiting";

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

/** What still needs doing on one assignment — the numbers every row and stat card is built from. */
function progressOf(a: Assignment, subs: Submission[], today: string) {
  const graded = subs.filter((s) => s.status === "graded");
  const needReview = subs.filter((s) => s.status === "need_review").length;
  const notGraded = subs.filter((s) => s.status === "not_graded").length;
  const complete = subs.length > 0 && graded.length === subs.length;
  const overdue = a.dueDate < today && subs.some((s) => s.status !== "graded");
  const scored = graded.map((s) => (s.instructorScore ?? s.aiScore ?? 0));
  const avgPct = scored.length > 0 && a.maxPoints > 0
    ? Math.round((scored.reduce((sum, v) => sum + v, 0) / scored.length / a.maxPoints) * 100)
    : null;
  // Sort weight: needs review first, then overdue, then anything still open, then waiting on students, then done.
  const rank = needReview > 0 ? 0 : overdue ? 1 : notGraded > 0 ? 2 : subs.length === 0 ? 3 : complete ? 4 : 2;
  return { gradedCount: graded.length, needReview, notGraded, complete, overdue, avgPct, rank };
}

export default function CourseGradingPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");

  const course = getCourse(id);
  const roster = getStudentsByCourse(id);
  // Withdrawn students are out of every class-level number here (24/9/2569) — see lib/students.ts withdrawnIds.
  const students = roster.filter((s) => !isWithdrawn(s));
  const withdrawn = withdrawnIds(roster);
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

  const items = assignments.map((a) => {
    const subs = getSubmissionsByAssignment(a.id).filter((s) => !withdrawn.has(s.studentId));
    return { a, subs, p: progressOf(a, subs, today) };
  });

  // Stat cards — the four that used to sit on the Assignments page, computed the same way.
  const totalAssignments = items.length;
  const gradedAssignments = items.filter((i) => i.p.complete).length;
  const pendingReview = items.reduce((sum, i) => sum + i.p.needReview, 0);
  const overdueCount = items.filter((i) => i.p.overdue).length;

  const matchesFilter = (i: (typeof items)[number]) => {
    switch (filter) {
      case "review": return i.p.needReview > 0;
      case "notgraded": return i.p.notGraded > 0;
      case "done": return i.p.complete;
      case "waiting": return i.subs.length === 0;
      default: return true;
    }
  };
  const q = search.trim().toLowerCase();
  const visible = items
    .filter(matchesFilter)
    .filter((i) => !q || i.a.name.toLowerCase().includes(q))
    .sort((x, y) => x.p.rank - y.p.rank || x.a.dueDate.localeCompare(y.a.dueDate));

  const tabs: { key: QueueFilter; label: string; count: number }[] = [
    { key: "all", label: t("ทั้งหมด", "All"), count: items.length },
    { key: "review", label: t("รอตรวจสอบ", "Needs review"), count: items.filter((i) => i.p.needReview > 0).length },
    { key: "notgraded", label: t("ยังไม่ตรวจ", "Not graded"), count: items.filter((i) => i.p.notGraded > 0).length },
    { key: "done", label: t("ตรวจครบแล้ว", "Completed"), count: items.filter((i) => i.p.complete).length },
    { key: "waiting", label: t("รอนักศึกษาส่ง", "Awaiting submissions"), count: items.filter((i) => i.subs.length === 0).length },
  ];

  const statCards = [
    {
      label: t("งานทั้งหมด", "Total Assignments"), value: totalAssignments,
      color: "var(--s-info-text)", bg: "var(--s-info-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/>
        </svg>
      ),
    },
    {
      label: t("ตรวจแล้ว", "Graded"), value: gradedAssignments,
      color: "var(--s-ok-text)", bg: "var(--s-ok-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/>
        </svg>
      ),
    },
    {
      label: t("รอตรวจสอบ", "Pending Review"), value: pendingReview,
      color: "var(--s-warn-text)", bg: "var(--s-warn-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M5 3h14l-2 7H7L5 3z"/><path d="M7 10l-2 11h14L17 10"/><circle cx="12" cy="16" r="1" fill="currentColor"/>
        </svg>
      ),
    },
    {
      label: t("เลยกำหนด", "Overdue"), value: overdueCount,
      color: "var(--s-err-text)", bg: "var(--s-err-bg)",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
  ];

  return (
    <main className="w-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors" aria-label={t("รายวิชาทั้งหมด", "All courses")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("ตรวจงาน", "Grading")}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ตรวจงาน", "Grading")}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {course.name} · {students.length} {t("นักศึกษา", "students")}
          </p>
        </div>
        <Link
          href={`/teacher/courses/${id}/results`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] transition-colors shrink-0"
        >
          {t("ไปที่สมุดคะแนน", "Open Score Book")}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} bg={s.bg} icon={s.icon} />
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          }
          title={t("ยังไม่มีงานให้ตรวจ", "Nothing to grade yet")}
          description={t("สร้างงานก่อน แล้วงานที่นักศึกษาส่งจะมาอยู่ที่นี่", "Create an assignment first — student submissions will queue up here")}
          action={
            <Link
              href={`/teacher/courses/${id}/assignments/new`}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
            >
              {t("สร้างชิ้นงาน", "Create Assignment")}
            </Link>
          }
        />
      ) : (
        <>
          {/* Filter + search */}
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <PillTabBar tabs={tabs} activeKey={filter} onChange={(k) => setFilter(k as QueueFilter)} ariaLabel={t("กรองงานที่ต้องตรวจ", "Filter the grading queue")} />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ค้นหาชิ้นงาน...", "Search assignments...")}
              ariaLabel={t("ค้นหาชิ้นงาน", "Search assignments")}
              suggestions={items.map((i) => i.a.name)}
              className="w-56 shrink-0"
            />
          </div>

          {/* Queue */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {visible.length === 0 ? (
              <p className="py-14 text-center text-sm text-[var(--text-muted)]">
                {q ? t(`ไม่พบชิ้นงานที่ตรงกับ "${search}"`, `No assignments match "${search}"`) : t("ไม่มีชิ้นงานในหมวดนี้", "No assignments in this view")}
              </p>
            ) : (
              <ul>
                {visible.map(({ a, subs, p }) => {
                  const category = a.categoryId ? categories.find((c) => c.id === a.categoryId) : undefined;
                  const total = subs.length;
                  const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
                  return (
                    <li key={a.id} className="flex items-center gap-6 px-5 py-4 border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-subtle)] transition-colors">
                      {/* What it is */}
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                          className="text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline truncate block"
                        >
                          {a.name}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-[var(--text-secondary)]">
                          <span>{t("กำหนดส่ง", "Due")} {fmtDate(a.dueDate)}</span>
                          {p.overdue && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--s-err-bg)] text-[var(--s-err-text)] font-semibold">
                              {t("เลยกำหนด", "Overdue")}
                            </span>
                          )}
                          <AssignmentTypeBadge type={a.submissionType} />
                          {category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] font-medium tabular-nums">
                              {category.name} ({category.weight}%)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="w-72 shrink-0 hidden md:block">
                        <div className="flex items-baseline justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                          <span className="tabular-nums">
                            <span className="font-semibold text-[var(--text-primary)]">{total}</span> / {students.length} {t("ส่งแล้ว", "submitted")}
                          </span>
                          {p.avgPct !== null && (
                            <span className="tabular-nums">{t("เฉลี่ย", "Avg")} <span className="font-semibold text-[var(--text-primary)]">{p.avgPct}%</span></span>
                          )}
                        </div>
                        <div
                          className="flex h-2 rounded-full overflow-hidden bg-[var(--bg-subtle)]"
                          role="img"
                          aria-label={t(
                            `ตรวจแล้ว ${p.gradedCount}, รอตรวจสอบ ${p.needReview}, ยังไม่ตรวจ ${p.notGraded}`,
                            `${p.gradedCount} graded, ${p.needReview} need review, ${p.notGraded} not graded`,
                          )}
                        >
                          <span className="bg-[var(--s-ok-text)]" style={{ width: seg(p.gradedCount) }} />
                          <span className="bg-[var(--s-warn-text)]" style={{ width: seg(p.needReview) }} />
                          <span className="bg-[var(--text-muted)]/40" style={{ width: seg(p.notGraded) }} />
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-1.5 tabular-nums">
                          {total === 0
                            ? t("ยังไม่มีการส่งงาน", "No submissions yet")
                            : `${t("ตรวจแล้ว", "Graded")} ${p.gradedCount} · ${t("รอตรวจสอบ", "Needs review")} ${p.needReview} · ${t("ยังไม่ตรวจ", "Not graded")} ${p.notGraded}`}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 w-52 justify-end">
                        {p.complete ? (
                          <>
                            <Link
                              href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                              className="px-3 h-9 inline-flex items-center rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] active:scale-[.97] transition-colors"
                            >
                              {t("ทบทวน", "Review")}
                            </Link>
                            <Link
                              href={`/teacher/courses/${id}/assignments/${a.id}/results`}
                              className="px-3 h-9 inline-flex items-center rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                            >
                              {t("ดูผลลัพธ์", "View Results")}
                            </Link>
                          </>
                        ) : total === 0 ? (
                          <span className="text-xs text-[var(--text-muted)]">{t("รอนักศึกษาส่งงาน", "Awaiting submissions")}</span>
                        ) : (
                          <Link
                            href={`/teacher/courses/${id}/assignments/${a.id}/grading`}
                            className="px-3 h-9 inline-flex items-center gap-1.5 rounded-xl bg-[var(--accent-solid)] text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[.97] transition-colors"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            {t("เริ่มตรวจงาน", "Start Grading")}
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--text-muted)]" aria-live="polite">
            {t(`แสดง ${visible.length} จาก ${items.length} ชิ้นงาน`, `Showing ${visible.length} of ${items.length} assignments`)}
          </p>
        </>
      )}
    </main>
  );
}
