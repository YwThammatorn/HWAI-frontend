"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, Assignment } from "@/lib/assignments";
import { useGradingCategories, GradingCategory } from "@/lib/gradingCategories";
import EmptyState from "@/components/EmptyState";

interface CategoryRow {
  category: GradingCategory;
  assignments: Assignment[];
  gradedCount: number;
  earnedPoints: number;
  possiblePoints: number;
  percent: number | null;
  contribution: number | null;
}

export default function StudentEvaluationPage() {
  const { secId } = useParams<{ secId: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, submissions } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();

  const course = getCourse(secId);
  const studentId = user?.studentId ?? user?.email ?? "";
  const assignments = useMemo(() => (course ? getAssignmentsByCourse(secId) : []), [course, secId, getAssignmentsByCourse]);
  const categories = useMemo(() => (course ? getCategoriesByCourse(secId) : []), [course, secId, getCategoriesByCourse]);

  const myScoreFor = (assignmentId: string): number | null => {
    const sub = submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
    if (!sub || sub.status !== "graded") return null;
    return sub.instructorScore ?? sub.aiScore ?? 0;
  };

  const categoryRows: CategoryRow[] = useMemo(() => categories.map((category) => {
    const catAssignments = assignments.filter((a) => a.categoryId === category.id);
    let earnedPoints = 0, possiblePoints = 0, gradedCount = 0;
    catAssignments.forEach((a) => {
      const score = myScoreFor(a.id);
      if (score !== null) {
        earnedPoints += score;
        possiblePoints += a.maxPoints;
        gradedCount++;
      }
    });
    const percent = gradedCount > 0 && possiblePoints > 0 ? (earnedPoints / possiblePoints) * 100 : null;
    const contribution = percent !== null ? (percent / 100) * category.weight : null;
    return { category, assignments: catAssignments, gradedCount, earnedPoints, possiblePoints, percent, contribution };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [categories, assignments, submissions, studentId]);

  const uncategorized = assignments.filter((a) => !a.categoryId || !categories.some((c) => c.id === a.categoryId));
  const gradedCategoryRows = categoryRows.filter((r) => r.percent !== null);
  const totalSoFar = gradedCategoryRows.reduce((sum, r) => sum + (r.contribution ?? 0), 0);
  const hasAnyGradedWork = assignments.some((a) => myScoreFor(a.id) !== null);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-6">{t("ผลการประเมิน", "Evaluation")}</h1>

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
      ) : categories.length === 0 ? (
        // Graded work exists, but the instructor hasn't set up weighted grade
        // categories for this course — fall back to a flat per-assignment list
        // rather than pretending there's a weighted total to show.
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[var(--text-muted)]">
            {t(
              "อาจารย์ยังไม่ได้ตั้งค่าหมวดคะแนนสำหรับวิชานี้ — นี่คือคะแนนที่ตรวจแล้วทั้งหมด",
              "Your instructor hasn't set up grade categories for this course yet — here are your graded scores so far"
            )}
          </p>
          {assignments.filter((a) => myScoreFor(a.id) !== null).map((a) => (
            <div key={a.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--text-primary)] truncate">{a.name}</span>
              <span className="text-sm font-bold text-[var(--accent)] tabular-nums shrink-0">{myScoreFor(a.id)}/{a.maxPoints}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                {t("คะแนนรวมเท่าที่ตรวจแล้ว", "Total so far")}
              </p>
              <p className="text-3xl font-bold text-[var(--text-primary)] tabular-nums">
                {gradedCategoryRows.length > 0 ? `${totalSoFar.toFixed(1)}%` : "—"}
              </p>
            </div>
            <p className="text-xs text-[var(--text-muted)] text-right max-w-[200px]">
              {t(
                `นับจาก ${gradedCategoryRows.length}/${categories.length} หมวดที่มีคะแนนแล้ว`,
                `Based on ${gradedCategoryRows.length}/${categories.length} categories graded so far`
              )}
            </p>
          </div>

          {/* Per-category breakdown */}
          <div className="flex flex-col gap-3">
            {categoryRows.map((row) => (
              <div key={row.category.id} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--text-primary)] truncate">{row.category.name}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {t(`น้ำหนัก ${row.category.weight}% ของเกรด`, `${row.category.weight}% of final grade`)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {row.percent !== null ? (
                      <>
                        <p className="text-lg font-bold text-[var(--accent)] tabular-nums">{row.percent.toFixed(0)}%</p>
                        <p className="text-[11px] text-[var(--text-muted)] tabular-nums">{row.earnedPoints}/{row.possiblePoints} {t("คะแนน", "pts")}</p>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีคะแนน", "Not graded yet")}</p>
                    )}
                  </div>
                </div>
                {row.assignments.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {row.assignments.map((a) => {
                      const score = myScoreFor(a.id);
                      return (
                        <div key={a.id} className="flex items-center justify-between gap-3 text-xs py-1.5 px-3 rounded-lg bg-[var(--bg-subtle)]">
                          <span className="text-[var(--text-secondary)] truncate">{a.name}</span>
                          <span className="tabular-nums font-medium text-[var(--text-primary)] shrink-0">
                            {score !== null ? `${score}/${a.maxPoints}` : t("รอตรวจ", "Pending")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)] italic">{t("ยังไม่มีงานในหมวดนี้", "No assignments in this category yet")}</p>
                )}
              </div>
            ))}

            {uncategorized.length > 0 && (
              <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5">
                <p className="text-sm font-bold text-[var(--text-primary)] mb-1">{t("ยังไม่ระบุหมวด", "Uncategorized")}</p>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  {t(
                    "งานเหล่านี้ยังไม่ถูกกำหนดหมวดคะแนน จึงไม่รวมในคะแนนรวมด้านบน",
                    "These assignments aren't assigned to a weighted category yet, so they're excluded from the total above"
                  )}
                </p>
                <div className="flex flex-col gap-1.5">
                  {uncategorized.map((a) => {
                    const score = myScoreFor(a.id);
                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 text-xs py-1.5 px-3 rounded-lg bg-[var(--bg-subtle)]">
                        <span className="text-[var(--text-secondary)] truncate">{a.name}</span>
                        <span className="tabular-nums font-medium text-[var(--text-primary)] shrink-0">
                          {score !== null ? `${score}/${a.maxPoints}` : t("รอตรวจ", "Pending")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
