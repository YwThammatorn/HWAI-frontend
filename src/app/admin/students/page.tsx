"use client";

import { useState, useRef, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCohortStudents, CohortStudent } from "@/lib/cohort-students";

// ---- CSV parsing ----

type RowError = { type: "missing_fields"; fields: string[] } | { type: "invalid_email" };

interface ParsedRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  cohort: string;
  program: string;
  error?: RowError;
}

interface ParseResult {
  rows: ParsedRow[];
  totalErrors: number;
}

const REQUIRED_COLS = ["studentId", "firstName", "lastName", "email", "cohort", "program"] as const;

/** RFC 4180-compliant CSV field splitter — handles quoted commas and escaped quotes (""). */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++; // skip opening quote
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2; } // escaped quote
        else if (line[i] === '"') { i++; break; } // closing quote
        else { field += line[i++]; }
      }
      fields.push(field.trim());
      if (i < line.length && line[i] === ',') i++; // skip field delimiter
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) { fields.push(line.slice(i).trim()); break; }
      fields.push(line.slice(i, end).trim());
      i = end + 1;
      if (i === line.length) { fields.push(""); break; } // trailing comma → empty last field
    }
  }
  return fields;
}

function parseCsv(raw: string): ParseResult {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // strip UTF-8 BOM
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], totalErrors: 0 };

  const header = splitCsvLine(lines[0]);
  const colIndex = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = lines.slice(1).map((line): ParsedRow => {
    const cells = splitCsvLine(line);
    const row: ParsedRow = {
      studentId: cells[colIndex.studentId] ?? "",
      firstName: cells[colIndex.firstName] ?? "",
      lastName: cells[colIndex.lastName] ?? "",
      email: cells[colIndex.email] ?? "",
      cohort: cells[colIndex.cohort] ?? "",
      program: cells[colIndex.program] ?? "",
    };
    const missing = REQUIRED_COLS.filter((k) => !row[k]);
    if (missing.length > 0) row.error = { type: "missing_fields", fields: [...missing] };
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.error = { type: "invalid_email" };
    return row;
  });

  return { rows, totalErrors: rows.filter((r) => r.error).length };
}

// ---- Import Drawer ----

function ImportDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const { addCohortStudents, findByStudentId } = useCohortStudents();
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith(".csv")) return;
    setFileName(file.name);
    setDone(false);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setParseResult(parseCsv(text));
    };
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
    const valid = parseResult.rows
      .filter((r) => !r.error && !findByStudentId(r.studentId))
      .map(({ error: _e, ...rest }) => rest);
    addCohortStudents(valid);
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

  function rowErrorLabel(err: RowError): string {
    if (err.type === "missing_fields")
      return t(`ขาด: ${err.fields.join(", ")}`, `Missing: ${err.fields.join(", ")}`);
    return t("อีเมลไม่ถูกต้อง", "Invalid email");
  }

  // Close drawer on Escape (component only mounts when open=true)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") handleClose(); }
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

  if (!open) return null;

  const validRows = parseResult?.rows.filter((r) => !r.error) ?? [];
  const errorRows = parseResult?.rows.filter((r) => r.error) ?? [];

  const SAMPLE_CSV = "studentId,firstName,lastName,email,cohort,program\n64070501,สมชาย,ใจดี,s64070501@email.kmitl.ac.th,CE69,CE\n64070502,สมหญิง,ดีมาก,s64070502@email.kmitl.ac.th,CE69,CE";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={handleClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("นำเข้านักศึกษา CSV", "Import Students CSV")}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl z-40 flex flex-col"
        onKeyDown={handleFocusTrap}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] shrink-0">
          <h2 className="text-base font-bold text-[var(--text-primary)]">{t("นำเข้านักศึกษา CSV", "Import Students CSV")}</h2>
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

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {done ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-10">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{t("นำเข้าสำเร็จ!", "Import successful!")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                {t(`เพิ่ม ${validRows.length} คน`, `Added ${validRows.length} student(s)`)}
              </p>
              <button
                onClick={handleClose}
                className="mt-5 h-9 px-5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
              >
                {t("เสร็จสิ้น", "Done")}
              </button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                aria-label={t("คลิกหรือลากไฟล์ CSV มาวาง", "Click or drag CSV file here")}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] ${
                  dragOver
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/5"
                    : "border-[var(--border-subtle)] hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/5"
                }`}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={dragOver ? "#0F766E" : "var(--text-muted)"} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" className="mb-2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {fileName ? (
                  <p className="text-sm font-semibold text-[#0F766E]">{fileName}</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{t("คลิกหรือลากไฟล์ CSV", "Click or drag CSV file")}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">{t("รองรับเฉพาะ .csv", "Only .csv files supported")}</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".csv" className="sr-only" tabIndex={-1} onChange={handleInputChange} aria-hidden="true" />
              </div>

              {/* Format hint */}
              <details className="text-xs text-[var(--text-muted)]">
                <summary className="cursor-pointer hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#2DD4BF] rounded">
                  {t("ดูรูปแบบ CSV ที่รองรับ", "View required CSV format")}
                </summary>
                <pre className="mt-2 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] overflow-x-auto font-mono text-[10.5px] leading-relaxed whitespace-pre">
                  {SAMPLE_CSV}
                </pre>
              </details>

              {/* Preview */}
              {parseResult && parseResult.rows.length > 0 && (
                <div className="flex flex-col gap-3">
                  {/* Stats */}
                  <div className="flex gap-3">
                    <div className="flex-1 rounded-xl bg-green-50 border border-green-100 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-green-700 tabular-nums">{validRows.length}</p>
                      <p className="text-xs text-green-600">{t("แถวที่ถูกต้อง", "Valid rows")}</p>
                    </div>
                    {errorRows.length > 0 && (
                      <div className="flex-1 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-center">
                        <p className="text-lg font-bold text-red-600 tabular-nums">{errorRows.length}</p>
                        <p className="text-xs text-red-500">{t("แถวที่มีปัญหา", "Error rows")}</p>
                      </div>
                    )}
                  </div>

                  {/* Preview table */}
                  <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead>
                        <tr className="bg-[var(--bg-app)] border-b border-[var(--border-subtle)]">
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("รหัส", "ID")}</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("ชื่อ", "First")}</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("นามสกุล", "Last")}</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("cohort", "Cohort")}</th>
                          <th scope="col" className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{t("สถานะ", "Status")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseResult.rows.slice(0, 30).map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-[var(--border-subtle)] last:border-0 ${row.error ? "bg-red-50" : ""}`}
                          >
                            <td className="px-3 py-1.5 text-[var(--text-primary)] font-mono">{row.studentId || "—"}</td>
                            <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.firstName || "—"}</td>
                            <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.lastName || "—"}</td>
                            <td className="px-3 py-1.5 text-[var(--text-muted)]">{row.cohort || "—"}</td>
                            <td className="px-3 py-1.5">
                              {row.error ? (
                                <span className="text-red-600 font-medium">{rowErrorLabel(row.error)}</span>
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
              )}
            </>
          )}
        </div>

        {!done && parseResult && validRows.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--border-subtle)] shrink-0 flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 h-10 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {t("ยกเลิก", "Cancel")}
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {importing
                ? t("กำลังนำเข้า…", "Importing…")
                : t(`นำเข้า ${validRows.length} คน`, `Import ${validRows.length} student(s)`)}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---- Main page ----

