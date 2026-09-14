"use client";

import { createContext, useContext } from "react";

export interface GradingCategory {
  id: string;
  courseId: string;
  name: string;
  weight: number; // 0–100, sum of all categories for a course should equal 100
  createdAt: string;
  updatedAt: string;
}

export interface GradingCategoryContextValue {
  categories: GradingCategory[];
  addCategory: (data: Omit<GradingCategory, "id" | "createdAt" | "updatedAt">) => GradingCategory;
  updateCategory: (id: string, data: Partial<Omit<GradingCategory, "id" | "courseId" | "createdAt" | "updatedAt">>) => void;
  removeCategory: (id: string) => void;
  getCategoriesByCourse: (courseId: string) => GradingCategory[];
}

export const GradingCategoryContext = createContext<GradingCategoryContextValue | null>(null);

export function useGradingCategories(): GradingCategoryContextValue {
  const ctx = useContext(GradingCategoryContext);
  if (!ctx) throw new Error("useGradingCategories must be used within GradingCategoryProvider");
  return ctx;
}
