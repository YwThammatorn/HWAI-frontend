"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses } from "@/lib/courses";
import { useAssignments, isManualGrading, isAiOnlyGraded, gradingOpen, type Assignment, type Rubric } from "@/lib/assignments";
import { useNow } from "@/lib/clock";
import { useStudents, withdrawnIds } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { useMyCourseIds } from "@/lib/useMyCourseIds";
import { aiGradingUpdate } from "@/lib/aiGrading";
import { rubricLineage, rubricsLookAlike, offsetsFor, workUnitsOf, type WorkUnit } from "@/lib/calibration";
import { termHeading } from "@/lib/academicTerm";

interface Row {
  assignment: Assignment;
  rubric: Rubric;
  /** why it is listed: it descends from the same rubric, or only its criteria look alike */
  why: "this" | "lineage" | "alike";
  alike?: { same: number; of: number };
  units: WorkUnit[];
  /** units the AI scored and the teacher did not — what a re-grade replaces */
  regrade: WorkUnit[];
  /** units the teacher scored — left alone */
  kept: number;
  announced: boolean;
  /** submissions have not closed yet: nothing can be graded yet (15/10/2569) */
  notOpen: boolean;
}

/**
 * "Let the AI grade again" (14/10/2569) — after Calibration's correction is used, or the rubric was edited, send the work the AI had
 * scored back to the AI with the rubric as it is now. Lists this assignment and the other assignments that share the rubric (copied
 * from it or from the same one); an assignment whose results are already announced cannot be changed. Work the teacher scored is
 * never touched; for another assignment the correction is copied onto its own rubric first.
 */