export default function AdminStudentsPage() {
  const { t } = useLanguage();
  const { cohortStudents, removeCohortStudent } = useCohortStudents();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState("all");

  const cohorts = [...new Set(cohortStudents.map((s) => s.cohort))].sort();

  const filtered = cohortStudents.filter((s) => {
    const matchCohort = cohortFilter === "all" || s.cohort === cohortFilter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.studentId.includes(q) ||
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q);
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

  return (
    <div className="p-6 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t("จัดการนักศึกษา", "Student Management")}</h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {t(`นักศึกษาทั้งหมด ${cohortStudents.length} คน`, `${cohortStudents.length} student(s) in cohort`)}
            </p>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t("นำเข้า CSV", "Import CSV")}
          </button>
        </div>

        {cohortStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] py-16 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[#2DD4BF]/10 flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ยังไม่มีนักศึกษาในระบบ", "No students yet")}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1 mb-4">{t("นำเข้าจากไฟล์ CSV เพื่อเพิ่มนักศึกษาทั้งรุ่น", "Import a CSV file to add cohort students")}</p>
            <button
              onClick={() => setDrawerOpen(true)}
              className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
            >
              {t("นำเข้า CSV", "Import CSV")}
            </button>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="search"
                  placeholder={t("ค้นหา…", "Search…")}
                  aria-label={t("ค้นหานักศึกษา", "Search students")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                />
              </div>
              {cohorts.length > 0 && (
                <select
                  value={cohortFilter}
                  onChange={(e) => setCohortFilter(e.target.value)}
                  className="h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                  aria-label={t("กรอง cohort", "Filter by cohort")}
                >
                  <option value="all">{COHORT_LABEL}</option>
                  {cohorts.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {filtered.length !== cohortStudents.length && (
                <p className="text-sm text-[var(--text-muted)] self-center">
                  {t(`แสดง ${filtered.length}/${cohortStudents.length}`, `Showing ${filtered.length}/${cohortStudents.length}`)}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-app)]">
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("รหัส", "Student ID")}</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("ชื่อ-นามสกุล", "Name")}</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("cohort / สาขา", "Cohort / Program")}</th>
                    <th scope="col" className="px-4 py-3 w-12"><span className="sr-only">{t("ลบ", "Delete")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        {t("ไม่พบผลการค้นหา", "No results found")}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((student, i) => (
                      <tr
                        key={student.id}
                        className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-subtle)] transition-colors ${i % 2 === 1 ? "bg-[var(--bg-app)]" : ""}`}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

      <ImportDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Delete confirm */}
      {deletingStudent && (
        <>
          <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setDeletingId(null)} aria-hidden="true" />
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="del-student-title"
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-40 w-full max-w-sm bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] p-6 flex flex-col gap-4"
          >
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
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
              <button
                onClick={() => { removeCohortStudent(deletingId!); setDeletingId(null); }}
                className="flex-1 h-9 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 transition-colors"
              >
                {t("ลบ", "Delete")}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
