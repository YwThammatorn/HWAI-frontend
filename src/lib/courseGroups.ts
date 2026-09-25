import type { Course } from "@/lib/courses";
import type { CurriculumVersion, CourseTemplate, Program } from "@/lib/curriculum";

/**
 * Admin Courses list layout (26/9/2569): sections are grouped by curriculum (หลักสูตร) first, then by
 * subject inside it, so the same subject's sections — and its earlier terms — always sit together and
 * subjects with the same name in different curricula (e.g. UX/UI in CE and in CECS) never get mixed up.
 * Pure functions, no React, so the ordering rules are easy to read in one place.
 */

export interface SubjectGroup {
  key: string;
  code?: string;
  name: string;
  courses: Course[];
}

export interface CurriculumGroup {
  key: string;
  /** undefined → courses that aren't linked to any curriculum template */
  version?: CurriculumVersion;
  subjects: SubjectGroup[];
  courseCount: number;
}

export const NO_CURRICULUM_KEY = "none";

const PROGRAM_ORDER: Program[] = ["CE", "CECS", "CEI"];

const termRank = (c: Course) => (c.term === "summer" ? 4 : c.term ?? 9);

/** Newest offering first (year ↓, term ↑ within the year), then section number 1, 2, 3… */
export function compareOfferings(a: Course, b: Course): number {
  const y = (b.academicYear ?? 0) - (a.academicYear ?? 0);
  if (y !== 0) return y;
  const tr = termRank(a) - termRank(b);
  if (tr !== 0) return tr;
  const sa = parseInt(a.sectionNumber ?? "", 10);
  const sb = parseInt(b.sectionNumber ?? "", 10);
  if (!isNaN(sa) && !isNaN(sb) && sa !== sb) return sa - sb;
  return (a.sectionNumber ?? "").localeCompare(b.sectionNumber ?? "");
}

export function curriculumKeyOf(course: Course, templates: CourseTemplate[]): string {
  const tpl = course.courseTemplateId ? templates.find((ct) => ct.id === course.courseTemplateId) : undefined;
  return tpl?.curriculumVersionId ?? NO_CURRICULUM_KEY;
}

export function groupCourses(courses: Course[], versions: CurriculumVersion[], templates: CourseTemplate[]): CurriculumGroup[] {
  const byCurriculum = new Map<string, Course[]>();
  for (const c of courses) {
    const key = curriculumKeyOf(c, templates);
    // a template id pointing at a version that no longer exists is treated as "no curriculum"
    const safeKey = key === NO_CURRICULUM_KEY || versions.some((v) => v.id === key) ? key : NO_CURRICULUM_KEY;
    byCurriculum.set(safeKey, [...(byCurriculum.get(safeKey) ?? []), c]);
  }

  const groups: CurriculumGroup[] = [];
  for (const [key, list] of byCurriculum) {
    const bySubject = new Map<string, Course[]>();
    for (const c of list) {
      // linked courses group by template; unlinked ones by code (or name) so a hand-made subject still stacks
      const subjectKey = c.courseTemplateId ?? `name:${c.code ?? ""}:${c.name}`;
      bySubject.set(subjectKey, [...(bySubject.get(subjectKey) ?? []), c]);
    }
    const subjects: SubjectGroup[] = [...bySubject].map(([subjectKey, cs]) => {
      const sorted = [...cs].sort(compareOfferings);
      return { key: subjectKey, code: sorted[0].code, name: sorted[0].name, courses: sorted };
    });
    subjects.sort((a, b) => (a.code ?? "￿").localeCompare(b.code ?? "￿") || a.name.localeCompare(b.name));
    groups.push({ key, version: versions.find((v) => v.id === key), subjects, courseCount: list.length });
  }

  return groups.sort((a, b) => {
    if (!a.version || !b.version) return a.version ? -1 : b.version ? 1 : 0;
    const p = PROGRAM_ORDER.indexOf(a.version.program) - PROGRAM_ORDER.indexOf(b.version.program);
    return p !== 0 ? p : b.version.effectiveFrom - a.version.effectiveFrom;
  });
}
