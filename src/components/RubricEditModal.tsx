"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import RubricCriteriaEditor, { toDraft, finalizeCriteria, scoringSignature, criteriaPointsOk, criteriaTotalPoints, levelsUniform, type CriterionDraft } from "@/components/RubricCriteriaEditor";
import { useLanguage } from "@/context/LanguageContext";
import { useAssignments, type Assignment, type Rubric } from "@/lib/assignments";
import { useCLOs } from "@/lib/clo";

/**
 * The rubric editor in a popup (14/10/2569) — what Calibration's "Edit rubric" opens instead of sending the teacher to the Edit
 * Assignment page. It is the same editor (so "Use a rubric from before" and the AI assistant are inside it), plus a note and a
 * "let the AI adjust this criterion" button on each criterion the calibration pointed at.
 *
 * Saving writes the rubric and the assignment's total. Work the AI scored stays as it is — it is re-graded from Calibration's
 * "Let the AI grade again" panel, which opens next. Work the TEACHER scored no longer matches the new criteria, so (after a
 * confirmation) it goes back to "not graded", the same rule as saving a changed rubric on the Edit Assignment page.
 */
export default function RubricEditModal({ open, onClose, assignment, rubric, courseId, flagged, onSaved }: {
  open: boolean;
  onClose: () => void;
  assignment: Assignment;
  rubric: Rubric;
  courseId: string;
  /** criterion id → what Calibration found there */
  flagged?: Record<string, string>;
  /** the rubric was saved (the popup closes itself) */
  onSaved: () => void;
}) {
  const { t } = useLanguage();
  const { updateRubric, updateAssignment, updateSubmission, getSubmissionsByAssignment } = useAssignments();
  const { getCLOsByCourse } = useCLOs();
  const [criteria, setCriteria] = useState<CriterionDraft[]>([]);
  const [sourceRubricId, setSourceRubricId] = useState<string | undefined>();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const original = useMemo(() => rubric.criteria.map(toDraft), [rubric.criteria]);
  useEffect(() => {
    if (open) { setCriteria(original); setSourceRubricId(undefined); setConfirmOpen(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(criteria) !== JSON.stringify(original);
  const scoringChanged = scoringSignature(criteria) !== scoringSignature(original);
  const valid = criteriaPointsOk(criteria) && levelsUniform(criteria);
  const teacherScored = getSubmissionsByAssignment(assignment.id).filter((s) => s.status !== "not_graded" && s.instructorScore !== null);

  function commit(restartTeacherWork: boolean) {
    setConfirmOpen(false);
    updateAssignment(assignment.id, { maxPoints: criteriaTotalPoints(criteria) });
    updateRubric(rubric.id, { criteria: finalizeCriteria(criteria, t("ไม่มีชื่อ", "Untitled")), ...(sourceRubricId ? { sourceRubricId } : {}) });
    if (restartTeacherWork) {
      teacherScored.forEach((s) => updateSubmission(s.id, { aiScore: null, aiCriterionScores: undefined, aiCriterionReasons: undefined, instructorScore: null, criterionScores: undefined, criterionComments: undefined, status: "not_graded" }));
    }
    onSaved();
    onClose();
  }

  function save() {
    if (scoringChanged && teacherScored.length > 0) { setConfirmOpen(true); return; }
    commit(false);
  }

  const secondary = "h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primary = "h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title={t("แก้ rubric", "Edit rubric")}
        description={t(`${assignment.name} — แก้เกณฑ์ที่การปรับเทียบชี้ได้เลยที่นี่ ไม่ต้องไปหน้าแก้งาน`, `${assignment.name} — change the criteria the calibration pointed at right here`)}
        footer={
          <>
            {!valid && (
              <span className="mr-auto self-center text-xs text-[var(--s-warn-text)]">
                {!criteriaPointsOk(criteria)
                  ? t("ทุกเกณฑ์ต้องมีคะแนนมากกว่า 0", "Every criterion needs more than 0 points")
                  : t("ทุกเกณฑ์ต้องมีจำนวนระดับเท่ากัน", "Every criterion needs the same number of levels")}
              </span>
            )}
            <button type="button" onClick={onClose} className={secondary}>{t("ยกเลิก", "Cancel")}</button>
            <button type="button" data-testid="rubric-edit-save" onClick={save} disabled={!dirty || !valid} className={primary}>{t("บันทึก rubric", "Save rubric")}</button>
          </>
        }
      >
        <RubricCriteriaEditor
          criteria={criteria}
          setCriteria={setCriteria}
          assignmentName={assignment.name}
          assignmentDescription={assignment.description}
          assignmentAttachments={assignment.attachments}
          clos={getCLOsByCourse(courseId)}
          cloHref={`/teacher/courses/${courseId}/clo`}
          courseId={courseId}
          assignmentId={assignment.id}
          onSourceRubric={setSourceRubricId}
          flagged={flagged}
        />
      </Modal>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title={t("เกณฑ์ที่ใช้ให้คะแนนเปลี่ยนไป", "The scoring criteria changed")}
        footer={
          <>
            <button type="button" onClick={() => setConfirmOpen(false)} className={secondary}>{t("กลับไปแก้", "Back")}</button>
            <button type="button" data-testid="rubric-edit-confirm" onClick={() => commit(true)} className={primary}>{t("บันทึกและล้างคะแนนที่ให้เอง", "Save and clear my scores")}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
          {t(
            `งานที่คุณให้คะแนนเองไว้ ${teacherScored.length} ชิ้นให้ไว้ตามเกณฑ์เดิม จะกลับเป็น “ยังไม่ตรวจ” — งานที่ AI ตรวจไว้ยังอยู่ และให้ AI ตรวจใหม่ด้วยเกณฑ์นี้ได้ในขั้นถัดไป`,
            `The ${teacherScored.length} piece${teacherScored.length === 1 ? "" : "s"} of work you scored yourself were scored under the old criteria and will go back to “not graded”. Work the AI scored stays, and the AI can grade it again with these criteria in the next step.`,
          )}
        </p>
      </Modal>
    </>
  );
}
