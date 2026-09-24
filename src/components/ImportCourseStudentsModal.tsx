"use client";

import { useState, useRef } from "react";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useCohortStudents, CohortStudent } from "@/lib/cohort-students";

interface ParsedRow {
  line: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  error?: string;
  match?: CohortStudent;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const hasHeader =
    first.includes("student_id") ||
    first.includes("รหัส") ||
    first.includes("first") ||
    first.includes("ชื่อ");

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, i) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const studentId = cols[0] ?? "";
    const firstName = cols[1] ?? "";
    const lastName = cols[2] ?? "";
    const email = cols[3] ?? "";

    let error: string | undefined;
    if (!studentId) error = "missing_id";
    else if (!firstName) error = "missing_first";
    else if (!lastName) error = "missing_last";

    return { line: i + (hasHeader ? 2 : 1), studentId, firstName, lastName, email, error };
  });
}

/**
 * Teacher: import a CSV of students into ONE course, as a centred popup (DESIGN.md §9a — same as
 * the admin Import Students modal). Every ID is cross-checked against the system's student
 * database: a match pulls the real name/email from there (so a typo in the file can't drift the
 * enrolled record from the real account), an unknown ID or an already-enrolled one is skipped.
 * Mount it when opening, unmount on close (state resets).
 */
export default function ImportCourseStudentsModal({ courseId, courseName, onClose }: {
  courseId: string;
  courseName: string;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const { addStudents, getStudentsByCourse } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importedCount, setImportedCount] = useState(0);

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  function translateError(code?: string) {
    if (!code) return "";
    if (code === "missing_id") return t("ไม่มีรหัสนักศึกษา", "Missing student ID");
    if (code === "missing_first") return t("ไม่มีชื่อ", "Missing first name");
    if (code === "missing_last") return t("ไม่มีนามสกุล", "Missing last name");
    if (code === "not_in_system") return t("ไม่พบในระบบ", "Not found in system");
    if (code === "already_enrolled") return t("ลงทะเบียนแล้ว", "Already enrolled");
    return code;
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const enrolledIds = new Set(getStudentsByCourse(courseId).map((s) => s.studentId));
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string).map((row) => {
        if (row.error) return row;
        if (enrolledIds.has(row.studentId)) return { ...row, error: "already_enrolled" };
        const match = findByStudentId(row.studentId);
        if (!match) return { ...row, error: "not_in_system" };
        return { ...row, firstName: match.firstName, lastName: match.lastName, email: match.email, match };
      });
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleImport() {
    if (validRows.length === 0) return;
    addStudents(courseId, validRows.map(({ studentId, firstName, lastName, email }) => ({
      studentId, firstName, lastName, email,
      enrollmentStatus: "enrolled" as const,
    })));
    setImportedCount(validRows.length);
    setStep("done");
  }

  const secondaryBtn = "h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primaryBtn = "h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t("นำเข้านักศึกษา", "Import Students")}
      description={t(`เข้าวิชา ${courseName} จากไฟล์ CSV`, `Enroll students in ${courseName} from a CSV file`)}
      footer={
        step === "preview" ? (
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>{t("ยกเลิก", "Cancel")}</button>
            <button type="button" onClick={handleImport} disabled={validRows.length === 0} className={primaryBtn}>
              {t(`นำเข้า ${validRows.length} นักศึกษา`, `Import ${validRows.length} Students`)}
            </button>
          </>
        ) : step === "done" ? (
          <>
            <button type="button" onClick={reset} className={secondaryBtn}>{t("นำเข้าเพิ่มเติม", "Import More")}</button>
            <button type="button" onClick={onClose} className={primaryBtn}>{t("เสร็จสิ้น", "Done")}</button>
          </>
        ) : (
          <button type="button" onClick={onClose} className={secondaryBtn}>{t("ยกเลิก", "Cancel")}</button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {step === "upload" && (
          <>
            <div className="flex gap-2.5 rounded-xl border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-4 py-3">
              <svg className="shrink-0 mt-0.5 text-[var(--s-info-text)]" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <p className="text-xs text-[var(--s-info-text)] leading-relaxed">
                {t(
                  "ทุกรหัสนักศึกษาจะถูกตรวจสอบกับรายชื่อที่มีอยู่ในระบบก่อน — ถ้าพบจะดึงชื่อ/อีเมลจริงจากระบบมาลงทะเบียน ถ้าไม่พบในระบบจะข้ามแถวนั้นไป (ให้แอดมินเพิ่มเข้าระบบก่อน)",
                  "Each student ID is checked against the system's existing student database first — a match pulls the real name/email from there; an ID not in the system is skipped (ask an admin to add it first)."
                )}
              </p>
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${isDragging ? "border-[var(--accent-bright)] bg-[var(--accent-bright)]/5" : "border-[var(--border-subtle)] hover:border-[var(--accent-bright)]/50"}`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("รองรับ .csv • UTF-8", "Supports .csv • UTF-8 encoding")}</p>
            </div>

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
                  <p className="text-[11px] text-[var(--text-muted)] truncate">students-template.csv — {t("รูปแบบที่ระบบรองรับ", "supported format")}</p>
                </div>
              </div>
              <a
                href="/students-template.csv"
                download
                className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-bright)]/40 text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 transition-colors"
              >
                {t("ดาวน์โหลด", "Download")}
              </a>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] p-3.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("รูปแบบ CSV ที่รองรับ", "Supported CSV Format")}</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-left text-[var(--text-muted)]">
                      {["student_id", "first_name", "last_name", "email"].map((h) => (
                        <th key={h} className="pb-1.5 pr-6 font-mono font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text-secondary)]">
                    <tr>
                      <td className="py-1 pr-6 tabular-nums">66070500401</td>
                      <td className="py-1 pr-6">สมชาย</td>
                      <td className="py-1 pr-6">ใจดี</td>
                      <td className="py-1 pr-6">somchai@kmitl.ac.th</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-2">{t("* email ไม่บังคับ — student_id, first_name, last_name จำเป็น", "* email is optional — student_id, first_name, last_name are required")}</p>
            </div>
          </>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4 text-sm flex-wrap">
              <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
              <span className="text-[var(--s-ok-text)] font-medium">
                <span className="tabular-nums">{validRows.length}</span> {t("พร้อม import", "ready to import")}
              </span>
              {errorRows.length > 0 && (
                <span className="text-[var(--s-err-text)] font-medium">
                  <span className="tabular-nums">{errorRows.length}</span> {t("มีข้อผิดพลาด", "with errors")}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-xs">
                  {/* --bg-subtle is reserved for row hover, never a static header fill (DESIGN.md §9b). */}
                  <thead className="bg-[var(--bg-surface)] sticky top-0 border-b border-[var(--border-subtle)]">
                    <tr>
                      {["#", t("รหัสนักศึกษา", "Student ID"), t("ชื่อ", "First Name"), t("นามสกุล", "Last Name"), "Email", t("สถานะ", "Status")].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.line} className={`border-t border-[var(--border-subtle)] ${row.error ? "bg-[var(--s-err-bg)]" : ""}`}>
                        <td className="px-3 py-1.5 text-[var(--text-muted)] tabular-nums">{row.line}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)] tabular-nums">{row.studentId || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.firstName || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-primary)]">{row.lastName || "—"}</td>
                        <td className="px-3 py-1.5 text-[var(--text-secondary)]">{row.email || "—"}</td>
                        <td className="px-3 py-1.5">
                          {row.error ? (
                            <span className="text-[var(--s-err-text)] font-medium">{translateError(row.error)}</span>
                          ) : (
                            <span className="text-[var(--s-ok-text)]">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {errorRows.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                {t(`แถวที่มีข้อผิดพลาดจะถูกข้ามไป — เฉพาะ ${validRows.length} แถวที่ถูกต้องจะถูก import`, `Rows with errors will be skipped — only ${validRows.length} valid rows will be imported`)}
              </p>
            )}

            <button
              type="button"
              onClick={reset}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors"
            >
              {t("เลือกไฟล์ใหม่", "Choose another file")}
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--s-ok-bg)] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--s-ok-text)" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p role="status" className="text-sm font-semibold text-[var(--text-primary)]">{t("Import สำเร็จ", "Import Complete")}</p>
            <p className="text-xs text-[var(--text-muted)]">
              {t(`เพิ่ม ${importedCount} นักศึกษา เข้า ${courseName} เรียบร้อยแล้ว`, `Added ${importedCount} students to ${courseName} successfully`)}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
