"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses, Course, PRESET_COLORS, Term } from "@/lib/courses";
import { useCurriculum } from "@/lib/curriculum";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";
import SearchInput from "@/components/SearchInput";
import { useStudents } from "@/lib/students";

// ── Course create/edit (centred popup) ─────────────────────────────────────────────────

function CourseModal({
  mode,
  course,
  duplicateFrom,
  onClose,
}: {
  mode: "create" | "edit";
  course?: Course;
  /** "+ Add Section" (23/9/2569): create-mode only, pre-fills from an existing course — same
   *  template/term/year — but never sectionNumber or the teacher, which the admin must set fresh
   *  for the new section. */
  duplicateFrom?: Course;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { courses, addCourse, updateCourse } = useCourses();
  const { curriculumVersions, courseTemplates, getCourseTemplatesByCurriculum } = useCurriculum();
  const { teachers, assignToCourse } = useManagedTeachers();

  const seed = course ?? duplicateFrom;
  const [name, setName] = useState(seed?.name ?? "");
  const [description, setDescription] = useState(seed?.description ?? "");
  const [coverColor, setCoverColor] = useState(seed?.coverColor ?? PRESET_COLORS[0]);
  // Autocomplete (23/9/2569, was a plain <select> of every teacher) — SearchInput only ever
  // hands back the typed/picked display string, not an id, so teacherId is resolved from it
  // here rather than being its own directly-set state.
  const [teacherQuery, setTeacherQuery] = useState("");
  const teacherDisplayName = (tc: { title?: string; name: string }) => tc.title ? `${tc.title} ${tc.name}` : tc.name;
  const resolveTeacherId = (query: string) => teachers.find((tc) => teacherDisplayName(tc) === query.trim())?.id ?? "";
  const teacherId = resolveTeacherId(teacherQuery);
  const nameRef = useRef<HTMLInputElement>(null);

  // Several sections of the same course can be opened at once (25/9/2569): the course details above
  // are entered once, and each row here becomes its own Course row with its own section number and
  // teacher. `teacherQuery` above is the shared teacher; "same teacher for all" (default) uses it for
  // every row, otherwise each row carries its own.
  interface SectionRow { key: string; number: string; teacherQuery: string }
  const [rows, setRows] = useState<SectionRow[]>(() => [{ key: crypto.randomUUID(), number: "", teacherQuery: "" }]);
  const [sameTeacher, setSameTeacher] = useState(true);
  const shared = sameTeacher || rows.length === 1;
  const rowTeacherId = (r: SectionRow) => (shared ? teacherId : resolveTeacherId(r.teacherQuery));

  function addRow() {
    setRows((prev) => {
      const nums = prev.map((r) => parseInt(r.number, 10)).filter((n) => !isNaN(n));
      const next = nums.length > 0 ? String(Math.max(...nums) + 1) : "";
      return [...prev, { key: crypto.randomUUID(), number: next, teacherQuery }];
    });
  }
  function updateRow(key: string, patch: Partial<SectionRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }
  function handleSameTeacherChange(same: boolean) {
    setSameTeacher(same);
    // Turning it off: start every row on the shared teacher so the admin only changes the ones that differ.
    if (!same) setRows((prev) => prev.map((r) => (r.teacherQuery.trim() === "" ? { ...r, teacherQuery } : r)));
  }

  const activeCurriculumVersions = curriculumVersions.filter((v) => v.effectiveTo === undefined);
  const existingTemplate = seed?.courseTemplateId ? courseTemplates.find((ct) => ct.id === seed.courseTemplateId) : undefined;
  const [curriculumVersionId, setCurriculumVersionId] = useState(existingTemplate?.curriculumVersionId ?? "");
  const [courseTemplateId, setCourseTemplateId] = useState(seed?.courseTemplateId ?? "");
  const courseTemplateOptions = curriculumVersionId ? getCourseTemplatesByCurriculum(curriculumVersionId) : [];
  const currentAcademicYear = new Date().getFullYear() + 543;
  const [academicYear, setAcademicYear] = useState(String(seed?.academicYear ?? currentAcademicYear));
  const [term, setTerm] = useState<Term | "">(seed?.term ?? "");
  // sectionNumber is deliberately NOT seeded from duplicateFrom — that's the one field the admin
  // must always fill in fresh for a new section (see the prop doc above).
  const [sectionNumber, setSectionNumber] = useState(course?.sectionNumber ?? "");

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

  const selectedTemplate = courseTemplateOptions.find((ct) => ct.id === courseTemplateId);
  const year = academicYear.trim() === "" ? undefined : parseInt(academicYear, 10);

  // What's wrong with each new section row (create mode). With more than one row every section needs a
  // number; a number can't repeat inside the popup, nor match a section of the same course that
  // already exists for that year and term.
  const rowError = (r: SectionRow): string => {
    const n = r.number.trim();
    if (rows.length > 1 && n === "") return t("ใส่เลข section", "Enter a section number");
    if (n !== "") {
      if (rows.filter((o) => o.number.trim().toLowerCase() === n.toLowerCase()).length > 1) return t("เลข section ซ้ำในรายการนี้", "Repeated in this list");
      const clash = courses.some((c) =>
        c.status !== "archived" && c.sectionNumber === n && c.academicYear === (year !== undefined && !isNaN(year) ? year : undefined) &&
        c.term === (term === "" ? undefined : term) &&
        (selectedTemplate ? c.courseTemplateId === selectedTemplate.id : c.name === name.trim()));
      if (clash) return t("มี section นี้อยู่แล้ว", "This section already exists");
    }
    // A shared teacher is checked once, on its own field — not repeated under every row.
    if (!shared && !rowTeacherId(r)) return t("เลือกอาจารย์", "Pick a teacher");
    return "";
  };
  const rowErrors = mode === "create" ? Object.fromEntries(rows.map((r) => [r.key, rowError(r)])) : {};
  const canSave = !!name.trim() && (mode === "edit" || ((!shared || !!teacherId) && rows.every((r) => !rowErrors[r.key])));

  function handleSave() {
    const trimmed = name.trim();
    if (!canSave) return;
    const sectionFields = {
      ...(selectedTemplate && { courseTemplateId: selectedTemplate.id, code: selectedTemplate.code }),
      ...(year !== undefined && !isNaN(year) && { academicYear: year }),
      ...(term !== "" && { term }),
    };
    if (mode === "create") {
      rows.forEach((r) => {
        const num = r.number.trim();
        const created = addCourse({ name: trimmed, description, coverColor, iconColor: coverColor, status: "active", source: "manual", ...sectionFields, ...(num !== "" && { sectionNumber: num }) });
        assignToCourse(rowTeacherId(r), created.id);
      });
    } else if (course) {
      const num = sectionNumber.trim();
      updateCourse(course.id, { name: trimmed, description, coverColor, iconColor: coverColor, ...sectionFields, ...(num !== "" && { sectionNumber: num }) });
    }
    onClose();
  }

  return (
    <Modal open onClose={onClose} size="md"
      title={mode === "create" ? (duplicateFrom ? t("เพิ่ม Section ใหม่", "Add Section") : t("สร้างรายวิชาใหม่", "New Course")) : t("แก้ไขรายวิชา", "Edit Course")}
      description={duplicateFrom ? t(`เพิ่ม section ให้ "${duplicateFrom.name}" — เลือกอาจารย์และกรอกเลข section ใหม่ก่อนบันทึก (เพิ่มได้หลาย section พร้อมกัน)`, `Adding sections to "${duplicateFrom.name}" — pick a teacher and fill in each new section number before saving (you can add several at once)`) : undefined}
      footer={
        <>
          <button onClick={onClose} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create"
              ? (rows.length > 1 ? t(`สร้าง ${rows.length} section`, `Create ${rows.length} sections`) : t("สร้างรายวิชา", "Create Course"))
              : t("บันทึก", "Save")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
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
            <div className={mode === "edit" ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"}>
              <input
                type="number"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder={t("ปี", "Year")}
                className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs tabular-nums text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value === "" ? "" : (Number(e.target.value) as 1 | 2 | 3))}
                className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              >
                <option value="">{t("เทอม", "Term")}</option>
                <option value="1">{t("เทอม 1", "Term 1")}</option>
                <option value="2">{t("เทอม 2", "Term 2")}</option>
                <option value="3">{t("เทอม 3", "Term 3")}</option>
              </select>
              {/* Editing one course keeps its single section field here; creating uses the Sections rows below */}
              {mode === "edit" && (
                <input
                  value={sectionNumber}
                  onChange={(e) => setSectionNumber(e.target.value)}
                  placeholder={t("Section", "Section")}
                  className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                />
              )}
            </div>
          </div>
        )}

        {/* Class Schedule & Room — the course's teacher sets these themselves, not admin */}
        <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3">
          <p className="text-xs font-semibold text-[var(--text-muted)] mb-2">{t("วันเวลาเรียน / ห้องเรียน", "Class Schedule / Room")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-[var(--text-muted)]">{t("วันเวลาเรียน", "Schedule")}</p>
              <p className="text-sm text-[var(--text-secondary)]">{course?.schedule || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] text-[var(--text-muted)]">{t("ห้องเรียน", "Room")}</p>
              <p className="text-sm text-[var(--text-secondary)]">{course?.room || "-"}</p>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mt-2">{t("อาจารย์ประจำวิชาจะเป็นผู้กำหนดข้อมูลนี้เองภายหลัง", "The course's teacher sets this themselves later")}</p>
        </div>

        {/* Primary teacher — required at creation; reassign later via the course row's expand panel.
            Shared by every section below unless "same teacher for all" is switched off. */}
        {mode === "create" && shared && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {rows.length > 1 ? t("อาจารย์ประจำวิชา (ทุก section)", "Primary Teacher (all sections)") : t("อาจารย์ประจำวิชา", "Primary Teacher")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <SearchInput
              value={teacherQuery}
              onChange={setTeacherQuery}
              placeholder={t("พิมพ์ชื่ออาจารย์...", "Type a teacher's name...")}
              ariaLabel={t("อาจารย์ประจำวิชา", "Primary Teacher")}
              suggestions={teachers.map(teacherDisplayName)}
              className="w-full"
            />
            {teacherQuery.trim() !== "" && !teacherId && (
              <p className="text-[11px] text-[var(--s-err-text)]">{t("ไม่พบอาจารย์ชื่อนี้ — เลือกจากรายการที่แนะนำ", "No teacher by that name — pick one from the suggestions")}</p>
            )}
            {teachers.length === 0 && (
              <p className="text-[11px] text-[var(--s-err-text)]">{t("ยังไม่มีอาจารย์ในระบบ — ไปเพิ่มที่หน้าจัดการอาจารย์ก่อน", "No teachers yet — add one on the User Management page first")}</p>
            )}
          </div>
        )}

        {/* Sections — one row per section to open now; each becomes its own course row */}
        {mode === "create" && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">{t("Section ที่จะเปิด", "Sections to open")}</p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  {t("เปิดได้หลาย section พร้อมกัน — ข้อมูลวิชาด้านบนใช้ร่วมกัน", "Open several sections at once — the course details above are shared")}
                </p>
              </div>
              <button
                type="button"
                onClick={addRow}
                className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[var(--accent)] text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                {t("เพิ่ม Section", "Add section")}
              </button>
            </div>

            {rows.length > 1 && (
              <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer w-fit">
                <input
                  type="checkbox"
                  checked={sameTeacher}
                  onChange={(e) => handleSameTeacherChange(e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent-solid)]"
                />
                {t("อาจารย์เหมือนกันทุก section", "Same teacher for all sections")}
              </label>
            )}

            <ul className="flex flex-col gap-2">
              {rows.map((r, i) => {
                const err = rowErrors[r.key];
                // Only nag once there's something to fix beyond "not filled in yet" on a pristine row
                const showErr = !!err && (r.number.trim() !== "" || r.teacherQuery.trim() !== "" || rows.length > 1 || err === t("มี section นี้อยู่แล้ว", "This section already exists"));
                return (
                  <li key={r.key} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <input
                        value={r.number}
                        onChange={(e) => updateRow(r.key, { number: e.target.value })}
                        placeholder={t("Section", "Section")}
                        aria-label={t(`เลข section แถวที่ ${i + 1}`, `Section number, row ${i + 1}`)}
                        aria-invalid={showErr && err !== t("เลือกอาจารย์", "Pick a teacher")}
                        className="h-9 w-24 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-sm tabular-nums text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
                      />
                      {!shared && (
                        <SearchInput
                          value={r.teacherQuery}
                          onChange={(v) => updateRow(r.key, { teacherQuery: v })}
                          placeholder={t("พิมพ์ชื่ออาจารย์...", "Type a teacher's name...")}
                          ariaLabel={t(`อาจารย์ section แถวที่ ${i + 1}`, `Teacher for section row ${i + 1}`)}
                          suggestions={teachers.map(teacherDisplayName)}
                          className="flex-1 min-w-0"
                        />
                      )}
                      {shared && <span className="flex-1 min-w-0 text-xs text-[var(--text-muted)] truncate">{teacherQuery.trim() || t("ใช้อาจารย์ด้านบน", "Uses the teacher above")}</span>}
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(r.key)}
                          aria-label={t(`ลบ section แถวที่ ${i + 1}`, `Remove section row ${i + 1}`)}
                          title={t("ลบแถวนี้", "Remove this row")}
                          className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                    {showErr && <p role="alert" className="text-[11px] text-[var(--s-err-text)] pl-1">{err}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Color picker */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[var(--text-muted)]">{t("สีปก", "Cover Color")}</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setCoverColor(c)}
                className="w-8 h-8 rounded-lg border-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                style={{
                  background: c,
                  borderColor: c === coverColor ? "var(--accent-bright)" : "transparent",
                  transform: c === coverColor ? "scale(1.08)" : "scale(1)",
                }}
                aria-label={c}
                aria-pressed={c === coverColor}
              />
            ))}
          </div>
          {/* Preview */}
          <div className="flex items-center gap-3 mt-1 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
            <div
              className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-xs"
              style={{ background: coverColor }}
              aria-hidden="true"
            >
              {(name || "?").charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">{name || t("ชื่อรายวิชา", "Course name")}</span>
          </div>
        </div>
      </div>

    </Modal>
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
// (CSV import popup on teacher/courses/[id]/students), not
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
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("อาจารย์ผู้สอน", "Teacher")}</p>
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
          <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
            <SearchInput
              value={teacherSearch}
              onChange={setTeacherSearch}
              placeholder={t("ค้นหาอาจารย์...", "Search teachers...")}
              suggestions={sortedTeachers.map((tc) => tc.name)}
              className="w-full"
            />
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
  onAddSection,
  onAction,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  /** "+ Add Section" (23/9/2569) — omitted for archived rows, duplicating an archived course
   *  as a new active one isn't a meaningful action. */
  onAddSection?: (c: Course) => void;
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
            {/* Given a real label + border (23/9/2569, was an icon-only button identical in weight
                to Edit/Archive/Delete) — a tooltip-only "Add Section" was easy to miss entirely
                among 4 unlabeled icons; this is the one action here that isn't a standard CRUD
                verb a teacher already expects, so it earns visible text. */}
            {onAddSection && (
              <button
                onClick={() => onAddSection(course)}
                aria-label={t("เพิ่ม Section", "Add Section")}
                title={t("เพิ่ม Section ใหม่จากวิชานี้", "Add a new section from this course")}
                className="flex items-center gap-1 h-7 px-2 rounded-lg border border-[var(--accent)]/30 text-[var(--accent)] text-[11px] font-medium hover:border-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors mr-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t("Section", "Section")}
              </button>
            )}
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
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Course | undefined>(undefined);
  // "+ Add Section" (23/9/2569): duplicates an existing course as a new one, pre-filled from it —
  // there's no separate Section entity (see lib/courses.ts), Course already carries the section
  // fields directly, so a new section is just another Course sharing the same template/term/year.
  const [duplicateFrom, setDuplicateFrom] = useState<Course | undefined>(undefined);
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
          onClick={() => { setEditTarget(undefined); setModalMode("create"); }}
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
              onClick={() => { setEditTarget(undefined); setModalMode("create"); }}
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
                    onEdit={(c) => { setEditTarget(c); setModalMode("edit"); }}
                    onAddSection={(c) => { setEditTarget(undefined); setDuplicateFrom(c); setModalMode("create"); }}
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
                    onEdit={(c) => { setEditTarget(c); setModalMode("edit"); }}
                    onAction={handleAction}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Popups & dialogs */}
      {modalMode && (
        <CourseModal
          mode={modalMode}
          course={editTarget}
          duplicateFrom={duplicateFrom}
          onClose={() => { setModalMode(null); setDuplicateFrom(undefined); }}
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
