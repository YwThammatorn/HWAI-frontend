"use client";

import { useLanguage } from "@/context/LanguageContext";

/** What a student's own assignment is doing right now. Colours live in globals.css (--st-*). */
export type AssignmentStatus = "not_submitted" | "submitted" | "graded" | "overdue";

// Full class strings (not built dynamically) so Tailwind can see them.
export const STATUS_STYLE: Record<AssignmentStatus, { chip: string; panel: string }> = {
  not_submitted: {
    chip: "bg-[var(--st-todo-bg)] text-[var(--st-todo-text)]",
    panel: "bg-[var(--st-todo-bg)] text-[var(--st-todo-text)] border-[var(--st-todo-text)]/30",
  },
  submitted: {
    chip: "bg-[var(--st-sent-bg)] text-[var(--st-sent-text)]",
    panel: "bg-[var(--st-sent-bg)] text-[var(--st-sent-text)] border-[var(--st-sent-text)]/25",
  },
  graded: {
    chip: "bg-[var(--st-graded-bg)] text-[var(--st-graded-text)]",
    panel: "bg-[var(--st-graded-bg)] text-[var(--st-graded-text)] border-[var(--st-graded-text)]/25",
  },
  overdue: {
    chip: "bg-[var(--st-overdue-bg)] text-[var(--st-overdue-text)]",
    panel: "bg-[var(--st-overdue-bg)] text-[var(--st-overdue-text)] border-[var(--st-overdue-text)]/30",
  },
};

export function useStatusLabel() {
  const { t } = useLanguage();
  return (s: AssignmentStatus) => {
    switch (s) {
      case "not_submitted": return t("ยังไม่ส่ง", "Not submitted");
      case "submitted": return t("ส่งแล้ว", "Submitted");
      case "graded": return t("มีคะแนนแล้ว", "Graded");
      case "overdue": return t("เกินกำหนด", "Overdue");
    }
  };
}

/** Pill with a leading status dot (the dot inherits the text colour). */
export default function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const label = useStatusLabel()(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLE[status].chip}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
