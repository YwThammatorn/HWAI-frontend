"use client";

import { useState, useCallback } from "react";
import { StudentContext, Student } from "@/lib/students";

const LS_KEY = "hwai_students_v1";

function load(): Student[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Student[]) : [];
  } catch { return []; }
}

export default function StudentProvider({ children }: { children: React.ReactNode }) {
  const [students, setStudents] = useState<Student[]>(() => load());

  const persist = useCallback((next: Student[]) => {
    setStudents(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const addStudents = useCallback(
    (courseId: string, incoming: Omit<Student, "id" | "courseId">[]) => {
      const next: Student[] = incoming.map((s) => ({
        ...s,
        id: crypto.randomUUID(),
        courseId,
      }));
      persist([...students.filter((s) => s.courseId !== courseId), ...next]);
    },
    [students, persist]
  );

  const removeStudent = useCallback(
    (id: string) => persist(students.filter((s) => s.id !== id)),
    [students, persist]
  );

  const getStudentsByCourse = useCallback(
    (courseId: string) => students.filter((s) => s.courseId === courseId),
    [students]
  );

  return (
    <StudentContext.Provider value={{ students, addStudents, removeStudent, getStudentsByCourse }}>
      {children}
    </StudentContext.Provider>
  );
}
