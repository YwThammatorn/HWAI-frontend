"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, type Assignment } from "@/lib/assignments";
import { useGradingCategories, computeCategoryGradeRows, computeTotalSoFar, type CategoryGradeRow } from "@/lib/gradingCategories";
import { buildScoreBook, gradeLetter, toneForPct, SCORE_TONE_CLASSES, PENDING_CHIP_CLASSES, MISSING_CHIP_CLASSES, type ScoreCell } from "@/lib/scoreBook";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import RubricBreakdownModal from "@/components/RubricBreakdownModal";

// Adapted from the teacher Score Book (src/app/teacher/courses/[id]/results/page.tsx) — same cell
// states/tones/legend/rubric-breakdown, transposed to a single row (rows = assignments instead of
// columns, since there's only one student here). See DESIGN.md §9b. `computeCategoryGradeRows` /
// `computeTotalSoFar` stay the source of the category and total numbers (unchanged from before this
// redesign — the "Total so far" block below is untouched markup, still what the teacher's Score Book
// cross-checks against); `buildScoreBook` is only used here for its per-assignment cell states
// (graded/pending/missing/none) and category grouping, called with a single-element `students` array.

const chip = "inline-flex items-center justify-center gap-1 min-w-[3.5rem] h-8 px-2 rounded-lg text-sm font-semibold tabular-nums whitespace-nowrap";

