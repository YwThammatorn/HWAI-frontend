"use client";

import { useState, useCallback, useEffect } from "react";
import { GradingAssignmentContext, GradingAssignment } from "@/lib/grading-assignments";

const LS_KEY = "hwai_grading_assignments_v1";

export default function GradingAssignmentProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [gradingAssignments, setGradingAssignments] = useState<GradingAssignment[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setGradingAssignments(JSON.parse(raw) as GradingAssignment[]);
    } catch {}
  }, []);

  const persist = useCallback((next: GradingAssignment[]) => {
    setGradingAssignments(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const addGradingAssignment = useCallback((data: Omit<GradingAssignment, "id">): GradingAssignment => {
    const g: GradingAssignment = { ...data, id: crypto.randomUUID() };
    persist([...gradingAssignments, g]);
    return g;
  }, [gradingAssignments, persist]);

  const updateGradingAssignment = useCallback((id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>) => {
    persist(gradingAssignments.map(g => g.id === id ? { ...g, ...data } : g));
  }, [gradingAssignments, persist]);

  const removeGradingAssignment = useCallback((id: string) => {
    persist(gradingAssignments.filter(g => g.id !== id));
  }, [gradingAssignments, persist]);

  const removeAssignmentsByTa = useCallback((taAccountId: string) => {
    persist(gradingAssignments.filter(g => g.taAccountId !== taAccountId));
  }, [gradingAssignments, persist]);

  const getAssignmentsBySection = useCallback((courseId: string) =>
    gradingAssignments.filter(g => g.courseId === courseId), [gradingAssignments]);

  const getAssignmentsByTa = useCallback((taAccountId: string) =>
    gradingAssignments.filter(g => g.taAccountId === taAccountId), [gradingAssignments]);

  return (
    <GradingAssignmentContext.Provider value={{
      gradingAssignments, addGradingAssignment, updateGradingAssignment, removeGradingAssignment, removeAssignmentsByTa,
      getAssignmentsBySection, getAssignmentsByTa,
    }}>
      {children}
    </GradingAssignmentContext.Provider>
  );
}
