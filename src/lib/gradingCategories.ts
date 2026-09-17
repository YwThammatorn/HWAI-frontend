"use client";

import { createContext, useContext } from "react";
import type { Assignment, Submission } from "./assignments";

export interface GradingCategory {
  id: string;
  courseId: string;
  name: string;
  weight: number; // 0–100, sum of all categories for a course should equal 100
  createdAt: string;
  updatedAt: string;
}

export interface CategoryGradeRow {
  category: GradingCategory;
  assignments: Assignment[];
  gradedCount: number;
  earnedPoints: number;
  possiblePoints: number;
  percent: number | null; // 0-100
  contribution: number | null; // this category's weighted contribution to the course total, 0-100
}

// A student's graded score for one assignment, or null if not yet graded.
export function scoreForAssignment(submissions: Submission[], assignmentId: string, studentId: string): number | null {
  const sub = submissions.find((s) => s.assignmentId === assignmentId && s.studentId === studentId);
  if (!sub || sub.status !== "graded") return null;
  return sub.instructorScore ?? sub.aiScore ?? 0;
}

// Per-category grade breakdown for one student — shared by the Evaluation
// page (full breakdown) and the Classwork page (compact summary), so the
// weighted-total math only lives in one place.
export function computeCategoryGradeRows(
  categories: GradingCategory[],
  assignments: Assignment[],
  submissions: Submission[],
  studentId: string
): CategoryGradeRow[] {
  return categories.map((category) => {
    const catAssignments = assignments.filter((a) => a.categoryId === category.id);
    let earnedPoints = 0, possiblePoints = 0, gradedCount = 0;
    catAssignments.forEach((a) => {
      const score = scoreForAssignment(submissions, a.id, studentId);
      if (score !== null) {
        earnedPoints += score;
        possiblePoints += a.maxPoints;
        gradedCount++;
      }
    });
    const percent = gradedCount > 0 && possiblePoints > 0 ? (earnedPoints / possiblePoints) * 100 : null;
    const contribution = percent !== null ? (percent / 100) * category.weight : null;
    return { category, assignments: catAssignments, gradedCount, earnedPoints, possiblePoints, percent, contribution };
  });
}

export function computeTotalSoFar(rows: CategoryGradeRow[]): number {
  return rows.filter((r) => r.percent !== null).reduce((sum, r) => sum + (r.contribution ?? 0), 0);
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