export default function CalibrationRegrade({ assignment, rubric, courseId, emphasise }: {
  assignment: Assignment;
  rubric: Rubric;
  courseId: string;
  /** the rubric was just edited — draw attention to the panel and scroll to it */
  emphasise?: boolean;
}) {
  const { t } = useLanguage();
  const { courses } = useCourses();
  const { assignments, rubrics, submissions, updateRubric, updateSubmission } = useAssignments();
  const { getStudentsByCourse } = useStudents();
  const { getGroupsByAssignment } = useStudentGroups();
  const myCourseIds = useMyCourseIds();
  const now = useNow();
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<{ pieces: number; assignments: number } | null>(null);
  const box = useRef<HTMLElement>(null);

  useEffect(() => { if (emphasise) box.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [emphasise]);

  const rows = useMemo<Row[]>(() => {
    const lineage = rubricLineage(rubric, rubrics);
    const make = (a: Assignment, r: Rubric, why: Row["why"], alike?: Row["alike"]): Row => {
      const units = workUnitsOf(a, submissions, getGroupsByAssignment(a.id), withdrawnIds(getStudentsByCourse(a.courseId)), t("ทีม", "Team"));
      const isAi = (u: WorkUnit) => u.subs.some((s) => s.aiScore !== null && isAiOnlyGraded(s));
      return { assignment: a, rubric: r, why, alike, units, regrade: units.filter(isAi), kept: units.filter((u) => u.subs.some((s) => s.instructorScore !== null)).length, announced: !!a.gradingFinalized, notOpen: !gradingOpen(a, now) };
    };
    const out: Row[] = [make(assignment, rubric, "this")];
    for (const a of assignments) {
      if (a.id === assignment.id || !myCourseIds.has(a.courseId) || a.isExam || a.acceptsFiles === false || isManualGrading(a)) continue;
      const r = rubrics.find((x) => x.assignmentId === a.id);
      if (!r || r.criteria.length === 0) continue;
      if (lineage.has(r.id)) out.push(make(a, r, "lineage"));
      else { const alike = rubricsLookAlike(rubric, r); if (alike) out.push(make(a, r, "alike", alike)); }
    }
    return out;
  }, [assignment, rubric, assignments, rubrics, submissions, myCourseIds, getGroupsByAssignment, getStudentsByCourse, t, now]);

  // this assignment starts ticked, the others never do
  const isOn = (r: Row) => !r.announced && !r.notOpen && (picked[r.assignment.id] ?? r.why === "this");
  const chosen = rows.filter(isOn);
  const pieces = chosen.reduce((n, r) => n + r.regrade.length, 0);
  const courseOf = (a: Assignment) => courses.find((c) => c.id === a.courseId);

  function run() {
    setConfirmOpen(false);
    chosen.forEach((r) => {
      // another assignment gets the correction on its own rubric first, so what it is graded with and what it stores agree
      const offsets = r.why === "this" ? rubric.aiOffsets : offsetsFor(rubric, r.rubric);
      if (r.why !== "this") updateRubric(r.rubric.id, { aiOffsets: offsets });
      const using = { criteria: r.rubric.criteria, aiOffsets: offsets };
      r.regrade.forEach((u) => {
        const update = aiGradingUpdate(u.key, r.assignment.maxPoints, using);
        u.subs.filter((s) => s.aiScore !== null && isAiOnlyGraded(s)).forEach((s) => updateSubmission(s.id, update));
      });
    });
    setDone({ pieces, assignments: chosen.length });
    setPicked({});
  }

  const ghostText = "text-xs text-[var(--text-muted)]";
  return (
    <section
      ref={box}
      aria-labelledby="cal-regrade"
      data-testid="cal-regrade"
      className={`mt-8 rounded-xl border p-5 ${emphasise ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : "border-[var(--border-subtle)] bg-[var(--bg-app)]"}`}
    >
      <h3 id="cal-regrade" className="text-sm font-bold text-[var(--text-primary)]">{t("ให้ AI ตรวจใหม่ด้วยค่าที่ปรับ", "Let the AI grade again with the new settings")}</h3>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)]">
        {emphasise
          ? t("แก้ rubric แล้ว — ให้ AI ตรวจงานที่มันเคยให้คะแนนไว้ใหม่ด้วยเกณฑ์ที่แก้", "The rubric was changed — let the AI grade again the work it had scored, with the new criteria.")
          : t("ส่งงานที่ AI เคยให้คะแนนไว้ (และคุณยังไม่ได้ให้คะแนนเอง) กลับไปให้ AI ตรวจอีกรอบ ด้วย rubric และความเข้มปัจจุบัน — เฉพาะงานที่ยังไม่ประกาศผล คะแนนที่คุณให้เองไม่ถูกแตะ", "Send the work the AI scored (and you have not scored yourself) back to the AI, with the rubric and strictness as they are now — only work whose results are not announced yet. Scores you gave yourself are never touched.")}
      </p>

      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((r) => {
          const c = courseOf(r.assignment);
          const on = isOn(r);
          return (
            <li key={r.assignment.id} data-testid={`regrade-row-${r.assignment.id}`} className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
              <input
                type="checkbox"
                checked={on}
                disabled={r.announced || r.notOpen || r.regrade.length === 0}
                onChange={(e) => setPicked((p) => ({ ...p, [r.assignment.id]: e.target.checked }))}
                aria-label={t(`ตรวจใหม่ ${r.assignment.name}`, `Grade again: ${r.assignment.name}`)}
                className="mt-1 h-4 w-4 accent-[var(--accent-solid)]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {r.assignment.name}
                  {r.why === "this" && <span className="ml-2 rounded-md border border-[var(--accent)] bg-[var(--accent-subtle)] px-1.5 py-0.5 text-xs font-semibold text-[var(--accent)]">{t("งานนี้", "This one")}</span>}
                </p>
                {r.why !== "this" && (
                  <p className={ghostText}>
                    {[c?.name, c?.academicYear && c?.term ? termHeading(c.academicYear, c.term, t) : undefined].filter(Boolean).join(" · ")}
                    {" · "}
                    {r.why === "lineage"
                      ? t("ใช้ rubric ที่คัดลอกมาจากชุดเดียวกัน", "uses a rubric copied from the same one")
                      : t(`เกณฑ์ตรงกัน ${r.alike!.same}/${r.alike!.of} ข้อ (ไม่มีบันทึกว่าคัดลอกมา — ตรวจดูก่อนติ๊ก)`, `${r.alike!.same} of ${r.alike!.of} criteria match by name (no record that it was copied — check before ticking)`)}
                  </p>
                )}
                <p className="mt-0.5 text-xs tabular-nums text-[var(--text-secondary)]" data-testid={`regrade-count-${r.assignment.id}`}>
                  {r.announced
                    ? t("ประกาศผลแล้ว — เปลี่ยนไม่ได้", "Results announced — cannot be changed")
                    : r.notOpen
                    ? t("ยังไม่เปิดให้ตรวจ — ยังไม่พ้นวันปิดรับงาน", "Not open for grading yet — submissions have not closed yet")
                    : r.regrade.length === 0
                      ? t("ไม่มีงานที่ AI ให้คะแนนไว้ให้ตรวจใหม่", "No work the AI scored to grade again")
                      : t(`จะตรวจใหม่ ${r.regrade.length} ชิ้น`, `${r.regrade.length} to grade again`)}
                  {!r.announced && !r.notOpen && r.kept > 0 && ` · ${t(`ข้าม ${r.kept} ชิ้นที่คุณให้คะแนนเองแล้ว`, `${r.kept} you scored yourself stay`)}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p role="status" data-testid="regrade-done" className="text-sm font-medium text-[var(--s-ok-text)]">
          {done ? t(`ให้ AI ตรวจใหม่แล้ว ${done.pieces} ชิ้น ใน ${done.assignments} งาน`, `The AI graded ${done.pieces} piece${done.pieces === 1 ? "" : "s"} again, in ${done.assignments} assignment${done.assignments === 1 ? "" : "s"}`) : ""}
        </p>
        <button
          type="button"
          data-testid="regrade-run"
          disabled={pieces === 0}
          onClick={() => setConfirmOpen(true)}
          className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
        >
          {t(`ให้ AI ตรวจใหม่ (${pieces} ชิ้น)`, `Grade again (${pieces})`)}
        </button>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title={t("ให้ AI ตรวจใหม่?", "Let the AI grade again?")}
        footer={
          <>
            <button type="button" onClick={() => setConfirmOpen(false)} className="h-10 px-5 whitespace-nowrap rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ยังก่อน", "Not yet")}</button>
            <button type="button" data-testid="regrade-confirm" onClick={run} className="h-10 px-5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">{t("ตรวจใหม่", "Grade again")}</button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-[var(--text-primary)]">
          {t(`คะแนน AI ของ ${pieces} ชิ้นใน ${chosen.length} งานจะถูกแทนที่ด้วยผลตรวจใหม่`, `The AI's scores on ${pieces} piece${pieces === 1 ? "" : "s"} in ${chosen.length} assignment${chosen.length === 1 ? "" : "s"} will be replaced by the new result.`)}
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm text-[var(--text-secondary)]">
          <li>{t("คะแนนที่คุณให้เองไม่เปลี่ยน", "Scores you gave yourself do not change.")}</li>
          <li>{t("งานที่ประกาศผลแล้วไม่ถูกแตะ", "Announced assignments are not touched.")}</li>
          {chosen.some((r) => r.why !== "this") && <li>{t("งานอื่นจะได้ค่าความเข้มเดียวกันนี้ใน rubric ของตัวเองด้วย", "The other assignments get the same strictness on their own rubric.")}</li>}
        </ul>
      </Modal>
    </section>
  );
}
