"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

export default function StudentCoursesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse } = useAssignments();

  const enrolledCourses = useMemo(() => {
    if (!user?.studentId) return [];
    return students
      .filter((s) => s.studentId === user.studentId)
      .map((s) => {
        const course = getCourse(s.courseId);
        return course ? { ...course, enrollmentId: s.id } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [students, user?.studentId, getCourse]);

  return (
    <div className="p-6 max-w-4xl">
        <PageHeader
          title={t("รายวิชาของฉัน", "My Courses")}
          description={t(`ลงทะเบียน ${enrolledCourses.length} รายวิชา`, `Enrolled in ${enrolledCourses.length} course(s)`)}
        />

        {enrolledCourses.length === 0 ? (
          <EmptyState
            iconColor="#F97316"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            }
            title={t("ยังไม่มีรายวิชา", "No courses yet")}
            description={t("อาจารย์จะเพิ่มคุณเข้าในรายวิชาเมื่อลงทะเบียนแล้ว", "Your instructor will enroll you in courses")}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrolledCourses.map((course) => {
              const assignments = getAssignmentsByCourse(course.id);
              return (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/classwork`}
                  className="group rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  {/* Banner */}
                  <div
                    className="h-24 flex items-end p-4"
                    style={{ background: `linear-gradient(135deg, ${course.coverColor}cc, ${course.coverColor})` }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg">
                      {course.name.charAt(0).toUpperCase()}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h2 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[#C2410C] transition-colors line-clamp-2">{course.name}</h2>
                    {course.description && (
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">{course.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--text-muted)]">
                      <span className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        </svg>
                        {t(`${assignments.length} งาน`, `${assignments.length} assignment(s)`)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        course.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {course.status === "active" ? t("เปิดสอน", "Active") : t("เก็บถาวร", "Archived")}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
    </div>
  );
}
