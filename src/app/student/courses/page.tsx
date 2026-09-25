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
import CourseBanner from "@/components/CourseBanner";
import { useManagedTeachers } from "@/lib/managed-teachers";

export default function StudentCoursesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse } = useAssignments();
  const { getTeachersByCourse } = useManagedTeachers();

  const sourceLabel: Record<string, string> = {
    manual: t("เพิ่มเอง", "Manually Added"),
    google: "Google Classroom",
    teams: "Microsoft Teams",
  };

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
    <div className="w-full px-8 py-8">
        <PageHeader
          title={t("รายวิชาของฉัน", "My Courses")}
          description={t(`ลงทะเบียน ${enrolledCourses.length} รายวิชา`, `Enrolled in ${enrolledCourses.length} course(s)`)}
        />

        {enrolledCourses.length === 0 ? (
          <EmptyState
            iconColor="var(--accent-bright)"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
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
              // Same rule as the teacher card: the code stands alone, Section is its own field below
              const codeLabel = course.code || (course.source === "manual" ? "" : sourceLabel[course.source] ?? course.source);
              const termLabel = course.academicYear && course.term ? `${course.term}/${course.academicYear}` : "—";
              const instructor = getTeachersByCourse(course.id)[0];
              const instructorLabel = instructor ? `${instructor.title ? `${instructor.title} ` : ""}${instructor.name}` : null;
              return (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/classwork`}
                  className="group flex flex-col bg-[var(--bg-surface)] rounded-2xl shadow-sm border border-[var(--border-subtle)] overflow-hidden hover:shadow-md transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                >
                  {/* Banner — colour band carries icon, code and name (same component as the teacher card) */}
                  <CourseBanner
                    coverColor={course.coverColor}
                    icon={course.icon}
                    name={course.name}
                    code={codeLabel}
                    overlay={course.status !== "active" && (
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-white text-xs font-medium bg-black/40 px-2 py-1 rounded-full">{t("เก็บถาวร", "Archived")}</span>
                      </div>
                    )}
                  />

                  {/* Card body — flex column so footer pins to bottom */}
                  <div className="flex flex-col flex-1 p-4">
                    <div className="flex-1">
                      {/* DEEP-QA-style two-column meta row — matches teacher's own course card */}
                      <div className="grid grid-cols-2 gap-3 pb-3 border-b border-[var(--border-subtle)]">
                        <div className="min-w-0">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("กลุ่ม", "Section")}</p>
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.sectionNumber || "—"}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("ภาคเรียนที่", "Term")}</p>
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{termLabel}</p>
                        </div>
                      </div>

                      {instructorLabel && (
                        <p className="pt-2 text-xs text-[var(--text-muted)] truncate">{instructorLabel}</p>
                      )}

                      {(course.schedule || course.room) && (
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="min-w-0">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("วันเวลาเรียน", "Schedule")}</p>
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.schedule || "—"}</p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-0.5">{t("ห้องเรียน", "Room")}</p>
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{course.room || "—"}</p>
                          </div>
                        </div>
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
                        <span className="flex items-center gap-1 text-[var(--accent)]">
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
