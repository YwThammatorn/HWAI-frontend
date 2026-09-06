"use client";

import { createContext, useContext } from "react";

export type GradingAssignmentScope =
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
  addGradingAssignment: (data: Omit<GradingAssignment, "id">) => GradingAssignment;
  updateGradingAssignment: (id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>) => void;
  removeGradingAssignment: (id: string) => void;
  getAssignmentsBySection: (courseId: string) => GradingAssignment[];
  getAssignmentsByTa: (taAccountId: string) => GradingAssignment[];
}

export const GradingAssignmentContext = createContext<GradingAssignmentContextValue | null>(null);

export function useGradingAssignments(): GradingAssignmentContextValue {
  const ctx = useContext(GradingAssignmentContext);
  if (!ctx) throw new Error("useGradingAssignments must be used inside <GradingAssignmentProvider>");
  return ctx;
}
