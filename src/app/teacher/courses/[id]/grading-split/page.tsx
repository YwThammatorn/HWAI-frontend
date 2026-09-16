"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { GRADING_SPLIT_DISABLED } from "@/lib/featureFlags";
import { useCourses } from "@/lib/courses";
import { useSectionRoles } from "@/lib/section-roles";
import { useCohortStudents } from "@/lib/cohort-students";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useCurrentAccountId } from "@/lib/current-account";
import { useAssignments } from "@/lib/assignments";
import {
  useGradingAssignments,
  GradingAssignment,
  GradingAssignmentScope,
} from "@/lib/grading-assignments";
import { useLanguage } from "@/context/LanguageContext";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

interface TaCandidate { id: string; name: string; subtitle: string; }

/** A TA SectionRole's accountId can point to a CohortStudent OR a ManagedTeacher
 *  (see the FK comment on GradingAssignment.taAccountId in lib/grading-assignments.ts)
 *  — resolve against both, never just one. */
function resolveTaCandidates(
  taRoles: { accountId: string }[],
  cohortStudents: { id: string; firstName: string; lastName: string; studentId: string }[],
  teachers: { id: string; name: string; email: string }[]
): TaCandidate[] {
  return taRoles
    .map((r): TaCandidate | null => {
      const student = cohortStudents.find((s) => s.id === r.accountId);
      if (student) return { id: student.id, name: `${student.firstName} ${student.lastName}`, subtitle: student.studentId };
      const teacher = teachers.find((tc) => tc.id === r.accountId);
      if (teacher) return { id: teacher.id, name: teacher.name, subtitle: teacher.email };
      return null;
    })
    .filter((c): c is TaCandidate => c !== null);
}

function resolveTaName(
  accountId: string,
  cohortStudents: { id: string; firstName: string; lastName: string }[],
  teachers: { id: string; name: string }[]
): string {
  const student = cohortStudents.find((s) => s.id === accountId);
  if (student) return `${student.firstName} ${student.lastName}`;
  const teacher = teachers.find((tc) => tc.id === accountId);
  if (teacher) return teacher.name;
  return accountId;
}

// ─── Create/edit drawer ─────────────────────────────────────────────────────────

