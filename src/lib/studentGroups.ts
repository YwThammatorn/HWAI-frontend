"use client";

import { createContext, useContext } from "react";

export interface StudentGroup {
  id: string;
  assignmentId: string;
  /** Denormalized so "reuse a previous team" can look across assignments in the same course. */
  courseId: string;
  name: string;
  /** Student.studentId values — same as Submission.studentId. */
  memberStudentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentGroupContextValue {
  groups: StudentGroup[];
  addGroup: (data: Omit<StudentGroup, "id" | "createdAt" | "updatedAt">) => StudentGroup;
  updateGroup: (id: string, data: Partial<Pick<StudentGroup, "name" | "memberStudentIds">>) => void;
  removeGroup: (id: string) => void;
  getGroupsByAssignment: (assignmentId: string) => StudentGroup[];
  getGroupsByCourse: (courseId: string) => StudentGroup[];
  getGroupForStudent: (assignmentId: string, studentId: string) => StudentGroup | undefined;
}

export const StudentGroupContext = createContext<StudentGroupContextValue | null>(null);

export function useStudentGroups(): StudentGroupContextValue {
  const ctx = useContext(StudentGroupContext);
  if (!ctx) throw new Error("useStudentGroups must be used within StudentGroupProvider");
  return ctx;
}
