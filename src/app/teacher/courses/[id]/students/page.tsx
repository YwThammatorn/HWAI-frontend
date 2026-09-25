"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents, type Student } from "@/lib/students";
import { useCohortStudents } from "@/lib/cohort-students";
import { useLanguage } from "@/context/LanguageContext";
import EnrollStudentModal from "@/components/EnrollStudentModal";
import ImportCourseStudentsModal from "@/components/ImportCourseStudentsModal";
import SearchInput from "@/components/SearchInput";
import SortableTh from "@/components/SortableTh";

type RosterSort = { key: "id" | "name"; dir: "asc" | "desc" } | null;

export default function StudentsRosterPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse, updateStudent, removeStudent } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Click a header to sort: ascending → descending → back to roster order (the default).
  const [sort, setSort] = useState<RosterSort>(null);
  function cycleSort(key: "id" | "name") {
    setSort((s) => (!s || s.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  }

  const course = getCourse(id);
  const students = getStudentsByCourse(id);
  // "#" is the student's place on the roster, so it must not change while sorting or filtering.
  const rosterNo = new Map(students.map((s, i) => [s.id, i + 1]));

  // Display-only full names for the 3 known abbreviations (same map as admin/users.tsx — `program`
  // isn't FK-enforced, see CohortStudent.program, so this is deliberately duplicated per-page rather
  // than shared); falls back to the raw value for anything else.
  const PROGRAM_LABEL: Record<string, string> = {
    CE: t("วิศวกรรมคอมพิวเตอร์", "Computer Engineering"),
    CECS: t("วิศวกรรมคอมพิวเตอร์และความมั่นคงปลอดภัยไซเบอร์", "Computer Engineering and Cybersecurity"),
    CEI: t("วิศวกรรมคอมพิวเตอร์นานาชาติ", "Computer Engineering International"),
  };

  // Status (22-23/9/2569): per-section enrollment status, NOT CohortStudent.status (account-level
  // active/inactive — a different field, see lib/students.ts's own comment on enrollmentStatus). The
  // teacher toggles between "enrolled" and "withdrawn"; "added-midterm" is a historical marker
  // addStudents() already sets on its own (roster non-empty at add time) and isn't a toggle target —
  // re-enrolling from withdrawn always lands on plain "enrolled".
  function statusLabel(status: Student["enrollmentStatus"]) {
    if (status === "withdrawn") return t("ถอนแล้ว", "Withdrawn");
    if (status === "added-midterm") return t("เพิ่มกลางเทอม", "Added mid-term");
    return t("ลงทะเบียน", "Enrolled");
  }
  function statusToneClasses(status: Student["enrollmentStatus"]) {
    if (status === "withdrawn") return "bg-[var(--s-err-bg)] text-[var(--s-err-text)] border-[var(--s-err-bd)]";
    if (status === "added-midterm") return "bg-[var(--s-info-bg)] text-[var(--s-info-text)] border-[var(--s-info-bd)]";
    return "bg-[var(--s-ok-bg)] text-[var(--s-ok-text)] border-[var(--s-ok-bd)]";
  }
  function handleWithdraw(s: Student) {
    if (!window.confirm(t(`ถอน ${s.firstName} ${s.lastName} ออกจากวิชานี้?`, `Withdraw ${s.firstName} ${s.lastName} from this course?`))) return;
    updateStudent(s.id, { enrollmentStatus: "withdrawn" });
  }
  function handleReEnroll(s: Student) {
    updateStudent(s.id, { enrollmentStatus: "enrolled" });
  }
  function handleDelete(s: Student) {
    if (!window.confirm(t(`ลบ ${s.firstName} ${s.lastName} ออกจากรายชื่อนักศึกษาถาวร?`, `Permanently remove ${s.firstName} ${s.lastName} from this course's roster?`))) return;
    removeStudent(s.id);
  }

  const q = search.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (!q) return true;
    const title = findByStudentId(s.studentId)?.title ?? "";
    return [s.studentId, title, s.firstName, s.lastName, `${s.firstName} ${s.lastName}`, s.email ?? ""]
      .some((f) => f.toLowerCase().includes(q));
  });
  if (sort) {
    visible.sort((a, b) => {
      const cmp = sort.key === "name"
        ? `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "th")
        : a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
    );
  }

  return (
      <main className="w-full px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="inline -mt-0.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("นักศึกษา", "Students")}</span>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("รายชื่อนักศึกษา", "Student Roster")}</h1>
            <p className="text-sm text-gray-500">{course.name}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              {t("นำเข้าด้วย CSV", "Import CSV")}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium rounded-xl transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t("เพิ่มนักศึกษา", "Add Student")}
            </button>
          </div>
        </div>

        {students.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ค้นหานักศึกษา...", "Search students...")}
              ariaLabel={t("ค้นหานักศึกษา", "Search students")}
              className="w-64 shrink-0"
              suggestions={students.flatMap((s) => [`${s.firstName} ${s.lastName}`, s.studentId])}
            />
            <p aria-live="polite" className="text-sm text-[var(--text-muted)]">
              {q
                ? t(`พบ ${visible.length} จาก ${students.length} นักศึกษา`, `${visible.length} of ${students.length} students`)
                : `${students.length} ${t("นักศึกษา", "students")}`}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {students.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">{t("ยังไม่มีรายชื่อนักศึกษา", "No students yet")}</p>
              <p className="text-xs text-gray-500 mb-5">
                {t("เพิ่มทีละคนด้วยรหัสนักศึกษา หรือนำเข้าจากไฟล์ CSV — ระบบจะตรวจสอบกับรายชื่อนักศึกษาที่มีอยู่ในระบบก่อนเพิ่มเข้าวิชา", "Add a student by ID, or import a CSV file — the system checks each ID against the existing student database before enrolling")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium rounded-xl transition-colors"
                >
                  {t("เพิ่มนักศึกษา", "Add Student")}
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                >
                  {t("นำเข้านักศึกษา", "Import Students")}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="overflow-x-auto">
                {/* Same base column layout as the admin Students tab: ID · Title · Name (first + last
                    together) · Email. The honorific and Program live on the central student record, so
                    they're looked up by student ID. Status/Actions added 23/9/2569; Cohort column
                    dropped 23/9/2569 (unused — the sidebar already scopes to one course/cohort). */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">#</th>
                      <SortableTh label={t("รหัสนักศึกษา", "Student ID")} dir={sort?.key === "id" ? sort.dir : undefined} onClick={() => cycleSort("id")}
                        hint={t("คลิกเพื่อเรียงตามรหัส (น้อย→มาก → มาก→น้อย → ลำดับเดิม)", "Click to sort by student ID (ascending → descending → roster order)")} />
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("คำนำหน้า", "Title")}</th>
                      <SortableTh label={t("ชื่อ-นามสกุล", "Name")} dir={sort?.key === "name" ? sort.dir : undefined} onClick={() => cycleSort("name")}
                        hint={t("คลิกเพื่อเรียงตามชื่อ (ก–ฮ → ฮ–ก → ลำดับเดิม)", "Click to sort by name (A–Z → Z–A → roster order)")} />
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("อีเมล", "Email")}</th>
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สาขา", "Program")}</th>
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("สถานะ", "Status")}</th>
                      <th scope="col" className="px-4 py-1 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{t("จัดการ", "Actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{t("ไม่พบผลการค้นหา", "No results found")}</td>
                      </tr>
                    )}
                    {visible.map((s) => {
                      const status = s.enrollmentStatus ?? "enrolled";
                      const withdrawn = status === "withdrawn";
                      return (
                        <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-b-0 transition-colors hover:bg-[var(--bg-subtle)]">
                          <td className="px-4 py-2 text-xs text-[var(--text-muted)] tabular-nums">{rosterNo.get(s.id)}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)] tabular-nums">{s.studentId}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{findByStudentId(s.studentId)?.title || "-"}</td>
                          <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{s.firstName} {s.lastName}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{s.email || "—"}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {(() => { const p = findByStudentId(s.studentId)?.program; return p ? (PROGRAM_LABEL[p] ?? p) : "—"; })()}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusToneClasses(status)}`}>
                              {statusLabel(status)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              {withdrawn ? (
                                <button
                                  type="button"
                                  onClick={() => handleReEnroll(s)}
                                  aria-label={t(`ลงทะเบียนกลับ ${s.firstName} ${s.lastName}`, `Re-enroll ${s.firstName} ${s.lastName}`)}
                                  title={t("ลงทะเบียนกลับ", "Re-enroll")}
                                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-ok-text)] hover:bg-[var(--s-ok-bg)] transition-colors"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12"/>
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleWithdraw(s)}
                                  aria-label={t(`ถอน ${s.firstName} ${s.lastName}`, `Withdraw ${s.firstName} ${s.lastName}`)}
                                  title={t("ถอนออกจากวิชา", "Withdraw")}
                                  className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-warn-text)] hover:bg-[var(--s-warn-bg)] transition-colors"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                                  </svg>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDelete(s)}
                                aria-label={t(`ลบ ${s.firstName} ${s.lastName} ออกจากวิชา`, `Remove ${s.firstName} ${s.lastName} from the course`)}
                                title={t("ลบออกจากวิชา", "Remove")}
                                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--s-err-text)] hover:bg-[var(--s-err-bg)] transition-colors"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {addOpen && <EnrollStudentModal courseId={id} courseName={course.name} onClose={() => setAddOpen(false)} />}
        {importOpen && <ImportCourseStudentsModal courseId={id} courseName={course.name} onClose={() => setImportOpen(false)} />}
      </main>
  );
}
