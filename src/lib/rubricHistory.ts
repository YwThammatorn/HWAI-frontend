// Finding rubrics worth reusing, and how a rubric did in earlier years (12/10/2569). Pure functions over the data the app already
// holds: courses (courseTemplateId + academicYear + term say "same subject, which year"), assignments, rubrics, submissions.

import type { Course } from "./courses";
import type { Assignment, Rubric, RubricCriterion, Submission } from "./assignments";
import { achievedLevelIndex, finalScoreOf } from "./assignments";
import type { RubricLibraryEntry } from "./rubricLibrary";
import { buildCriteria, pickAiTemplate, PROGRAMMING_AI, EXAM_AI, UXUI_FINAL, type CriterionSpec, type RubricLang, type BuiltCriterion } from "./rubricTemplates";
import { splitCriterionName } from "./rubricName";

/** The key criteria are matched by across years: the main (first-language) name without the C1 code, lower-cased. */
export function criterionKey(name: string): string {
  return splitCriterionName(name).main.trim().toLowerCase().replace(/\s+/g, " ");
}

const termNumber = (t: Course["term"]) => t ?? 0;
/** one number that orders terms: 2568 term 1 < 2568 term 2 < 2569 term 1 */
export const termOrder = (c: Pick<Course, "academicYear" | "term">) => (c.academicYear ?? 0) * 10 + termNumber(c.term);

export type CandidateSource = "subject" | "mine" | "library";

export interface RubricCandidate {
  key: string;                       // unique in a list
  source: CandidateSource;
  title: string;                     // the assignment's (or library entry's) name
  courseName?: string;
  academicYear?: number;
  term?: Course["term"];
  sectionNumber?: string;
  /** the academic year before the current course's one — gets the "Last year" badge */
  lastYear: boolean;
  /** same subject as the current course */
  sameSubject: boolean;
  /** termOrder of its course (0 for a library entry) — what the list is sorted by */
  order: number;
  criteria: RubricCriterion[];
  maxPoints: number;
  assignmentId?: string;
  libraryId?: string;
  /** class average % of the graded work of that assignment, null when nothing was graded */
  avgPct: number | null;
  gradedCount: number;
}

/** How well the graded work of one assignment scored, as a % of its maximum. */
export function assignmentAvgPct(a: Assignment, subs: Submission[]): { avgPct: number | null; gradedCount: number } {
  const scores = subs.filter((s) => s.assignmentId === a.id && s.status === "graded").map((s) => finalScoreOf(a, s) ?? 0);
  if (scores.length === 0 || a.maxPoints <= 0) return { avgPct: null, gradedCount: scores.length };
  return { avgPct: (scores.reduce((x, y) => x + y, 0) / scores.length / a.maxPoints) * 100, gradedCount: scores.length };
}

export interface CandidateInput {
  courseId: string;
  courses: Course[];
  assignments: Assignment[];
  rubrics: Rubric[];
  submissions: Submission[];
  library: RubricLibraryEntry[];
  /** the assignment being edited — never offered as a source for itself */
  excludeAssignmentId?: string;
  /** the teacher's own course ids, for the "All my courses" list */
  myCourseIds: Set<string>;
}

/** Everything the picker can offer, tagged by source; the picker filters by tab. Newest earlier term first, then the rest. */
export function rubricCandidates(inp: CandidateInput): RubricCandidate[] {
  const cur = inp.courses.find((c) => c.id === inp.courseId);
  const curOrder = cur ? termOrder(cur) : Infinity;
  const out: RubricCandidate[] = [];

  for (const r of inp.rubrics) {
    if (r.assignmentId === inp.excludeAssignmentId || r.criteria.length === 0) continue;
    const a = inp.assignments.find((x) => x.id === r.assignmentId);
    if (!a || a.isExam) continue;
    const course = inp.courses.find((c) => c.id === a.courseId);
    if (!course) continue;
    const sameSubject = !!cur?.courseTemplateId && course.courseTemplateId === cur.courseTemplateId;
    const mine = inp.myCourseIds.has(course.id);
    if (!sameSubject && !mine) continue;
    const { avgPct, gradedCount } = assignmentAvgPct(a, inp.submissions);
    out.push({
      key: `r-${r.id}`,
      source: sameSubject ? "subject" : "mine",
      title: a.name,
      courseName: course.name,
      academicYear: course.academicYear,
      term: course.term,
      sectionNumber: course.sectionNumber,
      lastYear: !!cur?.academicYear && course.academicYear === cur.academicYear - 1,
      sameSubject,
      order: termOrder(course),
      criteria: r.criteria,
      maxPoints: a.maxPoints,
      assignmentId: a.id,
      avgPct, gradedCount,
    });
  }
  for (const e of inp.library) {
    if (e.courseTemplateId && cur?.courseTemplateId && e.courseTemplateId !== cur.courseTemplateId) continue;
    out.push({
      key: `l-${e.id}`, source: "library", title: e.name, lastYear: false, sameSubject: !!e.courseTemplateId && e.courseTemplateId === cur?.courseTemplateId, order: 0,
      criteria: e.criteria, maxPoints: e.criteria.reduce((n, c) => n + c.maxPoints, 0), libraryId: e.id, avgPct: null, gradedCount: 0,
    });
  }
  // earlier terms first (the newest of them on top), then same-term / later ones; library entries are their own tab
  const rank = (c: RubricCandidate) => (c.order < curOrder ? c.order : c.order - 100000);
  return out.sort((a, b) => rank(b) - rank(a) || a.title.localeCompare(b.title));
}

