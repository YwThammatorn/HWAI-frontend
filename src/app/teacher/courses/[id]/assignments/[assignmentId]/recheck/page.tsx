"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, RubricCriterion, submissionAttachments } from "@/lib/assignments";
import SubmissionViewer from "@/components/SubmissionViewer";
import { useStudentGroups } from "@/lib/studentGroups";
import { useLanguage } from "@/context/LanguageContext";

function genFeedback(name: string, level: "high" | "low"): string {
  if (level === "high") {
    return `Good demonstration of ${name.toLowerCase()}. The work clearly meets expectations and shows solid understanding of the required concepts.`;
  }
  return `Minor issues found in ${name.toLowerCase()}. Consider revising the final section for clarity and accuracy.`;
}

interface CriterionScore {
  criterionId: string;
  score: number;
  maxPoints: number;
  aiFeedback: string;
  edited: boolean;
}

export default function RecheckPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, lang } = useLanguage();
  const subId = searchParams.get("sub") ?? "";

  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, getRubricsByAssignment, updateSubmission } = useAssignments();
  const { getGroupsByAssignment } = useStudentGroups();

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
  const [scores, setScores] = useState<CriterionScore[]>([]);
  // Exam-type assignments have no rubric (23/9/2569) — the whole score is typed in directly here.
  const [manualScore, setManualScore] = useState(0);
  const [saved, setSaved] = useState(false);
  const [comment, setComment] = useState(submission?.instructorComment ?? "");
  // Per-criterion notes ("why I changed this score"), keyed by criterion id
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>(submission?.criterionComments ?? {});

  useEffect(() => {
    if (!submission) return;
    const aiScore = submission.instructorScore ?? submission.aiScore ?? 0;
    if (rubric) {
      const initial: CriterionScore[] = rubric.criteria.map((c: RubricCriterion) => {
        const pts = Math.round((c.weight / 100) * aiScore);
        return {
          criterionId: c.id,
          score: pts,
          maxPoints: c.maxPoints,
          aiFeedback: genFeedback(c.name, pts / c.maxPoints >= 0.7 ? "high" : "low"),
          edited: false,
        };
      });
      setScores(initial);
    } else {
      setManualScore(aiScore);
    }
    setCriterionComments(submission.criterionComments ?? {});
  }, [rubric?.id, submission?.id]);

  if (!course || !assignment || !submission) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
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

  const totalScore = rubric ? scores.reduce((sum, s) => sum + s.score, 0) : manualScore;
  const totalMax = rubric ? (scores.reduce((sum, s) => sum + s.maxPoints, 0) || assignment.maxPoints) : assignment.maxPoints;
  const aiScore = submission.aiScore ?? 0;
  const aiPct = (aiScore / assignment.maxPoints) * 100;
  const aiConfidence = aiPct >= 85
    ? { label: "High", labelTh: "สูง", pct: 92, color: "#0F766E" }
    : aiPct >= 65
    ? { label: "Medium", labelTh: "ปานกลาง", pct: 74, color: "#B45309" }
    : { label: "Low", labelTh: "ต่ำ", pct: 48, color: "#DC2626" };

  function updateScore(cid: string, val: number) {
    setScores((prev) =>
      prev.map((s) => s.criterionId === cid ? { ...s, score: Math.max(0, Math.min(s.maxPoints, val)), edited: true } : s)
    );
    setSaved(false);
  }

  function resetToDefault() {
    if (!submission) return;
    const aiScore = submission.aiScore ?? 0;
    if (rubric) {
      setScores(rubric.criteria.map((c: RubricCriterion) => ({
        criterionId: c.id,
        score: Math.round((c.weight / 100) * aiScore),
        maxPoints: c.maxPoints,
        aiFeedback: genFeedback(c.name, (Math.round((c.weight / 100) * aiScore)) / c.maxPoints >= 0.7 ? "high" : "low"),
        edited: false,
      })));
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
    const criterionScores = Object.fromEntries(scores.map((s) => [s.criterionId, s.score]));
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

  return (
      <div className="flex h-full overflow-hidden">
        {/* Left: file viewer */}
        <div className="flex-1 min-w-0 flex flex-col bg-[var(--surface)] overflow-hidden">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-3 px-5 py-2.5 bg-white border-b border-gray-100 shadow-sm">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              {t("มุมมอง", "View")}:
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(25, z - 25))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-sm font-bold transition-colors"
            >
              −
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)] w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(200, z + 25))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 text-sm font-bold transition-colors"
            >
              +
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1" />
            <button
              onClick={() => setZoom(100)}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title={t("รีเซ็ตการซูม", "Reset zoom")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
              </svg>
            </button>
          </div>

          {/* What the student submitted; the sandbox placeholder when nothing was attached */}
          <SubmissionViewer
            attachments={submissionAttachments(submission)}
            zoom={zoom}
            caption={[
              submission.studentName,
              team ? t(`ทีม ${team.name}`, `Team ${team.name}`) : null,
              `${t("ส่งเมื่อ", "Submitted")} ${new Date(submission.submittedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
            ].filter(Boolean).join(" · ")}
            empty={
          <div className="flex-1 overflow-auto flex items-start justify-center p-8">
            <div
              className="bg-white shadow-xl rounded-sm transition-all origin-top"
              style={{ width: `${zoom * 5}px`, minHeight: `${zoom * 7}px`, transform: `scale(1)` }}
            >
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{submission.studentName}</p>
                  {team && (
                    <p className="text-xs text-[var(--accent)] mb-1">
                      {t(`ทีม ${team.name} — คะแนนนี้จะใช้กับสมาชิกทุกคน`, `Team ${team.name} — this grade applies to every member`)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {t("ส่งเมื่อ", "Submitted")}{" "}
                    {new Date(submission.submittedAt).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-gray-300 mt-3">
                    {t("ไม่สามารถแสดงตัวอย่างไฟล์ในโหมดทดสอบ", "File preview not available in sandbox mode")}
                  </p>
                </div>
              </div>
            </div>
          </div>
            }
          />
        </div>

        {/* Right: grading panel */}
        <div className="w-80 shrink-0 flex flex-col border-l border-gray-100 bg-white overflow-y-auto">
          <div className="px-5 py-5 border-b border-gray-50">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-3">
              {t("ตรวจสอบการให้คะแนน", "Grading Review")}
            </h2>
            {/* AI confidence */}
            <div className="flex items-center gap-2 mb-1">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--accent)]">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="text-xs font-medium text-[var(--text-primary)]">
                {t("ความมั่นใจ AI", "AI Confidence")}:{" "}
                <span style={{ color: aiConfidence.color }} className="font-semibold">
                  {lang === "th" ? aiConfidence.labelTh : aiConfidence.label} ({aiConfidence.pct}%)
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${aiConfidence.pct}%`, backgroundColor: aiConfidence.color }}
              />
            </div>
          </div>

          {/* Criteria */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {!rubric && (
              <div className="rounded-xl border border-gray-100 bg-white p-4">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  {t("งานประเภทสอบ — ไม่มี rubric", "Exam assignment — no rubric")}
                </p>
                <p className="text-xs text-gray-500 mb-3">
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
                    className="w-20 text-center text-sm font-bold text-[var(--text-primary)] border border-gray-200 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                  />
                  <span className="text-xs text-gray-400">/ {assignment.maxPoints}</span>
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
                    s.edited ? "border-amber-200 bg-amber-50/30" : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {s.score / s.maxPoints >= 0.7 ? (
                        <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-100" />
                      )}
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                        {t("คะแนน", "Score")}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={s.maxPoints}
                        value={s.score}
                        onChange={(e) => updateScore(s.criterionId, parseInt(e.target.value) || 0)}
                        className="w-12 text-center text-sm font-bold text-[var(--text-primary)] border border-gray-200 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                      <span className="text-xs text-gray-400">/ {s.maxPoints}</span>
                    </div>
                  </div>

                  {s.edited && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded mb-2">
                      {t("แก้ไขแล้ว", "Manually Edited")}
                    </span>
                  )}

                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      {t("ความคิดเห็น AI", "AI Feedback")}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed">{s.aiFeedback}</p>
                  </div>

                  {/* Shown once the instructor overrides the score (or a note already exists) */}
                  {(s.edited || criterionComments[s.criterionId]) && (
                    <div className="mt-3">
                      <label
                        htmlFor={`criterion-note-${s.criterionId}`}
                        className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1"
                      >
                        {t("ข้อเสนอแนะถึง AI", "Feedback to AI")}
                      </label>
                      <p id={`criterion-note-hint-${s.criterionId}`} className="text-[11px] text-gray-400 leading-snug mb-1.5">
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
                        placeholder={t("เช่น AI ให้เข้มเกินไป เพราะ... (ไม่บังคับ)", "e.g. The AI was too strict because… (optional)")}
                        className="w-full text-xs text-[var(--text-primary)] resize-none border border-gray-200 rounded-lg px-2.5 py-2 bg-white placeholder:text-gray-300 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-colors"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Comment */}
            <div className="rounded-xl border border-gray-100 p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t("ความคิดเห็นอาจารย์", "Instructor Comment")}
              </p>
              <textarea
                value={comment}
                onChange={(e) => { setComment(e.target.value); setSaved(false); }}
                rows={3}
                placeholder={t("เพิ่มความคิดเห็นสำหรับนักศึกษา...", "Add a comment for the student...")}
                className="w-full text-xs text-[var(--text-primary)] resize-none border-0 outline-none bg-transparent placeholder:text-gray-300 leading-relaxed"
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
            </div>
          </div>

          {/* Footer actions */}
          <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
            <button
              onClick={resetToDefault}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
              {t("คืนค่าเดิม", "Reset to Default")}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-xs font-semibold transition-colors"
            >
              {saved ? `✓ ${t("บันทึกแล้ว!", "Saved!")}` : t("บันทึกการเปลี่ยนแปลง", "Save Changes")}
            </button>
          </div>
        </div>
      </div>
  );
}
