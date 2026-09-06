"use client";

import { createContext, useContext } from "react";

export type Program = "CECS" | "CEI" | "CE";

export interface CurriculumVersion {
  id: string;
  program: Program;
  label: string; // e.g. "CE 2565"
  effectiveFrom: number; // พ.ศ.
  effectiveTo?: number; // undefined = still in use
}

export interface CourseTemplate {
  id: string;
  curriculumVersionId: string;
  code: string;
  name: string;
  description?: string;
}

export interface CurriculumContextValue {
  curriculumVersions: CurriculumVersion[];
  courseTemplates: CourseTemplate[];
  addCurriculumVersion: (data: Omit<CurriculumVersion, "id">) => CurriculumVersion;
  updateCurriculumVersion: (id: string, data: Partial<Omit<CurriculumVersion, "id">>) => void;
  removeCurriculumVersion: (id: string) => void;
  addCourseTemplate: (data: Omit<CourseTemplate, "id">) => CourseTemplate;
  updateCourseTemplate: (id: string, data: Partial<Omit<CourseTemplate, "id" | "curriculumVersionId">>) => void;
  removeCourseTemplate: (id: string) => void;
  getCourseTemplatesByCurriculum: (curriculumVersionId: string) => CourseTemplate[];
}

export const CurriculumContext = createContext<CurriculumContextValue | null>(null);

export function useCurriculum(): CurriculumContextValue {
  const ctx = useContext(CurriculumContext);
  if (!ctx) throw new Error("useCurriculum must be used inside <CurriculumProvider>");
  return ctx;
}
