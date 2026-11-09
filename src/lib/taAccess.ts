"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCohortStudents } from "@/lib/cohort-students";
import { useCourses } from "@/lib/courses";
import { useSectionRoles } from "@/lib/section-roles";
import { useStudents } from "@/lib/students";
import { taCourseIdsFor } from "./taRules";

export { isEnrolledInSubjectThatTerm, taCourseIdsFor } from "./taRules";

// The TA hat (10/11/2569). A TA is a STUDENT the teacher appointed on a course's Collaborators page (a `ta` SectionRole whose accountId is the
// student's CohortStudent.id). Signed in with their own student account, they can put on the TA hat for the courses they assist — and only for
// those. The rule (the user's, 10/11/2569): a TA must not be enrolled in that subject in that term.

/** The signed-in student's TA courses (empty for anyone who is not a student account or has no appointment). */
export function useTaCourseIds(): Set<string> {
  const { user } = useAuth();
  const { cohortStudents } = useCohortStudents();
  const { getRolesByAccount } = useSectionRoles();
  const { courses } = useCourses();
  const { students } = useStudents();
  const studentId = user?.studentId;
  return useMemo(() => {
    if (!studentId) return new Set<string>();
    const me = cohortStudents.find((s) => s.studentId === studentId);
    return me ? taCourseIdsFor(getRolesByAccount(me.id), studentId, courses, students) : new Set<string>();
  }, [studentId, cohortStudents, getRolesByAccount, courses, students]);
}
