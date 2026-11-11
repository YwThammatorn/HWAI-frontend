"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment, Submission, studentVisibleSubmission, finalScoreOf, dueAt, DUE_SOON_DAYS, URGENT_HOURS } from "@/lib/assignments";
import { useGradingCategories, GradingCategory } from "@/lib/gradingCategories";
import AssignmentStatusBadge, { AssignmentStatus } from "@/components/AssignmentStatusBadge";
import AssignmentTypeBadge from "@/components/AssignmentTypeBadge";
import { CourseIcon } from "@/components/CourseIcon";
import CollapsibleSection from "@/components/CollapsibleSection";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
// The groups of the list, most urgent first. Only the ones that need the student stay open at first (14/10/2569); what they open or
// close is remembered per course in this browser.
type GroupKey = "overdue" | "dueSoon" | "notSubmitted" | "awaiting" | "submitted";
const OPEN_BY_DEFAULT: Record<GroupKey, boolean> = { overdue: true, dueSoon: true, notSubmitted: true, awaiting: false, submitted: false };
const OPEN_KEY = "hwai_classwork_open_v1";


// ── Status helper ──────────────────────────────────────────────────────────

function getWorkStatus(
  assignment: Assignment,
  submission: Submission | undefined
): AssignmentStatus {
  // An Exam is never submitted: it's either scored or still waiting for the teacher (25/9/2569).
  if (assignment.isExam) return submission?.status === "graded" ? "graded" : "awaiting_score";
  if (!submission) {
    const due = dueAt(assignment);
    return due && new Date() > due ? "overdue" : "not_submitted";
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
  const { t, lang } = useLanguage();
  const status = getWorkStatus(assignment, submission);
  const due = dueAt(assignment);
  const hoursLeft = due ? (due.getTime() - Date.now()) / 3_600_000 : Infinity;
  const isUrgent = hoursLeft > 0 && hoursLeft < URGENT_HOURS;

  const score = submission ? finalScoreOf(assignment, submission) : null;

  return (
    <Link
      href={`/student/courses/${courseId}/classwork/${assignment.id}`}
      className="flex items-center gap-4 p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:shadow-sm hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
    >
      {/* Left icon */}
      <IconTile icon="file-text" size="md" tone="accent" />

      {/* Middle */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{assignment.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-[var(--text-muted)]">
            {due ? (
              <>
                {t("กำหนดส่ง:", "Due:")} {" "}
                <span className={isUrgent ? "font-semibold text-[var(--s-err-text)]" : ""}>
                  {due.toLocaleDateString(dateLocale(lang), { day: "numeric", month: "short" })}
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
      if (sub) map.set(a.id, studentVisibleSubmission(a, sub));
    });
    return map;
  }, [assignments, getSubmissionsByAssignment, studentId]);

  // Which groups the student has opened / closed themselves. Read after mount (never during render), so server and browser agree first.
  const [openMap, setOpenMap] = useState<Partial<Record<GroupKey, boolean>>>({});
  useEffect(() => {
    try { setOpenMap((JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, Partial<Record<GroupKey, boolean>>>)[secId] ?? {}); } catch { /* no storage: the defaults stand */ }
  }, [secId]);
  const isOpen = (g: GroupKey) => openMap[g] ?? OPEN_BY_DEFAULT[g];
  const toggle = (g: GroupKey) => {
    const next = { ...openMap, [g]: !isOpen(g) };
    setOpenMap(next);
    try {
      const all = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}") as Record<string, unknown>;
      localStorage.setItem(OPEN_KEY, JSON.stringify({ ...all, [secId]: next }));
    } catch { /* not remembered, still works for this visit */ }
  };

  // Grouped by urgency, top to bottom: overdue → due soon → not submitted → awaiting a score → submitted.
  const now = new Date().getTime();
  const { overdue, dueSoon, notSubmitted, awaiting, submitted } = useMemo(() => {
    const overdue: Assignment[] = [];
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
      const daysUntilDue = ((dueAt(a)?.getTime() ?? NaN) - now) / (24 * 3_600_000);
      (daysUntilDue < 0 ? overdue : daysUntilDue <= DUE_SOON_DAYS ? dueSoon : notSubmitted).push(a);
    });
    overdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    dueSoon.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    notSubmitted.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
    submitted.sort((a, b) => (mySubmissions.get(b.id)?.submittedAt ?? "").localeCompare(mySubmissions.get(a.id)?.submittedAt ?? ""));
    return { overdue, dueSoon, notSubmitted, awaiting, submitted };
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
            <IconTile course={course.icon} size="md" tone="onDark" />
            <div className="min-w-0">
              {course.code && <p className="text-white/80 text-xs font-semibold tracking-wide tabular-nums truncate">{course.code}</p>}
              <h1 className="text-xl font-bold text-white truncate">{course.name}</h1>
            </div>
          </div>
        </div>

        {/* Description — its own card, separate from the banner (30/9/2569); read-only for students */}
        {course.description && (
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm p-6 mb-6">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-2">{t("คำอธิบายรายวิชา", "Description")}</h2>
            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{course.description}</p>
          </div>
        )}

        {/* Two columns on wide screens: work on the left, grading categories (สัดส่วนคะแนน) on the right.
            Below xl everything stacks: work first, categories after. */}
        <div className={`grid grid-cols-1 gap-6 items-start ${categories.length > 0 ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="min-w-0">
        {assignments.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <IconTile icon="file" size="lg" shape="round" tone="accent" className="mb-3" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีงาน", "No assignments yet")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {overdue.length > 0 && (
              <CollapsibleSection testId="group-overdue" title={t("เลยกำหนด", "Overdue")} count={overdue.length} open={isOpen("overdue")} onToggle={() => toggle("overdue")} toneClass="text-[var(--s-err-text)]">
              {overdue.map((a) => (
                <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
              ))}
              </CollapsibleSection>
            )}

            {dueSoon.length > 0 && (
              <CollapsibleSection testId="group-dueSoon" title={t("ใกล้ส่ง", "Due soon")} count={dueSoon.length} open={isOpen("dueSoon")} onToggle={() => toggle("dueSoon")} toneClass="text-[var(--s-warn-text)]">
              {dueSoon.map((a) => (
                <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
              ))}
              </CollapsibleSection>
            )}

            {notSubmitted.length > 0 && (
              <CollapsibleSection testId="group-notSubmitted" title={t("ยังไม่ส่ง", "Not submitted")} count={notSubmitted.length} open={isOpen("notSubmitted")} onToggle={() => toggle("notSubmitted")}>
              {notSubmitted.map((a) => (
                <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
              ))}
              </CollapsibleSection>
            )}

            {/* Exams: nothing to submit, waiting for the teacher's score */}
            {awaiting.length > 0 && (
              <CollapsibleSection testId="group-awaiting" title={t("รอคะแนนสอบ", "Awaiting score")} count={awaiting.length} open={isOpen("awaiting")} onToggle={() => toggle("awaiting")}>
              {awaiting.map((a) => (
                <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
              ))}
              </CollapsibleSection>
            )}

            {/* Submitted (or graded) — most recently submitted first */}
            {submitted.length > 0 && (
              <CollapsibleSection testId="group-submitted" title={t("ส่งแล้ว", "Submitted")} count={submitted.length} open={isOpen("submitted")} onToggle={() => toggle("submitted")}>
              {submitted.map((a) => (
                <ClassworkCard key={a.id} assignment={a} submission={mySubmissions.get(a.id)} courseId={secId} />
              ))}
              </CollapsibleSection>
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
