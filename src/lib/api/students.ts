import { client } from "./client";
import type { Student } from "@/lib/students";

const KEY = "hwai_students_v1";

function read(): Student[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Student[]) : [];
  } catch {
    return [];
  }
}

function write(items: Student[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors StudentContextValue
// (src/lib/students.ts) 1:1 — this is per-section roster, distinct from CohortStudent (account-level,
// see api/cohort-students.ts).
export async function getStudents(courseId?: string): Promise<Student[]> {
  // return client.get<Student[]>(courseId ? `/api/courses/${courseId}/students` : "/api/students");
  void client;
  const all = read();
  return courseId ? all.filter((s) => s.courseId === courseId) : all;
}

export async function addStudents(courseId: string, incoming: Omit<Student, "id" | "courseId">[]): Promise<Student[]> {
  // return client.post<Student[]>(`/api/courses/${courseId}/students`, incoming);
  const added = incoming.map((s) => ({ ...s, id: crypto.randomUUID(), courseId }));
  write([...read(), ...added]);
  return added;
}

export async function updateStudent(id: string, data: Partial<Omit<Student, "id" | "courseId">>): Promise<Student> {
  // return client.patch<Student>(`/api/students/${id}`, data);
  const items = read().map((s) => (s.id === id ? { ...s, ...data } : s));
  write(items);
  const updated = items.find((s) => s.id === id);
  if (!updated) throw new Error(`Student ${id} not found`);
  return updated;
}

export async function removeStudent(id: string): Promise<void> {
  // return client.delete<void>(`/api/students/${id}`);
  write(read().filter((s) => s.id !== id));
}
