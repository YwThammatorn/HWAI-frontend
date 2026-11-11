"use client";

import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { useAssignments, activeLatePolicy, describeLatePolicy, latePenaltyOf, type Assignment } from "@/lib/assignments";
import { useAiGrading } from "@/lib/useAiGrading";

/**
 * "Grade with AI" asks first (22/10/2569): which work goes to the AI, with which rubric, how strict the AI is on it, and what a late
 * hand-in costs — so nobody starts a grading run on a rubric they have not looked at. Also the "Regrade with new rubric" step after
 * the rubric was changed while grading was under way (Assignment.rubricRestartedAt). Nothing is written until the teacher confirms.
 */
export default function AiGradePreviewModal({ assignment, open, onClose, onConfirm }: {
  assignment: Assignment;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLanguage();
  const { getRubricsByAssignment, getSubmissionsByAssignment } = useAssignments();
  const { waitingUnits, unitsOf } = useAiGrading();

  const rubric = getRubricsByAssignment(assignment.id)[0];
  const criteria = rubric?.criteria ?? [];
  const hasRubric = criteria.length > 0;
  const units = open ? waitingUnits(assignment) : [];
  const allUnits = open ? unitsOf(assignment, getSubmissionsByAssignment(assignment.id)) : [];
  const kept = allUnits.length - units.length;
  // nothing is waiting any more: the same popup still opens, so the rubric is seen before going back in, but there is nothing to send
  const nothingWaiting = open && units.length === 0;
  const isGroup = assignment.submissionType === "group";
  const unitWord = (n: number) => (isGroup ? t("ทีม", n === 1 ? "team" : "teams") : t("งาน", n === 1 ? "submission" : "submissions"));
  const restarted = !!assignment.rubricRestartedAt;
  const total = criteria.reduce((s, c) => s + c.maxPoints, 0);

  const policy = activeLatePolicy(assignment);
  const lateUnits = units.filter((u) => u.subs.some((s) => latePenaltyOf(assignment, s) > 0)).length;

  const secondary = "h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primary = "h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={restarted ? t("ตรวจใหม่ด้วย rubric ใหม่?", "Regrade with the new rubric?") : nothingWaiting ? t("ตรวจงานนี้ต่อ?", "Continue grading this assignment?") : t("ให้ AI ตรวจงานนี้?", "Grade this assignment with AI?")}
      description={assignment.name}
      footer={
        <>
          <button type="button" onClick={onClose} className={secondary}>{t("ยังก่อน", "Not yet")}</button>
          <button type="button" data-testid="ai-preview-confirm" onClick={onConfirm} className={primary}>
            {nothingWaiting
              ? t("เปิดหน้าตรวจงาน", "Open grading")
              : restarted ? t(`ตรวจใหม่ ${units.length} ${unitWord(units.length)}`, `Regrade ${units.length} ${unitWord(units.length)}`) : t(`เริ่มให้ AI ตรวจ ${units.length} ${unitWord(units.length)}`, `Start AI grading · ${units.length} ${unitWord(units.length)}`)}
          </button>
        </>
      }
    >
      <div data-testid="ai-preview" className="flex flex-col gap-5">
        {restarted && (
          <p data-testid="ai-preview-restarted" role="note" className="rounded-xl border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--s-info-text)]">
            {t("แก้ rubric หลังเริ่มตรวจ คะแนนเดิมจึงถูกล้างแล้ว งานเหล่านี้จะถูกตรวจใหม่ตาม rubric ด้านล่าง", "The rubric was changed after grading started, so the earlier scores were cleared. This work is graded again under the rubric below.")}
          </p>
        )}

        <section aria-label={t("งานที่จะส่ง", "Work to send")}>
          <h3 className={sectionTitle}>{t("งานที่จะส่งให้ AI", "Work sent to the AI")}</h3>
          <p data-testid="ai-preview-count" className="mt-1.5 text-sm leading-relaxed text-[var(--text-primary)] tabular-nums">
            {nothingWaiting ? (
              <>
                {t("ไม่มีงานที่รอ AI แล้ว — จะไม่มีอะไรถูกส่ง", "Nothing is waiting for the AI — nothing will be sent.")}
                {kept > 0 && <span className="text-[var(--text-secondary)]"> {t(`มี ${kept} ${unitWord(kept)} ที่มีคะแนนแล้ว`, `${kept} already scored.`)}</span>}
              </>
            ) : (
              <>
                <span className="text-base font-semibold">{units.length}</span> {unitWord(units.length)}{" "}
                {t("ที่ยังไม่ตรวจ", "not graded yet")}
                {kept > 0 && <span className="text-[var(--text-secondary)]"> · {t(`อีก ${kept} ${unitWord(kept)} มีคะแนนแล้ว ไม่ถูกแตะ`, `${kept} already scored — left as they are`)}</span>}
              </>
            )}
          </p>
        </section>

        <section aria-label={t("rubric ที่ใช้", "Rubric in use")}>
          <h3 className={sectionTitle}>{t("rubric ที่ AI จะใช้", "Rubric the AI will use")}</h3>
          {hasRubric ? (
            <div data-testid="ai-preview-rubric" className="mt-2 max-h-64 overflow-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--bg-surface)]">
                  <tr className="border-b border-[var(--border-subtle)] text-left text-xs text-[var(--text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-semibold">{t("เกณฑ์", "Criterion")}</th>
                    <th scope="col" className="px-3 py-2 font-semibold">{t("ระดับ (ดี → ต้องปรับปรุง)", "Levels (best → worst)")}</th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">{t("คะแนน", "Points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {criteria.map((c) => (
                    <tr key={c.id} className="border-b border-[var(--border-subtle)] last:border-b-0 align-top">
                      <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{c.name}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{c.levels.map((l) => l.label).join(" › ")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-primary)]">{c.maxPoints}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[var(--border-subtle)] bg-[var(--bg-app)] text-sm font-semibold text-[var(--text-primary)]">
                    <td className="px-3 py-2" colSpan={2}>{rubric?.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p data-testid="ai-preview-norubric" role="note" className="mt-2 rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--s-warn-text)]">
              {t(`ยังไม่มี rubric — AI จะให้คะแนนรวมอย่างเดียว (เต็ม ${assignment.maxPoints}) ไม่มีคะแนนรายเกณฑ์ เพิ่ม rubric ในงานนี้ก่อนถ้าต้องการคะแนนรายเกณฑ์`, `No rubric yet — the AI gives a total only (out of ${assignment.maxPoints}), with no per-criterion scores. Add a rubric to this assignment first if you want per-criterion scores.`)}
            </p>
          )}
        </section>

        {policy && !nothingWaiting && (
          <section aria-label={t("งานส่งช้า", "Late work")}>
            <h3 className={sectionTitle}>{t("งานส่งช้า", "Late work")}</h3>
            <p data-testid="ai-preview-late" className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              {describeLatePolicy(policy, t)}.{" "}
              {lateUnits > 0
                ? t(`${lateUnits} ${unitWord(lateUnits)} ส่งช้า — AI ให้คะแนนตามงาน ส่วนที่หักจะคิดตอนนับคะแนน`, `${lateUnits} ${unitWord(lateUnits)} handed in late — the AI scores the work itself; the deduction is applied when the score is counted.`)
                : t("ไม่มีงานส่งช้าในชุดนี้", "None of this work was late.")}
            </p>
          </section>
        )}

        <p className="text-xs leading-relaxed text-[var(--text-muted)]">
          {t("AI ให้คะแนนรายเกณฑ์ งานที่ไม่มั่นใจจะขึ้น “รอตรวจสอบ” คุณทบทวนและแก้ได้ทุกชิ้น นักศึกษาจะยังไม่เห็นคะแนนจนกว่าคุณประกาศผล", "The AI scores each criterion; anything it is unsure of comes back as “Needs review”. You can check and change every one, and students see nothing until you announce the results.")}
        </p>
      </div>
    </Modal>
  );
}
