"use client";

import { createContext, useContext } from "react";

export type GradingAssignmentScope =
  // 10/11/2569 (advisor R28): the teacher gives a TA whole assignments to grade — the only scope the app writes now; the older ones below are kept
  // as types for the archived Grading Split page (archive/grading-split/)
  | { type: "assignments"; assignmentIds: string[] }
  | { type: "week"; weekNumbers: number[] }
  | { type: "group"; studentGroupIds: string[] }
  | { type: "all" }
  | { type: "custom"; submissionIds: string[] };

export interface GradingAssignment {
  id: string;
  courseId: string;   // FK → Course.id (section-shaped)
  taAccountId: string; // FK → CohortStudent.id or ManagedTeacher.id, whichever holds the TA SectionRole
  scope: GradingAssignmentScope;
}

export interface GradingAssignmentContextValue {
  gradingAssignments: GradingAssignment[];
  /** false until the stored records are read (they load in an effect), so a guard does not judge an empty list */
  ready: boolean;
  addGradingAssignment: (data: Omit<GradingAssignment, "id">) => GradingAssignment;
  updateGradingAssignment: (id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>) => void;
  removeGradingAssignment: (id: string) => void;
  removeAssignmentsByTa: (taAccountId: string) => void;
  /** a TA's records in one course (the TA stays appointed; this only takes the work back) */
  removeAssignmentsByTaInCourse: (taAccountId: string, courseId: string) => void;
  /** an assignment was deleted: drop its id from every scope */
  removeAssignmentFromScopes: (assignmentId: string) => void;
  getAssignmentsBySection: (courseId: string) => GradingAssignment[];
  getAssignmentsByTa: (taAccountId: string) => GradingAssignment[];
}

export const GradingAssignmentContext = createContext<GradingAssignmentContextValue | null>(null);

export function useGradingAssignments(): GradingAssignmentContextValue {
  const ctx = useContext(GradingAssignmentContext);
  if (!ctx) throw new Error("useGradingAssignments must be used inside <GradingAssignmentProvider>");
  return ctx;
}
