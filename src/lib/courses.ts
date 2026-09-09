"use client";

import { createContext, useContext } from "react";
import type { CourseIconKey } from "@/components/CourseIcon";

export type CourseStatus = "active" | "archived";
export type CourseSource = "manual" | "google" | "teams";
export type GradingSource = "ta" | "ai" | "blind";
export type PublishMode = "auto" | "manual";
export type Term = 1 | 2 | "summer";

/**
 * `Course` is, in practice, section-shaped: it represents one offering of a
 * subject in one term, not the abstract subject itself. The fields below
 * (courseTemplateId, academicYear, term, sectionNumber, gradingSource,
 * publishMode) are the Section concept from PLAN.md Phase 1, added directly
 * onto the entity that 28+ files already consume rather than as a separate
 * split type — see docs/phase1-model-validation.md and PLAN.md Phase 4 for
 * why a hard Course/Section split was scoped out of this pass. All new
 * fields are optional so existing records and call sites keep working;
 * populate them going forward via the (not yet built) section-aware
 * create/edit UI.
 */
export interface Course {
  id: string;
  name: string;
  description: string;
  status: CourseStatus;
  source: CourseSource;
  coverColor: string;
  iconColor: string;
  /** Which glyph to show on the course card's identity strip — optional, falls back to "book" */
  icon?: CourseIconKey;
  createdAt: string;
  updatedAt: string;
  /** รหัสวิชา — denormalized from CourseTemplate when one is linked */
  code?: string;
  /** FK → CourseTemplate (src/lib/curriculum.ts) — which abstract subject this section is an offering of */
  courseTemplateId?: string;
  academicYear?: number;
  term?: Term;
  sectionNumber?: string;
  /** อาจารย์เลือกต่อ section ว่าใช้คะแนนจาก TA, AI, หรือ blind test (มติที่ประชุม 4/9/2569) */
  gradingSource?: GradingSource;
  /** ประกาศคะแนนอัตโนมัติ หรือรอ approve — ตั้งค่าต่อ section (มติที่ประชุม 4/9/2569 decision #2) */
  publishMode?: PublishMode;
}

export const PRESET_COLORS = [
  "#2DD4BF", "#1B2A4A", "#F472B6", "#FBBF24", "#A78BFA", "#92400E",
  "#34D399", "#9CA3AF", "#C084FC", "#F97316", "#38BDF8", "#EF4444",
];

export const SEED_COURSES: Course[] = [
  {
    id: "seed-1",
    name: "UX/UI Design",
    description: "",
    status: "active",
    source: "manual",
    coverColor: "#2DD4BF",
    iconColor: "#2DD4BF",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "seed-2",
    name: "Interaction Design",
    description: "",
    status: "active",
    source: "manual",
    coverColor: "#A78BFA",
    iconColor: "#A78BFA",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  },
];

export interface CourseContextValue {
  courses: Course[];
  addCourse: (data: Omit<Course, "id" | "createdAt" | "updatedAt">) => Course;
  updateCourse: (id: string, data: Partial<Omit<Course, "id" | "createdAt">>) => void;
  removeCourse: (id: string) => void;
  getCourse: (id: string) => Course | undefined;
}

export const CourseContext = createContext<CourseContextValue | null>(null);

export function useCourses(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) throw new Error("useCourses must be used inside <CourseProvider>");
  return ctx;
}
