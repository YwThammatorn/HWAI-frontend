"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses, Course, PRESET_COLORS, Term } from "@/lib/courses";
import { useCurriculum } from "@/lib/curriculum";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import { useStudents } from "@/lib/students";

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
  const { curriculumVersions, courseTemplates, getCourseTemplatesByCurriculum } = useCurriculum();
  const { teachers, assignToCourse } = useManagedTeachers();

  const [name, setName] = useState(course?.name ?? "");
  const [description, setDescription] = useState(course?.description ?? "");
  const [coverColor, setCoverColor] = useState(course?.coverColor ?? PRESET_COLORS[0]);
  const [teacherId, setTeacherId] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const activeCurriculumVersions = curriculumVersions.filter((v) => v.effectiveTo === undefined);
  const existingTemplate = course?.courseTemplateId ? courseTemplates.find((ct) => ct.id === course.courseTemplateId) : undefined;
  const [curriculumVersionId, setCurriculumVersionId] = useState(existingTemplate?.curriculumVersionId ?? "");
  const [courseTemplateId, setCourseTemplateId] = useState(course?.courseTemplateId ?? "");
  const courseTemplateOptions = curriculumVersionId ? getCourseTemplatesByCurriculum(curriculumVersionId) : [];
  const currentAcademicYear = new Date().getFullYear() + 543;
  const [academicYear, setAcademicYear] = useState(String(course?.academicYear ?? currentAcademicYear));
  const [term, setTerm] = useState<Term | "">(course?.term ?? "");
  const [sectionNumber, setSectionNumber] = useState(course?.sectionNumber ?? "");
  const [schedule, setSchedule] = useState(course?.schedule ?? "");
  const [room, setRoom] = useState(course?.room ?? "");

  function handleCurriculumChange(id: string) {
    setCurriculumVersionId(id);
    setCourseTemplateId(""); // selected template belonged to the old curriculum's list
  }

  function handleTemplateChange(id: string) {
    setCourseTemplateId(id);
    // Auto-fill the name from the curriculum book so admin doesn't have to
    // retype it — still editable after, in case they want to customize it.
    const selected = courseTemplateOptions.find((ct) => ct.id === id);
    if (selected) setName(selected.name);
  }

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
    if (mode === "create" && !teacherId) return;
    const selectedTemplate = courseTemplateOptions.find((ct) => ct.id === courseTemplateId);
    const year = academicYear.trim() === "" ? undefined : parseInt(academicYear, 10);
    const sectionFields = {
      ...(selectedTemplate && { courseTemplateId: selectedTemplate.id, code: selectedTemplate.code }),
      ...(year !== undefined && !isNaN(year) && { academicYear: year }),
      ...(term !== "" && { term }),
      ...(sectionNumber.trim() !== "" && { sectionNumber: sectionNumber.trim() }),
      ...(schedule.trim() !== "" && { schedule: schedule.trim() }),
      ...(room.trim() !== "" && { room: room.trim() }),
    };
    if (mode === "create") {
      const created = addCourse({ name: trimmed, description, coverColor, iconColor: coverColor, status: "active", source: "manual", ...sectionFields });
      assignToCourse(teacherId, created.id);
    } else if (course) {
      updateCourse(course.id, { name: trimmed, description, coverColor, iconColor: coverColor, ...sectionFields });
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
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
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
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
          </div>

          {/* Curriculum / Section linking — optional, only useful once curricula exist */}
          {activeCurriculumVersions.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">{t("หลักสูตรและภาคการศึกษา", "Curriculum & Term")}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t("ไม่บังคับ — ผูกวิชานี้เข้ากับหลักสูตรที่มีอยู่", "Optional — link this course to a curriculum's course template")}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={curriculumVersionId}
                  onChange={(e) => handleCurriculumChange(e.target.value)}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                >
                  <option value="">{t("ไม่ระบุหลักสูตร", "No curriculum")}</option>
                  {activeCurriculumVersions.map((v) => (
                    <option key={v.id} value={v.id}>{v.program} — {v.label}</option>
                  ))}
                </select>
                <select
                  value={courseTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  disabled={!curriculumVersionId}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)] disabled:opacity-50"
                >
                  <option value="">{curriculumVersionId ? t("ไม่ระบุวิชา", "No template") : t("เลือกหลักสูตรก่อน", "Pick curriculum first")}</option>
                  {courseTemplateOptions.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.code} — {ct.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder={t("ปี", "Year")}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs tabular-nums text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                />
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value === "" ? "" : e.target.value === "summer" ? "summer" : (Number(e.target.value) as 1 | 2))}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                >
                  <option value="">{t("เทอม", "Term")}</option>
                  <option value="1">{t("เทอม 1", "Term 1")}</option>
                  <option value="2">{t("เทอม 2", "Term 2")}</option>
                  <option value="summer">{t("ภาคฤดูร้อน", "Summer")}</option>
                </select>
                <input
                  value={sectionNumber}
                  onChange={(e) => setSectionNumber(e.target.value)}
                  placeholder={t("Section", "Section")}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                />
              </div>
            </div>
          )}

          {/* Schedule & Room */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">{t("วันเวลาเรียน", "Class Schedule")}</label>
              <input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={t("เช่น จันทร์ 9:00-12:00", "e.g. Mon 9:00-12:00")}
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">{t("ห้องเรียน", "Room")}</label>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder={t("เช่น 811", "e.g. 811")}
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
            </div>
          </div>

          {/* Primary teacher — required at creation; reassign later via the course row's expand panel */}
          {mode === "create" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                {t("อาจารย์ประจำวิชา", "Primary Teacher")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                required
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              >
                <option value="">{t("เลือกอาจารย์ประจำวิชา...", "Select a teacher...")}</option>
                {teachers.map((tc) => (
                  <option key={tc.id} value={tc.id}>{tc.title ? `${tc.title} ` : ""}{tc.name}</option>
                ))}
              </select>
              {teachers.length === 0 && (
                <p className="text-[11px] text-[var(--s-err-text)]">{t("ยังไม่มีอาจารย์ในระบบ — ไปเพิ่มที่หน้าจัดการอาจารย์ก่อน", "No teachers yet — add one on the User Management page first")}</p>
              )}
            </div>
          )}

          {/* Color picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-[var(--text-muted)]">{t("สีปก", "Cover Color")}</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCoverColor(c)}
                  className="w-9 h-9 rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                  style={{ background: c, outline: c === coverColor ? "3px solid var(--accent-bright)" : "none", outlineOffset: "2px" }}
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
            disabled={!name.trim() || (mode === "create" && !teacherId)}
            className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
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

// ── Assign panel ──────────────────────────────────────────────────────────────
// Teacher assignment only — student enrollment is now the teacher's own job
// (CSV import on the course, teacher/courses/[id]/students/import), not
// admin's, so there's no add/remove student UI here anymore (10/9/2569).

function CourseAssignPanel({ course }: { course: Course }) {
  const { t } = useLanguage();
  const { teachers, assignToCourse, unassignFromCourse, getTeachersByCourse } = useManagedTeachers();
  const { getStudentsByCourse } = useStudents();

  const assignedTeachers = getTeachersByCourse(course.id);
  const enrolledCount = getStudentsByCourse(course.id).length;
  const [teacherSearch, setTeacherSearch] = useState("");

  function toggleTeacher(teacherId: string, assigned: boolean) {
    if (assigned) unassignFromCourse(teacherId, course.id);
    else assignToCourse(teacherId, course.id);
  }

  const TEACHER_ROLE_LABEL: Record<"teacher" | "ta", string> = { teacher: t("อาจารย์", "Teacher"), ta: "TA" };

  const sortedTeachers = [
    ...teachers.filter((tc) => assignedTeachers.some((a) => a.id === tc.id)),
    ...teachers.filter((tc) => !assignedTeachers.some((a) => a.id === tc.id)),
  ];
  const filteredTeachers = teacherSearch
    ? sortedTeachers.filter((tc) => tc.name.toLowerCase().includes(teacherSearch.toLowerCase()) || tc.email?.toLowerCase().includes(teacherSearch.toLowerCase()))
    : sortedTeachers;

  return (
    <div className="flex flex-col gap-2 p-4 bg-[var(--bg-app)] rounded-b-2xl border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("อาจารย์ผู้สอน", "Teaching Staff")}</p>
        {assignedTeachers.length > 0 && (
          <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent-bright)]/15 px-1.5 py-0.5 rounded-full tabular-nums">
            {assignedTeachers.length}
          </span>
        )}
      </div>
      {teachers.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีอาจารย์ในระบบ — ไปเพิ่มที่หน้าจัดการอาจารย์", "No teachers yet — add them first")}</p>
      ) : (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden max-w-md">
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
                  <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${assigned ? "bg-[var(--accent-bright)]/5 hover:bg-[var(--accent-bright)]/10" : "hover:bg-[var(--bg-subtle)]"}`}>
                    <input
                      type="checkbox"
                      checked={assigned}
                      onChange={() => toggleTeacher(teacher.id, assigned)}
                      className="w-4 h-4 accent-[var(--accent)] cursor-pointer shrink-0"
                    />
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 select-none transition-colors ${assigned ? "bg-[var(--accent-solid)] text-[var(--accent-solid-text)]" : "bg-[var(--accent-bright)]/20 text-[var(--accent)]"}`}
                      aria-hidden="true"
                    >
                      {getInitials(teacher.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${assigned ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{teacher.name}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{TEACHER_ROLE_LABEL[teacher.role]}</p>
                    </div>
                    {assigned && (
                      <svg className="text-[var(--accent)] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

      <p className="text-xs text-[var(--text-muted)] mt-2">
        {t(
          `นักศึกษาในวิชานี้ ${enrolledCount} คน — อาจารย์ประจำวิชาเป็นผู้นำเข้าเองที่หน้ารายวิชา (นำเข้า CSV)`,
          `${enrolledCount} student(s) enrolled — the course's teacher imports them (CSV) from the course page`
        )}
      </p>
    </div>
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
          className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:rounded-lg"
        >
          <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-xs" style={{ background: course.coverColor }} aria-hidden="true">
            {course.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{course.name}</p>
              {course.code && (
                <span className="text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md bg-[var(--accent-bright)]/15 text-[var(--accent)] shrink-0">
                  {course.code}{course.sectionNumber ? ` · Sec ${course.sectionNumber}` : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
              {assignedTeachers.length > 0 ? assignedTeachers.map((tc) => tc.name).join(", ") : t("ยังไม่มีอาจารย์ assigned", "No teachers assigned")}
              {(course.schedule || course.room) && (
                <> · {[course.schedule, course.room && t(`ห้อง ${course.room}`, `Room ${course.room}`)].filter(Boolean).join(" · ")}</>
              )}
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
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors"
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
        <div className="pl-4" style={{ borderLeft: "3px solid var(--accent-bright)" }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {t("จัดการรายวิชา", "Course Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t("สร้างรายวิชา, Assign อาจารย์ และจัดการนักศึกษาแต่ละ course", "Create courses, assign teachers and manage students")}
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0"
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
          color="var(--accent)"
          bg="var(--accent-subtle)"
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
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          }
          title={t("ยังไม่มีรายวิชาในระบบ", "No courses yet")}
          description={t("สร้างรายวิชาแรกได้เลย", "Create your first course")}
          action={
            <button
              onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
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
