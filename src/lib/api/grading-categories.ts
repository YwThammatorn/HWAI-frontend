import { client } from "./client";
import type { GradingCategory } from "@/lib/gradingCategories";

const KEY = "hwai_grading_categories_v1";

function read(): GradingCategory[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GradingCategory[]) : [];
  } catch {
    return [];
  }
}

function write(items: GradingCategory[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// GradingCategoryContextValue (src/lib/gradingCategories.ts) 1:1.
export async function getGradingCategories(courseId?: string): Promise<GradingCategory[]> {
  // return client.get<GradingCategory[]>(courseId ? `/api/courses/${courseId}/grading-categories` : "/api/grading-categories");
  void client;
  const all = read();
  return courseId ? all.filter((c) => c.courseId === courseId) : all;
}

export async function addGradingCategory(data: Omit<GradingCategory, "id" | "createdAt" | "updatedAt">): Promise<GradingCategory> {
  // return client.post<GradingCategory>(`/api/courses/${data.courseId}/grading-categories`, data);
  const now = new Date().toISOString();
  const item: GradingCategory = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function updateGradingCategory(id: string, data: Partial<Omit<GradingCategory, "id" | "courseId" | "createdAt">>): Promise<GradingCategory> {
  // return client.patch<GradingCategory>(`/api/grading-categories/${id}`, data);
  const items = read().map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c));
  write(items);
  const updated = items.find((c) => c.id === id);
  if (!updated) throw new Error(`GradingCategory ${id} not found`);
  return updated;
}

export async function removeGradingCategory(id: string): Promise<void> {
  // return client.delete<void>(`/api/grading-categories/${id}`);
  write(read().filter((c) => c.id !== id));
}
