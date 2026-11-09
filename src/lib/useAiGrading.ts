"use client";

// One place that sends work to the AI (22/10/2569). Before this the course Grading page held the loop itself; the assignment's own
// Grading page (the "Regrade with new rubric" banner) and the Edit Assignment page (save + regrade) need the very same thing.

import { useAssignments, type Assignment, type Rubric, type Submission } from "./assignments";
import { aiGradingUpdate, waitingForAi } from "./aiGrading";
import { groupSubmissionsByTeam, type SubmissionRow } from "./groupSubmissions";
import { useStudentGroups } from "./studentGroups";
import { useStudents, withdrawnIds } from "./students";

type RubricForAi = Pick<Rubric, "criteria">;

export function useAiGrading() {
  const { getSubmissionsByAssignment, getRubricsByAssignment, updateAssignment, updateSubmission } = useAssignments();
  const { getGroupsByAssignment } = useStudentGroups();
  const { getStudentsByCourse } = useStudents();

  /** One unit of work per submission, or per team for a group assignment (every member shares the team's score). Withdrawn students are left out. */
  function unitsOf(a: Assignment, subs: Submission[]): SubmissionRow[] {
    const out = withdrawnIds(getStudentsByCourse(a.courseId));
    const live = subs.filter((x) => !out.has(x.studentId));
    return a.submissionType === "group" ? groupSubmissionsByTeam(live, getGroupsByAssignment(a.id), "Team") : live.map((x) => ({ key: x.id, subs: [x] }));
  }

  /** The units that still wait for the AI: nothing has scored them yet. */
  const waitingUnits = (a: Assignment) => unitsOf(a, getSubmissionsByAssignment(a.id)).filter((u) => u.subs.some(waitingForAi));

  /** The AI scores these units against `rubric`. What the teacher put on top of an earlier AI result is cleared. */
  function gradeUnits(a: Assignment, units: SubmissionRow[], rubric: RubricForAi | undefined) {
    units.forEach((u) => {
      const update = aiGradingUpdate(u.key, a.maxPoints, rubric);
      u.subs.forEach((s) => updateSubmission(s.id, update));
    });
  }

  /** "Grade with AI" / "Regrade with new rubric": every waiting unit goes to the AI with the rubric as it is now, and the restart marker is cleared. */
  async function sendWaiting(a: Assignment) {
    const units = waitingUnits(a);
    if (units.length > 0) {
      await new Promise((r) => setTimeout(r, 1200));       // the AI "working" (simulated)
      gradeUnits(a, units.map((u) => ({ ...u, subs: u.subs.filter(waitingForAi) })), getRubricsByAssignment(a.id)[0]);
    }
    if (a.rubricRestartedAt) updateAssignment(a.id, { rubricRestartedAt: undefined });
  }

  return { unitsOf, waitingUnits, gradeUnits, sendWaiting };
}
