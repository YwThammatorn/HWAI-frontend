import { client } from "./client";
import type { CohortStudent } from "@/lib/cohort-students";

const KEY = "hwai_cohort_students_v1";

function read(): CohortStudent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CohortStudent[]) : [];
  } catch {
    return [];
  }
}

function write(items: CohortStudent[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors CohortStudentContextValue
// (src/lib/cohort-students.ts) 1:1 — the account-level student record (cross-course), distinct from
// the per-section Student roster row (see api/students.ts).
//
// removeCohortStudent cascades to section-roles and grading-assignments in the live Provider
// (CohortStudentContext.tsx) — a real backend should do the same cascade server-side on delete, so
// the frontend doesn't also need to call api/section-roles.ts / api/grading-assignments.ts separately.
export async function getCohortStudents(cohort?: string): Promise<CohortStudent[]> {
  // return client.get<CohortStudent[]>(cohort ? `/api/cohort-students?cohort=${cohort}` : "/api/cohort-students");
  void client;
  const all = read();
  return cohort ? all.filter((s) => s.cohort === cohort) : all;
}

export async function addCohortStudents(incoming: Omit<CohortStudent, "id">[]): Promise<CohortStudent[]> {
  // return client.post<CohortStudent[]>("/api/cohort-students", incoming);
  const added = incoming.map((s) => ({ ...s, id: crypto.randomUUID() }));
  write([...read(), ...added]);
  return added;
}

export async function updateCohortStudent(id: string, data: Partial<Omit<CohortStudent, "id">>): Promise<CohortStudent> {
  // return client.patch<CohortStudent>(`/api/cohort-students/${id}`, data);
  const items = read().map((s) => (s.id === id ? { ...s, ...data } : s));
  write(items);
  const updated = items.find((s) => s.id === id);
  if (!updated) throw new Error(`CohortStudent ${id} not found`);
  return updated;
}

export async function removeCohortStudent(id: string): Promise<void> {
  // return client.delete<void>(`/api/cohort-students/${id}`); — expect the backend to cascade-delete
  // this account's section-roles and grading-assignments, same as the live Provider does client-side.
  write(read().filter((s) => s.id !== id));
}
