"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, RubricCriterion, submissionAttachments, isManualGrading, levelShare, gradingOpen, gradingOpensAt, latePenaltyOf, daysLate } from "@/lib/assignments";
import { useNow } from "@/lib/clock";
import SubmissionViewer from "@/components/SubmissionViewer";
import FloatingPanel, { openFloatingWindow } from "@/components/FloatingPanel";
import CriterionName from "@/components/CriterionName";
import { CriterionPoints } from "@/components/RubricCriterionCard";
import { RubricLevelPicker } from "@/components/RubricLevels";
import { splitCriterionName } from "@/lib/rubricName";
import { useStudentGroups } from "@/lib/studentGroups";
import { useLanguage } from "@/context/LanguageContext";
import { dateLocale } from "@/lib/dateLocale";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
function genFeedback(fullName: string, level: "high" | "low"): string {
  const name = splitCriterionName(fullName).main; // "C1 · Program correctness / ความถูกต้อง" reads as "program correctness" in a sentence
  if (level === "high") {
    return `Good demonstration of ${name.toLowerCase()}. The work clearly meets expectations and shows solid understanding of the required concepts.`;
  }
  return `Minor issues found in ${name.toLowerCase()}. Consider revising the final section for clarity and accuracy.`;
}

interface CriterionScore {
  criterionId: string;
  /** Points now. null = not marked yet (a hand-graded submission starts that way). */
  score: number | null;
  /** The selected level card (0 = best). null when nothing is marked, or when the score sits on no level (a score typed before levels were clicked). */
  level: number | null;
  /** What the AI gave this criterion, in points; null when the AI did not grade this work. */
  aiPts: number | null;
  maxPoints: number;
  aiFeedback: string;
  edited: boolean;
}

// Points a level is worth (levels are positions, 0 = best) — the same arithmetic the Calibration cards use.
const levelPts = (c: RubricCriterion, li: number) => Math.round(c.maxPoints * levelShare(li, c.levels.length));
const levelOfPts = (c: RubricCriterion, pts: number | null) => {
  if (pts === null) return null;
  const i = c.levels.findIndex((_, li) => levelPts(c, li) === pts);
  return i < 0 ? null : i;
};

