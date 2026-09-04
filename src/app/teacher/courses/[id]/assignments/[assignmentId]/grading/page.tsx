"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useAssignments, Submission } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";
import { getInitials } from "@/lib/utils";

// ── Stat card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</p>
        {icon}
      </div>
      <p className="text-3xl font-bold" style={{ color: color ?? "#1B2A4A" }}>
        {value}{" "}
        <span className="text-sm font-normal text-gray-400">{sub}</span>
      </p>
    </div>
  );
}

// ── Circle progress ────────────────────────────────────────────────────────

function CircleProgress({ pct }: { pct: number }) {
  const [displayPct, setDisplayPct] = useState(0);
  const r = 80;
  const circ = 2 * Math.PI * r;
  const dash = (displayPct / 100) * circ;

  useEffect(() => {
    const timer = setTimeout(() => setDisplayPct(pct), 80);
    return () => clearTimeout(timer);
  }, [pct]);

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#E5E7EB" strokeWidth="12" />
      <circle
        cx="100" cy="100" r={r}
        fill="none" stroke="#0F766E" strokeWidth="12" strokeLinecap="round"
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
  sub,
  maxPoints,
  rowState,
  onChange,
  onRegrade,
}: {
  sub: Submission;
  maxPoints: number;
  rowState: RowState;
  onChange: (val: string) => void;
  onRegrade: () => void;
}) {
  const { t } = useLanguage();

  const parsedInstructor = rowState.instructorScore === "" ? null : parseFloat(rowState.instructorScore);
  const isModified =
    parsedInstructor !== null &&
    !isNaN(parsedInstructor) &&
    parsedInstructor !== sub.aiScore;

  const STATUS_MAP = {
    not_graded: { label: t("ยังไม่ได้ตรวจ", "Not graded"), cls: "bg-gray-100 text-gray-500" },
    need_review: { label: t("รอตรวจสอบ", "Needs review"), cls: "bg-amber-100 text-amber-700" },
    graded: { label: t("ตรวจแล้ว", "Graded"), cls: "bg-green-100 text-green-700" },
  };
  const statusInfo = STATUS_MAP[sub.status];

  return (
    <tr className={`border-b border-gray-100 last:border-0 transition-colors ${isModified ? "bg-amber-50" : "hover:bg-gray-50"}`}>
      {/* Student */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#2DD4BF]/20 text-[#0F766E] text-[10px] font-bold flex items-center justify-center shrink-0 select-none" aria-hidden="true">
            {getInitials(sub.studentName)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{sub.studentName}</p>
            <p className="text-xs text-gray-400 truncate">{sub.email}</p>
          </div>
        </div>
      </td>

      {/* Submitted at */}
      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        {new Date(sub.submittedAt).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
      </td>

      {/* AI Score */}
      <td className="px-4 py-3 text-sm tabular-nums">
        {sub.aiScore !== null ? (
          <span className={isModified ? "text-gray-400 line-through" : "text-[var(--text-primary)] font-semibold"}>
            {sub.aiScore}
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
            placeholder={sub.aiScore !== null ? String(sub.aiScore) : "—"}
            aria-label={t(`คะแนนอาจารย์ของ ${sub.studentName}`, `Instructor score for ${sub.studentName}`)}
            className={`w-20 h-8 rounded-lg border text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] transition-colors ${
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
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusInfo.cls}`}>
          {statusInfo.label}
        </span>
      </td>

      {/* Re-grade button */}
      <td className="px-4 py-3">
        <button
          onClick={onRegrade}
          disabled={rowState.regrading}
          aria-label={t(`Re-grade ${sub.studentName}`, `Re-grade ${sub.studentName}`)}
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-500 hover:border-[#2DD4BF] hover:text-[#0F766E] hover:bg-[#2DD4BF]/5 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-all"
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

function GradeAdjustmentTable({
  submissions,
  maxPoints,
  onSaveAll,
}: {
  submissions: Submission[];
  maxPoints: number;
  onSaveAll: (changes: Record<string, number | null>) => void;
}) {
  const { t } = useLanguage();

  const [rowStates, setRowStates] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      submissions.map((s) => [
        s.id,
        {
          instructorScore: s.instructorScore !== null ? String(s.instructorScore) : "",
          regrading: false,
        },
      ])
    )
  );

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const modifiedCount = useMemo(() => {
    return submissions.filter((sub) => {
      const val = rowStates[sub.id]?.instructorScore ?? "";
      const parsed = val === "" ? null : parseFloat(val);
      return parsed !== null && !isNaN(parsed) && parsed !== sub.aiScore;
    }).length;
  }, [rowStates, submissions]);

  function updateRow(id: string, val: string) {
    // Clamp to [0, maxPoints]
    const parsed = parseFloat(val);
    let clamped = val;
    if (!isNaN(parsed)) clamped = String(Math.min(maxPoints, Math.max(0, parsed)));
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], instructorScore: clamped } }));
  }

  async function handleRegrade(subId: string) {
    setRowStates((prev) => ({ ...prev, [subId]: { ...prev[subId], regrading: true } }));
    await new Promise((r) => setTimeout(r, 1500));
    // Mock: regenerate score within ±15% of maxPoints
    const newScore = Math.round(maxPoints * (0.55 + Math.random() * 0.4));
    setRowStates((prev) => ({
      ...prev,
      [subId]: { instructorScore: "", regrading: false },
    }));
    onSaveAll({ [subId]: newScore }); // immediately persist new aiScore mock
  }

  function handleSaveAll() {
    setSaving(true);
    const changes: Record<string, number | null> = {};
    submissions.forEach((sub) => {
      const val = rowStates[sub.id]?.instructorScore ?? "";
      const parsed = val === "" ? null : parseFloat(val);
      if (parsed !== null && !isNaN(parsed) && parsed !== sub.aiScore) {
        changes[sub.id] = parsed;
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
              `${submissions.length} คน — พิมพ์ "คะแนนอาจารย์" เพื่อ override AI หรือกด Re-grade เพื่อให้ AI ตรวจใหม่`,
              `${submissions.length} submission(s) — type an instructor score to override AI, or Re-grade to re-run AI`
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
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
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

      {submissions.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          {t("ยังไม่มีการส่งงาน", "No submissions yet")}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("นักศึกษา", "Student")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("วันที่ส่ง", "Submitted")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("คะแนน AI", "AI Score")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("คะแนนอาจารย์", "Instructor Score")}</th>
                <th scope="col" className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("สถานะ", "Status")}</th>
                <th scope="col" className="px-4 py-2.5 w-28"><span className="sr-only">{t("Re-grade", "Re-grade")}</span></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <GradeRow
                  key={sub.id}
                  sub={sub}
                  maxPoints={maxPoints}
                  rowState={rowStates[sub.id] ?? { instructorScore: "", regrading: false }}
                  onChange={(val) => updateRow(sub.id, val)}
                  onRegrade={() => handleRegrade(sub.id)}
                />
              ))}
            </tbody>
          </table>
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

  const total = submissions.length;
  const processed = submissions.filter((s) => s.status === "graded").length;
  const needsReview = submissions.filter((s) => s.status === "need_review").length;
  const scoredSubs = submissions.filter((s) => s.aiScore !== null);
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
      <main className="w-full max-w-[1100px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5 flex-wrap">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชา", "Courses")}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/assignments`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}/assignments/${assignmentId}`} className="hover:text-[var(--accent)] transition-colors">{assignment.name}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{t("ตรวจงาน", "Grading")}</span>
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
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2DD4BF]/60 text-[var(--text-primary)] text-sm font-semibold select-none">
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
            color="#059669"
            icon={
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            }
          />
          <StatCard
            label={t("ไฟล์ทั้งหมด", "Total Files")}
            value={total}
            sub={t("ไฟล์ที่ส่ง", "submissions")}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
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
            color="#D97706"
            icon={
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
            {t("ความคืบหน้า", "Overall Progress")}
          </p>
          <div className="flex flex-col items-center justify-center py-8 gap-6">
            <CircleProgress pct={total > 0 ? pct : 0} />
            <div className="text-center">
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
          submissions={submissions}
          maxPoints={assignment.maxPoints}
          onSaveAll={handleSaveChanges}
        />
      </main>
  );
}
