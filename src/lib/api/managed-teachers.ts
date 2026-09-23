import { client } from "./client";
import { withNulls } from "./sync";
import type { ManagedTeacher } from "@/lib/managed-teachers";

type NewTeacher = Omit<ManagedTeacher, "id" | "courseIds" | "status"> & { id?: string };

// Backed by HWAI-backend. Mirrors ManagedTeacherContextValue (src/lib/managed-teachers.ts). `id` is
// optional on create — the Provider sends a client-generated one (see api/sync.ts).
export async function getManagedTeachers(courseId?: string): Promise<ManagedTeacher[]> {
  return client.get<ManagedTeacher[]>(courseId ? `/api/courses/${courseId}/teachers` : "/api/managed-teachers");
}

export async function addManagedTeacher(data: NewTeacher): Promise<ManagedTeacher> {
  return client.post<ManagedTeacher>("/api/managed-teachers", data);
}

export async function importManagedTeachers(data: NewTeacher[]): Promise<ManagedTeacher[]> {
  return client.post<ManagedTeacher[]>("/api/managed-teachers/import", data);
}

export async function updateManagedTeacher(id: string, data: Partial<Omit<ManagedTeacher, "id">>): Promise<ManagedTeacher> {
  return client.patch<ManagedTeacher>(`/api/managed-teachers/${id}`, withNulls(data));
}

// Server cascades: course assignments. Section roles / grading assignments are still localStorage-only,
// so ManagedTeacherProvider keeps cascading those client-side.
export async function removeManagedTeacher(id: string): Promise<void> {
  return client.delete<void>(`/api/managed-teachers/${id}`);
}

export async function setManagedTeacherStatus(id: string, status: ManagedTeacher["status"]): Promise<void> {
  return client.patch<void>(`/api/managed-teachers/${id}/status`, { status });
}

export async function assignTeacherToCourse(teacherId: string, courseId: string): Promise<void> {
  return client.post<void>(`/api/managed-teachers/${teacherId}/courses/${courseId}`, {});
}

export async function unassignTeacherFromCourse(teacherId: string, courseId: string): Promise<void> {
  return client.delete<void>(`/api/managed-teachers/${teacherId}/courses/${courseId}`);
}