export default function RecheckPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const subId = searchParams.get("sub") ?? "";

  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, getRubricsByAssignment, updateSubmission } = useAssignments();
  const { getGroupsByAssignment } = useStudentGroups();
  const now = useNow();

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const allSubs = getSubmissionsByAssignment(assignmentId);
  const submission = allSubs.find((s) => s.id === subId) ?? allSubs[0];
  const rubrics = getRubricsByAssignment(assignmentId);
  const rubric = rubrics[0];
  const team = submission?.groupId
    ? getGroupsByAssignment(assignmentId).find((g) => g.id === submission.groupId)
    : undefined;

  const [zoom, setZoom] = useState(100);
  // The grading part in its own small window (14/10/2569): for a submitted link, which opens in another tab, so the teacher can grade
  // while looking at it. The state stays in this page; the small window just shows the same panel.
  const [floatWin, setFloatWin] = useState<Window | null>(null);
  const [floatBlocked, setFloatBlocked] = useState(false);
  const floatRef = useRef<Window | null>(null);
  floatRef.current = floatWin;
  useEffect(() => () => { try { floatRef.current?.close(); } catch { /* already closed */ } }, []);
  const [scores, setScores] = useState<CriterionScore[]>([]);
  // Exam-type assignments have no rubric (23/9/2569) — the whole score is typed in directly here.
  const [manualScore, setManualScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState(submission?.instructorComment ?? "");
  // Per-criterion notes ("why I changed this score"), keyed by criterion id
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>(submission?.criterionComments ?? {});

  // Where each criterion starts: what was saved for it, else what the AI gave it, else (work graded before per-criterion marks
  // were kept) its share of the total. A hand-graded submission with nothing saved starts empty — every criterion gets clicked.
  function buildScores(useSaved: boolean): CriterionScore[] {
    if (!rubric || !submission || !assignment) return [];
    const hasAi = !isManualGrading(assignment) && submission.aiScore !== null;
    return rubric.criteria.map((c: RubricCriterion) => {
      const aiPts = hasAi ? (submission.aiCriterionScores?.[c.id] ?? Math.round((c.weight / 100) * (submission.aiScore ?? 0))) : null;
      const saved = useSaved ? submission.criterionScores?.[c.id] : undefined;
      const legacy = useSaved && submission.instructorScore !== null && submission.instructorScore !== undefined
        ? Math.round((c.weight / 100) * submission.instructorScore) : null;
      const score = saved ?? (hasAi ? submission.aiCriterionScores?.[c.id] : undefined) ?? legacy ?? aiPts;
      return {
        criterionId: c.id,
        score,
        level: levelOfPts(c, score),
        aiPts,
        maxPoints: c.maxPoints,
        aiFeedback: genFeedback(c.name, (score ?? 0) / c.maxPoints >= 0.7 ? "high" : "low"),
        edited: false,
      };
    });
  }

  useEffect(() => {
    if (!submission) return;
    if (rubric) {
      setScores(buildScores(true));
    } else {
      setManualScore(submission.instructorScore ?? submission.aiScore ?? 0);
    }
    setCriterionComments(submission.criterionComments ?? {});
  }, [rubric?.id, submission?.id]);

  if (!course || !assignment || !submission) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link
            href={`/teacher/courses/${id}/assignments/${assignmentId}/results`}
            className="text-[var(--accent)] ml-1 hover:underline"
          >
            {t("กลับหน้าผลลัพธ์", "Back to results")}
          </Link>
        </main>
    );
  }

  // Nothing is graded while the work can still change (15/10/2569): this page opens only after the due date and the late hour. A URL typed
  // in early lands here instead of on the grading panel.
  if (!gradingOpen(assignment, now)) {
    const opens = gradingOpensAt(assignment);
    const when = opens ? opens.toLocaleString(dateLocale(lang), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div data-testid="grade-window-closed" role="note" className="max-w-md rounded-2xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-6 py-5 text-center text-[var(--s-warn-text)]">
          <p className="text-base font-semibold">{t("ยังไม่เปิดให้ตรวจงานนี้", "This assignment is not open for grading yet")}</p>
          <p className="mt-2 text-sm leading-relaxed">
            {t(`นักศึกษายังส่งหรือส่งซ้ำได้อยู่ (ยังไม่พ้นวันปิดรับงาน) จะตรวจได้ตั้งแต่ ${when} น.`, `Students can still submit or resubmit (submissions have not closed yet). Grading opens ${when}.`)}
          </p>
          <Link href={`/teacher/courses/${id}/grading`} className="mt-4 inline-flex h-9 items-center rounded-xl border border-[var(--s-warn-bd)] px-4 text-sm font-semibold hover:bg-[var(--bg-card)]">
            {t("กลับหน้าตรวจงาน", "Back to Grading")}
          </Link>
        </div>
      </main>
    );
  }

  // Graded by hand (11/10/2569: the teacher's choice, an exam, or no file to check): nothing from the AI is shown here
  const handGraded = isManualGrading(assignment);
  const latePenalty = submission ? latePenaltyOf(assignment, submission) : 0;
  const totalScore = rubric ? scores.reduce((sum, s) => sum + (s.score ?? 0), 0) : manualScore;
  // A criterion with no mark would silently count as 0 in the student's total — saving waits until every one is marked.
  const unmarked = rubric ? scores.filter((s) => s.score === null).length : 0;
  const totalMax = rubric ? (scores.reduce((sum, s) => sum + s.maxPoints, 0) || assignment.maxPoints) : assignment.maxPoints;
  // The teacher clicks a level card; the criterion's points are that level's points.
  function pickLevel(cid: string, li: number) {
    const c = rubric?.criteria.find((x) => x.id === cid);
    if (!c) return;
    const pts = levelPts(c, li);
    setScores((prev) =>
      prev.map((s) => s.criterionId === cid ? { ...s, score: pts, level: li, edited: s.aiPts !== null && pts !== s.aiPts } : s)
    );
    setSaved(false);
  }

  // A criterion with no levels at all (only very old data) has no cards to click — its points are typed, as before.
  function typeScore(cid: string, val: number) {
    setScores((prev) =>
      prev.map((s) => {
        if (s.criterionId !== cid) return s;
        const pts = Math.max(0, Math.min(s.maxPoints, val));
        return { ...s, score: pts, level: null, edited: s.aiPts !== null && pts !== s.aiPts };
      })
    );
    setSaved(false);
  }

  function resetToDefault() {
    if (!submission) return;
    const aiScore = submission.aiScore ?? 0;
    if (rubric) {
      setScores(buildScores(false));
    } else {
      setManualScore(aiScore);
    }
    setComment(submission.instructorComment ?? "");
    setCriterionComments(submission.criterionComments ?? {});
    setSaved(false);
  }

  function handleSave() {
    // Group assignments: everyone on the team shares one submission in spirit
    // (see TeamFormationModal / student classwork submit flow) — grading the
    // representative row grades the whole team, not just whoever is shown here.
    const teammates = submission.groupId
      ? allSubs.filter((s) => s.groupId === submission.groupId)
      : [submission];
    // Drop blank notes so the record only holds what the instructor actually wrote
    const notes = Object.fromEntries(
      Object.entries(criterionComments)
        .map(([cid, text]) => [cid, text.trim()] as const)
        .filter(([, text]) => text),
    );
    // Score Book shows a per-criterion breakdown (21/9/2569) — persist what each criterion actually
    // earned, not just the total, so that breakdown reflects a real edit instead of a weight guess.
    const criterionScores = Object.fromEntries(scores.map((s) => [s.criterionId, s.score ?? 0]));
    teammates.forEach((s) => {
      updateSubmission(s.id, {
        instructorScore: totalScore,
        instructorComment: comment,
        criterionComments: notes,
        criterionScores,
        status: "graded",
      });
    });
    setSaved(true);
    // Go back to wherever the teacher opened this recheck from (23/9/2569, was always the per-assignment
    // Results page) — recheck is reachable from the Grading page, the per-assignment Results drill-down,
    // and the course-level Score Book, so a fixed destination was wrong for at least two of the three.
    setTimeout(() => router.back(), 1000);
  }

  const criteriaMap = Object.fromEntries(
    (rubric?.criteria ?? []).map((c: RubricCriterion) => [c.id, c])
  );

  const hasLink = submissionAttachments(submission).some((a) => a.source === "url");
  async function openFloat() {
    if (floatRef.current) return;
    setFloatBlocked(false);
    const w = await openFloatingWindow({ width: 420, height: 680, name: "hwai-grade-panel" });
    if (w) setFloatWin(w); else setFloatBlocked(true);
  }
  function closeFloat() {
    try { floatWin?.close(); } catch { /* already closed */ }
    setFloatWin(null);
  }

  // The grading panel — drawn in the page, or in the small window while it floats
  const gradePanel = (floating: boolean) => (
    <div className={floating ? "flex-1 min-h-0 flex flex-col bg-[var(--bg-surface)] overflow-y-auto" : "w-[26rem] shrink-0 flex flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-y-auto"}>
      <div className="px-5 py-5 border-b border-[var(--border-subtle)]">
        {/* No "AI confidence" any more (15/10/2569, user's request): only a note when there is no AI result behind this submission. */}
        <h2 className="text-base font-bold text-[var(--text-primary)]">
          {t("ตรวจสอบการให้คะแนน", "Grading Review")}
        </h2>
        {handGraded ? (
          <p className="mt-3 text-xs text-[var(--text-secondary)]">
            {t("ตรวจเอง — ไม่ใช้ AI ในงานนี้", "Graded by hand — no AI on this assignment")}
          </p>
        ) : submission.aiScore === null ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {t("ยังไม่ผ่านการตรวจของ AI — ให้คะแนนด้วยตนเอง", "Not yet AI-graded — grading manually")}
          </p>
        ) : null}
      </div>

      {/* Criteria */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {!rubric && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
              {/* A no-rubric assignment reaches here for either reason now (23/9/2569 round 3):
                  isExam, or acceptsFiles turned off — the old label always said "exam", which was
                  wrong for the second case. */}
              {assignment.isExam
                ? t("งานประเภทสอบ — ไม่มี rubric", "Exam assignment — no rubric")
                : !assignment.acceptsFiles
                ? t("ไม่รับไฟล์ — ไม่มี rubric", "No file submission — no rubric")
                : t("ยังไม่มี rubric", "No rubric yet")}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-3">
              {t("พิมพ์คะแนนรวมของงานนี้โดยตรง", "Enter this submission's total score directly")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={assignment.maxPoints}
                value={manualScore}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(assignment.maxPoints, parseInt(e.target.value) || 0));
                  setManualScore(v);
                  setSaved(false);
                }}
                aria-label={t("คะแนนรวม", "Total score")}
                className="w-20 text-center text-sm font-bold text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
              />
              <span className="text-xs text-[var(--text-muted)]">/ {assignment.maxPoints}</span>
            </div>
          </div>
        )}
        {scores.map((s) => {
          const c = criteriaMap[s.criterionId];
          if (!c) return null;
          return (
            <div
              key={s.criterionId}
              className={`rounded-xl border p-4 transition-colors ${
                s.edited ? "border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)]/30" : "border-[var(--border-subtle)] bg-[var(--bg-surface)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <CriterionName name={c.name} />
                {c.levels.length === 0 ? (
                  <span className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={s.maxPoints}
                      value={s.score ?? 0}
                      onChange={(e) => typeScore(s.criterionId, parseInt(e.target.value) || 0)}
                      aria-label={t(`คะแนน ${splitCriterionName(c.name).main}`, `Score for ${splitCriterionName(c.name).main}`)}
                      className="w-12 text-center text-sm font-bold text-[var(--text-primary)] border border-[var(--border)] rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                    />
                    <span className="text-xs text-[var(--text-muted)]">/ {s.maxPoints}</span>
                  </span>
                ) : (
                  s.score !== null ? (
                    <CriterionPoints maxPoints={s.maxPoints} weight={c.weight} earned={s.score} testId={`crit-score-${s.criterionId}`} />
                  ) : (
                    <span data-testid={`crit-score-${s.criterionId}`} className="shrink-0 text-sm tabular-nums text-[var(--text-muted)]">— / {s.maxPoints}</span>
                  )
                )}
              </div>

              {/* A score that sits on no level (typed before levels were clicked): kept as it is until a level is clicked */}
              {c.levels.length > 0 && s.score !== null && s.level === null && (
                <p data-testid={`crit-offlevel-${s.criterionId}`} className="mb-2 text-xs leading-snug text-[var(--text-secondary)]">
                  {t(`คะแนนเดิม ${s.score} / ${s.maxPoints} ไม่ตรงระดับใดเลย — คลิกระดับเพื่อเปลี่ยน`, `Earlier score ${s.score} / ${s.maxPoints} sits on no level — click a level to change it`)}
                </p>
              )}

              {/* Click the level that fits the work — the same cells as Calibration (RubricLevelPicker) */}
              <RubricLevelPicker
                criterion={c}
                label={t(`ระดับของ ${splitCriterionName(c.name).main}`, `Level for ${splitCriterionName(c.name).main}`)}
                value={s.level}
                onPick={(li) => pickLevel(s.criterionId, li)}
                aiLevel={!handGraded && s.aiPts !== null ? levelOfPts(c, s.aiPts) : null}
                aiTestId={`mark-ai-${s.criterionId}`}
              />

              {s.edited && !handGraded && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--s-warn-text)] bg-[var(--s-warn-bg)] px-1.5 py-0.5 rounded mt-3 mb-1">
                  {t("แก้ไขแล้ว", "Manually Edited")}
                </span>
              )}

              {!handGraded && (
              <div className="mt-2">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  {t("ความคิดเห็น AI", "AI Feedback")}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{s.aiFeedback}</p>
              </div>
              )}

              {/* Shown once the instructor overrides the score (or a note already exists) */}
              {!handGraded && (s.edited || criterionComments[s.criterionId]) && (
                <div className="mt-3">
                  <label
                    htmlFor={`criterion-note-${s.criterionId}`}
                    className="block text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1"
                  >
                    {t("ข้อเสนอแนะถึง AI", "Feedback to AI")}
                  </label>
                  <p id={`criterion-note-hint-${s.criterionId}`} className="text-[11px] text-[var(--text-muted)] leading-snug mb-1.5">
                    {t(
                      "บอก AI ว่าทำไมถึงปรับคะแนน — ไม่แสดงให้นักศึกษาเห็น เก็บไว้ใช้ปรับปรุงการตรวจของ AI",
                      "Tell the AI why you changed this score — not shown to students; kept to help refine AI grading",
                    )}
                  </p>
                  <textarea
                    id={`criterion-note-${s.criterionId}`}
                    aria-describedby={`criterion-note-hint-${s.criterionId}`}
                    value={criterionComments[s.criterionId] ?? ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      setCriterionComments((prev) => ({ ...prev, [s.criterionId]: text }));
                      setSaved(false);
                    }}
                    rows={2}
                    placeholder="เช่น AI ให้เข้มเกินไป เพราะ... (ไม่บังคับ)"
                    className="w-full text-xs text-[var(--text-primary)] resize-none border border-[var(--border)] rounded-lg px-2.5 py-2 bg-[var(--bg-surface)] placeholder:text-[var(--text-muted)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Comment */}
        <div className="rounded-xl border border-[var(--border-subtle)] p-4">
          <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
            {t("ความคิดเห็นอาจารย์", "Instructor Comment")}
          </p>
          <textarea
            value={comment}
            onChange={(e) => { setComment(e.target.value); setSaved(false); }}
            rows={3}
            placeholder="เพิ่มความคิดเห็นสำหรับนักศึกษา..."
            className="w-full text-xs text-[var(--text-primary)] resize-none border-0 outline-none bg-transparent placeholder:text-[var(--text-muted)] leading-relaxed"
          />
        </div>

        {/* Total */}
        <div className="rounded-xl bg-[var(--bg-nav)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">{t("คะแนนรวม", "Total Score")}</span>
            <span className="text-xl font-bold text-white">
              {totalScore}
              <span className="text-sm font-normal text-white/50"> / {totalMax}</span>
            </span>
          </div>
          {latePenalty > 0 && (
            <div data-testid="late-deduction" className="mt-2 border-t border-white/15 pt-2 text-xs text-white/70 tabular-nums">
              <div className="flex items-center justify-between">
                <span>{t(`ส่งช้า ${daysLate(assignment, submission.submittedAt)} วัน`, `Handed in ${daysLate(assignment, submission.submittedAt)} day${daysLate(assignment, submission.submittedAt) === 1 ? "" : "s"} late`)}</span>
                <span>−{latePenalty}</span>
              </div>
              <div className="mt-1 flex items-center justify-between font-semibold text-white">
                <span>{t("คะแนนที่นับ", "Counted score")}</span>
                <span>{Math.max(0, totalScore - latePenalty)} / {totalMax}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {unmarked > 0 && (
        <p data-testid="grade-unmarked" role="status" className="px-5 pt-3 text-xs text-[var(--text-secondary)]">
          {t(`เลือกระดับอีก ${unmarked} เกณฑ์ก่อนบันทึก`, `Pick a level for ${unmarked} more ${unmarked === 1 ? "criterion" : "criteria"} before saving`)}
        </p>
      )}
      {/* Footer actions */}
      <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex gap-3">
        <button
          onClick={resetToDefault}
          className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="rotate-ccw" size="sm" />
          {t("คืนค่าเดิม", "Reset to Default")}
        </button>
        <button
          onClick={handleSave}
          disabled={unmarked > 0}
          className="flex-1 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[var(--accent-solid)]"
        >
          {saved ? `✓ ${t("บันทึกแล้ว!", "Saved!")}` : t("บันทึกการเปลี่ยนแปลง", "Save Changes")}
        </button>
      </div>
    </div>
  );

  return (
      <div className="flex h-full overflow-hidden">
        {/* Left: file viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-[var(--surface)] overflow-hidden">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] shadow-sm">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest">
              {t("มุมมอง", "View")}:
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm font-bold transition-colors"
            >
              −
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)] w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm font-bold transition-colors"
            >
              +
            </button>
            <div className="w-px h-4 bg-[var(--border)] mx-1" />
            <IconButton icon="refresh" label={t("รีเซ็ตการซูม", "Reset zoom")} onClick={() => setZoom(100)} />
            {hasLink && (
              <>
                <div className="w-px h-4 bg-[var(--border)] mx-1" />
                <button
                  type="button"
                  data-testid="grade-float-open"
                  onClick={floatWin ? closeFloat : openFloat}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  {floatWin ? t("เอาส่วนตรวจกลับมาในหน้านี้", "Bring the grading back here") : t("ส่วนตรวจลอยในหน้าต่างเล็ก", "Float the grading in a small window")}
                </button>
                {floatBlocked && <span role="status" data-testid="grade-float-blocked" className="text-xs text-[var(--s-err-text)]">{t("เบราว์เซอร์บล็อกหน้าต่างเล็ก — อนุญาต pop-up ของเว็บนี้แล้วลองใหม่", "The browser blocked the small window — allow pop-ups for this site and try again")}</span>}
              </>
            )}
          </div>

          {/* What the student submitted; the sandbox placeholder when nothing was attached */}
          <SubmissionViewer
            attachments={submissionAttachments(submission)}
            zoom={zoom}
            onOpenLink={floatWin ? undefined : openFloat}
            caption={[
              submission.studentName,
              team ? t(`ทีม ${team.name}`, `Team ${team.name}`) : null,
              `${t("ส่งเมื่อ", "Submitted")} ${new Date(submission.submittedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
            ].filter(Boolean).join(" · ")}
            empty={
          <div className="flex-1 overflow-auto flex items-start justify-center p-8">
            <div
              className="bg-[var(--bg-surface)] shadow-xl rounded-sm transition-all origin-top"
              style={{ width: `${zoom * 5}px`, minHeight: `${zoom * 7}px`, transform: `scale(1)` }}
            >
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <IconTile icon="file" size="lg" tone="accent" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{submission.studentName}</p>
                  {team && (
                    <p className="text-xs text-[var(--accent)] mb-1">
                      {t(`ทีม ${team.name} — คะแนนนี้จะใช้กับสมาชิกทุกคน`, `Team ${team.name} — this grade applies to every member`)}
                    </p>
                  )}
                  <p className="text-xs text-[var(--text-muted)]">
                    {t("ส่งเมื่อ", "Submitted")}{" "}
                    {new Date(submission.submittedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-3">
                    {t("ไม่สามารถแสดงตัวอย่างไฟล์ในโหมดทดสอบ", "File preview not available in sandbox mode")}
                  </p>
                </div>
              </div>
            </div>
          </div>
            }
          />
        </div>

        {floatWin ? (
          <>
            <div data-testid="grade-floating-note" className="w-[26rem] shrink-0 flex flex-col items-center justify-center gap-3 border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ส่วนตรวจลอยอยู่ในหน้าต่างเล็ก", "The grading is in the small window")}</p>
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">{t("ให้คะแนนที่นั่นได้เลย — คะแนนที่คลิกจะอยู่ในหน้านี้ด้วย ปิดหน้าต่างเล็กหรือกดปุ่มด้านล่างเพื่อเอากลับมา", "Grade there — what you click is held in this page too. Close the small window, or press the button below, to bring it back.")}</p>
              <button type="button" data-testid="grade-float-return" onClick={closeFloat} className="h-9 rounded-xl border border-[var(--border)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]">{t("เอาส่วนตรวจกลับมา", "Bring it back")}</button>
            </div>
            <FloatingPanel target={floatWin} title={`${t("ตรวจงาน", "Grade")} — ${submission.studentName}`} onClosed={() => setFloatWin(null)}>{gradePanel(true)}</FloatingPanel>
          </>
        ) : gradePanel(false)}
      </div>
  );
}
