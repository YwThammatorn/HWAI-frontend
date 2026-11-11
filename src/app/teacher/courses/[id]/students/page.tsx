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
import { useSectionProgram } from "@/lib/sectionProgram";

import Icon from "@/components/Icon";
import IconTile from "@/components/IconTile";
import IconButton from "@/components/IconButton";
type RosterSort = { key: "id" | "name"; dir: "asc" | "desc" } | null;

export default function StudentsRosterPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse, updateStudent, removeStudent } = useStudents();
  const { findByStudentId } = useCohortStudents();
  // One section = one program (4/10/2569): who this section is for, and anyone already on the roster who isn't.
  const { section, mismatched } = useSectionProgram(id);
  const mismatchedIds = new Set(mismatched.map((m) => m.studentId));
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Click a header to sort: ascending → descending → back to roster order (the default: by student ID).
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
  // teacher toggles between "enrolled" and "withdrawn" (there is no "added mid-term" mark any more, 7/11/2569).
  function statusLabel(status: Student["enrollmentStatus"]) {
    if (status === "withdrawn") return t("ถอนแล้ว", "Withdrawn");
    return t("ลงทะเบียน", "Enrolled");
  }
  // Status is a read-only fact, so it is a dot + coloured text; a filled, bordered pill read as a button here
  function statusToneClasses(status: Student["enrollmentStatus"]) {
    if (status === "withdrawn") return { text: "text-[var(--s-err-text)]", dot: "bg-[var(--s-err-text)]" };
    return { text: "text-[var(--s-ok-text)]", dot: "bg-[var(--s-ok-text)]" };
  }
  function handleWithdraw(s: Student) {
    if (!window.confirm(t(`ถอน ${s.name} ออกจากวิชานี้?`, `Withdraw ${s.name} from this course?`))) return;
    updateStudent(s.id, { enrollmentStatus: "withdrawn" });
  }
  function handleReEnroll(s: Student) {
    updateStudent(s.id, { enrollmentStatus: "enrolled" });
  }
  function handleDelete(s: Student) {
    if (!window.confirm(t(`ลบ ${s.name} ออกจากรายชื่อนักศึกษาถาวร?`, `Permanently remove ${s.name} from this course's roster?`))) return;
    removeStudent(s.id);
  }

  const q = search.trim().toLowerCase();
  const visible = students.filter((s) => {
    if (!q) return true;
    const title = findByStudentId(s.studentId)?.title ?? "";
    return [s.studentId, title, s.name, s.email ?? ""]
      .some((f) => f.toLowerCase().includes(q));
  });
  if (sort) {
    visible.sort((a, b) => {
      const cmp = sort.key === "name"
        ? a.name.localeCompare(b.name, "th")
        : a.studentId.localeCompare(b.studentId, undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }

  if (!course) {
    return (
        <main className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
          {t("ไม่พบรายวิชานี้", "Course not found")} —{" "}
          <Link href="/teacher/courses" className="text-[var(--accent)] ml-1 hover:underline">{t("กลับไปหน้าหลัก", "Back to home")}</Link>
        </main>
    );
  }

  return (
      <main className="w-full px-8 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] mb-6">
          <IconButton icon="home" label={t("รายวิชาทั้งหมด", "All courses")} href="/teacher/courses" />
          <span>/</span>
          <Link href={`/teacher/courses/${id}`} className="hover:text-[var(--accent)] transition-colors">{course.name}</Link>
          <span>/</span>
          <span className="text-[var(--accent)] font-medium">{t("นักศึกษา", "Students")}</span>
        </div>

        {/* Title */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">{t("รายชื่อนักศึกษา", "Student Roster")}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {course.name}
              {section && (
                <span className="ml-2 text-sm font-semibold text-[var(--text-secondary)]" title={t("section นี้รับเฉพาะนักศึกษาหลักสูตรนี้", "This section only takes students from this program")}>
                  {t("หลักสูตร", "Program")} {section.program}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm font-medium rounded-xl transition-colors"
            >
              <Icon name="file-plus" />
              {t("นำเข้าจาก Excel", "Import Excel")}
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[var(--accent-solid)] hover:bg-[var(--accent-solid-hover)] text-[var(--accent-solid-text)] text-sm font-medium rounded-xl transition-colors"
            >
              <Icon name="plus" />
              {t("เพิ่มนักศึกษา", "Add Student")}
            </button>
          </div>
        </div>

        {mismatched.length > 0 && section && (
          <p role="note" data-testid="program-mismatch" className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--s-warn-bd)] bg-[var(--s-warn-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--s-warn-text)]">
            <span>
              {t(
                `มี ${mismatched.length} คนในรายชื่อที่ไม่ใช่หลักสูตร ${section.program} (ดูแถวที่ติดป้ายสีส้ม) — หนึ่ง section รับนักศึกษาจากหลักสูตรเดียวเท่านั้น ควรลบออกจากวิชานี้`,
                `${mismatched.length} student${mismatched.length === 1 ? " on" : "s on"} this roster ${mismatched.length === 1 ? "is" : "are"} not in ${section.program} (see the orange-tagged rows) — a section only takes students from one program, so they should be removed from this course.`,
              )}
            </span>
          </p>
        )}

        {students.length > 0 && (
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t("ค้นหานักศึกษา...", "Search students...")}
              ariaLabel={t("ค้นหานักศึกษา", "Search students")}
              className="w-64 shrink-0"
              suggestions={students.flatMap((s) => [s.name, s.studentId])}
            />
            <p aria-live="polite" className="text-sm text-[var(--text-muted)]">
              {q
                ? t(`พบ ${visible.length} จาก ${students.length} นักศึกษา`, `${visible.length} of ${students.length} students`)
                : `${students.length} ${t("นักศึกษา", "students")}`}
            </p>
          </div>
        )}

        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
          {students.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <IconTile icon="users" size="lg" tone="accent" className="mb-4" />
              <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">{t("ยังไม่มีรายชื่อนักศึกษา", "No students yet")}</p>
              <p className="text-xs text-[var(--text-secondary)] mb-5">
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
                  className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] text-sm font-medium rounded-xl transition-colors"
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
                          <td className="px-4 py-2 whitespace-nowrap text-[var(--text-secondary)]">{findByStudentId(s.studentId)?.title || "-"}</td>
                          <td className="px-4 py-2 whitespace-nowrap font-medium text-[var(--text-primary)]">{s.name}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">{s.email || "—"}</td>
                          <td className="px-4 py-2 text-[var(--text-secondary)]">
                            {/* One line whatever the program's name (15/10/2569): the full name is cut with "…" and shown whole on hover; the "Not CE" tag never wraps. */}
                            {(() => {
                              const p = findByStudentId(s.studentId)?.program;
                              const full = p ? (PROGRAM_LABEL[p] ?? p) : "—";
                              return (
                                <div className="flex items-center gap-2 max-w-[15rem]">
                                  <span className="truncate" title={full}>{full}</span>
                                  {mismatchedIds.has(s.studentId) && section && (
                                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-[var(--s-warn-text)]">
                                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--s-warn-text)]" aria-hidden="true" />
                                      {t(`ไม่ใช่ ${section.program}`, `Not ${section.program}`)}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusToneClasses(status).text}`}>
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusToneClasses(status).dot}`} aria-hidden="true" />
                              {statusLabel(status)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              {withdrawn ? (
                                <IconButton icon="check" label={t(`ลงทะเบียนกลับ ${s.name}`, `Re-enroll ${s.name}`)} onClick={() => handleReEnroll(s)} />
                              ) : (
                                <IconButton icon="ban" label={t(`ถอน ${s.name}`, `Withdraw ${s.name}`)} tone="warn" onClick={() => handleWithdraw(s)} />
                              )}
                              <IconButton icon="trash" label={t(`ลบ ${s.name} ออกจากวิชา`, `Remove ${s.name} from the course`)} tone="danger" onClick={() => handleDelete(s)} />
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
