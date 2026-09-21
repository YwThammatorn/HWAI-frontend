"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";
import { useCohortStudents } from "@/lib/cohort-students";
import { useLanguage } from "@/context/LanguageContext";
import EnrollStudentModal from "@/components/EnrollStudentModal";

export default function StudentsRosterPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const [addOpen, setAddOpen] = useState(false);

  const course = getCourse(id);
  const students = getStudentsByCourse(id);

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
            <Link
              href={`/teacher/courses/${id}/students/import`}
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              {t("นำเข้าด้วย CSV", "Import CSV")}
            </Link>
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
                <Link
                  href={`/teacher/courses/${id}/students/import`}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium rounded-xl transition-colors"
                >
                  {t("นำเข้านักศึกษา", "Import Students")}
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="px-6 py-4 border-b border-gray-50">
                <p className="text-sm text-gray-500">{students.length} {t("นักศึกษา", "students")}</p>
              </div>
              <div className="overflow-x-auto">
                {/* Same column layout as the admin Students tab: ID · Title · Name (first + last together) · Email.
                    The honorific lives on the central student record, so it is looked up by student ID. */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)]">
                      {[
                        { key: "no", label: "#" },
                        { key: "id", label: t("รหัสนักศึกษา", "Student ID") },
                        { key: "title", label: t("คำนำหน้า", "Title") },
                        { key: "name", label: t("ชื่อ-นามสกุล", "Name") },
                        { key: "email", label: t("อีเมล", "Email") },
                      ].map((col) => (
                        <th key={col.key} scope="col" className="px-4 py-2 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s, i) => (
                      <tr key={s.id} className="border-b border-[var(--border-subtle)] transition-colors hover:bg-[var(--bg-subtle)]">
                        <td className="px-4 py-2 text-xs text-[var(--text-muted)] tabular-nums">{i + 1}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)] tabular-nums">{s.studentId}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{findByStudentId(s.studentId)?.title || "-"}</td>
                        <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{s.firstName} {s.lastName}</td>
                        <td className="px-4 py-2 text-[var(--text-secondary)]">{s.email || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {addOpen && <EnrollStudentModal courseId={id} courseName={course.name} onClose={() => setAddOpen(false)} />}
      </main>
  );
}