/** Per-criterion class average and spread over levels for one rubric, from the graded work that carries per-criterion scores. */
export interface CriterionStat { avgPct: number | null; n: number; counts: number[] }
export function criterionStats(rubric: Rubric | { criteria: RubricCriterion[] }, subs: Submission[]): Record<string, CriterionStat> {
  const withScores = subs.filter((s) => s.status === "graded" && s.criterionScores);
  const out: Record<string, CriterionStat> = {};
  for (const c of rubric.criteria) {
    const levels = c.levels.length;
    const counts = new Array(Math.max(levels, 1)).fill(0) as number[];
    let sum = 0, n = 0;
    for (const s of withScores) {
      const v = s.criterionScores![c.id];
      if (typeof v !== "number") continue;
      sum += v; n++;
      const li = achievedLevelIndex(v, c.maxPoints, levels);
      if (li !== null) counts[li]++;
    }
    out[c.id] = { avgPct: n > 0 && c.maxPoints > 0 ? (sum / n / c.maxPoints) * 100 : null, n, counts };
  }
  return out;
}

// ── "Ask the AI for another": a stand-in that offers criteria from the templates ──────────────────────────────────────────

/** Replacement criteria for one skipped criterion, one per round (the "Ask again" button moves to the next round). */
export function proposeReplacement(opts: { brief: string; skippedName: string; takenNames: string[]; round: number; points: number; lang: RubricLang; /** what the teacher typed for this criterion: criteria that mention those words come first */ userBrief?: string }): BuiltCriterion | null {
  // the template that fits the brief goes first, the others follow, so "Ask again" always has something new to offer
  const first = pickAiTemplate(opts.brief)?.criteria ?? PROGRAMMING_AI;
  const sets: CriterionSpec[][] = [first, ...[PROGRAMMING_AI, EXAM_AI, UXUI_FINAL].filter((x) => x !== first)];
  const taken = new Set([...opts.takenNames, opts.skippedName].map(criterionKey));
  const seen = new Set<string>();
  const pool = sets.flatMap((tpl) => buildCriteria(tpl, Math.max(opts.points, tpl.length) * tpl.length, opts.lang)).filter((c) => {
    const k = criterionKey(c.name);
    if (taken.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (pool.length === 0) return null;
  // the teacher's own words put the criteria that mention them first (stable: with no match the order is unchanged)
  // Only words of 4+ letters count ("and", "the", "for" would match nearly every description). Thai has no spaces between words, so a
  // Thai phrase is matched by its 4-character pieces (vowel and tone marks are p{M}, so they stay inside the word) — and the pieces of one phrase share ONE vote, or a common Thai word would drown the rest.
  const votes = (opts.userBrief ?? "").toLowerCase().split(/[^\p{L}\p{M}\p{N}]+/u).filter((w) => w.length >= 4).flatMap((w) => {
    if (!/[\u0E00-\u0E7F]/.test(w) || w.length <= 4) return [{ w, weight: 1 }];
    const pieces = Array.from({ length: w.length - 3 }, (_, i) => w.slice(i, i + 4));
    return pieces.map((piece) => ({ w: piece, weight: 1 / pieces.length }));
  });
  if (votes.length > 0) {
    // a word in the criterion's name counts three times a word in its description: "visual hierarchy" finds Visual Hierarchy, not a
    // criterion that merely mentions both words
    const score = (c: BuiltCriterion) => {
      const name = c.name.toLowerCase(), desc = c.description.toLowerCase();
      return votes.reduce((n, v) => n + v.weight * ((name.includes(v.w) ? 3 : 0) + (desc.includes(v.w) ? 1 : 0)), 0);
    };
    pool.sort((x, y) => score(y) - score(x));
  }
  const pick = pool[opts.round % pool.length];
  return { ...pick, maxPoints: Math.max(1, opts.points) };
}

// ── Comparing rubrics the teacher picks (14/10/2569) ────────────────────────────────────────────────────────────────────────
// Before this the page chose the columns itself (same subject, same assignment name or overlapping criteria) and lined criteria up by
// name — a rubric renamed from one year to the next silently fell out of the comparison. Now the teacher picks which assignments' rubrics
// to put side by side, like phones on a spec sheet, and says which criterion goes on which row.

/** One cell of the table: how the class did on one criterion of one rubric. */
export interface YearCell { avgPct: number | null; n: number; counts: number[]; maxPoints: number }

/** An assignment whose rubric can be put in the comparison. */
export interface CompareOption {
  assignmentId: string;
  courseId: string;
  courseName: string;
  title: string;
  academicYear?: number;
  term?: Course["term"];
  sectionNumber?: string;
  order: number;
  criteriaCount: number;
  /** levels per criterion (a rubric's criteria share one count; older data may differ — then the largest) */
  levelCount: number;
  maxPoints: number;
  avgPct: number | null;
  gradedCount: number;
}

/** Every non-exam assignment with a rubric in the teacher's own courses, newest term first. */
export function compareOptions(inp: { courses: Course[]; assignments: Assignment[]; rubrics: Rubric[]; submissions: Submission[]; myCourseIds: Set<string> }): CompareOption[] {
  const out: CompareOption[] = [];
  for (const r of inp.rubrics) {
    if (r.criteria.length === 0) continue;
    const a = inp.assignments.find((x) => x.id === r.assignmentId);
    if (!a || a.isExam) continue;
    const course = inp.courses.find((c) => c.id === a.courseId);
    if (!course || !inp.myCourseIds.has(course.id)) continue;
    out.push({
      assignmentId: a.id, courseId: course.id, courseName: course.name, title: a.name,
      academicYear: course.academicYear, term: course.term, sectionNumber: course.sectionNumber, order: termOrder(course),
      criteriaCount: r.criteria.length, levelCount: Math.max(...r.criteria.map((c) => c.levels.length)),
      maxPoints: a.maxPoints, ...assignmentAvgPct(a, inp.submissions),
    });
  }
  return out.sort((x, y) => y.order - x.order || x.courseName.localeCompare(y.courseName) || x.title.localeCompare(y.title));
}

/** A chosen rubric with its criteria and how the class did on each (from graded work that carries per-criterion scores). */
export interface CompareColumn extends CompareOption { criteria: RubricCriterion[]; stats: Record<string, CriterionStat> }

export function compareColumn(assignmentId: string, inp: { courses: Course[]; assignments: Assignment[]; rubrics: Rubric[]; submissions: Submission[]; myCourseIds: Set<string> }): CompareColumn | null {
  const option = compareOptions(inp).find((o) => o.assignmentId === assignmentId);
  const rubric = inp.rubrics.find((r) => r.assignmentId === assignmentId);
  if (!option || !rubric) return null;
  return { ...option, criteria: rubric.criteria, stats: criterionStats(rubric, inp.submissions.filter((s) => s.assignmentId === assignmentId)) };
}

/** "No criterion on this row for this rubric". */
export const NO_CRITERION = "";

/** Which criterion sits on row `rowIndex` of a column: the teacher's choice, else the one in the same position (none past the end). */
export function criterionOnRow(col: CompareColumn, rowIndex: number, overrides: Record<string, string> | undefined): string {
  const chosen = overrides?.[String(rowIndex)];
  return chosen !== undefined ? chosen : col.criteria[rowIndex]?.id ?? NO_CRITERION;
}

/** The cell for a criterion of a column, or undefined when the row is empty for it. */
export function compareCell(col: CompareColumn, criterionId: string): YearCell | undefined {
  const c = col.criteria.find((x) => x.id === criterionId);
  const st = c && col.stats[c.id];
  return c && st ? { avgPct: st.avgPct, n: st.n, counts: st.counts, maxPoints: c.maxPoints } : undefined;
}
