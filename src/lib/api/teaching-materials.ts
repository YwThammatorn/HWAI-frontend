import { client } from "./client";
import type { TeachingMaterial } from "@/lib/teachingMaterials";

const KEY = "hwai_teaching_materials_v1";

function read(): TeachingMaterial[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TeachingMaterial[]) : [];
  } catch {
    return [];
  }
}

function write(items: TeachingMaterial[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors
// TeachingMaterialContextValue (src/lib/teachingMaterials.ts) 1:1. `source: "upload"` materials store
// a fileStorage key in `ref` today (see lib/fileStorage.ts) — a real backend should resolve that to
// an object-storage URL server-side so `ref` stays a plain string either way.
export async function getTeachingMaterials(courseId?: string): Promise<TeachingMaterial[]> {
  // return client.get<TeachingMaterial[]>(courseId ? `/api/courses/${courseId}/materials` : "/api/teaching-materials");
  void client;
  const all = read();
  return courseId ? all.filter((m) => m.courseId === courseId) : all;
}

export async function addTeachingMaterial(data: Omit<TeachingMaterial, "id" | "createdAt" | "updatedAt">): Promise<TeachingMaterial> {
  // return client.post<TeachingMaterial>(`/api/courses/${data.courseId}/materials`, data);
  const now = new Date().toISOString();
  const item: TeachingMaterial = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function removeTeachingMaterial(id: string): Promise<void> {
  // return client.delete<void>(`/api/teaching-materials/${id}`);
  write(read().filter((m) => m.id !== id));
}
