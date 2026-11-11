"use client";

import { useLanguage } from "@/context/LanguageContext";

/**
 * How far grading is, as one segmented bar (10/11/2569): graded (green) · needs review (amber) · not graded (grey). The same picture on a course
 * Grading card and on the assignment's own Grading page — it replaced the page's progress circle, so progress looks the same everywhere. The
 * numbers are in the accessible name and a screen-reader line, the bar itself carries no text.
 */
export default function GradingProgressBar({ total, graded, needReview, notGraded }: { total: number; graded: number; needReview: number; notGraded: number }) {
  const { t } = useLanguage();
  const seg = (n: number) => (total > 0 ? `${(n / total) * 100}%` : "0%");
  return (
    <div
      className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-app)]"
      role="img"
      aria-label={t(`ตรวจแล้ว ${graded}, รอตรวจสอบ ${needReview}, ยังไม่ตรวจ ${notGraded}`, `${graded} graded, ${needReview} need review, ${notGraded} not graded`)}
    >
      <span className="bg-[var(--s-ok-text)]" style={{ width: seg(graded) }} />
      <span className="bg-[var(--s-warn-text)]" style={{ width: seg(needReview) }} />
      <span className="bg-[var(--text-muted)]/40" style={{ width: seg(notGraded) }} />
    </div>
  );
}
