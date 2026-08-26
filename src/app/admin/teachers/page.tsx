"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers, ManagedTeacher } from "@/lib/managed-teachers";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

// ── CSV parsing ────────────────────────────────────────────────────────────────

type TeacherRowError = { type: "missing_fields"; fields: string[] } | { type: "invalid_email" } | { type: "invalid_role" };

interface ParsedTeacherRow {
  name: string;
  email: string;
  role: "teacher" | "ta";
  error?: TeacherRowError;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
        else if (line[i] === '"') { i++; break; }
        else { field += line[i++]; }
      }
      fields.push(field.trim());
      if (i < line.length && line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
      if (i === line.length) { fields.push(""); break; }
    }
  }
  return fields;
}

function parseTeacherCsv(raw: string): { rows: ParsedTeacherRow[]; totalErrors: number } {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalErrors: 0 };

  const header = splitCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  const rows = lines.slice(1).map((line): ParsedTeacherRow => {
    const cells = splitCsvLine(line);
    const name = cells[colIndex.name] ?? "";
    const email = cells[colIndex.email] ?? "";
    const roleRaw = (cells[colIndex.role] ?? "").toLowerCase();
    const role: "teacher" | "ta" = roleRaw === "ta" ? "ta" : "teacher";

    const missing: string[] = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (missing.length > 0) return { name, email, role, error: { type: "missing_fields", fields: missing } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { name, email, role, error: { type: "invalid_email" } };
    if (roleRaw && roleRaw !== "teacher" && roleRaw !== "ta") return { name, email, role, error: { type: "invalid_role" } };
    return { name, email, role };
  });

  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ── Import Drawer ──────────────────────────────────────────────────────────────

const SAMPLE_CSV = "name,email,role\nดร.สมชาย ใจดี,somchai@kmitl.ac.th,teacher\nผศ.ดร.สมหญิง ดีมาก,somying@kmitl.ac.th,teacher\nนายทดสอบ ระบบ,test@kmitl.ac.th,ta";

function ImportTeacherDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { importTeachers, teachers } = useManagedTeachers();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [parseResult, setParseResult] = useState<{ rows: ParsedTeacherRow[]; totalErrors: number } | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = (e) => setParseResult(parseTeacherCsv(e.target?.result as string));
    reader.readAsText(file, "utf-8");
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleImport() {
    if (!parseResult) return;
    setImporting(true);
    const existingEmails = new Set(teachers.map((tc) => tc.email));
    const toAdd = parseResult.rows
      .filter((r) => !r.error && !existingEmails.has(r.email.toLowerCase()))
      .map(({ name, email, role }) => ({ name, email: email.toLowerCase(), role }));
    importTeachers(toAdd);
    setImporting(false);
    setDone(true);
  }

  function handleClose() {
    setParseResult(null);
    setFileName("");
    setDone(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  function rowErrorLabel(err: TeacherRowError): string {
    if (err.type === "missing_fields") return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    if (err.type === "invalid_role") return t("role ต้องเป็น teacher หรือ ta", "role must be 'teacher' or 'ta'");
    return t("อีเมลไม่ถูกต้อง", "Invalid email");
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }

  if (!open) return null;

  const existingEmails = new Set(teachers.map((tc) => tc.email));
  const validRows = parseResult?.rows.filter((r) => !r.error) ?? [];
  const newRows = validRows.filter((r) => !existingEmails.has(r.email.toLowerCase()));
  const dupRows = validRows.filter((r) => existingEmails.has(r.email.toLowerCase()));
  const errorRows = parseResult?.rows.filter((r) => r.error) ?? [];

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={handleClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("นำเข้าอาจารย์ CSV", "Import Teachers CSV")}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("นำเข้าอาจารย์ CSV", "Import Teachers CSV")}</h2>
          <button
            onClick={handleClose}
            aria-label={t("ปิด", "Close")}
            autoFocus
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

          {/* Format hint */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รูปแบบ CSV ที่รองรับ", "Expected CSV format")}</p>
            <pre className="text-[11px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">{SAMPLE_CSV}</pre>
            <p className="text-[10px] text-[var(--text-muted)]">
              {t("ช่อง role: teacher หรือ ta (ถ้าเว้นว่างจะใช้ teacher)", "role column: teacher or ta (defaults to teacher if blank)")}
            </p>
          </div>

          {/* Drop zone */}
          {!parseResult && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-colors cursor-pointer ${
                dragOver ? "border-[#2DD4BF] bg-[#2DD4BF]/5" : "border-[var(--border-subtle)] hover:border-[#2DD4BF]/50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t("วางไฟล์ CSV ที่นี่", "Drop CSV file here")}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("หรือกดเพื่อเลือกไฟล์", "or click to browse")}</p>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="sr-only" onChange={handleInputChange} />
            </div>
          )}

          {/* Preview */}
          {parseResult && !done && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-[var(--text-muted)] truncate flex-1">{fileName}</p>
                <div className="flex gap-2 shrink-0">
                  {newRows.length > 0 && (
                    <span className="text-xs font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                      +{newRows.length} {t("ใหม่", "new")}
                    </span>
                  )}
                  {dupRows.length > 0 && (
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                      {dupRows.length} {t("ซ้ำ", "dup")}
                    </span>
                  )}
                  {errorRows.length > 0 && (
                    <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">
                      {errorRows.length} {t("ผิดพลาด", "error")}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--bg-app)] sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("ชื่อ", "Name")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("อีเมล", "Email")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("ตำแหน่ง", "Role")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("สถานะ", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.map((row, i) => {
                        const isDup = !row.error && existingEmails.has(row.email.toLowerCase());
                        return (
                          <tr key={i} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-red-50/50" : isDup ? "bg-amber-50/50" : ""}`}>
                            <td className="px-3 py-2 text-[var(--text-primary)] max-w-[120px] truncate">{row.name || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[140px] truncate">{row.email || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.role === "ta" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                                {row.role === "ta" ? "TA" : t("อาจารย์", "Teacher")}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.error ? (
                                <span className="text-red-600">{rowErrorLabel(row.error)}</span>
                              ) : isDup ? (
                                <span className="text-amber-600">{t("มีแล้ว", "Exists")}</span>
                              ) : (
                                <span className="text-green-600">{t("ใหม่", "New")}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={() => { setParseResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors"
              >
                {t("เลือกไฟล์ใหม่", "Choose different file")}
              </button>
            </div>
          )}

          {/* Done state */}
          {done && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("นำเข้าสำเร็จ", "Import complete")}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t(`เพิ่ม ${newRows.length} คน (ข้าม ${dupRows.length + errorRows.length} รายการ)`,
                   `Added ${newRows.length} teacher(s) (skipped ${dupRows.length + errorRows.length})`)}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] shrink-0 flex gap-2">
          <button
            onClick={handleClose}
            className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
          >
            {done ? t("ปิด", "Close") : t("ยกเลิก", "Cancel")}
          </button>
          {parseResult && !done && (
            <button
              onClick={handleImport}
              disabled={newRows.length === 0 || importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`+ นำเข้า ${newRows.length} คน`, `+ Import ${newRows.length}`)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function TeacherDrawer({
  open,
  onClose,
  mode,
  teacher,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  teacher?: ManagedTeacher;
}) {
  const { t } = useLanguage();
  const { addTeacher, updateTeacher, teachers } = useManagedTeachers();
  const [name, setName] = useState(teacher?.name ?? "");
  const [email, setEmail] = useState(teacher?.email ?? "");
  const [role, setRole] = useState<"teacher" | "ta">(teacher?.role ?? "teacher");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset fields when mode/teacher changes (drawer reused between add/edit)
  useEffect(() => {
    if (open) {
      setName(teacher?.name ?? "");
      setEmail(teacher?.email ?? "");
      setRole(teacher?.role ?? "teacher");
      setErrors({});
    }
  }, [open, teacher]);

  function validate() {
    const e: typeof errors = {};
    if (!name.trim()) e.name = t("กรุณากรอกชื่อ", "Name is required");
    if (!email.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    else {
      const normalized = email.trim().toLowerCase();
      const duplicate = teachers.some(
        (tc) => tc.email === normalized && tc.id !== teacher?.id
      );
      if (duplicate) e.email = t("อีเมลนี้มีในระบบแล้ว", "This email already exists");
    }
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    if (mode === "edit" && teacher) {
      updateTeacher(teacher.id, { name: name.trim(), email: email.trim().toLowerCase(), role });
    } else {
      addTeacher({ name: name.trim(), email: email.trim().toLowerCase(), role });
    }
    setLoading(false);
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }

  if (!open) return null;

  const title = mode === "edit" ? t("แก้ไขข้อมูลอาจารย์", "Edit Teacher") : t("เพิ่มอาจารย์", "Add Teacher");

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 gap-5 px-5 py-5 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-name" className="text-sm font-medium text-[var(--text-primary)]">
              {t("ชื่อ-นามสกุล", "Full Name")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="teacher-name"
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder={t("เช่น ดร.สมชาย ใจดี", "e.g. Dr. John Smith")}
              aria-describedby={errors.name ? "teacher-name-err" : undefined}
              aria-invalid={!!errors.name}
              aria-required="true"
              autoFocus
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
            {errors.name && <p id="teacher-name-err" role="alert" className="text-xs text-red-500">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-email" className="text-sm font-medium text-[var(--text-primary)]">
              {t("อีเมล", "Email")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              id="teacher-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="teacher@kmitl.ac.th"
              aria-describedby={errors.email ? "teacher-email-err" : undefined}
              aria-invalid={!!errors.email}
              aria-required="true"
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            />
            {errors.email && <p id="teacher-email-err" role="alert" className="text-xs text-red-500">{errors.email}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-role" className="text-sm font-medium text-[var(--text-primary)]">{t("ตำแหน่ง", "Role")}</label>
            <select
              id="teacher-role"
              value={role}
              onChange={(e) => setRole(e.target.value as "teacher" | "ta")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
            >
              <option value="teacher">{t("อาจารย์", "Teacher")}</option>
              <option value="ta">{t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)")}</option>
            </select>
          </div>

          <div className="mt-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {loading
                ? t("กำลังบันทึก…", "Saving…")
                : mode === "edit"
                  ? t("บันทึก", "Save Changes")
                  : t("เพิ่มอาจารย์", "Add Teacher")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ConfirmDeleteDialog({
  teacher,
  onConfirm,
  onCancel,
}: {
  teacher: ManagedTeacher;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape (component only mounts when visible)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { last.focus(); e.preventDefault(); }
    } else {
      if (document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onCancel} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <h3 id="delete-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการลบ", "Confirm Delete")}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t(`ลบ "${teacher.name}" ออกจากระบบ?`, `Remove "${teacher.name}" from system?`)}
            </p>
            {teacher.courseIds.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {t(
                  `อาจารย์นี้ถูก assign ใน ${teacher.courseIds.length} รายวิชา`,
                  `This teacher is assigned to ${teacher.courseIds.length} course(s)`
                )}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            autoFocus
            className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
          >
            {t("ยกเลิก", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
          >
            {t("ลบ", "Delete")}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminTeachersPage() {
  const { t } = useLanguage();
  const { teachers, removeTeacher } = useManagedTeachers();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<ManagedTeacher | undefined>(undefined);

  const deletingTeacher = teachers.find((tp) => tp.id === deletingId);

  const ROLE_LABELS: Record<"teacher" | "ta", string> = {
    teacher: t("อาจารย์", "Teacher"),
    ta: t("ผู้ช่วยสอน", "TA"),
  };

  return (
    <div className="p-6 max-w-4xl">
        <PageHeader
          title={t("จัดการอาจารย์", "Teacher Management")}
          description={t(`อาจารย์ทั้งหมด ${teachers.length} คน`, `${teachers.length} teacher(s) in system`)}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                </svg>
                {t("นำเข้า CSV", "Import CSV")}
              </button>
              <button
                onClick={() => { setEditingTeacher(undefined); setDrawerOpen(true); }}
                className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {t("เพิ่มอาจารย์", "Add Teacher")}
              </button>
            </div>
          }
        />

        {teachers.length === 0 ? (
          <EmptyState
            iconColor="#2DD4BF"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
            title={t("ยังไม่มีอาจารย์ในระบบ", "No teachers yet")}
            description={t("เพิ่มอาจารย์คนแรกเพื่อเริ่มต้น", "Add the first teacher to get started")}
            action={
              <button
                onClick={() => { setEditingTeacher(undefined); setDrawerOpen(true); }}
                className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
              >
                {t("เพิ่มอาจารย์", "Add Teacher")}
              </button>
            }
          />
        ) : (
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ชื่อ", "Name")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ตำแหน่ง", "Role")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รายวิชา", "Courses")}</th>
                  <th scope="col" className="px-4 py-3 w-24"><span className="sr-only">{t("การจัดการ", "Actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((teacher, i) => (
                  <tr
                    key={teacher.id}
                    className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] transition-colors ${i % 2 === 1 ? "bg-[var(--bg-app)]" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#2DD4BF]/20 flex items-center justify-center text-[#0F766E] text-xs font-bold shrink-0 select-none" aria-hidden="true">
                          {getInitials(teacher.name)}
                        </div>
                        {teacher.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{teacher.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        teacher.role === "teacher"
                          ? "bg-[#2DD4BF]/10 text-[#0F766E]"
                          : "bg-[#A78BFA]/10 text-[#7C3AED]"
                      }`}>
                        {ROLE_LABELS[teacher.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-muted)] font-variant-numeric tabular-nums">
                      {teacher.courseIds.length}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingTeacher(teacher); setDrawerOpen(true); }}
                          aria-label={t(`แก้ไข ${teacher.name}`, `Edit ${teacher.name}`)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[#0F766E] hover:bg-[#2DD4BF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeletingId(teacher.id)}
                          aria-label={t(`ลบ ${teacher.name}`, `Delete ${teacher.name}`)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <TeacherDrawer
        open={drawerOpen}
        mode={editingTeacher ? "edit" : "create"}
        teacher={editingTeacher}
        onClose={() => { setDrawerOpen(false); setEditingTeacher(undefined); }}
      />
      <ImportTeacherDrawer open={importOpen} onClose={() => setImportOpen(false)} />

      {deletingTeacher && (
        <ConfirmDeleteDialog
          teacher={deletingTeacher}
          onConfirm={() => { removeTeacher(deletingId!); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}
