"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses, Course, PRESET_COLORS } from "@/lib/courses";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { useCohortStudents } from "@/lib/cohort-students";
import { useStudents, Student } from "@/lib/students";

// ── Course create/edit drawer ─────────────────────────────────────────────────

function CourseDrawer({
  mode,
  course,
  onClose,
}: {
  mode: "create" | "edit";
  course?: Course;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addCourse, updateCourse } = useCourses();

  const [name, setName] = useState(course?.name ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [coverColor, setCoverColor] = useState(course?.coverColor ?? PRESET_COLORS[0]);
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [handleClose]);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === "create") {
      addCourse({ name: trimmed, description, coverColor, iconColor: coverColor, status: "active", source: "manual" });
    } else if (course) {
      updateCourse(course.id, { name: trimmed, description, coverColor, iconColor: coverColor });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      {/* panel */}
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="course-drawer-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="course-drawer-title" className="text-base font-bold text-[var(--text-primary)]">
            {mode === "create" ? t("สร้างรายวิชาใหม่", "New Course") : t("แก้ไขรายวิชา", "Edit Course")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {t("ชื่อรายวิชา", "Course Name")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t("เช่น UX/UI Design", "e.g. UX/UI Design")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">{t("คำอธิบาย", "Description")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder={t("อธิบายรายวิชาโดยย่อ (ไม่บังคับ)", "Brief description (optional)")}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
          </div>

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--text-muted)]">{t("สีปก", "Cover Color")}</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCoverColor(c)}
                  className="w-9 h-9 rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
                  style={{ background: c, outline: c === coverColor ? "3px solid #2DD4BF" : "none", outlineOffset: "2px" }}
                  aria-label={c}
                  aria-pressed={c === coverColor}
                />
              ))}
            </div>
            {/* Preview */}
            <div className="h-14 rounded-xl flex items-end p-3" style={{ background: coverColor }}>
              <span className="text-white text-xs font-semibold opacity-90 truncate">{name || t("ชื่อรายวิชา", "Course name")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("สร้างรายวิชา", "Create Course") : t("บันทึก", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-xl p-6 flex flex-col gap-4">
        <div>
          <p className="text-base font-bold text-[var(--text-primary)]">{title}</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button onClick={onCancel} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            className={`h-9 px-5 rounded-xl text-sm font-semibold transition-colors ${danger ? "bg-[var(--danger-solid)] text-[var(--danger-solid-text)] hover:bg-[var(--danger-solid-hover)]" : "bg-[var(--accent-solid)] text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)]"}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Student list item ─────────────────────────────────────────────────────────

function StudentListItem({ student, onRemove }: { student: Student; onRemove: () => void }) {
  const initials = (s: Student) =>
    `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[var(--bg-subtle)] group transition-colors">
      <div className="w-7 h-7 rounded-full bg-[#2DD4BF]/20 text-[#0F766E] text-[10px] font-bold flex items-center justify-center shrink-0 select-none">
        {initials(student)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{student.firstName} {student.lastName}</p>
        <p className="text-[11px] text-[var(--text-muted)] truncate">{student.email}</p>
      </div>
      {student.cohort && (
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-[var(--bg-subtle)] text-[var(--text-muted)] shrink-0">
          {student.cohort}
        </span>
      )}
      <button
        onClick={onRemove}
        className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
        aria-label={`Remove ${student.firstName}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ── Assign panel ──────────────────────────────────────────────────────────────

function CourseAssignPanel({ course }: { course: Course }) {
  const { t } = useLanguage();
  const { teachers, assignToCourse, unassignFromCourse, getTeachersByCourse } = useManagedTeachers();
  const { getCohorts, getStudentsByCohort } = useCohortStudents();
  const { removeStudent, getStudentsByCourse, addStudents } = useStudents();

  const assignedTeachers = getTeachersByCourse(course.id);
  const enrolledStudents = getStudentsByCourse(course.id);
  const cohorts = getCohorts();
  const [selectedCohort, setSelectedCohort] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "warn" }>({ text: "", type: "ok" });
  const [studentSearch, setStudentSearch] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");

  // Individual picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirm state for destructive student actions
  const [pendingRemoveStudent, setPendingRemoveStudent] = useState<Student | null>(null);
  const [pendingRemoveCohort, setPendingRemoveCohort] = useState(false);

  const enrolledStudentIds = new Set(enrolledStudents.map((s) => s.studentId));
  const allCohortStudents = cohorts.flatMap((c) => getStudentsByCohort(c));
  const availableStudents = allCohortStudents.filter((s) => !enrolledStudentIds.has(s.studentId));
  const filteredAvailable = pickerSearch
    ? availableStudents.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (s.studentId ?? "").includes(pickerSearch)
      )
    : availableStudents;

  function toggleSelectStudent(studentId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(studentId) ? next.delete(studentId) : next.add(studentId);
      return next;
    });
  }

  function handleAddSelected() {
    const toAdd = availableStudents
      .filter((s) => selectedIds.has(s.studentId))
      .map(({ studentId, firstName, lastName, email, cohort }) => ({ studentId, firstName, lastName, email, cohort }));
    addStudents(course.id, toAdd);
    setSelectedIds(new Set());
    setShowPicker(false);
    setPickerSearch("");
    showMsg(t(`เพิ่ม ${toAdd.length} คนเข้ารายวิชาแล้ว`, `Added ${toAdd.length} student(s)`));
  }

  const showMsg = (text: string, type: "ok" | "warn" = "ok") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "ok" }), 4000);
  };

  function toggleTeacher(teacherId: string, assigned: boolean) {
    if (assigned) unassignFromCourse(teacherId, course.id);
    else assignToCourse(teacherId, course.id);
  }

  function handleEnroll() {
    if (!selectedCohort) return;
    setEnrolling(true);
    const cohortStudents = getStudentsByCohort(selectedCohort);
    const existing = new Set(enrolledStudents.map((s) => s.studentId));
    const toAdd = cohortStudents
      .filter((cs) => !existing.has(cs.studentId))
      .map(({ studentId, firstName, lastName, email, cohort }) => ({ studentId, firstName, lastName, email, cohort }));
    addStudents(course.id, toAdd);
    setEnrolling(false);
    showMsg(t(`เพิ่ม ${toAdd.length} คน (${selectedCohort}) เข้ารายวิชาแล้ว`, `Enrolled ${toAdd.length} from ${selectedCohort}`));
  }

  function handleRemoveCohort() {
    if (!selectedCohort) return;
    const toRemove = enrolledStudents.filter((s) => s.cohort === selectedCohort);
    if (toRemove.length === 0) { showMsg(t("ไม่มีนักศึกษาจาก cohort นี้ใน course", `No students from ${selectedCohort}`), "warn"); return; }
    setPendingRemoveCohort(true);
  }

  function confirmRemoveCohort() {
    const toRemove = enrolledStudents.filter((s) => s.cohort === selectedCohort);
    toRemove.forEach((s) => removeStudent(s.id));
    showMsg(t(`ลบ ${toRemove.length} คน (${selectedCohort}) ออกแล้ว`, `Removed ${toRemove.length} from ${selectedCohort}`));
    setPendingRemoveCohort(false);
  }

  const filteredStudents = studentSearch
    ? enrolledStudents.filter((s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.studentId ?? "").includes(studentSearch)
      )
    : enrolledStudents;

  const TEACHER_ROLE_LABEL: Record<"teacher" | "ta", string> = { teacher: t("อาจารย์", "Teacher"), ta: "TA" };

  const sortedTeachers = [
    ...teachers.filter((tc) => assignedTeachers.some((a) => a.id === tc.id)),
    ...teachers.filter((tc) => !assignedTeachers.some((a) => a.id === tc.id)),
  ];
  const filteredTeachers = teacherSearch
    ? sortedTeachers.filter((tc) => tc.name.toLowerCase().includes(teacherSearch.toLowerCase()) || tc.email?.toLowerCase().includes(teacherSearch.toLowerCase()))
    : sortedTeachers;

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--bg-app)] rounded-b-2xl border-t border-[var(--border-subtle)]">

      {/* Left: Teacher assignment */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("อาจารย์ผู้สอน", "Teaching Staff")}</p>
          {assignedTeachers.length > 0 && (
            <span className="text-[10px] font-bold text-[#0F766E] bg-[#2DD4BF]/15 px-1.5 py-0.5 rounded-full tabular-nums">
              {assignedTeachers.length}
            </span>
          )}
        </div>
        {teachers.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีอาจารย์ในระบบ — ไปเพิ่มที่หน้าจัดการอาจารย์", "No teachers yet — add them first")}</p>
        ) : (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            {/* Search bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)]">
              <svg className="text-[var(--text-muted)] shrink-0" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                placeholder={t("ค้นหาอาจารย์...", "Search teachers...")}
                className="flex-1 text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              {teacherSearch && (
                <button onClick={() => setTeacherSearch("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            {/* List */}
            <div className="max-h-[200px] overflow-y-auto">
              {filteredTeachers.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] px-3 py-3">{t("ไม่พบอาจารย์ที่ค้นหา", "No match found")}</p>
              ) : filteredTeachers.map((teacher, idx, arr) => {
                const assigned = assignedTeachers.some((a) => a.id === teacher.id);
                const prevAssigned = idx > 0 && assignedTeachers.some((a) => a.id === arr[idx - 1].id);
                const isDivider = !teacherSearch && idx > 0 && !assigned && prevAssigned && assignedTeachers.length > 0;
                return (
                  <div key={teacher.id}>
                    {isDivider && <div className="mx-3 my-0.5 border-t border-[var(--border-subtle)]" />}
                    <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${assigned ? "bg-[#2DD4BF]/5 hover:bg-[#2DD4BF]/10" : "hover:bg-[var(--bg-subtle)]"}`}>
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() => toggleTeacher(teacher.id, assigned)}
                        className="w-4 h-4 accent-[#0F766E] cursor-pointer shrink-0"
                      />
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 select-none transition-colors ${assigned ? "bg-[#0F766E] text-white" : "bg-[#2DD4BF]/20 text-[#0F766E]"}`}
                        aria-hidden="true"
                      >
                        {getInitials(teacher.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${assigned ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{teacher.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{TEACHER_ROLE_LABEL[teacher.role]}</p>
                      </div>
                      {assigned && (
                        <svg className="text-[#0F766E] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right: Student management */}
      <div className="flex flex-col gap-3">
        {/* Header + search + add button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("นักศึกษา", "Students")}</p>
            <span className="text-xs font-bold text-[#0F766E] tabular-nums bg-[#2DD4BF]/10 px-2 py-0.5 rounded-full">{enrolledStudents.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {enrolledStudents.length > 0 && (
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder={t("ค้นหา...", "Search...")}
                  className="h-7 pl-7 pr-3 text-xs rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#2DD4BF] w-28"
                />
              </div>
            )}
            <button
              onClick={() => { setShowPicker((v) => !v); setPickerSearch(""); setSelectedIds(new Set()); }}
              className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] ${showPicker ? "bg-[#2DD4BF]/15 text-[#0F766E]" : "bg-[var(--accent-solid)] text-[var(--accent-solid-text)] hover:bg-[var(--accent-solid-hover)]"}`}
            >
              {showPicker ? t("ปิด", "Close") : t("+ รายบุคคล", "+ Individual")}
            </button>
          </div>
        </div>

        {/* Individual picker */}
        {showPicker && (
          <div className="rounded-xl border border-[#2DD4BF]/30 bg-[var(--bg-surface)] overflow-hidden">
            {/* Picker search */}
            <div className="p-2 border-b border-[var(--border-subtle)]">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder={t("ค้นหาชื่อ, email, รหัส...", "Search name, email, ID...")}
                  autoFocus
                  className="w-full h-7 pl-7 pr-3 text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                />
              </div>
            </div>
            {/* Picker list */}
            {availableStudents.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] px-3 py-3">{t("นักศึกษาทุกคนใน cohort อยู่ใน course นี้แล้ว", "All cohort students are already enrolled")}</p>
            ) : filteredAvailable.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] px-3 py-3">{t("ไม่พบนักศึกษาที่ค้นหา", "No match found")}</p>
            ) : (
              <div className="max-h-44 overflow-y-auto">
                {filteredAvailable.map((s) => {
                  const checked = selectedIds.has(s.studentId);
                  return (
                    <label key={s.studentId} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors ${checked ? "bg-[#2DD4BF]/5" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSelectStudent(s.studentId)}
                        className="w-3.5 h-3.5 accent-[#0F766E] cursor-pointer shrink-0"
                      />
                      <div className="w-6 h-6 rounded-full bg-[#2DD4BF]/20 text-[#0F766E] text-[9px] font-bold flex items-center justify-center shrink-0 select-none" aria-hidden="true">
                        {getInitials(`${s.firstName} ${s.lastName}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{s.firstName} {s.lastName}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{s.email} · {s.cohort}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {/* Confirm row */}
            {availableStudents.length > 0 && (
              <div className="flex items-center justify-between gap-2 p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-app)]">
                <span className="text-xs text-[var(--text-muted)]">
                  {selectedIds.size > 0
                    ? t(`เลือก ${selectedIds.size} คน`, `${selectedIds.size} selected`)
                    : t("เลือกนักศึกษาที่ต้องการ", "Select students to add")}
                </span>
                <button
                  onClick={handleAddSelected}
                  disabled={selectedIds.size === 0}
                  className="h-7 px-3 rounded-lg bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
                >
                  {t(`+ เพิ่ม${selectedIds.size > 0 ? ` ${selectedIds.size} คน` : ""}`, `+ Add${selectedIds.size > 0 ? ` ${selectedIds.size}` : ""}`)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Student list */}
        {enrolledStudents.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] px-3">{t("ยังไม่มีนักศึกษาใน course นี้", "No students enrolled yet")}</p>
        ) : filteredStudents.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] px-3">{t("ไม่พบนักศึกษาที่ค้นหา", "No match found")}</p>
        ) : (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1">
            {filteredStudents.map((s) => (
              <StudentListItem key={s.id} student={s} onRemove={() => setPendingRemoveStudent(s)} />
            ))}
          </div>
        )}

        {/* Enroll section */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--border-subtle)]">
          <p className="text-xs text-[var(--text-muted)]">{t("จัดการ cohort:", "Manage cohort:")}</p>
          {cohorts.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มี cohort — นำเข้าจากหน้าจัดการนักศึกษาก่อน", "No cohorts — import students first")}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <select
                  value={selectedCohort}
                  onChange={(e) => { setSelectedCohort(e.target.value); setMsg({ text: "", type: "ok" }); }}
                  className="flex-1 h-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                >
                  <option value="">{t("เลือก cohort…", "Select cohort…")}</option>
                  {cohorts.map((c) => (
                    <option key={c} value={c}>{c} ({getStudentsByCohort(c).length} {t("คน", "students")})</option>
                  ))}
                </select>
                <button
                  onClick={handleEnroll}
                  disabled={!selectedCohort || enrolling}
                  title={t("นำเข้านักศึกษาจาก cohort ที่เลือก", "Enroll selected cohort")}
                  className="h-8 px-3 rounded-xl bg-[#0F766E] text-white text-xs font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors whitespace-nowrap"
                >
                  {enrolling ? "…" : t("+ นำเข้า", "+ Enroll")}
                </button>
                <button
                  onClick={handleRemoveCohort}
                  disabled={!selectedCohort}
                  title={t("ลบนักศึกษาทั้ง cohort ออกจาก course นี้", "Remove entire cohort from this course")}
                  className="h-8 px-3 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors whitespace-nowrap"
                >
                  {t("ลบ cohort", "Remove")}
                </button>
              </div>
              {msg.text && (
                <p role="status" className={`text-xs rounded-lg px-3 py-1.5 border ${msg.type === "ok" ? "text-green-700 bg-green-50 border-green-100" : "text-amber-700 bg-amber-50 border-amber-100"}`}>
                  {msg.text}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>

    {/* Confirm: remove individual student */}
    {pendingRemoveStudent && (
      <ConfirmDialog
        title={t("ลบนักศึกษาออกจาก course?", "Remove student from course?")}
        description={t(
          `"${pendingRemoveStudent.firstName} ${pendingRemoveStudent.lastName}" จะถูกลบออกจาก course นี้`,
          `"${pendingRemoveStudent.firstName} ${pendingRemoveStudent.lastName}" will be removed from this course`
        )}
        confirmLabel={t("ลบออก", "Remove")}
        danger={true}
        onConfirm={() => { removeStudent(pendingRemoveStudent.id); setPendingRemoveStudent(null); }}
        onCancel={() => setPendingRemoveStudent(null)}
      />
    )}

    {/* Confirm: remove entire cohort */}
    {pendingRemoveCohort && selectedCohort && (
      <ConfirmDialog
        title={t("ลบนักศึกษาทั้ง cohort?", "Remove entire cohort?")}
        description={t(
          `นักศึกษาจาก ${selectedCohort} ทั้งหมด ${enrolledStudents.filter((s) => s.cohort === selectedCohort).length} คน จะถูกลบออกจาก course นี้`,
          `All ${enrolledStudents.filter((s) => s.cohort === selectedCohort).length} students from ${selectedCohort} will be removed from this course`
        )}
        confirmLabel={t("ลบทั้ง cohort", "Remove Cohort")}
        danger={true}
        onConfirm={confirmRemoveCohort}
        onCancel={() => setPendingRemoveCohort(false)}
      />
    )}
    </>
  );
}

// ── Course row ────────────────────────────────────────────────────────────────

type RowAction = { type: "archive" | "restore" | "delete"; course: Course } | null;

function CourseRow({
  course,
  onEdit,
  onAction,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onAction: (a: RowAction) => void;
}) {
  const { t } = useLanguage();
  const { getTeachersByCourse } = useManagedTeachers();
  const { getStudentsByCourse } = useStudents();
  const [expanded, setExpanded] = useState(false);

  const assignedTeachers = getTeachersByCourse(course.id);
  const enrolledCount = getStudentsByCourse(course.id).length;


  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      {/* Row — flex row, NOT a button so action buttons can sit alongside */}
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors">
        {/* Accordion toggle — takes remaining space */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`course-panel-${course.id}`}
          className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] focus-visible:rounded-lg"
        >
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-xs" style={{ background: course.coverColor }} aria-hidden="true">
            {course.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{course.name}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              {assignedTeachers.length > 0 ? assignedTeachers.map((tc) => tc.name).join(", ") : t("ยังไม่มีอาจารย์ assigned", "No teachers assigned")}
            </p>
          </div>
          <span className={`transition-transform duration-200 text-[var(--text-muted)] shrink-0 ${expanded ? "rotate-180" : ""}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </button>

        {/* Student count + action buttons — siblings, not children of toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{enrolledCount}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{t("นักศึกษา", "students")}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(course)}
              title={t("แก้ไขรายวิชา", "Edit course")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[#0F766E] hover:bg-[#2DD4BF]/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => onAction({ type: course.status === "active" ? "archive" : "restore", course })}
              title={course.status === "active" ? t("เก็บถาวร", "Archive") : t("คืนสถานะ", "Restore")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-amber-600 hover:bg-amber-50 transition-colors"
            >
              {course.status === "active" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.34"/>
                </svg>
              )}
            </button>
            <button
              onClick={() => onAction({ type: "delete", course })}
              title={t("ลบรายวิชา", "Delete course")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div id={`course-panel-${course.id}`} hidden={!expanded}>
        {expanded && <CourseAssignPanel course={course} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCoursesPage() {
  const { t } = useLanguage();
  const { courses, updateCourse, removeCourse } = useCourses();
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Course | undefined>(undefined);
  const [confirm, setConfirm] = useState<RowAction>(null);

  const activeCourses = courses.filter((c) => c.status === "active");
  const archivedCourses = courses.filter((c) => c.status === "archived");

  function handleAction(action: RowAction) {
    setConfirm(action);
  }

  function handleConfirm() {
    if (!confirm) return;
    if (confirm.type === "archive") updateCourse(confirm.course.id, { status: "archived" });
    else if (confirm.type === "restore") updateCourse(confirm.course.id, { status: "active" });
    else if (confirm.type === "delete") removeCourse(confirm.course.id);
    setConfirm(null);
  }

  const confirmConfig = confirm
    ? {
        archive: {
          title: t("เก็บถาวรรายวิชา?", "Archive this course?"),
          description: t(`"${confirm.course.name}" จะถูกซ่อนจากหน้าหลัก — ข้อมูลยังคงอยู่`, `"${confirm.course.name}" will be hidden — data is kept`),
          confirmLabel: t("เก็บถาวร", "Archive"),
          danger: false,
        },
        restore: {
          title: t("คืนสถานะรายวิชา?", "Restore this course?"),
          description: t(`"${confirm.course.name}" จะกลับมาแสดงในหน้าหลัก`, `"${confirm.course.name}" will become active again`),
          confirmLabel: t("คืนสถานะ", "Restore"),
          danger: false,
        },
        delete: {
          title: t("ลบรายวิชานี้?", "Delete this course?"),
          description: t(`"${confirm.course.name}" และข้อมูลทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้`, `"${confirm.course.name}" and all its data will be permanently deleted`),
          confirmLabel: t("ลบถาวร", "Delete Forever"),
          danger: true,
        },
      }[confirm.type]
    : null;

  return (
    <div className="p-6 w-full">
      {/* Page heading */}
      <div className="flex items-start justify-between mb-6">
        <div className="pl-4" style={{ borderLeft: "3px solid #2DD4BF" }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {t("จัดการรายวิชา", "Course Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t("สร้างรายวิชา, Assign อาจารย์ และจัดการนักศึกษาแต่ละ course", "Create courses, assign teachers and manage students")}
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t("สร้างรายวิชา", "New Course")}
        </button>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 mb-6">
        <StatCard
          label={t("รายวิชาทั้งหมด", "Total Courses")}
          value={courses.length}
          color="#0F766E"
          bg="rgba(15,118,110,0.1)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          }
        />
        <StatCard
          label={t("เปิดสอน", "Active")}
          value={activeCourses.length}
          color="#2563EB"
          bg="rgba(37,99,235,0.1)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          }
        />
        <StatCard
          label={t("เก็บถาวร", "Archived")}
          value={archivedCourses.length}
          color="#92400E"
          bg="rgba(146,64,14,0.1)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <polyline points="21 8 21 21 3 21 3 8"/>
              <rect x="1" y="3" width="22" height="5"/>
              <line x1="10" y1="12" x2="14" y2="12"/>
            </svg>
          }
        />
      </div>

      {courses.length === 0 ? (
        <EmptyState
          iconColor="#2DD4BF"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          }
          title={t("ยังไม่มีรายวิชาในระบบ", "No courses yet")}
          description={t("สร้างรายวิชาแรกได้เลย", "Create your first course")}
          action={
            <button
              onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t("สร้างรายวิชา", "New Course")}
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {t(`รายวิชาที่เปิดสอน (${activeCourses.length})`, `Active courses (${activeCourses.length})`)}
            </p>
            <div className="flex flex-col gap-3">
              {activeCourses.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีรายวิชาที่เปิดสอน", "No active courses")}</p>
              ) : (
                activeCourses.map((course) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    onEdit={(c) => { setEditTarget(c); setDrawerMode("edit"); }}
                    onAction={handleAction}
                  />
                ))
              )}
            </div>
          </div>

          {/* Archived */}
          {archivedCourses.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t(`รายวิชาที่เก็บถาวร (${archivedCourses.length})`, `Archived (${archivedCourses.length})`)}
              </p>
              <div className="flex flex-col gap-3 opacity-60">
                {archivedCourses.map((course) => (
                  <CourseRow
                    key={course.id}
                    course={course}
                    onEdit={(c) => { setEditTarget(c); setDrawerMode("edit"); }}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawers & dialogs */}
      {drawerMode && (
        <CourseDrawer
          mode={drawerMode}
          course={editTarget}
          onClose={() => setDrawerMode(null)}
        />
      )}
      {confirm && confirmConfig && (
        <ConfirmDialog
          title={confirmConfig.title}
          description={confirmConfig.description}
          confirmLabel={confirmConfig.confirmLabel}
          danger={confirmConfig.danger}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
