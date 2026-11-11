"use client";

import { useLanguage } from "@/context/LanguageContext";
import { gradingStageLabel, type GradingStage } from "@/lib/gradingStage";
import { submissionClosesAt } from "@/lib/assignments";
import { useNow } from "@/lib/clock";

// The stage of an assignment as a chip (lib/gradingStage.ts). Colours are the status tokens of DESIGN.md §9d: info = still open, warn = the teacher has
// work to do, accent = one click from done, ok = done; nothing is red, because nothing here is an error.
const CLASSES: Record<GradingStage, string> = {
  accepting: "bg-[var(--s-info-bg)] text-[var(--s-info-text)]",
  "no-submissions": "bg-[var(--bg-app)] text-[var(--text-secondary)]",
  "to-grade": "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)]",
  "to-announce": "bg-[var(--accent-subtle)] text-[var(--accent)]",
  announced: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]",
};

export default function GradingStageChip({ stage }: { stage: GradingStage }) {
  const { t } = useLanguage();
  return (
    <span data-testid="grading-stage" data-stage={stage} className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${CLASSES[stage]}`}>
      {gradingStageLabel(stage, t)}
    </span>
  );
}

/** For the planning pages (Assignments list / detail): is the assignment still taking submissions? No grading words there (those pages are planning only). */
export function SubmissionWindowChip({ assignment }: { assignment: Parameters<typeof submissionClosesAt>[0] }) {
  const { t } = useLanguage();
  const now = useNow();
  const closes = submissionClosesAt(assignment);
  if (!closes) return null;                    // an exam has no submission window
  const open = now <= closes.getTime();
  return (
    <span data-testid="submission-window" className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${open ? CLASSES.accepting : CLASSES["no-submissions"]}`}>
      {open ? t("กำลังรับงาน", "Accepting work") : t("ปิดรับงานแล้ว", "Closed")}
    </span>
  );
}
