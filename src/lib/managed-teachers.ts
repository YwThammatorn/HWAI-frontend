"use client";

import { createContext, useContext } from "react";

export interface ManagedTeacher {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "ta";
  courseIds: string[]; // courses Admin assigned this teacher to
}

export interface ManagedTeacherContextValue {
  teachers: ManagedTeacher[];
  addTeacher: (data: Omit<ManagedTeacher, "id" | "courseIds">) => ManagedTeacher;
  importTeachers: (data: Omit<ManagedTeacher, "id" | "courseIds">[]) => ManagedTeacher[];
  updateTeacher: (id: string, data: Partial<Omit<ManagedTeacher, "id">>) => void;
  removeTeacher: (id: string) => void;
  getTeacher: (id: string) => ManagedTeacher | undefined;
  assignToCourse: (teacherId: string, courseId: string) => void;
  unassignFromCourse: (teacherId: string, courseId: string) => void;
  getTeachersByCourse: (courseId: string) => ManagedTeacher[];
}

export const ManagedTeacherContext = createContext<ManagedTeacherContextValue | null>(null);

export function useManagedTeachers(): ManagedTeacherContextValue {
  const ctx = useContext(ManagedTeacherContext);
  if (!ctx) throw new Error("useManagedTeachers must be used inside <ManagedTeacherProvider>");
  return ctx;
}
