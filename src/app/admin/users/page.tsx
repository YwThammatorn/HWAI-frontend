"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers, ManagedTeacher } from "@/lib/managed-teachers";
import { useCohortStudents, CohortStudent } from "@/lib/cohort-students";
import { useCourses } from "@/lib/courses";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import SearchInput from "@/components/SearchInput";
import StatCard from "@/components/StatCard";
import PillTabBar from "@/components/PillTabBar";

// ═══════════════════════════════════════════════════════════════
// TEACHERS — CSV parsing
// ═══════════════════════════════════════════════════════════════

type TeacherRowError = { type: "missing_fields"; fields: string[] } | { type: "invalid_email" } | { type: "invalid_domain" } | { type: "invalid_role" };

interface ParsedTeacherRow {
  name: string;
  email: string;
  role: "teacher" | "ta";
  error?: TeacherRowError;
}

interface TeacherParseResult {
  rows: ParsedTeacherRow[];
  totalErrors: number;
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

function parseTeacherCsv(raw: string): TeacherParseResult {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalErrors: 0 };
  const header = splitCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((h, idx) => [h.trim().toLowerCase(), idx]));
  const rows = lines.slice(1).map((line): ParsedTeacherRow => {
    const cells = splitCsvLine(line);
    const get = (key: string) => cells[colIndex[key]] ?? "";
    const name = get("name") || get("ชื่อ");
    const email = get("email") || get("อีเมล");
    const rawRole = (get("role") || get("ตำแหน่ง") || "teacher").toLowerCase().trim();
    const role: "teacher" | "ta" = rawRole === "ta" ? "ta" : "teacher";
    if (!name) return { name, email, role, error: { type: "missing_fields", fields: ["name"] } };
    if (!email) return { name, email, role, error: { type: "missing_fields", fields: ["email"] } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { name, email, role, error: { type: "invalid_email" } };
    if (!email.toLowerCase().endsWith("@kmitl.ac.th")) return { name, email, role, error: { type: "invalid_domain" } };
    return { name, email, role };
  });
  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Import Drawer
// ═══════════════════════════════════════════════════════════════

function ImportTeacherDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addTeacher, teachers } = useManagedTeachers();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [parseResult, setParseResult] = useState<TeacherParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setParseResult(parseTeacherCsv(text));
    };
    reader.readAsText(file, "utf-8");
  }

  const existingEmails = new Set(teachers.map((tc) => tc.email.toLowerCase()));
  const errorRows = parseResult?.rows.filter((r) => r.error) ?? [];
  const dupRows = parseResult?.rows.filter((r) => !r.error && existingEmails.has(r.email.toLowerCase())) ?? [];
  const newRows = parseResult?.rows.filter((r) => !r.error && !existingEmails.has(r.email.toLowerCase())) ?? [];

  function handleImport() {
    if (!newRows.length) return;
    setImporting(true);
    newRows.forEach((row) => addTeacher({ name: row.name, email: row.email.toLowerCase(), role: row.role }));
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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  function teacherRowErrorLabel(err: TeacherRowError) {
    if (err.type === "missing_fields") return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    if (err.type === "invalid_email") return t("อีเมลไม่ถูกต้อง", "Invalid email");
    if (err.type === "invalid_domain") return t("ต้องเป็น @kmitl.ac.th", "Must be @kmitl.ac.th");
    return t("role ไม่ถูกต้อง", "Invalid role");
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={handleClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-label={t("นำเข้าอาจารย์จาก CSV", "Import Teachers from CSV")}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("นำเข้าอาจารย์", "Import Teachers")}</h2>
          <button onClick={handleClose} aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {!parseResult && !done && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[#2DD4BF] bg-[#2DD4BF]/5" : "border-[var(--border-subtle)] hover:border-[#2DD4BF]/50"}`}
            >
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("คอลัมน์: name, email, role (teacher/ta)", "Columns: name, email, role (teacher/ta)")}</p>
            </div>
          )}
          {parseResult && !done && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
                <span className="text-[var(--text-muted)]">—</span>
                <span className="text-green-600 font-medium">{t(`ใหม่ ${newRows.length}`, `New: ${newRows.length}`)}</span>
                {dupRows.length > 0 && <span className="text-amber-600">{t(`ซ้ำ ${dupRows.length}`, `Dup: ${dupRows.length}`)}</span>}
                {errorRows.length > 0 && <span className="text-red-600">{t(`ผิด ${errorRows.length}`, `Err: ${errorRows.length}`)}</span>}
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="overflow-x-auto max-h-72">
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
                      {parseResult.rows.map((row, idx) => {
                        const isDup = !row.error && existingEmails.has(row.email.toLowerCase());
                        return (
                          <tr key={idx} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-red-50/50" : isDup ? "bg-amber-50/50" : ""}`}>
                            <td className="px-3 py-2 text-[var(--text-primary)] max-w-[120px] truncate">{row.name || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                            <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[140px] truncate">{row.email || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.role === "ta" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                                {row.role === "ta" ? "TA" : t("อาจารย์", "Teacher")}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.error ? (
                                <span className="text-red-600">{teacherRowErrorLabel(row.error)}</span>
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
              <button onClick={() => { setParseResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors">
                {t("เลือกไฟล์ใหม่", "Choose different file")}
              </button>
            </div>
          )}
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
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] shrink-0 flex gap-2">
          <button onClick={handleClose}
            className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
            {done ? t("ปิด", "Close") : t("ยกเลิก", "Cancel")}
          </button>
          {parseResult && !done && (
            <button onClick={handleImport} disabled={newRows.length === 0 || importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`+ นำเข้า ${newRows.length} คน`, `+ Import ${newRows.length}`)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Add/Edit Drawer
// ═══════════════════════════════════════════════════════════════

function TeacherDrawer({ open, onClose, mode, teacher }: {
  open: boolean; onClose: () => void; mode: "create" | "edit"; teacher?: ManagedTeacher;
}) {
  const { t } = useLanguage();
  const { addTeacher, updateTeacher, teachers } = useManagedTeachers();
  const [name, setName] = useState(teacher?.name ?? "");
  const [email, setEmail] = useState(teacher?.email ?? "");
  const [role, setRole] = useState<"teacher" | "ta">(teacher?.role ?? "teacher");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const dialogRef = useRef<HTMLDivElement>(null);

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
      if (!normalized.endsWith("@kmitl.ac.th"))
        e.email = t("อีเมลต้องเป็น @kmitl.ac.th", "Email must be @kmitl.ac.th");
      else {
        const duplicate = teachers.some((tc) => tc.email === normalized && tc.id !== teacher?.id);
        if (duplicate) e.email = t("อีเมลนี้มีในระบบแล้ว", "This email already exists");
      }
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
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
  }

  if (!open) return null;
  const title = mode === "edit" ? t("แก้ไขข้อมูลอาจารย์", "Edit Teacher") : t("เพิ่มอาจารย์", "Add Teacher");

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={title}
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]">
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
            <input id="teacher-name" type="text" value={name}
              onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder={t("เช่น ดร.สมชาย ใจดี", "e.g. Dr. John Smith")}
              aria-describedby={errors.name ? "teacher-name-err" : undefined}
              aria-invalid={!!errors.name} aria-required="true" autoFocus
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]" />
            {errors.name && <p id="teacher-name-err" role="alert" className="text-xs text-red-500">{errors.name}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-email" className="text-sm font-medium text-[var(--text-primary)]">
              {t("อีเมล", "Email")} <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input id="teacher-email" type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
              placeholder="teacher@kmitl.ac.th"
              aria-describedby={errors.email ? "teacher-email-err" : undefined}
              aria-invalid={!!errors.email} aria-required="true"
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]" />
            {errors.email && <p id="teacher-email-err" role="alert" className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="teacher-role" className="text-sm font-medium text-[var(--text-primary)]">{t("ตำแหน่ง", "Role")}</label>
            <select id="teacher-role" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "ta")}
              className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]">
              <option value="teacher">{t("อาจารย์", "Teacher")}</option>
              <option value="ta">{t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)")}</option>
            </select>
          </div>
          <div className="mt-auto flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {loading ? t("กำลังบันทึก…", "Saving…") : mode === "edit" ? t("บันทึก", "Save Changes") : t("เพิ่มอาจารย์", "Add Teacher")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Confirm Suspend
// ═══════════════════════════════════════════════════════════════

function ConfirmSuspendTeacherDialog({ teacher, onConfirm, onCancel }: {
  teacher: ManagedTeacher; onConfirm: () => void; onCancel: () => void;
}) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onCancel} aria-hidden="true" />
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-teacher-dialog-title"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
        onKeyDown={handleFocusTrap}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div>
            <h3 id="delete-teacher-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการระงับ", "Confirm Suspend")}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t(`ระงับการใช้งาน "${teacher.name}"?`, `Suspend "${teacher.name}"?`)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t("สามารถเปิดใช้งานคืนได้ภายหลัง", "You can reactivate them later.")}
            </p>
            {teacher.courseIds.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                {t(`อาจารย์นี้ถูก assign ใน ${teacher.courseIds.length} รายวิชา`,
                   `This teacher is assigned to ${teacher.courseIds.length} course(s)`)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} autoFocus
            className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
            {t("ระงับ", "Suspend")}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — CSV parsing
// ═══════════════════════════════════════════════════════════════

type StudentRowError = { type: "missing_fields"; fields: string[] } | { type: "invalid_email" };

interface ParsedStudentRow {
  studentId: string; firstName: string; lastName: string;
  email: string; cohort: string; program: string;
  error?: StudentRowError;
}

interface StudentParseResult { rows: ParsedStudentRow[]; totalErrors: number; }

const REQUIRED_STUDENT_COLS = ["studentId", "firstName", "lastName", "email", "cohort", "program"] as const;

function parseStudentCsv(raw: string): StudentParseResult {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalErrors: 0 };
  const header = splitCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((h, idx) => [h, idx]));
  const rows = lines.slice(1).map((line): ParsedStudentRow => {
    const cells = splitCsvLine(line);
    const row: ParsedStudentRow = {
      studentId: cells[colIndex.studentId] ?? "",
      firstName: cells[colIndex.firstName] ?? "",
      lastName: cells[colIndex.lastName] ?? "",
      email: cells[colIndex.email] ?? "",
      cohort: cells[colIndex.cohort] ?? "",
      program: cells[colIndex.program] ?? "",
    };
    const missing = REQUIRED_STUDENT_COLS.filter((k) => !row[k]);
    if (missing.length > 0) row.error = { type: "missing_fields", fields: [...missing] };
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.error = { type: "invalid_email" };
    return row;
  });
  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — Import Drawer
