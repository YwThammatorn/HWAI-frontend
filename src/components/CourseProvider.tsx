"use client";

import { useState, useCallback } from "react";
import { CourseContext, Course, SEED_COURSES } from "@/lib/courses";

const LS_KEY = "hwai_courses_v2";

function loadFromStorage(): Course[] {
  if (typeof window === "undefined") return SEED_COURSES;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return SEED_COURSES;
    return JSON.parse(raw) as Course[];
  } catch {
    return SEED_COURSES;
  }
}

export default function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>(() => loadFromStorage());

  const persist = useCallback((next: Course[]) => {
    setCourses(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  const addCourse = useCallback(
    (data: Omit<Course, "id" | "createdAt" | "updatedAt">): Course => {
      const now = new Date().toISOString();
      const course: Course = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      persist([...courses, course]);
      return course;
    },
    [courses, persist]
  );

  const updateCourse = useCallback(
    (id: string, data: Partial<Omit<Course, "id" | "createdAt">>) => {
      persist(
        courses.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        )
      );
    },
    [courses, persist]
  );

  const removeCourse = useCallback(
    (id: string) => persist(courses.filter((c) => c.id !== id)),
    [courses, persist]
  );

  const getCourse = useCallback(
    (id: string) => courses.find((c) => c.id === id),
    [courses]
  );

  return (
    <CourseContext.Provider value={{ courses, addCourse, updateCourse, removeCourse, getCourse }}>
      {children}
    </CourseContext.Provider>
  );
}
