import { client } from "./client";
import type { ManagedTeacher } from "@/lib/managed-teachers";

const KEY = "hwai_managed_teachers_v1";

function read(): ManagedTeacher[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ManagedTeacher[]) : [];
  } catch {
    return [];
  }
}

function write(items: ManagedTeacher[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// ManagedTeacherContextValue (src/lib/managed-teachers.ts) 1:1.
export async function getManagedTeachers(courseId?: string): Promise<ManagedTeacher[]> {
  // return client.get<ManagedTeacher[]>(courseId ? `/api/courses/${courseId}/teachers` : "/api/managed-teachers");
  void client;
  const all = read();
  return courseId ? all.filter((t) => t.courseIds.includes(courseId)) : all;
}

export async function addManagedTeacher(data: Omit<ManagedTeacher, "id" | "courseIds" | "status">): Promise<ManagedTeacher> {
  // return client.post<ManagedTeacher>("/api/managed-teachers", data);
  const teacher: ManagedTeacher = { ...data, id: crypto.randomUUID(), courseIds: [], status: "active" };
  write([...read(), teacher]);
  return teacher;
}

export async function importManagedTeachers(data: Omit<ManagedTeacher, "id" | "courseIds" | "status">[]): Promise<ManagedTeacher[]> {
  // return client.post<ManagedTeacher[]>("/api/managed-teachers/import", data);
  const added = data.map((d) => ({ ...d, id: crypto.randomUUID(), courseIds: [] as string[], status: "active" as const }));
  write([...read(), ...added]);
  return added;
}

export async function updateManagedTeacher(id: string, data: Partial<Omit<ManagedTeacher, "id">>): Promise<ManagedTeacher> {
  // return client.patch<ManagedTeacher>(`/api/managed-teachers/${id}`, data);
  const items = read().map((t) => (t.id === id ? { ...t, ...data } : t));
  write(items);
  const updated = items.find((t) => t.id === id);
  if (!updated) throw new Error(`ManagedTeacher ${id} not found`);
  return updated;
}

export async function removeManagedTeacher(id: string): Promise<void> {
  // return client.delete<void>(`/api/managed-teachers/${id}`); — expect the backend to cascade-delete
  // this account's section-roles and grading-assignments, same as the live Provider does client-side.
  write(read().filter((t) => t.id !== id));
}

export async function setManagedTeacherStatus(id: string, status: ManagedTeacher["status"]): Promise<void> {
  // return client.patch<void>(`/api/managed-teachers/${id}/status`, { status });
  write(read().map((t) => (t.id === id ? { ...t, status } : t)));
}

export async function assignTeacherToCourse(teacherId: string, courseId: string): Promise<void> {
  // return client.post<void>(`/api/managed-teachers/${teacherId}/courses/${courseId}`, {});
  write(read().map((t) => (t.id === teacherId && !t.courseIds.includes(courseId) ? { ...t, courseIds: [...t.courseIds, courseId] } : t)));
}

export async function unassignTeacherFromCourse(teacherId: string, courseId: string): Promise<void> {
  // return client.delete<void>(`/api/managed-teachers/${teacherId}/courses/${courseId}`);
  write(read().map((t) => (t.id === teacherId ? { ...t, courseIds: t.courseIds.filter((c) => c !== courseId) } : t)));
}
