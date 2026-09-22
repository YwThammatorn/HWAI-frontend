import { client } from "./client";
import type { GradingAssignment } from "@/lib/grading-assignments";

const KEY = "hwai_grading_assignments_v1";

function read(): GradingAssignment[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GradingAssignment[]) : [];
  } catch {
    return [];
  }
}

function write(items: GradingAssignment[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// GradingAssignmentContextValue (src/lib/grading-assignments.ts) 1:1 — which submissions a TA
// (`taAccountId`, an FK to CohortStudent.id or ManagedTeacher.id) is scoped to grade for a section.
export async function getGradingAssignments(courseId?: string): Promise<GradingAssignment[]> {
  // return client.get<GradingAssignment[]>(courseId ? `/api/courses/${courseId}/grading-assignments` : "/api/grading-assignments");
  void client;
  const all = read();
  return courseId ? all.filter((g) => g.courseId === courseId) : all;
}

export async function addGradingAssignment(data: Omit<GradingAssignment, "id">): Promise<GradingAssignment> {
  // return client.post<GradingAssignment>(`/api/courses/${data.courseId}/grading-assignments`, data);
  const item: GradingAssignment = { ...data, id: crypto.randomUUID() };
  write([...read(), item]);
  return item;
}

export async function updateGradingAssignment(id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>): Promise<GradingAssignment> {
  // return client.patch<GradingAssignment>(`/api/grading-assignments/${id}`, data);
  const items = read().map((g) => (g.id === id ? { ...g, ...data } : g));
  write(items);
  const updated = items.find((g) => g.id === id);
  if (!updated) throw new Error(`GradingAssignment ${id} not found`);
  return updated;
}

export async function removeGradingAssignment(id: string): Promise<void> {
  // return client.delete<void>(`/api/grading-assignments/${id}`);
  write(read().filter((g) => g.id !== id));
}

export async function removeGradingAssignmentsByTa(taAccountId: string): Promise<void> {
  // return client.delete<void>(`/api/grading-assignments?taAccountId=${taAccountId}`);
  write(read().filter((g) => g.taAccountId !== taAccountId));
}
