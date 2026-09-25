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
  /** ลำดับนักศึกษาในวิชานี้ (มติที่ประชุม 4/9/2569) — คนใหม่ที่เพิ่มกลางเทอมได้เลขต่อท้าย
   *  ไม่ recompute ของเดิมเมื่อมีคนออก. Optional เพราะ record เก่ายังไม่มีค่านี้. */
  sequenceNumber?: number;
  /** สถานะการลงทะเบียนต่อวิชา — แยกจาก CohortStudent.status ซึ่งเป็น account-level
   *  (มติที่ประชุม 4/9/2569 decision #1) */
  enrollmentStatus?: EnrollmentStatus;
}

export const isWithdrawn = (s: Pick<Student, "enrollmentStatus">) => s.enrollmentStatus === "withdrawn";

/** Students who withdrew from this roster (24/9/2569) — their scores and submissions are left out of
 *  every class-level number (averages, counts, "graded" progress) and only shown on a separate
 *  "Withdrawn" tab, the way archived courses sit apart from active ones. Pass ONE course's roster. */
export function withdrawnIds(roster: Student[]): Set<string> {
  return new Set(roster.filter(isWithdrawn).map((s) => s.studentId));
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
