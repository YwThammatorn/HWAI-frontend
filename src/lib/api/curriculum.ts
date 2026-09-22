import { client } from "./client";
import type { CurriculumVersion, CourseTemplate } from "@/lib/curriculum";

const VERSIONS_KEY = "hwai_curriculum_versions_v1";
const TEMPLATES_KEY = "hwai_course_templates_v1";

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors CurriculumContextValue
// (src/lib/curriculum.ts) 1:1 — two related resources (a curriculum version and its course templates)
// in one file, matching how the live Provider bundles them into a single Context.
export async function getCurriculumVersions(): Promise<CurriculumVersion[]> {
  // return client.get<CurriculumVersion[]>("/api/curriculum-versions");
  void client;
  return read<CurriculumVersion>(VERSIONS_KEY);
}

export async function addCurriculumVersion(data: Omit<CurriculumVersion, "id">): Promise<CurriculumVersion> {
  // return client.post<CurriculumVersion>("/api/curriculum-versions", data);
  const item: CurriculumVersion = { ...data, id: crypto.randomUUID() };
  write(VERSIONS_KEY, [...read<CurriculumVersion>(VERSIONS_KEY), item]);
  return item;
}

export async function updateCurriculumVersion(id: string, data: Partial<Omit<CurriculumVersion, "id">>): Promise<CurriculumVersion> {
  // return client.patch<CurriculumVersion>(`/api/curriculum-versions/${id}`, data);
  const items = read<CurriculumVersion>(VERSIONS_KEY).map((v) => (v.id === id ? { ...v, ...data } : v));
  write(VERSIONS_KEY, items);
  const updated = items.find((v) => v.id === id);
  if (!updated) throw new Error(`CurriculumVersion ${id} not found`);
  return updated;
}

export async function removeCurriculumVersion(id: string): Promise<void> {
  // return client.delete<void>(`/api/curriculum-versions/${id}`); — expect the backend to cascade-delete
  // its course templates, same as the live Provider does client-side.
  write(VERSIONS_KEY, read<CurriculumVersion>(VERSIONS_KEY).filter((v) => v.id !== id));
  write(TEMPLATES_KEY, read<CourseTemplate>(TEMPLATES_KEY).filter((t) => t.curriculumVersionId !== id));
}

export async function getCourseTemplates(curriculumVersionId?: string): Promise<CourseTemplate[]> {
  // return client.get<CourseTemplate[]>(curriculumVersionId ? `/api/curriculum-versions/${curriculumVersionId}/course-templates` : "/api/course-templates");
  const all = read<CourseTemplate>(TEMPLATES_KEY);
  return curriculumVersionId ? all.filter((t) => t.curriculumVersionId === curriculumVersionId) : all;
}

export async function addCourseTemplate(data: Omit<CourseTemplate, "id">): Promise<CourseTemplate> {
  // return client.post<CourseTemplate>(`/api/curriculum-versions/${data.curriculumVersionId}/course-templates`, data);
  const item: CourseTemplate = { ...data, id: crypto.randomUUID() };
  write(TEMPLATES_KEY, [...read<CourseTemplate>(TEMPLATES_KEY), item]);
  return item;
}

export async function updateCourseTemplate(id: string, data: Partial<Omit<CourseTemplate, "id" | "curriculumVersionId">>): Promise<CourseTemplate> {
  // return client.patch<CourseTemplate>(`/api/course-templates/${id}`, data);
  const items = read<CourseTemplate>(TEMPLATES_KEY).map((t) => (t.id === id ? { ...t, ...data } : t));
  write(TEMPLATES_KEY, items);
  const updated = items.find((t) => t.id === id);
  if (!updated) throw new Error(`CourseTemplate ${id} not found`);
  return updated;
}

export async function removeCourseTemplate(id: string): Promise<void> {
  // return client.delete<void>(`/api/course-templates/${id}`);
  write(TEMPLATES_KEY, read<CourseTemplate>(TEMPLATES_KEY).filter((t) => t.id !== id));
}
