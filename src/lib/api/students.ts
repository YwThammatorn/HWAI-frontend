import { client } from "./client";
import { withNulls } from "./sync";
import type { Student } from "@/lib/students";

// Backed by HWAI-backend. A course's roster (per-section Student rows — not the account-level CohortStudent,
// see api/cohort-students.ts). `id` is optional on create — StudentProvider sends a client-generated one.

/** One course's roster, or every roster when `courseId` is omitted (what StudentProvider loads). */
export async function getStudents(courseId?: string): Promise<Student[]> {
  return client.get<Student[]>(courseId ? `/api/courses/${courseId}/students` : "/api/students");
}

/** The server numbers new rows after the current roster and marks late additions "added-midterm",
 *  unless sequenceNumber / enrollmentStatus are given (StudentProvider always gives them). */
export async function addStudents(courseId: string, incoming: (Omit<Student, "courseId" | "id"> & { id?: string })[]): Promise<Student[]> {
  return client.post<Student[]>(`/api/courses/${courseId}/students`, incoming);
}

export async function updateStudent(id: string, data: Partial<Omit<Student, "id" | "courseId">>): Promise<Student> {
  return client.patch<Student>(`/api/students/${id}`, withNulls(data));
}

export async function removeStudent(id: string): Promise<void> {
  return client.delete<void>(`/api/students/${id}`);
}
