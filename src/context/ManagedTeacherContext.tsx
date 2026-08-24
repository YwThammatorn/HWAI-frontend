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
      if (stored) setTeachers(JSON.parse(stored));
    } catch {
      // ignore corrupt storage
    }
  }, []);

  function persist(next: ManagedTeacher[]) {
    setTeachers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addTeacher(data: Omit<ManagedTeacher, "id" | "courseIds">): ManagedTeacher {
    const teacher: ManagedTeacher = { ...data, id: uuid(), courseIds: [] };
    persist([...teachers, teacher]);
    return teacher;
  }

  function updateTeacher(id: string, data: Partial<Omit<ManagedTeacher, "id">>) {
    persist(teachers.map((t) => (t.id === id ? { ...t, ...data } : t)));
  }

  function removeTeacher(id: string) {
    persist(teachers.filter((t) => t.id !== id));
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
        updateTeacher,
        removeTeacher,
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
