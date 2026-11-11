"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { StudentContext, Student, withName, withoutMidterm, byRosterOrder } from "@/lib/students";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite, loadFailed } from "@/lib/api/sync";
import * as api from "@/lib/api/students";

const LS_KEY = "hwai_students_v1";

export default function StudentProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [students, setStudents] = useState<Student[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getStudents().then(setStudents, loadFailed("rosters"));
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setStudents((JSON.parse(raw) as Student[]).map(withName).map(withoutMidterm));
    } catch {}
  }, [resync]);

  const persist = useCallback((next: Student[]) => {
    setStudents(next);
    if (!API_ENABLED) localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addStudents = useCallback(
    (courseId: string, incoming: Omit<Student, "id" | "courseId">[]) => {
      // Append to the existing roster for this section — do not replace it. Everyone added is "enrolled";
      // the roster lists by student ID, so where someone joined makes no difference (7/11/2569).
      const next: Student[] = incoming.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        courseId,
        enrollmentStatus: s.enrollmentStatus ?? "enrolled",
      }));
      persist([...students, ...next]);
      sync(() => api.addStudents(courseId, next.map(({ courseId: _c, ...s }) => { void _c; return s; })));
    },
    [students, persist, sync]
  );

  const updateStudent = useCallback(
    (id: string, data: Partial<Omit<Student, "id" | "courseId">>) => {
      persist(students.map((s) => (s.id === id ? { ...s, ...data } : s)));
      sync(() => api.updateStudent(id, data));
    },
    [students, persist, sync]
  );

  const removeStudent = useCallback(
    (id: string) => {
      persist(students.filter((s) => s.id !== id));
      sync(() => api.removeStudent(id));
    },
    [students, persist, sync]
  );

  // Every screen sees a roster by student ID (the server sends that order too; the localStorage mock keeps insertion order).
  const ordered = useMemo(() => [...students].sort(byRosterOrder), [students]);
  const getStudentsByCourse = useCallback(
    (courseId: string) => ordered.filter((s) => s.courseId === courseId),
    [ordered]
  );

  return (
    <StudentContext.Provider value={{ students: ordered, addStudents, updateStudent, removeStudent, getStudentsByCourse }}>
      {children}
    </StudentContext.Provider>
  );
}
