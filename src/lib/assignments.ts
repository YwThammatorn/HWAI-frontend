"use client";

import { createContext, useContext } from "react";

export interface Assignment {
  id: string;
  courseId: string;
  name: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  maxPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string; // denormalized for display; replace with join when API is ready
  email: string;       // denormalized for display
  submittedAt: string;
  fileUrl: string | null;
  aiScore: number | null;
  instructorScore: number | null;
  instructorComment: string;
  // Security: student work must not leave faculty without explicit consent
  externalUseConsent: boolean;
  status: "not_graded" | "need_review" | "graded";
  updatedAt: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  weight: number; // 0–100, sum of all criteria must equal 100
}

export interface Rubric {
  id: string;
  assignmentId: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentContextValue {
  assignments: Assignment[];
  submissions: Submission[];
  addAssignment: (data: Omit<Assignment, "id" | "createdAt" | "updatedAt">) => Assignment;
  updateAssignment: (id: string, data: Partial<Omit<Assignment, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeAssignment: (id: string) => void;
  getAssignment: (id: string) => Assignment | undefined;
  getAssignmentsByCourse: (courseId: string) => Assignment[];
  addSubmission: (data: Omit<Submission, "id" | "updatedAt">) => Submission;
  updateSubmission: (id: string, data: Partial<Pick<Submission, "aiScore" | "instructorScore" | "instructorComment" | "status" | "fileUrl">>) => void;
  getSubmissionsByAssignment: (assignmentId: string) => Submission[];
}

export const AssignmentContext = createContext<AssignmentContextValue | null>(null);

export function useAssignments(): AssignmentContextValue {
  const ctx = useContext(AssignmentContext);
  if (!ctx) throw new Error("useAssignments must be used within AssignmentProvider");
  return ctx;
}
