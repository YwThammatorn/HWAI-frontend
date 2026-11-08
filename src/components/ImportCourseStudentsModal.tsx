"use client";

import { useState, useRef } from "react";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { useStudents } from "@/lib/students";
import { useCohortStudents, CohortStudent } from "@/lib/cohort-students";
import { useSectionProgram } from "@/lib/sectionProgram";
import { useCourses } from "@/lib/courses";
import { csvToGrid, excelToGrid, fileKind, parseRosterGrid, type SheetRow, type ParsedSheet } from "@/lib/rosterSheet";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
interface ParsedRow extends Omit<SheetRow, "error"> {
  error?: string;
  match?: CohortStudent;
}

/**
 * Teacher: import students into ONE course from a CSV or from the registrar's exam sheet (.xls, 15/10/2569), as a centred popup (DESIGN.md §9a — same as
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
  const { section } = useSectionProgram(courseId);
  const { getCourse } = useCourses();
  const course = getCourse(courseId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [fileError, setFileError] = useState<"unsupported" | "unreadable" | null>(null);
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  function translateError(code?: string) {
    if (!code) return "";
    if (code === "missing_id") return t("ไม่มีรหัสนักศึกษา", "Missing student ID");
    if (code === "missing_first") return t("ไม่มีชื่อ", "Missing first name");
    if (code === "missing_last") return t("ไม่มีนามสกุล", "Missing last name");
    if (code === "not_in_system") return t("ไม่พบในระบบ", "Not found in system");
    if (code === "already_enrolled") return t("ลงทะเบียนแล้ว", "Already enrolled");
    if (code.startsWith("other_group:")) {
      const g = code.slice("other_group:".length);
      return t(`อยู่กลุ่ม ${g} ไม่ใช่กลุ่มของ section นี้`, `In group ${g}, not this section's group`);
    }
    if (code.startsWith("wrong_program:")) {
      const p = code.slice("wrong_program:".length);
      return t(`คนละหลักสูตรกับ section นี้ (${p})`, `Different program from this section (${p})`);
    }
    return code;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setFileError(null);
    const kind = fileKind(file.name);
    if (kind === "unsupported") { setFileError("unsupported"); return; }
    let parsedSheet: ParsedSheet;
    try {
      const grid = kind === "csv" ? csvToGrid(await file.text()) : await excelToGrid(await file.arrayBuffer());
      parsedSheet = parseRosterGrid(grid);
    } catch {
      setFileError("unreadable");
      return;
    }
    const enrolledIds = new Set(getStudentsByCourse(courseId).map((s) => s.studentId));
    // The registrar's sheet holds every section of the subject: only the rows under this section's "กลุ่ม" belong here.
    const sectionNo = course?.sectionNumber ? Number(course.sectionNumber) : NaN;
    const filterByGroup = parsedSheet.kind === "registrar" && parsedSheet.groups.length > 0 && Number.isFinite(sectionNo);
    // One section = one program (4/10/2569). A section that no curriculum or earlier student pins down yet is
    // pinned by the first student this file would add, so one file can't smuggle in a mix either.
    let pinned = section?.program ?? null;
    const parsed: ParsedRow[] = parsedSheet.rows.map((row) => {
      if (row.error) return row;
      if (filterByGroup && row.group !== sectionNo) return { ...row, error: `other_group:${row.group}` };
      if (enrolledIds.has(row.studentId)) return { ...row, error: "already_enrolled" };
      const match = findByStudentId(row.studentId);
      if (!match) return { ...row, error: "not_in_system" };
      const named = { ...row, firstName: match.firstName, lastName: match.lastName, email: match.email, match };
      if (pinned && match.program && match.program !== pinned) return { ...named, error: `wrong_program:${match.program}` };
      if (!pinned && match.program) pinned = match.program;
      return named;
    });
    setSheet(parsedSheet);
    setRows(parsed);
    setStep("preview");
  }

  function reset() {
    setStep("upload");
    setRows([]);
    setFileName("");
    setFileError(null);
    setSheet(null);
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
      description={t(`เข้าวิชา ${courseName} จากไฟล์ Excel (ใบคะแนนสอบจากทะเบียน) หรือ .csv`, `Enroll students in ${courseName} from an Excel file (the registrar's exam sheet) or a .csv file`)}
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
              <Icon name="info" size="xs" className="shrink-0 mt-0.5 text-[var(--s-info-text)]" />
              <p className="text-xs text-[var(--s-info-text)] leading-relaxed">
                {t(
                  "ทุกรหัสนักศึกษาจะถูกตรวจสอบกับรายชื่อที่มีอยู่ในระบบก่อน — ถ้าพบจะดึงชื่อ/อีเมลจริงจากระบบมาลงทะเบียน ถ้าไม่พบในระบบจะข้ามแถวนั้นไป (ให้แอดมินเพิ่มเข้าระบบก่อน)",
                  "Each student ID is checked against the system's existing student database first — a match pulls the real name/email from there; an ID not in the system is skipped (ask an admin to add it first)."
                )}
                {section && " " + t(
                  `section นี้เป็นของหลักสูตร ${section.program} — นักศึกษาจากหลักสูตรอื่นจะถูกข้าม`,
                  `This section is for ${section.program} — students from any other program are skipped.`,
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
                accept=".xls,.xlsx,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
              <div className="mb-3 flex justify-center"><IconTile icon="download" size="lg" tone="accent" /></div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์มาวาง หรือคลิกเลือก", "Drag a file here or click to browse")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("รองรับ Excel (.xls / .xlsx — ใบคะแนนสอบจากทะเบียน) และ .csv (UTF-8)", "Supports Excel (.xls / .xlsx — the registrar's exam sheet) and .csv (UTF-8)")}</p>
            </div>
            {fileError && (
              <p role="alert" className="rounded-xl border border-[var(--s-err-bd)] bg-[var(--s-err-bg)] px-4 py-2.5 text-xs font-medium text-[var(--s-err-text)]">
                {fileName} — {fileError === "unsupported"
                  ? t("ไฟล์ชนิดนี้ไม่รองรับ — ใช้ไฟล์ Excel (.xls / .xlsx) จากทะเบียน หรือ .csv", "This file type isn't supported — use the registrar's Excel file (.xls / .xlsx) or a .csv")
                  : t("อ่านไฟล์ไม่ได้ — ไฟล์อาจเสียหรือมีรหัสผ่าน ลองเปิดแล้วบันทึกเป็น CSV", "Couldn't read this file — it may be damaged or password-protected; try saving it as CSV")}
              </p>
            )}

            <div className="rounded-xl border border-[var(--border-subtle)] p-3.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">{t("ใบคะแนนสอบจากทะเบียน (Excel)", "Registrar exam sheet (Excel)")}</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t(
                  "ใช้ไฟล์ stdfinsec_… ที่ได้จากระบบทะเบียนได้เลย ไม่ต้องแก้ — ระบบอ่านรหัสและชื่อจากตาราง และนำเข้าเฉพาะนักศึกษาในกลุ่มเรียนเดียวกับ section นี้",
                  "Use the stdfinsec_… file from the registrar as it is — the IDs and names are read from the table, and only the students in this section's group are imported.",
                )}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <IconTile icon="file-text" size="sm" tone="accent" />
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
            {sheet?.kind === "registrar" && (
              <p data-testid="sheet-info" className="rounded-xl border border-[var(--s-info-bd)] bg-[var(--s-info-bg)] px-4 py-2.5 text-xs text-[var(--s-info-text)]">
                {t("ใบคะแนนสอบจากทะเบียน", "Registrar exam sheet")}
                {sheet.courseCode ? ` · ${sheet.courseCode}${sheet.courseName ? ` ${sheet.courseName}` : ""}` : ""}
                {sheet.groups.length > 0 ? ` · ${t("กลุ่ม", "group")} ${sheet.groups.join(", ")}` : ""}
                {course?.sectionNumber && sheet.groups.length > 0 ? ` — ${t(`นำเข้าเฉพาะกลุ่ม ${course.sectionNumber}`, `importing group ${course.sectionNumber} only`)}` : ""}
              </p>
            )}
            {sheet?.kind === "registrar" && sheet.courseCode && course?.code && sheet.courseCode !== course.code && (
              <p role="alert" data-testid="sheet-code-warning" className="rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-4 py-2.5 text-xs font-medium text-[var(--s-warn-text)]">
                {t(`ไฟล์นี้เป็นของวิชา ${sheet.courseCode} แต่คุณกำลังนำเข้าวิชา ${course.code} — ตรวจสอบว่าเลือกไฟล์ถูกวิชา`, `This sheet is for subject ${sheet.courseCode}, but you are importing into ${course.code} — check it is the right file`)}
              </p>
            )}
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
            <IconTile icon="check" size="lg" shape="round" tone="ok" />
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
