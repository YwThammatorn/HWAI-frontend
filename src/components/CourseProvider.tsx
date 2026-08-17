"use client";

import { useState, useEffect, useCallback } from "react";
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

function saveToStorage(courses: Course[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(courses));
}

export default function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCourses(loadFromStorage());
    setReady(true);
  }, []);

  const persist = useCallback((next: Course[]) => {
    setCourses(next);
    saveToStorage(next);
  }, []);

  const addCourse = useCallback(
    (data: Omit<Course, "id" | "assignmentCount" | "activeAssignments" | "allGraded" | "createdAt">): Course => {
      const course: Course = {
        ...data,
        id: `c-${Date.now()}`,
        assignmentCount: 0,
        activeAssignments: 0,
        allGraded: false,
        createdAt: new Date().toISOString(),
      };
      persist([...courses, course]);
      return course;
    },
    [courses, persist]
  );

  const updateCourse = useCallback(
    (id: string, data: Partial<Omit<Course, "id" | "createdAt">>) => {
      persist(courses.map((c) => (c.id === id ? { ...c, ...data } : c)));
    },
    [courses, persist]
  );

  const removeCourse = useCallback(
    (id: string) => { persist(courses.filter((c) => c.id !== id)); },
    [courses, persist]
  );

  const getCourse = useCallback(
    (id: string) => courses.find((c) => c.id === id),
    [courses]
  );

  if (!ready) return null;

  return (
    <CourseContext.Provider value={{ courses, addCourse, updateCourse, removeCourse, getCourse }}>
      {children}
    </CourseContext.Provider>
  );
}
