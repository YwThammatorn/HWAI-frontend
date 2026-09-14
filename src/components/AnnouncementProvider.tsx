"use client";

import { useState, useCallback, useEffect } from "react";
import { AnnouncementContext, Announcement } from "@/lib/announcements";

const LS_ANNOUNCEMENTS = "hwai_announcements_v1";

const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-seed-c1-1", authorCourseId: "c-mock-1",
    scope: "this-section",
    title: "ยินดีต้อนรับเข้าสู่รายวิชา",
    body: "ยินดีต้อนรับนักศึกษาทุกคนเข้าสู่วิชาการเขียนโปรแกรมคอมพิวเตอร์ ภาคเรียนนี้ กรุณาตรวจสอบแผนการสอนรายสัปดาห์และสื่อการสอนในเมนูด้านซ้ายอย่างสม่ำเสมอ",
    createdAt: "2026-08-25T09:00:00.000Z", updatedAt: "2026-08-25T09:00:00.000Z",
  },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function AnnouncementProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    setAnnouncements(loadData<Announcement>(LS_ANNOUNCEMENTS, SEED_ANNOUNCEMENTS));
  }, []);

  const persist = useCallback((next: Announcement[]) => {
    setAnnouncements(next);
    localStorage.setItem(LS_ANNOUNCEMENTS, JSON.stringify(next));
  }, []);

  const addAnnouncement = useCallback((data: Omit<Announcement, "id" | "createdAt" | "updatedAt">): Announcement => {
    const now = new Date().toISOString();
    const a: Announcement = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([a, ...announcements]);
    return a;
  }, [announcements, persist]);

  const removeAnnouncement = useCallback((id: string) => {
    persist(announcements.filter(a => a.id !== id));
  }, [announcements, persist]);

  const getAnnouncementsByAuthorCourse = useCallback((courseId: string) =>
    announcements.filter(a => a.authorCourseId === courseId), [announcements]);

  return (
    <AnnouncementContext.Provider value={{ announcements, addAnnouncement, removeAnnouncement, getAnnouncementsByAuthorCourse }}>
      {children}
    </AnnouncementContext.Provider>
  );
}
