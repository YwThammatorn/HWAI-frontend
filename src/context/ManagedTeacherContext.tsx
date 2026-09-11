"use client";

import { useState, useEffect } from "react";
import { ManagedTeacherContext, ManagedTeacher, splitTeacherTitle } from "@/lib/managed-teachers";
import { useSectionRoles } from "@/lib/section-roles";
import { useGradingAssignments } from "@/lib/grading-assignments";

const STORAGE_KEY = "hwai_managed_teachers_v1";

function uuid() {
  return crypto.randomUUID();
}

export default function ManagedTeacherProvider({ children }: { children: React.ReactNode }) {
  const [teachers, setTeachers] = useState<ManagedTeacher[]>([]);
  const { removeRolesByAccount } = useSectionRoles();
  const { removeAssignmentsByTa } = useGradingAssignments();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        // "suspended" is the pre-9/9/2569 value — migrate any persisted demo
        // data on load so old localStorage doesn't resurrect the retired term.
        type Stored = Omit<ManagedTeacher, "status"> & { status?: "active" | "inactive" | "suspended" };
        const parsed = JSON.parse(stored) as Stored[];
        setTeachers(parsed.map((tc) => {
          // 10/9/2569: title used to be baked into `name` ("ผศ.สมศักดิ์ ...").
          // Split it out on load so old data gets the new separate field too.
          const { title, name } = tc.title ? { title: tc.title, name: tc.name } : splitTeacherTitle(tc.name);
          return { ...tc, title, name, status: tc.status === "suspended" ? "inactive" : (tc.status ?? "active") };
        }));
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
    removeRolesByAccount(id); // cascade
    removeAssignmentsByTa(id); // cascade
  }

  function deactivateTeacher(id: string) {
    persist(teachers.map((t) => (t.id === id ? { ...t, status: "inactive" as const } : t)));
  }

  function activateTeacher(id: string) {
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
        deactivateTeacher,
        activateTeacher,
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
