"use client";

// Which assignments of a course the signed-in staff member works with (10/11/2569, advisor R28). A teacher (or a teacher previewing the TA hat)
// works with all of them. A real TA — a student wearing the TA hat — works only with the ones a teacher gave them (Assign work to TAs page).
// Every teacher-side screen that lists a course's assignments goes through here, so a TA's Overview, Grading, Assignments, Score Book and the
// My Courses card can never disagree about what is theirs.

import { useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useAssignments, type Assignment } from "@/lib/assignments";
import { useGradingAssignments } from "@/lib/grading-assignments";
import { useCurrentAccountId } from "@/lib/current-account";
import { assignedAssignmentIds } from "@/lib/taWork";

export interface TaScope {
  /** true for a real TA: only the assigned assignments are theirs */
  scoped: boolean;
  /** false until the stored assignments are read */
  ready: boolean;
  /** the assigned assignment ids (meaningful when `scoped`) */
  ids: Set<string>;
}

export function useTaScope(courseId: string): TaScope {
  const { user, effectiveRole } = useAuth();
  const { gradingAssignments, ready } = useGradingAssignments();
  const me = useCurrentAccountId();
  const scoped = effectiveRole === "ta" && user?.role === "ta";
  return { scoped, ready, ids: scoped ? assignedAssignmentIds(gradingAssignments, courseId, me) : new Set<string>() };
}

/** The same thing as a function of the course, for a page that loops over several courses (My Courses). */
export function useGradableAssignmentsOf(): (courseId: string) => Assignment[] {
  const { user, effectiveRole } = useAuth();
  const { gradingAssignments } = useGradingAssignments();
  const { getAssignmentsByCourse } = useAssignments();
  const me = useCurrentAccountId();
  const scoped = effectiveRole === "ta" && user?.role === "ta";
  return useCallback((courseId: string) => {
    const all = getAssignmentsByCourse(courseId);
    if (!scoped) return all;
    const ids = assignedAssignmentIds(gradingAssignments, courseId, me);
    return all.filter((a) => ids.has(a.id));
  }, [getAssignmentsByCourse, scoped, gradingAssignments, me]);
}

export function useGradableAssignments(courseId: string): Assignment[] {
  return useGradableAssignmentsOf()(courseId);
}
