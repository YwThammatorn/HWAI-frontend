import { client } from "./client";
import type { StudentGroup } from "@/lib/studentGroups";

const KEY = "hwai_student_groups_v1";

function read(): StudentGroup[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StudentGroup[]) : [];
  } catch {
    return [];
  }
}

function write(items: StudentGroup[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// StudentGroupContextValue (src/lib/studentGroups.ts) 1:1.
export async function getStudentGroups(assignmentId?: string): Promise<StudentGroup[]> {
  // return client.get<StudentGroup[]>(assignmentId ? `/api/assignments/${assignmentId}/groups` : "/api/student-groups");
  void client;
  const all = read();
  return assignmentId ? all.filter((g) => g.assignmentId === assignmentId) : all;
}

export async function addStudentGroup(data: Omit<StudentGroup, "id" | "createdAt" | "updatedAt">): Promise<StudentGroup> {
  // return client.post<StudentGroup>(`/api/assignments/${data.assignmentId}/groups`, data);
  const now = new Date().toISOString();
  const item: StudentGroup = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function updateStudentGroup(id: string, data: Partial<Pick<StudentGroup, "name" | "memberStudentIds">>): Promise<StudentGroup> {
  // return client.patch<StudentGroup>(`/api/student-groups/${id}`, data);
  const items = read().map((g) => (g.id === id ? { ...g, ...data, updatedAt: new Date().toISOString() } : g));
  write(items);
  const updated = items.find((g) => g.id === id);
  if (!updated) throw new Error(`StudentGroup ${id} not found`);
  return updated;
}

export async function removeStudentGroup(id: string): Promise<void> {
  // return client.delete<void>(`/api/student-groups/${id}`);
  write(read().filter((g) => g.id !== id));
}
