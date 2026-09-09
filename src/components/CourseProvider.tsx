"use client";

import { useState, useCallback, useEffect } from "react";
import { CourseContext, Course, SEED_COURSES } from "@/lib/courses";

const LS_KEY = "hwai_courses_v2";

export default function CourseProvider({ children }: { children: React.ReactNode }) {
  // Starts empty on both server and the client's first hydration render —
  // reading localStorage during the initial render (the old pattern) made
  // SSR always render 0 items while client hydration read real/seed data,
  // a guaranteed hydration mismatch that surfaced as visible content
  // popping/shifting into place on every page load (worse wherever a
  // data-derived width also had a CSS transition). Real data loads in this
  // effect instead, which runs before AppShell's own auth-gate opens, so in
  // practice it's not visible. See [[project-hwai-meeting-20260826]].
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setCourses(raw ? (JSON.parse(raw) as Course[]) : SEED_COURSES);
    } catch {
      setCourses(SEED_COURSES);
    }
  }, []);

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
