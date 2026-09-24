"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, type Submission } from "@/lib/assignments";
import { useStudents, isWithdrawn } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { groupSubmissionsByTeam, SubmissionRow } from "@/lib/groupSubmissions";
import { useLanguage } from "@/context/LanguageContext";
import { getInitials } from "@/lib/utils";
import SearchInput from "@/components/SearchInput";
import PillTabBar from "@/components/PillTabBar";
import WithdrawnTabs, { type WithdrawnTab } from "@/components/WithdrawnTabs";
import ExamScoreTable from "@/components/ExamScoreTable";
import { useCohortStudents } from "@/lib/cohort-students";

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}{" "}
        <span className="text-sm font-normal text-[var(--text-muted)]">{sub}</span>
      </p>
    </div>
  );
}

// ── Circle progress ────────────────────────────────────────────────────────

function CircleProgress({ pct, className }: { pct: number; className?: string }) {
  const [displayPct, setDisplayPct] = useState(0);
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = (displayPct / 100) * circ;

  useEffect(() => {
    const timer = setTimeout(() => setDisplayPct(pct), 80);
    return () => clearTimeout(timer);
  }, [pct]);

  return (
    <svg width="200" height="200" viewBox="0 0 200 200" className={className}>
      <circle cx="100" cy="100" r={r} fill="none" stroke="#E5E7EB" strokeWidth="12" />
      <circle
        cx="100" cy="100" r={r}
        fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
        transform="rotate(-90 100 100)"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.23, 1, 0.32, 1)" }}
      />
      <text x="100" y="112" textAnchor="middle" fill="var(--text-primary, #1B2A4A)"
        fontSize="38" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">
        {Math.round(displayPct)}%
      </text>
    </svg>
  );
}

// ── Grade adjustment row ───────────────────────────────────────────────────

interface RowState {
  regrading: boolean;
}

