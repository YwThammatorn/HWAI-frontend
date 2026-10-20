import type { Assignment, Rubric } from "./assignments";
import type { CLO } from "./clo";

// Which assignments mention each CLO: an assignment does when any criterion of its rubric is tagged with the CLO (`cloIds`, 11/10/2569). The CLO page
// lists just those assignments — one line each. Until 15/10/2569 it also showed the criterion, the class attainment figure and each criterion's points
// and average (user's request to cut them; git has lib/cloAttainment.ts).

export interface CloAssignment { id: string; name: string }
export interface CloLinks { clo: CLO; assignments: CloAssignment[] }

/** For every CLO, the assignments (once each, in the order given) whose rubric has a criterion tagged with it. */
export function cloLinks(input: { clos: CLO[]; assignments: Assignment[]; rubrics: Rubric[] }): CloLinks[] {
  const { clos, assignments, rubrics } = input;
  return clos.map((clo) => ({
    clo,
    assignments: assignments
      .filter((a) => rubrics.some((r) => r.assignmentId === a.id && r.criteria.some((c) => c.cloIds?.includes(clo.id))))
      .map((a) => ({ id: a.id, name: a.name })),
  }));
}
