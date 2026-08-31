"use client";

import { createContext, useContext } from "react";

export interface CohortStudent {
  id: string;
  studentId: string; // institutional ID e.g. "64070501"
  firstName: string;
  lastName: string;
  email: string;
  cohort: string;   // e.g. "CE69"
  program: string;  // e.g. "CE"
  taAssignments?: string[]; // courseIds where this student is TA
}

export interface CohortStudentContextValue {
  cohortStudents: CohortStudent[];
  addCohortStudents: (incoming: Omit<CohortStudent, "id">[]) => void;
  removeCohortStudent: (id: string) => void;
  updateTaAssignments: (id: string, courseIds: string[]) => void;
  findByStudentId: (studentId: string) => CohortStudent | undefined;
  getCohorts: () => string[];
  getStudentsByCohort: (cohort: string) => CohortStudent[];
}

export const CohortStudentContext = createContext<CohortStudentContextValue | null>(null);

export function useCohortStudents(): CohortStudentContextValue {
  const ctx = useContext(CohortStudentContext);
  if (!ctx) throw new Error("useCohortStudents must be used inside <CohortStudentProvider>");
  return ctx;
}