function GradeRow({
  row,
  maxPoints,
  rowState,
  onRegrade,
  reviewHref,
  acceptsFiles,
}: {
  row: SubmissionRow;
  maxPoints: number;
  rowState: RowState;
  onRegrade: () => void;
  /** Where the Grade link opens this row's submission (recheck page, keyed by the representative submission). */
  reviewHref: string;
  /** Re-grade (AI) only makes sense when there's a file for it to check (23/9/2569 round 3). */
  acceptsFiles: boolean;
}) {
  const { t } = useLanguage();
  const rep = row.subs[0];
  const isTeam = !!row.teamName;

  // Score here is read-only display only (23/9/2569, corrects the 22/9 merge — the instructor never
  // edits a score inline in this table; the only place to change one is the per-criterion recheck page,
  // reached via the Review/Recheck link below). The effective score is the instructor's saved override
  // once one exists, else the AI's own score; "Edited" marks a submission where those two differ.
  const displayScore = rep.instructorScore ?? rep.aiScore;
  const isModified = rep.instructorScore !== null && rep.instructorScore !== rep.aiScore;

  const STATUS_MAP = {
    not_graded: { label: t("ยังไม่ได้ตรวจ", "Not graded"), cls: "bg-[var(--bg-subtle)] text-[var(--text-secondary)]" },
    need_review: { label: t("รอตรวจสอบ", "Needs review"), cls: "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)]" },
    graded: { label: t("ตรวจแล้ว", "Graded"), cls: "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]" },
  };
  const mixedStatus = new Set(row.subs.map((s) => s.status)).size > 1;
  const statusInfo = mixedStatus
    ? { label: t("ไม่ตรงกัน", "Mixed"), cls: "bg-[var(--s-warn-bg)] text-[var(--s-warn-text)]" }
    : STATUS_MAP[rep.status];

  return (
    <tr className={`border-b border-gray-100 last:border-0 transition-colors ${isModified ? "bg-amber-50" : "hover:bg-gray-50"}`}>
      {/* Student / team */}
      <td className="px-4 py-3">
        {isTeam ? (
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate mb-1">{row.teamName}</p>
            <div className="flex items-center">
              {row.subs.map((s, idx) => (
                <div
                  key={s.id}
                  className="w-6 h-6 rounded-full bg-[var(--accent-bright)]/20 text-[var(--accent)] text-[9px] font-bold flex items-center justify-center shrink-0 select-none border-2 border-white"
                  style={{ marginLeft: idx > 0 ? "-8px" : 0 }}
                  title={s.studentName}
                >
                  {getInitials(s.studentName)}
                </div>
              ))}
              <p className="text-xs text-gray-400 truncate ml-2">{row.subs.map((s) => s.studentName).join(", ")}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[var(--accent-bright)]/20 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center shrink-0 select-none" aria-hidden="true">
              {getInitials(rep.studentName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{rep.studentName}</p>
              <p className="text-xs text-gray-400 truncate">{rep.email}</p>
            </div>
          </div>
        )}
      </td>

      {/* Submitted at */}
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {new Date(rep.submittedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
      </td>

      {/* Score — read-only (23/9/2569). Editing happens only on the recheck page, per criterion. */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm tabular-nums ${isModified ? "font-semibold text-amber-700" : "text-[var(--text-primary)]"}`}>
            {displayScore !== null ? displayScore : "—"}
          </span>
          <span className="text-gray-300 text-xs">/{maxPoints}</span>
          {isModified && rep.aiScore !== null && (
            <span className="text-[10px] text-gray-400 whitespace-nowrap">{t(`AI: ${rep.aiScore}`, `AI: ${rep.aiScore}`)}</span>
          )}
          {isModified && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded whitespace-nowrap">
              {t("แก้ไขแล้ว", "Edited")}
            </span>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
      </td>

      {/* Grade — opens the submission (moved here from the assignment detail page). Always visible
          regardless of status (23/9/2569 round 3, was gated on need_review/graded, i.e. required an
          AI score to exist first — a teacher couldn't jump straight into a no-AI assignment to enter a
          score by hand). One consistent label instead of the old status-dependent Review/Recheck text.
          Styled as an outlined pill button (22/9/2569) — matches the Re-grade button next to it. */}
      <td className="px-4 py-3 whitespace-nowrap">
        <Link
          href={reviewHref}
          className="inline-flex items-center h-7 px-2.5 whitespace-nowrap rounded-lg border border-[var(--accent)]/30 text-xs font-medium text-[var(--accent)] hover:border-[var(--accent)] hover:bg-[var(--accent-bright)]/10 active:scale-[0.97] transition-all"
        >
          {isTeam ? t("ตรวจทั้งทีม", "Grade team") : t("ตรวจ", "Grade")}
        </Link>
      </td>

      {/* Re-grade (AI) button — hidden when the assignment doesn't accept files (23/9/2569 round 3,
          nothing for AI to check); the teacher grades those entirely by hand via the Grade link above. */}
      <td className="px-4 py-3">
        {acceptsFiles && (
          <button
            onClick={onRegrade}
            disabled={rowState.regrading}
            aria-label={isTeam ? t(`Re-grade team ${row.teamName}`, `Re-grade team ${row.teamName}`) : t(`Re-grade ${rep.studentName}`, `Re-grade ${rep.studentName}`)}
            className="flex items-center gap-1.5 h-7 px-2.5 whitespace-nowrap rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:border-[var(--accent-bright)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/5 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-all"
          >
            {rowState.regrading ? (
              <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.56"/>
              </svg>
            )}
            {t("Re-grade", "Re-grade")}
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Grade adjustment table ─────────────────────────────────────────────────

type StatusFilter = "all" | "need_review" | "not_graded" | "graded";

function GradeAdjustmentTable({
  rows,
  maxPoints,
  courseId,
  assignmentId,
  isGroup,
  onSaveAll,
  acceptsFiles,
}: {
  rows: SubmissionRow[];
  maxPoints: number;
  courseId: string;
  assignmentId: string;
  isGroup: boolean;
  onSaveAll: (changes: Record<string, number | null>) => void;
  acceptsFiles: boolean;
}) {
  const { t } = useLanguage();

  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(rows.map((row) => [row.key, { regrading: false }]))
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Search matches student name / email / team name; the status filter looks at the representative submission.
  const q = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (statusFilter !== "all" && row.subs[0].status !== statusFilter) return false;
    if (!q) return true;
    return [row.teamName ?? "", ...row.subs.flatMap((s) => [s.studentName, s.email])].some((f) => f.toLowerCase().includes(q));
  });
  const countBy = (st: Submission["status"]) => rows.filter((r) => r.subs[0].status === st).length;

  async function handleRegrade(row: SubmissionRow) {
    setRowStates((prev) => ({ ...prev, [row.key]: { regrading: true } }));
    await new Promise((r) => setTimeout(r, 1500));
    // Mock: regenerate score within ±15% of maxPoints
    const newScore = Math.round(maxPoints * (0.55 + Math.random() * 0.4));
    setRowStates((prev) => ({ ...prev, [row.key]: { regrading: false } }));
    // Every team member's submission gets the same re-graded score.
    const changes: Record<string, number> = {};
    row.subs.forEach((s) => { changes[s.id] = newScore; });
    onSaveAll(changes);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("ปรับคะแนน", "Grade Adjustment")}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t(
              `${rows.length} รายการ — กด "ตรวจ" เพื่อแก้คะแนนรายเกณฑ์ หรือกด Re-grade เพื่อให้ AI ตรวจใหม่ทั้งชิ้น`,
              `${rows.length} row(s) — open Grade to edit per-criterion scores, or Re-grade to have AI re-check the whole submission`
            )}
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 flex-wrap">
          <PillTabBar
            ariaLabel={t("กรองตามสถานะ", "Filter by status")}
            activeKey={statusFilter}
            onChange={(k) => setStatusFilter(k as StatusFilter)}
            tabs={[
              { key: "all", label: t("ทั้งหมด", "All"), count: rows.length },
              { key: "need_review", label: t("รอตรวจสอบ", "Needs review"), count: countBy("need_review") },
              { key: "not_graded", label: t("ยังไม่ตรวจ", "Not graded"), count: countBy("not_graded") },
              { key: "graded", label: t("ตรวจแล้ว", "Graded"), count: countBy("graded") },
            ]}
          />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("ค้นหานักศึกษา...", "Search students...")}
            ariaLabel={t("ค้นหานักศึกษา", "Search students")}
            suggestions={rows.flatMap((r) => r.subs.map((s) => s.studentName))}
            className="w-56 shrink-0"
          />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {t("ยังไม่มีการส่งงาน", "No submissions yet")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("นักศึกษา", "Student")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("วันที่ส่ง", "Submitted")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("คะแนน", "Score")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("สถานะ", "Status")}</th>
                <th scope="col" className="px-4 py-2.5 w-32" aria-label={t("ตรวจ", "Grade")}></th>
                <th scope="col" className="px-4 py-2.5 w-32" aria-label={t("Re-grade", "Re-grade")}></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผลการค้นหา", "No results found")}</td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <GradeRow
                  key={row.key}
                  row={row}
                  maxPoints={maxPoints}
                  rowState={rowStates[row.key] ?? { regrading: false }}
                  onRegrade={() => handleRegrade(row)}
                  reviewHref={`/teacher/courses/${courseId}/assignments/${assignmentId}/recheck?sub=${row.subs[0].id}`}
                  acceptsFiles={acceptsFiles}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <div className="px-5 py-3 text-xs text-[var(--text-secondary)] border-t border-gray-100" aria-live="polite">
          {t("แสดง", "Showing")} <span className="font-medium text-[var(--text-primary)]">1–{visibleRows.length}</span> {t("จาก", "of")} <span className="font-medium text-[var(--text-primary)]">{visibleRows.length}</span>{" "}
          {isGroup ? t("ทีม", "team(s)") : t("งาน", "submissions")}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function GradingProgressPage() {
  const { id, assignmentId } = useParams<{ id: string; assignmentId: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getAssignment, getSubmissionsByAssignment, addSubmission, updateSubmission, updateAssignment } = useAssignments();
  const { findByStudentId } = useCohortStudents();
  const { getGroupsByAssignment } = useStudentGroups();
  const { getStudentsByCourse } = useStudents();
  const [tabState, setTabState] = useState<WithdrawnTab>("active");

  const course = getCourse(id);
  const assignment = getAssignment(assignmentId);
  const submissions = getSubmissionsByAssignment(assignmentId);

  if (!course || !assignment) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบข้อมูล", "Not found")} —{" "}
          <Link href={`/teacher/courses/${id}/assignments`} className="text-[var(--accent)] ml-1 hover:underline">
            {t("กลับหน้างาน", "Back to assignments")}
          </Link>
        </main>
    );
  }

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
  const gradedOf = new Map(submissions.filter((s) => s.status === "graded").map((s) => [s.studentId, s.instructorScore ?? s.aiScore ?? 0]));
  const examScores = Object.fromEntries(gradedOf);
  const activeScores = activeStudents.filter((s) => gradedOf.has(s.studentId)).map((s) => gradedOf.get(s.studentId) as number);

  const enrolled = activeCount;
  const total = isExam ? activeCount : rows.length;
  const processed = isExam ? activeScores.length : repSubs.filter((s) => s.status === "graded").length;
  const needsReview = isExam ? 0 : repSubs.filter((s) => s.status === "need_review").length;
  const scoredSubs = repSubs.filter((s) => s.aiScore !== null);
  const avgScore = isExam
    ? (activeScores.length > 0 ? activeScores.reduce((a, b) => a + b, 0) / activeScores.length : null)
    : scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.aiScore ?? 0), 0) / scoredSubs.length
      : null;
  const topScore = activeScores.length > 0 ? Math.max(...activeScores) : null;
  const pct = total > 0 ? (processed / total) * 100 : 0;
  const isDone = total > 0 && processed === total;
  const finalized = !!assignment.gradingFinalized;

  function handleFinishGrading() {
    updateAssignment(assignmentId, { gradingFinalized: true });
  }
  function handleReopenGrading() {
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
      <main className="w-full px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชา", "Courses")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/grading`} className="hover:text-[var(--accent)] transition-colors">{t("ตรวจงาน", "Grading")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/assignments/${assignmentId}`} className="text-[var(--text-primary)] font-medium hover:text-[var(--accent)] transition-colors">{assignment.name}</Link>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{assignment.name}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>
                {assignment.dueDate
                  ? <>{t("ส่งภายใน", "Due")}{" "}{new Date(assignment.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}{" "}
                    {t("เวลา 23:59 น.", "at 11:59 PM")}</>
                  : t("สอบ · ไม่มีกำหนดส่ง", "Exam · no due date")}
              </span>
              <span className="font-medium text-[var(--accent)]">• {t("ตรวจงาน", "Grading")}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={`/teacher/courses/${id}/assignments/${assignmentId}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              {t("แก้ไขงาน", "Edit Assignment")}
            </Link>
            {isDone && finalized ? (
              <>
                <Link
                  href={`/teacher/courses/${id}/assignments/${assignmentId}/results`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="9 11 12 14 22 4"/>
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  {t("ดูผลลัพธ์", "View Results")}
                </Link>
                {/* Safety valve (23/9/2569) — finalizing was never meant to be a one-way door. */}
                <button
                  type="button"
                  onClick={handleReopenGrading}
                  className="text-xs text-gray-400 hover:text-[var(--text-secondary)] hover:underline transition-colors"
                >
                  {t("เปิดตรวจใหม่", "Reopen grading")}
                </button>
              </>
            ) : isDone ? (
              // Grading finished at 100% but not yet finalized: the teacher must actively confirm
              // before Score Book locks and View Results becomes reachable (23/9/2569).
              <button
                type="button"
                onClick={handleFinishGrading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {t("เสร็จสิ้นการตรวจ", "Finish Grading")}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent-bright)]/60 text-[var(--text-primary)] text-sm font-semibold select-none">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                {t("กำลังตรวจ", "Grading")}
              </span>
            )}
          </div>
        </div>

        {/* Enrolled / Withdrawn — only appears once someone has withdrawn */}
        <WithdrawnTabs tab={tab} onChange={setTabState} activeCount={isExam ? activeCount : rows.length} withdrawnCount={withdrawnCount} />

        {tab === "active" && (<>
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label={isExam ? t("ให้คะแนนแล้ว", "Scored") : t("ตรวจแล้ว", "Processed")}
            value={processed}
            sub={isExam ? t(`จาก ${total} คน`, `of ${total} students`) : t("เสร็จสิ้น", "completed")}
            color="var(--s-ok-text)"
            icon={
              <div className="w-7 h-7 rounded-full bg-[var(--s-ok-bg)] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--s-ok-text)" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            }
          />
          <StatCard
            label={isExam ? t("ยังไม่มีคะแนน", "Not scored yet") : isGroupAssignment ? t("ทีมทั้งหมด", "Total Teams") : t("ส่งแล้ว", "Submitted")}
            value={isExam ? total - processed : total}
            sub={isExam ? t("คน", "students") : isGroupAssignment
              ? t("ทีม", "team(s)")
              : enrolled > 0
                ? t(`/ ${enrolled} · ยังไม่ส่ง ${Math.max(0, enrolled - total)}`, `/ ${enrolled} · ${Math.max(0, enrolled - total)} pending`)
                : t("งานที่ส่ง", "submissions")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            }
          />
          <StatCard
            label={isExam ? t("คะแนนสูงสุด", "Highest") : t("รอตรวจสอบ", "Needs Review")}
            value={isExam ? (topScore ?? "—") : needsReview}
            sub={isExam ? t(`เต็ม ${assignment.maxPoints}`, `of ${assignment.maxPoints}`) : t("รอดำเนินการ", "Pending")}
            color={isExam ? "var(--accent)" : "var(--s-warn-text)"}
            icon={isExam ? (
              <div className="w-7 h-7 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                </svg>
              </div>
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[var(--s-warn-bg)] flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--s-warn-text)" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            )}
          />
          <StatCard
            label={t("คะแนนเฉลี่ย", "Avg. Score")}
            value={avgScore !== null ? avgScore.toFixed(1) : "—"}
            sub={t("จนถึงขณะนี้", "so far")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            }
          />
        </div>

        {/* Progress circle */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-5">
          <div className="flex items-center gap-6">
            <CircleProgress pct={total > 0 ? pct : 0} className="w-28 h-28 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                {t("ความคืบหน้า", "Overall Progress")}
              </p>
              <p className="text-base font-semibold text-[var(--text-primary)]">
                {total === 0
                  ? (isExam ? t("ยังไม่มีนักศึกษาในวิชานี้", "No students yet") : t("ยังไม่มีการส่งงาน", "No Submissions Yet"))
                  : isDone
                  ? (isExam ? t("ให้คะแนนครบทุกคนแล้ว", "Everyone is scored") : t("ตรวจเสร็จแล้ว", "Grading Complete"))
                  : (isExam ? t("กำลังกรอกคะแนน", "Entering scores") : t("กำลังวิเคราะห์งาน", "Analyzing Submissions"))}
              </p>
              {!isDone && total > 0 && !isExam && (
                <p className="text-sm text-gray-400 mt-1">
                  {t("เวลาที่เหลือโดยประมาณ:", "Estimated remaining time:")}{" "}
                  <span className="text-[var(--accent)] font-medium">
                    ~{Math.max(1, Math.round((total - processed) * 0.3))} {t("นาที", "mins")}
                  </span>
                </p>
              )}
              {isDone && finalized && (
                <Link
                  href={`/teacher/courses/${id}/assignments/${assignmentId}/results`}
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold rounded-xl transition-colors"
                >
                  {t("ดูผลลัพธ์", "View Results")} →
                </Link>
              )}
              {isDone && !finalized && (
                <button
                  type="button"
                  onClick={handleFinishGrading}
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold rounded-xl transition-colors"
                >
                  {t("เสร็จสิ้นการตรวจ", "Finish Grading")}
                </button>
              )}
            </div>
          </div>
        </div>

        </>)}

        {isExam ? (
          <ExamScoreTable
            key={tab}
            students={tab === "active" ? activeStudents : withdrawnStudents}
            titleOf={(sid) => findByStudentId(sid)?.title}
            scores={examScores}
            maxPoints={assignment.maxPoints}
            readOnly={tab === "withdrawn" || finalized}
            readOnlyReason={tab === "withdrawn"
              ? t("นักศึกษาที่ถอนแล้ว — ดูอย่างเดียว", "Withdrawn students — view only")
              : t("ตรวจเสร็จสิ้นแล้ว — กด “เปิดตรวจใหม่” ถ้าต้องแก้คะแนน", "Grading is finished — press “Reopen grading” to change scores")}
            onSave={handleSaveExamScores}
          />
        ) : (
        /* Grade Adjustment table */
        <GradeAdjustmentTable
          key={tab}
          rows={tab === "active" ? rows : withdrawnRows}
          maxPoints={assignment.maxPoints}
          courseId={id}
          assignmentId={assignmentId}
          isGroup={isGroupAssignment}
          onSaveAll={handleSaveChanges}
          acceptsFiles={assignment.acceptsFiles ?? true}
        />
        )}
      </main>
  );
}
