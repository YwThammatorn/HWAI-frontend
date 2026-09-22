"use client";

import { createContext, useContext } from "react";

export type EnrollmentStatus = "enrolled" | "withdrawn" | "added-midterm";

export interface Student {
  id: string;
  courseId: string; // conceptually a Section id now that Course carries section fields — see lib/courses.ts
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  cohort?: string; // e.g. "CE69"
  /** ลำดับนักศึกษาในวิชานี้ (มติที่ประชุม 4/9/2569) — คนใหม่ที่เพิ่มกลางเทอมได้เลขต่อท้าย
   *  ไม่ recompute ของเดิมเมื่อมีคนออก. Optional เพราะ record เก่ายังไม่มีค่านี้. */
  sequenceNumber?: number;
  /** สถานะการลงทะเบียนต่อวิชา — แยกจาก CohortStudent.status ซึ่งเป็น account-level
   *  (มติที่ประชุม 4/9/2569 decision #1) */
  enrollmentStatus?: EnrollmentStatus;
}

export interface StudentContextValue {
  students: Student[];
  addStudents: (courseId: string, incoming: Omit<Student, "id" | "courseId">[]) => void;
  updateStudent: (id: string, data: Partial<Omit<Student, "id" | "courseId">>) => void;
  removeStudent: (id: string) => void;
  getStudentsByCourse: (courseId: string) => Student[];
}

export const StudentContext = createContext<StudentContextValue | null>(null);

export function useStudents(): StudentContextValue {
  const ctx = useContext(StudentContext);
  if (!ctx) throw new Error("useStudents must be used inside <StudentProvider>");
  return ctx;
}
