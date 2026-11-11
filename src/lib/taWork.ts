// The work a TA is given to grade (10/11/2569, advisor R28–R30). Pure, so the numbers on every TA screen come from one place and a test can check them.
// A teacher gives a TA whole assignments (lib/grading-assignments.ts, scope "assignments"); the TA's queue is the pieces of work in them that
// still wait for a grader, and the ones already graded. Same definitions as the teacher's "N to grade" (lib/gradingStage.ts toGradeCount).

import type { GradingAssignment } from "./grading-assignments";
import type { Assignment, Submission } from "./assignments";
import { toGradeCount } from "./gradingStage";

/** The ids of the assignments of `courseId` given to this TA (an account id — a CohortStudent.id — as the TA role is keyed). */
export function assignedAssignmentIds(records: GradingAssignment[], courseId: string, taAccountId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!taAccountId) return ids;
  for (const r of records) {
    if (r.courseId !== courseId || r.taAccountId !== taAccountId || r.scope.type !== "assignments") continue;
    for (const id of r.scope.assignmentIds) ids.add(id);
  }
  return ids;
}

export interface QueueFigures {
  /** pieces of work still to grade (not graded yet, or graded by the AI and waiting for review) */
  waiting: number;
  /** pieces of work graded */
  graded: number;
  /** waiting + graded */
  total: number;
  /** how many assignments the figures cover */
  assignments: number;
}

/** `subsOf` returns an assignment's submissions with withdrawn students already left out (as the other screens do). */
export function queueFigures(assignments: Pick<Assignment, "id">[], subsOf: (assignmentId: string) => Pick<Submission, "status">[]): QueueFigures {
  let waiting = 0, graded = 0;
  for (const a of assignments) {
    const subs = subsOf(a.id);
    waiting += toGradeCount(subs);
    graded += subs.filter((s) => s.status === "graded").length;
  }
  return { waiting, graded, total: waiting + graded, assignments: assignments.length };
}
