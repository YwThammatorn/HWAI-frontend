"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useNow } from "@/lib/clock";
import { gradingStageOf } from "@/lib/gradingStage";
import { queueFigures } from "@/lib/taWork";
import type { Assignment, Submission } from "@/lib/assignments";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import GradingStageChip from "@/components/GradingStageChip";
import Icon from "@/components/Icon";

/**
 * A TA's home in a course (10/11/2569, advisor R28): not the teacher's dashboard but their own queue — the pieces of work waiting for them and the
 * ones they have graded, among the assignments a teacher gave them, and one button to the next piece. `assignments` is already only theirs
 * (lib/useGradableAssignments.ts); `subsOf` returns an assignment's submissions with withdrawn students left out.
 */
export default function TaQueuePanel({ courseId, assignments, subsOf, enrolled }: {
  courseId: string;
  assignments: Assignment[];
  subsOf: (assignmentId: string) => Submission[];
  /** students on the roster (withdrawn left out), for the stage of an exam */
  enrolled: number;
}) {
  const { t } = useLanguage();
  const now = useNow();
  const q = queueFigures(assignments, subsOf);
  const rows = [...assignments].sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).map((a) => {
    const subs = subsOf(a.id);
    return { a, f: queueFigures([a], subsOf), stage: gradingStageOf(a, subs, enrolled, now) };
  });
  const next = rows.find((r) => r.f.waiting > 0);

  if (assignments.length === 0) {
    return (
      <div data-testid="ta-queue-empty">
        <EmptyState
          icon="clipboard-list"
          title={t("ยังไม่ได้รับมอบหมายงาน", "No work assigned to you yet")}
          description={t("อาจารย์จะมอบหมายงานที่คุณต้องตรวจให้ — คิวของคุณจะขึ้นที่นี่", "Your teacher assigns the work you grade — your queue will appear here")}
        />
      </div>
    );
  }

  return (
    <div data-testid="ta-queue" className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t("รอตรวจ", "Waiting to grade")} value={q.waiting} tone="warn" icon="clock" />
        <StatCard label={t("ตรวจแล้ว", "Graded")} value={q.graded} tone="ok" icon="check-circle" />
        <StatCard label={t("งานที่ได้รับมอบหมาย", "Assigned work")} value={q.assignments} tone="ta" icon="file-text" />
      </div>

      <section aria-labelledby="ta-queue-h" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 id="ta-queue-h" className="text-base font-bold text-[var(--text-primary)]">{t("คิวของฉัน", "My queue")}</h2>
            <p className="text-sm text-[var(--text-muted)]">{t("งานที่อาจารย์มอบหมายให้คุณตรวจ", "The assignments your teacher gave you to grade")}</p>
          </div>
          {next && (
            <Link
              data-testid="grade-next-ta"
              href={`/teacher/courses/${courseId}/assignments/${next.a.id}/grading`}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-solid)] px-4 text-sm font-semibold text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              <Icon name="arrow-right" />
              {t("ตรวจงานถัดไป", "Grade next")}
            </Link>
          )}
        </div>
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map(({ a, f, stage }) => (
            <li key={a.id} data-testid={`ta-queue-row-${a.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3.5">
              <Link href={`/teacher/courses/${courseId}/assignments/${a.id}/grading`} className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors">{a.name}</Link>
              <GradingStageChip stage={stage} />
              <span className="w-24 text-right text-sm tabular-nums text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{f.waiting}</span> {t("รอตรวจ", "waiting")}</span>
              <span className="w-24 text-right text-sm tabular-nums text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{f.graded}</span> {t("ตรวจแล้ว", "graded")}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
