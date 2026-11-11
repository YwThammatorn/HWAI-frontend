"use client";

import { useState, useCallback, useEffect } from "react";
import { GradingAssignmentContext, GradingAssignment } from "@/lib/grading-assignments";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite, loadFailed } from "@/lib/api/sync";
import * as api from "@/lib/api/grading-assignments";

const LS_KEY = "hwai_grading_assignments_v1";

export default function GradingAssignmentProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [gradingAssignments, setGradingAssignments] = useState<GradingAssignment[]>([]);
  const [ready, setReady] = useState(false);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getGradingAssignments().then((items) => { setGradingAssignments(items); setReady(true); }, (err) => { setReady(true); loadFailed("grading assignments")(err); });
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setGradingAssignments(JSON.parse(raw) as GradingAssignment[]);
    } catch {}
    setReady(true);
  }, [resync]);

  const persist = useCallback((next: GradingAssignment[]) => {
    setGradingAssignments(next);
    if (!API_ENABLED) localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addGradingAssignment = useCallback((data: Omit<GradingAssignment, "id">): GradingAssignment => {
    const g: GradingAssignment = { ...data, id: crypto.randomUUID() };
    persist([...gradingAssignments, g]);
    sync(() => api.addGradingAssignment({ ...data, id: g.id }));
    return g;
  }, [gradingAssignments, persist, sync]);

  const updateGradingAssignment = useCallback((id: string, data: Partial<Omit<GradingAssignment, "id" | "courseId">>) => {
    persist(gradingAssignments.map(g => g.id === id ? { ...g, ...data } : g));
    sync(() => api.updateGradingAssignment(id, data));
  }, [gradingAssignments, persist, sync]);

  const removeGradingAssignment = useCallback((id: string) => {
    persist(gradingAssignments.filter(g => g.id !== id));
    sync(() => api.removeGradingAssignment(id));
  }, [gradingAssignments, persist, sync]);

  // Cascade from deleting an account: in API mode the server already removed the records with the account — only the screen is updated.
  const removeAssignmentsByTa = useCallback((taAccountId: string) => {
    persist(gradingAssignments.filter(g => g.taAccountId !== taAccountId));
  }, [gradingAssignments, persist]);

  const removeAssignmentsByTaInCourse = useCallback((taAccountId: string, courseId: string) => {
    persist(gradingAssignments.filter(g => !(g.taAccountId === taAccountId && g.courseId === courseId)));
    sync(() => api.removeGradingAssignmentsByTaInCourse(taAccountId, courseId));
  }, [gradingAssignments, persist, sync]);

  // Cascade from deleting an assignment: the server drops it from every record itself (FK) — only the screen is updated.
  const removeAssignmentFromScopes = useCallback((assignmentId: string) => {
    if (!gradingAssignments.some(g => g.scope.type === "assignments" && g.scope.assignmentIds.includes(assignmentId))) return;
    persist(gradingAssignments.map(g => g.scope.type === "assignments" && g.scope.assignmentIds.includes(assignmentId)
      ? { ...g, scope: { type: "assignments" as const, assignmentIds: g.scope.assignmentIds.filter(i => i !== assignmentId) } }
      : g));
  }, [gradingAssignments, persist]);

  const getAssignmentsBySection = useCallback((courseId: string) =>
    gradingAssignments.filter(g => g.courseId === courseId), [gradingAssignments]);

  const getAssignmentsByTa = useCallback((taAccountId: string) =>
    gradingAssignments.filter(g => g.taAccountId === taAccountId), [gradingAssignments]);

  return (
    <GradingAssignmentContext.Provider value={{
      gradingAssignments, ready, addGradingAssignment, updateGradingAssignment, removeGradingAssignment, removeAssignmentsByTa,
      removeAssignmentsByTaInCourse, removeAssignmentFromScopes, getAssignmentsBySection, getAssignmentsByTa,
    }}>
      {children}
    </GradingAssignmentContext.Provider>
  );
}
