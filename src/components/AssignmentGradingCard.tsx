"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import GradingProgressBar from "@/components/GradingProgressBar";

/**
 * One assignment on the course Grading page, as a stat card (9/11/2569, replaces the list row): what it is (the name,
 * due date and chips), how far grading is (three small numbers over their captions — the same pattern as the Score card — plus "n / N submitted",
 * the average and the segmented bar) and the actions for its state at the bottom.
 *
 * Only the buttons at the bottom are pressable (10/11/2569): the card itself is not a link, so nobody lands inside an assignment by clicking its
 * body and skips the step the buttons stand for (choose how to grade → preview → grade). The name is plain text.
 *
 * (A score chart, "needs a second look" chips and the lowest-scoring criteria were tried on this card on 10/11 and taken off again at the user's
 * request — they live on the assignment's own Grading page.)
 */
export default function AssignmentGradingCard({ name, meta, total, enrolled, isExam, graded, needReview, notGraded, avgPct, actions }: {
  name: string;
  /** due date, Overdue, type and category chips */
  meta: ReactNode;
  /** how many submissions (or scored students for an exam) there are */
  total: number;
  enrolled: number;
  isExam: boolean;
  graded: number;
  needReview: number;
  notGraded: number;
  avgPct: number | null;
  /** the buttons / the locked or waiting note for this assignment's state */
  actions: ReactNode;
}) {
  const { t } = useLanguage();
  const blocks: { label: string; value: number; tone: string }[] = [
    { label: t("ตรวจแล้ว", "Graded"), value: graded, tone: "text-[var(--s-ok-text)]" },
    { label: t("รอตรวจสอบ", "Needs review"), value: needReview, tone: "text-[var(--s-warn-text)]" },
    { label: t("ยังไม่ตรวจ", "Not graded"), value: notGraded, tone: "text-[var(--text-secondary)]" },
  ];

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
      {/* What it is */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-base font-semibold text-[var(--text-primary)]">{name}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">{meta}</div>
      </div>

      {/* How far grading is: three numbers over their captions */}
      <dl className="grid grid-cols-3">
        {blocks.map((b, i) => (
          <div key={b.label} className={`flex flex-col-reverse ${i === 0 ? "pr-3" : "border-l border-[var(--border-subtle)] px-3"}`}>
            <dt className="text-xs font-medium text-[var(--text-muted)]">{b.label}</dt>
            <dd className={`text-2xl font-bold tabular-nums ${b.tone}`}>{b.value}</dd>
          </div>
        ))}
      </dl>

      {/* Submitted · average · the segmented bar */}
      <div className="min-w-0">
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-[var(--text-secondary)]">
          <span className="tabular-nums">
            <span className="font-semibold text-[var(--text-primary)]">{total}</span> / {enrolled} {isExam ? t("ให้คะแนนแล้ว", "scored") : t("ส่งแล้ว", "submitted")}
          </span>
          {avgPct !== null && (
            <span className="tabular-nums">{t("เฉลี่ย", "Avg")} <span className="font-semibold text-[var(--text-primary)]">{avgPct}%</span></span>
          )}
        </div>
        <GradingProgressBar total={total} graded={graded} needReview={needReview} notGraded={notGraded} />
        <p className="mt-1.5 text-xs tabular-nums text-[var(--text-muted)]">
          {total === 0
            ? t("ยังไม่มีการส่งงาน", "No submissions yet")
            : <span className="sr-only">{t(`ตรวจแล้ว ${graded} · รอตรวจสอบ ${needReview} · ยังไม่ตรวจ ${notGraded}`, `Graded ${graded} · Needs review ${needReview} · Not graded ${notGraded}`)}</span>}
        </p>
      </div>

      {/* Actions — the only pressable part of the card */}
      <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
    </li>
  );
}
