"use client";

import { useState, useCallback, useEffect } from "react";
import { CurriculumContext, CurriculumVersion, CourseTemplate } from "@/lib/curriculum";

const LS_VERSIONS = "hwai_curriculum_versions_v1";
const LS_TEMPLATES = "hwai_course_templates_v1";

function load<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

export default function CurriculumProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why these start empty and load in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [curriculumVersions, setCurriculumVersions] = useState<CurriculumVersion[]>([]);
  const [courseTemplates, setCourseTemplates] = useState<CourseTemplate[]>([]);

  useEffect(() => {
    setCurriculumVersions(load(LS_VERSIONS));
    setCourseTemplates(load(LS_TEMPLATES));
  }, []);

  // Functional updaters (not a plain array) so several calls made within the
  // same tick — e.g. CSV-importing N course templates in a forEach loop —
  // each build on the truly-latest state instead of the array captured when
  // the surrounding callback was memoized (which silently dropped all but
  // the last write; see the "Fix bulk course-template import" commit).
  const persistVersions = useCallback((updater: (prev: CurriculumVersion[]) => CurriculumVersion[]) => {
    setCurriculumVersions(prev => {
      const next = updater(prev);
      localStorage.setItem(LS_VERSIONS, JSON.stringify(next));
      return next;
    });
  }, []);

  const persistTemplates = useCallback((updater: (prev: CourseTemplate[]) => CourseTemplate[]) => {
    setCourseTemplates(prev => {
      const next = updater(prev);
      localStorage.setItem(LS_TEMPLATES, JSON.stringify(next));
      return next;
    });
  }, []);

  const addCurriculumVersion = useCallback((data: Omit<CurriculumVersion, "id">): CurriculumVersion => {
    const v: CurriculumVersion = { ...data, id: crypto.randomUUID() };
    persistVersions(prev => [...prev, v]);
    return v;
  }, [persistVersions]);

  const updateCurriculumVersion = useCallback((id: string, data: Partial<Omit<CurriculumVersion, "id">>) => {
    persistVersions(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  }, [persistVersions]);

  const removeCurriculumVersion = useCallback((id: string) => {
    persistVersions(prev => prev.filter(v => v.id !== id));
    persistTemplates(prev => prev.filter(t => t.curriculumVersionId !== id)); // cascade
  }, [persistVersions, persistTemplates]);

  const addCourseTemplate = useCallback((data: Omit<CourseTemplate, "id">): CourseTemplate => {
    const t: CourseTemplate = { ...data, id: crypto.randomUUID() };
    persistTemplates(prev => [...prev, t]);
    return t;
  }, [persistTemplates]);

  const updateCourseTemplate = useCallback((id: string, data: Partial<Omit<CourseTemplate, "id" | "curriculumVersionId">>) => {
    persistTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
  }, [persistTemplates]);

  const removeCourseTemplate = useCallback((id: string) => {
    persistTemplates(prev => prev.filter(t => t.id !== id));
  }, [persistTemplates]);

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
