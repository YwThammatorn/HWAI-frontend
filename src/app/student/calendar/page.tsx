"use client";

import { useLanguage } from "@/context/LanguageContext";

export default function StudentCalendarPage() {
  const { t } = useLanguage();

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("ปฏิทิน", "Calendar")}</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{t("กำหนดส่งงานและกิจกรรมในชั้นเรียน", "Assignment deadlines and class activities")}</p>

      <div className="mt-8 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-10 flex flex-col items-center justify-center text-center gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-[var(--text-muted)]" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p className="text-sm font-medium text-[var(--text-secondary)]">{t("ฟีเจอร์นี้จะมาเร็วๆ นี้", "This feature is coming soon")}</p>
        <p className="text-xs text-[var(--text-muted)]">{t("ปฏิทินจะแสดงวันส่งงานทุกรายวิชาในที่เดียว", "Calendar will show all assignment due dates in one place")}</p>
      </div>
    </div>
  );
}
