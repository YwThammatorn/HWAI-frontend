import { client } from "./client";
import type { Course } from "@/lib/courses";
import { SEED_COURSES } from "@/lib/courses";

const KEY = "hwai_courses_v2";

function readLocal(): Course[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Course[]) : SEED_COURSES;
  } catch {
    return SEED_COURSES;
  }
}

function writeLocal(courses: Course[]): void {
  localStorage.setItem(KEY, JSON.stringify(courses));
}

// Phase 1: localStorage — swap bodies to client.*() when backend is ready
export async function getCourses(): Promise<Course[]> {
  // return client.get<Course[]>("/api/courses");
  void client;
  return readLocal();
}

export async function createCourse(data: Omit<Course, "id" | "createdAt" | "updatedAt">): Promise<Course> {
  // return client.post<Course>("/api/courses", data);
  const now = new Date().toISOString();
  const course: Course = {
    ...data,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  writeLocal([...readLocal(), course]);
  return course;
}

export async function updateCourse(id: string, data: Partial<Omit<Course, "id" | "createdAt">>): Promise<Course> {
  // return client.patch<Course>(`/api/courses/${id}`, data);
  const courses = readLocal().map((c) =>
    c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c,
  );
  writeLocal(courses);
  const updated = courses.find((c) => c.id === id);
  if (!updated) throw new Error(`Course ${id} not found`);
  return updated;
}

export async function deleteCourse(id: string): Promise<void> {
  // return client.delete<void>(`/api/courses/${id}`);
  writeLocal(readLocal().filter((c) => c.id !== id));
}
