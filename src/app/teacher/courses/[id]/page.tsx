"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/lib/courses";
import { useStudents } from "@/lib/students";
import { useAssignments } from "@/lib/assignments";
import { useLanguage } from "@/context/LanguageContext";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getCourse } = useCourses();
  const { getStudentsByCourse } = useStudents();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const course = getCourse(id);
  const students = getStudentsByCourse(id);
  const assignments = getAssignmentsByCourse(id);

  const activeAssignments = assignments.filter((a) => {
    const subs = getSubmissionsByAssignment(a.id);
    return subs.length > 0 && subs.some((s) => s.status !== "graded");
  }).length;
  const allGraded =
    assignments.length > 0 &&
    assignments.every((a) => {
      const subs = getSubmissionsByAssignment(a.id);
      return subs.length > 0 && subs.every((s) => s.status === "graded");
    });

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
          <Link href="/teacher/courses" className="hover:text-[var(--accent)] transition-colors">{t("รายวิชาทั้งหมด", "All Courses")}</Link>
          <span>/</span>
          <span className="text-[var(--text-primary)] font-medium">{course.name}</span>
        </div>

        {/* Course header banner */}
        <div className="relative h-36 rounded-2xl mb-6 overflow-hidden" style={{ background: course.coverColor }}>
          <div className="absolute inset-0 bg-black/10" />
          <div className="absolute bottom-4 left-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{course.name}</h1>
              {course.description && (
                <p className="text-white/70 text-xs mt-0.5 max-w-md truncate">{course.description}</p>
              )}
            </div>
          </div>
          <Link
            href={`/teacher/courses/${id}/settings`}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-medium rounded-lg transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v2M7 11v2M1 7h2M11 7h2M3.22 3.22l1.41 1.41M9.37 9.37l1.41 1.41M3.22 10.78l1.41-1.41M9.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            {t("ตั้งค่า", "Settings")}
          </Link>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t("นักศึกษา", "Students"), value: `${students.length}` },
            { label: t("ชิ้นงาน", "Assignments"), value: `${assignments.length}` },
            { label: t("สถานะการตรวจ", "Grading Status"), value: allGraded ? t("ตรวจครบแล้ว", "All Graded") : `${activeAssignments} ${t("กำลังดำเนินการ", "Active")}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex border-b border-gray-100 px-6">
            <Link
              href={`/teacher/courses/${id}/assignments`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("ชิ้นงาน", "Assignments")}
              {assignments.length > 0 && (
                <span className="ml-1.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                  {assignments.length}
                </span>
              )}
            </Link>
            <Link
              href={`/teacher/courses/${id}/weekly-plan`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("แผนการสอน", "Teaching Plan")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/materials`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("สื่อการสอน", "Materials")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/announcements`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("ประกาศ", "Announcements")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/clo`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("วางแผนรายวิชา", "Course Planning")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/students`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("นักศึกษา", "Students")}
              {students.length > 0 && (
                <span className="ml-1.5 text-xs bg-[var(--accent-subtle)] text-[var(--accent)] px-1.5 py-0.5 rounded-full">
                  {students.length}
                </span>
              )}
            </Link>
            <Link
              href={`/teacher/courses/${id}/collaborators`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("ผู้ร่วมงาน", "Collaborators")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/results`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("ผลลัพธ์", "Results")}
            </Link>
            <Link
              href={`/teacher/courses/${id}/grading-split`}
              className="py-3 px-4 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-[var(--accent)] transition-colors"
            >
              {t("แบ่งงานตรวจ", "Grading Split")}
            </Link>
          </div>
        </div>
      </main>
  );
}
