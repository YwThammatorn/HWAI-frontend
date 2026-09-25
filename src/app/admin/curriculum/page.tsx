"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import {
  useCurriculum,
  CurriculumVersion,
  CourseTemplate,
  Program,
} from "@/lib/curriculum";
import { splitCsvLine } from "@/lib/csv";
import EmptyState from "@/components/EmptyState";
import StatCard from "@/components/StatCard";
import Modal from "@/components/Modal";

const PROGRAMS: Program[] = ["CECS", "CEI", "CE"];

// ── Course template CSV import ──────────────────────────────────────────────

type CourseRowError = { type: "missing_fields"; fields: string[] };

interface ParsedCourseRow {
  code: string;
  name: string;
  description: string;
  error?: CourseRowError;
}

function parseCourseTemplateCsv(raw: string): ParsedCourseRow[] {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((h, idx) => [h.trim().toLowerCase(), idx]));
  return lines.slice(1).map((line): ParsedCourseRow => {
    const cells = splitCsvLine(line);
    const get = (key: string) => cells[colIndex[key]] ?? "";
    const code = get("code") || get("รหัสวิชา");
    const name = get("name") || get("ชื่อวิชา");
    const description = get("description") || get("คำอธิบาย");
    const missing: string[] = [];
    if (!code) missing.push("code");
    if (!name) missing.push("name");
    if (missing.length > 0) return { code, name, description, error: { type: "missing_fields", fields: missing } };
    return { code, name, description };
  });
}

