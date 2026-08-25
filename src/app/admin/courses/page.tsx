"use client";

import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCourses, Course } from "@/lib/courses";
import { useManagedTeachers } from "@/lib/managed-teachers";
import { getInitials } from "@/lib/utils";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import { useCohortStudents } from "@/lib/cohort-students";
import { useStudents } from "@/lib/students";

// ---- Assign panel for one course ----

function CourseAssignPanel({ course }: { course: Course }) {
  const { t } = useLanguage();
  const { teachers, assignToCourse, unassignFromCourse, getTeachersByCourse } = useManagedTeachers();
  const { getCohorts, getStudentsByCohort } = useCohortStudents();
  const { addStudents, getStudentsByCourse } = useStudents();

  const assignedTeachers = getTeachersByCourse(course.id);
  const enrolledStudents = getStudentsByCourse(course.id);
  const cohorts = getCohorts();
  const [selectedCohort, setSelectedCohort] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrolledMsg, setEnrolledMsg] = useState("");

  function toggleTeacher(teacherId: string, assigned: boolean) {
    if (assigned) unassignFromCourse(teacherId, course.id);
    else assignToCourse(teacherId, course.id);
  }

  function handleEnroll() {
    if (!selectedCohort) return;
    setEnrolling(true);
    const cohortStudents = getStudentsByCohort(selectedCohort);
    const existing = new Set(enrolledStudents.map((s) => s.studentId));
    const toAdd = cohortStudents
      .filter((cs) => !existing.has(cs.studentId))
      .map(({ studentId, firstName, lastName, email, cohort }) => ({
        studentId, firstName, lastName, email, cohort,
      }));
    addStudents(course.id, toAdd);
    setEnrolling(false);
    setEnrolledMsg(
      t(
        `เพิ่มนักศึกษา ${toAdd.length} คน (${selectedCohort}) เข้ารายวิชาแล้ว`,
        `Enrolled ${toAdd.length} student(s) from ${selectedCohort}`
      )
    );
    setTimeout(() => setEnrolledMsg(""), 4000);
  }

  const TEACHER_ROLE_LABEL: Record<"teacher" | "ta", string> = {
    teacher: t("อาจารย์", "Teacher"),
    ta: "TA",
  };

  const NO_COHORT_LABEL = t("เลือก cohort…", "Select cohort…");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[var(--bg-app)] rounded-b-2xl border-t border-[var(--border-subtle)]">

      {/* Left: Teacher assignment */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("อาจารย์ผู้สอน", "Teaching Staff")}</p>
        {teachers.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มีอาจารย์ในระบบ — ไปเพิ่มที่หน้าจัดการอาจารย์", "No teachers yet — add them first")}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {teachers.map((teacher) => {
              const assigned = assignedTeachers.some((a) => a.id === teacher.id);
              return (
                <label
                  key={teacher.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={assigned}
                    onChange={() => toggleTeacher(teacher.id, assigned)}
                    className="w-4 h-4 accent-[#0F766E] cursor-pointer"
                  />
                  <div className="w-7 h-7 rounded-full bg-[#2DD4BF]/20 flex items-center justify-center text-[#0F766E] text-[10px] font-bold shrink-0 select-none" aria-hidden="true">
                    {getInitials(teacher.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{teacher.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{TEACHER_ROLE_LABEL[teacher.role]}</p>
                  </div>
                  {assigned && (
                    <span className="text-xs font-semibold text-[#0F766E] bg-[#2DD4BF]/10 px-2 py-0.5 rounded-full shrink-0">
                      {t("Assigned", "Assigned")}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Cohort enrollment */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{t("นักศึกษาที่ลงทะเบียน", "Enrolled Students")}</p>

        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
          </svg>
          <span className="text-sm font-bold text-[#0F766E] tabular-nums">{enrolledStudents.length}</span>
          <span className="text-xs text-[var(--text-muted)]">{t("คน", "student(s)")}</span>
        </div>

        {cohorts.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">{t("ยังไม่มี cohort — นำเข้าจากหน้าจัดการนักศึกษาก่อน", "No cohorts yet — import students first")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--text-muted)]">{t("เพิ่มนักศึกษาจาก cohort:", "Enroll students from cohort:")}</p>
            <div className="flex gap-2">
              <select
                value={selectedCohort}
                onChange={(e) => { setSelectedCohort(e.target.value); setEnrolledMsg(""); }}
                className="flex-1 h-9 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#2DD4BF]"
                aria-label={t("เลือก cohort ที่จะ enroll", "Select cohort to enroll")}
              >
                <option value="">{NO_COHORT_LABEL}</option>
                {cohorts.map((c) => (
                  <option key={c} value={c}>
                    {c} ({getStudentsByCohort(c).length} {t("คน", "students")})
                  </option>
                ))}
              </select>
              <button
                onClick={handleEnroll}
                disabled={!selectedCohort || enrolling}
                className="h-9 px-4 rounded-xl bg-[#0F766E] text-white text-sm font-semibold hover:bg-[#0d6660] active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF] transition-colors whitespace-nowrap"
              >
                {enrolling ? t("กำลังเพิ่ม…", "Enrolling…") : t("นำเข้า", "Enroll")}
              </button>
            </div>
            {enrolledMsg && (
              <p role="status" className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                {enrolledMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Course row ----

function CourseRow({ course }: { course: Course }) {
  const { t } = useLanguage();
  const { getTeachersByCourse } = useManagedTeachers();
  const { getStudentsByCourse } = useStudents();
  const [expanded, setExpanded] = useState(false);

  const assignedTeachers = getTeachersByCourse(course.id);
  const enrolledCount = getStudentsByCourse(course.id).length;

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={`course-panel-${course.id}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2DD4BF] transition-colors"
      >
        {/* Color swatch */}
        <div
          className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white font-bold text-xs"
          style={{ background: course.coverColor }}
          aria-hidden="true"
        >
          {course.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{course.name}</p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {assignedTeachers.length > 0
              ? assignedTeachers.map((tc) => tc.name).join(", ")
              : t("ยังไม่มีอาจารย์ assigned", "No teachers assigned")}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-semibold tabular-nums text-[var(--text-primary)]">{enrolledCount}</p>
            <p className="text-[10px] text-[var(--text-muted)]">{t("นักศึกษา", "students")}</p>
          </div>
          <span className={`transition-transform duration-200 text-[var(--text-muted)] ${expanded ? "rotate-180" : ""}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
        </div>
      </button>

      {/* Always render so aria-controls can point to a real element in the DOM */}
      <div id={`course-panel-${course.id}`} hidden={!expanded}>
        {expanded && <CourseAssignPanel course={course} />}
      </div>
    </div>
  );
}

// ---- Main page ----

export default function AdminCoursesPage() {
  const { t } = useLanguage();
  const { courses } = useCourses();

  const activeCourses = courses.filter((c) => c.status === "active");
  const archivedCourses = courses.filter((c) => c.status === "archived");

  return (
    <div className="p-6 max-w-4xl">
        <PageHeader
          title={t("จัดการรายวิชา", "Course Management")}
          description={t("Assign อาจารย์และนำเข้านักศึกษาให้แต่ละรายวิชา", "Assign teachers and enroll students for each course")}
        />

        {courses.length === 0 ? (
          <EmptyState
            iconColor="#2DD4BF"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
            }
            title={t("ยังไม่มีรายวิชาในระบบ", "No courses yet")}
            description={t("สร้างรายวิชาจากหน้าหลักของ Teacher portal ก่อน", "Create courses from the Teacher portal first")}
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Active */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">{t(`รายวิชาที่เปิดสอน (${activeCourses.length})`, `Active courses (${activeCourses.length})`)}</p>
              <div className="flex flex-col gap-3">
                {activeCourses.length === 0 ? (
                  <p className="text-sm text-[var(--text-muted)]">{t("ไม่มีรายวิชาที่เปิดสอน", "No active courses")}</p>
                ) : (
                  activeCourses.map((course) => <CourseRow key={course.id} course={course} />)
                )}
              </div>
            </div>

            {/* Archived */}
            {archivedCourses.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                  {t(`รายวิชาที่เก็บถาวร (${archivedCourses.length})`, `Archived courses (${archivedCourses.length})`)}
                </p>
                <div className="flex flex-col gap-3 opacity-60">
                  {archivedCourses.map((course) => <CourseRow key={course.id} course={course} />)}
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}
