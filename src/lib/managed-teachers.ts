"use client";

import { createContext, useContext } from "react";

export interface ManagedTeacher {
  id: string;
  name: string;
  email: string;
  role: "teacher" | "ta";
  /** Account-level status — same active/inactive concept as CohortStudent.status
   *  (meeting decision 4/9/2569 #1). Was "active"|"suspended"; renamed 9/9/2569
   *  so the teacher and student status models use one shared vocabulary. The
   *  mechanic itself (reversible, confirm-dialog-gated) is unchanged. */
  status: "active" | "inactive";
  courseIds: string[]; // courses Admin assigned this teacher to
}

export interface ManagedTeacherContextValue {
  teachers: ManagedTeacher[];
  addTeacher: (data: Omit<ManagedTeacher, "id" | "courseIds" | "status">) => ManagedTeacher;
  importTeachers: (data: Omit<ManagedTeacher, "id" | "courseIds" | "status">[]) => ManagedTeacher[];
  updateTeacher: (id: string, data: Partial<Omit<ManagedTeacher, "id">>) => void;
  removeTeacher: (id: string) => void;
  deactivateTeacher: (id: string) => void;
  activateTeacher: (id: string) => void;
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