function CourseTemplateImportModal({
  curriculumVersionId,
  onClose,
}: {
  curriculumVersionId: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addCourseTemplate, getCourseTemplatesByCurriculum } = useCurriculum();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedCourseRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Snapshotted at import time — newRows/dupRows/errorRows are derived from
  // existingCodes, which shifts the moment the import lands, so reading them
  // after setDone(true) would show "0 added" instead of what actually happened.
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);

  const existingCodes = new Set(getCourseTemplatesByCurriculum(curriculumVersionId).map((c) => c.code.toLowerCase()));
  const errorRows = rows?.filter((r) => r.error) ?? [];
  const dupRows = rows?.filter((r) => !r.error && existingCodes.has(r.code.toLowerCase())) ?? [];
  const newRows = rows?.filter((r) => !r.error && !existingCodes.has(r.code.toLowerCase())) ?? [];

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setRows(parseCourseTemplateCsv(text));
    };
    reader.readAsText(file, "utf-8");
  }

  function handleImport() {
    if (!newRows.length) return;
    setImporting(true);
    newRows.forEach((row) => {
      addCourseTemplate({ curriculumVersionId, code: row.code, name: row.name, description: row.description || undefined });
    });
    setResult({ added: newRows.length, skipped: dupRows.length + errorRows.length });
    setImporting(false);
    setDone(true);
  }

  function handleClose() {
    setRows(null);
    setFileName("");
    setDone(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  return (
    <Modal open onClose={handleClose} size="lg" title={t("นำเข้ารายวิชา", "Import Courses")}
      footer={
        <>
          <button onClick={handleClose}
            className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {done ? t("ปิด", "Close") : t("ยกเลิก", "Cancel")}
          </button>
          {rows && !done && (
            <button onClick={handleImport} disabled={newRows.length === 0 || importing}
              className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`+ นำเข้า ${newRows.length} วิชา`, `+ Import ${newRows.length}`)}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!rows && !done && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/5" : "border-[var(--border-subtle)] hover:border-[var(--accent-bright)]/50"}`}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t("คอลัมน์: code, name, description", "Columns: code, name, description")}</p>
          </div>
        )}
        {!rows && !done && (
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-bright)]/15 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/>
                  <polyline points="9 15 12 18 15 15"/>
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)]">{t("ดาวน์โหลด Template", "Download Template")}</p>
                <p className="text-[11px] text-[var(--text-muted)] truncate">course-templates-template.csv</p>
              </div>
            </div>
            <a href="/course-templates-template.csv" download
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-bright)]/40 text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors">
              {t("ดาวน์โหลด", "Download")}
            </a>
          </div>
        )}
        {rows && !done && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
              <span className="text-[var(--text-muted)]">—</span>
              <span className="text-[var(--s-ok-text)] font-medium">{t(`ใหม่ ${newRows.length}`, `New: ${newRows.length}`)}</span>
              {dupRows.length > 0 && <span className="text-[var(--s-warn-text)]">{t(`ซ้ำ ${dupRows.length}`, `Dup: ${dupRows.length}`)}</span>}
              {errorRows.length > 0 && <span className="text-[var(--s-err-text)]">{t(`ผิด ${errorRows.length}`, `Err: ${errorRows.length}`)}</span>}
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  {/* --bg-subtle is reserved for row hover, never a static header fill (DESIGN.md §9b) —
                      --text-muted drops below 4.5:1 on it. */}
                  <thead className="bg-[var(--bg-surface)] sticky top-0 border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("รหัสวิชา", "Code")}</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("ชื่อวิชา", "Name")}</th>
                      <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("สถานะ", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const isDup = !row.error && existingCodes.has(row.code.toLowerCase());
                      return (
                        <tr key={idx} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-[var(--s-err-bg)]" : isDup ? "bg-[var(--s-warn-bg)]" : ""}`}>
                          <td className="px-3 py-2 text-[var(--text-primary)] tabular-nums max-w-[110px] truncate">{row.code || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                          <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[150px] truncate">{row.name || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="text-[var(--s-err-text)]">{t(`ขาด: ${row.error.fields.join(", ")}`, `Missing: ${row.error.fields.join(", ")}`)}</span>
                            ) : isDup ? (
                              <span className="text-[var(--s-warn-text)]">{t("มีแล้ว", "Exists")}</span>
                            ) : (
                              <span className="text-[var(--s-ok-text)]">{t("ใหม่", "New")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <button onClick={() => { setRows(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors">
              {t("เลือกไฟล์ใหม่", "Choose different file")}
            </button>
          </div>
        )}
        {done && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-12 h-12 rounded-full bg-[var(--s-ok-bg)] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--s-ok-text)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("นำเข้าสำเร็จ", "Import complete")}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {t(`เพิ่ม ${result?.added ?? 0} วิชา (ข้าม ${result?.skipped ?? 0} รายการ)`,
                 `Added ${result?.added ?? 0} course(s) (skipped ${result?.skipped ?? 0})`)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Curriculum version create/edit (centred popup) ──────────────────────────────────────

function CurriculumModal({
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

  // Same 3-entry map pattern already duplicated per-component elsewhere in this codebase
  // (admin/users.tsx's AddStudentModal/StudentsTab, teacher/courses/[id]/students/page.tsx).
  const PROGRAM_LABEL: Record<Program, string> = {
    CE: t("วิศวกรรมคอมพิวเตอร์", "Computer Engineering"),
    CECS: t("วิศวกรรมคอมพิวเตอร์และความมั่นคงปลอดภัยไซเบอร์", "Computer Engineering and Cybersecurity"),
    CEI: t("วิศวกรรมคอมพิวเตอร์นานาชาติ", "Computer Engineering International"),
  };

  const currentYear = new Date().getFullYear() + 543; // พ.ศ.
  const [program, setProgram] = useState<Program>(version?.program ?? "CE");
  const [manualLabel, setManualLabel] = useState(version?.label ?? "");
  // Edit mode starts with a real, previously-chosen label — don't let the auto-default
  // below silently overwrite it just because the admin changes the program.
  const [labelTouched, setLabelTouched] = useState(mode === "edit");
  const [effectiveFrom, setEffectiveFrom] = useState(String(version?.effectiveFrom ?? currentYear));
  const [effectiveTo, setEffectiveTo] = useState(version?.effectiveTo != null ? String(version.effectiveTo) : "");
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => { labelRef.current?.focus(); }, []);

  // Default the Label text from Program + Year (23/9/2569) — was only ever shown as
  // placeholder ghost text before, never actually written into the field. A plain derived
  // value (not an effect writing back into state) so it updates immediately as Program/Year
  // change, and stops the moment the admin edits the label by hand (labelTouched) — same
  // "don't clobber what they typed" intent as New Assignment's rubricTouched elsewhere.
  const label = labelTouched ? manualLabel : `${program} ${effectiveFrom || currentYear}`;

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
    <Modal open onClose={onClose} size="md" title={mode === "create" ? t("สร้างหลักสูตรใหม่", "New Curriculum Version") : t("แก้ไขหลักสูตร", "Edit Curriculum Version")}
      footer={
        <>
          <button onClick={onClose} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("สร้างหลักสูตร", "Create Version") : t("บันทึก", "Save")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Program */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            {t("หลักสูตร", "Program")} <span className="text-[var(--s-err-text)]">*</span>
          </label>
          <select
            value={program}
            onChange={(e) => setProgram(e.target.value as Program)}
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
          >
            {PROGRAMS.map((p) => (
              <option key={p} value={p}>{PROGRAM_LABEL[p]}</option>
            ))}
          </select>
        </div>

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-muted)]">
            {t("ชื่อหลักสูตร (รุ่น)", "Label")} <span className="text-[var(--s-err-text)]">*</span>
          </label>
          <input
            ref={labelRef}
            value={label}
            onChange={(e) => { setManualLabel(e.target.value); setLabelTouched(true); }}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]"
          />
          <p className="text-[11px] text-[var(--text-muted)]">{t("ระบุรุ่น/สาขาให้ชัด — เช่น เพิ่มปีหรือแทร็กต่อท้าย", "Be specific about batch/track — e.g. add the year or a track suffix")}</p>
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

    </Modal>
  );
}

// ── Course template create/edit (centred popup) ─────────────────────────────────────────

function CourseTemplateModal({
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

  useEffect(() => { codeRef.current?.focus(); }, []);

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
    <Modal open onClose={onClose} size="md" title={mode === "create" ? t("เพิ่มรายวิชาในหลักสูตร", "New Course Template") : t("แก้ไขรายวิชา", "Edit Course Template")}
      footer={
        <>
          <button onClick={onClose} className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] disabled:opacity-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
          >
            {mode === "create" ? t("เพิ่มรายวิชา", "Add Course") : t("บันทึก", "Save")}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
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
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors">
      <div className="w-8 h-8 rounded-lg bg-[var(--accent-bright)]/20 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center shrink-0 select-none tabular-nums" aria-hidden="true">
        {template.code.slice(-3)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)] truncate">{template.name}</p>
        <p className="text-[11px] text-[var(--text-muted)] tabular-nums truncate">{template.code}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
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
  const [templateModal, setTemplateModal] = useState<"create" | "edit" | null>(null);
  const [editTemplate, setEditTemplate] = useState<CourseTemplate | undefined>(undefined);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<CourseTemplate | null>(null);
  const [importOpen, setImportOpen] = useState(false);

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-xs font-semibold hover:bg-[var(--bg-subtle)] hover:border-[var(--accent-bright)] hover:text-[var(--text-primary)] transition-colors inline-flex items-center gap-1.5"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                  </svg>
                  {t("นำเข้า CSV", "Import CSV")}
                </button>
                <button
                  onClick={() => { setEditTemplate(undefined); setTemplateModal("create"); }}
                  className="h-7 px-2.5 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-xs font-semibold hover:bg-[var(--accent-solid-hover)] transition-colors"
                >
                  {t("+ เพิ่มรายวิชา", "+ Add course")}
                </button>
              </div>
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] px-3 py-2">{t("ยังไม่มีรายวิชาในหลักสูตรนี้", "No courses in this curriculum yet")}</p>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
                {templates.map((tpl) => (
                  <CourseTemplateRow
                    key={tpl.id}
                    template={tpl}
                    onEdit={() => { setEditTemplate(tpl); setTemplateModal("edit"); }}
                    onDelete={() => setPendingDeleteTemplate(tpl)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {templateModal && (
        <CourseTemplateModal
          mode={templateModal}
          template={editTemplate}
          curriculumVersionId={version.id}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {importOpen && (
        <CourseTemplateImportModal
          curriculumVersionId={version.id}
          onClose={() => setImportOpen(false)}
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
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
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
          onClick={() => { setEditTarget(undefined); setModalMode("create"); }}
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
          label={t("หลักสูตรทั้งหมด", "Total Curriculum")}
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
              onClick={() => { setEditTarget(undefined); setModalMode("create"); }}
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
              {t(`หลักสูตรที่ใช้อยู่ (${activeVersions.length})`, `Active curriculum (${activeVersions.length})`)}
            </p>
            <div className="flex flex-col gap-3">
              {activeVersions.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีหลักสูตรที่ใช้อยู่", "No active curriculum")}</p>
              ) : (
                activeVersions.map((v) => (
                  <CurriculumRow
                    key={v.id}
                    version={v}
                    onEdit={() => { setEditTarget(v); setModalMode("edit"); }}
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
                    onEdit={() => { setEditTarget(v); setModalMode("edit"); }}
                    onDelete={() => setPendingDelete(v)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {modalMode && (
        <CurriculumModal
          mode={modalMode}
          version={editTarget}
          onClose={() => setModalMode(null)}
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
