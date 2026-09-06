"use client";

import { useAuth } from "@/context/AuthContext";
import { useCohortStudents } from "@/lib/cohort-students";
import { useManagedTeachers } from "@/lib/managed-teachers";

/**
 * Resolves the logged-in AuthUser to the id SectionRole/GradingAssignment
 * actually key on (CohortStudent.id for students, ManagedTeacher.id for
 * teacher/ta) by matching email. AuthUser carries no such id itself — login
 * (including dev-bypass) only ever creates a session object, never links it
 * to an existing account record.
 *
 * Returns null when no match is found (e.g. a dev-bypass session with no
 * corresponding ManagedTeacher/CohortStudent row). Callers should treat null
 * as "can't verify — don't block", not "definitely not permitted": failing
 * open here preserves current app behavior for demo/dev accounts instead of
 * locking out sessions this localStorage-only auth model can't identify.
 */
export function useCurrentAccountId(): string | null {
  const { user, effectiveRole } = useAuth();
  const { cohortStudents } = useCohortStudents();
  const { teachers } = useManagedTeachers();

  if (!user) return null;

  if (effectiveRole === "student") {
    const student = cohortStudents.find((s) => s.studentId === user.studentId);
    return student?.id ?? null;
  }

  if (effectiveRole === "teacher" || effectiveRole === "ta") {
    const teacher = teachers.find((t) => t.email.toLowerCase() === user.email.toLowerCase());
    return teacher?.id ?? null;
  }

  return null;
}
