"use client";

import { createContext, useContext } from "react";

export type CourseStatus = "active" | "archived";
export type CourseSource = "manual" | "google" | "teams";

export interface Course {
  id: string;
  name: string;
  description: string;
  studentCount: number;
  assignmentCount: number;
  activeAssignments: number;
  allGraded: boolean;
  status: CourseStatus;
  source: CourseSource;
  coverColor: string;
  iconColor: string;
  createdAt: string;
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
    studentCount: 28,
    assignmentCount: 1,
    activeAssignments: 1,
    allGraded: false,
    status: "active",
    source: "manual",
    coverColor: "#2DD4BF",
    iconColor: "#2DD4BF",
    createdAt: new Date().toISOString(),
  },
  {
    id: "seed-2",
    name: "Interaction Design",
    description: "",
    studentCount: 32,
    assignmentCount: 1,
    activeAssignments: 1,
    allGraded: false,
    status: "active",
    source: "manual",
    coverColor: "#A78BFA",
    iconColor: "#A78BFA",
    createdAt: new Date().toISOString(),
  },
];

export interface CourseContextValue {
  courses: Course[];
  addCourse: (data: Omit<Course, "id" | "assignmentCount" | "activeAssignments" | "allGraded" | "createdAt">) => Course;
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
