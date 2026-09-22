import { client } from "./client";
import type { WeeklyPlanItem } from "@/lib/weeklyPlan";

const KEY = "hwai_weekly_plan_v1";

function read(): WeeklyPlanItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WeeklyPlanItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: WeeklyPlanItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(items));
}

// Phase 1: localStorage — swap to client.*() when backend is ready. Mirrors WeeklyPlanContextValue
// (src/lib/weeklyPlan.ts) 1:1.
export async function getWeeklyPlan(courseId?: string): Promise<WeeklyPlanItem[]> {
  // return client.get<WeeklyPlanItem[]>(courseId ? `/api/courses/${courseId}/weekly-plan` : "/api/weekly-plan");
  void client;
  const all = read();
  return courseId ? all.filter((w) => w.courseId === courseId) : all;
}

export async function addWeeklyPlanItem(data: Omit<WeeklyPlanItem, "id" | "createdAt" | "updatedAt">): Promise<WeeklyPlanItem> {
  // return client.post<WeeklyPlanItem>(`/api/courses/${data.courseId}/weekly-plan`, data);
  const now = new Date().toISOString();
  const item: WeeklyPlanItem = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  write([...read(), item]);
  return item;
}

export async function updateWeeklyPlanItem(id: string, data: Partial<Omit<WeeklyPlanItem, "id" | "courseId" | "createdAt" | "updatedAt">>): Promise<WeeklyPlanItem> {
  // return client.patch<WeeklyPlanItem>(`/api/weekly-plan/${id}`, data);
  const items = read().map((w) => (w.id === id ? { ...w, ...data, updatedAt: new Date().toISOString() } : w));
  write(items);
  const updated = items.find((w) => w.id === id);
  if (!updated) throw new Error(`WeeklyPlanItem ${id} not found`);
  return updated;
}

export async function removeWeeklyPlanItem(id: string): Promise<void> {
  // return client.delete<void>(`/api/weekly-plan/${id}`);
  write(read().filter((w) => w.id !== id));
}
