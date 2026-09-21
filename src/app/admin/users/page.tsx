"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useManagedTeachers, ManagedTeacher, splitTeacherTitle } from "@/lib/managed-teachers";
import { useCohortStudents, CohortStudent, cohortYearLabel } from "@/lib/cohort-students";
import { getInitials } from "@/lib/utils";
import { splitCsvLine } from "@/lib/csv";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import SearchInput from "@/components/SearchInput";
import SortableTh from "@/components/SortableTh";
import FilterSelect from "@/components/FilterSelect";
import StatCard from "@/components/StatCard";
import PillTabBar from "@/components/PillTabBar";
import Pagination from "@/components/Pagination";

// ═══════════════════════════════════════════════════════════════
// TEACHERS — CSV parsing
// ═══════════════════════════════════════════════════════════════

type TeacherRowError = { type: "missing_fields"; fields: string[] } | { type: "invalid_email" } | { type: "invalid_domain" } | { type: "invalid_role" };

interface ParsedTeacherRow {
  title?: string;
  name: string;
  email: string;
  role: "teacher" | "ta";
  error?: TeacherRowError;
}

interface TeacherParseResult {
  rows: ParsedTeacherRow[];
  totalErrors: number;
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
    const rawName = get("name") || get("ชื่อ");
    const explicitTitle = get("title") || get("ยศ");
    // No dedicated title column? Fall back to splitting a legacy
    // title-prefixed name ("ผศ.สมศักดิ์ ...") so old-format CSVs still work.
    const { title, name } = explicitTitle ? { title: explicitTitle, name: rawName } : splitTeacherTitle(rawName);
    const email = get("email") || get("อีเมล");
    const rawRole = (get("role") || get("ตำแหน่ง") || "teacher").toLowerCase().trim();
    const role: "teacher" | "ta" = rawRole === "ta" ? "ta" : "teacher";
    if (!name) return { title, name, email, role, error: { type: "missing_fields", fields: ["name"] } };
    if (!email) return { title, name, email, role, error: { type: "missing_fields", fields: ["email"] } };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { title, name, email, role, error: { type: "invalid_email" } };
    if (!email.toLowerCase().endsWith("@kmitl.ac.th")) return { title, name, email, role, error: { type: "invalid_domain" } };
    return { title, name, email, role };
  });
  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Import (centred popup)
// ═══════════════════════════════════════════════════════════════

function ImportTeacherModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { importTeachers, teachers } = useManagedTeachers();
  const fileRef = useRef<HTMLInputElement>(null);
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
    importTeachers(newRows.map((row) => ({ title: row.title, name: row.name, email: row.email.toLowerCase(), role: row.role })));
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

  function teacherRowErrorLabel(err: TeacherRowError) {
    if (err.type === "missing_fields") return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    if (err.type === "invalid_email") return t("อีเมลไม่ถูกต้อง", "Invalid email");
    if (err.type === "invalid_domain") return t("ต้องเป็น @kmitl.ac.th", "Must be @kmitl.ac.th");
    return t("role ไม่ถูกต้อง", "Invalid role");
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} size="lg" title={t("นำเข้าอาจารย์", "Import Teachers")}
      footer={
        <>
          <button onClick={handleClose}
            className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {done ? t("ปิด", "Close") : t("ยกเลิก", "Cancel")}
          </button>
          {parseResult && !done && (
            <button onClick={handleImport} disabled={newRows.length === 0 || importing}
              className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`+ นำเข้า ${newRows.length} คน`, `+ Import ${newRows.length}`)}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!parseResult && !done && (
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
            <p className="text-xs text-[var(--text-muted)] mt-1">{t("คอลัมน์: name, email, role (teacher/ta)", "Columns: name, email, role (teacher/ta)")}</p>
          </div>
        )}
        {!parseResult && !done && (
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
                <p className="text-[11px] text-[var(--text-muted)] truncate">teachers-template.csv</p>
              </div>
            </div>
            <a href="/teachers-template.csv" download
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-bright)]/40 text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors">
              {t("ดาวน์โหลด", "Download")}
            </a>
          </div>
        )}
        {parseResult && !done && (
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
                  <thead className="bg-[var(--bg-subtle)] sticky top-0">
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
                        <tr key={idx} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-[var(--s-err-bg)]" : isDup ? "bg-[var(--s-warn-bg)]" : ""}`}>
                          <td className="px-3 py-2 text-[var(--text-primary)] max-w-[120px] truncate">{row.name || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                          <td className="px-3 py-2 text-[var(--text-secondary)] max-w-[140px] truncate">{row.email || <span className="text-[var(--text-muted)] italic">—</span>}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.role === "ta" ? "bg-[var(--role-ta-bg)] text-[var(--role-ta-text)]" : "bg-[var(--accent-subtle)] text-[var(--accent)]"}`}>
                              {row.role === "ta" ? "TA" : t("อาจารย์", "Teacher")}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.error ? (
                              <span className="text-[var(--s-err-text)]">{teacherRowErrorLabel(row.error)}</span>
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
            <button onClick={() => { setParseResult(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }}
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
              {t(`เพิ่ม ${newRows.length} คน (ข้าม ${dupRows.length + errorRows.length} รายการ)`,
                 `Added ${newRows.length} teacher(s) (skipped ${dupRows.length + errorRows.length})`)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Add (centred popup)
// ═══════════════════════════════════════════════════════════════

function TeacherModal({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addTeacher, teachers } = useManagedTeachers();
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"teacher" | "ta">("teacher");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    if (open) {
      setTitle(""); setName(""); setEmail(""); setRole("teacher"); setErrors({});
    }
  }, [open]);

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
        const duplicate = teachers.some((tc) => tc.email === normalized);
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
    addTeacher({ title: title.trim() || undefined, name: name.trim(), email: email.trim().toLowerCase(), role });
    setLoading(false);
    onClose();
  }

  if (!open) return null;
  const modalTitle = t("เพิ่มอาจารย์", "Add Teacher");

  return (
    <Modal open={open} onClose={onClose} size="md" title={modalTitle}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teacher-title" className="text-sm font-medium text-[var(--text-primary)]">{t("ยศ/ตำแหน่งทางวิชาการ", "Academic Title")}</label>
          <input id="teacher-title" type="text" value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("เช่น ผศ.ดร., รศ., ดร. (เว้นว่างได้)", "e.g. Prof., Dr. (optional)")}
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teacher-name" className="text-sm font-medium text-[var(--text-primary)]">
            {t("ชื่อ-นามสกุล", "Full Name")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span>
          </label>
          <input id="teacher-name" type="text" value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            placeholder={t("เช่น สมชาย ใจดี", "e.g. John Smith")}
            aria-describedby={errors.name ? "teacher-name-err" : undefined}
            aria-invalid={!!errors.name} aria-required="true" autoFocus
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]" />
          {errors.name && <p id="teacher-name-err" role="alert" className="text-xs text-[var(--s-err-text)]">{errors.name}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teacher-email" className="text-sm font-medium text-[var(--text-primary)]">
            {t("อีเมล", "Email")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span>
          </label>
          <input id="teacher-email" type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
            placeholder="teacher@kmitl.ac.th"
            aria-describedby={errors.email ? "teacher-email-err" : undefined}
            aria-invalid={!!errors.email} aria-required="true"
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]" />
          {errors.email && <p id="teacher-email-err" role="alert" className="text-xs text-[var(--s-err-text)]">{errors.email}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="teacher-role" className="text-sm font-medium text-[var(--text-primary)]">{t("ตำแหน่ง", "Role")}</label>
          <select id="teacher-role" value={role} onChange={(e) => setRole(e.target.value as "teacher" | "ta")}
            className="h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]">
            <option value="teacher">{t("อาจารย์", "Teacher")}</option>
            <option value="ta">{t("ผู้ช่วยสอน (TA)", "Teaching Assistant (TA)")}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button type="submit" disabled={loading}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {loading ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มอาจารย์", "Add Teacher")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS — Confirm Deactivate
// ═══════════════════════════════════════════════════════════════

function ConfirmDeactivateTeacherDialog({ teacher, onConfirm, onCancel }: {
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
            <h3 id="delete-teacher-dialog-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการปิดใช้งาน", "Confirm Deactivate")}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t(`ปิดใช้งาน "${teacher.name}"?`, `Deactivate "${teacher.name}"?`)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t("สามารถเปิดใช้งานคืนได้ภายหลัง", "You can activate them again later.")}
            </p>
            {teacher.courseIds.length > 0 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {t(`อาจารย์นี้ถูก assign ใน ${teacher.courseIds.length} รายวิชา`,
                   `This teacher is assigned to ${teacher.courseIds.length} course(s)`)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} autoFocus
            className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-9 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
            {t("ปิดใช้งาน", "Deactivate")}
          </button>
        </div>
      </div>
    </>
  );
}

function ConfirmDeleteTeacherDialog({ teacher, onConfirm, onCancel }: {
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
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby="delete-teacher-dialog-title2"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
        onKeyDown={handleFocusTrap}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--s-err-bg)] flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--s-err-text)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </div>
          <div>
            <h3 id="delete-teacher-dialog-title2" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการลบ", "Confirm Delete")}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t(`ลบ "${teacher.name}" ออกจากระบบถาวร?`, `Permanently delete "${teacher.name}"?`)}
            </p>
            {teacher.courseIds.length > 0 && (
              <p className="text-xs text-[var(--s-err-text)] mt-0.5">
                {t(`อาจารย์นี้ถูก assign ใน ${teacher.courseIds.length} รายวิชา — จะถูกถอดออกด้วย`,
                   `This teacher is assigned to ${teacher.courseIds.length} course(s) — they'll be unassigned too`)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} autoFocus
            className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button onClick={onConfirm}
            className="flex-1 h-9 rounded-xl border border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)] text-sm font-semibold hover:bg-[var(--s-err-bg)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors">
            {t("ลบ", "Delete")}
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — CSV parsing
// ═══════════════════════════════════════════════════════════════

type StudentRowError =
  | { type: "missing_fields"; fields: string[] }
  | { type: "invalid_email" }
  | { type: "invalid_student_id" }
  | { type: "email_mismatch" };

// Confirmed format (reviewer feedback item 1.4, closed 9/9/2569): student
// email is always the 8-digit student ID followed by @kmitl.ac.th — not a
// free-choice address like teachers get. Kept as two separate fields (not
// auto-derived) since edit mode may be touching a legacy record.
const STUDENT_ID_RE = /^\d{8}$/;
function expectedStudentEmail(studentId: string) {
  return `${studentId}@kmitl.ac.th`;
}

interface ParsedStudentRow {
  studentId: string; title: string; firstName: string; lastName: string;
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
      title: colIndex.title !== undefined ? cells[colIndex.title] ?? "" : "",
      firstName: cells[colIndex.firstName] ?? "",
      lastName: cells[colIndex.lastName] ?? "",
      email: cells[colIndex.email] ?? "",
      cohort: cells[colIndex.cohort] ?? "",
      program: cells[colIndex.program] ?? "",
    };
    const missing = REQUIRED_STUDENT_COLS.filter((k) => !row[k]);
    if (missing.length > 0) row.error = { type: "missing_fields", fields: [...missing] };
    else if (!STUDENT_ID_RE.test(row.studentId)) row.error = { type: "invalid_student_id" };
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.error = { type: "invalid_email" };
    else if (row.email.toLowerCase() !== expectedStudentEmail(row.studentId)) row.error = { type: "email_mismatch" };
    return row;
  });
  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — Import (centred popup)
