"use client";

import { createContext, useContext } from "react";

export type AccountStatus = "active" | "inactive";

export interface CohortStudent {
  id: string;
  studentId: string; // institutional ID e.g. "64070501"
  firstName: string;
  lastName: string;
  email: string;
  cohort: string;   // e.g. "CE69"
  program: string;  // e.g. "CE"
  /** Account-level status per meeting decision #1 (4/9/2569) — reflects
   *  พ้นสภาพ/ลาออก/จบ, separate from per-section enrollment status.
   *  Defaults to "active" for existing records without this field. */
  status?: AccountStatus;
  /** FK → CurriculumVersion (see src/lib/curriculum.ts). Not yet enforced
   *  anywhere — added so the field exists ahead of the /admin/curriculum
   *  screen that will let admins actually assign it. */
  curriculumVersionId?: string;
}

export interface CohortStudentContextValue {
  cohortStudents: CohortStudent[];
  addCohortStudents: (incoming: Omit<CohortStudent, "id">[]) => void;
  updateCohortStudent: (id: string, data: Partial<Omit<CohortStudent, "id">>) => void;
  removeCohortStudent: (id: string) => void;
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
