"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useGradingCategories } from "@/lib/gradingCategories";
import { useLanguage } from "@/context/LanguageContext";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";
import { AttachmentList } from "@/components/AssignmentAttachments";

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// Planning view of one assignment: what it is, when it is due, how it is scored.
// Everything about checking the submissions (stats, table, Review / Recheck) is on the Grading page.
export default function ViewAssignmentPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, getRubricsByAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);

  if (!course || !assignment) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        {t("ไม่พบข้อมูล", "Not found")} —{" "}
        <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">{t("กลับรายการงาน", "Back to assignments")}</Link>
      </main>
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isPastDue = !!assignment.dueDate && assignment.dueDate < today;
  const category = assignment.categoryId
    ? getCategoriesByCourse(id).find((c) => c.id === assignment.categoryId)
    : undefined;
  const rubric = getRubricsByAssignment(assignmentId)[0];
  const needReview = getSubmissionsByAssignment(assignmentId).filter((s) => s.status === "need_review").length;
  const editHref = `/teacher/courses/${id}/assignments/${assignmentId}/edit`;
  const totalWeight = rubric ? rubric.criteria.reduce((sum, c) => sum + c.weight, 0) : 0;
  const fileTypeLabel = (ft: string) => (ft === "figma" ? "Figma" : ft === "pdf" ? "PDF" : t("รูปภาพ", "Image"));

  const detailRows: { label: string; value: React.ReactNode }[] = [
    assignment.dueDate
      ? {
          label: t("กำหนดส่ง", "Due date"),
          value: (
            <span className={isPastDue ? "text-[var(--s-err-text)]" : undefined}>
              {fmtDate(assignment.dueDate)} {t("เวลา 23:59 น.", "at 11:59 PM")}
            </span>
          ),
        }
      : {
          label: t("กำหนดส่ง", "Due date"),
          value: <span>{t("ไม่มี — นักศึกษาไม่ต้องส่งงาน รอรับคะแนนอย่างเดียว", "None — students don't submit; they just receive their score")}</span>,
        },
    { label: t("คะแนนเต็ม", "Max points"), value: <span className="tabular-nums">{assignment.maxPoints}</span> },
    {
      label: t("หมวดคะแนน", "Grading category"),
      value: category ? <span className="tabular-nums">{category.name} ({category.weight}%)</span> : <span className="text-[var(--text-muted)]">{t("ไม่ได้กำหนด", "Not set")}</span>,
    },
    {
      label: t("ประเภทงาน", "Type"),
      value: (
        <span className="inline-flex items-center gap-2 flex-wrap">
          <AssignmentTypeBadge type={assignment.submissionType} size="md" />
          {assignment.submissionType === "group" && assignment.maxGroupSize && (
            <span className="text-[var(--text-secondary)]">≤ {assignment.maxGroupSize} {t("คน", "members")}</span>
          )}
        </span>
      ),
    },
    {
      label: t("ไฟล์ที่รับ", "Accepted files"),
      value: !(assignment.acceptsFiles ?? true) ? (
        <span className="text-[var(--text-muted)]">{t("ไม่รับไฟล์", "No files")}</span>
      ) : (assignment.fileTypes ?? []).length > 0 ? (
        <span className="inline-flex gap-1.5 flex-wrap">
          {assignment.fileTypes.map((ft) => (
            <span key={ft} className="px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-xs font-mono">{fileTypeLabel(ft)}</span>
          ))}
        </span>
      ) : (
        <span className="text-[var(--text-muted)]">{t("ทุกประเภท", "Any type")}</span>
      ),
    },
  ];

  return (
    <main className="w-full px-8 py-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)]" aria-label={t("รายวิชาทั้งหมด", "All courses")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{assignment.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{assignment.name}</h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm flex-wrap">
            <span className={isPastDue ? "text-[var(--s-err-text)]" : "text-[var(--text-secondary)]"}>
              {assignment.dueDate
                ? <>{isPastDue ? `${t("เลยกำหนด", "Past due")} — ` : ""}{t("กำหนดส่ง", "Due")} {fmtDate(assignment.dueDate)}</>
                : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}
            </span>
            {category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-xs font-medium tabular-nums">
                {category.name} ({category.weight}%)
              </span>
            )}
            <AssignmentTypeBadge type={assignment.submissionType} />
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={editHref}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] active:scale-[.97] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t("แก้ไขงาน", "Edit Assignment")}
          </Link>
          <Link
            href={`/teacher/courses/${id}/assignments/${assignmentId}/grading`}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold rounded-xl active:scale-[.97] transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {t("ไปตรวจงาน", "Go to grading")}
            {needReview > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] text-xs font-bold tabular-nums"
                aria-label={t(`${needReview} รอตรวจสอบ`, `${needReview} need review`)}
              >
                {needReview}
              </span>
            )}
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
        {/* Left: brief + rubric */}
        <div className="flex flex-col gap-5 min-w-0">
          <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-5" aria-labelledby="brief-heading">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h2 id="brief-heading" className="text-base font-bold text-[var(--text-primary)]">{t("คำอธิบายงาน", "Assignment brief")}</h2>
              <Link href={editHref} className="text-[var(--accent)] text-sm hover:underline shrink-0">{t("แก้ไข", "Edit")}</Link>
            </div>
            {assignment.description ? (
              <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-line">{assignment.description}</p>
            ) : (
              <p className="text-sm text-[var(--text-muted)] italic">{t("ยังไม่มีคำอธิบาย", "No description yet")}</p>
            )}
            <AttachmentList attachments={assignment.attachments} />
          </section>

          <section className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)]" aria-labelledby="rubric-heading">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-[var(--border-subtle)]">
              <div>
                <h2 id="rubric-heading" className="text-base font-bold text-[var(--text-primary)]">{t("เกณฑ์การให้คะแนน", "Rubric")}</h2>
                {!assignment.isExam && rubric && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {rubric.criteria.length} {t("เกณฑ์", "criteria")} · {assignment.maxPoints} {t("คะแนน", "pts")}
                  </p>
                )}
              </div>
              {!assignment.isExam && (
                <Link href={editHref} className="text-sm font-medium text-[var(--accent)] hover:underline shrink-0">
                  {rubric ? t("แก้ไข Rubric", "Edit Rubric") : t("เพิ่ม Rubric", "Add Rubric")}
                </Link>
              )}
            </div>
            {assignment.isExam ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-[var(--text-secondary)]">{t("งานประเภทสอบ", "Exam Assignment")}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t("ให้คะแนนเต็มโดยตรง ไม่ใช้ rubric", "Graded on a manually set max score — no rubric is used")}</p>
              </div>
            ) : rubric && rubric.criteria.length > 0 ? (
              <div className="p-5">
                {/* Same card-per-criterion layout as the student's read-only rubric view
                    (student/courses/[secId]/classwork/[actId]/page.tsx) — asked for 23/9/2569 so
                    teachers see the rubric the way students do, level descriptions included, not just
                    a compact weight/level-count table. */}
                <div className="flex flex-col gap-3">
                  {rubric.criteria.map((c) => (
                    <div key={c.id} className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                        <span className="shrink-0 text-xs font-semibold text-[var(--accent)] tabular-nums">
                          {c.weight}% · {c.maxPoints} {t("คะแนน", "pts")}
                        </span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-[var(--text-muted)] mb-2">{c.description}</p>
                      )}
                      {c.levels.length > 0 && (
                        <div className="grid gap-2 mt-2 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                          {c.levels.map((lvl, i) => (
                            <div key={i} className="rounded-lg bg-[var(--bg-app)] p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">{lvl.label}</p>
                              {lvl.description && (
                                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{lvl.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Teacher-only: the weight-total sanity check students don't need to see. */}
                <p className={`mt-3 text-xs font-semibold uppercase tracking-wider text-right ${totalWeight === 100 ? "text-[var(--s-ok-text)]" : "text-[var(--s-warn-text)]"}`}>
                  {t("รวม", "Total")} {totalWeight}%
                </p>
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm font-medium text-[var(--s-warn-text)]">{t("ยังไม่มี Rubric", "No rubric yet")}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{t("งานที่ไม่มี rubric จะให้ AI ตรวจไม่ได้", "Without a rubric the AI has nothing to grade against")}</p>
              </div>
            )}
          </section>
        </div>

        {/* Right: details */}
        <aside className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-5" aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-base font-bold text-[var(--text-primary)] mb-3">{t("รายละเอียด", "Details")}</h2>
          <dl className="flex flex-col">
            {detailRows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0 text-sm">
                <dt className="text-[var(--text-secondary)] shrink-0">{r.label}</dt>
                <dd className="text-[var(--text-primary)] text-right min-w-0">{r.value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </main>
  );
}
