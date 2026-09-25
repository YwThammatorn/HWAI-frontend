"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import { useAssignments, URGENT_HOURS } from "@/lib/assignments";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { useAnnouncements, announcementReachesCourse } from "@/lib/announcements";
import { CourseIcon } from "@/components/CourseIcon";
import StudentCalendar, { StudentCalendarItem } from "@/components/StudentCalendar";
import { ANNOUNCEMENTS_DISABLED } from "@/lib/featureFlags";

function fmtAnnouncementDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function StudentHome() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { getTeachersByCourse } = useManagedTeachers();
  const { announcements } = useAnnouncements();

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
        if (!a.dueDate) return; // an Exam has no deadline and nothing to submit
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

  const calendarItems = useMemo(() => {
    const now = Date.now();
    const items: StudentCalendarItem[] = [];

    enrolledCourses.forEach((course) => {
      const assignments = getAssignmentsByCourse(course.id);
      assignments.forEach((a) => {
        if (!a.dueDate) return; // an Exam has no date to put on the calendar
        const due = new Date(a.dueDate + "T23:59:59");
        const allSubs = getSubmissionsByAssignment(a.id);
        const mySub = allSubs.find(
          (s) => s.studentId === (user?.studentId ?? user?.email ?? "")
        );
        const isDone = mySub?.status === "graded" || mySub?.status === "not_graded";
        items.push({
          date: a.dueDate,
          assignmentId: a.id,
          name: a.name,
          courseId: course.id,
          courseName: course.name,
          isOverdue: due.getTime() < now && !isDone,
        });
      });
    });

    return items;
  }, [enrolledCourses, getAssignmentsByCourse, getSubmissionsByAssignment, user]);

  const recentAnnouncements = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; title: string; body: string; createdAt: string; courseId: string; courseName: string }[] = [];

    enrolledCourses.forEach((course) => {
      announcements
        .filter((a) => announcementReachesCourse(a, course))
        .forEach((a) => {
          if (seen.has(a.id)) return;
          seen.add(a.id);
          items.push({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt, courseId: course.id, courseName: course.name });
        });
    });

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  }, [enrolledCourses, announcements]);

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
            {/* Announcements — aggregated across all enrolled courses (hidden, see featureFlags.ts) */}
            {!ANNOUNCEMENTS_DISABLED && (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
                <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">{t("ประกาศ", "Announcements")}</h2>

                {recentAnnouncements.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">{t("ยังไม่มีประกาศ", "No announcements yet")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentAnnouncements.map((item) => (
                      <Link
                        key={item.id}
                        href={`/student/courses/${item.courseId}/announcements`}
                        className="flex flex-col gap-1 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-bright)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.title}</p>
                          <span className="shrink-0 text-xs text-[var(--text-muted)]">{fmtAnnouncementDate(item.createdAt, lang)}</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] truncate">{item.body}</p>
                        <span className="inline-flex items-center self-start px-2 py-0.5 rounded-full bg-[var(--accent-bright)]/15 text-[var(--accent)] text-[10px] font-semibold mt-0.5">
                          {item.courseName}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming assignments */}
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] mb-4">{t("งานที่ต้องส่งเร็วๆ นี้", "Upcoming assignments")}</h2>

              {upcomingAssignments.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีงานที่ค้างอยู่", "No pending assignments")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingAssignments.map((item) => {
                    const isUrgent = item.hoursLeft < URGENT_HOURS;
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
            <StudentCalendar items={calendarItems} />
          </div>
        </div>
    </div>
  );
}
