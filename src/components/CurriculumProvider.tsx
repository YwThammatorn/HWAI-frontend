"use client";

import { useState, useCallback } from "react";
import { CurriculumContext, CurriculumVersion, CourseTemplate } from "@/lib/curriculum";

const LS_VERSIONS = "hwai_curriculum_versions_v1";
const LS_TEMPLATES = "hwai_course_templates_v1";

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

export default function CurriculumProvider({ children }: { children: React.ReactNode }) {
  const [curriculumVersions, setCurriculumVersions] = useState<CurriculumVersion[]>(() => load(LS_VERSIONS));
  const [courseTemplates, setCourseTemplates] = useState<CourseTemplate[]>(() => load(LS_TEMPLATES));

  const persistVersions = useCallback((next: CurriculumVersion[]) => {
    setCurriculumVersions(next);
    localStorage.setItem(LS_VERSIONS, JSON.stringify(next));
  }, []);

  const persistTemplates = useCallback((next: CourseTemplate[]) => {
    setCourseTemplates(next);
    localStorage.setItem(LS_TEMPLATES, JSON.stringify(next));
  }, []);

  const addCurriculumVersion = useCallback((data: Omit<CurriculumVersion, "id">): CurriculumVersion => {
    const v: CurriculumVersion = { ...data, id: crypto.randomUUID() };
    persistVersions([...curriculumVersions, v]);
    return v;
  }, [curriculumVersions, persistVersions]);

  const updateCurriculumVersion = useCallback((id: string, data: Partial<Omit<CurriculumVersion, "id">>) => {
    persistVersions(curriculumVersions.map(v => v.id === id ? { ...v, ...data } : v));
  }, [curriculumVersions, persistVersions]);

  const removeCurriculumVersion = useCallback((id: string) => {
    persistVersions(curriculumVersions.filter(v => v.id !== id));
    persistTemplates(courseTemplates.filter(t => t.curriculumVersionId !== id)); // cascade
  }, [curriculumVersions, courseTemplates, persistVersions, persistTemplates]);

  const addCourseTemplate = useCallback((data: Omit<CourseTemplate, "id">): CourseTemplate => {
    const t: CourseTemplate = { ...data, id: crypto.randomUUID() };
    persistTemplates([...courseTemplates, t]);
    return t;
  }, [courseTemplates, persistTemplates]);

  const updateCourseTemplate = useCallback((id: string, data: Partial<Omit<CourseTemplate, "id" | "curriculumVersionId">>) => {
    persistTemplates(courseTemplates.map(t => t.id === id ? { ...t, ...data } : t));
  }, [courseTemplates, persistTemplates]);

  const removeCourseTemplate = useCallback((id: string) => {
    persistTemplates(courseTemplates.filter(t => t.id !== id));
  }, [courseTemplates, persistTemplates]);

  const getCourseTemplatesByCurriculum = useCallback((curriculumVersionId: string) =>
    courseTemplates.filter(t => t.curriculumVersionId === curriculumVersionId), [courseTemplates]);

  return (
    <CurriculumContext.Provider value={{
      curriculumVersions, courseTemplates,
      addCurriculumVersion, updateCurriculumVersion, removeCurriculumVersion,
      addCourseTemplate, updateCourseTemplate, removeCourseTemplate,
      getCourseTemplatesByCurriculum,
    }}>
      {children}
    </CurriculumContext.Provider>
  );
}
