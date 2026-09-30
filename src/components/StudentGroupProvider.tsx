"use client";

import { useState, useCallback, useEffect } from "react";
import { StudentGroupContext, StudentGroup } from "@/lib/studentGroups";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite } from "@/lib/api/sync";
import * as api from "@/lib/api/student-groups";

const LS_KEY = "hwai_student_groups_v1";

function loadData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function StudentGroupProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getStudentGroups().then(setGroups, (err) => console.error("[api] load student groups", err));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    setGroups(loadData<StudentGroup>(LS_KEY, []));
  }, [resync]);

  const persist = useCallback((next: StudentGroup[]) => {
    setGroups(next);
    if (!API_ENABLED) localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addGroup = useCallback((data: Omit<StudentGroup, "id" | "createdAt" | "updatedAt">): StudentGroup => {
    const now = new Date().toISOString();
    const g: StudentGroup = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([...groups, g]);
    sync(() => api.addStudentGroup({ ...data, id: g.id }));
    return g;
  }, [groups, persist, sync]);

  const updateGroup = useCallback((id: string, data: Partial<Pick<StudentGroup, "name" | "memberStudentIds">>) => {
    persist(groups.map(g => g.id === id ? { ...g, ...data, updatedAt: new Date().toISOString() } : g));
    sync(() => api.updateStudentGroup(id, data));
  }, [groups, persist, sync]);

  const removeGroup = useCallback((id: string) => {
    persist(groups.filter(g => g.id !== id));
    sync(() => api.removeStudentGroup(id));
  }, [groups, persist, sync]);

  const getGroupsByAssignment = useCallback((assignmentId: string) =>
    groups.filter(g => g.assignmentId === assignmentId), [groups]);

  const getGroupsByCourse = useCallback((courseId: string) =>
    groups.filter(g => g.courseId === courseId), [groups]);

  const getGroupForStudent = useCallback((assignmentId: string, studentId: string) =>
    groups.find(g => g.assignmentId === assignmentId && g.memberStudentIds.includes(studentId)), [groups]);

  return (
    <StudentGroupContext.Provider value={{
      groups, addGroup, updateGroup, removeGroup,
      getGroupsByAssignment, getGroupsByCourse, getGroupForStudent,
    }}>
      {children}
    </StudentGroupContext.Provider>
  );
}
