"use client";

import { useCohortStudents } from "@/lib/cohort-students";
import { useCourses, type Course } from "@/lib/courses";
import { useCurriculum, type CourseTemplate, type CurriculumVersion } from "@/lib/curriculum";
import { isWithdrawn, useStudents, type Student } from "@/lib/students";

// One section = one program (หลักสูตร: CE / CECS / CEI), 4/10/2569. A section never mixes students from several
// programs. The section's program comes from the curriculum its subject belongs to; a section that isn't linked to
// any curriculum takes the program of whoever was enrolled first, so it can't drift into a mix either.

export interface SectionProgram {
  program: string;
  /** where the answer came from — shown to the teacher so "why can't I add this student?" is never a mystery */
  source: "curriculum" | "roster";
}

/** Pure: the program a section is for, or null while nothing pins it down yet (no curriculum, empty roster). */
export function sectionProgramOf(
  course: Pick<Course, "courseTemplateId"> | undefined,
  templates: CourseTemplate[],
  versions: CurriculumVersion[],
  roster: Pick<Student, "studentId" | "enrollmentStatus">[],
  programOfStudent: (studentId: string) => string | undefined,
): SectionProgram | null {
  const tpl = course?.courseTemplateId ? templates.find((x) => x.id === course.courseTemplateId) : undefined;
  const version = tpl ? versions.find((v) => v.id === tpl.curriculumVersionId) : undefined;
  if (version) return { program: version.program, source: "curriculum" };
  for (const s of roster) {
    if (isWithdrawn(s)) continue;
    const p = programOfStudent(s.studentId);
    if (p) return { program: p, source: "roster" };
  }
  return null;
}

/** true when this student may sit in a section of that program (an unpinned section accepts anyone). */
export const programFits = (studentProgram: string | undefined, section: SectionProgram | null) =>
  !section || !studentProgram || studentProgram === section.program;

/** Students already on a roster whose program differs from the section's (stale data / pre-rule enrolments). */
export function outOfProgram<T extends Pick<Student, "studentId">>(
  roster: T[],
  section: SectionProgram | null,
  programOfStudent: (studentId: string) => string | undefined,
): T[] {
  if (!section) return [];
  return roster.filter((s) => !programFits(programOfStudent(s.studentId), section));
}

/** The section's program plus the lookups every roster screen needs, in one place. */
export function useSectionProgram(courseId: string) {
  const { getCourse } = useCourses();
  const { courseTemplates, curriculumVersions } = useCurriculum();
  const { getStudentsByCourse } = useStudents();
  const { findByStudentId } = useCohortStudents();
  const roster = getStudentsByCourse(courseId);
  const programOf = (studentId: string) => findByStudentId(studentId)?.program;
  const section = sectionProgramOf(getCourse(courseId), courseTemplates, curriculumVersions, roster, programOf);
  return { section, programOf, fits: (studentProgram: string | undefined) => programFits(studentProgram, section), mismatched: outOfProgram(roster, section, programOf) };
}
