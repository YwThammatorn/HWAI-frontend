import type { Course, Term } from "@/lib/courses";

/**
 * Which term is "now", and whether a course belongs to a finished one (26/9/2569).
 *
 * Deliberately the simple version: the current term comes from today's date on the usual Thai academic
 * calendar (Aug–Dec term 1, Jan–May term 2, Jun–Jul term 3 / summer; the academic year is the B.E. year the
 * term 1 started in). Real term dates change every year with the registrar's announcement, so the proper
 * fix is an admin-maintained academic calendar — the user put that off ("term system later"). When it
 * exists, only `currentAcademicTerm` needs to read it; every screen goes through this file.
 */

export interface AcademicTerm { year: number; term: 1 | 2 | 3 }

export function currentAcademicTerm(now: Date = new Date()): AcademicTerm {
  const month = now.getMonth() + 1;
  const be = now.getFullYear() + 543;
  if (month >= 8) return { year: be, term: 1 };        // Aug–Dec
  if (month <= 5) return { year: be - 1, term: 2 };    // Jan–May, still the academic year that began last August
  return { year: be - 1, term: 3 };                     // Jun–Jul
}

const termRank = (term: Term): number => (term === "summer" ? 3 : term);
const orderOf = (year: number, term: Term) => year * 10 + termRank(term);

/** "Term 1/2569" label for a heading. Summer has no number. */
export function termHeading(year: number, term: Term, t: (th: string, en: string) => string): string {
  return term === "summer" ? t(`ภาคฤดูร้อน ${year}`, `Summer ${year}`) : t(`เทอม ${term}/${year}`, `Term ${term}/${year}`);
}

/**
 * past    — the term has ended (or an admin archived the course): belongs under "completed courses"
 * current — this term
 * future  — a later term the student is already enrolled in
 * unknown — the course has no year/term at all (older records)
 * Everything that is not "past" is shown as a current course, so nothing enrolled ever disappears.
 */
export type CourseTermStatus = "past" | "current" | "future" | "unknown";

export function courseTermStatus(course: Pick<Course, "status" | "academicYear" | "term">, now: Date = new Date()): CourseTermStatus {
  if (course.status === "archived") return "past";
  if (!course.academicYear || !course.term) return "unknown";
  const cur = currentAcademicTerm(now);
  const a = orderOf(course.academicYear, course.term);
  const b = orderOf(cur.year, cur.term);
  return a < b ? "past" : a === b ? "current" : "future";
}

/** Newest term first; courses with no term last. Used to order the "completed" groups. */
export function compareTermsDesc(a: Pick<Course, "academicYear" | "term">, b: Pick<Course, "academicYear" | "term">): number {
  const oa = a.academicYear && a.term ? orderOf(a.academicYear, a.term) : -1;
  const ob = b.academicYear && b.term ? orderOf(b.academicYear, b.term) : -1;
  return ob - oa;
}
