"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { Rubric } from "@/lib/assignments";
import { PENDING_CHIP_CLASSES } from "@/lib/scoreBook";
import Modal from "./Modal";

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
    <Modal open={open} onClose={onClose} title={assignmentName} description={subtitle} size="sm">
      {!storedCriterionScores && (
        <p className={`text-xs rounded-lg px-3 py-2 mb-4 leading-relaxed ${PENDING_CHIP_CLASSES}`}>
          {t(
            "ประมาณจากน้ำหนักของเกณฑ์ — งานนี้ยังไม่มีคะแนนรายเกณฑ์ที่บันทึกไว้",
            "Estimated from the criteria weights — this submission has no per-criterion scores saved yet",
          )}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th scope="col" className="pb-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("เกณฑ์", "Criterion")}</th>
            <th scope="col" className="pb-2 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("น้ำหนัก", "Weight")}</th>
            <th scope="col" className="pb-2 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("คะแนน", "Points")}</th>
          </tr>
        </thead>
        <tbody>
          {rubric.criteria.map((c) => {
            const earned = storedCriterionScores?.[c.id] ?? Math.round((c.weight / 100) * cell.score);
            return (
              <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <td className="py-2.5 pr-2 text-[var(--text-primary)]">{c.name}</td>
                <td className="py-2.5 text-right tabular-nums text-[var(--text-secondary)]">{c.weight}%</td>
                <td className="py-2.5 text-right tabular-nums font-medium text-[var(--text-primary)]">{earned} / {c.maxPoints}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{t("รวม", "Total")}</td>
            <td />
            <td className="pt-2.5 text-right tabular-nums font-bold text-[var(--text-primary)]">
              {Number.isInteger(cell.score) ? cell.score : cell.score.toFixed(1)} / {cell.max}
            </td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  );
}
