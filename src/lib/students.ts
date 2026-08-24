"use client";

import { createContext, useContext } from "react";

export interface Student {
  id: string;
  courseId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  cohort?: string; // e.g. "CE69"
}

export interface StudentContextValue {
  students: Student[];
  addStudents: (courseId: string, incoming: Omit<Student, "id" | "courseId">[]) => void;
  removeStudent: (id: string) => void;
  getStudentsByCourse: (courseId: string) => Student[];
}

export const StudentContext = createContext<StudentContextValue | null>(null);

export function useStudents(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudents must be used inside <StudentProvider>");
  return ctx;
}