function GradingAssignmentDrawer({
  mode,
  courseId,
  existing,
  onClose,
}: {
  mode: "create" | "edit";
  courseId: string;
  existing?: GradingAssignment;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { cohortStudents } = useCohortStudents();
  const { teachers } = useManagedTeachers();
  const { getRolesBySection } = useSectionRoles();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { addGradingAssignment, updateGradingAssignment, getAssignmentsBySection } = useGradingAssignments();

  const taRoles = getRolesBySection(courseId).filter((r) => r.role === "ta");
  const taCandidates = resolveTaCandidates(taRoles, cohortStudents, teachers);

  const [taAccountId, setTaAccountId] = useState(existing?.taAccountId ?? taCandidates[0]?.id ?? "");
  const [scopeType, setScopeType] = useState<GradingAssignmentScope["type"]>(existing?.scope.type ?? "week");
  const [weekNumbers, setWeekNumbers] = useState<number[]>(
    existing?.scope.type === "week" ? existing.scope.weekNumbers : []
  );
  const [weekInput, setWeekInput] = useState("");
  const [weekError, setWeekError] = useState("");

  // Phase 1 validation S5: two TAs' week-scoped splits must not overlap —
  // this was flagged as a gap in the model check (docs/phase1-model-validation.md)
  // to fix as a form-level rule once this screen existed. Build the
  // week → owning-TA-name map from every OTHER week-scoped split on this
  // course (excluding the one currently being edited).
  const otherWeekClaims = new Map<number, string>();
  for (const ga of getAssignmentsBySection(courseId)) {
    if (ga.id === existing?.id) continue;
    if (ga.scope.type !== "week") continue;
    const ownerName = resolveTaName(ga.taAccountId, cohortStudents, teachers);
    for (const w of ga.scope.weekNumbers) otherWeekClaims.set(w, ownerName);
  }
  const courseAssignments = getAssignmentsByCourse(courseId);
  const [pickerAssignmentId, setPickerAssignmentId] = useState(courseAssignments[0]?.id ?? "");
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(
    new Set(existing?.scope.type === "custom" ? existing.scope.submissionIds : [])
  );

  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
  }

  function addWeek() {
    const n = parseInt(weekInput, 10);
    if (isNaN(n) || n <= 0 || weekNumbers.includes(n)) { setWeekInput(""); return; }
    const conflictOwner = otherWeekClaims.get(n);
    if (conflictOwner) {
      setWeekError(t(`สัปดาห์ ${n} ถูกมอบให้ ${conflictOwner} ไปแล้ว — เลือกสัปดาห์อื่น`, `Week ${n} is already assigned to ${conflictOwner} — pick a different week`));
      return;
    }
    setWeekError("");
    setWeekNumbers([...weekNumbers, n].sort((a, b) => a - b));
    setWeekInput("");
  }

  function removeWeek(n: number) {
    setWeekNumbers(weekNumbers.filter((w) => w !== n));
  }

  function toggleSubmission(subId: string) {
    setSelectedSubmissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId); else next.add(subId);
      return next;
    });
  }

  const isValid =
    taAccountId !== "" &&
    (scopeType === "all" ||
      (scopeType === "week" && weekNumbers.length > 0) ||
      (scopeType === "custom" && selectedSubmissionIds.size > 0));

  function handleSave() {
    if (!isValid) return;
    let scope: GradingAssignmentScope;
    if (scopeType === "week") scope = { type: "week", weekNumbers };
    else if (scopeType === "custom") scope = { type: "custom", submissionIds: [...selectedSubmissionIds] };
    else scope = { type: "all" };

    if (mode === "create") {
      addGradingAssignment({ courseId, taAccountId, scope });
    } else if (existing) {
      updateGradingAssignment(existing.id, { taAccountId, scope });
    }
    onClose();
  }

  const pickerSubmissions = pickerAssignmentId ? getSubmissionsByAssignment(pickerAssignmentId) : [];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="grading-split-drawer-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="grading-split-drawer-title" className="text-base font-bold text-[var(--text-primary)]">
            {mode === "create" ? t("เพิ่มการแบ่งงานตรวจ", "New Grading Split") : t("แก้ไขการแบ่งงานตรวจ", "Edit Grading Split")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {taCandidates.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              {t("วิชานี้ยังไม่มีผู้ช่วยสอน — เพิ่มที่หน้า", "This course has no TAs yet — add one on the")}{" "}
              <Link href={`/teacher/courses/${courseId}/collaborators`} className="text-[var(--accent)] hover:underline">
                {t("ผู้ร่วมสอน", "Collaborators")}
              </Link>
            </p>
          ) : (
            <>
              {/* TA picker */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  {t("ผู้ช่วยสอน", "Teaching Assistant")} <span className="text-[var(--s-err-text)]">*</span>
                </label>
                <div className="flex flex-col gap-1.5">
                  {taCandidates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setTaAccountId(s.id)}
                      aria-pressed={taAccountId === s.id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors ${
                        taAccountId === s.id ? "border-[var(--role-ta-border)] bg-[var(--role-ta-bg)]" : "border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "#7C3AED" }}>
                        {initialsOf(s.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{s.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">{s.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[var(--text-muted)]">{t("รูปแบบการแบ่งงาน", "Split Mode")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => { setScopeType("week"); setWeekError(""); }}
                    aria-pressed={scopeType === "week"}
                    className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${
                      scopeType === "week" ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/10 text-[var(--accent)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {t("แบ่งตามสัปดาห์", "By Week")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScopeType("all"); setWeekError(""); }}
                    aria-pressed={scopeType === "all"}
                    className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${
                      scopeType === "all" ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/10 text-[var(--accent)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {t("ตรวจทั้งหมด", "Grade Everything")}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setScopeType("custom"); setWeekError(""); }}
                    aria-pressed={scopeType === "custom"}
                    className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${
                      scopeType === "custom" ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/10 text-[var(--accent)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                    }`}
                  >
                    {t("เลือกเอง", "Custom")}
                  </button>
                  <button
                    type="button"
                    disabled
                    title={t("รอสรุปโมเดลกลุ่มนักศึกษา (Q1) — ยังใช้ไม่ได้", "Pending the student-group data model decision (Q1) — not available yet")}
                    className="h-10 rounded-xl border border-dashed border-[var(--border-subtle)] text-sm font-semibold text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  >
                    {t("แบ่งตามกลุ่ม", "By Group")}
                  </button>
                </div>
              </div>

              {/* Scope-specific fields */}
              {scopeType === "week" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    {t("สัปดาห์ที่รับผิดชอบ", "Weeks Responsible For")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  {otherWeekClaims.size > 0 && (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {t("สัปดาห์ที่มีคนตรวจแล้ว: ", "Already assigned: ")}
                      {[...otherWeekClaims.entries()].sort(([a], [b]) => a - b).map(([w, name]) => `${w} (${name})`).join(", ")}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={weekInput}
                      onChange={(e) => { setWeekInput(e.target.value); setWeekError(""); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addWeek(); } }}
                      placeholder={t("เช่น 3", "e.g. 3")}
                      aria-invalid={weekError !== ""}
                      className={`flex-1 h-10 rounded-xl border bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 ${weekError ? "border-[var(--s-err-bd)] focus:ring-[var(--s-err-bd)]" : "border-[var(--border-subtle)] focus:ring-[var(--accent-bright)]"}`}
                    />
                    <button type="button" onClick={addWeek} className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors">
                      {t("เพิ่ม", "Add")}
                    </button>
                  </div>
                  {weekError && (
                    <p role="alert" className="text-xs text-[var(--s-err-text)]">{weekError}</p>
                  )}
                  {weekNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {weekNumbers.map((n) => (
                        <span key={n} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-[var(--accent-bright)]/10 text-[var(--accent)] text-xs font-semibold">
                          {t(`สัปดาห์ ${n}`, `Week ${n}`)}
                          <button type="button" onClick={() => removeWeek(n)} className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-[var(--accent)]/20" aria-label={t("ลบ", "Remove")}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {scopeType === "all" && (
                <p className="text-xs text-[var(--text-muted)] px-3 py-2 rounded-xl bg-[var(--bg-subtle)]">
                  {t("ผู้ช่วยสอนคนนี้จะตรวจงานทุกชิ้นในวิชานี้", "This TA will grade every submission in this course")}
                </p>
              )}

              {scopeType === "custom" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    {t("เลือกงานที่ต้องการมอบหมาย", "Pick Submissions to Assign")} <span className="text-[var(--s-err-text)]">*</span>
                  </label>
                  {courseAssignments.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">{t("วิชานี้ยังไม่มีงาน/การบ้าน", "This course has no assignments yet")}</p>
                  ) : (
                    <>
                      <select
                        value={pickerAssignmentId}
                        onChange={(e) => setPickerAssignmentId(e.target.value)}
                        className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                      >
                        {courseAssignments.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-subtle)] p-1 mt-1">
                        {pickerSubmissions.length === 0 ? (
                          <p className="text-xs text-[var(--text-muted)] px-2 py-3 text-center">{t("ยังไม่มีนักศึกษาส่งงานชิ้นนี้", "No submissions for this assignment yet")}</p>
                        ) : (
                          pickerSubmissions.map((sub) => (
                            <label key={sub.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-[var(--bg-subtle)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedSubmissionIds.has(sub.id)}
                                onChange={() => toggleSubmission(sub.id)}
                                className="accent-[var(--accent)]"
                              />
                              <span className="text-sm text-[var(--text-primary)]">{sub.studentName}</span>
                            </label>
                          ))
                        )}
                      </div>
                      {selectedSubmissionIds.size > 0 && (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {t(`เลือกแล้ว ${selectedSubmissionIds.size} ชิ้น (จากทุกงานที่เปิดไว้)`, `${selectedSubmissionIds.size} submission(s) selected (across all assignments browsed)`)}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("เพิ่มการแบ่งงาน", "Add Split") : t("บันทึก", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────────

function scopeDescription(scope: GradingAssignmentScope, t: (th: string, en: string) => string): string {
  if (scope.type === "all") return t("ตรวจทั้งหมด", "Grades everything");
  if (scope.type === "week") return t(`สัปดาห์ ${scope.weekNumbers.join(", ")}`, `Week(s) ${scope.weekNumbers.join(", ")}`);
  if (scope.type === "custom") return t(`เลือกเอง — ${scope.submissionIds.length} ชิ้น`, `Custom — ${scope.submissionIds.length} submission(s)`);
  return t(`กลุ่ม — ${scope.studentGroupIds.length} กลุ่ม`, `Group — ${scope.studentGroupIds.length} group(s)`);
}

function GradingAssignmentRow({
  assignment,
  taName,
  canManage,
  onEdit,
  onRemove,
}: {
  assignment: GradingAssignment;
  taName: string;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useLanguage();
  // "By Group" scope can't be created or edited from this UI yet — the
  // student-group data model is still an open question (Phase 1 Q1). A
  // group-scoped row can only exist from data created outside this screen;
  // opening the edit form for one would show no selected mode and a Save
  // button that can never enable, so block Edit here instead of the app
  // silently doing nothing useful.
  const isGroupScoped = assignment.scope.type === "group";
  if (!canManage) {
    return (
      <div className="flex items-center gap-4 px-6 py-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "#7C3AED" }}>
          {initialsOf(taName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{taName}</p>
          <p className="text-xs text-[var(--text-muted)]">{scopeDescription(assignment.scope, t)}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-[var(--bg-subtle)]/50 transition-colors">
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: "#7C3AED" }}>
        {initialsOf(taName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{taName}</p>
        <p className="text-xs text-[var(--text-muted)]">{scopeDescription(assignment.scope, t)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          disabled={isGroupScoped}
          title={isGroupScoped ? t("แก้ไขแบบกลุ่มยังไม่รองรับในหน้านี้", "Group-scoped splits can't be edited here yet") : t("แก้ไข", "Edit")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          onClick={onRemove}
          title={t("ลบ", "Remove")}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GradingSplitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { getCourse } = useCourses();

  useEffect(() => {
    if (GRADING_SPLIT_DISABLED) router.replace(`/teacher/courses/${id}`);
  }, [router, id]);
  const { cohortStudents } = useCohortStudents();
  const { teachers } = useManagedTeachers();
  const { getRolesBySection, hasPermission } = useSectionRoles();
  const { gradingAssignments, removeGradingAssignment, getAssignmentsBySection } = useGradingAssignments();
  const currentAccountId = useCurrentAccountId();
  const course = getCourse(id);
  // Fail open when unresolvable — see the comment on useCurrentAccountId().
  // Grading-split configuration reads as course-settings-adjacent, so it's
  // gated on canEditSettings rather than canManageRoster.
  const canManage = course ? (currentAccountId === null || hasPermission(currentAccountId, course.id, "canEditSettings")) : true;

  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<GradingAssignment | undefined>(undefined);

  const taRoles = course ? getRolesBySection(course.id).filter((r) => r.role === "ta") : [];
  const rows = useMemo(() => {
    if (!course) return [];
    return getAssignmentsBySection(course.id).map((ga) => ({
      assignment: ga,
      taName: resolveTaName(ga.taAccountId, cohortStudents, teachers),
    }));
  }, [course, getAssignmentsBySection, gradingAssignments, cohortStudents, teachers]);

  function remove(ga: GradingAssignment, taName: string) {
    const msg = t(`ลบการแบ่งงานของ "${taName}"?`, `Remove this split for "${taName}"?`);
    if (!window.confirm(msg)) return;
    removeGradingAssignment(ga.id);
  }

  if (!course) {
    return (
      <main className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
        <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
      </main>
    );
  }

  if (GRADING_SPLIT_DISABLED) return null;

  return (
    <main className="w-full px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] mb-6">
        <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline -mt-0.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </Link>
        <span>/</span>
        <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
        <span>/</span>
        <span className="text-[var(--accent)] font-medium">{t("แบ่งงานตรวจ", "Grading Split")}</span>
      </div>

      {/* Title */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("แบ่งงานตรวจ", "Grading Split")}</h1>
          <p className="text-sm text-[var(--text-muted)]">
            {t("กำหนดว่าผู้ช่วยสอนแต่ละคนตรวจงานส่วนไหนใน", "Set which part of the work each TA is responsible for grading in")} <strong className="text-[var(--text-primary)]">{course.name}</strong>
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("เพิ่มการแบ่งงาน", "Add Split")}
          </button>
        )}
      </div>

      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm">
        <div className="px-6 pt-5 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("กติกาการแบ่งงาน", "Split Rules")}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {t("ค่าเริ่มต้นคือแบ่งตามสัปดาห์ — เปลี่ยนเป็นตรวจทั้งหมดหรือเลือกเองได้ต่อผู้ช่วยสอน", "Default mode is by-week — switch to grade-everything or custom per TA")}
          </p>
        </div>

        {taRoles.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            {t("วิชานี้ยังไม่มีผู้ช่วยสอน", "This course has no TAs yet")} —{" "}
            <Link href={`/teacher/courses/${id}/collaborators`} className="text-[var(--accent)] hover:underline">
              {t("เพิ่มผู้ช่วยสอนก่อน", "Add a TA first")}
            </Link>
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">
            {t("ยังไม่มีการแบ่งงาน — ค่าเริ่มต้นคือทุกคนช่วยตรวจทั้งหมด", "No split configured yet — by default all TAs can grade everything")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {rows.map(({ assignment, taName }) => (
              <GradingAssignmentRow
                key={assignment.id}
                assignment={assignment}
                taName={taName}
                canManage={canManage}
                onEdit={() => { setEditTarget(assignment); setDrawerMode("edit"); }}
                onRemove={() => remove(assignment, taName)}
              />
            ))}
          </div>
        )}
      </div>

      {drawerMode && (
        <GradingAssignmentDrawer
          mode={drawerMode}
          courseId={course.id}
          existing={editTarget}
          onClose={() => setDrawerMode(null)}
        />
      )}
    </main>
  );
}
