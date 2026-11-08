"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { Rubric } from "@/lib/assignments";
import { PENDING_CHIP_CLASSES } from "@/lib/scoreBook";
import Modal from "./Modal";
import RubricTable from "./RubricTable";

// Shared by the teacher Score Book and the student Evaluation page — what each rubric criterion
// earned toward a graded score, not just the total. Extracted (22/9) so both screens stay identical
// instead of drifting apart; behaviour unchanged from the teacher page's original inline version.

export interface RubricBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  assignmentName: string;
  /** Extra line under the title — the teacher page uses it for "which student"; the student page omits it. */
  subtitle?: string;
  rubric: Rubric;
  cell: { score: number; max: number };
  /** The submission's saved per-criterion scores, if any — falls back to an estimate split by weight. */
  storedCriterionScores: Record<string, number> | undefined;
}

export default function RubricBreakdownModal({
  open, onClose, assignmentName, subtitle, rubric, cell, storedCriterionScores,
}: RubricBreakdownModalProps) {
  const { t } = useLanguage();

  return (
    <Modal open={open} onClose={onClose} title={assignmentName} description={subtitle} size="md">
      {!storedCriterionScores && (
        <p className={`text-xs rounded-lg px-3 py-2 mb-4 leading-relaxed ${PENDING_CHIP_CLASSES}`}>
          {t(
            "ประมาณจากน้ำหนักของเกณฑ์ — งานนี้ยังไม่มีคะแนนรายเกณฑ์ที่บันทึกไว้",
            "Estimated from the criteria weights — this submission has no per-criterion scores saved yet",
          )}
        </p>
      )}
      <RubricTable
        criteria={rubric.criteria}
        columns={["weight", "earned"]}
        earned={Object.fromEntries(rubric.criteria.map((c) => [c.id, storedCriterionScores?.[c.id] ?? Math.round((c.weight / 100) * cell.score)]))}
        footer={{ label: t("รวม", "Total"), value: <>{Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)} / {cell.max}</> }}
      />
    </Modal>
  );
}
