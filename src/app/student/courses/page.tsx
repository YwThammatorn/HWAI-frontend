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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {enrolledCourses.map((course) => {
              const assignments = getAssignmentsByCourse(course.id);
              return (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/classwork`}
                  className="group flex flex-col bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-subtle)] overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  {/* Banner — solid color, book icon (matches teacher) */}
                  <div className="relative h-28 shrink-0" style={{ background: course.coverColor }}>
                    <div className="absolute bottom-3 left-3 w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                      </svg>
                    </div>
                  </div>

                  {/* Card body — flex column so footer pins to bottom */}
                  <div className="flex flex-col flex-1 p-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-[var(--text-primary)] text-[15px] leading-snug mb-1 line-clamp-2 group-hover:text-[#C2410C] transition-colors">
                        {course.name}
                      </h3>
                      {course.description && (
                        <p className="text-xs text-[var(--text-muted)] line-clamp-2">{course.description}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-3 mt-3">
                      <span className="flex items-center gap-1">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        {assignments.length} {t("งาน", "assignment(s)")}
                      </span>
                      {course.status === "active" ? (
                        <span className="flex items-center gap-1 text-[#F97316]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                            <line x1="16" y1="2" x2="16" y2="6"/>
                            <line x1="8" y1="2" x2="8" y2="6"/>
                            <line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                          {t("เปิดสอน", "Active")}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">{t("เก็บถาวร", "Archived")}</span>
                      )}
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
