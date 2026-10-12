// Finding rubrics worth reusing, and how a rubric did in earlier years (12/10/2569). Pure functions over the data the app already
// holds: courses (courseTemplateId + academicYear + term say "same subject, which year"), assignments, rubrics, submissions.

import type { Course } from "./courses";
import type { Assignment, Rubric, RubricCriterion, Submission } from "./assignments";
import { achievedLevelIndex } from "./assignments";
import type { RubricLibraryEntry } from "./rubricLibrary";
import { buildCriteria, pickAiTemplate, PROGRAMMING_AI, EXAM_AI, UXUI_FINAL, type CriterionSpec, type RubricLang, type BuiltCriterion } from "./rubricTemplates";
import { splitCriterionName } from "./rubricName";

/** The key criteria are matched by across years: the main (first-language) name without the C1 code, lower-cased. */
export function criterionKey(name: string): string {
  return splitCriterionName(name).main.trim().toLowerCase().replace(/\s+/g, " ");
}

const termNumber = (t: Course["term"]) => (t === "summer" ? 3.5 : (t ?? 0));
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
  const scores = subs.filter((s) => s.assignmentId === a.id && s.status === "graded").map((s) => s.instructorScore ?? s.aiScore ?? 0);
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
export function proposeReplacement(opts: { brief: string; skippedName: string; takenNames: string[]; round: number; points: number; lang: RubricLang }): BuiltCriterion | null {
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
  const pick = pool[opts.round % pool.length];
  return { ...pick, maxPoints: Math.max(1, opts.points) };
}

// ── Comparing the same rubric across years ──────────────────────────────────────────────────────────────────────────────

export interface YearCell { avgPct: number | null; n: number; counts: number[]; maxPoints: number }
export interface YearColumn {
  key: string;
  assignmentId: string;
  courseId: string;
  title: string;
  academicYear?: number;
  term?: Course["term"];
  sectionNumber?: string;
  order: number;
  isReference: boolean;
  /** the assignment's own class average, null when nothing was graded */
  avgPct: number | null;
  gradedCount: number;
}
export interface YearRow {
  key: string;                              // criterionKey
  name: string;                             // as written in the newest rubric that has it
  cells: Record<string, YearCell | undefined>;
  /** in how many of the compared rubrics this criterion exists */
  presentIn: number;
}

const titleKey = (title: string) => title.toLowerCase().replace(/[0-9๐-๙]+/g, "").replace(/\s+/g, " ").trim();

/**
 * The reference assignment's rubric next to the rubrics of the same subject in other terms / years that are "the same one":
 * their criteria overlap by at least half (by criterionKey), or the assignment carries the same name apart from numbers.
 * Columns run oldest → newest; rows are the criteria (matched by name), with a cell where the criterion exists.
 */
export function compareRubricYears(inp: { referenceAssignmentId: string; courses: Course[]; assignments: Assignment[]; rubrics: Rubric[]; submissions: Submission[] }): { columns: YearColumn[]; rows: YearRow[] } {
  const ref = inp.assignments.find((a) => a.id === inp.referenceAssignmentId);
  const refCourse = ref && inp.courses.find((c) => c.id === ref.courseId);
  const refRubric = ref && inp.rubrics.find((r) => r.assignmentId === ref.id);
  if (!ref || !refCourse || !refRubric) return { columns: [], rows: [] };
  const refKeys = new Set(refRubric.criteria.map((c) => criterionKey(c.name)));

  // other terms / sections of the same subject only — a course's other assignments are different tasks, not the same rubric a year on
  const others: { a: Assignment; course: Course; rubric: Rubric; overlap: number }[] = [];
  for (const rb of inp.rubrics) {
    const a = inp.assignments.find((x) => x.id === rb.assignmentId);
    if (!a || a.isExam || a.id === ref.id) continue;
    const course = inp.courses.find((c) => c.id === a.courseId);
    if (!course || course.id === refCourse.id || !refCourse.courseTemplateId || course.courseTemplateId !== refCourse.courseTemplateId) continue;
    const keys = new Set(rb.criteria.map((c) => criterionKey(c.name)));
    const overlap = [...keys].filter((k) => refKeys.has(k)).length / Math.max(1, new Set([...keys, ...refKeys]).size);
    others.push({ a, course, rubric: rb, overlap });
  }
  // the same assignment under the same name (numbers / years aside) is the same rubric; a teacher who renames it every year still
  // gets the best match of each other course when its criteria overlap by at least half
  const sameName = others.filter((o) => titleKey(o.a.name) === titleKey(ref.name));
  const matched = sameName.length > 0
    ? sameName
    : [...new Set(others.map((o) => o.course.id))].flatMap((cid) => {
        const best = others.filter((o) => o.course.id === cid).sort((x, y) => y.overlap - x.overlap)[0];
        return best && best.overlap >= 0.5 ? [best] : [];
      });
  const picked: { a: Assignment; course: Course; rubric: Rubric }[] = [{ a: ref, course: refCourse, rubric: refRubric }, ...matched];
  picked.sort((x, y) => termOrder(x.course) - termOrder(y.course) || x.a.name.localeCompare(y.a.name));

  const columns: YearColumn[] = picked.map(({ a, course }) => ({
    key: a.id, assignmentId: a.id, courseId: course.id, title: a.name, academicYear: course.academicYear, term: course.term, sectionNumber: course.sectionNumber,
    order: termOrder(course), isReference: a.id === ref.id, ...assignmentAvgPct(a, inp.submissions),
  }));

  const rowMap = new Map<string, YearRow>();
  picked.forEach(({ a, rubric }) => {
    const st = criterionStats(rubric, inp.submissions.filter((s) => s.assignmentId === a.id));
    for (const c of rubric.criteria) {
      const k = criterionKey(c.name);
      const row = rowMap.get(k) ?? { key: k, name: c.name, cells: {}, presentIn: 0 };
      row.name = c.name;                                    // newest wins (picked is oldest → newest)
      row.cells[a.id] = { avgPct: st[c.id].avgPct, n: st[c.id].n, counts: st[c.id].counts, maxPoints: c.maxPoints };
      row.presentIn++;
      rowMap.set(k, row);
    }
  });
  // the reference's own criteria first, in its order; criteria that only other years had after them
  const order = refRubric.criteria.map((c) => criterionKey(c.name));
  const rows = [...rowMap.values()].sort((x, y) => {
    const ix = order.indexOf(x.key), iy = order.indexOf(y.key);
    return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy);
  });
  return { columns, rows };
}
