"use client";

import { useState, useCallback, useEffect } from "react";
import { WeeklyPlanContext, WeeklyPlanItem } from "@/lib/weeklyPlan";

const LS_WEEKLY_PLAN = "hwai_weekly_plan_v1";

const SEED_WEEKLY_PLAN: WeeklyPlanItem[] = [
  {
    id: "wp-seed-c1-1", courseId: "c-mock-1", week: 1,
    topic: "ปฐมนิเทศ และพื้นฐานภาษา Python (ตัวแปร, ชนิดข้อมูล)",
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "wp-seed-c1-2", courseId: "c-mock-1", week: 2,
    topic: "เงื่อนไขและการวนซ้ำ (if/else, for, while)",
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
  {
    id: "wp-seed-c1-3", courseId: "c-mock-1", week: 3,
    topic: "ฟังก์ชันและการจัดการ List/Dictionary",
    notes: "แจกโจทย์แบบฝึกหัด Python เบื้องต้น",
    createdAt: "2026-07-01T09:00:00.000Z", updatedAt: "2026-07-01T09:00:00.000Z",
  },
];

function loadData<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : fallback;
  } catch { return fallback; }
}

export default function WeeklyPlanProvider({ children }: { children: React.ReactNode }) {
  // See CourseProvider.tsx for why this starts empty and loads in an effect
  // instead of during the initial render (hydration-mismatch fix, [[project-hwai-meeting-20260826]]).
  const [items, setItems] = useState<WeeklyPlanItem[]>([]);

  useEffect(() => {
    setItems(loadData<WeeklyPlanItem>(LS_WEEKLY_PLAN, SEED_WEEKLY_PLAN));
  }, []);

  const persist = useCallback((next: WeeklyPlanItem[]) => {
    setItems(next);
    localStorage.setItem(LS_WEEKLY_PLAN, JSON.stringify(next));
  }, []);

  const addWeeklyPlanItem = useCallback((data: Omit<WeeklyPlanItem, "id" | "createdAt" | "updatedAt">): WeeklyPlanItem => {
    const now = new Date().toISOString();
    const item: WeeklyPlanItem = { ...data, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
    persist([...items, item]);
    return item;
  }, [items, persist]);

  const updateWeeklyPlanItem = useCallback((id: string, data: Partial<Omit<WeeklyPlanItem, "id" | "courseId" | "createdAt" | "updatedAt">>) => {
    persist(items.map(i => i.id === id ? { ...i, ...data, updatedAt: new Date().toISOString() } : i));
  }, [items, persist]);

  const removeWeeklyPlanItem = useCallback((id: string) => {
    persist(items.filter(i => i.id !== id));
  }, [items, persist]);

  const getWeeklyPlanByCourse = useCallback((courseId: string) =>
    items.filter(i => i.courseId === courseId).sort((a, b) => a.week - b.week), [items]);

  return (
    <WeeklyPlanContext.Provider value={{ items, addWeeklyPlanItem, updateWeeklyPlanItem, removeWeeklyPlanItem, getWeeklyPlanByCourse }}>
      {children}
    </WeeklyPlanContext.Provider>
  );
}
