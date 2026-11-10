"use client";

import { useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, isManualGrading, gradingOpen, gradingOpensAt, submissionClosesAt, finalScoreOf, activeLatePolicy } from "@/lib/assignments";
import { appNow, useNow } from "@/lib/clock";
import { aiGradingUpdate } from "@/lib/aiGrading";
import { useStudents, isWithdrawn } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { useGradingCategories } from "@/lib/gradingCategories";
import { groupSubmissionsByTeam, type SubmissionRow } from "@/lib/groupSubmissions";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";
import WithdrawnTabs, { type WithdrawnTab } from "@/components/WithdrawnTabs";
import ExamScoreTable from "@/components/ExamScoreTable";
import Modal from "@/components/Modal";
import AiGradePreviewModal from "@/components/AiGradePreviewModal";
import { useAiGrading } from "@/lib/useAiGrading";
import { useCLOs } from "@/lib/clo";
import { useCohortStudents } from "@/lib/cohort-students";

import Icon from "@/components/Icon";
import GradingWorkspace, { FILTER_KEYS, type StatusFilter } from "@/components/GradingWorkspace";
import AttentionChips from "@/components/AttentionChips";
import GradingProgressBar from "@/components/GradingProgressBar";
import { assignmentInsights, ATTENTION_KEYS, type AttentionKey } from "@/lib/gradingInsights";
import { nextToGrade } from "@/lib/gradingRows";
import { useCan } from "@/lib/useCan";
// (the progress circle was replaced by GradingProgressBar on 10/11/2569 — one picture of progress app-wide)

// ── Grading method: shown here, chosen on the Grading list (11/10/2569) ────────────────────────

function GradingModeNote({ manual, forced, courseId }: { manual: boolean; forced: boolean; courseId: string }) {
  const { t } = useLanguage();
  return (
    <p data-testid="grading-mode-note" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--text-secondary)]">
      <span className="font-semibold text-[var(--text-primary)]">{t("วิธีตรวจ", "Grading method")}:</span>
      <span>{manual ? t("ตรวจเอง — ไม่ใช้ AI", "Manual — no AI") : t("ให้ AI ช่วยตรวจ", "AI-assisted")}</span>
      {!forced && (
        <Link href={`/teacher/courses/${courseId}/grading`} className="font-medium text-[var(--accent)] hover:underline">
          {t("เปลี่ยนที่หน้ารายการตรวจงาน", "change it on the Grading list")}
        </Link>
      )}
    </p>
  );
}



// ── Main page ──────────────────────────────────────────────────────────────

