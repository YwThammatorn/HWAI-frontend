"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useStudents, isWithdrawn } from "@/lib/students";
import { useCourses, type Course } from "@/lib/courses";
import { useAssignments, studentVisibleSubmission } from "@/lib/assignments";
import { useGradingCategories, computeCategoryGradeRows, computeTotalSoFar } from "@/lib/gradingCategories";
import { gradeLetter, toneForPct, SCORE_TONE_CLASSES } from "@/lib/scoreBook";
import { currentAcademicTerm, courseTermStatus, compareTermsDesc, termHeading } from "@/lib/academicTerm";
import { CourseIcon } from "@/components/CourseIcon";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import CourseBanner from "@/components/CourseBanner";
import { useManagedTeachers } from "@/lib/managed-teachers";

export default function StudentCoursesPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { students } = useStudents();
  const { getCourse } = useCourses();
  const { getAssignmentsByCourse, getSubmissionsByAssignment } = useAssignments();
  const { getCategoriesByCourse } = useGradingCategories();
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
        return course ? { ...course, enrollmentId: s.id, withdrawn: isWithdrawn(s) } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null);
  }, [students, user?.studentId, getCourse]);

  // "My Courses" is the courses of the current term; everything whose term is over (or that the student
  // withdrew from, or an admin archived) moves to "Completed courses", grouped by term. See lib/academicTerm.ts.
  const now = new Date();
  const thisTerm = currentAcademicTerm(now);
  const isPast = (c: (typeof enrolledCourses)[number]) => c.withdrawn || courseTermStatus(c, now) === "past";
  const currentCourses = enrolledCourses.filter((c) => !isPast(c));
  const pastCourses = enrolledCourses.filter(isPast);
  const pastGroups = [...pastCourses.reduce((m, c) => {
    const key = c.academicYear && c.term ? `${c.academicYear}-${c.term}` : "none";
    return m.set(key, [...(m.get(key) ?? []), c]);
  }, new Map<string, typeof pastCourses>())]
    .map(([key, list]) => ({ key, list: [...list].sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => compareTermsDesc(a.list[0], b.list[0]));

  // Final result of a finished course: the same weighted total the Evaluation page shows, from the scores the
  // teacher has announced. null = nothing graded (yet), so no grade is invented.
  const studentId = user?.studentId ?? "";
  function finalResult(courseId: string): { pct: number; letter: string } | null {
    const asg = getAssignmentsByCourse(courseId);
    const subs = asg.flatMap((a) => getSubmissionsByAssignment(a.id).map((s) => studentVisibleSubmission(a, s)));
    const rows = computeCategoryGradeRows(getCategoriesByCourse(courseId), asg, subs, studentId);
    const gradedWeight = rows.filter((r) => r.percent !== null).reduce((n, r) => n + r.category.weight, 0);
    if (gradedWeight <= 0) return null;
    const pct = (computeTotalSoFar(rows) / gradedWeight) * 100;
    return { pct, letter: gradeLetter(pct, 100) };
  }

  return (
    <div className="w-full px-8 py-8">
        <PageHeader
          title={t("รายวิชาของฉัน", "My Courses")}
          description={`${termHeading(thisTerm.year, thisTerm.term, t)} · ${t(`${currentCourses.length} รายวิชา`, `${currentCourses.length} course${currentCourses.length === 1 ? "" : "s"}`)}`}
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
          <>
          <section aria-labelledby="current-courses-heading">
          <h2 id="current-courses-heading" className="text-base font-bold text-[var(--text-primary)] mb-4">
            {t("รายวิชาที่เรียนอยู่", "Current courses")}
          </h2>
          {currentCourses.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] rounded-2xl border border-dashed border-[var(--border-subtle)] px-5 py-6">
              {t("เทอมนี้ยังไม่มีรายวิชาที่ลงเรียน", "You are not enrolled in any course this term.")}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {currentCourses.map((course) => {
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
          </section>

          {/* Completed courses — every finished term, newest first, with the final result */}
          {pastCourses.length > 0 && (
            <section aria-labelledby="past-courses-heading" className="mt-10">
              <div className="flex items-baseline gap-3 mb-4">
                <h2 id="past-courses-heading" className="text-base font-bold text-[var(--text-primary)]">
                  {t("รายวิชาที่เรียนผ่านไปแล้ว", "Completed courses")}
                </h2>
                <span className="text-xs text-[var(--text-muted)] tabular-nums">{pastCourses.length}</span>
              </div>
              <div className="flex flex-col gap-6">
                {pastGroups.map(({ key, list }) => (
                  <div key={key} role="group" aria-label={key === "none" ? t("ไม่ระบุเทอม", "No term") : termHeading(list[0].academicYear!, list[0].term!, t)}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                      {key === "none" ? t("ไม่ระบุเทอม", "No term") : termHeading(list[0].academicYear!, list[0].term!, t)}
                      <span className="ml-2 font-normal normal-case tracking-normal tabular-nums">{t(`${list.length} วิชา`, `${list.length} course${list.length === 1 ? "" : "s"}`)}</span>
                    </p>
                    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-subtle)]">
                      {list.map((course) => (
                        <PastCourseRow key={course.id} course={course} withdrawn={course.withdrawn} result={course.withdrawn ? null : finalResult(course.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          </>
        )}
    </div>
  );
}

function PastCourseRow({ course, withdrawn, result }: { course: Course; withdrawn: boolean; result: { pct: number; letter: string } | null }) {
  const { t } = useLanguage();
  const { getTeachersByCourse } = useManagedTeachers();
  const instructor = getTeachersByCourse(course.id)[0];
  const meta = [
    course.code,
    course.sectionNumber ? `${t("กลุ่ม", "Sec.")} ${course.sectionNumber}` : null,
    instructor ? `${instructor.title ? `${instructor.title} ` : ""}${instructor.name}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/student/courses/${course.id}/classwork`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent-bright)]"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: course.coverColor }} aria-hidden="true">
        <CourseIcon iconKey={course.icon} size={17} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{course.name}</p>
        {meta && <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{meta}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2 text-right">
        {withdrawn ? (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-[var(--s-warn-bg)] text-[var(--s-warn-text)] border border-[var(--s-warn-bd)]">{t("ถอนแล้ว", "Withdrawn")}</span>
        ) : result ? (
          <>
            <span className="text-sm font-semibold tabular-nums text-[var(--text-primary)]" aria-label={t(`คะแนนรวม ${result.pct.toFixed(1)} เปอร์เซ็นต์`, `Total ${result.pct.toFixed(1)} percent`)}>{result.pct.toFixed(1)}%</span>
            <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-lg text-sm font-bold ${SCORE_TONE_CLASSES[toneForPct(result.pct)]}`} aria-label={t(`เกรด ${result.letter}`, `Grade ${result.letter}`)}>{result.letter}</span>
          </>
        ) : (
          <span className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีคะแนน", "No grade yet")}</span>
        )}
      </div>
    </Link>
  );
}
