import { client } from "./client";
import { withNulls } from "./sync";
import type { CohortStudent } from "@/lib/cohort-students";

// Backed by HWAI-backend. Mirrors CohortStudentContextValue (src/lib/cohort-students.ts) — the
// account-level student record (cross-course), distinct from the per-section Student roster row (see
// api/students.ts). `id` is optional on create — the Provider sends a client-generated one.
export async function getCohortStudents(cohort?: string): Promise<CohortStudent[]> {
  return client.get<CohortStudent[]>(
    cohort ? `/api/cohort-students?cohort=${encodeURIComponent(cohort)}` : "/api/cohort-students",
  );
}

export async function addCohortStudents(incoming: (Omit<CohortStudent, "id"> & { id?: string })[]): Promise<CohortStudent[]> {
  return client.post<CohortStudent[]>("/api/cohort-students", incoming);
}

export async function updateCohortStudent(id: string, data: Partial<Omit<CohortStudent, "id">>): Promise<CohortStudent> {
  return client.patch<CohortStudent>(`/api/cohort-students/${id}`, withNulls(data));
}

// Section roles / grading assignments are still localStorage-only, so CohortStudentProvider keeps
// cascading those client-side.
export async function removeCohortStudent(id: string): Promise<void> {
  return client.delete<void>(`/api/cohort-students/${id}`);
}
