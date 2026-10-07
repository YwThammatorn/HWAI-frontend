"use client";

import { useRef, useState } from "react";
import Modal from "@/components/Modal";
import { useLanguage } from "@/context/LanguageContext";
import { parseExamScoreCsv, scoreCsvTemplate, type ScoreCsvRow, type ScoreRowStatus } from "@/lib/examScoreCsv";

type Person = { studentId: string; firstName: string; lastName: string };

const NEUTRAL = "border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-secondary)]";
const TONE: Record<ScoreRowStatus, string> = {
  new: "border-[var(--s-ok-bd)] bg-[var(--s-ok-bg)] text-[var(--s-ok-text)]",
  overwrite: "border-[var(--s-info-bd)] bg-[var(--s-info-bg)] text-[var(--s-info-text)]",
  same: NEUTRAL,
  empty: NEUTRAL,
  bad_score: "border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
  not_enrolled: "border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
  withdrawn: "border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
  duplicate: "border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
  missing_id: "border-[var(--s-err-bd)] bg-[var(--s-err-bg)] text-[var(--s-err-text)]",
};
const isError = (s: ScoreRowStatus) => !["new", "overwrite", "same", "empty"].includes(s);

/**
 * Teacher: fill an exam's score table from a CSV (4/10/2569). Every ID in the file is matched against the students
 * enrolled in the course; the matching rows fill the table's boxes (nothing is saved until the teacher presses
 * "Save scores"). Rows for people who aren't enrolled, scores outside 0…max, repeated IDs and withdrawn students are
 * listed with the reason and skipped. Mount it when opening, unmount on close (state resets).
 */
