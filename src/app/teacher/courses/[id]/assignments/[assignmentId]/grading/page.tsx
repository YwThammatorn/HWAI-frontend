"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, type Submission } from "@/lib/assignments";
import { useStudents } from "@/lib/students";
import { useStudentGroups } from "@/lib/studentGroups";
import { groupSubmissionsByTeam, SubmissionRow } from "@/lib/groupSubmissions";
import { useLanguage } from "@/context/LanguageContext";
import { getInitials } from "@/lib/utils";
import SearchInput from "@/components/SearchInput";
import PillTabBar from "@/components/PillTabBar";

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
  instructorScore: string; // controlled input — string to allow empty
  regrading: boolean;
}

function GradeRow({
  row,
  maxPoints,
  rowState,
  onChange,
  onRegrade,
  reviewHref,
}: {
  row: SubmissionRow;
  maxPoints: number;
  rowState: RowState;
  onChange: (val: string) => void;
  onRegrade: () => void;
  /** Where "Review" / "Recheck" opens this row's submission (recheck page, keyed by the representative submission). */
  reviewHref: string;
}) {
  const { t } = useLanguage();
  const rep = row.subs[0];
  const isTeam = !!row.teamName;

  const parsedInstructor = rowState.instructorScore === "" ? null : parseFloat(rowState.instructorScore);
  const isModified =
    parsedInstructor !== null &&
    !isNaN(parsedInstructor) &&
    parsedInstructor !== rep.aiScore;

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

      {/* AI Score */}
      <td className="px-4 py-3 text-sm tabular-nums">
        {rep.aiScore !== null ? (
          <span className={isModified ? "text-gray-400 line-through" : "text-[var(--text-primary)] font-semibold"}>
            {rep.aiScore}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
        <span className="text-gray-300 text-xs">/{maxPoints}</span>
      </td>

      {/* Instructor score input */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={maxPoints}
            step={0.5}
            value={rowState.instructorScore}
            onChange={(e) => onChange(e.target.value)}
            placeholder={rep.aiScore !== null ? String(rep.aiScore) : "—"}
            aria-label={isTeam
              ? t(`คะแนนอาจารย์ของทีม ${row.teamName}`, `Instructor score for team ${row.teamName}`)
              : t(`คะแนนอาจารย์ของ ${rep.studentName}`, `Instructor score for ${rep.studentName}`)}
            className={`w-20 h-8 rounded-lg border text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)] transition-colors ${
              isModified
                ? "border-amber-300 bg-amber-50 text-amber-700 font-semibold"
                : "border-gray-200 bg-white text-[var(--text-primary)]"
            }`}
          />
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

      {/* Review / Recheck — opens the submission (moved here from the assignment detail page) */}
      <td className="px-4 py-3 whitespace-nowrap">
        {(rep.status === "need_review" || rep.status === "graded") && (
          <Link href={reviewHref} className="text-sm text-[var(--accent)] hover:underline font-medium">
            {rep.status === "need_review"
              ? t("ตรวจสอบ", "Review")
              : isTeam ? t("ขอตรวจใหม่ทั้งทีม", "Recheck team") : t("ขอตรวจใหม่", "Recheck")}
          </Link>
        )}
      </td>

      {/* Re-grade button */}
      <td className="px-4 py-3">
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
}: {
  rows: SubmissionRow[];
  maxPoints: number;
  courseId: string;
  assignmentId: string;
  isGroup: boolean;
  onSaveAll: (changes: Record<string, number | null>) => void;
}) {
  const { t } = useLanguage();

  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.key,
        {
          instructorScore: row.subs[0].instructorScore !== null ? String(row.subs[0].instructorScore) : "",
          regrading: false,
        },
      ])
    )
  );

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
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

  const modifiedCount = useMemo(() => {
    return rows.filter((row) => {
      const val = rowStates[row.key]?.instructorScore ?? "";
      const parsed = val === "" ? null : parseFloat(val);
      return parsed !== null && !isNaN(parsed) && parsed !== row.subs[0].aiScore;
    }).length;
  }, [rowStates, rows]);

  function updateRow(key: string, val: string) {
    // Clamp to [0, maxPoints]
    const parsed = parseFloat(val);
    let clamped = val;
    if (!isNaN(parsed)) clamped = String(Math.min(maxPoints, Math.max(0, parsed)));
    setRowStates((prev) => ({ ...prev, [key]: { ...prev[key], instructorScore: clamped } }));
  }

  async function handleRegrade(row: SubmissionRow) {
    setRowStates((prev) => ({ ...prev, [row.key]: { ...prev[row.key], regrading: true } }));
    await new Promise((r) => setTimeout(r, 1500));
    // Mock: regenerate score within ±15% of maxPoints
    const newScore = Math.round(maxPoints * (0.55 + Math.random() * 0.4));
    setRowStates((prev) => ({
      ...prev,
      [row.key]: { instructorScore: "", regrading: false },
    }));
    // Every team member's submission gets the same re-graded score.
    const changes: Record<string, number> = {};
    row.subs.forEach((s) => { changes[s.id] = newScore; });
    onSaveAll(changes);
  }

  function handleSaveAll() {
    setSaving(true);
    const changes: Record<string, number | null> = {};
    rows.forEach((row) => {
      const val = rowStates[row.key]?.instructorScore ?? "";
      const parsed = val === "" ? null : parseFloat(val);
      if (parsed !== null && !isNaN(parsed) && parsed !== row.subs[0].aiScore) {
        row.subs.forEach((s) => { changes[s.id] = parsed; });
      }
    });
    onSaveAll(changes);
    setSaving(false);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6 overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)]">{t("ปรับคะแนน", "Grade Adjustment")}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {t(
              `${rows.length} รายการ — พิมพ์ "คะแนนอาจารย์" เพื่อ override AI หรือกด Re-grade เพื่อให้ AI ตรวจใหม่`,
              `${rows.length} row(s) — type an instructor score to override AI, or Re-grade to re-run AI`
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && (
            <span role="status" className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-1.5">
              {t("บันทึกแล้ว ✓", "Saved ✓")}
            </span>
          )}
          <button
            onClick={handleSaveAll}
            disabled={modifiedCount === 0 || saving}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {saving ? (
              t("กำลังบันทึก…", "Saving…")
            ) : modifiedCount > 0 ? (
              t(`บันทึก ${modifiedCount} รายการ`, `Save ${modifiedCount} change(s)`)
            ) : (
              t("บันทึกทั้งหมด", "Save All")
            )}
          </button>
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
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("คะแนน AI", "AI Score")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("คะแนนอาจารย์", "Instructor Score")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{t("สถานะ", "Status")}</th>
                <th scope="col" className="px-4 py-2.5 w-32" aria-label={t("ตรวจสอบ", "Review")}></th>
                <th scope="col" className="px-4 py-2.5 w-32" aria-label={t("Re-grade", "Re-grade")}></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผลการค้นหา", "No results found")}</td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <GradeRow
                  key={row.key}
                  row={row}
                  maxPoints={maxPoints}
                  rowState={rowStates[row.key] ?? { instructorScore: "", regrading: false }}
                  onChange={(val) => updateRow(row.key, val)}
                  onRegrade={() => handleRegrade(row)}
                  reviewHref={`/teacher/courses/${courseId}/assignments/${assignmentId}/recheck?sub=${row.subs[0].id}`}
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
  const { getAssignment, getSubmissionsByAssignment, updateSubmission } = useAssignments();
  const { getGroupsByAssignment } = useStudentGroups();
  const { getStudentsByCourse } = useStudents();

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
  const rows: SubmissionRow[] = isGroupAssignment
    ? groupSubmissionsByTeam(submissions, groups, t("ทีม", "Team"))
    : submissions.map((s) => ({ key: s.id, subs: [s] }));
  const repSubs = rows.map((r) => r.subs[0]);

  const enrolled = getStudentsByCourse(id).length;
  const total = rows.length;
  const processed = repSubs.filter((s) => s.status === "graded").length;
  const needsReview = repSubs.filter((s) => s.status === "need_review").length;
  const scoredSubs = repSubs.filter((s) => s.aiScore !== null);
  const avgScore =
    scoredSubs.length > 0
      ? scoredSubs.reduce((sum, s) => sum + (s.aiScore ?? 0), 0) / scoredSubs.length
      : null;
  const pct = total > 0 ? (processed / total) * 100 : 0;
  const isDone = total > 0 && processed === total;

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
                {t("ส่งภายใน", "Due")}{" "}
                {new Date(assignment.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}{" "}
                {t("เวลา 23:59 น.", "at 11:59 PM")}
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
            {isDone ? (
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <StatCard
            label={t("ตรวจแล้ว", "Processed")}
            value={processed}
            sub={t("เสร็จสิ้น", "completed")}
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
            label={isGroupAssignment ? t("ทีมทั้งหมด", "Total Teams") : t("ส่งแล้ว", "Submitted")}
            value={total}
            sub={isGroupAssignment
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
            label={t("รอตรวจสอบ", "Needs Review")}
            value={needsReview}
            sub={t("รอดำเนินการ", "Pending")}
            color="var(--s-warn-text)"
            icon={
              <div className="w-7 h-7 rounded-lg bg-[var(--s-warn-bg)] flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--s-warn-text)" strokeWidth="2" strokeLinecap="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            }
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
                  ? t("ยังไม่มีการส่งงาน", "No Submissions Yet")
                  : isDone
                  ? t("ตรวจเสร็จแล้ว", "Grading Complete")
                  : t("กำลังวิเคราะห์งาน", "Analyzing Submissions")}
              </p>
              {!isDone && total > 0 && (
                <p className="text-sm text-gray-400 mt-1">
                  {t("เวลาที่เหลือโดยประมาณ:", "Estimated remaining time:")}{" "}
                  <span className="text-[var(--accent)] font-medium">
                    ~{Math.max(1, Math.round((total - processed) * 0.3))} {t("นาที", "mins")}
                  </span>
                </p>
              )}
              {isDone && (
                <Link
                  href={`/teacher/courses/${id}/assignments/${assignmentId}/results`}
                  className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-semibold rounded-xl transition-colors"
                >
                  {t("ดูผลลัพธ์", "View Results")} →
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Grade Adjustment table */}
        <GradeAdjustmentTable
          rows={rows}
          maxPoints={assignment.maxPoints}
          courseId={id}
          assignmentId={assignmentId}
          isGroup={isGroupAssignment}
          onSaveAll={handleSaveChanges}
        />
      </main>
  );
}
