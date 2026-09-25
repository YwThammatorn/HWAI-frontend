"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { CourseContext, Course, SEED_COURSES } from "@/lib/courses";
import { API_ENABLED } from "@/lib/api/client";
import { enqueueWrite } from "@/lib/api/sync";
import * as api from "@/lib/api/courses";

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
  // Always the newest list: several mutations in one handler (e.g. opening 3 sections at once) must
  // build on each other instead of each starting from the same stale render's `courses`.
  const latest = useRef<Course[]>([]);

  // API mode: reload from the server — on mount, and after a failed write (see api/sync.ts).
  const resync = useCallback(() => {
    api.getCourses().then(
      (loaded) => {
        latest.current = loaded;
        setCourses(loaded);
      },
      (err) => console.error("[api] load courses", err),
    );
  }, []);

  useEffect(() => {
    if (API_ENABLED) {
      resync();
      return;
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      const loaded = raw ? (JSON.parse(raw) as Course[]) : SEED_COURSES;
      latest.current = loaded;
      setCourses(loaded);
    } catch {
      latest.current = SEED_COURSES;
      setCourses(SEED_COURSES);
    }
  }, [resync]);

  const persist = useCallback((next: Course[]) => {
    latest.current = next;
    setCourses(next);
    if (!API_ENABLED) localStorage.setItem(LS_KEY, JSON.stringify(next));
  }, []);

  /** API mode only: send a write to the server after the optimistic local update. */
  const sync = useCallback((task: () => Promise<unknown>) => {
    if (API_ENABLED) enqueueWrite(task, resync);
  }, [resync]);

  const addCourse = useCallback(
    (data: Omit<Course, "id" | "createdAt" | "updatedAt">): Course => {
      const now = new Date().toISOString();
      const course: Course = {
        ...data,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      };
      persist([...latest.current, course]);
      sync(() => api.createCourse({ ...data, id: course.id }));
      return course;
    },
    [persist, sync]
  );

  const updateCourse = useCallback(
    (id: string, data: Partial<Omit<Course, "id" | "createdAt">>) => {
      persist(
        latest.current.map((c) =>
          c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c
        )
      );
      const changes = { ...data };
      delete changes.updatedAt; // server-owned
      sync(() => api.updateCourse(id, changes));
    },
    [persist, sync]
  );

  const removeCourse = useCallback(
    (id: string) => {
      persist(latest.current.filter((c) => c.id !== id));
      sync(() => api.deleteCourse(id));
    },
    [persist, sync]
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
