"use client";

import { createContext, useContext } from "react";

export type EnrollmentStatus = "enrolled" | "withdrawn";

export interface Student {
  id: string;
  courseId: string; // conceptually a Section id now that Course carries section fields — see lib/courses.ts
  studentId: string;
  /** the student's name from their account (CohortStudent.name), without the title */
  name: string;
  email: string;
  /** สถานะการลงทะเบียนต่อวิชา — แยกจาก CohortStudent.status ซึ่งเป็น account-level
   *  (มติที่ประชุม 4/9/2569 decision #1). Absent = enrolled. A roster is listed by student ID; there is no
   *  per-course number or "added mid-term" mark any more (7/11/2569). */
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

/** A record saved before names became one field (6/11/2569) — localStorage mock data — has firstName + lastName
 *  instead of name. Returns it with `name`, and leaves records that already have one alone. */
export function withName<T extends { name: string }>(record: T): T {
  const r = record as T & { firstName?: string; lastName?: string };
  if (typeof r.name === "string") return record;
  const { firstName, lastName, ...rest } = r;
  return { ...rest, name: `${firstName ?? ""} ${lastName ?? ""}`.trim() } as unknown as T;
}

/** Roster order everywhere (7/11/2569): by course, then by student ID — the registrar's order. */
export const byRosterOrder = (a: Pick<Student, "courseId" | "studentId">, b: Pick<Student, "courseId" | "studentId">) =>
  a.courseId.localeCompare(b.courseId) || a.studentId.localeCompare(b.studentId, undefined, { numeric: true });

/** A roster record from before 7/11/2569 (localStorage mock) may carry sequenceNumber / "added-midterm": drop the number, read the mark as enrolled. */
export function withoutMidterm(record: Student): Student {
  const { sequenceNumber: _n, ...rest } = record as Student & { sequenceNumber?: number; enrollmentStatus?: string };
  void _n;
  return (rest as { enrollmentStatus?: string }).enrollmentStatus === "added-midterm" ? { ...rest, enrollmentStatus: "enrolled" } : (rest as Student);
}
