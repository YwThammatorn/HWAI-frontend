"use client";

import { createContext, useContext } from "react";

export interface WeeklyPlanItem {
  id: string;
  courseId: string;
  week: number; // 1-indexed
  topic: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlanContextValue {
  items: WeeklyPlanItem[];
  addWeeklyPlanItem: (data: Omit<WeeklyPlanItem, "id" | "createdAt" | "updatedAt">) => WeeklyPlanItem;
  updateWeeklyPlanItem: (id: string, data: Partial<Omit<WeeklyPlanItem, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeWeeklyPlanItem: (id: string) => void;
  getWeeklyPlanByCourse: (courseId: string) => WeeklyPlanItem[];
}

export const WeeklyPlanContext = createContext<WeeklyPlanContextValue | null>(null);

export function useWeeklyPlan(): WeeklyPlanContextValue {
  const ctx = useContext(WeeklyPlanContext);
  if (!ctx) throw new Error("useWeeklyPlan must be used within WeeklyPlanProvider");
  return ctx;
}
