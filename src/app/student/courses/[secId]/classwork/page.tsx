"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment, Submission } from "@/lib/assignments";
import { useGradingCategories, computeCategoryGradeRows, computeTotalSoFar } from "@/lib/gradingCategories";
import AssignmentStatusBadge, { AssignmentStatus } from "@/components/AssignmentStatusBadge";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";

// An unsubmitted assignment due within this many days (or already overdue)
// is grouped into the "Due soon" section instead of "Not submitted".
const DUE_SOON_DAYS = 3;

// ── Status helper ──────────────────────────────────────────────────────────

function getWorkStatus(
  assignment: Assignment,
  submission: Submission | undefined
): AssignmentStatus {
  if (!submission) {
    const due = new Date(assignment.dueDate + "T23:59:59");
    return new Date() > due ? "overdue" : "not_submitted";
  }
  if (submission.status === "graded") return "graded";
  return "submitted";
}

// ── Assignment card ────────────────────────────────────────────────────────

function ClassworkCard({
  assignment,
  submission,
  courseId,
}: {
  assignment: Assignment;
  submission: Submission | undefined;
  courseId: string;
}) {
  const { t } = useLanguage();
  const status = getWorkStatus(assignment, submission);
  const due = new Date(assignment.dueDate + "T23:59:59");
  const hoursLeft = (due.getTime() - Date.now()) / 3_600_000;
  const isUrgent = hoursLeft > 0 && hoursLeft < 24;

  const score = submission?.instructorScore ?? submission?.aiScore ?? null;

  return (
    <Link
      href={`/student/courses/${courseId}/classwork/${assignment.id}`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:shadow-sm hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
    >
      {/* Left icon */}
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-bright)]/10 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      </div>

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{assignment.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">
            {t("กำหนดส่ง:", "Due:")} {" "}
            <span className={isUrgent ? "font-semibold text-[var(--s-err-text)]" : ""}>
              {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
            </span>
          </span>
          <AssignmentTypeBadge type={assignment.submissionType === "group" ? "group" : "individual"} />
          {isUrgent && (
            <span className="text-[10px] font-bold text-[var(--s-err-text)] bg-[var(--s-err-bg)] px-2 py-0.5 rounded-full">
              {t("ใกล้ครบกำหนด!", "Due soon!")}
            </span>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {score !== null ? (
          <p className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
            {score}<span className="text-xs font-normal text-[var(--text-muted)]">/{assignment.maxPoints}</span>
          </p>
        ) : (
          <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีคะแนน", "No score yet")}</p>
        )}
        <AssignmentStatusBadge status={status} />
      </div>
    </Link>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function StudentClassworkPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment, submissions } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const course = getCourse(secId);
  const assignments = getAssignmentsByCourse(secId);
  const studentId = user?.studentId ?? user?.email ?? "";

  const mySubmissions = useMemo(() => {
    const map = new Map<string, Submission>();
    assignments.forEach((a) => {
      const sub = getSubmissionsByAssignment(a.id).find((s) => s.studentId === studentId);
      if (sub) map.set(a.id, sub);
    });
    return map;
  }, [assignments, getSubmissionsByAssignment, studentId]);

  // Grouped by urgency, top to bottom: due soon (or overdue) → not submitted → submitted.
  const now = new Date().getTime();
  const { dueSoon, notSubmitted, submitted } = useMemo(() => {
    const dueSoon: Assignment[] = [];
    const notSubmitted: Assignment[] = [];
    const submitted: Assignment[] = [];
    assignments.forEach((a) => {
      if (mySubmissions.has(a.id)) {
        submitted.push(a);
        return;
      }
      const daysUntilDue = (new Date(a.dueDate + "T23:59:59").getTime() - now) / (24 * 3_600_000);
      (daysUntilDue <= DUE_SOON_DAYS ? dueSoon : notSubmitted).push(a);
    });
    dueSoon.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    notSubmitted.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    submitted.sort((a, b) => (mySubmissions.get(b.id)?.submittedAt ?? "").localeCompare(mySubmissions.get(a.id)?.submittedAt ?? ""));
    return { dueSoon, notSubmitted, submitted };
  }, [assignments, mySubmissions, now]);

  const categories = useMemo(() => (course ? getCategoriesByCourse(secId) : []), [course, secId, getCategoriesByCourse]);
  const categoryRows = useMemo(
    () => computeCategoryGradeRows(categories, assignments, submissions, studentId),
    [categories, assignments, submissions, studentId]
  );
  const gradedCategoryRows = categoryRows.filter((r) => r.percent !== null);
  const totalSoFar = computeTotalSoFar(categoryRows);

  if (!course) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t("ไม่พบรายวิชา", "Course not found")}</div>
    );
  }

  return (
    <div className="w-full px-8 py-8">
        {/* Course banner */}
        <div
          className="rounded-2xl p-5 mb-6 flex items-center gap-4"
          style={{ background: `linear-gradient(135deg, ${course.coverColor}33, ${course.coverColor}22)`, borderLeft: `4px solid ${course.coverColor}` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ background: course.coverColor }}
            aria-hidden="true"
          >
            {course.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">{course.name}</h1>
            <p className="text-xs text-[var(--text-muted)]">
              {t(`${assignments.length} งานทั้งหมด`, `${assignments.length} assignment(s) total`)}
            </p>
          </div>
        </div>

        {/* Weighted score summary — only once the course has grading categories set up */}
        {categories.length > 0 && (
          <Link
            href={`/student/courses/${secId}/evaluation`}
            className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 mb-6 hover:shadow-sm transition-shadow"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                {t("คะแนนรวมเท่าที่ตรวจแล้ว", "Total so far")}
              </p>
              <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                {gradedCategoryRows.length > 0 ? `${totalSoFar.toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] shrink-0">
              <span>{t(`${gradedCategoryRows.length}/${categories.length} หมวดมีคะแนนแล้ว`, `${gradedCategoryRows.length}/${categories.length} categories graded`)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </Link>
        )}

        {assignments.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-bright)]/10 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีงาน", "No assignments yet")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Due soon (or overdue), not yet submitted — most urgent, shown first */}
            {dueSoon.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--s-err-text)] mb-3">
                  {t(`ใกล้ส่ง (${dueSoon.length})`, `Due soon (${dueSoon.length})`)}
                </h2>
                <div className="flex flex-col gap-3">
                  {dueSoon.map((a) => (
                    <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
                  ))}
                </div>
              </section>
            )}

            {/* Not submitted, due later */}
            {notSubmitted.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  {t(`ยังไม่ส่ง (${notSubmitted.length})`, `Not submitted (${notSubmitted.length})`)}
                </h2>
                <div className="flex flex-col gap-3">
                  {notSubmitted.map((a) => (
                    <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
                  ))}
                </div>
              </section>
            )}

            {/* Submitted (or graded) — most recently submitted first */}
            {submitted.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  {t(`ส่งแล้ว (${submitted.length})`, `Submitted (${submitted.length})`)}
                </h2>
                <div className="flex flex-col gap-3">
                  {submitted.map((a) => (
                    <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
    </div>
  );
}