export default function StudentEvaluationPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment, getRubricsByAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  // Which assignment's rubric breakdown popup is open (null = closed).
  const [breakdown, setBreakdown] = useState<Assignment | null>(null);

  const course = getCourse(secId);
  const studentId = user?.studentId ?? user?.email ?? "";
  const assignments = useMemo(() => (course ? getAssignmentsByCourse(secId) : []), [course, secId, getAssignmentsByCourse]);
  const categories = useMemo(() => (course ? getCategoriesByCourse(secId) : []), [course, secId, getCategoriesByCourse]);
  const today = new Date().toISOString().split("T")[0];

  const allSubmissions = useMemo(() => assignments.flatMap((a) => getSubmissionsByAssignment(a.id)), [assignments, getSubmissionsByAssignment]);
  const submissionsById = useMemo(() => new Map(allSubmissions.map((s) => [s.id, s])), [allSubmissions]);
  const rubricsByAssignment = useMemo(() => new Map(assignments.map((a) => [a.id, getRubricsByAssignment(a.id)[0]])), [assignments, getRubricsByAssignment]);

  const categoryRows: CategoryGradeRow[] = useMemo(
    () => computeCategoryGradeRows(categories, assignments, allSubmissions, studentId),
    [categories, assignments, allSubmissions, studentId]
  );
  const categoryRowById = new Map(categoryRows.map((r) => [r.category.id, r]));

  const gradedCategoryRows = categoryRows.filter((r) => r.percent !== null);
  const totalSoFar = computeTotalSoFar(categoryRows);
  const hasAnyGradedWork = assignments.some((a) => {
    const sub = allSubmissions.find((s) => s.assignmentId === a.id && s.studentId === studentId);
    return sub?.status === "graded";
  });
  const gradedWeight = gradedCategoryRows.reduce((sum, r) => sum + r.category.weight, 0);
  const normalized = gradedWeight > 0 ? (totalSoFar / gradedWeight) * 100 : null;
  const letter = normalized !== null ? gradeLetter(normalized, 100) : null;

  // Per-assignment cell states (graded/pending/missing/none) + category grouping, reusing the exact
  // same logic the teacher's matrix uses — just for a single student.
  const book = buildScoreBook({
    students: [{ studentId, firstName: "", lastName: "" }],
    assignments,
    categories,
    submissions: allSubmissions,
    today,
  });
  const myRow = book.rows[0];
  const gradedPct = book.totalCells > 0 ? Math.round((book.gradedCells / book.totalCells) * 100) : 0;
  const awaitingCount = book.pendingCells + book.missingCells;
  // Skip the "no category" bucket's own section-header row when it's the only group — that's the
  // flat/uncategorized-course case, where a header with no weight to show would say nothing useful.
  const showGroupHeaders = !(book.groups.length === 1 && book.groups[0].category === null);

  function renderCell(cell: ScoreCell, assignment: Assignment) {
    const rubric = rubricsByAssignment.get(assignment.id);
    const hasRubric = !!rubric && rubric.criteria.length > 0;
    switch (cell.kind) {
      case "graded":
        return (
          <div className="inline-flex items-center gap-1">
            <span className={`${chip} ${SCORE_TONE_CLASSES[toneForPct(cell.pct)]}`}>
              {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)}/{cell.max}
            </span>
            {hasRubric && (
              <button
                type="button"
                onClick={() => setBreakdown(assignment)}
                title={t("ดูคะแนนรายเกณฑ์", "See rubric breakdown")}
                aria-label={t(`ดูคะแนนรายเกณฑ์ — ${assignment.name}`, `See the rubric breakdown for ${assignment.name}`)}
                className="w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            )}
          </div>
        );
      case "pending":
        return (
          <span className={`${chip} ${PENDING_CHIP_CLASSES}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {t("รอตรวจ", "Pending")}
          </span>
        );
      case "missing":
        return (
          <span className={`${chip} ${MISSING_CHIP_CLASSES} font-medium`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {t("ไม่ส่ง", "Missing")}
          </span>
        );
      default:
        return <span className="text-[var(--text-muted)]" title={t("ยังไม่ถึงกำหนดส่ง", "Not due yet")}>—</span>;
    }
  }

  return (
    <div className="w-full px-8 py-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("ผลการประเมิน", "Evaluation")}</h1>
      {course && (
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          {course.name} · {assignments.length} {t("งาน", "assignments")}
        </p>
      )}

      {categories.length === 0 && !hasAnyGradedWork ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          }
          title={t("ยังไม่มีผลการประเมิน", "No evaluation results yet")}
          description={t("ผลการตรวจงานทั้งหมดจะแสดงที่นี่", "All graded assignment results will appear here")}
        />
      ) : (
        <>
          {categories.length === 0 && (
            <p className="text-xs text-[var(--text-muted)] mb-4">
              {t(
                "อาจารย์ยังไม่ได้ตั้งค่าหมวดคะแนนสำหรับวิชานี้ — นี่คือคะแนนที่ตรวจแล้วทั้งหมด",
                "Your instructor hasn't set up grade categories for this course yet — here are your graded scores so far"
              )}
            </p>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <StatCard
              label={t("ตรวจแล้ว", "Graded")} value={gradedPct} suffix="%" color="var(--s-ok-text)" bg="var(--s-ok-bg)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>}
            />
            <StatCard
              label={t("รอตรวจ", "Awaiting grading")} value={awaitingCount} color="var(--s-warn-text)" bg="var(--s-warn-bg)"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 3h14l-2 7H7L5 3z"/><path d="M7 10l-2 11h14L17 10"/></svg>}
            />
          </div>

          {categories.length > 0 && (
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  {t("คะแนนรวมเท่าที่ตรวจแล้ว", "Total so far")}
                </p>
                <p className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                  {gradedCategoryRows.length > 0 ? `${totalSoFar.toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {letter && normalized !== null && (
                  <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2.5 rounded-lg text-sm font-bold ${SCORE_TONE_CLASSES[toneForPct(normalized)]}`}>
                    {letter}
                  </span>
                )}
                <p className="text-xs text-[var(--text-muted)] text-right max-w-[200px]">
                  {t(
                    `นับจาก ${gradedCategoryRows.length}/${categories.length} หมวดที่มีคะแนนแล้ว`,
                    `Based on ${gradedCategoryRows.length}/${categories.length} categories graded so far`
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Legend — same tokens as the cells they explain (DESIGN.md §6/§9b). */}
          <ul className="flex items-center gap-3 text-xs text-[var(--text-secondary)] mb-3 flex-wrap" aria-label={t("คำอธิบายสี", "Legend")}>
            <li className="inline-flex items-center gap-1.5"><span className={`w-4 h-4 rounded ${SCORE_TONE_CLASSES.ok}`} aria-hidden="true" />≥ 80%</li>
            <li className="inline-flex items-center gap-1.5"><span className={`w-4 h-4 rounded ${SCORE_TONE_CLASSES.info}`} aria-hidden="true" />60–79%</li>
            <li className="inline-flex items-center gap-1.5"><span className={`w-4 h-4 rounded ${SCORE_TONE_CLASSES.err}`} aria-hidden="true" />&lt; 60%</li>
            <li className="inline-flex items-center gap-1.5"><span className={`w-4 h-4 rounded ${PENDING_CHIP_CLASSES}`} aria-hidden="true" />{t("รอตรวจ", "Pending")}</li>
            <li className="inline-flex items-center gap-1.5"><span className={`w-4 h-4 rounded ${MISSING_CHIP_CLASSES}`} aria-hidden="true" />{t("ไม่ส่ง", "Missing")}</li>
          </ul>

          {/* Table — one row per assignment, grouped by category (DESIGN.md §9b, scaled down: no
              sticky/matrix machinery needed for a short single-row list). */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    {t("ชิ้นงาน", "Assignment")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
                    {t("คะแนน", "Score")}
                  </th>
                </tr>
              </thead>
              {book.groups.map((g, gi) => {
                const catRow = g.category ? categoryRowById.get(g.category.id) : undefined;
                const isLastGroup = gi === book.groups.length - 1;
                return (
                  <tbody key={g.key}>
                    {showGroupHeaders && (
                      <tr>
                        {/* --bg-subtle is reserved for row hover, never a static fill (DESIGN.md §9b) — the
                            teal `--accent` label read fine on white/--bg-surface (5.48:1) but washed out
                            on --bg-subtle's pale blue (4.58:1, same cool hue family), which is exactly the
                            table header/footer bug from 22/9 repeating itself in new code. Matches the
                            teacher Score Book's own column-group header (`headBase`), which was never
                            tinted either. */}
                        <td colSpan={2} className="px-4 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
                              {g.category ? <><span>{g.category.name}</span> · {g.category.weight}%</> : t("ยังไม่ระบุหมวด", "Uncategorized")}
                            </span>
                            {catRow && catRow.percent !== null ? (
                              <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                                <span className="font-semibold text-[var(--text-primary)]">{catRow.percent.toFixed(0)}%</span>
                                {" "}<span className="text-[var(--text-muted)]">({catRow.earnedPoints}/{catRow.possiblePoints} {t("คะแนน", "pts")})</span>
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">
                                {catRow ? t("ยังไม่มีคะแนน", "Not graded yet") : t("ไม่รวมในคะแนนรวม", "Excluded from the total")}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    {g.columns.map((a, ai) => {
                      const isLastRow = isLastGroup && ai === g.columns.length - 1;
                      return (
                        <tr key={a.id} className="group">
                          <td className={`px-4 py-2.5 ${isLastRow ? "" : "border-b border-[var(--border-subtle)]"}`}>
                            <Link
                              href={`/student/courses/${secId}/classwork/${a.id}`}
                              className="block font-medium text-[var(--text-primary)] hover:text-[var(--accent)] hover:underline truncate max-w-[24rem]"
                            >
                              {a.name}
                            </Link>
                            <span className="block text-xs text-[var(--text-muted)] tabular-nums">
                              {a.dueDate
                                ? `${t("กำหนดส่ง", "Due")} ${new Date(a.dueDate + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}`
                                : t("สอบ", "Exam")}
                            </span>
                          </td>
                          <td className={`px-4 py-2.5 text-right ${isLastRow ? "" : "border-b border-[var(--border-subtle)]"}`}>
                            {renderCell(myRow.cells[a.id], a)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </>
      )}

      {/* Rubric breakdown for one graded assignment — what each criterion earned, not just the total. */}
      {breakdown && (() => {
        const cell = myRow.cells[breakdown.id];
        const rubric = rubricsByAssignment.get(breakdown.id);
        if (cell.kind !== "graded" || !rubric) return null;
        const submission = submissionsById.get(cell.submissionId);
        return (
          <RubricBreakdownModal
            open
            onClose={() => setBreakdown(null)}
            assignmentName={breakdown.name}
            rubric={rubric}
            cell={cell}
            storedCriterionScores={submission?.criterionScores}
          />
        );
      })()}
    </div>
  );
}
