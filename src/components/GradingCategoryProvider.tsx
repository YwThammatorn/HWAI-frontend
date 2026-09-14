"use client";

import { useState, useCallback, useEffect } from "react";
import { GradingCategoryContext, GradingCategory } from "@/lib/gradingCategories";

const LS_CATEGORIES = "hwai_grading_categories_v1";

const SEED_CATEGORIES: GradingCategory[] = [
  {
    id: "gcat-seed-1-1", courseId: "seed-1", name: "Assignments", weight: 40,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "gcat-seed-1-2", courseId: "seed-1", name: "Midterm", weight: 25,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "gcat-seed-1-3", courseId: "seed-1", name: "Final Project", weight: 35,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "gcat-seed-c1-1", courseId: "c-mock-1", name: "งานที่มอบหมาย", weight: 40,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "gcat-seed-c1-2", courseId: "c-mock-1", name: "สอบกลางภาค", weight: 25,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "gcat-seed-c1-3", courseId: "c-mock-1", name: "สอบปลายภาค", weight: 35,
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function GradingCategoryProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [categories, setCategories] = useState<GradingCategory[]>([]);

  useEffect(() => {
    setCategories(loadData<GradingCategory>(LS_CATEGORIES, SEED_CATEGORIES));
  }, []);

  const persist = useCallback((next: GradingCategory[]) => {
    setCategories(next);
    localStorage.setItem(LS_CATEGORIES, JSON.stringify(next));
  }, []);

  const addCategory = useCallback((data: Omit<GradingCategory, "id" | "createdAt" | "updatedAt">): GradingCategory => {
    const now = new Date().toISOString();
    const c: GradingCategory = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([...categories, c]);
    return c;
  }, [categories, persist]);

  const updateCategory = useCallback((id: string, data: Partial<Omit<GradingCategory, "id" | "courseId" | "createdAt" | "updatedAt">>) => {
    persist(categories.map(c => c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c));
  }, [categories, persist]);

  const removeCategory = useCallback((id: string) => {
    persist(categories.filter(c => c.id !== id));
  }, [categories, persist]);

  const getCategoriesByCourse = useCallback((courseId: string) =>
    categories.filter(c => c.courseId === courseId), [categories]);

  return (
    <GradingCategoryContext.Provider value={{ categories, addCategory, updateCategory, removeCategory, getCategoriesByCourse }}>
      {children}
    </GradingCategoryContext.Provider>
  );
}
