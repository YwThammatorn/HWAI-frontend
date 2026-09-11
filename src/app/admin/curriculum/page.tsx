"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  useCurriculum,
  CurriculumVersion,
  CourseTemplate,
  Program,
} from "@/lib/curriculum";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";

const PROGRAMS: Program[] = ["CECS", "CEI", "CE"];

// ── Curriculum version create/edit drawer ──────────────────────────────────────

function CurriculumDrawer({
  mode,
  version,
  onClose,
}: {
  mode: "create" | "edit";
  version?: CurriculumVersion;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addCurriculumVersion, updateCurriculumVersion } = useCurriculum();

  const currentYear = new Date().getFullYear() + 543; // พ.ศ.
  const [program, setProgram] = useState<Program>(version?.program ?? "CE");
  const [label, setLabel] = useState(version?.label ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(String(version?.effectiveFrom ?? currentYear));
  const [effectiveTo, setEffectiveTo] = useState(version?.effectiveTo != null ? String(version.effectiveTo) : "");
  const labelRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { labelRef.current?.focus(); }, []);

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

  const fromNum = parseInt(effectiveFrom, 10);
  const toNum = effectiveTo.trim() === "" ? undefined : parseInt(effectiveTo, 10);
  const isValid = label.trim() !== "" && !isNaN(fromNum) && (toNum === undefined || (!isNaN(toNum) && toNum >= fromNum));

  function handleSave() {
    if (!isValid) return;
    const data = { program, label: label.trim(), effectiveFrom: fromNum, effectiveTo: toNum };
    if (mode === "create") {
      addCurriculumVersion(data);
    } else if (version) {
      updateCurriculumVersion(version.id, data);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="curriculum-drawer-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="curriculum-drawer-title" className="text-base font-bold text-[var(--text-primary)]">
            {mode === "create" ? t("สร้างหลักสูตรใหม่", "New Curriculum Version") : t("แก้ไขหลักสูตร", "Edit Curriculum Version")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Program */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {t("หลักสูตร", "Program")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PROGRAMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProgram(p)}
                  aria-pressed={program === p}
                  className={`h-10 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] ${
                    program === p
                      ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/10 text-[var(--accent)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {t("ชื่อหลักสูตร (รุ่น)", "Label")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              ref={labelRef}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t(`เช่น ${program} ${currentYear}`, `e.g. ${program} ${currentYear}`)}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
            <p className="text-[11px] text-[var(--text-muted)]">{t("ระบุรุ่น/สาขาให้ชัด — cohort อย่างเดียวไม่พอสำหรับแยกหลักสูตร", "Be specific about batch/track — cohort alone isn't enough to distinguish curricula")}</p>
          </div>

          {/* Effective years */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                {t("ใช้ตั้งแต่ปี (พ.ศ.)", "Effective From")} <span className="text-[var(--s-err-text)]">*</span>
              </label>
              <input
                type="number"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-muted)]">{t("ถึงปี (ไม่บังคับ)", "Effective To (optional)")}</label>
              <input
                type="number"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                placeholder={t("ยังใช้อยู่", "still in use")}
                className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
              />
            </div>
          </div>
          {effectiveTo.trim() !== "" && toNum !== undefined && !isNaN(toNum) && toNum < fromNum && (
            <p className="text-xs text-[var(--s-err-text)]">{t("ปีสิ้นสุดต้องไม่น้อยกว่าปีเริ่มใช้", "End year must not be before the start year")}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("สร้างหลักสูตร", "Create Version") : t("บันทึก", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Course template create/edit drawer ─────────────────────────────────────────

function CourseTemplateDrawer({
  mode,
  template,
  curriculumVersionId,
  onClose,
}: {
  mode: "create" | "edit";
  template?: CourseTemplate;
  curriculumVersionId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addCourseTemplate, updateCourseTemplate } = useCurriculum();

  const [code, setCode] = useState(template?.code ?? "");
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const codeRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { codeRef.current?.focus(); }, []);
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

  const isValid = code.trim() !== "" && name.trim() !== "";

  function handleSave() {
    if (!isValid) return;
    if (mode === "create") {
      addCourseTemplate({ curriculumVersionId, code: code.trim(), name: name.trim(), description: description.trim() || undefined });
    } else if (template) {
      updateCourseTemplate(template.id, { code: code.trim(), name: name.trim(), description: description.trim() || undefined });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="course-template-drawer-title"
        className="w-full max-w-md bg-[var(--bg-surface)] flex flex-col shadow-2xl"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="course-template-drawer-title" className="text-base font-bold text-[var(--text-primary)]">
            {mode === "create" ? t("เพิ่มรายวิชาในหลักสูตร", "New Course Template") : t("แก้ไขรายวิชา", "Edit Course Template")}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] transition-colors" aria-label={t("ปิด", "Close")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {t("รหัสวิชา", "Course Code")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("เช่น 01076312", "e.g. 01076312")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[var(--text-muted)]">
              {t("ชื่อวิชา", "Course Name")} <span className="text-[var(--s-err-text)]">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder={t("เช่น การออกแบบ UX/UI", "e.g. UX/UI Design")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
            />
          </div>
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
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="h-9 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("เพิ่มรายวิชา", "Add Course") : t("บันทึก", "Save")}
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
  const { t } = useLanguage();
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
            {t("ยกเลิก", "Cancel")}
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

// ── Course template row ─────────────────────────────────────────────────────────

function CourseTemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: CourseTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-subtle)] group transition-colors">
      <div className="w-8 h-8 rounded-lg bg-[var(--accent-bright)]/20 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center shrink-0 select-none tabular-nums" aria-hidden="true">
        {template.code.slice(-3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{template.name}</p>
        <p className="text-[11px] text-[var(--text-muted)] tabular-nums truncate">{template.code}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          title="Edit"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Curriculum version row (accordion) ──────────────────────────────────────────

function CurriculumRow({
  version,
  onEdit,
  onDelete,
}: {
  version: CurriculumVersion;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLanguage();
  const { getCourseTemplatesByCurriculum, removeCourseTemplate } = useCurriculum();
  const [expanded, setExpanded] = useState(false);
  const [templateDrawer, setTemplateDrawer] = useState<"create" | "edit" | null>(null);
  const [editTemplate, setEditTemplate] = useState<CourseTemplate | undefined>(undefined);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<CourseTemplate | null>(null);

  const templates = getCourseTemplatesByCurriculum(version.id);
  const isActive = version.effectiveTo === undefined;

  const PROGRAM_COLOR: Record<Program, string> = { CECS: "#7C3AED", CEI: "#2563EB", CE: "#0F766E" };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors">
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`curriculum-panel-${version.id}`}
          className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] focus-visible:rounded-lg"
        >
          <div
            className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-[10px]"
            style={{ background: PROGRAM_COLOR[version.program] }}
            aria-hidden="true"
          >
            {version.program}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{version.label}</p>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${isActive ? "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"}`}>
                {isActive ? t("ใช้อยู่", "Active") : t("เลิกใช้แล้ว", "Retired")}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
              {version.effectiveFrom}{version.effectiveTo ? ` – ${version.effectiveTo}` : ` – ${t("ปัจจุบัน", "present")}`}
            </p>
          </div>
          <span className={`transition-transform duration-200 text-[var(--text-muted)] shrink-0 ${expanded ? "rotate-180" : ""}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </button>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{templates.length}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{t("รายวิชา", "courses")}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              title={t("แก้ไขหลักสูตร", "Edit curriculum")}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={onDelete}
              title={t("ลบหลักสูตร", "Delete curriculum")}
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

      <div id={`curriculum-panel-${version.id}`} hidden={!expanded}>
        {expanded && (
          <div className="p-4 bg-[var(--bg-app)] rounded-b-2xl border-t border-[var(--border-subtle)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("รายวิชาในหลักสูตรนี้", "Courses in this curriculum")}</p>
              <button
                onClick={() => { setEditTemplate(undefined); setTemplateDrawer("create"); }}
                className="h-7 px-2.5 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-xs font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
              >
                {t("+ เพิ่มรายวิชา", "+ Add course")}
              </button>
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] px-3 py-2">{t("ยังไม่มีรายวิชาในหลักสูตรนี้", "No courses in this curriculum yet")}</p>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
                {templates.map((tpl) => (
                  <CourseTemplateRow
                    key={tpl.id}
                    template={tpl}
                    onEdit={() => { setEditTemplate(tpl); setTemplateDrawer("edit"); }}
                    onDelete={() => setPendingDeleteTemplate(tpl)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {templateDrawer && (
        <CourseTemplateDrawer
          mode={templateDrawer}
          template={editTemplate}
          curriculumVersionId={version.id}
          onClose={() => setTemplateDrawer(null)}
        />
      )}
      {pendingDeleteTemplate && (
        <ConfirmDialog
          title={t("ลบรายวิชานี้?", "Delete this course template?")}
          description={t(
            `"${pendingDeleteTemplate.name}" (${pendingDeleteTemplate.code}) จะถูกลบถาวร — Section ที่เปิดสอนอ้างอิงรหัสนี้อยู่จะไม่ถูกลบ แต่จะหา template ต้นทางไม่เจอ`,
            `"${pendingDeleteTemplate.name}" (${pendingDeleteTemplate.code}) will be permanently deleted — Sections referencing it are not deleted but will lose their template link`
          )}
          confirmLabel={t("ลบถาวร", "Delete Forever")}
          danger
          onConfirm={() => { removeCourseTemplate(pendingDeleteTemplate.id); setPendingDeleteTemplate(null); }}
          onCancel={() => setPendingDeleteTemplate(null)}
        />
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminCurriculumPage() {
  const { t } = useLanguage();
  const { curriculumVersions, removeCurriculumVersion, getCourseTemplatesByCurriculum } = useCurriculum();
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<CurriculumVersion | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<CurriculumVersion | null>(null);

  const activeVersions = curriculumVersions.filter((v) => v.effectiveTo === undefined);
  const retiredVersions = curriculumVersions.filter((v) => v.effectiveTo !== undefined);
  const totalTemplates = curriculumVersions.reduce((sum, v) => sum + getCourseTemplatesByCurriculum(v.id).length, 0);

  return (
    <div className="p-6 w-full">
      {/* Page heading */}
      <div className="flex items-start justify-between mb-6">
        <div className="pl-4" style={{ borderLeft: "3px solid var(--accent-bright)" }}>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {t("จัดการหลักสูตร", "Curriculum Management")}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {t("สร้างหลักสูตร (CECS/CEI/CE) และรายวิชาที่เปิดสอนภายใต้หลักสูตรนั้น", "Create curriculum versions and the course templates offered under each")}
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t("สร้างหลักสูตร", "New Curriculum")}
        </button>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 mb-6">
        <StatCard
          label={t("หลักสูตรทั้งหมด", "Total Curricula")}
          value={curriculumVersions.length}
          color="var(--accent)"
          bg="var(--accent-subtle)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          }
        />
        <StatCard
          label={t("ใช้อยู่", "Active")}
          value={activeVersions.length}
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
          label={t("รายวิชาทั้งหมด", "Total Course Templates")}
          value={totalTemplates}
          color="#92400E"
          bg="rgba(146,64,14,0.1)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          }
        />
      </div>

      {curriculumVersions.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          }
          title={t("ยังไม่มีหลักสูตรในระบบ", "No curriculum versions yet")}
          description={t("สร้างหลักสูตรแรกก่อนเพิ่มรายวิชาและเปิด Section", "Create a curriculum version before adding course templates and opening sections")}
          action={
            <button
              onClick={() => { setEditTarget(undefined); setDrawerMode("create"); }}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t("สร้างหลักสูตร", "New Curriculum")}
            </button>
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              {t(`หลักสูตรที่ใช้อยู่ (${activeVersions.length})`, `Active curricula (${activeVersions.length})`)}
            </p>
            <div className="flex flex-col gap-3">
              {activeVersions.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีหลักสูตรที่ใช้อยู่", "No active curricula")}</p>
              ) : (
                activeVersions.map((v) => (
                  <CurriculumRow
                    key={v.id}
                    version={v}
                    onEdit={() => { setEditTarget(v); setDrawerMode("edit"); }}
                    onDelete={() => setPendingDelete(v)}
                  />
                ))
              )}
            </div>
          </div>

          {retiredVersions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t(`หลักสูตรที่เลิกใช้แล้ว (${retiredVersions.length})`, `Retired (${retiredVersions.length})`)}
              </p>
              <div className="flex flex-col gap-3 opacity-60">
                {retiredVersions.map((v) => (
                  <CurriculumRow
                    key={v.id}
                    version={v}
                    onEdit={() => { setEditTarget(v); setDrawerMode("edit"); }}
                    onDelete={() => setPendingDelete(v)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {drawerMode && (
        <CurriculumDrawer
          mode={drawerMode}
          version={editTarget}
          onClose={() => setDrawerMode(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title={t("ลบหลักสูตรนี้?", "Delete this curriculum version?")}
          description={
            getCourseTemplatesByCurriculum(pendingDelete.id).length > 0
              ? t(
                  `"${pendingDelete.label}" และรายวิชาทั้ง ${getCourseTemplatesByCurriculum(pendingDelete.id).length} วิชาภายใต้หลักสูตรนี้จะถูกลบถาวร ไม่สามารถกู้คืนได้`,
                  `"${pendingDelete.label}" and all ${getCourseTemplatesByCurriculum(pendingDelete.id).length} course template(s) under it will be permanently deleted`
                )
              : t(`"${pendingDelete.label}" จะถูกลบถาวร ไม่สามารถกู้คืนได้`, `"${pendingDelete.label}" will be permanently deleted`)
          }
          confirmLabel={t("ลบถาวร", "Delete Forever")}
          danger
          onConfirm={() => { removeCurriculumVersion(pendingDelete.id); setPendingDelete(null); }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
