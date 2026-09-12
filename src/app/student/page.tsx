"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";
import { useManagedTeachers } from "@/lib/managed-teachers";
import EmptyState from "@/components/EmptyState";
import { CourseIcon } from "@/components/CourseIcon";

export default function StudentHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { getTeachersByCourse } = useManagedTeachers();

  const sourceLabel: Record<string, string> = {
    manual: t("เพิ่มเอง", "Manually Added"),
    google: "Google Classroom",
    teams: "Microsoft Teams",
  };

  const firstName = user?.name.split(" ")[0] ?? "";

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

  const upcomingAssignments = useMemo(() => {
    const now = Date.now();
    const items: { assignmentId: string; name: string; dueDate: string; courseId: string; courseName: string; hoursLeft: number }[] = [];

    enrolledCourses.forEach((course) => {
      const assignments = getAssignmentsByCourse(course.id);
      assignments.forEach((a) => {
        const due = new Date(a.dueDate + "T23:59:59");
        const hoursLeft = (due.getTime() - now) / 3_600_000;
        if (hoursLeft <= 0) return;

        const allSubs = getSubmissionsByAssignment(a.id);
        const mySub = allSubs.find(
          (s) => s.studentId === (user?.studentId ?? user?.email ?? "")
        );
        if (mySub?.status === "graded" || mySub?.status === "not_graded") return;

        items.push({ assignmentId: a.id, name: a.name, dueDate: a.dueDate, courseId: course.id, courseName: course.name, hoursLeft });
      });
    });

    return items.sort((a, b) => a.hoursLeft - b.hoursLeft).slice(0, 5);
  }, [enrolledCourses, getAssignmentsByCourse, getSubmissionsByAssignment, user]);

  return (
    <div className="p-6 w-full">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t(`สวัสดี, ${firstName}`, `Hi, ${firstName}`)} 👋
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t("ยินดีต้อนรับเข้าสู่พอร์ทัลนักศึกษา HWAI", "Welcome to the HWAI Student Portal")}
        </p>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Upcoming assignments */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">{t("งานที่ต้องส่งเร็วๆ นี้", "Upcoming assignments")}</h2>

              {upcomingAssignments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีงานที่ค้างอยู่", "No pending assignments")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingAssignments.map((item) => {
                    const isUrgent = item.hoursLeft < 48;
                    const due = new Date(item.dueDate + "T23:59:59");
                    return (
                      <Link
                        key={item.assignmentId}
                        href={`/student/courses/${item.courseId}/classwork/${item.assignmentId}`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${isUrgent ? "bg-[var(--danger-solid)]" : "bg-[var(--accent-bright)]"}`} aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{item.courseName}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-xs font-semibold ${isUrgent ? "text-[var(--s-err-text)]" : "text-[var(--text-muted)]"}`}>
                            {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </p>
                          {isUrgent && (
                            <p className="text-[10px] text-[var(--s-err-text)]">
                              {item.hoursLeft < 24
                                ? t("< 24 ชม.", "< 24h left")
                                : t("< 2 วัน", "< 2 days")}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Enrolled courses quick links */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">{t("รายวิชาของฉัน", "My Courses")}</h2>

              {enrolledCourses.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ยังไม่มีรายวิชา", "No enrolled courses yet")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {enrolledCourses.map((course) => {
                    const assignments = getAssignmentsByCourse(course.id);
                    const codeLabel = course.code
                      ? course.sectionNumber
                        ? `${course.code} · ${t("กลุ่ม", "Sec.")} ${course.sectionNumber}`
                        : course.code
                      : sourceLabel[course.source] ?? course.source;
                    const termLabel = course.academicYear && course.term ? `${course.term}/${course.academicYear}` : null;
                    const instructor = getTeachersByCourse(course.id)[0];
                    const instructorLabel = instructor ? `${instructor.title ? `${instructor.title} ` : ""}${instructor.name}` : null;
                    const roomLabel = course.room ? t(`ห้อง ${course.room}`, `Room ${course.room}`) : null;
                    return (
                      <Link
                        key={course.id}
                        href={`/student/courses/${course.id}/classwork`}
                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: course.coverColor }}
                          aria-hidden="true"
                        >
                          <CourseIcon iconKey={course.icon} size={17} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{course.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                            <span className="truncate">{codeLabel}</span>
                            {termLabel && (<><span aria-hidden="true">·</span><span>{termLabel}</span></>)}
                            <span aria-hidden="true">·</span>
                            <span>{t(`${assignments.length} งาน`, `${assignments.length} assignment(s)`)}</span>
                          </div>
                          {(instructorLabel || course.schedule || roomLabel) && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                              {instructorLabel && <span className="truncate">{instructorLabel}</span>}
                              {instructorLabel && (course.schedule || roomLabel) && <span aria-hidden="true">·</span>}
                              {course.schedule && <span>{course.schedule}</span>}
                              {course.schedule && roomLabel && <span aria-hidden="true">·</span>}
                              {roomLabel && <span>{roomLabel}</span>}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {course.status === "active" ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-bright)]/15 text-[var(--accent)]">
                              {t("เปิดสอน", "Active")}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                              {t("เก็บถาวร", "Archived")}
                            </span>
                          )}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--text-muted)]" aria-hidden="true">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Calendar */}
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
            <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">{t("ปฏิทิน", "Calendar")}</h2>
            <EmptyState
              iconColor="var(--accent-bright)"
              icon={
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              }
              title={t("ฟีเจอร์นี้จะมาเร็วๆ นี้", "Coming soon")}
              description={t("ปฏิทินจะแสดงวันส่งงานทุกรายวิชาในที่เดียว", "All assignment due dates in one place")}
            />
          </div>
        </div>
    </div>
  );
}
