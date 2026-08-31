"use client";

import { useState, useEffect } from "react";
import { CohortStudentContext, CohortStudent } from "@/lib/cohort-students";

const STORAGE_KEY = "hwai_cohort_students_v1";

function uuid() {
  return crypto.randomUUID();
}

export default function CohortStudentProvider({ children }: { children: React.ReactNode }) {
  const [cohortStudents, setCohortStudents] = useState<CohortStudent[]>([]);

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

  function removeCohortStudent(id: string) {
    persist(cohortStudents.filter((s) => s.id !== id));
  }

  function updateTaAssignments(id: string, courseIds: string[]) {
    persist(cohortStudents.map((s) => s.id === id ? { ...s, taAssignments: courseIds } : s));
  }

  function findByStudentId(studentId: string) {
    return cohortStudents.find((s) => s.studentId === studentId);
  }

  function getCohorts(): string[] {
    return [...new Set(cohortStudents.map((s) => s.cohort))].sort();
  }

  function getStudentsByCohort(cohort: string) {
    return cohortStudents.filter((s) => s.cohort === cohort);
  }

  return (
    <CohortStudentContext.Provider
      value={{
        cohortStudents,
        addCohortStudents,
        removeCohortStudent,
        updateTaAssignments,
        findByStudentId,
        getCohorts,
        getStudentsByCohort,
      }}
    >
      {children}
    </CohortStudentContext.Provider>
  );
}
