"use client";

import { useState, useEffect } from "react";
import { CohortStudentContext, CohortStudent } from "@/lib/cohort-students";
import { useSectionRoles } from "@/lib/section-roles";
import { useGradingAssignments } from "@/lib/grading-assignments";

const STORAGE_KEY = "hwai_cohort_students_v1";

function uuid() {
  return crypto.randomUUID();
}

export default function CohortStudentProvider({ children }: { children: React.ReactNode }) {
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);
  const { removeRolesByAccount } = useSectionRoles();
  const { removeAssignmentsByTa } = useGradingAssignments();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setCohortStudents(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function persist(next: CohortStudent[]) {
    setCohortStudents(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addCohortStudents(incoming: Omit<CohortStudent, "id">[]) {
    const next = [
      ...cohortStudents,
      ...incoming.map((s) => ({ ...s, id: uuid() })),
    ];
    persist(next);
  }

  function updateCohortStudent(id: string, data: Partial<Omit<CohortStudent, "id">>) {
    persist(cohortStudents.map((s) => (s.id === id ? { ...s, ...data } : s)));
  }

  function updateCohortStudents(ids: string[], data: Partial<Omit<CohortStudent, "id">>) {
    const set = new Set(ids);
    persist(cohortStudents.map((s) => (set.has(s.id) ? { ...s, ...data } : s)));
  }

  function removeCohortStudent(id: string) {
    persist(cohortStudents.filter((s) => s.id !== id));
    removeRolesByAccount(id); // cascade
    removeAssignmentsByTa(id); // cascade
  }

  function findByStudentId(studentId: string) {
    return cohortStudents.find((s) => s.studentId === studentId);
  }

  return (
    <CohortStudentContext.Provider
      value={{
        cohortStudents,
        addCohortStudents,
        updateCohortStudent,
        updateCohortStudents,
        removeCohortStudent,
        findByStudentId,
      }}
    >
      {children}
    </CohortStudentContext.Provider>
  );
}
