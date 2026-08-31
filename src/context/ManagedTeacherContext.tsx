"use client";

import { useState, useEffect } from "react";
import { ManagedTeacherContext, ManagedTeacher } from "@/lib/managed-teachers";

const STORAGE_KEY = "hwai_managed_teachers_v1";

function uuid() {
  return crypto.randomUUID();
}

export default function ManagedTeacherProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<ManagedTeacher[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        type Stored = Omit<ManagedTeacher, "status"> & { status?: "active" | "suspended" };
        const parsed = JSON.parse(stored) as Stored[];
        setTeachers(parsed.map((tc) => ({ ...tc, status: tc.status ?? "active" })));
      }
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function persist(next: ManagedTeacher[]) {
    setTeachers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addTeacher(data: Omit<ManagedTeacher, "id" | "courseIds" | "status">): ManagedTeacher {
    const teacher: ManagedTeacher = { ...data, id: uuid(), courseIds: [], status: "active" };
    persist([...teachers, teacher]);
    return teacher;
  }

  function importTeachers(data: Omit<ManagedTeacher, "id" | "courseIds" | "status">[]): ManagedTeacher[] {
    const newTeachers = data.map((d) => ({ ...d, id: uuid(), courseIds: [] as string[], status: "active" as const }));
    persist([...teachers, ...newTeachers]);
    return newTeachers;
  }

  function updateTeacher(id: string, data: Partial<Omit<ManagedTeacher, "id">>) {
    persist(teachers.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }

  function removeTeacher(id: string) {
    persist(teachers.filter((t) => t.id !== id));
  }

  function suspendTeacher(id: string) {
    persist(teachers.map((t) => (t.id === id ? { ...t, status: "suspended" as const } : t)));
  }

  function reactivateTeacher(id: string) {
    persist(teachers.map((t) => (t.id === id ? { ...t, status: "active" as const } : t)));
  }

  function getTeacher(id: string) {
    return teachers.find((t) => t.id === id);
  }

  function assignToCourse(teacherId: string, courseId: string) {
    persist(
      teachers.map((t) =>
        t.id === teacherId && !t.courseIds.includes(courseId)
          ? { ...t, courseIds: [...t.courseIds, courseId] }
          : t
      )
    );
  }

  function unassignFromCourse(teacherId: string, courseId: string) {
    persist(
      teachers.map((t) =>
        t.id === teacherId
          ? { ...t, courseIds: t.courseIds.filter((c) => c !== courseId) }
          : t
      )
    );
  }

  function getTeachersByCourse(courseId: string) {
    return teachers.filter((t) => t.courseIds.includes(courseId));
  }

  return (
    <ManagedTeacherContext.Provider
      value={{
        teachers,
        addTeacher,
        importTeachers,
        updateTeacher,
        removeTeacher,
        suspendTeacher,
        reactivateTeacher,
        getTeacher,
        assignToCourse,
        unassignFromCourse,
        getTeachersByCourse,
      }}
    >
      {children}
    </ManagedTeacherContext.Provider>
  );
}
