"use client";

import { useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";

interface ParsedRow {
  line: number;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  error?: string;
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
    if (!studentId) error = "ไม่มีรหัสนักศึกษา";
    else if (!firstName) error = "ไม่มีชื่อ";
    else if (!lastName) error = "ไม่มีนามสกุล";

    return { line: i + (hasHeader ? 2 : 1), studentId, firstName, lastName, email, error };
  });
}

export default function ImportStudentsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getCourse } = useCourses();
  const { addStudents, getStudentsByCourse } = useStudents();
  const course = getCourse(id);

  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => r.error);

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  function handleImport() {
    setImporting(true);
    addStudents(id, validRows.map(({ studentId, firstName, lastName, email }) => ({
      studentId, firstName, lastName, email,
    })));
    setImporting(false);
    setStep("done");
  }

  if (!course) {
    return (
      <AppShell>
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          ไม่พบรายวิชานี้ —{" "}
          <Link href="/courses" className="text-[var(--accent)] ml-1 hover:underline">กลับไปหน้าหลัก</Link>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="w-full max-w-[860px] mx-auto px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
          <Link href="/courses" className="hover:text-[var(--accent)] transition-colors">All Courses</Link>
          <span>/</span>
          <Link href={`/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">Import Students</span>
        </div>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Import Students</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload a CSV file to enroll students in <span className="font-medium text-[var(--text-primary)]">{course.name}</span>
          </p>
        </div>

        {/* ─── STEP: UPLOAD ─── */}
        {step === "upload" && (
          <div className="space-y-5">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={[
                "border-2 border-dashed rounded-2xl py-16 flex flex-col items-center gap-3 transition-colors cursor-pointer",
                isDragging
                  ? "border-[var(--accent)] bg-[var(--accent-subtle)]"
                  : "border-gray-200 bg-white hover:border-[var(--accent)] hover:bg-[#F0FFFE]",
              ].join(" ")}
              onClick={() => fileRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[var(--text-primary)]">Drag and drop your file here</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  or{" "}
                  <span className="text-[var(--accent)] font-medium">browse your computer</span>
                </p>
              </div>
              <p className="text-xs text-gray-300 uppercase tracking-wide">Supports .csv • UTF-8 encoding</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
              />
            </div>

            {/* Template download */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <polyline points="9 15 12 18 15 15"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">ดาวน์โหลด Template</p>
                  <p className="text-xs text-gray-500">students-template.csv — รูปแบบที่ระบบรองรับ</p>
                </div>
              </div>
              <a
                href="/students-template.csv"
                download
                className="px-4 py-2 text-sm font-medium rounded-xl border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                Download
              </a>
            </div>

            {/* Format hint */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">รูปแบบ CSV ที่รองรับ</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-50">
                      {["student_id", "first_name", "last_name", "email"].map((h) => (
                        <th key={h} className="pb-2 pr-6 font-mono font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-gray-500">
                    <tr>
                      <td className="py-2 pr-6 font-mono">66070500401</td>
                      <td className="py-2 pr-6">สมชาย</td>
                      <td className="py-2 pr-6">ใจดี</td>
                      <td className="py-2 pr-6 text-gray-300">somchai@kmitl.ac.th</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-3">* email ไม่บังคับ — student_id, first_name, last_name จำเป็น</p>
            </div>

            <div className="flex justify-end">
              <Link href={`/courses/${id}`} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </Link>
            </div>
          </div>
        )}

        {/* ─── STEP: PREVIEW ─── */}
        {step === "preview" && (
          <div className="space-y-5">
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span className="font-semibold text-[var(--text-primary)]">{validRows.length}</span>
                  <span className="text-gray-500">พร้อม import</span>
                </div>
                {errorRows.length > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="font-semibold text-red-500">{errorRows.length}</span>
                    <span className="text-gray-500">มีข้อผิดพลาด</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-500">{fileName}</span>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100">
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      {["#", "รหัสนักศึกษา", "ชื่อ", "นามสกุล", "Email", "สถานะ"].map((h) => (
                        <th key={h} className="px-5 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row) => (
                      <tr
                        key={row.line}
                        className={row.error ? "bg-red-50/60" : "hover:bg-gray-50/50"}
                      >
                        <td className="px-5 py-3 text-gray-300 text-xs">{row.line}</td>
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{row.studentId || <span className="text-red-300">—</span>}</td>
                        <td className="px-5 py-3 text-[var(--text-primary)]">{row.firstName || <span className="text-red-300">—</span>}</td>
                        <td className="px-5 py-3 text-[var(--text-primary)]">{row.lastName || <span className="text-red-300">—</span>}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{row.email || "—"}</td>
                        <td className="px-5 py-3">
                          {row.error ? (
                            <span className="inline-flex items-center gap-1 text-xs text-red-500">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                              {row.error}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {errorRows.length > 0 && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                แถวที่มีข้อผิดพลาดจะถูกข้ามไป — เฉพาะ {validRows.length} แถวที่ถูกต้องจะถูก import
              </p>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => { setStep("upload"); setRows([]); setFileName(""); }}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ← เลือกไฟล์ใหม่
              </button>
              <div className="flex gap-3">
                <Link href={`/courses/${id}`} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Cancel
                </Link>
                <button
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] disabled:opacity-40 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                  </svg>
                  Import {validRows.length} Students
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP: DONE ─── */}
        {step === "done" && (
          <div className="flex items-center justify-center py-16">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-16 py-14 flex flex-col items-center text-center max-w-md w-full">
              <div className="w-16 h-16 rounded-full bg-[var(--accent-subtle)] flex items-center justify-center mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2DD4BF" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Import สำเร็จ</h2>
              <p className="text-sm text-gray-500 mb-8">
                เพิ่ม <span className="font-semibold text-[var(--text-primary)]">{validRows.length} นักศึกษา</span> เข้า {course.name} เรียบร้อยแล้ว
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setStep("upload"); setRows([]); setFileName(""); }}
                  className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Import เพิ่มเติม
                </button>
                <Link
                  href={`/courses/${id}`}
                  className="px-5 py-2.5 rounded-xl bg-[#2DD4BF] hover:bg-[#14B8A6] text-[var(--text-primary)] text-sm font-medium transition-colors"
                >
                  กลับไปหน้า Course
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    </AppShell>
  );
}