// ═══════════════════════════════════════════════════════════════

function ImportStudentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addCohortStudents, findByStudentId } = useCohortStudents();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [parseResult, setParseResult] = useState<StudentParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = (ev) => { const text = ev.target?.result as string; setParseResult(parseStudentCsv(text)); };
    reader.readAsText(file, "utf-8");
  }

  const validRows = parseResult?.rows.filter((r) => !r.error && !findByStudentId(r.studentId)) ?? [];

  function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    addCohortStudents(validRows.map((r) => ({ studentId: r.studentId, firstName: r.firstName, lastName: r.lastName, email: r.email, cohort: r.cohort, program: r.program })));
    setImporting(false);
    setDone(true);
  }

  function handleClose() {
    setParseResult(null); setFileName(""); setDone(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
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
    const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]),[href],input:not([disabled]):not([tabindex="-1"]),select,textarea,[tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (e.shiftKey) { if (document.activeElement === first) { last.focus(); e.preventDefault(); } }
    else { if (document.activeElement === last) { first.focus(); e.preventDefault(); } }
  }

  function studentRowErrorLabel(err: StudentRowError) {
    if (err.type === "missing_fields") return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    return t("อีเมลไม่ถูกต้อง", "Invalid email");
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={handleClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("นำเข้านักศึกษาจาก CSV", "Import Students from CSV")}
        className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("นำเข้านักศึกษา", "Import Students")}</h2>
          <button onClick={handleClose} aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {!parseResult && !done && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[#2DD4BF] bg-[#2DD4BF]/5" : "border-[var(--border-subtle)] hover:border-[#2DD4BF]/50"}`}>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("คอลัมน์: studentId, firstName, lastName, email, cohort, program", "Columns: studentId, firstName, lastName, email, cohort, program")}</p>
            </div>
          )}
          {parseResult && !done && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
                <span className="text-green-600 font-medium">{t(`ใหม่ ${validRows.length}`, `New: ${validRows.length}`)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--bg-app)] sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("รหัส", "ID")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("ชื่อ", "First")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("นามสกุล", "Last")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("cohort", "Cohort")}</th>
                        <th className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("สถานะ", "Status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parseResult.rows.slice(0, 30).map((row, idx) => (
                        <tr key={idx} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-red-50" : ""}`}>
                          <td className="px-3 py-1.5 text-[var(--text-primary)] font-mono">{row.studentId || "—"}</td>
                          <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.firstName || "—"}</td>
                          <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.lastName || "—"}</td>
                          <td className="px-3 py-1.5 text-[var(--text-muted)]">{row.cohort || "—"}</td>
                          <td className="px-3 py-1.5">
                            {row.error ? (
                              <span className="text-red-600 font-medium">{studentRowErrorLabel(row.error)}</span>
                            ) : (
                              <span className="text-green-600">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseResult.rows.length > 30 && (
                    <p className="px-3 py-2 text-xs text-[var(--text-muted)] bg-[var(--bg-app)] border-t border-[var(--border-subtle)]">
                      {t(`แสดง 30/${parseResult.rows.length} แถว`, `Showing 30 of ${parseResult.rows.length} rows`)}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => { setParseResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors">
                {t("เลือกไฟล์ใหม่", "Choose different file")}
              </button>
            </div>
          )}
          {done && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("นำเข้าสำเร็จ", "Import complete")}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {t(`เพิ่ม ${validRows.length} คน`, `Added ${validRows.length} student(s)`)}
              </p>
            </div>
          )}
        </div>
        {!done && parseResult && validRows.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] shrink-0 flex gap-2">
            <button onClick={handleClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button onClick={handleImport} disabled={importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`นำเข้า ${validRows.length} คน`, `Import ${validRows.length} student(s)`)}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — TA expand row