export default function ImportExamScoresModal({ students, withdrawnIds, maxPoints, currentOf, onApply, onClose }: {
  /** the enrolled (active) students whose scores can be filled */
  students: Person[];
  withdrawnIds: Set<string>;
  maxPoints: number;
  /** what the score table holds right now for a student ("" = none) */
  currentOf: (studentId: string) => string;
  onApply: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [rows, setRows] = useState<ScoreCsvRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fillable = rows.filter((r) => r.status === "new" || r.status === "overwrite");
  const replaced = rows.filter((r) => r.status === "overwrite").length;
  const errors = rows.filter((r) => isError(r.status));
  const skipped = rows.filter((r) => r.status === "same" || r.status === "empty").length;
  const inFile = new Set(rows.map((r) => r.studentId));
  const notInFile = students.filter((s) => !inFile.has(s.studentId)).length;

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { rows: parsed } = parseExamScoreCsv(e.target?.result as string, {
        maxPoints,
        enrolled: new Map(students.map((s) => [s.studentId, `${s.firstName} ${s.lastName}`])),
        withdrawn: withdrawnIds,
        current: currentOf,
      });
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }

  function reset() {
    setStep("upload"); setRows([]); setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadRoster() {
    const csv = scoreCsvTemplate(students, { id: "student_id", name: t("ชื่อ-นามสกุล", "name"), score: "score" });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "exam-scores-roster.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function apply() {
    onApply(Object.fromEntries(fillable.map((r) => [r.studentId, String(r.score)])));
    onClose();
  }

  const statusText = (r: ScoreCsvRow): string => {
    switch (r.status) {
      case "new": return t("กรอกคะแนนใหม่", "Will fill");
      case "overwrite": return t(`แทนที่คะแนนเดิม ${r.current}`, `Replaces ${r.current}`);
      case "same": return t("เหมือนเดิม", "Unchanged");
      case "empty": return t("ไม่มีคะแนน — ข้าม", "No score — skipped");
      case "bad_score": return t(`คะแนนต้องเป็นตัวเลข 0–${maxPoints}`, `Score must be a number from 0 to ${maxPoints}`);
      case "not_enrolled": return t("ไม่ได้ลงทะเบียนในวิชานี้", "Not enrolled in this course");
      case "withdrawn": return t("ถอนจากวิชาแล้ว", "Withdrawn from this course");
      case "duplicate": return t("รหัสซ้ำในไฟล์ (ใช้แถวแรก)", "ID repeated in the file (first row used)");
      case "missing_id": return t("ไม่มีรหัสนักศึกษา", "Missing student ID");
    }
  };

  const secondaryBtn = "h-10 px-5 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";
  const primaryBtn = "h-10 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-text)] text-sm font-semibold hover:bg-[var(--accent-solid-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)] transition-colors";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t("นำเข้าคะแนนสอบจาก CSV", "Import exam scores from CSV")}
      description={t(`เทียบรหัสนักศึกษากับผู้ที่ลงทะเบียนในวิชานี้ แล้วกรอกคะแนน (เต็ม ${maxPoints})`, `Student IDs are matched against the course roster, then the scores are filled in (out of ${maxPoints})`)}
      footer={
        step === "preview" ? (
          <>
            <button type="button" onClick={onClose} className={secondaryBtn}>{t("ยกเลิก", "Cancel")}</button>
            <button type="button" onClick={apply} disabled={fillable.length === 0} className={primaryBtn}>
              {t(`กรอก ${fillable.length} คะแนน`, `Fill ${fillable.length} ${fillable.length === 1 ? "score" : "scores"}`)}
            </button>
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
                  "ระบบจะเทียบรหัสนักศึกษาในไฟล์กับรายชื่อที่ลงทะเบียนในวิชานี้ แล้วกรอกคะแนนลงในตาราง — ยังไม่บันทึกจนกว่าคุณจะกด “บันทึกคะแนน” รหัสที่ไม่ได้ลงทะเบียน คะแนนนอกช่วง หรือรหัสซ้ำจะถูกข้ามพร้อมบอกเหตุผล",
                  "Each student ID in the file is matched against this course's roster and the scores are filled into the table — nothing is saved until you press “Save scores”. IDs that aren't enrolled, scores out of range and repeated IDs are skipped, with the reason."
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
              <input ref={fileRef} type="file" accept=".csv,text/csv" aria-label={t("ไฟล์ CSV คะแนนสอบ", "Exam scores CSV file")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-3" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{t("ลากไฟล์ CSV มาวาง หรือคลิกเลือก", "Drag CSV here or click to browse")}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{t("รองรับ .csv • UTF-8 (คั่นด้วย , ; หรือ Tab)", "Supports .csv • UTF-8 (separated by , ; or Tab)")}</p>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--text-primary)]">{t("ดาวน์โหลดรายชื่อนักศึกษาในวิชานี้", "Download this course's roster")}</p>
                <p className="text-[11px] text-[var(--text-muted)]">{t(`${students.length} คน · ช่องคะแนนว่าง ไว้กรอกใน Excel แล้วอัปโหลดกลับ`, `${students.length} students · empty score column to fill in Excel and upload back`)}</p>
              </div>
              <button type="button" onClick={downloadRoster} disabled={students.length === 0} className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--accent-bright)]/40 text-[var(--accent)] hover:bg-[var(--accent-bright)]/10 disabled:opacity-50 disabled:pointer-events-none transition-colors">
                {t("ดาวน์โหลด", "Download")}
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] p-3.5">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">{t("รูปแบบ CSV ที่รองรับ", "Supported CSV format")}</p>
              <table className="text-xs">
                <thead><tr className="text-left text-[var(--text-muted)]"><th className="pb-1.5 pr-8 font-mono font-medium">student_id</th><th className="pb-1.5 font-mono font-medium">score</th></tr></thead>
                <tbody className="text-[var(--text-secondary)] tabular-nums"><tr><td className="py-0.5 pr-8">69070101</td><td>{Math.round(maxPoints * 0.84)}</td></tr><tr><td className="py-0.5 pr-8">69070102</td><td>{Math.round(maxPoints * 0.7)}</td></tr></tbody>
              </table>
              <p className="text-xs text-[var(--text-muted)] mt-2">
                {t("มีหรือไม่มีแถวหัวตารางก็ได้ (student_id, score หรือ รหัสนักศึกษา, คะแนน) · คอลัมน์อื่น เช่น ชื่อ จะถูกข้าม · เว้นคะแนนว่างไว้ = ไม่แตะคะแนนของคนนั้น", "A header row is optional (student_id, score — or the Thai headings) · other columns such as the name are ignored · a blank score leaves that student untouched")}
              </p>
            </div>
          </>
        )}

        {step === "preview" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-x-4 gap-y-1 text-sm flex-wrap" role="status">
              <span className="font-medium text-[var(--text-primary)]">{fileName}</span>
              <span className="font-medium text-[var(--s-ok-text)]"><span className="tabular-nums">{fillable.length}</span> {t("พร้อมกรอก", "ready to fill")}{replaced > 0 && <span className="font-normal text-[var(--text-secondary)]"> ({t(`แทนที่คะแนนเดิม ${replaced}`, `${replaced} replace an existing score`)})</span>}</span>
              {skipped > 0 && <span className="text-[var(--text-secondary)]"><span className="tabular-nums">{skipped}</span> {t("ข้าม (ว่าง/เหมือนเดิม)", "skipped (blank / unchanged)")}</span>}
              {errors.length > 0 && <span className="font-medium text-[var(--s-err-text)]"><span className="tabular-nums">{errors.length}</span> {t("มีข้อผิดพลาด", "with errors")}</span>}
            </div>

            {rows.length === 0 ? (
              <p className="rounded-xl border border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบแถวข้อมูลในไฟล์นี้", "No data rows found in this file")}</p>
            ) : (
              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--bg-surface)] sticky top-0 border-b border-[var(--border-subtle)]">
                      <tr>{["#", t("รหัสนักศึกษา", "Student ID"), t("ชื่อ-นามสกุล", "Name"), t("คะแนนในไฟล์", "Score in file"), t("สถานะ", "Status")].map((h) => <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--text-muted)]">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.line} data-status={r.status} className={`border-t border-[var(--border-subtle)] ${isError(r.status) ? "bg-[var(--s-err-bg)]" : ""}`}>
                          <td className="px-3 py-1.5 text-[var(--text-muted)] tabular-nums">{r.line}</td>
                          <td className="px-3 py-1.5 text-[var(--text-primary)] tabular-nums">{r.rawId || "—"}</td>
                          <td className="px-3 py-1.5 text-[var(--text-primary)]">{r.name ?? "—"}</td>
                          <td className="px-3 py-1.5 text-[var(--text-primary)] tabular-nums">{r.rawScore || "—"}</td>
                          <td className="px-3 py-1.5">
                            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TONE[r.status]}`}>{statusText(r)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {notInFile > 0 && rows.length > 0 && (
              <p className="text-xs text-[var(--text-muted)]">
                {t(`นักศึกษาในวิชานี้อีก ${notInFile} คนไม่อยู่ในไฟล์ — คะแนนของพวกเขาจะไม่เปลี่ยน`, `${notInFile} other ${notInFile === 1 ? "student" : "students"} on this course ${notInFile === 1 ? "isn't" : "aren't"} in the file — their scores stay as they are`)}
              </p>
            )}
            {errors.length > 0 && <p className="text-xs text-[var(--text-muted)]">{t(`แถวที่มีข้อผิดพลาดจะถูกข้าม — กรอกเฉพาะ ${fillable.length} แถวที่ถูกต้อง`, `Rows with errors are skipped — only the ${fillable.length} valid rows are filled`)}</p>}

            <button type="button" onClick={reset} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline self-start transition-colors">{t("เลือกไฟล์ใหม่", "Choose another file")}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
