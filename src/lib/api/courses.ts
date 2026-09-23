import { client } from "./client";
import { withNulls } from "./sync";
import type { Course } from "@/lib/courses";

// Backed by HWAI-backend (/api/courses). `id` is optional on create — CourseProvider sends a
// client-generated one so its optimistic state and the server agree on the id (see api/sync.ts).
export async function getCourses(): Promise<Course[]> {
  return client.get<Course[]>("/api/courses");
}

export async function createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Course> {
  return client.post<Course>("/api/courses", data);
}

export async function updateCourse(id: string, data: Partial<Omit<Course, "id" | "createdAt" | "updatedAt">>): Promise<Course> {
  return client.patch<Course>(`/api/courses/${id}`, withNulls(data));
}

// Server cascades: teacher↔course assignments.
export async function deleteCourse(id: string): Promise<void> {
  return client.delete<void>(`/api/courses/${id}`);
}
