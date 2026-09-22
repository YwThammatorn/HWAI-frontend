import { client } from "./client";
import type { CLO } from "@/lib/clo";

const KEY = "hwai_clos_v1";

function read(): CLO[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CLO[]) : [];
  } catch {
    return [];
  }
}

function write(items: CLO[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors CLOContextValue
// (src/lib/clo.ts) 1:1.
export async function getCLOs(courseId?: string): Promise<CLO[]> {
  // return client.get<CLO[]>(courseId ? `/api/courses/${courseId}/clos` : "/api/clos");
  void client;
  const all = read();
  return courseId ? all.filter((c) => c.courseId === courseId) : all;
}

export async function addCLO(data: Omit<CLO, "id" | "createdAt" | "updatedAt">): Promise<CLO> {
  // return client.post<CLO>(`/api/courses/${data.courseId}/clos`, data);
  const now = new Date().toISOString();
  const item: CLO = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function updateCLO(id: string, data: Partial<Omit<CLO, "id" | "courseId" | "createdAt" | "updatedAt">>): Promise<CLO> {
  // return client.patch<CLO>(`/api/clos/${id}`, data);
  const items = read().map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c));
  write(items);
  const updated = items.find((c) => c.id === id);
  if (!updated) throw new Error(`CLO ${id} not found`);
  return updated;
}

export async function removeCLO(id: string): Promise<void> {
  // return client.delete<void>(`/api/clos/${id}`);
  write(read().filter((c) => c.id !== id));
}
