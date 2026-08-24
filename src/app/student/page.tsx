"use client";

import { useMemo } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useStudents } from "@/lib/students";
import { useCourses } from "@/lib/courses";
import { useAssignments } from "@/lib/assignments";

export default function StudentHome() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();

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
    <StudentShell>
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {t(`สวัสดี, ${firstName}`, `Hi, ${firstName}`)} 👋
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t("ยินดีต้อนรับเข้าสู่พอร์ทัลนักศึกษา HWAI", "Welcome to the HWAI Student Portal")}
        </p>

        {/* Upcoming assignments */}
        <div className="mt-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
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
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${isUrgent ? "bg-red-400" : "bg-[#F97316]"}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.courseName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-semibold ${isUrgent ? "text-red-500" : "text-[var(--text-muted)]"}`}>
                        {due.toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </p>
                      {isUrgent && (
                        <p className="text-[10px] text-red-400">
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
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{t("รายวิชาของฉัน", "My Courses")}</h2>
            {enrolledCourses.length > 0 && (
              <Link href="/student/courses" className="text-xs text-[#F97316] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316] rounded">
                {t("ดูทั้งหมด →", "View all →")}
              </Link>
            )}
          </div>

          {enrolledCourses.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t("ยังไม่มีรายวิชา", "No enrolled courses yet")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {enrolledCourses.slice(0, 4).map((course) => (
                <Link
                  key={course.id}
                  href={`/student/courses/${course.id}/classwork`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ background: course.coverColor }}
                    aria-hidden="true"
                  >
                    {course.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{course.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {t(
                        course.status === "active" ? "เปิดสอน" : "เก็บถาวร",
                        course.status === "active" ? "Active" : "Archived"
                      )}
                    </p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-[var(--text-muted)] shrink-0" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
