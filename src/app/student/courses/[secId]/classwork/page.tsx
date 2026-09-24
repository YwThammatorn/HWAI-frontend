"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment, Submission } from "@/lib/assignments";
import { useGradingCategories, GradingCategory } from "@/lib/gradingCategories";
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
  // An Exam is never submitted: it's either scored or still waiting for the teacher (25/9/2569).
  if (assignment.isExam) return submission?.status === "graded" ? "graded" : "awaiting_score";
  if (!submission) {
    const due = new Date((assignment.dueDate ?? "") + "T23:59:59");
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
  const due = assignment.dueDate ? new Date(assignment.dueDate + "T23:59:59") : null;
  const hoursLeft = due ? (due.getTime() - Date.now()) / 3_600_000 : Infinity;
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
            {due ? (
              <>
                {t("กำหนดส่ง:", "Due:")} {" "}
                <span className={isUrgent ? "font-semibold text-[var(--s-err-text)]" : ""}>
                  {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
              </>
            ) : t("สอบ · ไม่ต้องส่งงาน", "Exam · nothing to submit")}
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

// ── Grading categories (read-only, mirrors the teacher course page) ────────

function GradingCategoriesCard({ categories, totalWeight }: { categories: GradingCategory[]; totalWeight: number }) {
  const { t } = useLanguage();
  const COLS = "1fr 96px";
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
      <h2 className="text-base font-bold text-[var(--text-primary)] mb-5">{t("สัดส่วนคะแนน", "Grading Categories")}</h2>
      <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
        {/* --bg-subtle is reserved for row hover, never a static header fill (DESIGN.md §9b). */}
        <div className="grid border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]" style={{ gridTemplateColumns: COLS }}>
          <div className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("หัวข้อ", "Category")}</div>
          <div className="px-3 py-2.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("น้ำหนัก (%)", "Weight (%)")}</div>
        </div>
        {categories.map((cat, idx) => (
          <div
            key={cat.id}
            className={`grid items-center py-2.5 ${idx === categories.length - 1 ? "" : "border-b border-[var(--border-subtle)]"}`}
            style={{ gridTemplateColumns: COLS }}
          >
            <div className="px-3 text-sm text-[var(--text-primary)]">{cat.name}</div>
            <div className="px-3 text-sm font-semibold text-[var(--accent)] tabular-nums">{cat.weight}%</div>
          </div>
        ))}
      </div>
      <p className="text-xs font-medium mt-4 text-[var(--text-muted)]">
        {t(`รวม ${totalWeight}%`, `Total: ${totalWeight}%`)}
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function StudentClassworkPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
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
  const { dueSoon, notSubmitted, awaiting, submitted } = useMemo(() => {
    const dueSoon: Assignment[] = [];
    const notSubmitted: Assignment[] = [];
    const awaiting: Assignment[] = [];
    const submitted: Assignment[] = [];
    assignments.forEach((a) => {
      if (a.isExam) {
        (mySubmissions.get(a.id)?.status === "graded" ? submitted : awaiting).push(a);
        return;
      }
      if (mySubmissions.has(a.id)) {
        submitted.push(a);
        return;
      }
      const daysUntilDue = (new Date((a.dueDate ?? "") + "T23:59:59").getTime() - now) / (24 * 3_600_000);
      (daysUntilDue <= DUE_SOON_DAYS ? dueSoon : notSubmitted).push(a);
    });
    dueSoon.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    notSubmitted.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    submitted.sort((a, b) => (mySubmissions.get(b.id)?.submittedAt ?? "").localeCompare(mySubmissions.get(a.id)?.submittedAt ?? ""));
    return { dueSoon, notSubmitted, awaiting, submitted };
  }, [assignments, mySubmissions, now]);

  const categories = useMemo(() => (course ? getCategoriesByCourse(secId) : []), [course, secId, getCategoriesByCourse]);
  const totalWeight = categories.reduce((sum, c) => sum + c.weight, 0);

  if (!course) {
    return (
      <div className="p-6 text-sm text-[var(--text-muted)]">{t("ไม่พบรายวิชา", "Course not found")}</div>
    );
  }

  return (
    <div className="w-full px-8 py-8">
        {/* Course banner — same look as the teacher course page: solid cover colour, no card/button feel */}
        <div className="relative h-36 rounded-2xl mb-6 overflow-hidden" style={{ background: course.coverColor }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-4 left-5 right-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{course.name}</h1>
              <p className="text-white/80 text-xs mt-0.5 max-w-md truncate">
                {course.description || t(`${assignments.length} งานทั้งหมด`, `${assignments.length} assignment(s) total`)}
              </p>
            </div>
          </div>
        </div>

        {/* Two columns on wide screens: work on the left, grading categories (สัดส่วนคะแนน) on the right.
            Below xl everything stacks: work first, categories after. */}
        <div className={`grid grid-cols-1 gap-6 items-start ${categories.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="min-w-0">
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

            {/* Exams: nothing to submit, waiting for the teacher's score */}
            {awaiting.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  {t(`รอคะแนนสอบ (${awaiting.length})`, `Awaiting score (${awaiting.length})`)}
                </h2>
                <div className="flex flex-col gap-3">
                  {awaiting.map((a) => (
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

        {categories.length > 0 && (
          <aside aria-label={t("สัดส่วนคะแนน", "Grading Categories")} className="xl:sticky xl:top-6">
            <GradingCategoriesCard categories={categories} totalWeight={totalWeight} />
          </aside>
        )}
        </div>
    </div>
  );
}