export default function GradingProgressPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, getRubricsByAssignment, addSubmission, updateSubmission, updateAssignment } = useAssignments();
  const { findByStudentId } = useCohortStudents();
  const { getGroupsByAssignment } = useStudentGroups();
  const { getStudentsByCourse } = useStudents();
  const { getCategoriesByCourse } = useGradingCategories();
  const [tabState, setTabState] = useState<WithdrawnTab>("active");
  const [announceOpen, setAnnounceOpen] = useState(false);
  // The table's filter lives here so the "needs a second look" chips can set it, and a link from a course Grading card (?filter=low) opens it narrowed
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const filterParam = searchParams.get("filter");
  const selectedSubId = searchParams.get("sub");
  // The picked row lives in the URL (?sub=), so a reload — or coming back from the grading screen — lands on the same person
  function selectSub(id: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (id) p.set("sub", id); else p.delete("sub");
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => (FILTER_KEYS.includes(filterParam as StatusFilter) ? (filterParam as StatusFilter) : "all"));
  // the rubric was changed after grading had started: the earlier scores were cleared, and this sends the work to the AI again (22/10/2569)
  const [regradeOpen, setRegradeOpen] = useState(false);
  const [regrading, setRegrading] = useState(false);
  const { waitingUnits, sendWaiting } = useAiGrading();
  const can = useCan();
  const now = useNow();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const submissions = getSubmissionsByAssignment(assignmentId);
  const rubric = getRubricsByAssignment(assignmentId)[0];
  const { getCLOsByCourse } = useCLOs();

  if (!course || !assignment) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้างาน", "Back to assignments")}
          </Link>
        </main>
    );
  }

  // Grading opens only after the due date and the students' late hour (15/10/2569); an exam is never locked.
  const gradeOpen = gradingOpen(assignment, now);
  const fmtWhen = (d: Date | null) => (d ? d.toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

  // Group assignments: one row per team instead of one row per student — see
  // groupSubmissionsByTeam / TeamFormationModal / RecheckPage.handleSave.
  const isGroupAssignment = assignment.submissionType === "group";
  const groups = isGroupAssignment ? getGroupsByAssignment(assignmentId) : [];
  const allRows: SubmissionRow[] = isGroupAssignment
    ? groupSubmissionsByTeam(submissions, groups, t("ทีม", "Team"))
    : submissions.map((s) => ({ key: s.id, subs: [s] }));

  // Withdrawn students' work is kept apart (24/9/2569): it never feeds the stats below, can't hold up
  // "Finish Grading", and is only reachable from the Withdrawn tab. A team row counts as withdrawn only
  // when every member has withdrawn.
  const roster = getStudentsByCourse(id);
  const withdrawnStudentIds = new Set(roster.filter(isWithdrawn).map((s) => s.studentId));
  const rowWithdrawn = (r: SubmissionRow) => r.subs.every((s) => withdrawnStudentIds.has(s.studentId));
  const rows = allRows.filter((r) => !rowWithdrawn(r));
  const withdrawnRows = allRows.filter(rowWithdrawn);
  const activeStudents = roster.filter((s) => !isWithdrawn(s));
  const withdrawnStudents = roster.filter(isWithdrawn);
  const activeCount = activeStudents.length;
  // An Exam is never submitted (25/9/2569): its rows are the enrolled students themselves, and the
  // teacher types each score in (ExamScoreTable). "Processed" then means "has a score".
  const isExam = !!assignment.isExam;
  const withdrawnCount = isExam ? withdrawnStudents.length : withdrawnRows.length;
  const tab: WithdrawnTab = withdrawnCount === 0 ? "active" : tabState;
  const repSubs = rows.map((r) => r.subs[0]);
  const gradedOf = new Map(submissions.filter((s) => s.status === "graded").map((s) => [s.studentId, finalScoreOf(assignment, s) ?? 0]));
  const examScores = Object.fromEntries(gradedOf);
  const activeScores = activeStudents.filter((s) => gradedOf.has(s.studentId)).map((s) => gradedOf.get(s.studentId) as number);

  const enrolled = activeCount;
  const total = isExam ? activeCount : rows.length;
  const processed = isExam ? activeScores.length : repSubs.filter((s) => s.status === "graded").length;
  const needsReview = isExam ? 0 : repSubs.filter((s) => s.status === "need_review").length;
  // Grading method (11/10/2569). An exam or an assignment without files is manual whatever was chosen.
  const manual = isManualGrading(assignment);
  const shownRows = tab === "active" ? rows : withdrawnRows;
  // Calibration compares the AI with the teacher's own levels: it needs AI-assisted grading of work with files, against a rubric
  // It is always shown where it applies, so it can be found: pressable when the AI grades this assignment, otherwise greyed with the reason beside it
  const calibrationApplies = !isExam && assignment.acceptsFiles !== false && !!rubric && rubric.criteria.length > 0;
  const canCalibrate = calibrationApplies && !manual;
  const showCalibrate = calibrationApplies && can.calibrate;
  const calibrateHref = `/teacher/courses/${id}/calibration?assignment=${assignmentId}`;
  const insights = assignmentInsights(assignment, shownRows.map((r) => r.subs[0]), rubric);
  const stripScores = insights.scores;
  const next = !isExam ? nextToGrade(rows, assignment, !manual) : { row: undefined, left: 0 };
  const isDone = total > 0 && processed === total;
  const finalized = !!assignment.gradingFinalized;
  const modeForced = !!assignment.isExam || assignment.acceptsFiles === false || finalized;
  const pending = Math.max(0, total - processed);
  const pendingUnit = isExam ? t("คน", pending === 1 ? "student" : "students") : t("งาน", pending === 1 ? "submission" : "submissions");
  // One short line about where announcing stands; the full explanation lives in the confirm popup's "More details".
  const finishHint = finalized
    ? t("นักศึกษาเห็นคะแนนของตัวเองแล้ว", "Students can see their own score now.")
        + (pending > 0 ? " " + t(`ยังไม่ตรวจอีก ${pending} ${pendingUnit} — จะเห็นทันทีที่ตรวจเสร็จ`, `${pending} ${pendingUnit} still to grade — shown as soon as graded.`) : "")
    : isDone
      ? (can.announce ? t("ตรวจครบแล้ว — พร้อมประกาศผล", "All graded — ready to announce the results.") : t("ตรวจครบแล้ว — อาจารย์เป็นผู้ประกาศผล", "All graded — the teacher announces the results."))
      : (can.announce
          ? t(`ตรวจให้ครบก่อน (เหลืออีก ${pending} ${pendingUnit}) จึงจะประกาศผลได้`, `Grade the remaining ${pending} ${pendingUnit}, then you can announce the results.`)
          : t(`ยังเหลืออีก ${pending} ${pendingUnit} ให้ตรวจ`, `${pending} ${pendingUnit} left to grade.`));

  // "Finish" is also the announcement (25/9/2569): students see no score until this is confirmed
  // (see studentVisibleSubmission), so it always goes through a confirm popup.
  // An exam's announcement lands on its results page (4/10/2569): the class statistics card the students now see.
  function handleFinishGrading() {
    if (!gradingOpen(assignment!, appNow())) return;
    updateAssignment(assignmentId, { gradingFinalized: true });
    setAnnounceOpen(false);
    if (assignment?.isExam) router.push(`/teacher/courses/${id}/assignments/${assignmentId}/results`);
  }
  function handleReopenGrading() {
    if (!window.confirm(
      t("เปิดตรวจใหม่?", "Reopen grading?") + "\n" +
      t("นักศึกษาจะไม่เห็นคะแนนของงานนี้อีกจนกว่าจะประกาศผลอีกครั้ง", "Students won't see scores for this assignment again until you announce the results once more.")
    )) return;
    updateAssignment(assignmentId, { gradingFinalized: false });
  }

  // Exam scores: a student who has no submission yet gets one created here (nothing to attach — they
  // never submit), so the Score Book, Evaluation page and student view all read it the usual way.
  function handleSaveExamScores(changes: Record<string, number | null>) {
    Object.entries(changes).forEach(([studentId, score]) => {
      const existing = submissions.find((s) => s.studentId === studentId);
      if (existing) {
        updateSubmission(existing.id, score === null
          ? { instructorScore: null, aiScore: null, status: "not_graded" }
          : { instructorScore: score, status: "graded" });
        return;
      }
      if (score === null) return;
      const stu = roster.find((s) => s.studentId === studentId);
      addSubmission({
        assignmentId,
        studentId,
        studentName: stu ? `${stu.firstName} ${stu.lastName}` : studentId,
        email: stu?.email ?? "",
        submittedAt: new Date().toISOString(),
        fileUrl: null,
        aiScore: null,
        instructorScore: score,
        instructorComment: "",
        externalUseConsent: false,
        status: "graded",
      });
    });
  }

  // Re-grade one row: the stand-in AI scores it again against the rubric as it is NOW (criterion by criterion), and what the teacher had put on top of the earlier AI result is cleared — they pressed Re-grade on this row on purpose.
  function handleRegradeRow(row: SubmissionRow) {
    if (!gradingOpen(assignment!, appNow())) return;
    const update = aiGradingUpdate(row.key, assignment!.maxPoints, getRubricsByAssignment(assignmentId)[0], row.subs[0]?.snapshot);
    row.subs.forEach((s) => updateSubmission(s.id, update));
  }

  function handleSaveChanges(changes: Record<string, number | null>) {
    Object.entries(changes).forEach(([subId, score]) => {
      if (score !== null) {
        // instructorScore override
        updateSubmission(subId, {
          instructorScore: score,
          status: "graded",
        });
      } else {
        // re-grade: update aiScore, reset instructorScore
        updateSubmission(subId, {
          aiScore: changes[subId] ?? null,
          instructorScore: null,
          status: "graded",
        });
      }
    });
  }

  return (
      <main className={`flex w-full flex-col px-8 py-6 ${isExam ? "" : "lg:h-full lg:min-h-0"}`}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-3 flex-wrap">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชา", "Courses")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/grading`} className="hover:text-[var(--accent)] transition-colors">{t("ตรวจงาน", "Grading")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/assignments/${assignmentId}`} className="text-[var(--text-primary)] font-medium hover:text-[var(--accent)] transition-colors">{assignment.name}</Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{assignment.name}</h1>
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <span>
                {assignment.dueDate
                  ? <>{t("ส่งภายใน", "Due")}{" "}{new Date(assignment.dueDate + "T00:00:00").toLocaleDateString(dateLocale(lang), {
                      month: "short", day: "numeric", year: "numeric",
                    })}{" "}
                    {t("เวลา 23:59 น.", "at 11:59 PM")}</>
                  : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--accent)]"><Icon name="check-square" size="sm" />{t("ตรวจงาน", "Grading")}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {showCalibrate && (canCalibrate ? (
              <Link
                href={calibrateHref}
                data-testid="calibrate-ai"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <Icon name="sliders" />
                {t("ปรับเทียบ AI", "Calibrate AI")}
              </Link>
            ) : (
              <span
                data-testid="calibrate-ai-off"
                aria-disabled="true"
                title={t("ปรับเทียบ AI ใช้ได้เมื่อให้ AI ช่วยตรวจ — งานนี้ตรวจเอง", "Calibration needs AI-assisted grading — this assignment is graded by hand")}
                className="inline-flex cursor-not-allowed items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-muted)]"
              >
                <Icon name="sliders" />
                {t("ปรับเทียบ AI", "Calibrate AI")}
              </span>
            ))}
            {can.editAssignment && (
              <Link
                href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <Icon name="edit" />
                {t("แก้ไขงาน", "Edit Assignment")}
              </Link>
            )}
            {!can.announce ? (finalized ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]">
                <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                {t("ประกาศผลแล้ว", "Results announced")}
              </span>
            ) : null) : finalized ? (
              <>
                <Link
                  href={`/teacher/courses/${id}/assignments/${assignmentId}/results`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
                >
                  <Icon name="check-square" />
                  {t("ดูผลลัพธ์", "View Results")}
                </Link>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                  {t("ประกาศผลแล้ว", "Results announced")}
                </span>
                {!isDone && total > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] border-[var(--s-warn-bd)]">
                    {t(`ยังไม่ตรวจ ${pending} ${pendingUnit}`, `${pending} ${pendingUnit} to grade`)}
                  </span>
                )}
                {/* Safety valve (23/9/2569) — finalizing was never meant to be a one-way door. */}
                <button
                  type="button"
                  onClick={handleReopenGrading}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:underline transition-colors"
                >
                  {t("เปิดตรวจใหม่", "Reopen grading")}
                </button>
              </>
            ) : isDone && gradeOpen ? (
              // Grading finished at 100% but not yet finalized: the teacher must actively confirm
              // before Score Book locks and View Results becomes reachable (23/9/2569).
              <button
                type="button"
                onClick={() => setAnnounceOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
              >
                <Icon name="check" />
                {t("ประกาศผล", "Announce results")}
              </button>
            ) : (
              // Not everything is graded yet: the button is there but disabled, with the reason, so it is clear
              // where the announcement comes from and what is still missing.
              <button
                type="button"
                disabled
                aria-describedby="finish-hint"
                title={!gradeOpen ? t("ยังไม่เปิดให้ตรวจ จึงยังประกาศผลไม่ได้", "Grading is not open yet, so results cannot be announced") : total === 0 ? t("ยังไม่มีงานให้ประกาศ", "Nothing to announce yet") : t(`ตรวจให้ครบก่อน — เหลือ ${pending} ${pendingUnit}`, `Finish grading first — ${pending} ${pendingUnit} left`)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--text-secondary)] cursor-not-allowed"
              >
                <Icon name="check" />
                {t("ประกาศผล", "Announce results")}
              </button>
            )}
          </div>
        </div>

        {!gradeOpen && (
          <div
            data-testid="grading-window-note"
            role="note"
            className="mb-3 flex items-start gap-3 rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-4 py-2.5 text-sm leading-relaxed text-[var(--s-warn-text)]"
          >
            <Icon name="lock" className="mt-0.5 shrink-0" />
            <p>
              {t(`ยังไม่เปิดให้ตรวจ — นักศึกษาส่งได้ถึง ${fmtWhen(submissionClosesAt(assignment))} น. (${activeLatePolicy(assignment) ? "รวมช่วงรับงานส่งช้า" : "ไม่รับงานส่งช้า"}) จะเริ่มตรวจ ประกาศผล หรือให้ AI ตรวจใหม่ได้ตั้งแต่ ${fmtWhen(gradingOpensAt(assignment))} น.`,
                `Not open for grading yet — students can submit until ${fmtWhen(submissionClosesAt(assignment))} (${activeLatePolicy(assignment) ? "including the late-work period" : "late work is not accepted"}). You can grade, announce or re-grade from ${fmtWhen(gradingOpensAt(assignment))}.`)}
            </p>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        {total > 0 && (
          <div
            id="finish-hint"
            role="note"
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-sm leading-relaxed ${finalized ? "border-[var(--s-ok-bd)] bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]" : "border-[var(--s-info-bd)] bg-[var(--s-info-bg)] text-[var(--s-info-text)]"}`}
          >
            <Icon name="info" className="shrink-0" />
            <p>{finishHint}</p>
          </div>
        )}

        {!isExam && <GradingModeNote manual={manual} forced={modeForced || can.isTa} courseId={id} />}
        </div>

        {/* Rubric changed while grading was under way: the earlier scores are gone, so offer the AI run again — right here, with the new rubric */}
        {can.useAi && !isExam && !manual && !finalized && gradeOpen && assignment.rubricRestartedAt && waitingUnits(assignment).length > 0 && (
          <div data-testid="regrade-banner" role="note" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--s-info-text)]">
            <p className="min-w-0 flex-1">
              {t(`แก้ rubric หลังเริ่มตรวจ คะแนนเดิมถูกล้างแล้ว — เหลือ ${waitingUnits(assignment).length} ${isGroupAssignment ? "ทีม" : "งาน"}ที่รอตรวจตาม rubric ใหม่`,
                `The rubric was changed after grading started and the earlier scores were cleared — ${waitingUnits(assignment).length} ${isGroupAssignment ? "team(s)" : "submission(s)"} wait to be graded under the new rubric.`)}
            </p>
            <button
              type="button"
              data-testid="regrade-new-rubric"
              disabled={regrading}
              onClick={() => setRegradeOpen(true)}
              className="h-9 px-4 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
            >
              {regrading ? t("AI กำลังตรวจ…", "AI grading…") : t("Regrade ด้วย rubric ใหม่", "Regrade with new rubric")}
            </button>
          </div>
        )}

        {/* Enrolled / Withdrawn — only appears once someone has withdrawn */}
        <WithdrawnTabs tab={tab} onChange={setTabState} activeCount={isExam ? activeCount : rows.length} withdrawnCount={withdrawnCount} />

        {/* The summary strip (10/11/2569): how far, the scores in three numbers, who needs a second look, and the button for what to do next */}
        {tab === "active" && (
          <section data-testid="grading-strip" aria-label={t("สรุป", "Summary")} className="mb-3 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-5 py-3">
            <div className="w-full min-w-[14rem] sm:w-56">
              <p className="mb-1.5 text-sm tabular-nums text-[var(--text-secondary)]">
                <span className="font-bold text-[var(--text-primary)]">{processed}</span> / {total} {isExam ? t("ให้คะแนนแล้ว", "scored") : t("ตรวจแล้ว", "graded")}
                {!isExam && !isGroupAssignment && enrolled > total && <span className="text-[var(--text-muted)]"> · {total} / {enrolled} {t("ส่งแล้ว", "submitted")}</span>}
              </p>
              <GradingProgressBar total={total} graded={processed} needReview={needsReview} notGraded={Math.max(0, total - processed - needsReview)} />
            </div>
            <dl className="flex gap-5" title={t(`คะแนนเต็ม ${assignment.maxPoints}`, `Out of ${assignment.maxPoints}`)} data-testid="grading-strip-scores">
              {[
                { label: t("เฉลี่ย", "Avg"), value: stripScores.length ? (stripScores.reduce((a, b) => a + b, 0) / stripScores.length).toFixed(1) : "—" },
                { label: t("สูงสุด", "High"), value: stripScores.length ? Math.max(...stripScores) : "—" },
                { label: t("ต่ำสุด", "Low"), value: stripScores.length ? Math.min(...stripScores) : "—" },
              ].map((x) => (
                <div key={x.label} className="flex flex-col-reverse">
                  <dt className="text-xs font-medium text-[var(--text-muted)]">{x.label}</dt>
                  <dd className="text-xl font-bold tabular-nums text-[var(--text-primary)]">{x.value}</dd>
                </div>
              ))}
            </dl>
            <AttentionChips
              counts={insights.attention}
              active={ATTENTION_KEYS.includes(statusFilter as AttentionKey) ? (statusFilter as AttentionKey) : null}
              onSelect={(k) => setStatusFilter(statusFilter === k ? "all" : k)}
            />
            {next.row && (
              <div className="ml-auto">
                {!gradeOpen ? (
                  <span
                    data-testid="grade-next-locked"
                    aria-disabled="true"
                    title={t("ยังไม่เปิดให้ตรวจ — ดูเวลาเปิดที่ด้านบนของหน้า", "Grading is not open yet — see the time at the top of the page")}
                    className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text-muted)]"
                  >
                    <Icon name="lock" />
                    {t(`ตรวจงานถัดไป (เหลือ ${next.left})`, `Grade next (${next.left} left)`)}
                  </span>
                ) : (
                  <Link
                    href={`/teacher/courses/${id}/assignments/${assignmentId}/recheck?sub=${next.row.subs[0].id}`}
                    data-testid="grade-next"
                    className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--accent-solid)] px-4 text-sm font-semibold text-[var(--accent-solid-text)] transition-colors hover:bg-[var(--accent-solid-hover)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  >
                    <Icon name="play" />
                    {t(`ตรวจงานถัดไป (เหลือ ${next.left})`, `Grade next (${next.left} left)`)}
                  </Link>
                )}
              </div>
            )}
          </section>
        )}

        {isExam ? (
          <ExamScoreTable
            key={tab}
            students={tab === "active" ? activeStudents : withdrawnStudents}
            titleOf={(sid) => findByStudentId(sid)?.title}
            scores={examScores}
            maxPoints={assignment.maxPoints}
            examName={assignment.name}
            weight={getCategoriesByCourse(id).find((c) => c.id === assignment.categoryId)?.weight ?? null}
            withdrawnIds={withdrawnStudentIds}
            readOnly={tab === "withdrawn" || finalized}
            readOnlyReason={tab === "withdrawn"
              ? t("นักศึกษาที่ถอนแล้ว — ดูอย่างเดียว", "Withdrawn students — view only")
              : t("ตรวจเสร็จสิ้นแล้ว — กด “เปิดตรวจใหม่” ถ้าต้องแก้คะแนน", "Grading is finished — press “Reopen grading” to change scores")}
            onSave={handleSaveExamScores}
          />
        ) : (
          <GradingWorkspace
            key={tab}
            rows={shownRows}
            assignment={assignment}
            rubric={rubric}
            courseId={id}
            assignmentId={assignmentId}
            aiGraded={!manual}
            gradeLocked={!gradeOpen}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            selectedSubId={selectedSubId}
            onSelect={selectSub}
            onRegradeRow={handleRegradeRow}
            insights={insights}
            calibrate={showCalibrate ? { href: calibrateHref, blocked: !canCalibrate, canChangeMode: !modeForced, gradingListHref: `/teacher/courses/${id}/grading` } : undefined}
            gradedSubs={shownRows.map((r) => r.subs[0]).filter((s) => s.status === "graded")}
            clos={getCLOsByCourse(id)}
            finalized={finalized}
            editHref={can.editRubric ? `/teacher/courses/${id}/assignments/${assignmentId}/edit` : undefined}
            canReGrade={can.useAi}
            unit={isGroupAssignment ? "team" : "student"}
            isGroup={isGroupAssignment}
          />
        )}
        {regradeOpen && (
          <AiGradePreviewModal
            assignment={assignment}
            open
            onClose={() => setRegradeOpen(false)}
            onConfirm={async () => { setRegradeOpen(false); setRegrading(true); await sendWaiting(assignment); setRegrading(false); }}
          />
        )}
        <Modal
          open={announceOpen}
          onClose={() => setAnnounceOpen(false)}
          size="sm"
          title={t("ประกาศผลให้นักศึกษา?", "Announce results to students?")}
          description={assignment.name}
          footer={
            <>
              <button
                type="button"
                onClick={() => setAnnounceOpen(false)}
                className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("ยังก่อน", "Not yet")}
              </button>
              <button
                type="button"
                onClick={handleFinishGrading}
                className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                {t("ประกาศผล", "Announce results")}
              </button>
            </>
          }
        >
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            {t(
              `ตรวจครบแล้ว ${processed}/${total} — นักศึกษาจะเห็นคะแนนของตัวเองทันที`,
              `All ${processed} of ${total} graded. Students see their own score right away.`
            )}
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[var(--text-secondary)] list-disc pl-5">
            <li>{t("คะแนนใน Score Book และ Rubric จะถูกล็อก", "Score Book and rubric get locked")}</li>
            <li>{t("เปลี่ยนใจได้ — กด “เปิดตรวจใหม่”", "Changed your mind? Use “Reopen grading”")}</li>
          </ul>
          <details className="mt-3 text-sm text-[var(--text-secondary)]">
            <summary className="cursor-pointer select-none font-medium text-[var(--accent)] hover:underline">{t("รายละเอียด", "More details")}</summary>
            <ul className="mt-2 flex flex-col gap-1.5 list-disc pl-5 leading-relaxed">
              <li>{t("ตอนนี้นักศึกษาเห็นแค่ว่างานกำลังถูกตรวจ ยังไม่เห็นคะแนน", "Until now students only see that their work is being graded — no score.")}</li>
              <li>{t("หลังประกาศ จะแก้คะแนนใน Score Book และแก้ Rubric ไม่ได้ (ดูอย่างเดียว)", "After announcing, scores in the Score Book and the rubric can no longer be edited (view only).")}</li>
              <li>{t("ถ้าเปิดตรวจใหม่ นักศึกษาจะไม่เห็นคะแนนอีกจนกว่าจะประกาศใหม่", "If you reopen grading, students won't see scores again until you announce once more.")}</li>
            </ul>
          </details>
        </Modal>
      </main>
  );
}
