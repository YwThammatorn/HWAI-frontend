import { client } from "./client";
import type { GradingCategory } from "@/lib/gradingCategories";

// Backed by HWAI-backend. `id` is optional on create — GradingCategoryProvider sends a client-generated one.

/** One course's categories, or every course's when `courseId` is omitted. */
export async function getGradingCategories(courseId?: string): Promise<GradingCategory[]> {
  return client.get<GradingCategory[]>(courseId ? `/api/courses/${courseId}/grading-categories` : "/api/grading-categories");
}

export async function addGradingCategory(
  data: Omit<GradingCategory, "id" | "createdAt" | "updatedAt"> & { id?: string },
): Promise<GradingCategory> {
  return client.post<GradingCategory>(`/api/courses/${data.courseId}/grading-categories`, data);
}

export async function updateGradingCategory(
  id: string,
  data: Partial<Omit<GradingCategory, "id" | "courseId" | "createdAt" | "updatedAt">>,
): Promise<GradingCategory> {
  return client.patch<GradingCategory>(`/api/grading-categories/${id}`, data);
}

// Assignments in the category stay; the server clears their categoryId.
export async function removeGradingCategory(id: string): Promise<void> {
  return client.delete<void>(`/api/grading-categories/${id}`);
}
