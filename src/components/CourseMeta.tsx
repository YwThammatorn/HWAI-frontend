"use client";

import type { ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { splitSchedule } from "@/lib/schedule";

/**
 * The facts under the colour band of a My Courses card (teacher, TA and student share it):
 * row 1 Section · Term · Room, row 2 Day · Time (the schedule split in two, 11/11/2569 — the advisor asked for a box for the day and one for the time).
 * A missing value shows an em dash so every card keeps the same shape. `between` sits between the two rows (the student card puts the teacher's name there).
 */
export default function CourseMeta({ section, term, room, schedule, between }: {
  section?: string; term: string; room?: string; schedule?: string; between?: ReactNode;
}) {
  const { t } = useLanguage();
  const { day, time } = splitSchedule(schedule);
  const Field = ({ label, value }: { label: string; value?: string }) => (
    <div className="min-w-0">
      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-[var(--text-primary)] truncate" title={value || undefined}>{value || "—"}</p>
    </div>
  );
  return (
    <>
      <div className="grid grid-cols-3 gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <Field label={t("กลุ่ม", "Section")} value={section} />
        <Field label={t("ภาคเรียนที่", "Term")} value={term} />
        <Field label={t("ห้องเรียน", "Room")} value={room} />
      </div>
      {between}
      <div className="grid grid-cols-2 gap-3 pt-3">
        <Field label={t("วัน", "Day")} value={day} />
        <Field label={t("เวลา", "Time")} value={time} />
      </div>
    </>
  );
}
