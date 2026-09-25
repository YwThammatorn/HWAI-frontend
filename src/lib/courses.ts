"use client";

import { createContext, useContext } from "react";
import type { CourseIconKey } from "@/components/CourseIcon";

export type CourseStatus = "active" | "archived";
export type Term = 1 | 2 | 3 | "summer";

/**
 * `Course` is, in practice, section-shaped: it represents one offering of a
 * subject in one term, not the abstract subject itself. The fields below
 * (courseTemplateId, academicYear, term, sectionNumber) are the Section concept from PLAN.md Phase 1, added directly
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
  coverColor: string;
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
  /** วันเวลาเรียน — free text, e.g. "จันทร์ 9:00-12:00" */
  schedule?: string;
  /** เลขห้องเรียน — free text, e.g. "811" */
  room?: string;
}

// "Slate Morning" course-cover palette (10/9/2569) — replaces the old raw
// Tailwind-candy set (bright #2DD4BF/#F472B6/#FBBF24/etc.) which clashed with
// the app's muted navy+teal identity. Each value is either reused directly
// from an existing design-system token (so a course cover never introduces
// a color unseen elsewhere in the app) or a new hue calibrated to the same
// muted/darkened mood — no color here is a raw saturated primary.
export const PRESET_COLORS = [
  "#0F766E", // teal — --accent-solid
  "#1A2D45", // navy — --text-primary / --bg-nav
  "#2B4D8C", // steel blue — --s-info-text
  "#5B4E96", // muted purple — --role-ta-text
  "#6B4FA0", // plum
  "#3F7A5C", // sage green
  "#92400E", // brown
  "#B5541F", // terracotta
  "#A97719", // muted gold
  "#B14C6B", // dusty rose
  "#4A6478", // slate gray — --text-secondary
  "#C43A4A", // brick red — --danger-solid
];

export const SEED_COURSES: Course[] = [
  {
    id: "seed-1",
    name: "UX/UI Design",
    description: "",
    status: "active",
    coverColor: "#0F766E",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    schedule: "จันทร์ 13:00-16:00",
    room: "305",
  },
  {
    id: "seed-2",
    name: "Interaction Design",
    description: "",
    status: "active",
    coverColor: "#5B4E96",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    schedule: "พฤหัสบดี 9:00-12:00",
    room: "412",
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