// ═══════════════════════════════════════════════════════════════

function StudentTaExpandRow({ student, colSpan }: { student: CohortStudent; colSpan: number }) {
  const { t } = useLanguage();
  const { updateTaAssignments } = useCohortStudents();
  const { courses } = useCourses();
  const activeCourses = courses.filter((c) => c.status === "active");
  const isTa = (student.taAssignments?.length ?? 0) > 0;
  const assigned = new Set(student.taAssignments ?? []);

  function toggleTa() {
    updateTaAssignments(student.id, isTa ? [] : activeCourses.length > 0 ? [activeCourses[0].id] : []);
  }

  function toggleCourse(courseId: string) {
    const next = new Set(assigned);
    if (next.has(courseId)) next.delete(courseId); else next.add(courseId);
    updateTaAssignments(student.id, [...next]);
  }

  return (
    <tr className="bg-indigo-50/40 dark:[data-theme=dark]:bg-indigo-900/10">
      <td colSpan={colSpan} className="px-6 py-4">
        <div className="flex flex-col gap-3">
          {/* TA toggle */}
          <label className="flex items-center gap-3 cursor-pointer w-fit">
            <button
              type="button"
              role="switch"
              aria-checked={isTa}
              onClick={toggleTa}
              className={`relative w-10 h-6 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] ${isTa ? "bg-[#2DD4BF]" : "bg-[var(--border-subtle)]"}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isTa ? "left-5" : "left-1"}`} />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {t("เป็น TA", "Is TA")}
            </span>
            {isTa && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">TA</span>
            )}
          </label>

          {/* Course checkboxes — only when TA is on */}
          {isTa && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
                {t("วิชาที่เป็น TA", "TA for courses")}
              </p>
              {activeCourses.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีรายวิชาในระบบ", "No active courses")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeCourses.map((course) => {
                    const checked = assigned.has(course.id);
                    return (
                      <label key={course.id} className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCourse(course.id)}
                          className="w-4 h-4 rounded accent-[#2DD4BF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
                        />
                        <span className="text-sm text-[var(--text-primary)]">{course.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS TAB
// ═══════════════════════════════════════════════════════════════

function TeachersTab() {
  const { t } = useLanguage();
  const { teachers, suspendTeacher, reactivateTeacher } = useManagedTeachers();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<ManagedTeacher | undefined>(undefined);
  const [search, setSearch] = useState("");

  const filteredTeachers = teachers.filter((tp) => {
    const q = search.toLowerCase();
    return !q || tp.name.toLowerCase().includes(q) || tp.email.toLowerCase().includes(q);
  });

  const suspendingTeacher = teachers.find((tp) => tp.id === suspendingId);

  const ROLE_LABELS: Record<"teacher" | "ta", string> = {
    teacher: t("อาจารย์", "Teacher"),
    ta: t("ผู้ช่วยสอน", "TA"),
  };

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder={t("ค้นหาอาจารย์...", "Search teachers...")} />
        </div>
        <button onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          {t("นำเข้า CSV", "Import CSV")}
        </button>
        <button onClick={() => { setEditingTeacher(undefined); setDrawerOpen(true); }}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t("เพิ่มอาจารย์", "Add Teacher")}
        </button>
      </div>

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
            <button onClick={() => { setEditingTeacher(undefined); setDrawerOpen(true); }}
              className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
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
              {filteredTeachers.map((teacher, i) => (
                <tr key={teacher.id}
                  className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] transition-colors ${i % 2 === 1 ? "bg-[var(--bg-app)]" : ""}${teacher.status === "suspended" ? " opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#2DD4BF]/20 flex items-center justify-center text-[#0F766E] text-xs font-bold shrink-0 select-none" aria-hidden="true">
                        {getInitials(teacher.name)}
                      </div>
                      {teacher.name}
                      {teacher.status === "suspended" && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                          {t("ระงับ", "Suspended")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{teacher.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${teacher.role === "teacher" ? "bg-[#2DD4BF]/10 text-[#0F766E]" : "bg-[#A78BFA]/10 text-[#7C3AED]"}`}>
                      {ROLE_LABELS[teacher.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)] tabular-nums">{teacher.courseIds.length}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingTeacher(teacher); setDrawerOpen(true); }}
                        aria-label={t(`แก้ไข ${teacher.name}`, `Edit ${teacher.name}`)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[#0F766E] hover:bg-[#2DD4BF]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {teacher.status === "suspended" ? (
                        <button onClick={() => reactivateTeacher(teacher.id)}
                          aria-label={t(`เปิดใช้งาน ${teacher.name}`, `Reactivate ${teacher.name}`)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-green-600 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </button>
                      ) : (
                        <button onClick={() => setSuspendingId(teacher.id)}
                          aria-label={t(`ระงับ ${teacher.name}`, `Suspend ${teacher.name}`)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-amber-600 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeacherDrawer open={drawerOpen} mode={editingTeacher ? "edit" : "create"} teacher={editingTeacher}
        onClose={() => { setDrawerOpen(false); setEditingTeacher(undefined); }} />
      <ImportTeacherDrawer open={importOpen} onClose={() => setImportOpen(false)} />
      {suspendingTeacher && (
        <ConfirmSuspendTeacherDialog
          teacher={suspendingTeacher}
          onConfirm={() => { suspendTeacher(suspendingId!); setSuspendingId(null); }}
          onCancel={() => setSuspendingId(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — Add Single Drawer
// ═══════════════════════════════════════════════════════════════

function AddStudentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addCohortStudents, findByStudentId } = useCohortStudents();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [studentId, setStudentId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cohort, setCohort] = useState("");
  const [program, setProgram] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStudentId(""); setFirstName(""); setLastName("");
      setEmail(""); setCohort(""); setProgram(""); setErrors({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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

  function validate() {
    const e: Record<string, string> = {};
    if (!studentId.trim()) e.studentId = t("กรุณากรอกรหัสนักศึกษา", "Student ID is required");
    else if (findByStudentId(studentId.trim())) e.studentId = t("รหัสนี้มีในระบบแล้ว", "Student ID already exists");
    if (!firstName.trim()) e.firstName = t("กรุณากรอกชื่อ", "First name is required");
    if (!lastName.trim()) e.lastName = t("กรุณากรอกนามสกุล", "Last name is required");
    if (!email.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    if (!cohort.trim()) e.cohort = t("กรุณากรอก cohort", "Cohort is required");
    if (!program.trim()) e.program = t("กรุณากรอกสาขา", "Program is required");
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    addCohortStudents([{
      studentId: studentId.trim(), firstName: firstName.trim(), lastName: lastName.trim(),
      email: email.trim().toLowerCase(), cohort: cohort.trim(), program: program.trim(),
    }]);
    setLoading(false);
    onClose();
  }

  if (!open) return null;

  const fieldClass = "h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]";
  const labelClass = "text-sm font-medium text-[var(--text-primary)]";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("เพิ่มนักศึกษา", "Add Student")}
        className="fixed right-0 top-0 h-full w-full max-w-sm bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("เพิ่มนักศึกษา", "Add Student")}</h2>
          <button onClick={onClose} aria-label={t("ปิด", "Close")}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 gap-4 px-5 py-5 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sid" className={labelClass}>{t("รหัสนักศึกษา", "Student ID")} <span aria-hidden="true" className="text-red-500">*</span></label>
            <input id="sid" type="text" value={studentId} autoFocus
              onChange={(e) => { setStudentId(e.target.value); setErrors((p) => ({ ...p, studentId: "" })); }}
              placeholder="64070501" aria-invalid={!!errors.studentId} className={fieldClass} />
            {errors.studentId && <p role="alert" className="text-xs text-red-500">{errors.studentId}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sfn" className={labelClass}>{t("ชื่อ", "First Name")} <span aria-hidden="true" className="text-red-500">*</span></label>
              <input id="sfn" type="text" value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: "" })); }}
                placeholder={t("สมชาย", "John")} aria-invalid={!!errors.firstName} className={fieldClass} />
              {errors.firstName && <p role="alert" className="text-xs text-red-500">{errors.firstName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sln" className={labelClass}>{t("นามสกุล", "Last Name")} <span aria-hidden="true" className="text-red-500">*</span></label>
              <input id="sln" type="text" value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: "" })); }}
                placeholder={t("ใจดี", "Smith")} aria-invalid={!!errors.lastName} className={fieldClass} />
              {errors.lastName && <p role="alert" className="text-xs text-red-500">{errors.lastName}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="semail" className={labelClass}>{t("อีเมล", "Email")} <span aria-hidden="true" className="text-red-500">*</span></label>
            <input id="semail" type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
              placeholder="64070501@kmitl.ac.th" aria-invalid={!!errors.email} className={fieldClass} />
            {errors.email && <p role="alert" className="text-xs text-red-500">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scohort" className={labelClass}>{t("cohort", "Cohort")} <span aria-hidden="true" className="text-red-500">*</span></label>
              <input id="scohort" type="text" value={cohort}
                onChange={(e) => { setCohort(e.target.value); setErrors((p) => ({ ...p, cohort: "" })); }}
                placeholder="CE69" aria-invalid={!!errors.cohort} className={fieldClass} />
              {errors.cohort && <p role="alert" className="text-xs text-red-500">{errors.cohort}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sprogram" className={labelClass}>{t("สาขา", "Program")} <span aria-hidden="true" className="text-red-500">*</span></label>
              <input id="sprogram" type="text" value={program}
                onChange={(e) => { setProgram(e.target.value); setErrors((p) => ({ ...p, program: "" })); }}
                placeholder="CE" aria-invalid={!!errors.program} className={fieldClass} />
              {errors.program && <p role="alert" className="text-xs text-red-500">{errors.program}</p>}
            </div>
          </div>
          <div className="mt-auto flex gap-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {loading ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มนักศึกษา", "Add Student")}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════════════════════

function StudentsTab() {
  const { t } = useLanguage();
  const { cohortStudents, removeCohortStudent } = useCohortStudents();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const cohorts = [...new Set(cohortStudents.map((s) => s.cohort))].sort();

  const filtered = cohortStudents.filter((s) => {
    const matchCohort = cohortFilter === "all" || s.cohort === cohortFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.studentId.includes(q) || s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    return matchCohort && matchSearch;
  });

  const deletingStudent = cohortStudents.find((s) => s.id === deletingId);

  useEffect(() => {
    if (!deletingId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDeletingId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deletingId]);

  const COHORT_LABEL = t("cohort ทั้งหมด", "All cohorts");
  const COL_COUNT = 6;

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder={t("ค้นหานักศึกษา...", "Search students...")} />
        </div>
        {cohorts.length > 0 && (
          <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF] transition-colors shrink-0">
            <option value="all">{COHORT_LABEL}</option>
            {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          {t("นำเข้า CSV", "Import CSV")}
        </button>
        <button onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t("เพิ่มนักศึกษา", "Add Student")}
        </button>
      </div>

      {cohortStudents.length === 0 ? (
        <EmptyState
          iconColor="#2DD4BF"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
          }
          title={t("ยังไม่มีนักศึกษาในระบบ", "No students yet")}
          description={t("นำเข้าจากไฟล์ CSV เพื่อเพิ่มนักศึกษาทั้งรุ่น", "Import a CSV file to add cohort students")}
          action={
            <button onClick={() => setImportOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
              {t("นำเข้า CSV", "Import CSV")}
            </button>
          }
        />
      ) : (
        <>
          {filtered.length !== cohortStudents.length && (
            <p className="text-sm text-[var(--text-muted)] mb-3">
              {t(`แสดง ${filtered.length}/${cohortStudents.length}`, `Showing ${filtered.length}/${cohortStudents.length}`)}
            </p>
          )}

          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รหัส", "Student ID")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ชื่อ-นามสกุล", "Name")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("cohort / สาขา", "Cohort / Program")}</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สถานะ", "Status")}</th>
                  <th scope="col" className="px-4 py-3 w-12"><span className="sr-only">{t("ลบ", "Delete")}</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      {t("ไม่พบผลการค้นหา", "No results found")}
                    </td>
                  </tr>
                ) : (
                  filtered.map((student, i) => {
                    const isExpanded = expandedId === student.id;
                    const isTa = (student.taAssignments?.length ?? 0) > 0;
                    return (
                      <React.Fragment key={student.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : student.id)}
                          className={`border-b border-[var(--border-subtle)] cursor-pointer transition-colors ${isExpanded ? "bg-indigo-50/60" : i % 2 === 1 ? "bg-[var(--bg-app)] hover:bg-[var(--bg-subtle)]" : "hover:bg-[var(--bg-subtle)]"}`}
                          aria-expanded={isExpanded}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-[var(--text-primary)]">{student.studentId}</td>
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{student.firstName} {student.lastName}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{student.email}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{student.cohort}</span>
                              <span className="text-xs text-[var(--text-muted)]">{student.program}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isTa ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                TA
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setDeletingId(student.id)}
                              aria-label={t(`ลบ ${student.firstName} ${student.lastName}`, `Delete ${student.firstName} ${student.lastName}`)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <StudentTaExpandRow student={student} colSpan={COL_COUNT} />
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ImportStudentDrawer open={importOpen} onClose={() => setImportOpen(false)} />
      <AddStudentDrawer open={addOpen} onClose={() => setAddOpen(false)} />

      {deletingStudent && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setDeletingId(null)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" aria-labelledby="del-student-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4">
            <div>
              <h3 id="del-student-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการลบ", "Confirm Delete")}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(
                  `ลบ "${deletingStudent.firstName} ${deletingStudent.lastName}" (${deletingStudent.studentId}) ออกจาก cohort?`,
                  `Remove "${deletingStudent.firstName} ${deletingStudent.lastName}" (${deletingStudent.studentId}) from cohort?`
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeletingId(null)}
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors">
                {t("ยกเลิก", "Cancel")}
              </button>
              <button onClick={() => { removeCohortStudent(deletingId!); setDeletingId(null); }}
                className="flex-1 h-9 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors">
                {t("ลบ", "Delete")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

type Tab = "teachers" | "students";

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("teachers");
  const { teachers } = useManagedTeachers();
  const { cohortStudents } = useCohortStudents();

  const taCount = cohortStudents.filter((s) => (s.taAssignments?.length ?? 0) > 0).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: "teachers", label: t("อาจารย์", "Teachers") },
    { key: "students", label: t("นักศึกษา", "Students") },
  ];

  return (
    <div className="p-6 w-full">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {t("จัดการผู้ใช้", "User Management")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t("ดูแลอาจารย์ นักศึกษา และ TA ในระบบ", "Manage teachers, students, and TAs in the system")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 mb-6">
        <StatCard
          label={t("อาจารย์", "Teachers")}
          value={teachers.length}
          color="#0F766E"
          bg="rgba(15,118,110,0.1)"
          onClick={() => setTab("teachers")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
        />
        <StatCard
          label={t("นักศึกษา", "Students")}
          value={cohortStudents.length}
          color="#4F46E5"
          bg="rgba(79,70,229,0.1)"
          onClick={() => setTab("students")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          }
        />
        <StatCard
          label="TA"
          value={taCount}
          color="#7C3AED"
          bg="rgba(124,58,237,0.1)"
          onClick={() => setTab("students")}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4"/>
              <path d="M6 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75" strokeDasharray="2 2"/>
            </svg>
          }
        />
      </div>

      {/* Pill tabs */}
      <div className="mb-6">
        <PillTabBar
          tabs={TABS.map(({ key, label }) => ({
            key,
            label,
            count: key === "teachers" ? teachers.length : cohortStudents.length,
          }))}
          activeKey={tab}
          onChange={(k) => setTab(k as Tab)}
          ariaLabel={t("ประเภทผู้ใช้", "User type")}
        />
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {tab === "teachers" ? <TeachersTab /> : <StudentsTab />}
      </div>
    </div>
  );
}
