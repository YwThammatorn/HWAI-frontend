import { Submission } from "./assignments";
import { StudentGroup } from "./studentGroups";

export interface SubmissionRow {
  key: string;
  teamName?: string;
  subs: Submission[];
}

/**
 * Collapses a group assignment's submissions into one row per team (matched
 * by Submission.groupId) instead of one row per student — every teacher-facing
 * table (assignment detail, grading, results) uses this so "grade the row"
 * consistently means "grade the whole team" everywhere. A submission with no
 * groupId (shouldn't normally happen for a group assignment, since the student
 * submit flow always tags one — see TeamFormationModal) still gets its own row.
 */
export function groupSubmissionsByTeam(
  submissions: Submission[],
  groups: StudentGroup[],
  fallbackTeamLabel: string
): SubmissionRow[] {
  const seen = new Set<string>();
  const rows: SubmissionRow[] = [];
  submissions.forEach((s) => {
    if (seen.has(s.id)) return;
    if (s.groupId) {
      const teamSubs = submissions.filter((x) => x.groupId === s.groupId);
      teamSubs.forEach((x) => seen.add(x.id));
      const group = groups.find((g) => g.id === s.groupId);
      rows.push({ key: s.groupId, teamName: group?.name ?? fallbackTeamLabel, subs: teamSubs });
    } else {
      seen.add(s.id);
      rows.push({ key: s.id, subs: [s] });
    }
  });
  return rows;
}