// ═══════════════════════════════════════════════════════════════

function ImportStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addCohortStudents, findByStudentId } = useCohortStudents();
  const fileRef = useRef<HTMLInputElement>(null);
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
    addCohortStudents(validRows.map((r) => ({ studentId: r.studentId, title: r.title || undefined, firstName: r.firstName, lastName: r.lastName, email: r.email, cohort: r.cohort, program: r.program })));
    setImporting(false);
    setDone(true);
  }

  function handleClose() {
    setParseResult(null); setFileName(""); setDone(false);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  function studentRowErrorLabel(err: StudentRowError) {
    if (err.type === "missing_fields") return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    if (err.type === "invalid_student_id") return t("รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก", "Student ID must be 8 digits");
    if (err.type === "email_mismatch") return t("อีเมลต้องเป็น รหัสนักศึกษา@kmitl.ac.th", "Email must be studentID@kmitl.ac.th");
    return t("อีเมลไม่ถูกต้อง", "Invalid email");
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} size="lg" title={t("นำเข้านักศึกษา", "Import Students")}
      footer={
        !done && parseResult && validRows.length > 0 ? (
          <>
            <button onClick={handleClose}
              className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {t("ยกเลิก", "Cancel")}
            </button>
            <button onClick={handleImport} disabled={importing}
              className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {importing ? t("กำลังนำเข้า…", "Importing…") : t(`นำเข้า ${validRows.length} คน`, `Import ${validRows.length} student(s)`)}
            </button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {!parseResult && !done && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/5" : "border-[var(--border-subtle)] hover:border-[var(--accent-bright)]/50"}`}>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{t("คอลัมน์: studentId, title, firstName, lastName, email, cohort, program (title ไม่บังคับ)", "Columns: studentId, title, firstName, lastName, email, cohort, program (title is optional)")}</p>
          </div>
        )}
        {!parseResult && !done && (
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
                <p className="text-[11px] text-[var(--text-muted)] truncate">cohort-students-template.csv</p>
              </div>
            </div>
            <a href="/cohort-students-template.csv" download
              className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-bright)]/40 text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors">
              {t("ดาวน์โหลด", "Download")}
            </a>
          </div>
        )}
        {parseResult && !done && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
              <span className="text-[var(--s-ok-text)] font-medium">{t(`ใหม่ ${validRows.length}`, `New: ${validRows.length}`)}</span>
            </div>
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-[var(--bg-subtle)] sticky top-0">
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
                      <tr key={idx} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-[var(--s-err-bg)]" : ""}`}>
                        <td className="px-3 py-1.5 text-[var(--text-primary)] tabular-nums">{row.studentId || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.firstName || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.lastName || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-muted)]">{row.cohort || "—"}</td>
                        <td className="px-3 py-1.5">
                          {row.error ? (
                            <span className="text-[var(--s-err-text)] font-medium">{studentRowErrorLabel(row.error)}</span>
                          ) : (
                            <span className="text-[var(--s-ok-text)]">✓</span>
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
            <div className="w-12 h-12 rounded-full bg-[var(--s-ok-bg)] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--s-ok-text)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
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
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// TEACHERS TAB
// ═══════════════════════════════════════════════════════════════

function TeachersTab() {
  const { t } = useLanguage();
  const { teachers, updateTeacher, deactivateTeacher, activateTeacher, removeTeacher } = useManagedTeachers();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Inline row edit (row's own Title/Name/Email/Role cells become inputs)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftRole, setDraftRole] = useState<"teacher" | "ta">("teacher");
  const [draftErrors, setDraftErrors] = useState<{ name?: string; email?: string }>({});

  function startEdit(teacher: ManagedTeacher) {
    setEditingRowId(teacher.id);
    setDraftTitle(teacher.title ?? "");
    setDraftName(teacher.name);
    setDraftEmail(teacher.email);
    setDraftRole(teacher.role);
    setDraftErrors({});
  }

  function cancelEdit() {
    setEditingRowId(null);
    setDraftErrors({});
  }

  function validateEdit() {
    const e: typeof draftErrors = {};
    if (!draftName.trim()) e.name = t("กรุณากรอกชื่อ", "Name is required");
    if (!draftEmail.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail.trim()))
      e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    else {
      const normalized = draftEmail.trim().toLowerCase();
      if (!normalized.endsWith("@kmitl.ac.th"))
        e.email = t("อีเมลต้องเป็น @kmitl.ac.th", "Email must be @kmitl.ac.th");
      else {
        const duplicate = teachers.some((tc) => tc.email === normalized && tc.id !== editingRowId);
        if (duplicate) e.email = t("อีเมลนี้มีในระบบแล้ว", "This email already exists");
      }
    }
    return e;
  }

  function saveEdit() {
    const errs = validateEdit();
    if (Object.keys(errs).length > 0) { setDraftErrors(errs); return; }
    updateTeacher(editingRowId!, { title: draftTitle.trim() || undefined, name: draftName.trim(), email: draftEmail.trim().toLowerCase(), role: draftRole });
    setEditingRowId(null);
  }

  const filteredTeachers = teachers.filter((tp) => {
    const q = search.toLowerCase();
    return !q || tp.name.toLowerCase().includes(q) || tp.email.toLowerCase().includes(q);
  });
  useEffect(() => { setPage(1); }, [search]);
  const totalPages = Math.ceil(filteredTeachers.length / PAGE_SIZE);
  const pagedTeachers = filteredTeachers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deactivatingTeacher = teachers.find((tp) => tp.id === deactivatingId);
  const deletingTeacher = teachers.find((tp) => tp.id === deletingId);

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("ค้นหาอาจารย์...", "Search teachers...")}
            className="w-48 shrink-0"
            rounded="full"
            suggestions={teachers.map((tc) => tc.name)}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--accent-bright)] hover:text-[var(--text-primary)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {t("นำเข้า CSV", "Import CSV")}
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("เพิ่มอาจารย์", "Add Teacher")}
          </button>
        </div>
      </div>

      {teachers.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          }
          title={t("ยังไม่มีอาจารย์ในระบบ", "No teachers yet")}
          description={t("เพิ่มอาจารย์คนแรกเพื่อเริ่มต้น", "Add the first teacher to get started")}
          action={
            <button onClick={() => setAddOpen(true)}
              className="h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {t("เพิ่มอาจารย์", "Add Teacher")}
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <table className="w-full text-sm table-fixed" role="table">
            <colgroup>
              <col className="w-[76px]" />
              <col className="w-[32%]" />
              <col className="w-[36%]" />
              <col className="w-[120px]" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th scope="col" className="px-3 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ยศ", "Title")}</th>
                <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ชื่อ", "Name")}</th>
                <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สถานะ", "Status")}</th>
                <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("การจัดการ", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pagedTeachers.map((teacher) => {
                const teacherInactive = teacher.status === "inactive";
                const isEditing = editingRowId === teacher.id;
                const inputClass = "h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]";
                return (
                <tr key={teacher.id}
                  className="border-b border-[var(--border-subtle)] last:border-0 transition-colors hover:bg-[var(--bg-subtle)]">
                  <td className="px-3 py-1 text-[var(--text-secondary)]">
                    {isEditing ? (
                      <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                        aria-label={t("ยศ", "Title")} placeholder={t("ไม่มี", "None")} className={inputClass} />
                    ) : (
                      <span className="truncate">{teacher.title || "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-1 font-medium text-[var(--text-primary)]">
                    {isEditing ? (
                      <div>
                        <input value={draftName} onChange={(e) => { setDraftName(e.target.value); setDraftErrors((p) => ({ ...p, name: undefined })); }}
                          aria-label={t("ชื่อ", "Name")} aria-invalid={!!draftErrors.name} autoFocus className={inputClass} />
                        {draftErrors.name && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.name}</p>}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent-bright)]/20 flex items-center justify-center text-[var(--accent)] text-[10px] font-bold shrink-0 select-none" aria-hidden="true">
                          {getInitials(teacher.name)}
                        </div>
                        <span className="truncate">{teacher.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-1 text-[var(--text-secondary)] truncate">
                    {isEditing ? (
                      <div>
                        <input value={draftEmail} onChange={(e) => { setDraftEmail(e.target.value); setDraftErrors((p) => ({ ...p, email: undefined })); }}
                          aria-label={t("อีเมล", "Email")} aria-invalid={!!draftErrors.email} className={inputClass} />
                        {draftErrors.email && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.email}</p>}
                      </div>
                    ) : teacher.email}
                  </td>
                  <td className="px-4 py-1">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${teacherInactive ? "bg-[var(--bg-subtle)] text-[var(--text-muted)]" : "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${teacherInactive ? "bg-[var(--text-muted)]" : "bg-[var(--s-ok-text)]"}`} />
                      {teacherInactive ? t("ปิดใช้งาน", "Inactive") : t("ใช้งานอยู่", "Active")}
                    </span>
                  </td>
                  <td className="px-4 py-1">
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit}
                            aria-label={t("บันทึก", "Save")}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                          <button onClick={cancelEdit}
                            aria-label={t("ยกเลิก", "Cancel")}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(teacher)}
                            aria-label={t(`แก้ไข ${teacher.name}`, `Edit ${teacher.name}`)}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button onClick={() => setDeletingId(teacher.id)}
                            aria-label={t(`ลบ ${teacher.name}`, `Delete ${teacher.name}`)}
                            className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                              <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                            </svg>
                          </button>
                          {teacher.status === "inactive" ? (
                            <button onClick={() => activateTeacher(teacher.id)}
                              aria-label={t(`เปิดใช้งาน ${teacher.name}`, `Activate ${teacher.name}`)}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </button>
                          ) : (
                            <button onClick={() => setDeactivatingId(teacher.id)}
                              aria-label={t(`ปิดใช้งาน ${teacher.name}`, `Deactivate ${teacher.name}`)}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />

      <TeacherModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ImportTeacherModal open={importOpen} onClose={() => setImportOpen(false)} />
      {deactivatingTeacher && (
        <ConfirmDeactivateTeacherDialog
          teacher={deactivatingTeacher}
          onConfirm={() => { deactivateTeacher(deactivatingId!); setDeactivatingId(null); }}
          onCancel={() => setDeactivatingId(null)}
        />
      )}
      {deletingTeacher && (
        <ConfirmDeleteTeacherDialog
          teacher={deletingTeacher}
          onConfirm={() => { removeTeacher(deletingId!); setDeletingId(null); }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS — Add Single (centred popup)
// ═══════════════════════════════════════════════════════════════

function AddStudentModal({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addCohortStudents, findByStudentId } = useCohortStudents();
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [cohort, setCohort] = useState("");
  const [program, setProgram] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setStudentId(""); setTitle(""); setFirstName(""); setLastName("");
      setEmail(""); setCohort(""); setProgram(""); setErrors({});
    }
  }, [open]);

  function validate() {
    const e: Record<string, string> = {};
    if (!studentId.trim()) e.studentId = t("กรุณากรอกรหัสนักศึกษา", "Student ID is required");
    else if (!STUDENT_ID_RE.test(studentId.trim())) e.studentId = t("รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก", "Student ID must be 8 digits");
    else if (findByStudentId(studentId.trim())) e.studentId = t("รหัสนี้มีในระบบแล้ว", "Student ID already exists");
    if (!firstName.trim()) e.firstName = t("กรุณากรอกชื่อ", "First name is required");
    if (!lastName.trim()) e.lastName = t("กรุณากรอกนามสกุล", "Last name is required");
    if (!email.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    else if (STUDENT_ID_RE.test(studentId.trim()) && email.trim().toLowerCase() !== expectedStudentEmail(studentId.trim()))
      e.email = t("อีเมลต้องเป็น รหัสนักศึกษา@kmitl.ac.th", "Email must be studentID@kmitl.ac.th");
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
      studentId: studentId.trim(), title: title.trim() || undefined, firstName: firstName.trim(), lastName: lastName.trim(),
      email: email.trim().toLowerCase(), cohort: cohort.trim(), program: program.trim(),
    }]);
    setLoading(false);
    onClose();
  }

  const fieldClass = "h-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]";
  const labelClass = "text-sm font-medium text-[var(--text-primary)]";

  // Centred popup — replaced the right-hand drawer (stakeholder request 20/9/2569)
  return (
    <Modal open={open} onClose={onClose} size="md" title={t("เพิ่มนักศึกษา", "Add Student")}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sid" className={labelClass}>{t("รหัสนักศึกษา", "Student ID")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
              <input id="sid" type="text" value={studentId}
                onChange={(e) => { setStudentId(e.target.value); setErrors((p) => ({ ...p, studentId: "" })); }}
                placeholder="64070501" aria-invalid={!!errors.studentId} className={fieldClass} />
              {errors.studentId && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.studentId}</p>}
            </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="stitle" className={labelClass}>{t("คำนำหน้านาม", "Title")}</label>
            <select id="stitle" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass}>
              <option value="">{t("ไม่ระบุ", "None")}</option>
              <option value="นาย">{t("นาย", "Mr.")}</option>
              <option value="นาง">{t("นาง", "Mrs.")}</option>
              <option value="นางสาว">{t("นางสาว", "Ms.")}</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sfn" className={labelClass}>{t("ชื่อ", "First Name")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
              <input id="sfn" type="text" value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors((p) => ({ ...p, firstName: "" })); }}
                placeholder={t("สมชาย", "John")} aria-invalid={!!errors.firstName} className={fieldClass} />
              {errors.firstName && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.firstName}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sln" className={labelClass}>{t("นามสกุล", "Last Name")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
              <input id="sln" type="text" value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors((p) => ({ ...p, lastName: "" })); }}
                placeholder={t("ใจดี", "Smith")} aria-invalid={!!errors.lastName} className={fieldClass} />
              {errors.lastName && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.lastName}</p>}
            </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="semail" className={labelClass}>{t("อีเมล", "Email")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
          <input id="semail" type="email" value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
            placeholder="64070501@kmitl.ac.th" aria-invalid={!!errors.email} className={fieldClass} />
          {errors.email && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.email}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="scohort" className={labelClass}>{t("cohort", "Cohort")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
              <input id="scohort" type="text" value={cohort}
                onChange={(e) => { setCohort(e.target.value); setErrors((p) => ({ ...p, cohort: "" })); }}
                placeholder="CE69" aria-invalid={!!errors.cohort} className={fieldClass} />
              {errors.cohort && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.cohort}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sprogram" className={labelClass}>{t("สาขา", "Program")} <span aria-hidden="true" className="text-[var(--s-err-text)]">*</span></label>
              <input id="sprogram" type="text" value={program}
                onChange={(e) => { setProgram(e.target.value); setErrors((p) => ({ ...p, program: "" })); }}
                placeholder="CE" aria-invalid={!!errors.program} className={fieldClass} />
              {errors.program && <p role="alert" className="text-xs text-[var(--s-err-text)]">{errors.program}</p>}
            </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {t("ยกเลิก", "Cancel")}
          </button>
          <button type="submit" disabled={loading}
            className="h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
            {loading ? t("กำลังบันทึก…", "Saving…") : t("เพิ่มนักศึกษา", "Add Student")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════════════
// STUDENTS TAB
// ═══════════════════════════════════════════════════════════════

function StudentsTab() {
  const { t } = useLanguage();
  const { cohortStudents, updateCohortStudent, removeCohortStudent, findByStudentId } = useCohortStudents();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("CE69");
  const [programFilter, setProgramFilter] = useState("CE");
  // Sorting lives on the column headers (click Student ID / Name), one active
  // key at a time. Default = Student ID ascending; Name cycles asc → desc → back to default.
  const [sort, setSort] = useState<{ key: "id" | "name"; dir: "asc" | "desc" }>({ key: "id", dir: "asc" });
  function toggleIdSort() {
    setSort((s) => ({ key: "id", dir: s.key === "id" && s.dir === "asc" ? "desc" : "asc" }));
  }
  function toggleNameSort() {
    setSort((s) => {
      if (s.key !== "name") return { key: "name", dir: "asc" };
      return s.dir === "asc" ? { key: "name", dir: "desc" } : { key: "id", dir: "asc" };
    });
  }
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Inline row edit
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [draftStudentId, setDraftStudentId] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftFirstName, setDraftFirstName] = useState("");
  const [draftLastName, setDraftLastName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftCohort, setDraftCohort] = useState("");
  const [draftProgram, setDraftProgram] = useState("");
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  function startEdit(student: CohortStudent) {
    setEditingRowId(student.id);
    setDraftStudentId(student.studentId);
    setDraftTitle(student.title ?? "");
    setDraftFirstName(student.firstName);
    setDraftLastName(student.lastName);
    setDraftEmail(student.email);
    setDraftCohort(student.cohort);
    setDraftProgram(student.program);
    setDraftErrors({});
  }

  function cancelEdit() {
    setEditingRowId(null);
    setDraftErrors({});
  }

  function validateEdit() {
    const e: Record<string, string> = {};
    if (!draftStudentId.trim()) e.studentId = t("กรุณากรอกรหัสนักศึกษา", "Student ID is required");
    else if (!STUDENT_ID_RE.test(draftStudentId.trim())) e.studentId = t("รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก", "Student ID must be 8 digits");
    else {
      const dup = findByStudentId(draftStudentId.trim());
      if (dup && dup.id !== editingRowId) e.studentId = t("รหัสนี้มีในระบบแล้ว", "Student ID already exists");
    }
    if (!draftFirstName.trim()) e.firstName = t("กรุณากรอกชื่อ", "First name is required");
    if (!draftLastName.trim()) e.lastName = t("กรุณากรอกนามสกุล", "Last name is required");
    if (!draftEmail.trim()) e.email = t("กรุณากรอกอีเมล", "Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draftEmail.trim())) e.email = t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format");
    else if (STUDENT_ID_RE.test(draftStudentId.trim()) && draftEmail.trim().toLowerCase() !== expectedStudentEmail(draftStudentId.trim()))
      e.email = t("อีเมลต้องเป็น รหัสนักศึกษา@kmitl.ac.th", "Email must be studentID@kmitl.ac.th");
    if (!draftCohort.trim()) e.cohort = t("กรุณากรอก cohort", "Cohort is required");
    if (!draftProgram.trim()) e.program = t("กรุณากรอกสาขา", "Program is required");
    return e;
  }

  function saveEdit() {
    const errs = validateEdit();
    if (Object.keys(errs).length > 0) { setDraftErrors(errs); return; }
    updateCohortStudent(editingRowId!, {
      studentId: draftStudentId.trim(), title: draftTitle.trim() || undefined, firstName: draftFirstName.trim(), lastName: draftLastName.trim(),
      email: draftEmail.trim().toLowerCase(), cohort: draftCohort.trim(), program: draftProgram.trim(),
    });
    setEditingRowId(null);
  }

  const cohorts = [...new Set(cohortStudents.map((s) => s.cohort))].sort();
  // Free-text field, not FK-enforced yet (see CohortStudent.program) — derive
  // options from what's actually in the data instead of hardcoding CECS/CEI/CE,
  // so the filter never hides a program someone typed slightly differently.
  const programs = [...new Set(cohortStudents.map((s) => s.program).filter(Boolean))].sort();
  // Display-only full names for the 3 known abbreviations — falls back to the
  // raw value for anything else, since `program` isn't FK-enforced (see above).
  const PROGRAM_LABEL: Record<string, string> = {
    CE: t("วิศวกรรมคอมพิวเตอร์", "Computer Engineering"),
    CECS: t("วิศวกรรมคอมพิวเตอร์และความมั่นคงปลอดภัยไซเบอร์", "Computer Engineering and Cybersecurity"),
    CEI: t("วิศวกรรมคอมพิวเตอร์นานาชาติ", "Computer Engineering International"),
  };

  const filtered = cohortStudents.filter((s) => {
    const matchCohort = cohortFilter === "all" || s.cohort === cohortFilter;
    const matchProgram = s.program === programFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || s.studentId.includes(q) || s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q);
    return matchCohort && matchProgram && matchSearch;
  });
  filtered.sort((a, b) => {
    const cmp = sort.key === "name"
      ? `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "th")
      : a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
    return sort.dir === "asc" ? cmp : -cmp;
  });
  useEffect(() => { setPage(1); }, [search, cohortFilter, programFilter, sort]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deletingStudent = cohortStudents.find((s) => s.id === deletingId);
  const deactivatingStudent = cohortStudents.find((s) => s.id === deactivatingId);

  useEffect(() => {
    if (!deletingId) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setDeletingId(null); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deletingId]);

  function activateStudent(id: string) {
    updateCohortStudent(id, { status: "active" });
  }
  function deactivateStudent(id: string) {
    updateCohortStudent(id, { status: "inactive" });
    setDeactivatingId(null);
  }

  const COHORT_LABEL = t("cohort ทั้งหมด", "All cohorts");
  const COL_COUNT = 8;

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("ค้นหานักศึกษา...", "Search students...")}
            className="w-48 shrink-0"
            rounded="full"
            suggestions={cohortStudents.map((s) => `${s.firstName} ${s.lastName}`)}
          />
          {cohorts.length > 0 && (
            <FilterSelect
              value={cohortFilter}
              onChange={setCohortFilter}
              ariaLabel={t("กรองตาม cohort", "Filter by cohort")}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
            >
              <option value="all">{COHORT_LABEL}</option>
              {cohorts.map((c) => <option key={c} value={c}>{cohortYearLabel(c)}</option>)}
            </FilterSelect>
          )}
          {programs.length > 0 && (
            <FilterSelect
              value={programFilter}
              onChange={setProgramFilter}
              ariaLabel={t("กรองตามหลักสูตร", "Filter by program")}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              }
            >
              {programs.map((p) => <option key={p} value={p}>{PROGRAM_LABEL[p] ?? p}</option>)}
            </FilterSelect>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:border-[var(--accent-bright)] hover:text-[var(--text-primary)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            {t("นำเข้า CSV", "Import CSV")}
          </button>
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            {t("เพิ่มนักศึกษา", "Add Student")}
          </button>
        </div>
      </div>

      {cohortStudents.length === 0 ? (
        <EmptyState
          iconColor="var(--accent-bright)"
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            </svg>
          }
          title={t("ยังไม่มีนักศึกษาในระบบ", "No students yet")}
          description={t("นำเข้าจากไฟล์ CSV เพื่อเพิ่มนักศึกษาทั้งรุ่น", "Import a CSV file to add cohort students")}
          action={
            <button onClick={() => setImportOpen(true)}
              className="h-9 px-4 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
              {t("นำเข้า CSV", "Import CSV")}
            </button>
          }
        />
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="overflow-y-auto max-h-[calc(100vh-380px)]">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-[136px]" />
                <col className="w-[70px]" />
                <col className="w-[16%]" />
                <col className="w-[20%]" />
                <col className="w-[80px]" />
                <col className="w-[16%]" />
                <col className="w-[100px]" />
                <col className="w-[128px]" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--border-subtle)]">
                  <SortableTh label={t("รหัส", "Student ID")} dir={sort.key === "id" ? sort.dir : undefined} onClick={toggleIdSort}
                    hint={t("คลิกเพื่อเรียงตามรหัส", "Click to sort by student ID")} />
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("คำนำหน้า", "Title")}</th>
                  <SortableTh label={t("ชื่อ-นามสกุล", "Name")} dir={sort.key === "name" ? sort.dir : undefined} onClick={toggleNameSort}
                    hint={t("คลิกเพื่อเรียงตามชื่อ (ก–ฮ → ฮ–ก → กลับไปเรียงตามรหัส)", "Click to sort by name (A–Z → Z–A → back to ID order)")} />
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("Cohort", "Cohort")}</th>
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สาขา", "Program")}</th>
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สถานะ", "Status")}</th>
                  <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("การจัดการ", "Actions")}</th>
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
                  paged.map((student) => {
                    const isInactive = student.status === "inactive";
                    const isEditing = editingRowId === student.id;
                    const inputClass = "h-7 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-app)] px-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-bright)]";
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-subtle)]"
                      >
                        <td className="px-4 py-1 text-[var(--text-secondary)] tabular-nums truncate">
                          {isEditing ? (
                            <div>
                              <input value={draftStudentId} onChange={(e) => { setDraftStudentId(e.target.value); setDraftErrors((p) => ({ ...p, studentId: "" })); }}
                                aria-label={t("รหัสนักศึกษา", "Student ID")} autoFocus className={`${inputClass} tabular-nums`} />
                              {draftErrors.studentId && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.studentId}</p>}
                            </div>
                          ) : student.studentId}
                        </td>
                        <td className="px-4 py-1 text-[var(--text-secondary)] truncate">
                          {isEditing ? (
                            <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)}
                              aria-label={t("คำนำหน้านาม", "Title")} className={inputClass} />
                          ) : (student.title || "-")}
                        </td>
                        <td className="px-4 py-1 font-medium text-[var(--text-primary)] truncate">
                          {isEditing ? (
                            <div className="flex flex-col gap-1">
                              <input value={draftFirstName} onChange={(e) => { setDraftFirstName(e.target.value); setDraftErrors((p) => ({ ...p, firstName: "" })); }}
                                aria-label={t("ชื่อ", "First name")} className={inputClass} />
                              <input value={draftLastName} onChange={(e) => { setDraftLastName(e.target.value); setDraftErrors((p) => ({ ...p, lastName: "" })); }}
                                aria-label={t("นามสกุล", "Last name")} className={inputClass} />
                              {(draftErrors.firstName || draftErrors.lastName) && <p role="alert" className="text-[10px] text-[var(--s-err-text)]">{draftErrors.firstName || draftErrors.lastName}</p>}
                            </div>
                          ) : `${student.firstName} ${student.lastName}`}
                        </td>
                        <td className="px-4 py-1 text-[var(--text-secondary)] truncate">
                          {isEditing ? (
                            <div>
                              <input value={draftEmail} onChange={(e) => { setDraftEmail(e.target.value); setDraftErrors((p) => ({ ...p, email: "" })); }}
                                aria-label={t("อีเมล", "Email")} className={inputClass} />
                              {draftErrors.email && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.email}</p>}
                            </div>
                          ) : student.email}
                        </td>
                        <td className="px-4 py-1">
                          {isEditing ? (
                            <div>
                              <input value={draftCohort} onChange={(e) => { setDraftCohort(e.target.value); setDraftErrors((p) => ({ ...p, cohort: "" })); }}
                                aria-label={t("cohort", "Cohort")} className={inputClass} />
                              {draftErrors.cohort && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.cohort}</p>}
                            </div>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 whitespace-nowrap">{cohortYearLabel(student.cohort)}</span>
                          )}
                        </td>
                        <td className="px-4 py-1">
                          {isEditing ? (
                            <div>
                              <input value={draftProgram} onChange={(e) => { setDraftProgram(e.target.value); setDraftErrors((p) => ({ ...p, program: "" })); }}
                                aria-label={t("สาขา", "Program")} className={inputClass} />
                              {draftErrors.program && <p role="alert" className="text-[10px] text-[var(--s-err-text)] mt-0.5">{draftErrors.program}</p>}
                            </div>
                          ) : (
                            <span className="text-xs text-[var(--text-secondary)] truncate" title={PROGRAM_LABEL[student.program] ?? student.program}>{PROGRAM_LABEL[student.program] ?? student.program}</span>
                          )}
                        </td>
                        <td className="px-4 py-1">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${isInactive ? "bg-[var(--bg-subtle)] text-[var(--text-muted)]" : "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? "bg-[var(--text-muted)]" : "bg-[var(--s-ok-text)]"}`} />
                            {isInactive ? t("พ้นสภาพ", "Inactive") : t("ปกติ", "Active")}
                          </span>
                        </td>
                        <td className="px-4 py-1">
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={saveEdit}
                                  aria-label={t("บันทึก", "Save")}
                                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  aria-label={t("ยกเลิก", "Cancel")}
                                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <>
                            <button
                              onClick={() => startEdit(student)}
                              aria-label={t(`แก้ไข ${student.firstName} ${student.lastName}`, `Edit ${student.firstName} ${student.lastName}`)}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeletingId(student.id)}
                              aria-label={t(`ลบ ${student.firstName} ${student.lastName}`, `Delete ${student.firstName} ${student.lastName}`)}
                              className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors"
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                                <path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                            </button>
                            {isInactive ? (
                              <button
                                onClick={() => activateStudent(student.id)}
                                aria-label={t(`เปิดใช้งาน ${student.firstName} ${student.lastName}`, `Activate ${student.firstName} ${student.lastName}`)}
                                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-green-700 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition-colors"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeactivatingId(student.id)}
                                aria-label={t(`ปิดใช้งาน ${student.firstName} ${student.lastName}`, `Deactivate ${student.firstName} ${student.lastName}`)}
                                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-amber-700 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <circle cx="12" cy="12" r="10"/>
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                </svg>
                              </button>
                            )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>
          </div>
          {filtered.length !== cohortStudents.length && (
            <p className="text-sm text-[var(--text-muted)] mt-3">
              {t(`แสดง ${filtered.length}/${cohortStudents.length}`, `Showing ${filtered.length}/${cohortStudents.length}`)}
            </p>
          )}
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}

      <ImportStudentModal open={importOpen} onClose={() => setImportOpen(false)} />
      <AddStudentModal open={addOpen} onClose={() => setAddOpen(false)} />

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
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
                {t("ยกเลิก", "Cancel")}
              </button>
              <button onClick={() => { removeCohortStudent(deletingId!); setDeletingId(null); }}
                className="flex-1 h-9 rounded-xl border border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)] text-sm font-semibold hover:bg-[var(--s-err-bg)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-err-bd)] transition-colors">
                {t("ลบ", "Delete")}
              </button>
            </div>
          </div>
        </>
      )}

      {deactivatingStudent && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setDeactivatingId(null)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" aria-labelledby="deactivate-student-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <div>
                <h3 id="deactivate-student-title" className="text-sm font-bold text-[var(--text-primary)]">{t("ยืนยันการปิดใช้งาน", "Confirm Deactivate")}</h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t(`ปิดใช้งาน "${deactivatingStudent.firstName} ${deactivatingStudent.lastName}" (${deactivatingStudent.studentId})?`,
                     `Deactivate "${deactivatingStudent.firstName} ${deactivatingStudent.lastName}" (${deactivatingStudent.studentId})?`)}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {t("สามารถเปิดใช้งานคืนได้ภายหลัง", "You can activate them again later.")}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeactivatingId(null)} autoFocus
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors">
                {t("ยกเลิก", "Cancel")}
              </button>
              <button onClick={() => deactivateStudent(deactivatingId!)}
                className="flex-1 h-9 rounded-xl bg-amber-700 text-white text-sm font-semibold hover:bg-amber-800 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors">
                {t("ปิดใช้งาน", "Deactivate")}
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

  const TABS: { key: Tab; label: string }[] = [
    { key: "teachers", label: t("อาจารย์", "Teachers") },
    { key: "students", label: t("นักศึกษา", "Students") },
  ];

  return (
    <div className="p-6 w-full">
      {/* Page heading — 3px teal left strip anchors the section */}
      <div className="mb-6 pl-4" style={{ borderLeft: "3px solid var(--accent-bright)" }}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          {t("จัดการผู้ใช้", "User Management")}
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t("ดูแลบัญชีอาจารย์และนักศึกษาในระบบ — TA จัดการต่อรายวิชาได้ที่หน้าผู้ร่วมสอน", "Manage teacher and student accounts — TAs are assigned per-course on each course's Collaborators page")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 mb-6">
        <StatCard
          label={t("อาจารย์", "Teachers")}
          value={teachers.length}
          color="var(--accent)"
          bg="var(--accent-subtle)"
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
          color="var(--s-info-text)"
          bg="var(--s-info-bg)"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          }
        />
      </div>

      {/* Pill tabs */}
      <div className="mb-6">
        <PillTabBar
          tabs={TABS}
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
