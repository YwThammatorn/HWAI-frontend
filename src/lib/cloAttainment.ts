import type { Assignment, Rubric, Submission } from "./assignments";
import type { CLO } from "./clo";

// CLO attainment (11/10/2569): which rubric criteria measure each CLO, and how the class did on them.
// A criterion points at CLOs with `cloIds`; the attainment of a CLO is the points the students earned on every
// criterion that measures it divided by the points they could have earned — so a 15-point criterion counts for
// more than a 3-point one. Only real per-criterion scores count (a graded submission without `criterionScores`,
// e.g. an exam, contributes nothing), and callers pass only the students they want counted.

export interface CloLink {
  assignmentId: string;
  assignmentName: string;
  criterionId: string;
  criterionName: string;
  maxPoints: number;
  /** how many graded submissions had a score for this criterion */
  scored: number;
  /** class average on this criterion, 0–100; null when nobody has been scored */
  pct: number | null;
}

export interface CloResult {
  clo: CLO;
  links: CloLink[];
  /** the share of available points earned across all linked criteria, 0–100; null until something is graded */
  pct: number | null;
  /** distinct graded submissions behind that figure */
  gradedCount: number;
}

export function computeCloAttainment(input: { clos: CLO[]; assignments: Assignment[]; rubrics: Rubric[]; submissions: Submission[] }): CloResult[] {
  const { clos, assignments, rubrics, submissions } = input;
  return clos.map((clo) => {
    const links: CloLink[] = [];
    const counted = new Set<string>();
    let earned = 0;
    let possible = 0;
    for (const a of assignments) {
      for (const r of rubrics.filter((x) => x.assignmentId === a.id)) {
        for (const c of r.criteria) {
          if (!c.cloIds?.includes(clo.id)) continue;
          const scores = submissions
            .filter((s) => s.assignmentId === a.id && s.status === "graded" && typeof s.criterionScores?.[c.id] === "number")
            .map((s) => ({ id: s.id, v: s.criterionScores![c.id] }));
          const sum = scores.reduce((n, s) => n + s.v, 0);
          const max = scores.length * c.maxPoints;
          scores.forEach((s) => counted.add(s.id));
          earned += sum;
          possible += max;
          links.push({
            assignmentId: a.id, assignmentName: a.name, criterionId: c.id, criterionName: c.name, maxPoints: c.maxPoints,
            scored: scores.length, pct: max > 0 ? (sum / max) * 100 : null,
          });
        }
      }
    }
    return { clo, links, pct: possible > 0 ? (earned / possible) * 100 : null, gradedCount: counted.size };
  });
}
