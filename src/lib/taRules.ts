// The TA hat's rules as plain functions (10/11/2569), so they can be tested without React. A TA is a student the teacher appointed on a course's
// Collaborators page; the user's rule: a TA must not be enrolled in that subject in that term.

import type { Course } from "./courses";
import type { SectionRole } from "./section-roles";
import type { Student } from "./students";

/** Which sections count as "the same subject in the same term": the same subject (template, else code) in the same academic year and term. */
const subjectKey = (c: Pick<Course, "courseTemplateId" | "code" | "id">) => c.courseTemplateId ?? c.code ?? c.id;

/** Enrolled (not withdrawn) in any section of `course`'s subject in the course's term. A course with no year / term is compared on its own roster only. */
export function isEnrolledInSubjectThatTerm(studentId: string, course: Course, courses: Course[], students: Student[]): boolean {
  const sameTerm = (c: Course) =>
    c.id === course.id
    || (course.academicYear !== undefined && course.term !== undefined
      && subjectKey(c) === subjectKey(course) && c.academicYear === course.academicYear && c.term === course.term);
  const ids = new Set(courses.filter(sameTerm).map((c) => c.id));
  ids.add(course.id);
  return students.some((s) => s.studentId === studentId && ids.has(s.courseId) && s.enrollmentStatus !== "withdrawn");
}

/** The courses this student may assist as a TA: an appointed `ta` role, and not enrolled in that subject that term. */
export function taCourseIdsFor(roles: SectionRole[], studentId: string, courses: Course[], students: Student[]): Set<string> {
  const out = new Set<string>();
  for (const r of roles) {
    if (r.role !== "ta") continue;
    const course = courses.find((c) => c.id === r.courseId);
    if (!course) continue;
    if (!isEnrolledInSubjectThatTerm(studentId, course, courses, students)) out.add(course.id);
  }
  return out;
}
