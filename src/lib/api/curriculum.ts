import { client } from "./client";
import { withNulls } from "./sync";
import type { CurriculumVersion, CourseTemplate } from "@/lib/curriculum";

// Backed by HWAI-backend. Two related resources (a curriculum version and its course templates) in one
// file, matching how CurriculumProvider bundles them into a single Context. `id` is optional on create —
// the Provider sends a client-generated one (see api/sync.ts).
export async function getCurriculumVersions(): Promise<CurriculumVersion[]> {
  return client.get<CurriculumVersion[]>("/api/curriculum-versions");
}

export async function addCurriculumVersion(data: Omit<CurriculumVersion, "id"> & { id?: string }): Promise<CurriculumVersion> {
  return client.post<CurriculumVersion>("/api/curriculum-versions", data);
}

export async function updateCurriculumVersion(id: string, data: Partial<Omit<CurriculumVersion, "id">>): Promise<CurriculumVersion> {
  return client.patch<CurriculumVersion>(`/api/curriculum-versions/${id}`, withNulls(data));
}

// Server cascades: the version's course templates.
export async function removeCurriculumVersion(id: string): Promise<void> {
  return client.delete<void>(`/api/curriculum-versions/${id}`);
}

export async function getCourseTemplates(curriculumVersionId?: string): Promise<CourseTemplate[]> {
  return client.get<CourseTemplate[]>(
    curriculumVersionId ? `/api/curriculum-versions/${curriculumVersionId}/course-templates` : "/api/course-templates",
  );
}

export async function addCourseTemplate(data: Omit<CourseTemplate, "id"> & { id?: string }): Promise<CourseTemplate> {
  return client.post<CourseTemplate>(`/api/curriculum-versions/${data.curriculumVersionId}/course-templates`, data);
}

export async function updateCourseTemplate(id: string, data: Partial<Omit<CourseTemplate, "id" | "curriculumVersionId">>): Promise<CourseTemplate> {
  return client.patch<CourseTemplate>(`/api/course-templates/${id}`, withNulls(data));
}

export async function removeCourseTemplate(id: string): Promise<void> {
  return client.delete<void>(`/api/course-templates/${id}`);
}
